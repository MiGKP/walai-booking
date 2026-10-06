import { Router } from 'express';
import {
  getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount,
  getResortInfo, upsertResortInfo,
  getLandingStats,
  getBoatHours, upsertBoatHours,
  getStats,
  getCancellationPolicy, upsertCancellationPolicy,
} from '../controllers/settings.controller';
import { cancellationPolicyValidator, resortInfoValidator } from '../middleware/validators';
import { validate } from '../middleware/validate.middleware';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Stats — admin, room_staff, boat_staff
router.get('/stats', authenticate, authorize('admin', 'room_staff', 'boat_staff'), getStats);

// Bank accounts — admin only
router.get('/bank-accounts', authenticate, authorize('admin'), getBankAccounts);
router.post('/bank-accounts', authenticate, authorize('admin'), createBankAccount);
router.put('/bank-accounts/:id', authenticate, authorize('admin'), updateBankAccount);
router.delete('/bank-accounts/:id', authenticate, authorize('admin'), deleteBankAccount);

// Resort info (contact + site info รวมกัน) — read: public, write: admin + room_staff + boat_staff
router.get('/resort', getResortInfo);
router.get('/landing-stats', getLandingStats);
router.put('/resort', authenticate, authorize('admin', 'room_staff', 'boat_staff'), resortInfoValidator, validate, upsertResortInfo);

// Boat add-on refund policy — read: public, write: admin + room_staff + boat_staff
router.get('/cancellation-policy', getCancellationPolicy);
router.put('/cancellation-policy', authenticate, authorize('admin', 'room_staff', 'boat_staff'), cancellationPolicyValidator, validate, upsertCancellationPolicy);

// Boat operating hours — read: public, write: admin + boat_staff
router.get('/boat-hours', getBoatHours);
router.put('/boat-hours', authenticate, authorize('admin', 'boat_staff'), upsertBoatHours);

export default router;
