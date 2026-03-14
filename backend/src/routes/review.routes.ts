import { Router } from 'express';
import {
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

const router = Router();

// Public — ดูรีวิวของ room type นั้น
router.get('/room-type/:room_type_id', getReviewsByRoomType);

// Member routes
router.get('/my', authenticate, getMyReviews);
router.get('/reviewable', authenticate, getReviewableBookings);
router.post('/', authenticate, createReview);
router.put('/:id', authenticate, updateReview);
router.delete('/:id', authenticate, deleteReview);

// Admin routes
router.get('/admin/all', authenticate, authorize('admin', 'room_staff'), getAllReviews);
router.delete('/admin/:id', authenticate, authorize('admin', 'room_staff'), adminDeleteReview);

export default router;
