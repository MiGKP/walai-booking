import { Router } from 'express';
import {
  createRoomBooking,
  getUserRoomBookings,
  getRoomBookingById,
  cancelRoomBooking,
  getAllRoomBookings,
  updateRoomBookingStatus,
  checkinRoomBooking,
  checkoutRoomBooking,
} from '../controllers/booking.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createRoomBookingValidator, updateRoomBookingStatusValidator } from '../middleware/validators';

const router = Router();

// ==========================================
// User Routes
// ==========================================
router.post('/', authenticate, createRoomBookingValidator, validate, createRoomBooking);
router.post('/room', authenticate, createRoomBookingValidator, validate, createRoomBooking);
router.get('/my', authenticate, getUserRoomBookings);
router.get('/room/my', authenticate, getUserRoomBookings);
router.get('/:id', authenticate, getRoomBookingById);
router.put('/:id/cancel', authenticate, cancelRoomBooking);

// ==========================================
// Admin & Room Staff Routes
// ==========================================
router.get('/', authenticate, authorize('admin', 'room_staff'), getAllRoomBookings);
router.put('/:id/status', authenticate, authorize('admin', 'room_staff'), updateRoomBookingStatusValidator, validate, updateRoomBookingStatus);

// 📌 Route สำหรับ Check-in และ Check-out
router.put('/:id/checkin', authenticate, authorize('admin', 'room_staff'), checkinRoomBooking);
router.put('/:id/checkout', authenticate, authorize('admin', 'room_staff'), checkoutRoomBooking);

export default router;