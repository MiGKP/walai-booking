import { Router, Request, Response, NextFunction } from 'express';
import {
  createPayment,
  uploadPaymentSlip,
  confirmPayment,
  getPaymentById,
  getUserPayments,
  getAllPayments,
} from '../controllers/payment.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createPaymentValidator } from '../middleware/validators';
import { createImageUpload } from '../middleware/image-upload.middleware';

const upload = createImageUpload(5 * 1024 * 1024);
const router = Router();

// ตรวจสอบรูปแบบรหัสรายการชำระเงิน (room_123 หรือ kayak_456) ก่อนรับไฟล์สลิป
const validateSlipPaymentId = (req: Request, res: Response, next: NextFunction): void => {
  if (!/^(room|kayak)_[1-9]\d*$/.test(String(req.params.id))) {
    res.status(400).json({ success: false, message: 'รหัสรายการชำระเงินไม่ถูกต้อง (ต้องเป็น room_เลขที่ หรือ kayak_เลขที่)' });
    return;
  }
  next();
};

// เส้นทางสร้างรายการชำระเงิน อัปโหลดสลิป และตรวจสอบการชำระเงิน
router.post('/', authenticate, authorize('customer', 'admin', 'room_staff', 'boat_staff'), createPaymentValidator, validate, createPayment);
router.post('/:id/slip', authenticate, authorize('customer'), validateSlipPaymentId, upload.single('slip'), uploadPaymentSlip);
router.get('/my', authenticate, authorize('customer'), getUserPayments);
router.get('/:id', authenticate, getPaymentById);
router.get('/', authenticate, authorize('admin', 'room_staff', 'boat_staff'), getAllPayments);
router.put('/:id/confirm', authenticate, authorize('admin', 'room_staff', 'boat_staff'), confirmPayment);

export default router;
