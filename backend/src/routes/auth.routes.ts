import { Router } from 'express';
import passport from 'passport';
import multer from 'multer';
import path from 'path';
import {
  register,
  login,
  forgotPassword,
  resetPassword,
  googleCallback,
  getProfile,
  updateProfile,
  uploadProfileAvatar,
  changePassword,
  setPassword,
  createStaff,
  getAllStaff,
  getStaffById,
  toggleStaffStatus,
  deleteStaff,
  updateStaff,
  initAdmin,
  getAllMembers,
  toggleMemberStatus,
} from '../controllers/auth.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import {
  registerValidator,
  loginValidator,
  forgotPasswordValidator,
  resetPasswordValidator,
  updateProfileValidator,
  changePasswordValidator,
  setPasswordValidator,
  createStaffValidator,
} from '../middleware/validators';

const router = Router();

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Admin Staff Management
router.post('/init-admin', initAdmin); // No auth required, but checks if admin already exists
router.post('/staff', authenticate, authorize('admin'), createStaffValidator, validate, createStaff);
router.get('/staff', authenticate, authorize('admin'), getAllStaff);
router.get('/staff/:id', authenticate, authorize('admin'), getStaffById);
router.put('/staff/:id', authenticate, authorize('admin'), updateStaff);
router.put('/staff/:id/status', authenticate, authorize('admin'), toggleStaffStatus);
router.delete('/staff/:id', authenticate, authorize('admin'), deleteStaff);

router.post('/register', registerValidator, validate, register);
router.post('/login', loginValidator, validate, login);
router.post('/forgot-password', forgotPasswordValidator, validate, forgotPassword);
router.post('/reset-password', resetPasswordValidator, validate, resetPassword);

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

// Members management (admin only)
router.get('/members', authenticate, authorize('admin'), getAllMembers);
router.put('/members/:id/status', authenticate, authorize('admin'), toggleMemberStatus);

router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfileValidator, validate, updateProfile);
router.post('/profile/avatar', authenticate, uploadAvatar.single('avatar'), uploadProfileAvatar);
router.put('/change-password', authenticate, changePasswordValidator, validate, changePassword);
router.put('/set-password', authenticate, setPasswordValidator, validate, setPassword);

export default router;
