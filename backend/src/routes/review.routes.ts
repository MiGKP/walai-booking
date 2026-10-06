import { Router } from 'express';
import {
  getPublicReviews,
  getReviewsByRoomType,
  getMyReviews,
  getReviewableBookings,
  createReview,
  updateReview,
  deleteReview,
  getAllReviews,
  adminDeleteReview,
} from '../controllers/review.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

import { reviewListValidator } from '../middleware/pagination-validator';
import { validate } from '../middleware/validate.middleware';

const router = Router();

// Public
router.get('/public', getPublicReviews);
router.get('/room-type/:room_type_id', getReviewsByRoomType);

// Member routes
router.get('/my', authenticate, authorize('customer'), getMyReviews);
router.get('/reviewable', authenticate, authorize('customer'), getReviewableBookings);
router.post('/', authenticate, authorize('customer'), createReview);
router.put('/:id', authenticate, authorize('customer'), updateReview);
router.delete('/:id', authenticate, authorize('customer'), deleteReview);

// Admin & Staff routes
router.get('/admin/all', authenticate, authorize('admin', 'room_staff'), reviewListValidator, validate, getAllReviews);
router.delete('/admin/:id', authenticate, authorize('admin', 'room_staff'), adminDeleteReview);

export default router;