import { Router } from 'express';
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

router.post('/', authenticate, authorize('customer', 'admin', 'room_staff', 'boat_staff'), createPaymentValidator, validate, createPayment);
router.post('/:id/slip', authenticate, authorize('customer'), upload.single('slip'), uploadPaymentSlip);
router.get('/my', authenticate, authorize('customer'), getUserPayments);
router.get('/:id', authenticate, getPaymentById);

router.get('/', authenticate, authorize('admin', 'room_staff', 'boat_staff'), getAllPayments);
router.put('/:id/confirm', authenticate, authorize('admin', 'room_staff', 'boat_staff'), confirmPayment);

export default router;
