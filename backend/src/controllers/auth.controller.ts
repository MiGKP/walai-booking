import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { AuthPayload } from '../types';

const generateToken = (payload: AuthPayload): string => {
  return jwt.sign(payload, process.env.JWT_SECRET || 'walai_super_secret_jwt_key_change_in_production', {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { first_name, last_name, email, password, phone } = req.body;

    const existing = await pool.query('SELECT member_id FROM members WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      res.status(400).json({ success: false, message: 'Email already registered' });
      return;
    }

    const password_hash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO members (first_name, last_name, email, password, phone, auth_provider)
       VALUES ($1, $2, $3, $4, $5, 'email') RETURNING member_id, first_name, last_name, email, phone`,
      [first_name, last_name, email, password_hash, phone]
    );

    const token = generateToken({ id: result.rows[0].member_id, email, role: 'customer' });
    const { password: _, ...userSafe } = result.rows[0];

    res.status(201).json({ success: true, message: 'Registration successful', data: { user: userSafe, token } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

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
      else if (staff.role === 'room_staff') redirectUrl = '/admin/rooms';
      else if (staff.role === 'boat_staff') redirectUrl = '/admin/boats';

      res.json({
        success: true,
        message: 'Login successful',
        data: { 
          user: { id: staff.staff_id, name: `${staff.first_name || ''} ${staff.last_name || ''}`.trim(), email: staff.email, role: staff.role, phone: staff.phone }, 
          token,
          redirectUrl
        },
      });
      return;
    }

    // Check members
    result = await pool.query('SELECT * FROM members WHERE email = $1', [email]);
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
        user: { id: member.member_id, name: `${member.first_name || ''} ${member.last_name || ''}`.trim(), email: member.email, role: 'customer', phone: member.phone, avatar: member.avatar_url }, 
        token,
        redirectUrl: '/dashboard'
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

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
        'SELECT member_id as id, first_name, last_name, email, phone, avatar_url as avatar, auth_provider, CASE WHEN password IS NOT NULL THEN true ELSE false END as has_password FROM members WHERE member_id = $1',
        [authUser.id]
      );
      
      const data = result.rows[0];
      const name = `${data.first_name || ''} ${data.last_name || ''}`.trim();
      
      res.json({ 
        success: true, 
        data: {
          id: data.id,
          name: name,
          email: data.email,
          phone: data.phone,
          avatar: data.avatar,
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
      const name = `${data.first_name || ''} ${data.last_name || ''}`.trim();
      
      res.json({ 
        success: true, 
        data: {
          ...data,
          name: name,
          has_password: true // Staff always have passwords
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
    const { first_name, last_name, phone } = req.body;

    if (authUser.role === 'customer') {
      await pool.query(
        'UPDATE members SET first_name = $1, last_name = $2, phone = $3 WHERE member_id = $4',
        [first_name, last_name, phone, authUser.id]
      );
    } else {
      await pool.query(
        'UPDATE staff SET first_name = $1, last_name = $2, phone = $3 WHERE staff_id = $4',
        [first_name, last_name, phone, authUser.id]
      );
    }

    res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const setPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user as AuthPayload;
    const { new_password } = req.body;

    if (!new_password || new_password.length < 6) {
      res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
      return;
    }

    if (authUser.role === 'customer') {
      // Check if user already has a password
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
