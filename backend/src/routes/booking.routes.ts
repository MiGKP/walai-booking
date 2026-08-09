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
  checkoutBookingRoom,
} from '../controllers/booking.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createRoomBookingValidator, updateRoomBookingStatusValidator } from '../middleware/validators';

const router = Router();

router.post('/', authenticate, createRoomBookingValidator, validate, createRoomBooking);
router.post('/room', authenticate, createRoomBookingValidator, validate, createRoomBooking);
router.get('/my', authenticate, getUserRoomBookings);
router.get('/room/my', authenticate, getUserRoomBookings);

router.put(
  '/booking-rooms/:bookingRoomId/checkout',
  authenticate,
  authorize('admin', 'room_staff'),
  checkoutBookingRoom
);

router.get('/', authenticate, authorize('admin', 'room_staff'), getAllRoomBookings);
router.put(
  '/:id/status',
  authenticate,
  authorize('admin', 'room_staff'),
  updateRoomBookingStatusValidator,
  validate,
  updateRoomBookingStatus
);
router.put('/:id/checkin', authenticate, authorize('admin', 'room_staff'), checkinRoomBooking);
router.put('/:id/checkout', authenticate, authorize('admin', 'room_staff'), checkoutRoomBooking);

router.get('/:id', authenticate, getRoomBookingById);
router.put('/:id/cancel', authenticate, cancelRoomBooking);

export default router;
