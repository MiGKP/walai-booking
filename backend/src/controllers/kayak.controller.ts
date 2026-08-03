import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthPayload } from '../types';
import { sendBookingConfirmationEmail, sendBookingStatusEmail } from '../services/mail.service';
import { deleteCloudinaryImage } from '../services/cloudinary.service';

// ดึงรายการประเภทเรือทั้งหมดที่เปิดใช้งานอยู่ พร้อมข้อมูลที่ frontend ใช้แสดง เช่น ความจุ ราคา และรูปหลัก
export const getAllKayaks = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT bt.boat_type_id as id, bt.type_name as name, bt.description, 
             bt.seat_count as capacity, bt.price as price_per_hour, bt.quantity, bt.is_active,
             (SELECT image_path FROM boat_images bi WHERE bi.boat_type_id = bt.boat_type_id LIMIT 1) as image
      FROM boat_types bt 
      WHERE bt.is_active = true
      ORDER BY bt.price ASC
    `);
    
    // Map to expected frontend structure temporarily
    const mapped = result.rows.map(row => ({
      ...row,
      type: row.capacity === 1 ? 'single' : row.capacity === 2 ? 'double' : 'tandem',
      is_available: row.quantity > 0
    }));
    
    res.json({ success: true, data: mapped });
  } catch (error) {
    console.error('Get kayaks error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรายละเอียดของเรือรายประเภทตาม id เพื่อใช้ในหน้ารายรายละเอียดก่อนตัดสินใจจอง
export const getKayakById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT bt.boat_type_id as id, bt.type_name as name, bt.description, 
             bt.seat_count as capacity, bt.price as price_per_hour, bt.quantity,
             (SELECT json_agg(image_path) FROM boat_images bi WHERE bi.boat_type_id = bt.boat_type_id) as images
      FROM boat_types bt 
      WHERE bt.boat_type_id = $1
    `, [id]);
    
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Boat type not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get kayak error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ตรวจสอบความพร้อมใช้งานของเรือในวันและรอบเวลาที่เลือก โดยเทียบจำนวนที่ถูกจองไปแล้วกับจำนวนเรือทั้งหมด
export const checkKayakAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { kayak_id, booking_date, boat_round_id } = req.query;

    const [conflictRes, boatRes, roundRes, poolRes] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) as booked_count FROM boat_bookings
         WHERE boat_type_id = $1 AND booking_date = $2 AND boat_round_id = $3
         AND status NOT IN ('cancelled', 'rejected')`,
        [kayak_id, booking_date, boat_round_id]
      ),
      pool.query(`SELECT quantity FROM boat_types WHERE boat_type_id = $1`, [kayak_id]),
      pool.query(`SELECT total_slots, start_time, end_time FROM boat_rounds WHERE boat_round_id = $1`, [boat_round_id]),
      pool.query(
        `SELECT COUNT(*) as total_booked FROM boat_bookings
         WHERE booking_date = $1
         AND boat_round_id IN (
           SELECT boat_round_id FROM boat_rounds
           WHERE start_time = (SELECT start_time FROM boat_rounds WHERE boat_round_id = $2)
             AND end_time   = (SELECT end_time   FROM boat_rounds WHERE boat_round_id = $2)
         )
         AND status NOT IN ('cancelled', 'rejected')`,
        [booking_date, boat_round_id]
      ),
    ]);

    const booked = Number(conflictRes.rows[0].booked_count);
    const total = boatRes.rows[0]?.quantity || 0;
    const total_slots = roundRes.rows[0]?.total_slots ?? null;
    const pool_booked = Number(poolRes.rows[0].total_booked);

    const remaining_type = Math.max(0, total - booked);
    const remaining_pool = total_slots !== null ? Math.max(0, total_slots - pool_booked) : null;
    const remaining = remaining_pool !== null ? Math.min(remaining_type, remaining_pool) : remaining_type;

    res.json({
      success: true,
      data: {
        available: remaining > 0,
        remaining,
        total,
        booked,
        total_slots,
        pool_booked,
      },
    });
  } catch (error) {
    console.error('Check kayak availability error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const MAX_CALENDAR_DAYS = 62;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface KayakCalendarDay {
  date: string;
  rounds_total: number;
  rounds_available: number;
  is_full: boolean;
}

interface KayakRoundAvailability {
  boat_round_id: number;
  start_time: string;
  end_time: string;
  total: number;
  booked: number;
  remaining: number;
  total_slots: number | null;
  pool_booked: number;
  available: boolean;
}

// ดึงสถานะรายวันของเรือหนึ่งประเภทสำหรับปฏิทินจอง
export const getKayakCalendar = async (req: Request, res: Response): Promise<void> => {
  try {
    const { kayak_id, start, end } = req.query;

    const kayakId = Number(kayak_id);
    if (!Number.isInteger(kayakId) || kayakId <= 0) {
      res.status(400).json({ success: false, message: 'kayak_id ไม่ถูกต้อง', code: 'INVALID_KAYAK' });
      return;
    }

    if (typeof start !== 'string' || typeof end !== 'string' || !ISO_DATE_PATTERN.test(start) || !ISO_DATE_PATTERN.test(end)) {
      res.status(400).json({ success: false, message: 'start และ end ต้องเป็นวันที่รูปแบบ YYYY-MM-DD', code: 'INVALID_RANGE' });
      return;
    }

    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate < startDate) {
      res.status(400).json({ success: false, message: 'ช่วงวันที่ไม่ถูกต้อง', code: 'INVALID_RANGE' });
      return;
    }

    const spanDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    if (spanDays > MAX_CALENDAR_DAYS) {
      res.status(400).json({ success: false, message: `ขอข้อมูลได้ไม่เกิน ${MAX_CALENDAR_DAYS} วันต่อครั้ง`, code: 'RANGE_TOO_LARGE' });
      return;
    }

    const result = await pool.query(
      `WITH days AS (
         SELECT generate_series($2::date, $3::date, interval '1 day')::date AS day
       ),
       rounds AS (
         SELECT br.boat_round_id, br.start_time, br.end_time, br.total_slots
         FROM boat_rounds br
         WHERE br.is_active = true AND br.boat_type_id = $1::int
       ),
       stock AS (
         SELECT COALESCE(quantity, 0)::int AS quantity FROM boat_types WHERE boat_type_id = $1::int
       ),
       grid AS (
         SELECT
           d.day,
           r.boat_round_id,
           r.total_slots,
           (SELECT quantity FROM stock) AS quantity,
           COALESCE((
             SELECT COUNT(*) FROM boat_bookings bb
             WHERE bb.boat_type_id = $1::int
               AND bb.booking_date = d.day
               AND bb.boat_round_id = r.boat_round_id
               AND bb.status NOT IN ('cancelled', 'rejected')
           ), 0)::int AS type_booked,
           COALESCE((
             SELECT COUNT(*) FROM boat_bookings bb
             WHERE bb.booking_date = d.day
               AND bb.status NOT IN ('cancelled', 'rejected')
               AND bb.boat_round_id IN (
                 SELECT br2.boat_round_id FROM boat_rounds br2
                 WHERE br2.start_time = r.start_time AND br2.end_time = r.end_time
               )
           ), 0)::int AS pool_booked
         FROM days d
         CROSS JOIN rounds r
       )
       SELECT
         to_char(g.day, 'YYYY-MM-DD') AS date,
         COUNT(*)::int AS rounds_total,
         COUNT(*) FILTER (
           WHERE LEAST(
             GREATEST(g.quantity - g.type_booked, 0),
             CASE WHEN g.total_slots IS NULL THEN GREATEST(g.quantity - g.type_booked, 0)
                  ELSE GREATEST(g.total_slots - g.pool_booked, 0) END
           ) > 0
         )::int AS rounds_available
       FROM grid g
       GROUP BY g.day
       ORDER BY g.day`,
      [kayakId, start, end]
    );

    const byDate = new Map<string, KayakCalendarDay>();
    result.rows.forEach((row) => {
      const roundsAvailable = Number(row.rounds_available);
      byDate.set(String(row.date), {
        date: String(row.date),
        rounds_total: Number(row.rounds_total),
        rounds_available: roundsAvailable,
        is_full: roundsAvailable <= 0,
      });
    });

    const days: KayakCalendarDay[] = [];
    for (let cursor = new Date(startDate); cursor <= endDate; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const iso = cursor.toISOString().slice(0, 10);
      days.push(byDate.get(iso) ?? { date: iso, rounds_total: 0, rounds_available: 0, is_full: true });
    }

    res.json({ success: true, data: { start, end, kayak_id: kayakId, days } });
  } catch (error) {
    console.error('Get kayak calendar error:', error);
    res.status(500).json({ success: false, message: 'Internal server error', code: 'SERVER_ERROR' });
  }
};

// ดึงทุกรอบเวลาของวันที่เลือกพร้อมจำนวนที่เหลือ
export const getKayakDayRounds = async (req: Request, res: Response): Promise<void> => {
  try {
    const { kayak_id, booking_date } = req.query;

    const kayakId = Number(kayak_id);
    if (!Number.isInteger(kayakId) || kayakId <= 0) {
      res.status(400).json({ success: false, message: 'kayak_id ไม่ถูกต้อง', code: 'INVALID_KAYAK' });
      return;
    }

    if (typeof booking_date !== 'string' || !ISO_DATE_PATTERN.test(booking_date)) {
      res.status(400).json({ success: false, message: 'booking_date ต้องเป็นวันที่รูปแบบ YYYY-MM-DD', code: 'INVALID_DATE' });
      return;
    }

    const result = await pool.query(
      `WITH stock AS (
         SELECT COALESCE(quantity, 0)::int AS quantity FROM boat_types WHERE boat_type_id = $1::int
       )
       SELECT
         br.boat_round_id,
         br.start_time,
         br.end_time,
         br.total_slots,
         (SELECT quantity FROM stock) AS total,
         COALESCE((
           SELECT COUNT(*) FROM boat_bookings bb
           WHERE bb.boat_type_id = $1::int
             AND bb.booking_date = $2::date
             AND bb.boat_round_id = br.boat_round_id
             AND bb.status NOT IN ('cancelled', 'rejected')
         ), 0)::int AS booked,
         COALESCE((
           SELECT COUNT(*) FROM boat_bookings bb
           WHERE bb.booking_date = $2::date
             AND bb.status NOT IN ('cancelled', 'rejected')
             AND bb.boat_round_id IN (
               SELECT br2.boat_round_id FROM boat_rounds br2
               WHERE br2.start_time = br.start_time AND br2.end_time = br.end_time
             )
         ), 0)::int AS pool_booked
       FROM boat_rounds br
       WHERE br.is_active = true AND br.boat_type_id = $1::int
       ORDER BY br.start_time`,
      [kayakId, booking_date]
    );

    const rounds: KayakRoundAvailability[] = result.rows.map((row) => {
      const total = Number(row.total);
      const booked = Number(row.booked);
      const totalSlots = row.total_slots === null ? null : Number(row.total_slots);
      const poolBooked = Number(row.pool_booked);

      const remainingType = Math.max(0, total - booked);
      const remainingPool = totalSlots === null ? null : Math.max(0, totalSlots - poolBooked);
      const remaining = remainingPool === null ? remainingType : Math.min(remainingType, remainingPool);

      return {
        boat_round_id: Number(row.boat_round_id),
        start_time: String(row.start_time),
        end_time: String(row.end_time),
        total,
        booked,
        remaining,
        total_slots: totalSlots,
        pool_booked: poolBooked,
        available: remaining > 0,
      };
    });

    res.json({ success: true, data: { booking_date, kayak_id: kayakId, rounds } });
  } catch (error) {
    console.error('Get kayak day rounds error:', error);
    res.status(500).json({ success: false, message: 'Internal server error', code: 'SERVER_ERROR' });
  }
};

// ดึงรอบเวลาของเรือที่เปิดใช้งานอยู่
export const getKayakSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { kayak_id } = req.query;
    let query = `SELECT * FROM boat_rounds WHERE is_active = true`;
    const params = [];
    if (kayak_id) {
       query += ` AND boat_type_id = $1`;
       params.push(kayak_id);
    }
    query += ` ORDER BY start_time`;
    
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get kayak schedule error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// สร้างการจองเรือใหม่
export const createKayakBooking = async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const user = req.user as AuthPayload;
    const { kayak_id, booking_date, boat_round_id, num_passengers } = req.body;

    const round_id = boat_round_id;

    if (user.role !== 'customer') {
      client.release();
      res.status(403).json({ success: false, message: 'เฉพาะสมาชิกลูกค้าเท่านั้นที่สามารถจองเรือได้' });
      return;
    }

    await client.query('BEGIN');

    const btResult = await client.query(
      'SELECT price, quantity FROM boat_types WHERE boat_type_id = $1 FOR UPDATE',
      [kayak_id]
    );
    if (btResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Boat type not found' });
      return;
    }
    const { price: price_per_hour, quantity } = btResult.rows[0];

    const roundResult = await client.query(
      'SELECT max_booking, total_slots FROM boat_rounds WHERE boat_round_id = $1 FOR UPDATE',
      [round_id]
    );
    if (roundResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Boat round not found' });
      return;
    }
    const { max_booking } = roundResult.rows[0];

    const conflict = await client.query(
      `SELECT COUNT(*) as booked_count, COALESCE(SUM(num_passengers), 0) as total_passengers
       FROM boat_bookings
       WHERE boat_type_id = $1 AND booking_date = $2 AND boat_round_id = $3 AND status NOT IN ('cancelled', 'rejected')`,
      [kayak_id, booking_date, round_id]
    );

    const bookedCount = Number(conflict.rows[0].booked_count);
    const totalPassengers = Number(conflict.rows[0].total_passengers);

    if (bookedCount >= quantity) {
      await client.query('ROLLBACK');
      res.status(409).json({ success: false, message: 'เรือประเภทนี้เต็มในรอบที่เลือก' });
      return;
    }

    if (max_booking && (totalPassengers + (num_passengers || 1)) > max_booking) {
      await client.query('ROLLBACK');
      res.status(409).json({ success: false, message: `เกินจำนวนที่รับจองสำหรับเรือประเภทนี้ในรอบนี้ (สูงสุด ${max_booking})` });
      return;
    }

    const { total_slots } = roundResult.rows[0];
    if (total_slots) {
      const allBoatsInRound = await client.query(
        `SELECT COUNT(*) as total_booked
         FROM boat_bookings
         WHERE booking_date = $1
           AND boat_round_id IN (
             SELECT boat_round_id FROM boat_rounds
             WHERE start_time = (SELECT start_time FROM boat_rounds WHERE boat_round_id = $2)
               AND end_time   = (SELECT end_time   FROM boat_rounds WHERE boat_round_id = $2)
           )
           AND status NOT IN ('cancelled', 'rejected')`,
        [booking_date, round_id]
      );
      const totalBooked = Number(allBoatsInRound.rows[0].total_booked);
      if (totalBooked >= total_slots) {
        await client.query('ROLLBACK');
        res.status(409).json({ success: false, message: `ท่าเรือเต็มในรอบนี้ (รองรับสูงสุด ${total_slots} ลำ รวมทุกประเภท)` });
        return;
      }
    }

    const result = await client.query(
      `INSERT INTO boat_bookings (member_id, boat_type_id, boat_round_id, booking_date, num_passengers, total_price, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [user.id, kayak_id, round_id, booking_date, num_passengers || 1, price_per_hour]
    );

    await client.query('COMMIT');

    (async () => {
      try {
        const memberRes = await pool.query('SELECT email, first_name, last_name FROM members WHERE member_id = $1', [user.id]);
        const boatRes = await pool.query('SELECT bt.type_name, br.start_time, br.end_time FROM boat_types bt JOIN boat_rounds br ON br.boat_round_id = $2 WHERE bt.boat_type_id = $1', [kayak_id, round_id]);
        if (memberRes.rows.length > 0 && boatRes.rows.length > 0) {
          const m = memberRes.rows[0];
          const b = boatRes.rows[0];
          const customerName = `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email;
          const bookingDateStr = new Date(booking_date).toLocaleDateString('th-TH');
          const timeRange = `${b.start_time || ''} - ${b.end_time || ''}`;
          await sendBookingConfirmationEmail({
            to: m.email,
            customerName,
            bookingType: 'kayak',
            bookingId: result.rows[0].boat_booking_id,
            details: `เรือคายัค ${b.type_name} (รอบเวลา ${timeRange})`,
            dateInfo: `${bookingDateStr} (${timeRange})`,
            totalPrice: Number(result.rows[0].total_price || 0),
          });
        }
      } catch (err) {
        console.error('Send boat booking confirmation mail error:', err);
      }
    })();

    res.status(201).json({ success: true, message: 'Boat booking created', data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create kayak booking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ดึงรายการจองเรือทั้งหมดของ member ที่ login อยู่
export const getUserKayakBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const result = await pool.query(
      `SELECT bb.*, bt.type_name as kayak_name, 
              (SELECT image_path FROM boat_images bi WHERE bi.boat_type_id = bt.boat_type_id LIMIT 1) as kayak_image,
              br.start_time, br.end_time
       FROM boat_bookings bb
       JOIN boat_types bt ON bb.boat_type_id = bt.boat_type_id
       LEFT JOIN boat_rounds br ON bb.boat_round_id = br.boat_round_id
       WHERE bb.member_id = $1
       ORDER BY bb.created_at DESC`,
      [user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get user kayak bookings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ยกเลิกการจองเรือของผู้ใช้
export const cancelKayakBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const { id } = req.params;

    const booking = await pool.query(
      'SELECT * FROM boat_bookings WHERE boat_booking_id = $1 AND member_id = $2',
      [id, user.id]
    );
    if (booking.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    if (booking.rows[0].status !== 'pending') {
      res.status(400).json({ success: false, message: `Cannot cancel booking with status: ${booking.rows[0].status}` });
      return;
    }

    await pool.query(
      `UPDATE boat_bookings SET status = 'cancelled' WHERE boat_booking_id = $1`,
      [id]
    );
    res.json({ success: true, message: 'Boat booking cancelled' });
  } catch (error) {
    console.error('Cancel kayak booking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรายการจองเรือทั้งหมดในระบบสำหรับ admin หรือ boat staff
export const getAllKayakBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT bb.*, bt.type_name as kayak_name,
              m.first_name || ' ' || m.last_name as user_name, m.email as user_email,
              br.start_time, br.end_time,
              s.first_name || ' ' || s.last_name as approved_by_name
       FROM boat_bookings bb
       JOIN boat_types bt ON bb.boat_type_id = bt.boat_type_id
       JOIN members m ON bb.member_id = m.member_id
       LEFT JOIN boat_rounds br ON bb.boat_round_id = br.boat_round_id
       LEFT JOIN staff s ON bb.approved_by_staff_id = s.staff_id
       ORDER BY bb.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get all kayak bookings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงประเภทเรือทั้งหมด (admin)
export const getAllKayaksAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT bt.boat_type_id as id, bt.type_name as name, bt.description,
             bt.seat_count as capacity, bt.price as price_per_hour, bt.quantity, bt.is_active,
             (SELECT image_path FROM boat_images bi WHERE bi.boat_type_id = bt.boat_type_id LIMIT 1) as image
      FROM boat_types bt
      ORDER BY bt.price ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get all kayaks admin error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรอบเวลาทั้งหมด พร้อมรายการเรือทุกประเภทในรอบนั้น
export const getKayakScheduleAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = `
      SELECT 
        r.boat_round_id,
        r.start_time,
        r.end_time,
        r.total_slots,
        r.max_booking,
        r.is_active,
        r.boat_type_id,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'boat_type_id', rb.boat_type_id,
                'quantity', rb.quantity,
                'type_name', bt.type_name
              )
            )
            FROM round_boats rb
            JOIN boat_types bt ON rb.boat_type_id = bt.boat_type_id
            WHERE rb.boat_round_id = r.boat_round_id
          ),
          '[]'::json
        ) AS round_boats
      FROM boat_rounds r
      ORDER BY r.start_time ASC
    `;

    const result = await pool.query(query);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get kayak schedule admin error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// สร้างประเภทเรือใหม่ในระบบ
export const createKayak = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, capacity, price_per_hour, quantity } = req.body;
    const result = await pool.query(
      `INSERT INTO boat_types (type_name, description, seat_count, price, quantity, is_active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [name, description, capacity, price_per_hour, quantity || 1]
    );
    res.status(201).json({ success: true, message: 'Boat type created', data: result.rows[0] });
  } catch (error) {
    console.error('Create kayak error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// สร้างรอบเวลาใหม่ พร้อมลงข้อมูลรายการเรือใน round_boats
export const createBoatRound = async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const { start_time, end_time, max_booking, total_slots, boats } = req.body;

    if (!start_time || !end_time) {
      res.status(400).json({ success: false, message: 'กรุณากรอก start_time และ end_time ให้ครบถ้วน' });
      return;
    }

    const formattedStartTime = String(start_time).includes('T') ? start_time.split('T')[1].slice(0, 8) : start_time;
    const formattedEndTime = String(end_time).includes('T') ? end_time.split('T')[1].slice(0, 8) : end_time;

    await client.query('BEGIN');

    // บันทึกรอบเวลา (ไม่ต้องบังคับใส่ boat_type_id)
    const result = await client.query(
      `INSERT INTO boat_rounds (start_time, end_time, max_booking, total_slots, is_active)
       VALUES ($1, $2, $3, $4, true) RETURNING *`,
      [formattedStartTime, formattedEndTime, max_booking || null, total_slots || null]
    );

    const newRoundId = result.rows[0].boat_round_id;

    // วนลูปบันทึกเรือทุกประเภทที่ส่งมาจาก Frontend ลงตาราง round_boats
    if (Array.isArray(boats) && boats.length > 0) {
      for (const item of boats) {
        if (item.boat_type_id) {
          await client.query(
            `INSERT INTO round_boats (boat_round_id, boat_type_id, quantity) VALUES ($1, $2, $3)`,
            [newRoundId, Number(item.boat_type_id), Number(item.quantity || 1)]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Boat round created', data: result.rows[0] });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Create boat round error:', error);
    res.status(500).json({ success: false, message: error.message || 'Internal server error' });
  } finally {
    client.release();
  }
};

// อัปเดตสถานะการจองเรือ
export const updateKayakBookingStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user as AuthPayload;

    const allowed = ['approved', 'rejected', 'pending', 'checked_out'];
    if (!allowed.includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status' });
      return;
    }

    let query = `UPDATE boat_bookings SET status = $1, updated_at = NOW()`;
    const params: any[] = [status];

    if (status === 'approved' || status === 'rejected') {
      query += `, approved_by_staff_id = $2`;
      params.push(user.id);
    }

    params.push(id);
    query += ` WHERE boat_booking_id = $${params.length} RETURNING *`;

    const result = await pool.query(query, params);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    if (status === 'approved' || status === 'rejected') {
      (async () => {
        try {
          const infoRes = await pool.query(
            `SELECT m.email, m.first_name, m.last_name, bt.type_name, br.start_time, br.end_time
             FROM boat_bookings bb
             JOIN members m ON bb.member_id = m.member_id
             JOIN boat_types bt ON bb.boat_type_id = bt.boat_type_id
             JOIN boat_rounds br ON bb.boat_round_id = br.boat_round_id
             WHERE bb.boat_booking_id = $1`,
            [id]
          );
          if (infoRes.rows.length > 0) {
            const info = infoRes.rows[0];
            const customerName = `${info.first_name || ''} ${info.last_name || ''}`.trim() || info.email;
            const timeRange = `${info.start_time || ''} - ${info.end_time || ''}`;
            await sendBookingStatusEmail({
              to: info.email,
              customerName,
              bookingType: 'kayak',
              bookingId: Number(id),
              status: status as 'approved' | 'rejected',
              details: `เรือคายัค ${info.type_name} (รอบเวลา ${timeRange})`,
            });
          }
        } catch (err) {
          console.error('Send boat booking status mail error:', err);
        }
      })();
    }

    res.json({ success: true, message: 'Booking status updated', data: result.rows[0] });
  } catch (error) {
    console.error('Update kayak booking status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// บันทึกการ check out เรือคายัค
export const checkoutKayakBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const booking = await pool.query(
      'SELECT status FROM boat_bookings WHERE boat_booking_id = $1',
      [id]
    );
    if (booking.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    if (booking.rows[0].status !== 'approved') {
      res.status(400).json({
        success: false,
        message: `ไม่สามารถ checkout ได้ เนื่องจากสถานะปัจจุบันคือ: ${booking.rows[0].status}`,
      });
      return;
    }

    await pool.query(
      `UPDATE boat_bookings SET status = 'checked_out', updated_at = NOW() WHERE boat_booking_id = $1`,
      [id]
    );
    res.json({ success: true, message: 'เช็คเอาต์สำเร็จ' });
  } catch (error) {
    console.error('Checkout kayak booking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ลบประเภทเรือออกจากระบบ
export const deleteKayak = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    const bookingCheck = await pool.query(
      `SELECT COUNT(*) as count FROM boat_bookings 
       WHERE boat_type_id = $1 AND status NOT IN ('cancelled', 'rejected')`,
      [id]
    );
    
    if (Number(bookingCheck.rows[0].count) > 0) {
      res.status(400).json({ success: false, message: 'ไม่สามารถลบได้ เนื่องจากมีการจองที่ยังค้างอยู่' });
      return;
    }

    const result = await pool.query(
      `DELETE FROM boat_types WHERE boat_type_id = $1 RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Boat type not found' });
      return;
    }
    
    res.json({ success: true, message: 'Boat type deleted successfully' });
  } catch (error) {
    console.error('Delete kayak error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรูปทั้งหมดของ boat type
export const getBoatImages = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT boat_image_id as id, image_path FROM boat_images WHERE boat_type_id = $1 ORDER BY boat_image_id ASC`,
      [id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get boat images error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// เพิ่มรูปให้ boat type
export const addBoatImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { image_path } = req.body;
    if (!image_path) {
      res.status(400).json({ success: false, message: 'image_path is required' });
      return;
    }
    const check = await pool.query('SELECT boat_type_id FROM boat_types WHERE boat_type_id = $1', [id]);
    if (check.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Boat type not found' });
      return;
    }
    const result = await pool.query(
      `INSERT INTO boat_images (boat_type_id, image_path) VALUES ($1, $2) RETURNING boat_image_id as id, image_path`,
      [id, image_path]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Add boat image error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ลบรูปของ boat type พร้อมลบไฟล์บน Cloudinary
export const deleteBoatImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageId } = req.params;
    const result = await pool.query(
      `DELETE FROM boat_images WHERE boat_image_id = $1 RETURNING boat_image_id, image_path`,
      [imageId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Image not found' });
      return;
    }
    await deleteCloudinaryImage(result.rows[0].image_path).catch(
      (cleanupError: unknown) => {
        console.error('Deleted boat image cleanup error:', cleanupError);
      }
    );
    res.json({ success: true, message: 'Image deleted' });
  } catch (error) {
    console.error('Delete boat image error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// อัปเดตข้อมูลประเภทเรือเดิม ( Dynamic Update )
export const updateKayak = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body;

    const fieldMapping: Record<string, string> = {
      name: 'type_name',
      type_name: 'type_name',
      description: 'description',
      capacity: 'seat_count',
      seat_count: 'seat_count',
      price_per_hour: 'price',
      price: 'price',
      quantity: 'quantity',
      is_active: 'is_active',
    };

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.keys(body).forEach((key) => {
      if (fieldMapping[key] && body[key] !== undefined) {
        updates.push(`${fieldMapping[key]} = $${paramIndex}`);
        values.push(body[key]);
        paramIndex++;
      }
    });

    if (updates.length === 0) {
      res.status(400).json({ success: false, message: 'ไม่มีข้อมูลที่ส่งมาอัปเดต' });
      return;
    }

    values.push(id);
    const query = `
      UPDATE boat_types 
      SET ${updates.join(', ')} 
      WHERE boat_type_id = $${paramIndex} 
      RETURNING boat_type_id as id, type_name as name, description, seat_count as capacity, price as price_per_hour, quantity, is_active`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Boat type not found' });
      return;
    }

    res.json({ success: true, message: 'Boat type updated', data: result.rows[0] });
  } catch (error) {
    console.error('Update kayak error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// อัปเดตรอบเวลาเรือ + ซิงก์ตาราง round_boats
export const updateBoatRound = async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const body = req.body;
    const { boats, boat_type_id } = body;

    await client.query('BEGIN');

    // 1. อัปเดตข้อมูลพื้นฐานในตาราง boat_rounds
    const allowedFields = ['boat_type_id', 'start_time', 'end_time', 'max_booking', 'total_slots', 'is_active'];
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        let val = (field === 'max_booking' || field === 'total_slots') && body[field] === '' ? null : body[field];
        if ((field === 'start_time' || field === 'end_time') && typeof val === 'string' && val.includes('T')) {
          val = val.split('T')[1].slice(0, 8);
        }
        values.push(val);
        paramIndex++;
      }
    });

    if (updates.length > 0) {
      values.push(id);
      const query = `
        UPDATE boat_rounds 
        SET ${updates.join(', ')} 
        WHERE boat_round_id = $${paramIndex} 
        RETURNING *`;
      await client.query(query, values);
    }

    // 2. อัปเดตข้อมูลรายการเรือลงในตาราง round_boats
    if (Array.isArray(boats) && boats.length > 0) {
      // กรณี Frontend ส่งมาเป็น Array หลายประเภท
      await client.query(`DELETE FROM round_boats WHERE boat_round_id = $1`, [id]);
      for (const item of boats) {
        if (item.boat_type_id) {
          await client.query(
            `INSERT INTO round_boats (boat_round_id, boat_type_id, quantity) VALUES ($1, $2, $3)`,
            [id, Number(item.boat_type_id), Number(item.quantity || 1)]
          );
        }
      }
    } else if (boat_type_id) {
      // กรณี Frontend แบบเก่าส่งมาแค่ประเภทเดียว (Fallback)
      await client.query(`DELETE FROM round_boats WHERE boat_round_id = $1`, [id]);
      await client.query(
        `INSERT INTO round_boats (boat_round_id, boat_type_id, quantity) VALUES ($1, $2, 1)`,
        [id, Number(boat_type_id)]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Boat round updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update boat round error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ลบรอบเวลาเรือ
export const deleteBoatRound = async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const bookingCheck = await client.query(
      `SELECT COUNT(*) as count FROM boat_bookings 
       WHERE boat_round_id = $1 AND status NOT IN ('cancelled', 'rejected')`,
      [id]
    );

    if (Number(bookingCheck.rows[0].count) > 0) {
      client.release();
      res.status(400).json({ success: false, message: 'Cannot delete round with active bookings' });
      return;
    }

    await client.query('BEGIN');
    await client.query(`DELETE FROM round_boats WHERE boat_round_id = $1`, [id]);
    const result = await client.query(
      `DELETE FROM boat_rounds WHERE boat_round_id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Boat round not found' });
      return;
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Boat round deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete boat round error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};