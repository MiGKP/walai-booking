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
router.get('/my', authenticate, getUserRoomBookings);
router.get('/:id', authenticate, getRoomBookingById);
router.put('/:id/cancel', authenticate, cancelRoomBooking);

router.get('/', authenticate, authorize('admin'), getAllRoomBookings);
router.put('/:id/status', authenticate, authorize('admin'), updateRoomBookingStatus);

export default router;
