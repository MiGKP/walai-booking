import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import {
  createPayment,
  uploadPaymentSlip,
  confirmPayment,
  getPaymentById,
  getUserPayments,
  getAllPayments,
} from '../controllers/payment.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'slip-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

const router = Router();

router.post('/', authenticate, createPayment);
router.post('/:id/slip', authenticate, upload.single('slip'), uploadPaymentSlip);
router.get('/my', authenticate, getUserPayments);
router.get('/:id', authenticate, getPaymentById);

router.get('/', authenticate, authorize('admin'), getAllPayments);
router.put('/:id/confirm', authenticate, authorize('admin'), confirmPayment);

export default router;
