import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { QueryResult, type PoolClient } from 'pg';
import pool from '../config/database';
import { legacyAuthEmail, normalizeAuthEmail } from '../services/auth-email';
import {
  CloudinaryUploadResult,
  deleteCloudinaryImage,
  extractCloudinaryPublicId,
  uploadImage,
} from '../services/cloudinary.service';
import { sendPasswordResetEmail } from '../services/mail.service';
import { getNewPasswordError } from '../services/password-policy';
import { AuthPayload } from '../types';
import { mapDbError } from '../utils/db-errors';
import { safeRollback } from '../utils/safe-rollback';

interface AvatarUpdateRow {
  id: number;
  avatar: string;
}

// สร้าง JWT token สำหรับยืนยันตัวตนโดยเก็บ id, email และ role ของผู้ใช้
const generateToken = (payload: AuthPayload): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  const issuedAtMs = Date.now();
  return jwt.sign({ ...payload, issued_at_ms: issuedAtMs, iat: Math.floor(issuedAtMs / 1000) }, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
};

// รวมชื่อและนามสกุลเป็นชื่อที่แสดงผลในระบบ
const buildDisplayName = (firstName?: string | null, lastName?: string | null): string => {
  return `${firstName || ''} ${lastName || ''}`.trim();
};

// สร้างรหัส OTP สำหรับรีเซ็ตรหัสผ่านพร้อมค่า hash และเวลาหมดอายุ
const createPasswordResetOtp = () => {
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const hashedOtp = crypto.createHash('sha256').update(otpCode).digest('hex');
  const expiresInMinutes = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || '30');
  const expiresAt = new Date(Date.now() + 1000 * 60 * expiresInMinutes);

  return { otpCode, hashedOtp, expiresAt };
};

// สมัครสมาชิกใหม่ด้วยอีเมลและรหัสผ่านพร้อมสร้าง JWT token ให้ใช้งานทันที
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { first_name, last_name, email, password, phone, line_id, facebook } = req.body;

    const existing = await pool.query(
      `SELECT member_id FROM members
       WHERE LOWER(email) = LOWER($1) OR LOWER(email) = LOWER($2)
          OR (SPLIT_PART(LOWER(email), '@', 2) IN ('gmail.com', 'googlemail.com')
              AND REGEXP_REPLACE(SPLIT_PART(SPLIT_PART(LOWER(email), '@', 1), '+', 1), '[.]', '', 'g') || '@gmail.com' = $2)`,
      [email, legacyAuthEmail(email)]
    );
    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'อีเมลนี้ถูกใช้สมัครแล้ว' });
      return;
    }

    let avatarUrl: string | null = null;
    if (req.file) {
      try {
        const uploadedAvatar = await uploadImage(req.file.buffer, {
          folder: 'walai-booking/avatars',
        });
        avatarUrl = uploadedAvatar.url;
      } catch (uploadError) {
        console.error('Registration profile avatar upload error:', uploadError);
      }
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO members (first_name, last_name, email, password, phone, line_id, facebook, auth_provider, image_profile, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'email', $8, $9)
       RETURNING member_id, first_name, last_name, email, phone, line_id, facebook, image_profile, avatar_url`,
      [first_name, last_name, email, password_hash, phone || null, line_id || null, facebook || null, avatarUrl, avatarUrl]
    );
    const token = generateToken({ id: result.rows[0].member_id, email, role: 'customer' });
    const { password: _, ...userSafe } = result.rows[0];

    res.status(201).json({ success: true, message: 'Registration successful', data: { user: userSafe, token } });
  } catch (error) {
    console.error('Registration error:', error);
    const registerError = mapDbError(error);
    if (registerError) {
      res.status(registerError.status).json({ success: false, message: registerError.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// เข้าสู่ระบบโดยตรวจสอบบัญชีพนักงานก่อนแล้วจึงตรวจสมาชิกพร้อมคืนเส้นทางตามสิทธิ์
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    let result = await pool.query(
      'SELECT * FROM staff WHERE (LOWER(email) = LOWER($1) OR LOWER(email) = LOWER($2)) AND status = true ORDER BY CASE WHEN LOWER(email) = LOWER($1) THEN 0 ELSE 1 END LIMIT 1',
      [email, legacyAuthEmail(email)]
    );
    if (result.rows.length > 0) {
      const staff = result.rows[0];
      if (!staff.password) {
        res.status(401).json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        return;
      }
      const isValid = await bcrypt.compare(password, staff.password);
      if (!isValid) {
        res.status(401).json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
        return;
      }
      const token = generateToken({ id: staff.staff_id, email: staff.email, role: staff.role });
      const { password: _, ...userSafe } = staff;

      let redirectUrl = '/dashboard';
      if (staff.role === 'admin') redirectUrl = '/admin';
      else if (staff.role === 'room_staff') redirectUrl = '/staff/rooms/dashboard';
      else if (staff.role === 'boat_staff') redirectUrl = '/staff/boats/dashboard';

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: staff.staff_id,
            first_name: staff.first_name || '',
            last_name: staff.last_name || '',
            name: buildDisplayName(staff.first_name, staff.last_name),
            email: staff.email,
            role: staff.role,
            phone: staff.phone,
          },
          token,
          redirectUrl,
        },
      });
      return;
    }

    result = await pool.query(
      'SELECT * FROM members WHERE (LOWER(email) = LOWER($1) OR LOWER(email) = LOWER($2)) ORDER BY CASE WHEN LOWER(email) = LOWER($1) THEN 0 ELSE 1 END LIMIT 1',
      [email, legacyAuthEmail(email)]
    );
    if (result.rows.length === 0) {
      res.status(401).json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }

    const member = result.rows[0];
    if (!member.password) {
      res.status(401).json({ success: false, message: 'Please login with Google' });
      return;
    }

    const isValid = await bcrypt.compare(password, member.password);
    if (!isValid) {
      res.status(401).json({ success: false, message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
      return;
    }

    if (member.is_active === false) {
      res.status(401).json({ success: false, message: 'บัญชีนี้ถูกปิดการใช้งาน กรุณาติดต่อเจ้าหน้าที่' });
      return;
    }

    const token = generateToken({ id: member.member_id, email: member.email, role: 'customer' });
    const { password: _, ...userSafe } = member;

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: member.member_id,
          first_name: member.first_name || '',
          last_name: member.last_name || '',
          name: buildDisplayName(member.first_name, member.last_name),
          email: member.email,
          role: 'customer',
          phone: member.phone,
          line_id: member.line_id,
          facebook: member.facebook,
          avatar: member.avatar_url,
          has_password: member.password != null,
          auth_provider: member.auth_provider || 'email',
        },
        token,
        redirectUrl: '/',
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// รับผลลัพธ์จาก Google OAuth แล้วสร้าง JWT token เพื่อส่งกลับไปยังหน้า frontend
export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as any;
    if (!user) {
      res.redirect(`${process.env.FRONTEND_URL}/auth/login?error=google_failed`);
      return;
    }

    const token = generateToken({ id: user.member_id, email: user.email, role: 'customer' });
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/auth/login?error=server_error`);
  }
};

// สร้างบัญชีผู้ดูแลระบบคนแรกเมื่อยังไม่มีผู้ดูแลระบบอยู่ในฐานข้อมูล
export const initAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminCheck = await pool.query("SELECT staff_id FROM staff WHERE role = 'admin' LIMIT 1");
    if (adminCheck.rows.length > 0) {
      res.status(403).json({
        success: false,
        message: 'Admin already exists. Please login and use /api/auth/staff with JWT to create more admins.',
      });
      return;
    }

    const { name, email, password, phone, address, subdistrict, district, province, postal_code } = req.body;
    let first_name = name;
    let last_name = '';
    if (name && name.includes(' ')) {
      first_name = String(name).trim().split(' ')[0] || '';
      last_name = String(name).trim().split(' ').slice(1).join(' ');
    }

    const existing = await pool.query(
      'SELECT staff_id FROM staff WHERE (LOWER(email) = LOWER($1) OR LOWER(email) = LOWER($2))',
      [email, legacyAuthEmail(email)]
    );
    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'อีเมลนี้ถูกใช้สมัครแล้ว' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO staff (first_name, last_name, email, password, phone, role, status, address, subdistrict, district, province, postal_code)
       VALUES ($1, $2, $3, $4, $5, 'admin', true, $6, $7, $8, $9, $10) RETURNING staff_id, first_name, last_name, email, phone, role, created_at`,
      [first_name, last_name, email, password_hash, phone, address, subdistrict, district, province, postal_code]
    );

    res.status(201).json({ success: true, message: 'Initial Admin created successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Init admin error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// สร้างบัญชีพนักงานใหม่โดยผู้ดูแลระบบพร้อมกำหนดบทบาทและเข้ารหัสรหัสผ่าน
export const createStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    if (authUser.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
      return;
    }

    const { name, email, password, phone, role, address, subdistrict, district, province, postal_code } = req.body;
    let first_name = name;
    let last_name = '';
    if (name && name.includes(' ')) {
      first_name = String(name).trim().split(' ')[0] || '';
      last_name = String(name).trim().split(' ').slice(1).join(' ');
    }

    const existing = await pool.query(
      'SELECT staff_id FROM staff WHERE (LOWER(email) = LOWER($1) OR LOWER(email) = LOWER($2))',
      [email, legacyAuthEmail(email)]
    );
    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'อีเมลนี้ถูกใช้สมัครแล้ว' });
      return;
    }

    const rawPassword = password === undefined || password === null || password === '' ? phone : password;
    const passwordError = getNewPasswordError(rawPassword);
    if (passwordError) {
      res.status(400).json({ success: false, message: passwordError });
      return;
    }

    const password_hash = await bcrypt.hash(rawPassword, 12);
    const result = await pool.query(
      `INSERT INTO staff (first_name, last_name, email, password, phone, role, status, address, subdistrict, district, province, postal_code)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10, $11) RETURNING staff_id, first_name, last_name, email, phone, role, created_at`,
      [first_name, last_name, email, password_hash, phone, role, address, subdistrict, district, province, postal_code]
    );

    res.status(201).json({ success: true, message: 'Staff created successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Create staff error:', error);
    const createError = mapDbError(error);
    if (createError) {
      res.status(createError.status).json({ success: false, message: createError.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรายชื่อพนักงานทั้งหมดสำหรับหน้าจัดการของผู้ดูแลระบบ
export const getAllStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    if (authUser.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
      return;
    }

    const result = await pool.query(
      `SELECT staff_id as id, first_name, last_name, email, phone, role, status, 
              address, subdistrict, district, province, postal_code, created_at 
       FROM staff ORDER BY created_at DESC`
    );

    const staff = result.rows.map((s) => ({
      ...s,
      name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
    }));

    res.json({ success: true, data: staff });
  } catch (error) {
    console.error('Get all staff error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงข้อมูลพนักงานรายบุคคลตามรหัสสำหรับผู้ดูแลระบบ
export const getStaffById = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    if (authUser.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
      return;
    }

    const { id } = req.params;
    const result = await pool.query(
      `SELECT staff_id as id, first_name, last_name, email, phone, role, status, 
              address, subdistrict, district, province, postal_code, created_at 
       FROM staff WHERE staff_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Staff not found' });
      return;
    }

    const s = result.rows[0];
    const staff = {
      ...s,
      name: `${s.first_name || ''} ${s.last_name || ''}`.trim(),
    };

    res.json({ success: true, data: staff });
  } catch (error) {
    console.error('Get staff by ID error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// เปิดหรือปิดสถานะการใช้งานบัญชีพนักงานโดยผู้ดูแลระบบ
export const toggleStaffStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    if (authUser.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
      return;
    }

    const { id } = req.params;
    const { status } = req.body;
    if (typeof status !== 'boolean') {
      res.status(400).json({ success: false, message: 'status must be boolean' });
      return;
    }

    if (Number(id) === authUser.id) {
      res.status(400).json({ success: false, message: 'Cannot change your own status' });
      return;
    }

    const result = await pool.query(`UPDATE staff SET status = $1 WHERE staff_id = $2 RETURNING staff_id, status`, [
      status,
      id,
    ]);

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Staff not found' });
      return;
    }

    res.json({ success: true, message: `Staff status updated successfully`, data: result.rows[0] });
  } catch (error) {
    console.error('Toggle staff status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// อัปเดตข้อมูลและบทบาทของพนักงานโดยผู้ดูแลระบบ
export const updateStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    if (authUser.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
      return;
    }
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;
    const STAFF_ROLES = ['admin', 'room_staff', 'boat_staff'];

    const currentRes = await pool.query('SELECT * FROM staff WHERE staff_id = $1', [id]);
    if (currentRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Staff not found' });
      return;
    }
    const current = currentRes.rows[0] as Record<string, unknown>;

    const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(body, key);
    const textOrCurrent = (key: string): string | null => {
      if (!has(key)) return current[key] == null ? null : String(current[key]);
      const raw = body[key];
      return raw === null || raw === undefined || raw === '' ? null : String(raw);
    };

    const role = has('role') ? String(body.role) : String(current.role);
    if (!STAFF_ROLES.includes(role)) {
      res.status(400).json({ success: false, message: 'Invalid staff role' });
      return;
    }
    if (Number(id) === Number(authUser.id) && role !== 'admin') {
      res.status(400).json({ success: false, message: 'ไม่สามารถลดสิทธิ์ของตัวเองได้' });
      return;
    }

    let firstName = String(current.first_name ?? '');
    let lastName = String(current.last_name ?? '');
    if (has('name')) {
      const nameParts = String(body.name ?? '').trim().split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }
    const email = has('email') && body.email ? String(body.email) : String(current.email);

    const result = await pool.query(
      `UPDATE staff SET first_name=$1, last_name=$2, email=$3, phone=$4, role=$5,
       address=$6, subdistrict=$7, district=$8, province=$9, postal_code=$10
       WHERE staff_id=$11 RETURNING staff_id, first_name, last_name, email, phone, role, address, subdistrict, district, province, postal_code`,
      [
        firstName,
        lastName,
        email,
        textOrCurrent('phone'),
        role,
        textOrCurrent('address'),
        textOrCurrent('subdistrict'),
        textOrCurrent('district'),
        textOrCurrent('province'),
        textOrCurrent('postal_code'),
        id,
      ]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Staff not found' });
      return;
    }
    res.json({ success: true, message: 'Staff updated', data: result.rows[0] });
  } catch (error) {
    console.error('Update staff error:', error);
    const updateError = mapDbError(error);
    if (updateError) {
      res.status(updateError.status).json({ success: false, message: updateError.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ลบบัญชีพนักงานออกจากระบบโดยผู้ดูแลระบบ
export const deleteStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    if (authUser.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
      return;
    }

    const { id } = req.params;

    if (Number(id) === authUser.id) {
      res.status(400).json({ success: false, message: 'Cannot delete yourself' });
      return;
    }

    const result = await pool.query('DELETE FROM staff WHERE staff_id = $1 RETURNING staff_id', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Staff not found' });
      return;
    }

    res.json({ success: true, message: 'Staff deleted successfully' });
  } catch (error) {
    console.error('Delete staff error:', error);
    if ((error as any).code === '23503') {
      res.status(400).json({
        success: false,
        message: 'Cannot delete this staff because they have linked records. Please disable their account instead.',
      });
    } else {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
};

// ดึงข้อมูลโปรไฟล์ของผู้ใช้ที่เข้าสู่ระบบอยู่ตามบทบาท
export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    if (authUser.role === 'customer') {
      const result = await pool.query(
        'SELECT member_id as id, first_name, last_name, email, phone, line_id, facebook, image_profile, avatar_url, auth_provider, created_at, CASE WHEN password IS NOT NULL THEN true ELSE false END as has_password FROM members WHERE member_id = $1',
        [authUser.id]
      );

      const data = result.rows[0];
      const name = buildDisplayName(data.first_name, data.last_name);

      res.json({
        success: true,
        data: {
          id: data.id,
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          name: name,
          email: data.email,
          phone: data.phone,
          line_id: data.line_id,
          facebook: data.facebook,
          avatar: data.image_profile || data.avatar_url,
          role: 'customer',
          auth_provider: data.auth_provider,
          has_password: data.has_password,
          created_at: data.created_at,
        },
      });
    } else {
      const result = await pool.query(
        'SELECT staff_id as id, first_name, last_name, email, phone, role, address, line_id, facebook FROM staff WHERE staff_id = $1',
        [authUser.id]
      );

      const data = result.rows[0];
      const name = buildDisplayName(data.first_name, data.last_name);

      res.json({
        success: true,
        data: {
          ...data,
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          name: name,
          has_password: true,
        },
      });
    }
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// อัปเดตข้อมูลโปรไฟล์ของผู้ใช้ที่เข้าสู่ระบบอยู่พร้อมตรวจสอบเบอร์โทรและอีเมลซ้ำ
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  let client: PoolClient | undefined;
  let transactionOpen = false;
  try {
    const authUser = req.user as AuthPayload;
    const { first_name, last_name, phone, line_id, facebook } = req.body;

    if (!first_name || !first_name.trim()) {
      res.status(400).json({ success: false, message: 'กรุณากรอกชื่อ' });
      return;
    }

    if (authUser.role !== 'admin' && (!last_name || !last_name.trim())) {
      res.status(400).json({ success: false, message: 'กรุณากรอกนามสกุล' });
      return;
    }

    const trimmedFirstName = first_name.trim();
    const trimmedLastName = last_name ? last_name.trim() : '';

    if (typeof phone === 'string' && phone.trim()) {
      client = await pool.connect();
      await client.query('BEGIN');
      transactionOpen = true;
      await client.query('SELECT pg_advisory_xact_lock(20261019, 1)');
      const duplicate = await client.query(
        `SELECT 1 FROM members
         WHERE regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace($1::text, '[^0-9]', '', 'g')
           AND NOT ($2::text = 'customer' AND member_id = $3)
         UNION ALL
         SELECT 1 FROM staff
         WHERE regexp_replace(phone, '[^0-9]', '', 'g') = regexp_replace($1::text, '[^0-9]', '', 'g')
           AND NOT ($2::text <> 'customer' AND staff_id = $3)
         LIMIT 1`,
        [phone, authUser.role, authUser.id]
      );
      if (duplicate.rows.length) {
        res.status(409).json({ success: false, message: 'เบอร์โทรศัพท์นี้ถูกใช้งานแล้ว กรุณาใช้เบอร์อื่น' });
        return;
      }
    }
    const db = client ?? pool;

    if (authUser.role === 'customer') {
      await db.query(
        'UPDATE members SET first_name = $1, last_name = $2, phone = $3, line_id = $4, facebook = $5 WHERE member_id = $6',
        [trimmedFirstName, trimmedLastName, phone || null, line_id || null, facebook || null, authUser.id]
      );
    } else {
      const current = await db.query('SELECT email, password FROM staff WHERE staff_id = $1', [authUser.id]);
      if (!current.rows[0]) {
        res.status(404).json({ success: false, message: 'ไม่พบบัญชีพนักงาน' });
        return;
      }
      const email = req.body.email === undefined ? current.rows[0].email : normalizeAuthEmail(req.body.email);
      const emailChanged = email !== normalizeAuthEmail(current.rows[0].email);
      if (emailChanged) {
        if (
          typeof req.body.current_password !== 'string' ||
          !(await bcrypt.compare(req.body.current_password, current.rows[0].password))
        ) {
          res.status(400).json({ success: false, message: 'กรุณายืนยันรหัสผ่านปัจจุบันเพื่อเปลี่ยนอีเมล' });
          return;
        }
        const duplicate = await db.query(
          `SELECT 1 FROM staff WHERE staff_id <> $1 AND (LOWER(email) = $2 OR LOWER(email) = $3)
           UNION ALL SELECT 1 FROM members WHERE LOWER(email) = $2 OR LOWER(email) = $3 LIMIT 1`,
          [authUser.id, email, legacyAuthEmail(email)]
        );
        if (duplicate.rows.length) {
          res.status(409).json({ success: false, message: 'อีเมลนี้ถูกใช้งานแล้ว' });
          return;
        }
      }
      const saved = await db.query(
        `UPDATE staff SET first_name = $1, last_name = $2, phone = $3, email = $4,
          address = CASE WHEN $5::boolean THEN $6 ELSE address END,
          line_id = CASE WHEN $7::boolean THEN $8 ELSE line_id END,
          facebook = CASE WHEN $9::boolean THEN $10 ELSE facebook END,
          reset_token = CASE WHEN $11::boolean THEN NULL ELSE reset_token END,
          reset_token_expires_at = CASE WHEN $11::boolean THEN NULL ELSE reset_token_expires_at END
         WHERE staff_id = $12 AND email = $13 AND password = $14 AND status = true
         RETURNING first_name, last_name, phone, email, address, line_id, facebook`,
        [
          trimmedFirstName,
          trimmedLastName,
          phone || null,
          email,
          req.body.address !== undefined,
          req.body.address || null,
          line_id !== undefined,
          line_id || null,
          facebook !== undefined,
          facebook || null,
          emailChanged,
          authUser.id,
          current.rows[0].email,
          current.rows[0].password,
        ]
      );
      if (!saved.rows.length) {
        res.status(409).json({
          success: false,
          message: 'ข้อมูลบัญชีเปลี่ยนแปลงแล้ว กรุณาโหลดหน้าใหม่และลองอีกครั้ง',
        });
        return;
      }
      if (client) {
        await client.query('COMMIT');
        transactionOpen = false;
      }
      res.json({ success: true, message: 'บันทึกข้อมูลสำเร็จ', data: saved.rows[0] });
      return;
    }

    if (client) {
      await client.query('COMMIT');
      transactionOpen = false;
    }
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        first_name: trimmedFirstName,
        last_name: trimmedLastName,
        name: buildDisplayName(trimmedFirstName, trimmedLastName),
        phone: phone || '',
        line_id: line_id || '',
        facebook: facebook || '',
      },
    });
  } catch (error) {
    console.error('Update profile error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    if (client) {
      try {
        if (transactionOpen) await safeRollback(client);
      } finally {
        client.release();
      }
    }
  }
};

// อัปโหลดรูปโปรไฟล์ของสมาชิกไปยัง Cloudinary และลบรูปเดิมเมื่ออัปเดตสำเร็จ
export const uploadProfileAvatar = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    const file = req.file;

    if (authUser.role !== 'customer') {
      res.status(403).json({ success: false, message: 'Only members can update profile images' });
      return;
    }

    if (!file) {
      res.status(400).json({ success: false, message: 'No image file provided' });
      return;
    }

    const memberResult = await pool.query('SELECT image_profile FROM members WHERE member_id = $1 LIMIT 1', [
      authUser.id,
    ]);
    if (memberResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Member not found' });
      return;
    }

    const previousAvatar = memberResult.rows[0].image_profile as string | null;
    let uploadedAvatar: CloudinaryUploadResult;
    try {
      uploadedAvatar = await uploadImage(file.buffer, {
        folder: 'walai-booking/avatars',
        publicId: `member-${authUser.id}`,
      });
    } catch (error) {
      console.error('Profile avatar Cloudinary upload error:', error);
      res.status(503).json({
        error: 'Profile image upload is temporarily unavailable',
        code: 'UPLOAD_FAILED',
      });
      return;
    }

    let result: QueryResult<AvatarUpdateRow>;
    try {
      result = await pool.query(
        'UPDATE members SET image_profile = $1 WHERE member_id = $2 RETURNING member_id as id, image_profile as avatar',
        [uploadedAvatar.url, authUser.id]
      );
    } catch (error) {
      await deleteCloudinaryImage(uploadedAvatar.url).catch((cleanupError: unknown) => {
        console.error('Profile avatar cleanup error:', cleanupError);
      });
      throw error;
    }

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Member not found' });
      return;
    }

    const previousPublicId = previousAvatar ? extractCloudinaryPublicId(previousAvatar) : null;
    if (previousPublicId && previousPublicId !== uploadedAvatar.publicId) {
      deleteCloudinaryImage(previousAvatar).catch((cleanupError: unknown) => {
        console.error('Previous profile avatar cleanup error:', cleanupError);
      });
    }

    res.json({
      success: true,
      message: 'Profile image updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Upload profile avatar error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ตั้งรหัสผ่านครั้งแรกสำหรับสมาชิกที่สมัครผ่าน Google และยังไม่มีรหัสผ่าน
export const setPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      return;
    }

    if (authUser.role === 'customer') {
      const result = await pool.query('SELECT password FROM members WHERE member_id = $1', [authUser.id]);
      if (result.rows.length === 0) {
        res.status(404).json({ success: false, message: 'Member not found' });
        return;
      }
      if (result.rows[0]?.password) {
        res.status(400).json({ success: false, message: 'Password is already set. Please use change password.' });
        return;
      }

      const password_hash = await bcrypt.hash(new_password, 12);
      const updated = await pool.query(
        'UPDATE members SET password = $1, password_changed_at = NOW() WHERE member_id = $2 AND password IS NULL',
        [password_hash, authUser.id]
      );
      if (updated.rowCount === 0) {
        res.status(409).json({ success: false, message: 'Password is already set. Please use change password.' });
        return;
      }
    } else {
      res.status(400).json({ success: false, message: 'Staff already have passwords.' });
      return;
    }

    res.json({ success: true, message: 'Password set successfully' });
  } catch (error) {
    console.error('Set password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// เปลี่ยนรหัสผ่านของผู้ใช้หลังตรวจสอบรหัสผ่านปัจจุบันถูกต้อง
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    const { current_password, new_password } = req.body;

    let user: { password: string | null } | undefined;
    if (authUser.role === 'customer') {
      const result = await pool.query('SELECT password FROM members WHERE member_id = $1', [authUser.id]);
      user = result.rows[0];
    } else {
      const result = await pool.query('SELECT password FROM staff WHERE staff_id = $1', [authUser.id]);
      user = result.rows[0];
    }

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    if (!user.password) {
      res.status(400).json({ success: false, message: 'บัญชีนี้ยังไม่มีรหัสผ่าน กรุณาตั้งรหัสผ่านก่อน' });
      return;
    }

    const isValid = typeof current_password === 'string' && (await bcrypt.compare(current_password, user.password));
    if (!isValid) {
      res.status(400).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    const new_password_hash = await bcrypt.hash(new_password, 12);
    if (authUser.role === 'customer') {
      await pool.query('UPDATE members SET password = $1, password_changed_at = NOW() WHERE member_id = $2', [
        new_password_hash,
        authUser.id,
      ]);
    } else {
      await pool.query('UPDATE staff SET password = $1, password_changed_at = NOW() WHERE staff_id = $2', [
        new_password_hash,
        authUser.id,
      ]);
    }

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ลบบัญชีลูกค้าแบบ Soft Delete และทำข้อมูลส่วนบุคคลให้เป็นนิรนามตาม PDPA
export const deleteAccount = async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const authUser = req.user as AuthPayload;
    if (authUser.role !== 'customer') {
      res.status(403).json({ success: false, message: 'เฉพาะบัญชีลูกค้าเท่านั้นที่สามารถดำเนินการนี้ได้' });
      return;
    }

    const { password } = req.body;

    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT member_id, password, auth_provider, image_profile, email FROM members WHERE member_id = $1 FOR UPDATE',
      [authUser.id]
    );

    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'ไม่พบบัญชีผู้ใช้' });
      return;
    }

    const member = userRes.rows[0];

    if (member.password) {
      if (!password || typeof password !== 'string') {
        await client.query('ROLLBACK');
        res.status(400).json({ success: false, message: 'กรุณากรอกรหัสผ่านเพื่อยืนยันการลบบัญชี' });
        return;
      }
      const isValid = await bcrypt.compare(password, member.password);
      if (!isValid) {
        await client.query('ROLLBACK');
        res.status(400).json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' });
        return;
      }
    }

    const activeRoomBookings = await client.query(
      `SELECT room_booking_id FROM room_bookings
       WHERE member_id = $1 AND status IN ('pending', 'paid', 'approved')
       LIMIT 1`,
      [authUser.id]
    );

    if (activeRoomBookings.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(400).json({
        success: false,
        message: 'ไม่สามารถลบบัญชีได้เนื่องจากคุณมีรายการจองห้องพักที่รอดำเนินการหรือยังไม่ได้เช็คเอาท์',
      });
      return;
    }

    const activeBoatBookings = await client.query(
      `SELECT boat_booking_id FROM boat_bookings
       WHERE member_id = $1 AND status IN ('pending', 'paid', 'approved')
       LIMIT 1`,
      [authUser.id]
    );

    if (activeBoatBookings.rows.length > 0) {
      await client.query('ROLLBACK');
      res.status(400).json({
        success: false,
        message: 'ไม่สามารถลบบัญชีได้เนื่องจากคุณมีรายการจองกิจกรรมเรือที่รอดำเนินการหรือยังไม่ได้เสร็จสิ้น',
      });
      return;
    }

    await client.query(
      `DELETE FROM member_promotions mp
       WHERE mp.member_id = $1 AND mp.status = 'saved'
         AND NOT EXISTS (
           SELECT 1 FROM booking_promotions bp
           WHERE bp.member_promotion_id = mp.member_promotion_id
         )`,
      [authUser.id]
    );

    const anonymousEmail = `deleted_${authUser.id}_${Date.now()}@privacy.local`;
    await client.query(
      `UPDATE members
       SET first_name = 'ผู้ใช้งาน',
           last_name = 'ที่ถูกลบ',
           email = $1,
           phone = NULL,
           line_id = NULL,
           facebook = NULL,
           image_profile = NULL,
           avatar_url = NULL,
           google_id = NULL,
           password = NULL,
           password_changed_at = NOW(),
           is_active = false,
           deleted_at = NOW(),
           updated_at = NOW()
       WHERE member_id = $2`,
      [anonymousEmail, authUser.id]
    );

    await client.query('COMMIT');

    if (member.image_profile) {
      const publicId = extractCloudinaryPublicId(member.image_profile);
      if (publicId) {
        deleteCloudinaryImage(publicId).catch((err) =>
          console.error('Failed to delete avatar from Cloudinary on account deletion:', err)
        );
      }
    }

    res.json({
      success: true,
      message: 'บัญชีของคุณถูกลบและทำให้นิรนามเรียบร้อยแล้ว ขอบคุณที่เคยใช้บริการ',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete account error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดในการลบบัญชี' });
  } finally {
    client.release();
  }
};

// ดึงรายชื่อสมาชิกทั้งหมดพร้อมตัวกรองคำค้นหาและสถานะ
export const getAllMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, status } = req.query;
    let query = `SELECT member_id as id, first_name, last_name, email, phone, is_active, created_at,
                        (SELECT COUNT(*) FROM room_bookings WHERE member_id = members.member_id) as room_booking_count,
                        (SELECT COUNT(*) FROM boat_bookings WHERE member_id = members.member_id) as boat_booking_count
                 FROM members WHERE 1=1`;
    const params: any[] = [];
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (first_name ILIKE $${params.length} OR last_name ILIKE $${params.length} OR email ILIKE $${params.length})`;
    }
    if (status === 'active') {
      query += ` AND is_active = true`;
    } else if (status === 'inactive') {
      query += ` AND is_active = false`;
    }
    query += ` ORDER BY created_at DESC`;
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get all members error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// เปิดหรือปิดสถานะการใช้งานบัญชีสมาชิกตามรหัส
export const toggleMemberStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      res.status(400).json({ success: false, message: 'is_active must be boolean' });
      return;
    }
    const result = await pool.query(
      `UPDATE members SET is_active = $1 WHERE member_id = $2 RETURNING member_id, is_active`,
      [is_active, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Member not found' });
      return;
    }
    res.json({ success: true, message: 'Member status updated', data: result.rows[0] });
  } catch (error) {
    console.error('Toggle member status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// สร้างรหัส OTP สำหรับรีเซ็ตรหัสผ่านและส่งไปยังอีเมลของผู้ใช้
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const accountType = req.body.account_type ?? 'customer';
    if (accountType !== 'customer' && accountType !== 'staff') {
      res.status(400).json({ success: false, message: 'ประเภทบัญชีไม่ถูกต้อง' });
      return;
    }
    const table = accountType === 'staff' ? 'staff' : 'members';
    const idColumn = accountType === 'staff' ? 'staff_id' : 'member_id';
    const activeFilter = accountType === 'staff' ? ' AND status = true' : '';

    const genericForgotPasswordMessage = 'หากอีเมลนี้มีอยู่ในระบบ เราได้ส่ง OTP สำหรับรีเซ็ตรหัสผ่านให้แล้ว';
    const email = normalizeAuthEmail(String(req.body.email || ''));

    if (!email) {
      res.status(400).json({ success: false, message: 'กรุณากรอกอีเมล' });
      return;
    }

    const memberResult = await pool.query(
      `SELECT ${idColumn} as id, first_name, last_name, email FROM ${table} WHERE (LOWER(email) = $1 OR LOWER(email) = $2)${activeFilter} ORDER BY CASE WHEN LOWER(email) = $1 THEN 0 ELSE 1 END LIMIT 1`,
      [email, legacyAuthEmail(email)]
    );

    if (memberResult.rows.length === 0) {
      res.json({ success: true, message: genericForgotPasswordMessage, data: null });
      return;
    }

    const member = memberResult.rows[0];
    const { otpCode, hashedOtp, expiresAt } = createPasswordResetOtp();

    await pool.query(
      `UPDATE ${table}
       SET reset_token = $1, reset_token_expires_at = $2, reset_attempts = CASE WHEN reset_token_expires_at IS NULL OR reset_token_expires_at < NOW() THEN 0 ELSE reset_attempts END 
       WHERE ${idColumn} = $3${activeFilter}`,
      [hashedOtp, expiresAt, member.id]
    );

    try {
      await sendPasswordResetEmail({
        to: member.email,
        recipientName: buildDisplayName(member.first_name, member.last_name),
        otpCode,
      });
    } catch (mailError) {
      console.error('Forgot password mail error:', mailError);
    }

    res.json({
      success: true,
      message: genericForgotPasswordMessage,
      data: null,
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่' });
  }
};

// ตรวจสอบรหัส OTP และตั้งรหัสผ่านใหม่ให้กับบัญชีผู้ใช้
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const accountType = req.body.account_type ?? 'customer';
    if (accountType !== 'customer' && accountType !== 'staff') {
      res.status(400).json({ success: false, message: 'ประเภทบัญชีไม่ถูกต้อง' });
      return;
    }
    const table = accountType === 'staff' ? 'staff' : 'members';
    const idColumn = accountType === 'staff' ? 'staff_id' : 'member_id';
    const activeFilter = accountType === 'staff' ? ' AND status = true' : '';

    const email = normalizeAuthEmail(String(req.body.email || ''));
    const otp = String(req.body.otp || '').trim();
    const newPassword = String(req.body.new_password || '');

    if (!email || !otp || !newPassword) {
      res.status(400).json({ success: false, message: 'Email, OTP, and new password are required' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
      return;
    }

    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    const MAX_OTP_ATTEMPTS = 5;
    const pending = await pool.query(
      `SELECT ${idColumn} as member_id, reset_token
       FROM ${table}
       WHERE (LOWER(email) = $1 OR (LOWER(email) = $3 AND NOT EXISTS (SELECT 1 FROM ${table} exact WHERE LOWER(exact.email) = $1))) ${activeFilter} AND reset_token IS NOT NULL AND reset_token_expires_at > NOW() AND reset_attempts < $2
       ORDER BY CASE WHEN LOWER(email) = $1 THEN 0 ELSE 1 END LIMIT 1`,
      [email, MAX_OTP_ATTEMPTS, legacyAuthEmail(email)]
    );
    const pendingRow = pending.rows[0] as { member_id: number; reset_token: string } | undefined;
    if (!pendingRow) {
      res.status(400).json({ success: false, message: 'OTP is invalid or expired' });
      return;
    }
    if (pendingRow.reset_token !== hashedOtp) {
      await pool.query(
        `UPDATE ${table}
         SET reset_attempts = reset_attempts + 1,
             reset_token = CASE WHEN reset_attempts + 1 >= $2::int THEN NULL ELSE reset_token END,
             reset_token_expires_at = CASE WHEN reset_attempts + 1 >= $2::int THEN NULL ELSE reset_token_expires_at END
         WHERE ${idColumn} = $1 AND reset_token = $3${activeFilter}`,
        [pendingRow.member_id, MAX_OTP_ATTEMPTS, pendingRow.reset_token]
      );
      res.status(400).json({ success: false, message: 'OTP is invalid or expired' });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const consumed = await pool.query(
      `UPDATE ${table}
       SET password = $1, reset_token = NULL, reset_token_expires_at = NULL, reset_attempts = 0, password_changed_at = NOW()
       WHERE ${idColumn} = $2${activeFilter} AND reset_token = $3 AND reset_token_expires_at > NOW() AND reset_attempts < $4`,
      [passwordHash, pendingRow.member_id, hashedOtp, MAX_OTP_ATTEMPTS]
    );
    if ((consumed.rowCount ?? 0) === 0) {
      res.status(400).json({ success: false, message: 'OTP is invalid or expired' });
      return;
    }

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
