import { Router } from 'express';
import {
  getAllKayaks,
  getKayakById,
  checkKayakAvailability,
  getKayakCalendar,
  getKayakDayRounds,
  getKayakSchedule,
  createKayakBooking,
  getUserKayakBookings,
  getKayakBookingById,
  cancelKayakBooking,
  getAllKayakBookings,
  updateKayakBookingStatus,
  checkoutKayakBooking,
  checkinKayakBooking,
  getKayakCheckinSessions,
  createKayak,
  createBoatRound,
  updateKayak,
  deleteKayak,
  updateBoatRound,
  deleteBoatRound,
  getAllKayaksAdmin,
  getKayakScheduleAdmin,
  getBoatImages,
  addBoatImage,
  deleteBoatImage,
  getBoatAddonInfo,
  createBoatAddon,
  printBoatAddon,
  handOutBoatAddon,
  cancelBoatAddon,
} from '../controllers/kayak.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createKayakBookingValidator,
  updateKayakBookingStatusValidator,
  createKayakValidator,
  updateKayakValidator,
  createBoatRoundValidator,
  kayakCheckinSessionsValidator,
  checkinKayakBookingValidator,
} from '../middleware/validators';
import { bookingListValidator } from '../middleware/pagination-validator';

const router = Router();

// เส้นทางดูข้อมูลเรือคายัคและตารางรอบเรือที่ว่างสำหรับผู้ใช้ทั่วไป
router.get('/', getAllKayaks);
router.get('/types', getAllKayaks);
router.post('/', authenticate, authorize('admin', 'boat_staff'), createKayakValidator, validate, createKayak);
router.get('/availability', checkKayakAvailability);
router.get('/calendar', getKayakCalendar);
router.get('/rounds-availability', getKayakDayRounds);
router.get('/schedule', getKayakSchedule);

// เส้นทางจัดการบัตรเสริมพายเรือที่ผูกกับการจองห้องพัก
router.get('/room-addon/:bookingRoomId', authenticate, authorize('customer'), getBoatAddonInfo);
router.post('/room-addon/:bookingRoomId', authenticate, authorize('customer'), createBoatAddon);
router.put('/room-addon/:boatBookingId/cancel', authenticate, authorize('customer', 'admin', 'room_staff', 'boat_staff'), cancelBoatAddon);
router.put('/room-addon/:boatBookingId/print', authenticate, authorize('admin', 'room_staff'), printBoatAddon);
router.put('/room-addon/:boatBookingId/hand-out', authenticate, authorize('admin', 'room_staff'), handOutBoatAddon);

// เส้นทางจัดการการจองเรือคายัคและการเช็คอิน/คืนเรือ
router.post('/bookings', authenticate, authorize('customer', 'admin'), createKayakBookingValidator, validate, createKayakBooking);
router.get('/bookings/my', authenticate, authorize('customer'), getUserKayakBookings);
router.get('/bookings/all', authenticate, authorize('admin', 'boat_staff'), bookingListValidator, validate, getAllKayakBookings);
router.get('/checkin-sessions', authenticate, authorize('admin', 'boat_staff'), kayakCheckinSessionsValidator, validate, getKayakCheckinSessions);
router.get('/bookings/:id', authenticate, getKayakBookingById);
router.put('/bookings/:id/cancel', authenticate, authorize('customer'), cancelKayakBooking);
router.put('/bookings/:id/status', authenticate, authorize('admin', 'boat_staff'), updateKayakBookingStatusValidator, validate, updateKayakBookingStatus);
router.put('/bookings/:id/checkin', authenticate, authorize('admin', 'boat_staff'), checkinKayakBookingValidator, validate, checkinKayakBooking);
router.put('/bookings/:id/checkout', authenticate, authorize('admin', 'boat_staff'), checkoutKayakBooking);

// เส้นทางจัดการรอบเวลาให้บริการเรือคายัค
router.post('/rounds', authenticate, authorize('admin', 'boat_staff'), createBoatRoundValidator, validate, createBoatRound);
router.put('/rounds/:id', authenticate, authorize('admin', 'boat_staff'), updateBoatRound);
router.delete('/rounds/:id', authenticate, authorize('admin', 'boat_staff'), deleteBoatRound);

// เส้นทางดูข้อมูลประเภทเรือและตารางรอบเรือสำหรับผู้ดูแลระบบและพนักงาน
router.get('/admin/types', authenticate, authorize('admin', 'boat_staff'), getAllKayaksAdmin);
router.get('/admin/schedule', authenticate, authorize('admin', 'boat_staff'), getKayakScheduleAdmin);

// เส้นทางจัดการรูปภาพของประเภทเรือคายัค
router.get('/:id/images', authenticate, authorize('admin', 'boat_staff'), getBoatImages);
router.post('/:id/images', authenticate, authorize('admin', 'boat_staff'), addBoatImage);
router.delete('/:id/images/:imageId', authenticate, authorize('admin', 'boat_staff'), deleteBoatImage);

// เส้นทางดู แก้ไข และลบประเภทเรือคายัครายรายการ
router.get('/:id', getKayakById);
router.put('/:id', authenticate, authorize('admin', 'boat_staff'), updateKayakValidator, validate, updateKayak);
router.delete('/:id', authenticate, authorize('admin', 'boat_staff'), deleteKayak);

export default router;
