import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

// ตรวจสอบผลลัพธ์จาก express-validator และส่งคืน HTTP 400 เมื่อข้อมูลไม่ถูกต้อง
export const validate = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
    return;
  }
  next();
};
