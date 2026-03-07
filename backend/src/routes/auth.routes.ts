import { Router } from 'express';
import passport from 'passport';
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  googleCallback,
  getProfile,
  updateProfile,
  changePassword,
  setPassword,
  createStaff,
  getAllStaff,
  getStaffById,
  toggleStaffStatus,
  deleteStaff,
  initAdmin,
} from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

// Admin Staff Management
router.post('/init-admin', initAdmin); // No auth required, but checks if admin already exists
router.post('/staff', authenticate, authorize('admin'), createStaff);
router.get('/staff', authenticate, authorize('admin'), getAllStaff);
router.get('/staff/:id', authenticate, authorize('admin'), getStaffById);
router.put('/staff/:id/status', authenticate, authorize('admin'), toggleStaffStatus);
router.delete('/staff/:id', authenticate, authorize('admin'), deleteStaff);

router.post('/register', register);
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/api/auth/google/failed', session: false }),
  googleCallback
);
router.get('/google/failed', (req, res) => {
  const error = req.query.error as string || 'Google authentication failed';
  res.redirect(`${process.env.FRONTEND_URL}/auth/login?error=${encodeURIComponent(error)}`);
});

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);
router.put('/set-password', authenticate, setPassword);

export default router;
