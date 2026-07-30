import { Router } from 'express';
import {
  getAllRooms,
  getRoomById,
  checkRoomAvailability,
  getRoomCalendar,
  createRoom,
  createSingleRoom,
  createRoomAmenity,
  updateRoom,
  deleteRoom,
  getAmenities,
  getAllSingleRooms,
  updateSingleRoom,
  deleteSingleRoom,
  updateAmenity,
  deleteAmenity,
} from '../controllers/room.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Static routes (must come before dynamic /:id)
router.get('/', getAllRooms);
router.get('/availability', checkRoomAvailability);
router.get('/calendar', getRoomCalendar);
router.get('/amenities/all', getAmenities);
router.get('/single/all', getAllSingleRooms);

// Single room routes
router.post('/single', authenticate, authorize('admin'), createSingleRoom);
router.put('/single/:id', authenticate, authorize('admin'), updateSingleRoom);
router.delete('/single/:id', authenticate, authorize('admin'), deleteSingleRoom);

// Amenity routes
router.post('/amenity', authenticate, authorize('admin'), createRoomAmenity);
router.put('/amenity/:id', authenticate, authorize('admin'), updateAmenity);
router.delete('/amenity/:id', authenticate, authorize('admin'), deleteAmenity);

// Room type routes (dynamic - must come last)
router.post('/type', authenticate, authorize('admin'), createRoom);
router.get('/:id', getRoomById);
router.put('/:id', authenticate, authorize('admin'), updateRoom);
router.delete('/:id', authenticate, authorize('admin'), deleteRoom);

export default router;
