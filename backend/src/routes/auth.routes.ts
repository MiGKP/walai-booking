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
  deleteAccount,
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

// เส้นทางจัดการบัญชีพนักงานสำหรับผู้ดูแลระบบ
router.post('/init-admin', initAdminValidator, validate, initAdmin);
router.post('/staff', authenticate, authorize('admin'), createStaffValidator, validate, createStaff);
router.get('/staff', authenticate, authorize('admin'), getAllStaff);
router.get('/staff/:id', authenticate, authorize('admin'), getStaffById);
router.put('/staff/:id', authenticate, authorize('admin'), updateStaff);
router.put('/staff/:id/status', authenticate, authorize('admin'), toggleStaffStatus);
router.patch('/staff/:id/status', authenticate, authorize('admin'), toggleStaffStatus);
router.delete('/staff/:id', authenticate, authorize('admin'), deleteStaff);

// รับไฟล์รูปโปรไฟล์ตอนสมัครสมาชิกและแนบลงใน req.file
const handleRegisterUpload = (req: Request, res: Response, next: NextFunction): void => {
  uploadAvatar.fields([{ name: 'avatar', maxCount: 1 }, { name: 'image_profile', maxCount: 1 }])(req, res, (err) => {
    if (err) {
      res.status(400).json({ success: false, message: err.message || 'ไฟล์รูปภาพไม่ถูกต้อง' });
      return;
    }
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    if (files) {
      req.file = files['avatar']?.[0] || files['image_profile']?.[0];
    }
    next();
  });
};

// เส้นทางสมัครสมาชิก เข้าสู่ระบบ และรีเซ็ตรหัสผ่าน
router.post('/register', handleRegisterUpload, registerValidator, validate, register);
router.post('/login', loginValidator, validate, login);
router.post('/forgot-password', forgotPasswordValidator, validate, forgotPassword);
router.post('/reset-password', resetPasswordValidator, validate, resetPassword);

// เปลี่ยนเส้นทางกลับไปยังหน้าเข้าสู่ระบบพร้อมรหัสข้อผิดพลาดเมื่อ Google OAuth ล้มเหลว
const redirectGoogleFailure = (res: Response, code: string): void => {
  const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
  res.redirect(`${frontend}/auth/login?error=${encodeURIComponent(code)}`);
};

// เส้นทางเข้าสู่ระบบผ่าน Google OAuth
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

// เส้นทางจัดการรายชื่อสมาชิกสำหรับผู้ดูแลระบบ
router.get('/members', authenticate, authorize('admin'), getAllMembers);
router.put('/members/:id/status', authenticate, authorize('admin'), toggleMemberStatus);

// เส้นทางจัดการโปรไฟล์และรหัสผ่านของผู้ใช้ที่เข้าสู่ระบบแล้ว
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfileValidator, validate, updateProfile);
router.post('/profile/avatar', authenticate, uploadAvatar.single('avatar'), uploadProfileAvatar);
router.put('/change-password', authenticate, changePasswordValidator, validate, changePassword);
router.put('/set-password', authenticate, setPasswordValidator, validate, setPassword);
router.delete('/account', authenticate, deleteAccount);

export default router;
