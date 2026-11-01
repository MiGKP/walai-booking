import pool from '../config/database';
import { remainingBoats, roundIncludesTypeSql, roundTypeQuantitySql, typeCapacity } from './round-boats';

export interface ReportRange { start: string; end: string; }

// สร้างนิพจน์ SQL คำนวณรายได้เฉพาะค่าห้องพักโดยหักยอดบัตรเสริมพายเรือออก
export const roomReportAmountSql = (alias: 'rb' | 'b'): string => `GREATEST(0, ${alias}.total_price - COALESCE((
  SELECT SUM(addon.total_price) FROM boat_bookings addon
  WHERE addon.room_booking_id = ${alias}.room_booking_id AND addon.is_addon = true
    AND addon.status NOT IN ('cancelled', 'rejected')
), 0))`;

// คำนวณช่วงวันที่เริ่มต้นและสิ้นสุดของรายงานแบบรายวันหรือรายเดือน
export const reportRange = (query: Record<string, unknown>): ReportRange => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  if (query.period !== undefined && query.period !== 'day' && query.period !== 'month') throw new Error('ช่วงรายงานไม่ถูกต้อง');
  if (query.period === 'day') {
    const date = query.date ?? today;
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('วันที่ไม่ถูกต้อง');
    const parsed = new Date(`${date}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error('วันที่ไม่ถูกต้อง');
    return { start: date, end: date };
  }
  const year = query.year ?? today.slice(0, 4);
  const month = query.month ?? today.slice(5, 7);
  if (!/^\d{4}$/.test(String(year)) || !/^\d{1,2}$/.test(String(month)) || Number(year) < 1970 || Number(year) > 2100 || Number(month) < 1 || Number(month) > 12) throw new Error('เดือนหรือปีไม่ถูกต้อง');
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = new Date(Date.UTC(Number(year), Number(month), 0)).toISOString().slice(0, 10);
  return { start, end };
};

// ดึงรายงานสถิติการใช้โปรโมชั่นและยอดรายได้ที่เกิดขึ้นในช่วงเวลาที่กำหนด
export const packageReport = async (range: ReportRange): Promise<Record<string, unknown>[]> => {
  const result = await pool.query(`WITH uses AS (
      SELECT DISTINCT room_booking_id, promotion_id FROM booking_room_promotions
      UNION SELECT DISTINCT room_booking_id, promotion_id FROM booking_promotions WHERE room_booking_id IS NOT NULL
      UNION SELECT room_booking_id, promotion_id FROM room_bookings WHERE promotion_id IS NOT NULL
    ), type_totals AS (
      SELECT br.room_booking_id, r.room_type_id, SUM(br.subtotal) AS gross
      FROM booking_room br JOIN rooms r ON r.room_id = br.room_id GROUP BY br.room_booking_id, r.room_type_id
    ), allocation AS (
      SELECT u.room_booking_id, u.promotion_id,
        CASE WHEN EXISTS (SELECT 1 FROM booking_room_promotions x WHERE x.room_booking_id = u.room_booking_id)
          THEN COALESCE((SELECT SUM(GREATEST(0, tt.gross - x.discount_amount))
            FROM booking_room_promotions x JOIN type_totals tt ON tt.room_booking_id = x.room_booking_id AND tt.room_type_id = x.room_type_id
            WHERE x.room_booking_id = u.room_booking_id AND x.promotion_id = u.promotion_id), 0)
          ELSE (${roomReportAmountSql('rb')}) / NULLIF((SELECT COUNT(*) FROM uses x WHERE x.room_booking_id = u.room_booking_id), 0) END AS revenue,
        rb.status, rb.created_at::date AS day
      FROM uses u JOIN room_bookings rb ON rb.room_booking_id = u.room_booking_id
      WHERE rb.created_at::date BETWEEN $1::date AND $2::date AND rb.status NOT IN ('cancelled', 'rejected')
    ), daily AS (
      SELECT promotion_id, day, COUNT(*) AS bookings FROM allocation GROUP BY promotion_id, day
    ), peaks AS (
      SELECT promotion_id, MAX(bookings) AS peak FROM daily GROUP BY promotion_id
    )
    SELECT p.id, p.name, p.code, COUNT(*)::int AS booking_count,
      COALESCE(SUM(a.revenue) FILTER (WHERE a.status IN ('approved', 'checked_out')), 0)::numeric AS revenue,
      (SELECT STRING_AGG(to_char(d.day, 'YYYY-MM-DD'), ', ' ORDER BY d.day) FROM daily d JOIN peaks k ON k.promotion_id = d.promotion_id
       WHERE d.promotion_id = p.id AND d.bookings = k.peak) AS peak_dates
    FROM allocation a JOIN promotions p ON p.id = a.promotion_id GROUP BY p.id, p.name, p.code ORDER BY booking_count DESC, p.id`, [range.start, range.end]);
  return result.rows;
};

// ดึงรายงานจำนวนห้องพักทั้งหมด ห้องที่ถูกจอง และห้องว่างรายวันแยกตามประเภทห้อง
export const roomInventoryReport = async (range: ReportRange): Promise<Record<string, unknown>[]> => {
  const result = await pool.query(`WITH days AS (SELECT generate_series($1::date, $2::date, interval '1 day')::date AS day)
    SELECT to_char(d.day, 'YYYY-MM-DD') AS date, rt.id AS room_type_id, rt.room_name AS type_name,
      COUNT(r.room_id)::int AS total, COUNT(r.room_id) FILTER (WHERE EXISTS (
        SELECT 1 FROM booking_room br JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
        WHERE br.room_id = r.room_id AND br.status NOT IN ('cancelled', 'rejected', 'checked_out')
          AND rb.check_in <= d.day AND rb.check_out > d.day
      ))::int AS booked
    FROM days d CROSS JOIN room_types rt LEFT JOIN rooms r ON r.room_type_id = rt.id AND r.status <> 'maintenance'
    WHERE rt.status = true GROUP BY d.day, rt.id, rt.room_name ORDER BY d.day, rt.id`, [range.start, range.end]);
  return result.rows.map(row => ({ ...row, available: Math.max(0, Number(row.total) - Number(row.booked)) }));
};

// ดึงรายงานจำนวนเรือทั้งหมด เรือที่ถูกจอง และเรือว่างรายวันแยกตามประเภทเรือและรอบเวลา
export const boatInventoryReport = async (range: ReportRange): Promise<Record<string, unknown>[]> => {
  const result = await pool.query(`WITH days AS (SELECT generate_series($1::date, $2::date, interval '1 day')::date AS day)
    SELECT DISTINCT ON (d.day, bt.boat_type_id, br.start_time, br.end_time)
      to_char(d.day, 'YYYY-MM-DD') AS date, bt.boat_type_id, bt.type_name, br.start_time::text, br.end_time::text,
      COALESCE(bt.quantity, 0) AS fleet, (${roundTypeQuantitySql('br', 'bt.boat_type_id')})::int AS round_qty, br.total_slots,
      COALESCE((SELECT SUM(line.boat_count) FROM booking_boat line
        JOIN boat_bookings bb ON bb.boat_booking_id = line.boat_booking_id JOIN boat_rounds slot ON slot.boat_round_id = line.boat_round_id
        WHERE bb.booking_date = d.day AND line.boat_type_id = bt.boat_type_id AND line.status NOT IN ('cancelled', 'rejected')
          AND slot.start_time = br.start_time AND slot.end_time = br.end_time), 0)::int AS booked,
      COALESCE((SELECT SUM(line.boat_count) FROM booking_boat line
        JOIN boat_bookings bb ON bb.boat_booking_id = line.boat_booking_id JOIN boat_rounds slot ON slot.boat_round_id = line.boat_round_id
        WHERE bb.booking_date = d.day AND line.status NOT IN ('cancelled', 'rejected')
          AND slot.start_time = br.start_time AND slot.end_time = br.end_time), 0)::int AS pool_booked
    FROM days d CROSS JOIN boat_types bt JOIN boat_rounds br ON ${roundIncludesTypeSql('br', 'bt.boat_type_id')}
    WHERE bt.is_active = true AND br.is_active = true
    ORDER BY d.day, bt.boat_type_id, br.start_time, br.end_time,
      (SELECT COUNT(*) FROM round_boats x WHERE x.boat_round_id = br.boat_round_id) DESC, br.boat_round_id`, [range.start, range.end]);
  return result.rows.map(row => ({ date: row.date, boat_type_id: row.boat_type_id, type_name: row.type_name,
    start_time: row.start_time, end_time: row.end_time, booked: Number(row.booked),
    total: typeCapacity(Number(row.fleet), row.round_qty),
    available: remainingBoats({ fleetQuantity: Number(row.fleet), roundQuantity: row.round_qty,
      typeBooked: Number(row.booked), totalSlots: row.total_slots, poolBooked: Number(row.pool_booked) }) }));
};
