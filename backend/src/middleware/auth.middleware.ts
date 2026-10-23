import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { AuthPayload } from '../types';

// ขยาย Express Request เพื่อแนบข้อมูลผู้ใช้ที่ผ่านการยืนยันตัวตนแล้ว
export interface AuthRequest extends Request {
  user?: AuthPayload;
}

// ตรวจสอบสถานะบัญชี บทบาทล่าสุด และเวลาเปลี่ยนรหัสผ่านจากฐานข้อมูล
const resolveActiveAccount = async (
  payload: AuthPayload
): Promise<{ role: string; email?: string; passwordChangedAtMs: number | null } | null> => {
  if (payload.role === 'customer') {
    const r = await pool.query(
      'SELECT is_active, password_changed_at FROM members WHERE member_id = $1',
      [payload.id]
    );
    if (r.rows.length === 0 || r.rows[0].is_active === false) return null;
    return {
      role: 'customer',
      passwordChangedAtMs: r.rows[0].password_changed_at ? new Date(r.rows[0].password_changed_at).getTime() : null,
    };
  }
  const r = await pool.query(
    'SELECT role, status, password_changed_at, email FROM staff WHERE staff_id = $1',
    [payload.id]
  );
  if (r.rows.length === 0 || r.rows[0].status !== true) return null;
  return {
    role: String(r.rows[0].role),
    email: r.rows[0].email,
    passwordChangedAtMs: r.rows[0].password_changed_at ? new Date(r.rows[0].password_changed_at).getTime() : null,
  };
};

// ตรวจสอบ Bearer token และแนบข้อมูลผู้ใช้ลงใน req.user
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

  let decoded: AuthPayload & { iat?: number };
  try {
    decoded = jwt.verify(token, secret, { algorithms: ['HS256'] }) as AuthPayload & { iat?: number };
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
    const issuedAtSecondsMs = Number(decoded.iat ?? 0) * 1000;
    if (decoded.issued_at_ms !== undefined && (
      !Number.isSafeInteger(decoded.issued_at_ms) ||
      decoded.issued_at_ms < issuedAtSecondsMs ||
      decoded.issued_at_ms >= issuedAtSecondsMs + 1000
    )) {
      res.status(401).json({ success: false, message: 'Invalid token' });
      return;
    }
    const issuedAtMs = decoded.issued_at_ms ?? issuedAtSecondsMs;
    if (account.passwordChangedAtMs !== null && issuedAtMs <= account.passwordChangedAtMs) {
      res.status(401).json({ success: false, message: 'Session expired, please login again' });
      return;
    }
    (req as AuthRequest).user = { ...decoded, role: account.role as AuthPayload['role'], email: account.email ?? decoded.email };
    next();
  } catch (error) {
    console.error('Authenticate lookup error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ตรวจสอบ token แบบไม่บังคับ หากไม่มีหรือถอดรหัสไม่ได้จะทำงานต่อแบบผู้ใช้ทั่วไป
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
  try {
    jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET || '', { algorithms: ['HS256'] });
  } catch {
    next();
    return;
  }
  authenticate(req, res, next);
};

// ตรวจสอบสิทธิ์การเข้าถึงตามบทบาทของผู้ใช้ (Role-based access control)
export const authorize = (...roles: (string | string[])[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;
    const allowedRoles = roles.flat();

    if (!authReq.user || !allowedRoles.includes(authReq.user.role)) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    next();
  };
};
