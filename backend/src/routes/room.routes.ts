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
router.get('/amenities/all', getAmenities);
router.get('/single/all', getAllSingleRooms);
// ดึงลำดับห้องถัดไปอัตโนมัติ
router.get('/single/next-number', getNextRoomNumber);

// Single room routes
router.post('/single/batch', authenticate, authorize('admin'), createBatchSingleRooms); // ✅ แก้ไข Path และวางไว้ก่อน /single
router.post('/single', authenticate, authorize('admin'), createSingleRoom);
router.put('/single/:id', authenticate, authorize('admin'), updateSingleRoom);
router.delete('/single/:id', authenticate, authorize('admin'), deleteSingleRoom);

// Amenity routes
router.post('/amenity', authenticate, authorize('admin'), createRoomAmenity);
router.put('/amenity/:id', authenticate, authorize('admin'), updateAmenity);
router.patch('/amenity/:id/status', authenticate, authorize('admin'), toggleAmenityStatus); 
router.delete('/amenity/:id', authenticate, authorize('admin'), deleteAmenity);

// Room type routes (dynamic - must come last)
router.post('/type', authenticate, authorize('admin'), createRoom);
router.get('/:id', getRoomById);
router.put('/:id', authenticate, authorize('admin'), updateRoom);

// Route PATCH สำหรับอัปเดตสถานะ
router.patch('/:id/status', authenticate, authorize('admin'), toggleRoomTypeStatus);

router.delete('/:id', authenticate, authorize('admin'), deleteRoom);

export default router;