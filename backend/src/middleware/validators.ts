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

export const initAdminValidator = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters'),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone('any')
    .withMessage('Invalid phone number'),
];

// ─── Room Booking ─────────────────────────────────────────────────────────────

export const createRoomBookingValidator = [
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
  body('items').optional().isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.room_type_id').optional().isInt({ min: 1 }).withMessage('Valid room_type_id is required'),
  body('items.*.quantity').optional().isInt({ min: 1, max: 20 }).withMessage('quantity must be 1-20'),
  body('room_type_id').optional().isInt({ min: 1 }).withMessage('Valid room_type_id is required'),
  body('guests').optional().isInt({ min: 1, max: 50 }).withMessage('Guests must be between 1 and 50'),
  body('adults').optional().isInt({ min: 1, max: 50 }).withMessage('adults must be between 1 and 50'),
  body('children').optional().isInt({ min: 0, max: 50 }).withMessage('children must be between 0 and 50'),
  body('special_requests').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Special requests cannot exceed 500 characters'),
  body('promotion_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Invalid promotion_id'),
  body().custom((_, { req }) => {
    const hasItems = Array.isArray(req.body.items) && req.body.items.length > 0;
    const hasType = req.body.room_type_id != null;
    if (!hasItems && !hasType) {
      throw new Error('items or room_type_id is required');
    }
    if (req.body.guests == null && req.body.adults == null) {
      throw new Error('adults or guests is required');
    }
    return true;
  }),
];

export const updateRoomBookingStatusValidator = [
  param('id').isInt({ min: 1 }).withMessage('Valid booking ID is required'),
  body('status')
    .isIn(['approved', 'rejected', 'pending', 'cancelled'])
    .withMessage('Status must be approved, rejected, pending, or cancelled'),
];

// ─── Kayak Booking ────────────────────────────────────────────────────────────

export const createKayakBookingValidator = [
  body('booking_date').isISO8601().withMessage('Valid booking_date (ISO 8601) is required'),
  body('items').optional().isArray({ min: 1 }).withMessage('items must be a non-empty array'),
  body('items.*.boat_type_id').optional().isInt({ min: 1 }).withMessage('Valid boat_type_id is required'),
  body('items.*.num_passengers')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('num_passengers must be between 1 and 50'),
  body('kayak_id').optional().isInt({ min: 1 }).withMessage('Valid kayak_id is required'),
  body('boat_round_id').optional().isInt({ min: 1 }).withMessage('Valid boat_round_id is required'),
  body('num_passengers').optional().isInt({ min: 1, max: 50 }).withMessage('num_passengers must be between 1 and 50'),
  body('start_time')
    .optional()
    .matches(/^\d{2}:\d{2}(:\d{2})?$/)
    .withMessage('start_time must be in HH:MM or HH:MM:SS format'),
  body('end_time')
    .optional()
    .matches(/^\d{2}:\d{2}(:\d{2})?$/)
    .withMessage('end_time must be in HH:MM or HH:MM:SS format'),
  body().custom((_, { req }) => {
    const hasItems = Array.isArray(req.body.items) && req.body.items.length > 0;
    const hasLegacy = req.body.kayak_id != null && req.body.boat_round_id != null;
    if (!hasItems && !hasLegacy) {
      throw new Error('items or (kayak_id + boat_round_id) is required');
    }
    if (hasItems) {
      const hasTimes = req.body.start_time != null && req.body.end_time != null;
      const hasRound = req.body.boat_round_id != null;
      if (!hasTimes && !hasRound) {
        throw new Error('start_time/end_time or boat_round_id is required with items');
      }
    }
    return true;
  }),
];

export const updateKayakBookingStatusValidator = [
  param('id').isInt({ min: 1 }).withMessage('Valid booking ID is required'),
  body('status')
    .isIn(['approved', 'rejected', 'pending', 'checked_out'])
    .withMessage('Status must be approved, rejected, pending, or checked_out'),
];

export const createKayakValidator = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('capacity').isInt({ min: 1, max: 10 }).withMessage('Capacity must be between 1 and 10'),
  body('price_per_hour').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('description').optional({ nullable: true, checkFalsy: true }).trim(),
];

export const createBoatRoundValidator = [
  body('start_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('start_time must be in HH:MM format'),
  body('end_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('end_time must be in HH:MM format'),
  body('boats').optional().isArray({ min: 1 }).withMessage('boats must be a non-empty array'),
  body('boats.*.boat_type_id').optional().isInt({ min: 1 }).withMessage('Valid boat_type_id is required'),
  body('boats.*.quantity').optional().isInt({ min: 1 }).withMessage('quantity must be at least 1'),
  body('boat_type_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Valid boat_type_id is required'),
  body('total_slots').optional({ nullable: true }).isInt({ min: 1 }).withMessage('total_slots must be a positive integer'),
  body('max_booking').optional({ nullable: true }).isInt({ min: 1 }).withMessage('max_booking must be a positive integer'),
  body().custom((_, { req }) => {
    const hasBoats = Array.isArray(req.body.boats) && req.body.boats.length > 0;
    const hasLegacy = req.body.boat_type_id != null;
    if (!hasBoats && !hasLegacy) {
      throw new Error('boats or boat_type_id is required');
    }
    return true;
  }),
];

// ─── Payment ──────────────────────────────────────────────────────────────────

export const createPaymentValidator = [
  body('booking_type')
    .isIn(['room', 'kayak'])
    .withMessage('booking_type must be room or kayak'),
  body('booking_id').isInt({ min: 1 }).withMessage('Valid booking_id is required'),
];

// ─── Promotion ────────────────────────────────────────────────────────────────

export const createPromotionValidator = [
  body('code').trim().notEmpty().withMessage('Promotion code is required')
    .isLength({ min: 2, max: 50 }).withMessage('Code must be 2–50 characters'),
  body('name').trim().notEmpty().withMessage('Promotion name is required'),
  body('description').optional({ nullable: true, checkFalsy: true }).trim(),
  body('discount_type')
    .isIn(['percent', 'fixed'])
    .withMessage('discount_type must be percent or fixed'),
  body('discount_value')
    .isFloat({ min: 0 })
    .withMessage('discount_value must be a positive number'),
  body('min_nights').optional({ nullable: true }).isInt({ min: 1 }).withMessage('min_nights must be a positive integer'),
  body('min_price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('min_price must be a positive number'),
  body('max_discount').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('max_discount must be a positive number'),
  body('start_date').optional({ nullable: true }).isISO8601().withMessage('start_date must be a valid date'),
  body('end_date').optional({ nullable: true }).isISO8601().withMessage('end_date must be a valid date'),
  body('usage_limit').optional({ nullable: true }).isInt({ min: 1 }).withMessage('usage_limit must be a positive integer'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
];

export const updatePromotionValidator = [
  body('code').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Code must be 2–50 characters'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('description').optional({ nullable: true, checkFalsy: true }).trim(),
  body('discount_type').optional().isIn(['percent', 'fixed']).withMessage('discount_type must be percent or fixed'),
  body('discount_value').optional().isFloat({ min: 0 }).withMessage('discount_value must be a positive number'),
  body('min_nights').optional({ nullable: true }).isInt({ min: 1 }).withMessage('min_nights must be a positive integer'),
  body('min_price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('min_price must be a positive number'),
  body('max_discount').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('max_discount must be a positive number'),
  body('start_date').optional({ nullable: true }).isISO8601().withMessage('start_date must be a valid date'),
  body('end_date').optional({ nullable: true }).isISO8601().withMessage('end_date must be a valid date'),
  body('usage_limit').optional({ nullable: true }).isInt({ min: 1 }).withMessage('usage_limit must be a positive integer'),
  body('is_active').optional().isBoolean().withMessage('is_active must be a boolean'),
];

export const validatePromoCodeValidator = [
  body('code').trim().notEmpty().withMessage('Promotion code is required'),
  body('price').optional().isFloat({ min: 0 }).withMessage('price must be a positive number'),
  body('nights').optional().isInt({ min: 1 }).withMessage('nights must be a positive integer'),
];
