import { Router } from 'express';
import { getAllMembers, toggleMemberStatus } from '../controllers/member.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticate, authorize('admin'), getAllMembers);
router.put('/:id/status', authenticate, authorize('admin'), toggleMemberStatus);

export default router; 