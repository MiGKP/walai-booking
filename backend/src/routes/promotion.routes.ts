import { Router } from 'express';
import {
  getActivePromotions,
  getAllPromotions,
  validatePromoCode,
  createPromotion,
  updatePromotion,
  deletePromotion,
  togglePromotion,
} from '../controllers/promotion.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createPromotionValidator, updatePromotionValidator, validatePromoCodeValidator } from '../middleware/validators';

const router = Router();

// Public — ดูโปรโมชั่นที่ active
router.get('/active', getActivePromotions);

// Public — ตรวจสอบโค้ดโปรโมชั่น
router.post('/validate', validatePromoCodeValidator, validate, validatePromoCode);

// Admin only — จัดการโปรโมชั่น
router.get('/', authenticate, authorize('admin'), getAllPromotions);
router.post('/', authenticate, authorize('admin'), createPromotionValidator, validate, createPromotion);
router.put('/:id', authenticate, authorize('admin'), updatePromotionValidator, validate, updatePromotion);
router.delete('/:id', authenticate, authorize('admin'), deletePromotion);
router.put('/:id/toggle', authenticate, authorize('admin'), togglePromotion);

export default router;
