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
import { authenticate, authorize, optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

// เส้นทางดูข้อมูลประเภทห้องพักและปฏิทินห้องว่าง
router.get('/', optionalAuthenticate, getAllRooms);
router.get('/types', optionalAuthenticate, getAllRooms);
router.get('/availability', checkRoomAvailability);
router.get('/calendar', getRoomCalendar);

// เส้นทางจัดการห้องพักรายห้องสำหรับผู้ดูแลระบบและพนักงานห้องพัก
router.get('/amenities/all', authenticate, authorize('admin', 'room_staff'), getAmenities);
router.get('/single/all', authenticate, authorize('admin', 'room_staff'), getAllSingleRooms);
router.get('/single/next-number', authenticate, authorize('admin', 'room_staff'), getNextRoomNumber);
router.post('/single/batch', authenticate, authorize('admin', 'room_staff'), createBatchSingleRooms);
router.post('/single', authenticate, authorize('admin', 'room_staff'), createSingleRoom);
router.put('/single/:id', authenticate, authorize('admin', 'room_staff'), updateSingleRoom);
router.delete('/single/:id', authenticate, authorize('admin', 'room_staff'), deleteSingleRoom);

// เส้นทางจัดการสิ่งอำนวยความสะดวกของห้องพัก
router.post('/amenity', authenticate, authorize('admin', 'room_staff'), createRoomAmenity);
router.put('/amenity/:id', authenticate, authorize('admin', 'room_staff'), updateAmenity);
router.patch('/amenity/:id/status', authenticate, authorize('admin', 'room_staff'), toggleAmenityStatus);
router.delete('/amenity/:id', authenticate, authorize('admin', 'room_staff'), deleteAmenity);

// เส้นทางสร้าง แก้ไข และลบประเภทห้องพัก
router.post('/type', authenticate, authorize('admin', 'room_staff'), createRoom);
router.get('/:id', optionalAuthenticate, getRoomById);
router.put('/:id', authenticate, authorize('admin', 'room_staff'), updateRoom);
router.patch('/:id/status', authenticate, authorize('admin', 'room_staff'), toggleRoomTypeStatus);
router.delete('/:id', authenticate, authorize('admin', 'room_staff'), deleteRoom);

export default router;
