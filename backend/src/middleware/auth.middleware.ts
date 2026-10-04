import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { AuthPayload } from '../types';

// ขยาย type ของ Express Request เพื่อให้ middleware แนบข้อมูล user จาก JWT ไปใช้ต่อใน controller ได้อย่างปลอดภัย
export interface AuthRequest extends Request {
  user?: AuthPayload;
}

// ตรวจสอบ Bearer token จาก header, ถอดรหัส JWT และแนบ payload ของผู้ใช้ไว้ใน req.user
// ตรวจสอบสถานะบัญชีและ role ล่าสุดจากฐานข้อมูล เพื่อให้บัญชีที่ถูกปิดหรือเปลี่ยนสิทธิ์มีผลทันที (ไม่รอให้ token หมดอายุ)
const resolveActiveAccount = async (
  payload: AuthPayload
): Promise<{ role: string } | null> => {
  if (payload.role === 'customer') {
    const r = await pool.query('SELECT is_active FROM members WHERE member_id = $1', [payload.id]);
    if (r.rows.length === 0 || r.rows[0].is_active === false) return null;
    return { role: 'customer' };
  }
  const r = await pool.query('SELECT role, status FROM staff WHERE staff_id = $1', [payload.id]);
  if (r.rows.length === 0 || r.rows[0].status !== true) return null;
  return { role: String(r.rows[0].role) };
};

// ตรวจสอบ Bearer token จาก header, ถอดรหัส JWT, เช็คบัญชีในฐานข้อมูล แล้วแนบ payload ของผู้ใช้ไว้ใน req.user
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Unauthorized' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    res.status(500).json({ success: false, message: 'Server configuration error' });
    return;
  }

  let decoded: AuthPayload;
  try {
    decoded = jwt.verify(token, secret) as AuthPayload;
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
    return;
  }

  try {
    const account = await resolveActiveAccount(decoded);
    if (!account) {
      res.status(401).json({ success: false, message: 'Account is disabled or no longer exists' });
      return;
    }
    (req as AuthRequest).user = { ...decoded, role: account.role as AuthPayload['role'] };
    next();
  } catch (error) {
    console.error('Authenticate lookup error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

/** Same as authenticate, but missing header continues as anonymous. Invalid token still 401. */
export const optionalAuthenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    next();
    return;
  }
  authenticate(req, res, next);
};

// สร้าง middleware สำหรับตรวจสอบสิทธิ์ตาม role
export const authorize = (...roles: (string | string[])[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    
    // แปลงอาร์เรย์สองชั้นให้เป็นมิติเดียว ป้องกันบั๊กกรณีเผลอใส่ [ ] ใน router
    const allowedRoles = roles.flat(); 

    if (!authReq.user || !allowedRoles.includes(authReq.user.role)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    next();
  };
};