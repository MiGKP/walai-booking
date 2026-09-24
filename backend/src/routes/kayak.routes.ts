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
} from '../controllers/kayak.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  createKayakBookingValidator,
  updateKayakBookingStatusValidator,
  createKayakValidator,
  createBoatRoundValidator,
} from '../middleware/validators';

const router = Router();

// Static routes (must come before dynamic /:id)
router.get('/', getAllKayaks);
// 🟢 [FIXED] เพิ่ม Route /types สำหรับดึงประเภทเรือ (ใส่ก่อน /:id)
router.get('/types', getAllKayaks); 

router.post('/', authenticate, authorize('admin', 'boat_staff'), createKayakValidator, validate, createKayak);

router.get('/availability', checkKayakAvailability);
router.get('/calendar', getKayakCalendar);
router.get('/rounds-availability', getKayakDayRounds);
router.get('/schedule', getKayakSchedule);

// บัตรเสริมพายเรือ (ผูกกับห้องพักจริง — เลือกตอนชำระเงินห้องพัก, มอบ/พิมพ์ตอนเช็คอิน)
router.get('/room-addon/:bookingRoomId', authenticate, getBoatAddonInfo);
router.post('/room-addon/:bookingRoomId', authenticate, createBoatAddon);
router.put('/room-addon/:boatBookingId/print', authenticate, authorize('admin', 'room_staff'), printBoatAddon);
router.put('/room-addon/:boatBookingId/hand-out', authenticate, authorize('admin', 'room_staff'), handOutBoatAddon);

// Bookings routes (specific before dynamic)
router.post('/bookings', authenticate, createKayakBookingValidator, validate, createKayakBooking);
router.get('/bookings/my', authenticate, getUserKayakBookings);
router.get('/bookings/all', authenticate, authorize('admin', 'boat_staff'), getAllKayakBookings);
router.get('/bookings/:id', authenticate, getKayakBookingById);
router.put('/bookings/:id/cancel', authenticate, cancelKayakBooking);
router.put('/bookings/:id/status', authenticate, authorize('admin', 'boat_staff'), updateKayakBookingStatusValidator, validate, updateKayakBookingStatus);
router.put('/bookings/:id/checkout', authenticate, authorize('admin', 'boat_staff'), checkoutKayakBooking);

// Rounds routes
router.post('/rounds', authenticate, authorize('admin', 'boat_staff'), createBoatRoundValidator, validate, createBoatRound);
router.put('/rounds/:id', authenticate, authorize('admin', 'boat_staff'), updateBoatRound);
router.delete('/rounds/:id', authenticate, authorize('admin', 'boat_staff'), deleteBoatRound);

// Admin routes
router.get('/admin/types', authenticate, authorize('admin', 'boat_staff'), getAllKayaksAdmin);
router.get('/admin/schedule', authenticate, authorize('admin', 'boat_staff'), getKayakScheduleAdmin);

// Boat images routes
router.get('/:id/images', authenticate, authorize('admin', 'boat_staff'), getBoatImages);
router.post('/:id/images', authenticate, authorize('admin', 'boat_staff'), addBoatImage);
router.delete('/:id/images/:imageId', authenticate, authorize('admin', 'boat_staff'), deleteBoatImage);

// Dynamic routes (must come last)
router.get('/:id', getKayakById);
router.put('/:id', authenticate, authorize('admin', 'boat_staff'), updateKayak);
router.delete('/:id', authenticate, authorize('admin', 'boat_staff'), deleteKayak);

export default router;