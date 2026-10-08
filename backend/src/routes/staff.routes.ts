import { Router } from 'express';
import {
  createStaff,
  getAllStaff,
  getStaffById,
  toggleStaffStatus,
  deleteStaff,
  updateStaff,
} from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { createStaffValidator } from '../middleware/validators';

const router = Router();

router.post('/', authenticate, authorize('admin'), createStaffValidator, validate, createStaff);
router.get('/', authenticate, authorize('admin'), getAllStaff);
router.get('/:id', authenticate, authorize('admin'), getStaffById);
router.put('/:id', authenticate, authorize('admin'), updateStaff);
router.put('/:id/status', authenticate, authorize('admin'), toggleStaffStatus);
router.patch('/:id/status', authenticate, authorize('admin'), toggleStaffStatus);
router.delete('/:id', authenticate, authorize('admin'), deleteStaff);

export default router;
