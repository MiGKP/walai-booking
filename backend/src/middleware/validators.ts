import { normalizeAuthEmail } from '../services/auth-email';
import { body, param, query } from 'express-validator';
import { validateNewPassword } from '../services/password-policy';

// ─── Auth ────────────────────────────────────────────────────────────────────

export const registerValidator = [
  body('first_name').trim().notEmpty().withMessage('กรุณากรอกชื่อ'),
  body('last_name').trim().notEmpty().withMessage('กรุณากรอกนามสกุล'),
  body('email').trim().isEmail().withMessage('กรุณากรอกอีเมลให้ถูกต้อง').customSanitizer(normalizeAuthEmail),
  body('password').custom(validateNewPassword),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone('any')
    .withMessage('เบอร์โทรศัพท์ไม่ถูกต้อง'),
  body('line_id').optional({ nullable: true, checkFalsy: true }).trim(),
  body('facebook').optional({ nullable: true, checkFalsy: true }).trim(),
];

export const loginValidator = [
  body('email').trim().isEmail().withMessage('กรุณากรอกอีเมลให้ถูกต้อง').customSanitizer(normalizeAuthEmail),
  body('password').isString().bail().notEmpty().withMessage('กรุณากรอกรหัสผ่าน'),
];

export const checkinRoomValidator = [
  param('bookingRoomId').isInt({ min: 1 }).withMessage('รหัสห้องที่จองไม่ถูกต้อง'),
  body('confirm_late_checkin').optional().custom((value: unknown) => typeof value === 'boolean')
    .withMessage('การยืนยันเช็คอินย้อนหลังต้องเป็น true หรือ false'),
];

export const forgotPasswordValidator = [
  body('account_type').optional().isIn(['customer', 'staff']).withMessage('ประเภทบัญชีไม่ถูกต้อง'),
  body('email').trim().isEmail().withMessage('กรุณากรอกอีเมลให้ถูกต้อง').customSanitizer(normalizeAuthEmail),
];

export const resetPasswordValidator = [
  body('account_type').optional().isIn(['customer', 'staff']).withMessage('ประเภทบัญชีไม่ถูกต้อง'),
  body('email').trim().isEmail().withMessage('กรุณากรอกอีเมลให้ถูกต้อง').customSanitizer(normalizeAuthEmail),
  body('otp')
    .trim()
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('รหัส OTP ต้องเป็นตัวเลข 6 หลัก'),
  body('new_password').custom(validateNewPassword),
];

export const updateProfileValidator = [
  body('email').optional().isString().bail().trim().isEmail().isLength({ max: 100 }).customSanitizer(normalizeAuthEmail),
  body('address').optional({ nullable: true }).isString().bail().trim().isLength({ max: 2000 }),
  body('current_password').optional().isString().bail().isLength({ max: 200 }),
  body('first_name').isString().bail().trim().notEmpty().withMessage('กรุณากรอกชื่อ').isLength({ max: 100 }),
  body('last_name').optional({ nullable: true }).isString().bail().trim().isLength({ max: 100 }),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone('any')
    .withMessage('เบอร์โทรศัพท์ไม่ถูกต้อง'),
  body('line_id').optional({ nullable: true, checkFalsy: true }).isString().bail().trim().isLength({ max: 100 }),
  body('facebook').optional({ nullable: true, checkFalsy: true }).isString().bail().trim().isLength({ max: 255 }),
];

export const changePasswordValidator = [
  body('current_password').notEmpty().withMessage('กรุณากรอกรหัสผ่านปัจจุบัน'),
  body('new_password').custom(validateNewPassword),
];

export const setPasswordValidator = [
  body('new_password').custom(validateNewPassword),
];

export const createStaffValidator = [
  body('name').trim().notEmpty().withMessage('กรุณากรอกชื่อ'),
  body('email').trim().isEmail().withMessage('กรุณากรอกอีเมลให้ถูกต้อง').customSanitizer(normalizeAuthEmail),
  body('password')
    .custom((val, { req }) => {
      const pwd = val === undefined || val === null || val === '' ? req.body.phone : val;
      return validateNewPassword(pwd);
    }),
  body('role')
    .isIn(['admin', 'room_staff', 'boat_staff'])
    .withMessage('Role must be admin, room_staff, or boat_staff'),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone('any')
    .withMessage('เบอร์โทรศัพท์ไม่ถูกต้อง'),
];

export const initAdminValidator = [
  body('email').trim().isEmail().withMessage('กรุณากรอกอีเมลให้ถูกต้อง').customSanitizer(normalizeAuthEmail),
  body('password').custom(validateNewPassword),
  body('phone')
    .optional({ nullable: true, checkFalsy: true })
    .isMobilePhone('any')
    .withMessage('เบอร์โทรศัพท์ไม่ถูกต้อง'),
];

// ─── Room Booking ─────────────────────────────────────────────────────────────

const MAX_ROOM_NIGHTS = 30;

export const createRoomBookingValidator = [
  body('guest_name').optional({ nullable: true, checkFalsy: true }).trim().isLength({ min: 1, max: 200 }),
  body('guest_phone').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 30 }).isMobilePhone('any'),
  body('guest_email').optional({ nullable: true, checkFalsy: true }).trim().isEmail().isLength({ max: 254 }),
  body('check_in_date').isISO8601().withMessage('กรุณาเลือกวันเช็คอินให้ถูกต้อง'),
  body('check_out_date')
    .isISO8601()
    .withMessage('กรุณาเลือกวันเช็คเอาต์ให้ถูกต้อง')
    .custom((val, { req }) => {
      if (new Date(val) <= new Date(req.body.check_in_date)) {
        throw new Error('วันเช็คเอาต์ต้องอยู่หลังวันเช็คอิน');
      }
      const nights = Math.round((new Date(val).getTime() - new Date(req.body.check_in_date).getTime()) / 86400000);
      if (nights > MAX_ROOM_NIGHTS) {
        throw new Error(`จองได้สูงสุด ${MAX_ROOM_NIGHTS} คืนต่อครั้ง`);
      }
      return true;
    }),
  body('items').optional().isArray({ min: 1 }).withMessage('กรุณาเลือกห้องอย่างน้อย 1 รายการ'),
  body('items.*.room_type_id').optional().isInt({ min: 1 }).withMessage('ประเภทห้องไม่ถูกต้อง'),
  body('items.*.quantity').optional().isInt({ min: 1, max: 20 }).withMessage('จำนวนห้องต้องอยู่ระหว่าง 1-20'),
  body('items.*.promotion_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('โปรโมชั่นไม่ถูกต้อง'),
  body('items.*.room_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('Invalid room_id'),
  body('room_type_id').optional().isInt({ min: 1 }).withMessage('ประเภทห้องไม่ถูกต้อง'),
  body('guests').optional().isInt({ min: 1, max: 50 }).withMessage('จำนวนผู้เข้าพักต้องอยู่ระหว่าง 1-50 คน'),
  body('adults').optional().isInt({ min: 1, max: 50 }).withMessage('จำนวนผู้ใหญ่ต้องอยู่ระหว่าง 1-50 คน'),
  body('children').optional().isInt({ min: 0, max: 50 }).withMessage('จำนวนเด็กต้องอยู่ระหว่าง 0-50 คน'),
  body('child_ages').optional().isArray().withMessage('child_ages must be an array'),
  body('child_ages.*').optional().isInt({ min: 0, max: 11 }).withMessage('อายุเด็กแต่ละคนต้องอยู่ระหว่าง 0-11 ปี'),
  body('special_requests').optional({ nullable: true, checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('คำขอพิเศษต้องไม่เกิน 500 ตัวอักษร'),
  body('arrival_time').optional({ nullable: true, checkFalsy: true }).matches(/^([01]\d|2[0-3]):[0-5]\d$/).withMessage('เวลาถึงต้องอยู่ในรูปแบบ HH:MM (24 ชั่วโมง)'),
  body('promotion_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('โปรโมชั่นไม่ถูกต้อง'),
  body('promotion_ids').optional().isArray(),
  body('promotion_ids.*').optional().isInt({ min: 1 }),
  body().custom((_, { req }) => {
    const hasItems = Array.isArray(req.body.items) && req.body.items.length > 0;
    const hasType = req.body.room_type_id != null;
    if (!hasItems && !hasType) {
      throw new Error('กรุณาเลือกประเภทห้อง');
    }
    if (req.body.guests == null && req.body.adults == null) {
      throw new Error('กรุณาระบุจำนวนผู้เข้าพัก');
    }
    return true;
  }),
];

export const resortInfoValidator = [
  body('id').optional().isInt({ min: 3, max: 5 }).withMessage('Invalid resort id'),
  body('infant_max_age_exclusive').optional().isInt({ min: 0, max: 18 })
    .withMessage('อายุที่เริ่มนับความจุต้องเป็นจำนวนเต็ม 0-18 ปี'),
  body('boat_advance_booking_minutes').optional().isInt({ min: 0, max: 10080 })
    .withMessage('จองล่วงหน้าขั้นต่ำต้องเป็นจำนวนเต็ม 0-10080 นาที'),
  body('boat_checkin_advance_minutes').optional().isInt({ min: 0, max: 1440 })
    .withMessage('เวลาเช็คอินล่วงหน้าต้องเป็นจำนวนเต็ม 0-1440 นาที'),
  body('room_max_advance_days').optional().isInt({ min: 1, max: 730 })
    .withMessage('จองห้องพักล่วงหน้าต้องเป็นจำนวนเต็ม 1-730 วัน'),
  body('boat_max_advance_days').optional().isInt({ min: 1, max: 365 })
    .withMessage('จองเรือล่วงหน้าต้องเป็นจำนวนเต็ม 1-365 วัน'),
];

export const updateRoomBookingStatusValidator = [
  param('id').isInt({ min: 1 }).withMessage('รหัสรายการจองไม่ถูกต้อง'),
  body('status')
    .isIn(['approved', 'rejected', 'pending', 'cancelled'])
    .withMessage('สถานะต้องเป็น approved, rejected, pending หรือ cancelled'),
  body('reject_reason').if(body('status').equals('rejected'))
    .isString().withMessage('กรุณาระบุเหตุผลที่ปฏิเสธ').bail().trim()
    .notEmpty().withMessage('กรุณาระบุเหตุผลที่ปฏิเสธ')
    .isLength({ max: 500 }).withMessage('เหตุผลต้องไม่เกิน 500 ตัวอักษร'),
];

// ─── Kayak Booking ────────────────────────────────────────────────────────────

export const createKayakBookingValidator = [
  body('booking_date').isISO8601().withMessage('กรุณาเลือกวันที่จองให้ถูกต้อง'),
  body('items').optional().isArray({ min: 1 }).withMessage('กรุณาเลือกห้องอย่างน้อย 1 รายการ'),
  body('items.*.boat_type_id').optional().isInt({ min: 1 }).withMessage('ประเภทเรือไม่ถูกต้อง'),
  body('items.*.num_passengers')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('จำนวนผู้โดยสารต้องอยู่ระหว่าง 1-50 คน'),
  body('kayak_id').optional().isInt({ min: 1 }).withMessage('ประเภทพายไม่ถูกต้อง'),
  body('boat_round_id').optional().isInt({ min: 1 }).withMessage('รอบเรือไม่ถูกต้อง'),
  body('num_passengers').optional().isInt({ min: 1, max: 50 }).withMessage('จำนวนผู้โดยสารต้องอยู่ระหว่าง 1-50 คน'),
  body('start_time')
    .optional()
    .matches(/^\d{2}:\d{2}(:\d{2})?$/)
    .withMessage('เวลาเริ่มต้องอยู่ในรูปแบบ HH:MM'),
  body('end_time')
    .optional()
    .matches(/^\d{2}:\d{2}(:\d{2})?$/)
    .withMessage('เวลาสิ้นสุดต้องอยู่ในรูปแบบ HH:MM'),
  body('promotion_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('โปรโมชั่นไม่ถูกต้อง'),
  body('promotion_ids').optional().isArray(),
  body('promotion_ids.*').optional().isInt({ min: 1 }),
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
  param('id').isInt({ min: 1 }).withMessage('รหัสรายการจองไม่ถูกต้อง'),
  body('status')
    .isIn(['approved', 'rejected', 'pending', 'checked_out'])
    .withMessage('สถานะต้องเป็น approved, rejected, pending หรือ checked_out'),
  body('reject_reason').if(body('status').equals('rejected'))
    .isString().withMessage('กรุณาระบุเหตุผลที่ปฏิเสธ').bail().trim()
    .notEmpty().withMessage('กรุณาระบุเหตุผลที่ปฏิเสธ')
    .isLength({ max: 500 }).withMessage('เหตุผลต้องไม่เกิน 500 ตัวอักษร'),
];

export const kayakCheckinSessionsValidator = [
  query('date').optional().isString().bail().isISO8601({ strict: true }).matches(/^\d{4}-\d{2}-\d{2}$/),
  query('search').optional().isString().trim().isLength({ max: 100 }),
];

export const checkinKayakBookingValidator = [
  param('id').isInt({ min: 1 }).withMessage('รหัสรายการจองไม่ถูกต้อง'),
];

export const createKayakValidator = [
  body('name').trim().notEmpty().withMessage('กรุณากรอกชื่อ'),
  body('capacity').isInt({ min: 1, max: 10 }).withMessage('จำนวนที่นั่งต้องอยู่ระหว่าง 1-10'),
  body('price_per_hour').isFloat({ min: 0 }).withMessage('ราคาต้องเป็นตัวเลขที่ไม่ติดลบ'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('จำนวนต้องไม่น้อยกว่า 1'),
  body('description').optional({ nullable: true, checkFalsy: true }).trim(),
];

export const updateKayakValidator = [
  body('name').optional().trim().notEmpty().withMessage('ชื่อต้องไม่ว่าง'),
  body('capacity').optional().isInt({ min: 1, max: 10 }).withMessage('จำนวนที่นั่งต้องอยู่ระหว่าง 1-10'),
  body('seat_count').optional().isInt({ min: 1, max: 10 }).withMessage('จำนวนที่นั่งต้องอยู่ระหว่าง 1-10'),
  body('price_per_hour').optional().isFloat({ min: 0 }).withMessage('ราคาต้องเป็นตัวเลขที่ไม่ติดลบ'),
  body('price').optional().isFloat({ min: 0 }).withMessage('ราคาต้องเป็นตัวเลขที่ไม่ติดลบ'),
  body('quantity').optional().isInt({ min: 1 }).withMessage('จำนวนต้องไม่น้อยกว่า 1'),
];

export const createBoatRoundValidator = [
  body('start_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('เวลาเริ่มต้องอยู่ในรูปแบบ HH:MM'),
  body('end_time').matches(/^\d{2}:\d{2}(:\d{2})?$/).withMessage('เวลาสิ้นสุดต้องอยู่ในรูปแบบ HH:MM'),
  body('boats').optional().isArray({ min: 1 }).withMessage('กรุณาเลือกเรืออย่างน้อย 1 ลำ'),
  body('boats.*.boat_type_id').optional().isInt({ min: 1 }).withMessage('ประเภทเรือไม่ถูกต้อง'),
  body('boats.*.quantity').optional().isInt({ min: 1 }).withMessage('จำนวนต้องไม่น้อยกว่า 1'),
  body('boat_type_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('ประเภทเรือไม่ถูกต้อง'),
  body('total_slots').optional({ nullable: true }).isInt({ min: 1 }).withMessage('จำนวนที่นั่งรวมต้องเป็นจำนวนเต็มบวก'),
  body('max_booking').optional({ nullable: true }).isInt({ min: 1 }).withMessage('จำนวนจองสูงสุดต้องเป็นจำนวนเต็มบวก'),
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
    .withMessage('ประเภทการจองต้องเป็น room หรือ kayak'),
  body('booking_id').isInt({ min: 1 }).withMessage('รหัสรายการจองไม่ถูกต้อง'),
];

// ─── Promotion ────────────────────────────────────────────────────────────────

export const createPromotionValidator = [
  body('code').trim().notEmpty().withMessage('กรุณากรอกโค้ดโปรโมชั่น')
    .isLength({ min: 2, max: 50 }).withMessage('Code must be 2–50 characters'),
  body('name').trim().notEmpty().withMessage('กรุณากรอกชื่อโปรโมชั่น'),
  body('description').optional({ nullable: true, checkFalsy: true }).trim(),
  body('discount_type')
    .isIn(['percent', 'fixed'])
    .withMessage('ประเภทส่วนลดต้องเป็น percent หรือ fixed'),
  body('discount_value')
    .isFloat({ min: 0 })
    .withMessage('มูลค่าส่วนลดต้องเป็นตัวเลขที่ไม่ติดลบ'),
  body('min_nights').optional({ nullable: true }).isInt({ min: 1 }).withMessage('จำนวนคืนขั้นต่ำต้องเป็นจำนวนเต็มบวก'),
  body('min_price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('ราคาขั้นต่ำต้องเป็นตัวเลขที่ไม่ติดลบ'),
  body('max_discount').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('ส่วนลดสูงสุดต้องเป็นตัวเลขที่ไม่ติดลบ'),
  body('start_date').optional({ nullable: true }).isISO8601().withMessage('วันเริ่มต้องเป็นวันที่ที่ถูกต้อง'),
  body('end_date').optional({ nullable: true }).isISO8601().withMessage('วันสิ้นสุดต้องเป็นวันที่ที่ถูกต้อง'),
  body('usage_limit').optional({ nullable: true }).isInt({ min: 1 }).withMessage('จำนวนสิทธิ์รวมต้องเป็นจำนวนเต็มบวก'),
  body('usage_limit_per_member').optional({ nullable: true }).isInt({ min: 1 }).withMessage('จำนวนสิทธิ์ต่อสมาชิกต้องเป็นจำนวนเต็มบวก'),
  body('is_collectible').optional().isBoolean().withMessage('ค่าการเก็บคูปองไม่ถูกต้อง'),
  body('stackable').optional().isBoolean().withMessage('ค่าการใช้ร่วมกันไม่ถูกต้อง'),
  body('applies_to').optional().isIn(['room', 'kayak', 'both']).withMessage('ประเภทที่ใช้ได้ต้องเป็น room, kayak หรือ both'),
  body('is_active').optional().isBoolean().withMessage('ค่าสถานะเปิดใช้งานไม่ถูกต้อง'),
  body('room_type_ids').optional({ nullable: true }).isArray().withMessage('room_type_ids ต้องเป็น array'),
  body('room_type_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('รหัสประเภทห้องต้องเป็นจำนวนเต็มบวก'),
  body('room_type_ids.*').optional().isInt({ min: 1 }).withMessage('รหัสประเภทห้องต้องเป็นจำนวนเต็มบวก'),
  body('boat_ticket_count').optional({ nullable: true }).isInt({ min: 0 }).withMessage('จำนวนตั๋วเรือต้องไม่น้อยกว่า 0'),
  body('boat_addon_price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('ราคาเรือเสริมต้องไม่น้อยกว่า 0'),
];

export const updatePromotionValidator = [
  body('code').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Code must be 2–50 characters'),
  body('name').optional().trim().notEmpty().withMessage('ชื่อต้องไม่ว่าง'),
  body('description').optional({ nullable: true, checkFalsy: true }).trim(),
  body('discount_type').optional().isIn(['percent', 'fixed']).withMessage('ประเภทส่วนลดต้องเป็น percent หรือ fixed'),
  body('discount_value').optional().isFloat({ min: 0 }).withMessage('มูลค่าส่วนลดต้องเป็นตัวเลขที่ไม่ติดลบ'),
  body('min_nights').optional({ nullable: true }).isInt({ min: 1 }).withMessage('จำนวนคืนขั้นต่ำต้องเป็นจำนวนเต็มบวก'),
  body('min_price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('ราคาขั้นต่ำต้องเป็นตัวเลขที่ไม่ติดลบ'),
  body('max_discount').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('ส่วนลดสูงสุดต้องเป็นตัวเลขที่ไม่ติดลบ'),
  body('start_date').optional({ nullable: true }).isISO8601().withMessage('วันเริ่มต้องเป็นวันที่ที่ถูกต้อง'),
  body('end_date').optional({ nullable: true }).isISO8601().withMessage('วันสิ้นสุดต้องเป็นวันที่ที่ถูกต้อง'),
  body('usage_limit').optional({ nullable: true }).isInt({ min: 1 }).withMessage('จำนวนสิทธิ์รวมต้องเป็นจำนวนเต็มบวก'),
  body('usage_limit_per_member').optional({ nullable: true }).isInt({ min: 1 }).withMessage('จำนวนสิทธิ์ต่อสมาชิกต้องเป็นจำนวนเต็มบวก'),
  body('is_collectible').optional().isBoolean().withMessage('ค่าการเก็บคูปองไม่ถูกต้อง'),
  body('stackable').optional().isBoolean().withMessage('ค่าการใช้ร่วมกันไม่ถูกต้อง'),
  body('applies_to').optional().isIn(['room', 'kayak', 'both']).withMessage('ประเภทที่ใช้ได้ต้องเป็น room, kayak หรือ both'),
  body('is_active').optional().isBoolean().withMessage('ค่าสถานะเปิดใช้งานไม่ถูกต้อง'),
  body('room_type_ids').optional({ nullable: true }).isArray().withMessage('room_type_ids ต้องเป็น array'),
  body('room_type_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('รหัสประเภทห้องต้องเป็นจำนวนเต็มบวก'),
  body('room_type_ids.*').optional().isInt({ min: 1 }).withMessage('รหัสประเภทห้องต้องเป็นจำนวนเต็มบวก'),
  body('boat_ticket_count').optional({ nullable: true }).isInt({ min: 0 }).withMessage('จำนวนตั๋วเรือต้องไม่น้อยกว่า 0'),
  body('boat_addon_price').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('ราคาเรือเสริมต้องไม่น้อยกว่า 0'),
];

export const promotionIdParamValidator = [
  param('id').isInt({ min: 1 }).withMessage('รหัสโปรโมชั่นไม่ถูกต้อง'),
];

export const validatePromoCodeValidator = [
  body('code').optional({ checkFalsy: true }).trim(),
  body('promotion_ids').optional().isArray(),
  body('promotion_ids.*').optional().isInt({ min: 1 }),
  body('price').optional().isFloat({ min: 0 }).withMessage('ราคาต้องเป็นตัวเลขที่ไม่ติดลบ'),
  body('nights').optional().isInt({ min: 1 }).withMessage('จำนวนคืนต้องเป็นจำนวนเต็มบวก'),
  body('room_type_id').optional({ nullable: true }).isInt({ min: 1 }),
  body('room_type_ids').optional().isArray({ min: 1 }),
  body('room_type_ids.*').optional().isInt({ min: 1 }),
  body('scope').notEmpty().withMessage('กรุณาระบุ scope (room หรือ kayak)').isIn(['room', 'kayak']).withMessage('scope ต้องเป็น room หรือ kayak'),
  body().custom((_, { req }) => {
    const code = req.body.code;
    const hasCode = typeof code === 'string' && code.trim().length > 0;
    const hasIds = Array.isArray(req.body.promotion_ids) && req.body.promotion_ids.length > 0;
    if (!hasCode && !hasIds) {
      throw new Error('กรุณากรอกโค้ดโปรโมชั่น');
    }
    return true;
  }),
];

// ─── Cancellation policy ──────────────────────────────────────────────────────

export const cancellationPolicyValidator = [
  body('full_refund_hours').optional().isInt({ min: 0, max: 8760 }).withMessage('full_refund_hours must be 0 to 8760'),
  body('late_refund_percent').optional().isFloat({ min: 0, max: 100 }).withMessage('late_refund_percent must be 0 to 100'),
  body('room_full_refund_days').optional().isInt({ min: 0, max: 365 }).withMessage('room_full_refund_days must be 0 to 365'),
  body('room_late_refund_percent').optional().isFloat({ min: 0, max: 100 }).withMessage('room_late_refund_percent must be 0 to 100'),
];
