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
  deleteKayak,
  updateBoatRound,
  deleteBoatRound,
  getAllKayaksAdmin,
  getKayakScheduleAdmin,
  getBoatImages,
  addBoatImage,
  deleteBoatImage,
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
router.post('/', authenticate, authorize('admin', 'boat_staff'), createKayakValidator, validate, createKayak);

router.get('/availability', checkKayakAvailability);
router.get('/schedule', getKayakSchedule);

// Bookings routes (specific before dynamic)
router.post('/bookings', authenticate, createKayakBookingValidator, validate, createKayakBooking);
router.get('/bookings/my', authenticate, getUserKayakBookings);
router.get('/bookings/all', authenticate, authorize('admin', 'boat_staff'), getAllKayakBookings);
router.put('/bookings/:id/cancel', authenticate, cancelKayakBooking);
router.put('/bookings/:id/status', authenticate, authorize('admin', 'boat_staff'), updateKayakBookingStatusValidator, validate, updateKayakBookingStatus);

// Rounds routes (specific before dynamic)
router.post('/rounds', authenticate, authorize('admin', 'boat_staff'), createBoatRoundValidator, validate, createBoatRound);
router.put('/rounds/:id', authenticate, authorize('admin', 'boat_staff'), createBoatRoundValidator, validate, updateBoatRound);
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
router.put('/:id', authenticate, authorize('admin', 'boat_staff'), createKayakValidator, validate, updateKayak);
router.delete('/:id', authenticate, authorize('admin', 'boat_staff'), deleteKayak);

export default router;
