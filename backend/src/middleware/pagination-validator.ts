import { query, ValidationChain } from 'express-validator';
import { parsePagination, positiveQueryInteger } from '../utils/pagination';

const integer = (name: string): ValidationChain => query(name).optional().custom((value: unknown) => {
  positiveQueryInteger(value);
  return true;
});
const text = (name: string): ValidationChain => query(name).optional().isString().bail().isLength({ max: 200 }).trim();

export const paginationValidator = [
  integer('page'),
  integer('limit'),
  query('page').optional().custom((_value: unknown, { req }) => {
    parsePagination(req.query ?? {});
    return true;
  }),
];
export const memberListValidator = [
  ...paginationValidator,
  text('search'),
  query('status').optional().isString().bail().isIn(['all', 'active', 'inactive']),
];
export const reviewListValidator = [
  ...paginationValidator,
  text('search'),
  integer('room_type_id'),
  integer('min_rating').bail().isInt({ min: 1, max: 5 }),
  integer('max_rating').bail().isInt({ min: 1, max: 5 }),
];
export const bookingListValidator = [
  ...paginationValidator,
  text('search'), text('room_type'), text('boat_type'),
  query('filter').optional().isString().bail().isIn(['all', 'has_slip', 'pending', 'approved', 'checked_out']),
  query('status').optional().isString().bail().isIn(['pending', 'paid', 'approved', 'rejected', 'cancelled', 'checked_out']),
  query('date_from').optional().isString().bail().isISO8601({ strict: true }).matches(/^\d{4}-\d{2}-\d{2}$/),
  query('date_to').optional().isString().bail().isISO8601({ strict: true }).matches(/^\d{4}-\d{2}-\d{2}$/),
  query('sort').optional().isString().bail().isIn(['check_in', 'created_at', 'total_price']),
  query('sort_dir').optional().isString().bail().isIn(['asc', 'desc']),
];
