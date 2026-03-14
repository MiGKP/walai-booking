import { body, param } from 'express-validator';

// ─── Auth ────────────────────────────────────────────────────────────────────

export const registerValidator = [
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone('any')
    .withMessage('Invalid phone number'),
  body('line_id').optional({ nullable: true, checkFalsy: true }).trim(),
  body('facebook').optional({ nullable: true, checkFalsy: true }).trim(),
];

export const loginValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

export const forgotPasswordValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
];

export const resetPasswordValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('otp')
    .trim()
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('OTP must be a 6-digit number'),
  body('new_password')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters'),
];

export const updateProfileValidator = [
  body('first_name').trim().notEmpty().withMessage('First name is required'),
  body('last_name').trim().notEmpty().withMessage('Last name is required'),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone('any')
    .withMessage('Invalid phone number'),
  body('line_id').optional({ nullable: true, checkFalsy: true }).trim(),
  body('facebook').optional({ nullable: true, checkFalsy: true }).trim(),
];

export const changePasswordValidator = [
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters'),
];

export const setPasswordValidator = [
  body('new_password')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters'),
];

export const createStaffValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('role')
    .isIn(['admin', 'room_staff', 'boat_staff'])
    .withMessage('Role must be admin, room_staff, or boat_staff'),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone('any')
    .withMessage('Invalid phone number'),
];

// ─── Room Booking ─────────────────────────────────────────────────────────────

export const createRoomBookingValidator = [
  body('room_type_id').isInt({ min: 1 }).withMessage('Valid room_type_id is required'),
  body('check_in_date').isISO8601().withMessage('Valid check_in_date (ISO 8601) is required'),
  body('check_out_date')
    .isISO8601()
    .withMessage('Valid check_out_date (ISO 8601) is required')
    .custom((val, { req }) => {
      if (new Date(val) <= new Date(req.body.check_in_date)) {
        throw new Error('check_out_date must be after check_in_date');
      }
      return true;
    }),
  body('guests').isInt({ min: 1, max: 20 }).withMessage('Guests must be between 1 and 20'),
  body('special_requests').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Special requests cannot exceed 500 characters'),
  body('promotion_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Invalid promotion_id'),
];

export const updateRoomBookingStatusValidator = [
  param('id').isInt({ min: 1 }).withMessage('Valid booking ID is required'),
  body('status')
    .isIn(['approved', 'rejected', 'pending', 'cancelled'])
    .withMessage('Status must be approved, rejected, pending, or cancelled'),
];

// ─── Kayak Booking ────────────────────────────────────────────────────────────

export const createKayakBookingValidator = [
  body('kayak_id').isInt({ min: 1 }).withMessage('Valid kayak_id is required'),
  body('booking_date').isISO8601().withMessage('Valid booking_date (ISO 8601) is required'),
  body('boat_round_id').isInt({ min: 1 }).withMessage('Valid boat_round_id is required'),
  body('num_passengers').optional().isInt({ min: 1, max: 10 }).withMessage('num_passengers must be between 1 and 10'),
];

export const updateKayakBookingStatusValidator = [
  param('id').isInt({ min: 1 }).withMessage('Valid booking ID is required'),
  body('status')
    .isIn(['approved', 'rejected', 'pending'])
    .withMessage('Status must be approved, rejected, or pending'),
];

export const createKayakValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('capacity').isInt({ min: 1, max: 10 }).withMessage('Capacity must be between 1 and 10'),
  body('price_per_hour').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('description').optional({ nullable: true, checkFalsy: true }).trim(),
];

export const createBoatRoundValidator = [
  body('boat_type_id').isInt({ min: 1 }).withMessage('Valid boat_type_id is required'),
  body('start_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('start_time must be in HH:MM format'),
  body('end_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('end_time must be in HH:MM format'),
  body('max_booking').optional({ nullable: true }).isInt({ min: 1 }).withMessage('max_booking must be a positive integer'),
];

// ─── Payment ──────────────────────────────────────────────────────────────────

export const createPaymentValidator = [
  body('booking_type')
    .isIn(['room', 'kayak'])
    .withMessage('booking_type must be room or kayak'),
  body('booking_id').isInt({ min: 1 }).withMessage('Valid booking_id is required'),
];
