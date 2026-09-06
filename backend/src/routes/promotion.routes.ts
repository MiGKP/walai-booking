import { Router } from 'express';
import {
  getActivePromotions,
  getAllPromotions,
  validatePromoCode,
  createPromotion,
  updatePromotion,
  deletePromotion,
  togglePromotion,
  collectPromotion,
  uncollectPromotion,
  getMyPromotions,
  getPromotionRedemptions,
} from '../controllers/promotion.controller';
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createPromotionValidator,
  updatePromotionValidator,
  validatePromoCodeValidator,
  promotionIdParamValidator,
} from '../middleware/validators';

const router = Router();

router.get('/active', optionalAuthenticate, getActivePromotions);
router.post(
  '/validate',
  optionalAuthenticate,
  validatePromoCodeValidator,
  validate,
  validatePromoCode
);

router.get('/mine', authenticate, getMyPromotions);
router.get(
  '/:id/redemptions',
  authenticate,
  authorize('admin', 'room_staff'),
  promotionIdParamValidator,
  validate,
  getPromotionRedemptions
);
router.post(
  '/:id/collect',
  authenticate,
  promotionIdParamValidator,
  validate,
  collectPromotion
);
router.delete(
  '/:id/collect',
  authenticate,
  promotionIdParamValidator,
  validate,
  uncollectPromotion
);

router.get('/', authenticate, authorize('admin', 'room_staff'), getAllPromotions);
router.post('/', authenticate, authorize('admin', 'room_staff'), createPromotionValidator, validate, createPromotion);
router.put('/:id', authenticate, authorize('admin', 'room_staff'), updatePromotionValidator, validate, updatePromotion);
router.delete('/:id', authenticate, authorize('admin', 'room_staff'), deletePromotion);
router.put('/:id/toggle', authenticate, authorize('admin', 'room_staff'), togglePromotion);

export default router;
