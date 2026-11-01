import { Router } from 'express';
import {
  createRoomBooking,
  getUserRoomBookings,
  getRoomBookingById,
  cancelRoomBooking,
  getAllRoomBookings,
  updateRoomBookingStatus,
  checkinBookingRoom,
  checkoutRoomBooking,
  checkoutBookingRoom,
} from '../controllers/booking.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createRoomBookingValidator, updateRoomBookingStatusValidator, checkinRoomValidator } from '../middleware/validators';
import { bookingListValidator } from '../middleware/pagination-validator';

const router = Router();

// เส้นทางสร้างและดูประวัติการจองห้องพักของลูกค้า
router.post('/', authenticate, authorize('customer', 'admin', 'room_staff', 'boat_staff'), createRoomBookingValidator, validate, createRoomBooking);
router.post('/room', authenticate, authorize('customer', 'admin', 'room_staff', 'boat_staff'), createRoomBookingValidator, validate, createRoomBooking);
router.get('/my', authenticate, authorize('customer'), getUserRoomBookings);
router.get('/room/my', authenticate, authorize('customer'), getUserRoomBookings);

// เส้นทางเช็คอินและเช็คเอาท์ห้องพักรายห้องสำหรับพนักงานและผู้ดูแลระบบ
router.put(
  '/booking-rooms/:bookingRoomId/checkin',
  authenticate,
  authorize('admin', 'room_staff'),
  checkinRoomValidator,
  validate,
  checkinBookingRoom
);
router.put(
  '/booking-rooms/:bookingRoomId/checkout',
  authenticate,
  authorize('admin', 'room_staff'),
  checkoutBookingRoom
);

// เส้นทางจัดการรายการจองห้องพักทั้งหมดสำหรับพนักงานและผู้ดูแลระบบ
router.get('/', authenticate, authorize('admin', 'room_staff'), bookingListValidator, validate, getAllRoomBookings);
router.put(
  '/:id/status',
  authenticate,
  authorize('admin', 'room_staff'),
  updateRoomBookingStatusValidator,
  validate,
  updateRoomBookingStatus
);
router.put('/:id/checkout', authenticate, authorize('admin', 'room_staff'), checkoutRoomBooking);

// เส้นทางดูรายละเอียดและยกเลิกการจองห้องพักรายบิล
router.get('/:id', authenticate, getRoomBookingById);
router.put('/:id/cancel', authenticate, authorize('customer'), cancelRoomBooking);

export default router;
