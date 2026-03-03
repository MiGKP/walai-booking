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

router.get('/bookings/all', authenticate, authorize('admin'), getAllKayakBookings);

// Admin Routes
router.post('/', authenticate, authorize('admin'), createKayak);
router.post('/rounds', authenticate, authorize('admin'), createBoatRound);
router.put('/:id', authenticate, authorize('admin'), updateKayak);

export default router;
