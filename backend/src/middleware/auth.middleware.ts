import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthPayload } from '../types';

// ขยาย type ของ Express Request เพื่อให้ middleware แนบข้อมูล user จาก JWT ไปใช้ต่อใน controller ได้อย่างปลอดภัย
export interface AuthRequest extends Request {
  user?: AuthPayload;
}

// ตรวจสอบ Bearer token จาก header, ถอดรหัส JWT และแนบ payload ของผู้ใช้ไว้ใน req.user
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
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

  try {
    const decoded = jwt.verify(token, secret) as AuthPayload;
    (req as AuthRequest).user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
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