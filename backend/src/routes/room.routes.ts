import { Router } from 'express';
import {
  getAllRooms,
  getRoomById,
  checkRoomAvailability,
  createRoom,
  createSingleRoom,
  createRoomAmenity,
  updateRoom,
  deleteRoom,
  getAmenities,
  getAllSingleRooms
} from '../controllers/room.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', getAllRooms);
router.get('/availability', checkRoomAvailability);
router.get('/amenities/all', getAmenities);
router.get('/single/all', getAllSingleRooms);
router.get('/:id', getRoomById);

// Admin Routes
router.post('/type', authenticate, authorize('admin'), createRoom); // create room type
router.post('/single', authenticate, authorize('admin'), createSingleRoom); // create individual room
router.post('/amenity', authenticate, authorize('admin'), createRoomAmenity); // create amenity

router.put('/:id', authenticate, authorize('admin'), updateRoom);
router.delete('/:id', authenticate, authorize('admin'), deleteRoom);

export default router;
