import { Router } from 'express';
import {
  getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount,
  getResortInfo, upsertResortInfo,
  getBoatHours, upsertBoatHours,
  getStats,
} from '../controllers/settings.controller';
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
router.put('/resort', authenticate, authorize('admin', 'room_staff', 'boat_staff'), upsertResortInfo);

// Boat operating hours — read: public, write: admin + boat_staff
router.get('/boat-hours', getBoatHours);
router.put('/boat-hours', authenticate, authorize('admin', 'boat_staff'), upsertBoatHours);

export default router;
