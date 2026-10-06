import { Router } from 'express';
import { getAllMembers, toggleMemberStatus } from '../controllers/member.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

import { memberListValidator } from '../middleware/pagination-validator';
import { validate } from '../middleware/validate.middleware';

const router = Router();

router.get('/', authenticate, authorize('admin'), memberListValidator, validate, getAllMembers);
router.put('/:id/status', authenticate, authorize('admin'), toggleMemberStatus);

export default router; 