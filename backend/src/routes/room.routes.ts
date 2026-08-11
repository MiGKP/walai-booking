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
  createBatchSingleRooms,
  updateSingleRoom,
  deleteSingleRoom,
  updateAmenity,
  deleteAmenity,
  toggleRoomTypeStatus, 
  toggleAmenityStatus,
  getNextRoomNumber,
} from '../controllers/room.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Static routes (must come before dynamic /:id)
router.get('/', getAllRooms);
router.get('/availability', checkRoomAvailability);
router.get('/calendar', getRoomCalendar);


router.get('/amenities/all', authenticate, authorize('admin', 'room_staff'), getAmenities);
router.get('/single/all', authenticate, authorize('admin', 'room_staff'), getAllSingleRooms);
// ดึงลำดับห้องถัดไปอัตโนมัติ
router.get('/single/next-number', authenticate, authorize('admin', 'room_staff'), getNextRoomNumber);

// Single room routes (เปิดสิทธิ์ให้ room_staff)
router.post('/single/batch', authenticate, authorize('admin', 'room_staff'), createBatchSingleRooms);
router.post('/single', authenticate, authorize('admin', 'room_staff'), createSingleRoom);
router.put('/single/:id', authenticate, authorize('admin', 'room_staff'), updateSingleRoom);
router.delete('/single/:id', authenticate, authorize('admin', 'room_staff'), deleteSingleRoom);

// Amenity routes (เปิดสิทธิ์ให้ room_staff)
router.post('/amenity', authenticate, authorize('admin', 'room_staff'), createRoomAmenity);
router.put('/amenity/:id', authenticate, authorize('admin', 'room_staff'), updateAmenity);
router.patch('/amenity/:id/status', authenticate, authorize('admin', 'room_staff'), toggleAmenityStatus); 
router.delete('/amenity/:id', authenticate, authorize('admin', 'room_staff'), deleteAmenity);

// Room type routes (dynamic - must come last)
router.post('/type', authenticate, authorize('admin'), createRoom);
router.get('/:id', getRoomById);
router.put('/:id', authenticate, authorize('admin'), updateRoom);

// Route PATCH สำหรับอัปเดตสถานะ
router.patch('/:id/status', authenticate, authorize('admin'), toggleRoomTypeStatus);

router.delete('/:id', authenticate, authorize('admin'), deleteRoom);

export default router;