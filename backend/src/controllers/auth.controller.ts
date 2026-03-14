import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { sendPasswordResetEmail } from '../services/mail.service';
import { AuthPayload } from '../types';

// สร้าง JWT token สำหรับใช้ยืนยันตัวตนหลังจาก login หรือ register สำเร็จ โดยเก็บ id, email และ role ของผู้ใช้ไว้ใน token
const generateToken = (payload: AuthPayload): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET environment variable is not set');
  return jwt.sign(payload, secret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
};

const buildDisplayName = (firstName?: string | null, lastName?: string | null): string => {
  return `${firstName || ''} ${lastName || ''}`.trim();
};

const createPasswordResetOtp = () => {
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const hashedOtp = crypto.createHash('sha256').update(otpCode).digest('hex');
  const expiresInMinutes = Number(process.env.PASSWORD_RESET_EXPIRES_MINUTES || '10');
  const expiresAt = new Date(Date.now() + 1000 * 60 * expiresInMinutes);

  return { otpCode, hashedOtp, expiresAt };
};

// สมัครสมาชิกใหม่ด้วย email/password พร้อม hash รหัสผ่านก่อนบันทึกลงฐานข้อมูล และส่ง token กลับไปให้ frontend ใช้งานต่อทันที
export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { first_name, last_name, email, password, phone, line_id, facebook } = req.body;

    const existing = await pool.query('SELECT member_id FROM members WHERE LOWER(email) = LOWER($1)', [email]);
    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Email already registered' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO members (first_name, last_name, email, password, phone, line_id, facebook, auth_provider)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'email')
       RETURNING member_id, first_name, last_name, email, phone, line_id, facebook`,
      [first_name, last_name, email, password_hash, phone || null, line_id || null, facebook || null]
    );

    const token = generateToken({ id: result.rows[0].member_id, email, role: 'customer' });
    const { password: _, ...userSafe } = result.rows[0];

    res.status(201).json({ success: true, message: 'Registration successful', data: { user: userSafe, token } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// เข้าสู่ระบบโดยตรวจสอบ staff ก่อน แล้วจึงตรวจ member เพื่อรองรับหลาย role และกำหนด redirect ปลายทางให้ตรงกับสิทธิ์ของผู้ใช้
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Check staff first
    let result = await pool.query('SELECT * FROM staff WHERE email = $1 AND status = true', [email]);
    if (result.rows.length > 0) {
      const staff = result.rows[0];
      const isValid = await bcrypt.compare(password, staff.password);
      if (!isValid) {
        res.status(401).json({ success: false, message: 'Invalid email or password' });
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
            phone: staff.phone
          }, 
          token,
          redirectUrl
        },
      });
      return;
    }

    // Check members
    result = await pool.query('SELECT * FROM members WHERE LOWER(email) = LOWER($1)', [email]);
    if (result.rows.length === 0) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
      return;
    }

    const member = result.rows[0];
    if (!member.password) {
      res.status(401).json({ success: false, message: 'Please login with Google' });
      return;
    }

    const isValid = await bcrypt.compare(password, member.password);
    if (!isValid) {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
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
          auth_provider: member.auth_provider || 'email'
        }, 
        token,
        redirectUrl: '/dashboard'
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// รับผลลัพธ์จาก Google OAuth หลัง Passport ยืนยันตัวตนสำเร็จ แล้วสร้าง JWT ของระบบเราเพื่อส่งกลับไปที่ frontend
export const googleCallback = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as any; // from passport
    if (!user) {
      res.redirect(`${process.env.FRONTEND_URL}/auth/login?error=google_failed`);
      return;
    }

    // req.user is already the member record from DB (handled in passport.ts)
    const token = generateToken({ id: user.member_id, email: user.email, role: 'customer' });
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  } catch (error) {
    console.error('Google callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL}/auth/login?error=server_error`);
  }
};

// ใช้สร้าง admin คนแรกของระบบในกรณีที่ยังไม่มี admin อยู่เลย เพื่อปิดช่องให้สร้าง admin ซ้ำโดยไม่จำเป็น
export const initAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    // Check if an admin already exists to prevent unauthorized creation later
    const adminCheck = await pool.query("SELECT staff_id FROM staff WHERE role = 'admin' LIMIT 1");
    if (adminCheck.rows.length > 0) {
      res.status(403).json({ 
        success: false, 
        message: 'Admin already exists. Please login and use /api/auth/staff with JWT to create more admins.' 
      });
      return;
    }

    const { name, email, password, phone, address, subdistrict, district, province, postal_code } = req.body;
    let first_name = name;
    let last_name = '';
    if (name && name.includes(' ')) {
      [first_name, last_name] = name.split(' ', 2);
    }

    const existing = await pool.query('SELECT staff_id FROM staff WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Email already registered' });
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

// ให้ admin สร้างบัญชี staff ใหม่ในระบบ โดยกำหนด role ได้ เช่น room_staff หรือ boat_staff และ hash password ก่อนบันทึก
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
      [first_name, last_name] = name.split(' ', 2);
    }

    const existing = await pool.query('SELECT staff_id FROM staff WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Email already registered' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO staff (first_name, last_name, email, password, phone, role, status, address, subdistrict, district, province, postal_code)
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, $9, $10, $11) RETURNING staff_id, first_name, last_name, email, phone, role, created_at`,
      [first_name, last_name, email, password_hash, phone, role, address, subdistrict, district, province, postal_code]
    );

    res.status(201).json({ success: true, message: 'Staff created successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรายการ staff ทั้งหมดสำหรับหน้า admin เพื่อใช้แสดงข้อมูลบัญชีพนักงานและสถานะการเปิดใช้งาน
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
    
    const staff = result.rows.map(s => ({
      ...s,
      name: `${s.first_name || ''} ${s.last_name || ''}`.trim()
    }));

    res.json({ success: true, data: staff });
  } catch (error) {
    console.error('Get all staff error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงข้อมูล staff รายคนตาม id เพื่อใช้แสดงรายละเอียดหรือเตรียมข้อมูลสำหรับแก้ไขในฝั่ง admin
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
      name: `${s.first_name || ''} ${s.last_name || ''}`.trim()
    };

    res.json({ success: true, data: staff });
  } catch (error) {
    console.error('Get staff by ID error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// เปิดหรือปิดการใช้งานบัญชี staff โดย admin และป้องกันไม่ให้ admin ปิดบัญชีของตัวเองโดยตรง
export const toggleStaffStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    if (authUser.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
      return;
    }

    const { id } = req.params;
    const { status } = req.body; // boolean

    // Don't allow changing own status
    if (Number(id) === authUser.id) {
      res.status(400).json({ success: false, message: 'Cannot change your own status' });
      return;
    }

    const result = await pool.query(
      `UPDATE staff SET status = $1 WHERE staff_id = $2 RETURNING staff_id, status`,
      [status, id]
    );

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

// อัปเดตข้อมูล staff เช่น ชื่อ, email, phone, role
export const updateStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    if (authUser.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
      return;
    }
    const { id } = req.params;
    const { name, email, phone, role, address, subdistrict, district, province, postal_code } = req.body;

    const nameParts = String(name || '').trim().split(' ');
    const first_name = nameParts[0] || '';
    const last_name = nameParts.slice(1).join(' ') || '';

    const result = await pool.query(
      `UPDATE staff SET first_name=$1, last_name=$2, email=$3, phone=$4, role=$5,
       address=$6, subdistrict=$7, district=$8, province=$9, postal_code=$10
       WHERE staff_id=$11 RETURNING staff_id, first_name, last_name, email, phone, role, address, subdistrict, district, province, postal_code`,
      [first_name, last_name, email, phone || null, role, address || null, subdistrict || null, district || null, province || null, postal_code || null, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Staff not found' });
      return;
    }
    res.json({ success: true, message: 'Staff updated', data: result.rows[0] });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ลบบัญชี staff ออกจากระบบแบบถาวร โดยมีการป้องกันการลบตัวเองและจัดการกรณีที่มีข้อมูลอ้างอิงอยู่ในฐานข้อมูล
export const deleteStaff = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    if (authUser.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Forbidden: Admins only' });
      return;
    }

    const { id } = req.params;

    // Don't allow deleting self
    if (Number(id) === authUser.id) {
      res.status(400).json({ success: false, message: 'Cannot delete yourself' });
      return;
    }

    // Instead of hard delete, maybe just deactivate, or hard delete if really needed.
    // I'll implement hard delete based on user request "ลบพนักงานให้ด้วย", but note that 
    // if staff has linked data, this might fail due to foreign key constraints.
    const result = await pool.query('DELETE FROM staff WHERE staff_id = $1 RETURNING staff_id', [id]);

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Staff not found' });
      return;
    }

    res.json({ success: true, message: 'Staff deleted successfully' });
  } catch (error) {
    console.error('Delete staff error:', error);
    if ((error as any).code === '23503') { // foreign key violation
      res.status(400).json({ success: false, message: 'Cannot delete this staff because they have linked records. Please disable their account instead.' });
    } else {
      res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    if (authUser.role === 'customer') {
      const result = await pool.query(
        'SELECT member_id as id, first_name, last_name, email, phone, line_id, facebook, image_profile, avatar_url, auth_provider, CASE WHEN password IS NOT NULL THEN true ELSE false END as has_password FROM members WHERE member_id = $1',
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
          has_password: data.has_password
        } 
      });
    } else {
      const result = await pool.query(
        'SELECT staff_id as id, first_name, last_name, email, phone, role FROM staff WHERE staff_id = $1',
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
          has_password: true
        } 
      });
    }
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    const { first_name, last_name, phone, line_id, facebook } = req.body;

    if (authUser.role === 'customer') {
      await pool.query(
        'UPDATE members SET first_name = $1, last_name = $2, phone = $3, line_id = $4, facebook = $5 WHERE member_id = $6',
        [first_name, last_name, phone || null, line_id || null, facebook || null, authUser.id]
      );
    } else {
      await pool.query(
        'UPDATE staff SET first_name = $1, last_name = $2, phone = $3 WHERE staff_id = $4',
        [first_name, last_name, phone, authUser.id]
      );
    }

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        first_name: first_name || '',
        last_name: last_name || '',
        name: buildDisplayName(first_name, last_name),
        phone: phone || '',
        line_id: line_id || '',
        facebook: facebook || ''
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

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

    const avatarPath = `/uploads/${file.filename}`;

    const result = await pool.query(
      'UPDATE members SET image_profile = $1 WHERE member_id = $2 RETURNING member_id as id, image_profile as avatar',
      [avatarPath, authUser.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Member not found' });
      return;
    }

    res.json({
      success: true,
      message: 'Profile image updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Upload profile avatar error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ตั้งรหัสผ่านครั้งแรกสำหรับผู้ใช้ที่สมัครผ่าน Google และยังไม่มี password ในระบบ
export const setPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      return;
    }

    if (authUser.role === 'customer') {
      const result = await pool.query('SELECT password FROM members WHERE member_id = $1', [authUser.id]);
      if (result.rows[0]?.password) {
        res.status(400).json({ success: false, message: 'Password is already set. Please use change password.' });
        return;
      }

      const password_hash = await bcrypt.hash(new_password, 12);
      await pool.query('UPDATE members SET password = $1 WHERE member_id = $2', [password_hash, authUser.id]);
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

export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    const { current_password, new_password } = req.body;

    let user;
    if (authUser.role === 'customer') {
      const result = await pool.query('SELECT password FROM members WHERE member_id = $1', [authUser.id]);
      user = result.rows[0];
    } else {
      const result = await pool.query('SELECT password FROM staff WHERE staff_id = $1', [authUser.id]);
      user = result.rows[0];
    }

    const isValid = await bcrypt.compare(current_password, user.password);
    if (!isValid) {
      res.status(400).json({ success: false, message: 'Current password is incorrect' });
      return;
    }

    const new_password_hash = await bcrypt.hash(new_password, 12);
    if (authUser.role === 'customer') {
      await pool.query('UPDATE members SET password = $1 WHERE member_id = $2', [new_password_hash, authUser.id]);
    } else {
      await pool.query('UPDATE staff SET password = $1 WHERE staff_id = $2', [new_password_hash, authUser.id]);
    }

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรายชื่อสมาชิกทั้งหมด พร้อม filter ด้วย name/email และสถานะ
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
    if (status === 'active') { query += ` AND is_active = true`; }
    else if (status === 'inactive') { query += ` AND is_active = false`; }
    query += ` ORDER BY created_at DESC`;
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get all members error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// เปิด/ปิดการใช้งานบัญชีสมาชิก
export const toggleMemberStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;
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

export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const genericForgotPasswordMessage = 'If the email exists, a password reset OTP has been sent.';
    const email = String(req.body.email || '').trim().toLowerCase();

    if (!email) {
      res.status(400).json({ success: false, message: 'Email is required' });
      return;
    }

    const memberResult = await pool.query(
      'SELECT member_id as id, first_name, last_name, email FROM members WHERE LOWER(email) = $1 LIMIT 1',
      [email]
    );

    if (memberResult.rows.length === 0) {
      res.json({ success: true, message: genericForgotPasswordMessage, data: null });
      return;
    }

    const member = memberResult.rows[0];
    const { otpCode, hashedOtp, expiresAt } = createPasswordResetOtp();

    await pool.query(
      `UPDATE members 
       SET reset_token = $1, reset_token_expires_at = $2 
       WHERE member_id = $3`,
      [hashedOtp, expiresAt, member.id]
    );

    await sendPasswordResetEmail({
      to: member.email,
      recipientName: buildDisplayName(member.first_name, member.last_name),
      otpCode,
    });

    res.json({
      success: true,
      message: genericForgotPasswordMessage,
      data: {
        email: member.email,
      }
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ success: false, message });
  }
};

export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const otp = String(req.body.otp || '').trim();
    const newPassword = String(req.body.new_password || '');

    if (!email || !otp || !newPassword) {
      res.status(400).json({ success: false, message: 'Email, OTP, and new password are required' });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      return;
    }

    const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');
    const resetResult = await pool.query(
      `SELECT member_id
       FROM members
       WHERE LOWER(email) = $1 AND reset_token = $2 AND reset_token_expires_at > NOW()
       LIMIT 1`,
      [email, hashedOtp]
    );

    if (resetResult.rows.length === 0) {
      res.status(400).json({ success: false, message: 'OTP is invalid or expired' });
      return;
    }

    const memberId = resetResult.rows[0].member_id;
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await pool.query(
      `UPDATE members 
       SET password = $1, reset_token = NULL, reset_token_expires_at = NULL 
       WHERE member_id = $2`,
      [passwordHash, memberId]
    );

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ success: false, message });
  }
};
