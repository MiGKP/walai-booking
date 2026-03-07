import { Router } from 'express';
import {
  createRoomBooking,
  getUserRoomBookings,
  getRoomBookingById,
  cancelRoomBooking,
  getAllRoomBookings,
  updateRoomBookingStatus,
} from '../controllers/booking.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.post('/', authenticate, createRoomBooking);
router.post('/room', authenticate, createRoomBooking);
router.get('/my', authenticate, getUserRoomBookings);
router.get('/room/my', authenticate, getUserRoomBookings);
router.get('/:id', authenticate, getRoomBookingById);
router.put('/:id/cancel', authenticate, cancelRoomBooking);

// Admin + room_staff routes
router.get('/', authenticate, authorize('admin', 'room_staff'), getAllRoomBookings);
router.put('/:id/status', authenticate, authorize('admin', 'room_staff'), updateRoomBookingStatus);

export default router;
