import { Router } from 'express';
import {
  getAllKayaks,
  getKayakById,
  checkKayakAvailability,
  getKayakSchedule,
  createKayakBooking,
  getUserKayakBookings,
  cancelKayakBooking,
  getAllKayakBookings,
  updateKayakBookingStatus,
  createKayak,
  createBoatRound,
  updateKayak,
} from '../controllers/kayak.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', getAllKayaks);
router.get('/availability', checkKayakAvailability);
router.get('/schedule', getKayakSchedule);
router.get('/:id', getKayakById);

router.post('/bookings', authenticate, createKayakBooking);
router.get('/bookings/my', authenticate, getUserKayakBookings);
router.put('/bookings/:id/cancel', authenticate, cancelKayakBooking);

// Admin + boat_staff routes
router.get('/bookings/all', authenticate, authorize('admin', 'boat_staff'), getAllKayakBookings);
router.put('/bookings/:id/status', authenticate, authorize('admin', 'boat_staff'), updateKayakBookingStatus);

// Admin Routes
router.post('/', authenticate, authorize('admin', 'boat_staff'), createKayak);
router.post('/rounds', authenticate, authorize('admin', 'boat_staff'), createBoatRound);
router.put('/:id', authenticate, authorize('admin', 'boat_staff'), updateKayak);

export default router;
