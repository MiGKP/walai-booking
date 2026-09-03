import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
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
  initAdminValidator,
} from '../middleware/validators';
import { createImageUpload } from '../middleware/image-upload.middleware';

const router = Router();
const uploadAvatar = createImageUpload(5 * 1024 * 1024);

// Admin Staff Management
router.post('/init-admin', initAdminValidator, validate, initAdmin); // No auth required, but checks if admin already exists
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

const redirectGoogleFailure = (res: Response, code: string): void => {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${frontend}/auth/login?error=${encodeURIComponent(code)}`);
};

router.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    prompt: 'select_account',
  })
);
router.get(
  '/google/callback',
  (req: Request, res: Response, next: NextFunction): void => {
    // Custom callback: Passport `done(err)` would otherwise dump JSON 500 on this URL.
    passport.authenticate(
      'google',
      { session: false },
      (err: unknown, user: Express.User | false | undefined, info: unknown) => {
        if (err) {
          console.error('Google authenticate error:', err);
          redirectGoogleFailure(res, 'google_failed');
          return;
        }
        if (!user) {
          const message =
            info &&
            typeof info === 'object' &&
            'message' in info &&
            typeof (info as { message: unknown }).message === 'string'
              ? (info as { message: string }).message
              : 'google_failed';
          redirectGoogleFailure(res, message);
          return;
        }
        req.user = user;
        next();
      }
    )(req, res, next);
  },
  googleCallback
);
router.get('/google/failed', (req, res) => {
  const error = (req.query.error as string) || 'google_failed';
  redirectGoogleFailure(res, error);
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
