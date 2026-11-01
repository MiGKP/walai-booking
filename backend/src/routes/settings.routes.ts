import { Router } from 'express';
import { query } from 'express-validator';
import {
  getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount,
  getResortInfo, upsertResortInfo,
  getLandingStats,
  getBoatHours, upsertBoatHours,
  getStats,
  getCancellationPolicy, upsertCancellationPolicy,
  getNotificationSummary,
} from '../controllers/settings.controller';
import { cancellationPolicyValidator, resortInfoValidator } from '../middleware/validators';
import { validate } from '../middleware/validate.middleware';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// เส้นทางดึงสรุปจำนวนแจ้งเตือนและสถิติรายงานสำหรับพนักงานและผู้ดูแลระบบ
router.get('/notifications/pending', authenticate, authorize('admin', 'room_staff', 'boat_staff'), getNotificationSummary);
router.get('/stats', authenticate, authorize('admin', 'room_staff', 'boat_staff'),
  query('period').optional().isIn(['day', 'month']),
  query('date').optional().isString().bail().matches(/^\d{4}-\d{2}-\d{2}$/),
  query('year').optional().isInt({ min: 1970, max: 2100 }),
  query('month').optional().isInt({ min: 1, max: 12 }), validate, getStats);

// เส้นทางจัดการบัญชีธนาคารสำหรับผู้ดูแลระบบ
router.get('/bank-accounts', authenticate, authorize('admin'), getBankAccounts);
router.post('/bank-accounts', authenticate, authorize('admin'), createBankAccount);
router.put('/bank-accounts/:id', authenticate, authorize('admin'), updateBankAccount);
router.delete('/bank-accounts/:id', authenticate, authorize('admin'), deleteBankAccount);

// เส้นทางดูและแก้ไขข้อมูลรีสอร์ท นโยบายการยกเลิก และเวลาทำการเรือ
router.get('/resort', getResortInfo);
router.get('/landing-stats', getLandingStats);
router.put('/resort', authenticate, authorize('admin', 'room_staff', 'boat_staff'), resortInfoValidator, validate, upsertResortInfo);
router.get('/cancellation-policy', getCancellationPolicy);
router.put('/cancellation-policy', authenticate, authorize('admin', 'room_staff', 'boat_staff'), cancellationPolicyValidator, validate, upsertCancellationPolicy);
router.get('/boat-hours', getBoatHours);
router.put('/boat-hours', authenticate, authorize('admin', 'boat_staff'), upsertBoatHours);

export default router;
