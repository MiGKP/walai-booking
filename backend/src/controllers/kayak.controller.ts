import { Request, Response } from "express";
import pool from "../config/database";
import { AuthPayload } from "../types";
import {
  sendBookingConfirmationEmail,
  sendBookingStatusEmail,
} from "../services/mail.service";
import { deleteCloudinaryImage } from "../services/cloudinary.service";
import {
  boatsNeeded,
  lineSubtotal,
  sumPassengerCounts,
  sumSubtotals,
} from "../services/booking-boat.math";

interface KayakItemInput {
  boat_type_id: number;
  num_passengers: number;
}

const BOATS_JSON_SQL = `COALESCE((
  SELECT json_agg(json_build_object(
    'booking_boat_id', bnb.booking_boat_id,
    'boat_type_id', bnb.boat_type_id,
    'boat_round_id', bnb.boat_round_id,
    'type_name', bt.type_name,
    'num_passengers', bnb.num_passengers,
    'boat_count', bnb.boat_count,
    'unit_price', bnb.unit_price,
    'subtotal', bnb.subtotal,
    'status', bnb.status,
    'start_time', br.start_time,
    'end_time', br.end_time
  ) ORDER BY bnb.booking_boat_id)
  FROM booking_boat bnb
  JOIN boat_types bt ON bt.boat_type_id = bnb.boat_type_id
  JOIN boat_rounds br ON br.boat_round_id = bnb.boat_round_id
  WHERE bnb.boat_booking_id = bb.boat_booking_id
), '[]'::json)`;

function normalizeKayakItems(body: Record<string, unknown>): KayakItemInput[] {
  if (Array.isArray(body.items) && body.items.length > 0) {
    return body.items.map((raw) => {
      const item = raw as Record<string, unknown>;
      return {
        boat_type_id: Number(item.boat_type_id),
        num_passengers: Number(item.num_passengers),
      };
    });
  }
  return [
    {
      boat_type_id: Number(body.kayak_id),
      num_passengers: Number(body.num_passengers ?? 1),
    },
  ];
}

function normalizeTimePart(value: unknown): string {
  const raw = String(value ?? "").trim();
  // Accept "15:00", "15:00:00", or Date/ISO fragments that start with HH:MM:SS
  const hhmm = raw.match(/^(\d{2}:\d{2})(?::(\d{2}))?/);
  if (hhmm) {
    return `${hhmm[1]}:${hhmm[2] ?? "00"}`;
  }
  return raw;
}

// ดึงรายการประเภทเรือทั้งหมดที่เปิดใช้งานอยู่ พร้อมข้อมูลที่ frontend ใช้แสดง เช่น ความจุ ราคา และรูปหลัก
export const getAllKayaks = async (
  req: Request,
  res: Response,
): Promise<void> => {
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
    const mapped = result.rows.map((row) => ({
      ...row,
      type:
        row.capacity === 1
          ? "single"
          : row.capacity === 2
            ? "double"
            : "tandem",
      is_available: row.quantity > 0,
    }));

    res.json({ success: true, data: mapped });
  } catch (error) {
    console.error("Get kayaks error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ดึงรายละเอียดของเรือรายประเภทตาม id เพื่อใช้ในหน้ารายรายละเอียดก่อนตัดสินใจจอง
export const getKayakById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `
      SELECT bt.boat_type_id as id, bt.type_name as name, bt.description, 
             bt.seat_count as capacity, bt.price as price_per_hour, bt.quantity,
             (SELECT json_agg(image_path) FROM boat_images bi WHERE bi.boat_type_id = bt.boat_type_id) as images
      FROM boat_types bt 
      WHERE bt.boat_type_id = $1
    `,
      [id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: "Boat type not found" });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Get kayak error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ตรวจสอบความพร้อมใช้งานของเรือในวันและรอบเวลาที่เลือก โดยเทียบจำนวนที่ถูกจองไปแล้วกับจำนวนเรือทั้งหมด
export const checkKayakAvailability = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { kayak_id, booking_date, boat_round_id } = req.query;

    const [conflictRes, boatRes, roundRes, poolRes] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(bnb.boat_count), 0) as booked_count
         FROM booking_boat bnb
         JOIN boat_bookings bb ON bb.boat_booking_id = bnb.boat_booking_id
         WHERE bnb.boat_type_id = $1 AND bb.booking_date = $2 AND bnb.boat_round_id = $3
         AND bnb.status NOT IN ('cancelled', 'rejected')`,
        [kayak_id, booking_date, boat_round_id],
      ),
      pool.query(`SELECT quantity FROM boat_types WHERE boat_type_id = $1`, [
        kayak_id,
      ]),
      pool.query(
        `SELECT total_slots, start_time, end_time FROM boat_rounds WHERE boat_round_id = $1`,
        [boat_round_id],
      ),
      pool.query(
        `SELECT COALESCE(SUM(bnb.boat_count), 0) as total_booked
         FROM booking_boat bnb
         JOIN boat_bookings bb ON bb.boat_booking_id = bnb.boat_booking_id
         WHERE bb.booking_date = $1
         AND bnb.boat_round_id IN (
           SELECT boat_round_id FROM boat_rounds
           WHERE start_time = (SELECT start_time FROM boat_rounds WHERE boat_round_id = $2)
             AND end_time   = (SELECT end_time   FROM boat_rounds WHERE boat_round_id = $2)
         )
         AND bnb.status NOT IN ('cancelled', 'rejected')`,
        [booking_date, boat_round_id],
      ),
    ]);

    const booked = Number(conflictRes.rows[0].booked_count);
    const total = boatRes.rows[0]?.quantity || 0;
    const total_slots = roundRes.rows[0]?.total_slots ?? null;
    const pool_booked = Number(poolRes.rows[0].total_booked);

    const remaining_type = Math.max(0, total - booked);
    const remaining_pool =
      total_slots !== null ? Math.max(0, total_slots - pool_booked) : null;
    const remaining =
      remaining_pool !== null
        ? Math.min(remaining_type, remaining_pool)
        : remaining_type;

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
    console.error("Check kayak availability error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
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
export const getKayakCalendar = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { kayak_id, start, end } = req.query;

    const kayakId = Number(kayak_id);
    if (!Number.isInteger(kayakId) || kayakId <= 0) {
      res.status(400).json({
        success: false,
        message: "kayak_id ไม่ถูกต้อง",
        code: "INVALID_KAYAK",
      });
      return;
    }

    if (
      typeof start !== "string" ||
      typeof end !== "string" ||
      !ISO_DATE_PATTERN.test(start) ||
      !ISO_DATE_PATTERN.test(end)
    ) {
      res.status(400).json({
        success: false,
        message: "start และ end ต้องเป็นวันที่รูปแบบ YYYY-MM-DD",
        code: "INVALID_RANGE",
      });
      return;
    }

    const startDate = new Date(`${start}T00:00:00Z`);
    const endDate = new Date(`${end}T00:00:00Z`);
    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      endDate < startDate
    ) {
      res.status(400).json({
        success: false,
        message: "ช่วงวันที่ไม่ถูกต้อง",
        code: "INVALID_RANGE",
      });
      return;
    }

    const spanDays =
      Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
    if (spanDays > MAX_CALENDAR_DAYS) {
      res.status(400).json({
        success: false,
        message: `ขอข้อมูลได้ไม่เกิน ${MAX_CALENDAR_DAYS} วันต่อครั้ง`,
        code: "RANGE_TOO_LARGE",
      });
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
             SELECT SUM(bnb.boat_count) FROM booking_boat bnb
             JOIN boat_bookings bb ON bb.boat_booking_id = bnb.boat_booking_id
             WHERE bnb.boat_type_id = $1::int
               AND bb.booking_date = d.day
               AND bnb.boat_round_id = r.boat_round_id
               AND bnb.status NOT IN ('cancelled', 'rejected')
           ), 0)::int AS type_booked,
           COALESCE((
             SELECT SUM(bnb.boat_count) FROM booking_boat bnb
             JOIN boat_bookings bb ON bb.boat_booking_id = bnb.boat_booking_id
             WHERE bb.booking_date = d.day
               AND bnb.status NOT IN ('cancelled', 'rejected')
               AND bnb.boat_round_id IN (
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
      [kayakId, start, end],
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
    for (
      let cursor = new Date(startDate);
      cursor <= endDate;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      const iso = cursor.toISOString().slice(0, 10);
      days.push(
        byDate.get(iso) ?? {
          date: iso,
          rounds_total: 0,
          rounds_available: 0,
          is_full: true,
        },
      );
    }

    res.json({ success: true, data: { start, end, kayak_id: kayakId, days } });
  } catch (error) {
    console.error("Get kayak calendar error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

// ดึงทุกรอบเวลาของวันที่เลือกพร้อมจำนวนที่เหลือ
export const getKayakDayRounds = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { kayak_id, booking_date } = req.query;

    const kayakId = Number(kayak_id);
    if (!Number.isInteger(kayakId) || kayakId <= 0) {
      res.status(400).json({
        success: false,
        message: "kayak_id ไม่ถูกต้อง",
        code: "INVALID_KAYAK",
      });
      return;
    }

    if (
      typeof booking_date !== "string" ||
      !ISO_DATE_PATTERN.test(booking_date)
    ) {
      res.status(400).json({
        success: false,
        message: "booking_date ต้องเป็นวันที่รูปแบบ YYYY-MM-DD",
        code: "INVALID_DATE",
      });
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
           SELECT SUM(bnb.boat_count) FROM booking_boat bnb
           JOIN boat_bookings bb ON bb.boat_booking_id = bnb.boat_booking_id
           WHERE bnb.boat_type_id = $1::int
             AND bb.booking_date = $2::date
             AND bnb.boat_round_id = br.boat_round_id
             AND bnb.status NOT IN ('cancelled', 'rejected')
         ), 0)::int AS booked,
         COALESCE((
           SELECT SUM(bnb.boat_count) FROM booking_boat bnb
           JOIN boat_bookings bb ON bb.boat_booking_id = bnb.boat_booking_id
           WHERE bb.booking_date = $2::date
             AND bnb.status NOT IN ('cancelled', 'rejected')
             AND bnb.boat_round_id IN (
               SELECT br2.boat_round_id FROM boat_rounds br2
               WHERE br2.start_time = br.start_time AND br2.end_time = br.end_time
             )
         ), 0)::int AS pool_booked
       FROM boat_rounds br
       WHERE br.is_active = true AND br.boat_type_id = $1::int
       ORDER BY br.start_time`,
      [kayakId, booking_date],
    );

    const rounds: KayakRoundAvailability[] = result.rows.map((row) => {
      const total = Number(row.total);
      const booked = Number(row.booked);
      const totalSlots =
        row.total_slots === null ? null : Number(row.total_slots);
      const poolBooked = Number(row.pool_booked);

      const remainingType = Math.max(0, total - booked);
      const remainingPool =
        totalSlots === null ? null : Math.max(0, totalSlots - poolBooked);
      const remaining =
        remainingPool === null
          ? remainingType
          : Math.min(remainingType, remainingPool);

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

    res.json({
      success: true,
      data: { booking_date, kayak_id: kayakId, rounds },
    });
  } catch (error) {
    console.error("Get kayak day rounds error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

// ดึงรอบเวลาของเรือที่เปิดใช้งานอยู่
export const getKayakSchedule = async (
  req: Request,
  res: Response,
): Promise<void> => {
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
    console.error("Get kayak schedule error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// สร้างการจองเรือใหม่ (header + หลายบรรทัด booking_boat)
export const createKayakBooking = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const client = await pool.connect();
  try {
    const user = req.user as AuthPayload;
    const body = req.body as Record<string, unknown>;
    const booking_date = String(body.booking_date);

    if (user.role !== "customer") {
      res.status(403).json({
        success: false,
        message: "เฉพาะสมาชิกลูกค้าเท่านั้นที่สามารถจองเรือได้",
      });
      return;
    }

    let items: KayakItemInput[];
    try {
      items = normalizeKayakItems(body);
    } catch {
      res.status(400).json({ success: false, message: "รายการจองไม่ถูกต้อง" });
      return;
    }

    if (items.length === 0) {
      res.status(400).json({ success: false, message: "ต้องมีอย่างน้อย 1 ประเภทเรือ" });
      return;
    }

    const typeIds = new Set(items.map((i) => i.boat_type_id));
    if (typeIds.size !== items.length) {
      res.status(400).json({
        success: false,
        message: "ไม่สามารถจองประเภทเรือซ้ำในคำขอเดียวกันได้",
      });
      return;
    }

    for (const item of items) {
      if (!Number.isInteger(item.boat_type_id) || item.boat_type_id < 1) {
        res.status(400).json({ success: false, message: "boat_type_id ไม่ถูกต้อง" });
        return;
      }
      if (!Number.isInteger(item.num_passengers) || item.num_passengers < 1) {
        res.status(400).json({
          success: false,
          message: "จำนวนผู้โดยสารต้องมีอย่างน้อย 1 คนต่อประเภท",
        });
        return;
      }
    }

    await client.query("BEGIN");

    let startTime = normalizeTimePart(body.start_time);
    let endTime = normalizeTimePart(body.end_time);

    if ((!startTime || !endTime) && body.boat_round_id != null) {
      const roundLookup = await client.query(
        `SELECT start_time, end_time FROM boat_rounds WHERE boat_round_id = $1`,
        [Number(body.boat_round_id)],
      );
      if (roundLookup.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({ success: false, message: "Boat round not found" });
        return;
      }
      startTime = normalizeTimePart(roundLookup.rows[0].start_time);
      endTime = normalizeTimePart(roundLookup.rows[0].end_time);
    }

    if (!startTime || !endTime) {
      await client.query("ROLLBACK");
      res.status(400).json({
        success: false,
        message: "ต้องระบุ start_time และ end_time",
      });
      return;
    }

    interface PreparedLine {
      boat_type_id: number;
      boat_round_id: number;
      type_name: string;
      num_passengers: number;
      boat_count: number;
      unit_price: number;
      subtotal: number;
      max_booking: number | null;
      total_slots: number | null;
      quantity: number;
    }

    const prepared: PreparedLine[] = [];
    let poolSlots: number | null = null;

    // Lock types in ascending id order to reduce deadlock risk
    const sortedItems = [...items].sort((a, b) => a.boat_type_id - b.boat_type_id);

    for (const item of sortedItems) {
      const btResult = await client.query(
        `SELECT boat_type_id, type_name, price, quantity, seat_count
         FROM boat_types WHERE boat_type_id = $1 FOR UPDATE`,
        [item.boat_type_id],
      );
      if (btResult.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(404).json({
          success: false,
          message: `ไม่พบประเภทเรือ id ${item.boat_type_id}`,
        });
        return;
      }
      const boatType = btResult.rows[0];
      const seatCount = Number(boatType.seat_count || 1);
      let boatCount: number;
      try {
        boatCount = boatsNeeded(item.num_passengers, seatCount);
      } catch (err) {
        await client.query("ROLLBACK");
        res.status(400).json({
          success: false,
          message: err instanceof Error ? err.message : "ข้อมูลผู้โดยสารไม่ถูกต้อง",
        });
        return;
      }

      const roundResult = await client.query(
        `SELECT boat_round_id, max_booking, total_slots, start_time, end_time
         FROM boat_rounds
         WHERE boat_type_id = $1
           AND is_active = true
           AND start_time = $2::time
           AND end_time = $3::time
         FOR UPDATE`,
        [item.boat_type_id, startTime, endTime],
      );
      if (roundResult.rows.length === 0) {
        await client.query("ROLLBACK");
        res.status(409).json({
          success: false,
          message: `ไม่มีรอบเวลาที่เลือกสำหรับเรือ ${boatType.type_name}`,
        });
        return;
      }
      const round = roundResult.rows[0];
      if (poolSlots === null && round.total_slots != null) {
        poolSlots = Number(round.total_slots);
      }

      const conflict = await client.query(
        `SELECT COALESCE(SUM(bnb.boat_count), 0) as booked_boats,
                COALESCE(SUM(bnb.num_passengers), 0) as total_passengers
         FROM booking_boat bnb
         JOIN boat_bookings bb ON bb.boat_booking_id = bnb.boat_booking_id
         WHERE bnb.boat_type_id = $1
           AND bb.booking_date = $2
           AND bnb.boat_round_id = $3
           AND bnb.status NOT IN ('cancelled', 'rejected')`,
        [item.boat_type_id, booking_date, round.boat_round_id],
      );

      const bookedBoats = Number(conflict.rows[0].booked_boats);
      const totalPassengers = Number(conflict.rows[0].total_passengers);
      const quantity = Number(boatType.quantity || 0);

      if (bookedBoats + boatCount > quantity) {
        await client.query("ROLLBACK");
        res.status(409).json({
          success: false,
          message: `เรือ ${boatType.type_name} เต็มในรอบที่เลือก (ต้องการ ${boatCount} ลำ)`,
        });
        return;
      }

      const maxBooking =
        round.max_booking == null ? null : Number(round.max_booking);
      if (maxBooking != null && totalPassengers + item.num_passengers > maxBooking) {
        await client.query("ROLLBACK");
        res.status(409).json({
          success: false,
          message: `เกินจำนวนที่รับจองสำหรับเรือ ${boatType.type_name} ในรอบนี้ (สูงสุด ${maxBooking})`,
        });
        return;
      }

      const unitPrice = Number(boatType.price);
      prepared.push({
        boat_type_id: item.boat_type_id,
        boat_round_id: Number(round.boat_round_id),
        type_name: String(boatType.type_name),
        num_passengers: item.num_passengers,
        boat_count: boatCount,
        unit_price: unitPrice,
        subtotal: lineSubtotal(unitPrice, boatCount),
        max_booking: maxBooking,
        total_slots: round.total_slots == null ? null : Number(round.total_slots),
        quantity,
      });
    }

    const requestBoatTotal = prepared.reduce((sum, line) => sum + line.boat_count, 0);
    if (poolSlots != null) {
      const poolRes = await client.query(
        `SELECT COALESCE(SUM(bnb.boat_count), 0) as total_booked
         FROM booking_boat bnb
         JOIN boat_bookings bb ON bb.boat_booking_id = bnb.boat_booking_id
         WHERE bb.booking_date = $1
           AND bnb.status NOT IN ('cancelled', 'rejected')
           AND bnb.boat_round_id IN (
             SELECT boat_round_id FROM boat_rounds
             WHERE start_time = $2::time AND end_time = $3::time
           )`,
        [booking_date, startTime, endTime],
      );
      const totalBooked = Number(poolRes.rows[0].total_booked);
      if (totalBooked + requestBoatTotal > poolSlots) {
        await client.query("ROLLBACK");
        res.status(409).json({
          success: false,
          message: `ท่าเรือเต็มในรอบนี้ (รองรับสูงสุด ${poolSlots} ลำ รวมทุกประเภท)`,
        });
        return;
      }
    }

    const totalPassengersHeader = sumPassengerCounts(prepared);
    const totalPrice = sumSubtotals(prepared.map((line) => line.subtotal));

    const headerRes = await client.query(
      `INSERT INTO boat_bookings (
         member_id, booking_date, start_time, end_time,
         num_passengers, total_price, status
       ) VALUES ($1, $2, $3::time, $4::time, $5, $6, 'pending')
       RETURNING *`,
      [
        user.id,
        booking_date,
        startTime,
        endTime,
        totalPassengersHeader,
        totalPrice,
      ],
    );
    const header = headerRes.rows[0];

    for (const line of prepared) {
      await client.query(
        `INSERT INTO booking_boat (
           boat_booking_id, boat_type_id, boat_round_id,
           num_passengers, boat_count, unit_price, subtotal, status
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
        [
          header.boat_booking_id,
          line.boat_type_id,
          line.boat_round_id,
          line.num_passengers,
          line.boat_count,
          line.unit_price,
          line.subtotal,
        ],
      );
    }

    const boatsRes = await client.query(
      `SELECT bnb.*, bt.type_name, br.start_time, br.end_time
       FROM booking_boat bnb
       JOIN boat_types bt ON bt.boat_type_id = bnb.boat_type_id
       JOIN boat_rounds br ON br.boat_round_id = bnb.boat_round_id
       WHERE bnb.boat_booking_id = $1
       ORDER BY bnb.booking_boat_id`,
      [header.boat_booking_id],
    );

    await client.query("COMMIT");

    const typeNames = prepared.map((line) => line.type_name).join(", ");
    const timeRange = `${startTime} - ${endTime}`;

    (async () => {
      try {
        const memberRes = await pool.query(
          "SELECT email, first_name, last_name FROM members WHERE member_id = $1",
          [user.id],
        );
        if (memberRes.rows.length > 0) {
          const m = memberRes.rows[0];
          const customerName =
            `${m.first_name || ""} ${m.last_name || ""}`.trim() || m.email;
          const bookingDateStr = new Date(booking_date).toLocaleDateString(
            "th-TH",
          );
          await sendBookingConfirmationEmail({
            to: m.email,
            customerName,
            bookingType: "kayak",
            bookingId: header.boat_booking_id,
            details: `เรือคายัค ${typeNames} (รอบเวลา ${timeRange})`,
            dateInfo: `${bookingDateStr} (${timeRange})`,
            totalPrice: Number(header.total_price || 0),
          });
        }
      } catch (err) {
        console.error("Send boat booking confirmation mail error:", err);
      }
    })();

    res.status(201).json({
      success: true,
      message: "Boat booking created",
      data: {
        ...header,
        kayak_name: typeNames,
        start_time: startTime,
        end_time: endTime,
        boats: boatsRes.rows,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create kayak booking error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};

// ดึงรายการจองเรือทั้งหมดของ member ที่ login อยู่
export const getUserKayakBookings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const result = await pool.query(
      `SELECT bb.*,
              (
                SELECT string_agg(bt.type_name, ', ' ORDER BY bnb.booking_boat_id)
                FROM booking_boat bnb
                JOIN boat_types bt ON bt.boat_type_id = bnb.boat_type_id
                WHERE bnb.boat_booking_id = bb.boat_booking_id
              ) as kayak_name,
              (
                SELECT bi.image_path
                FROM booking_boat bnb
                JOIN boat_images bi ON bi.boat_type_id = bnb.boat_type_id
                WHERE bnb.boat_booking_id = bb.boat_booking_id
                ORDER BY bnb.booking_boat_id, bi.boat_image_id
                LIMIT 1
              ) as kayak_image,
              ${BOATS_JSON_SQL} AS boats
       FROM boat_bookings bb
       WHERE bb.member_id = $1
       ORDER BY bb.created_at DESC`,
      [user.id],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get user kayak bookings error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ยกเลิกการจองเรือของผู้ใช้
export const cancelKayakBooking = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const client = await pool.connect();
  try {
    const user = req.user as AuthPayload;
    const { id } = req.params;

    await client.query("BEGIN");
    const booking = await client.query(
      "SELECT * FROM boat_bookings WHERE boat_booking_id = $1 AND member_id = $2 FOR UPDATE",
      [id, user.id],
    );
    if (booking.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }
    if (booking.rows[0].status !== "pending") {
      await client.query("ROLLBACK");
      res.status(400).json({
        success: false,
        message: `Cannot cancel booking with status: ${booking.rows[0].status}`,
      });
      return;
    }

    await client.query(
      `UPDATE boat_bookings SET status = 'cancelled', updated_at = NOW() WHERE boat_booking_id = $1`,
      [id],
    );
    await client.query(
      `UPDATE booking_boat SET status = 'cancelled', updated_at = NOW() WHERE boat_booking_id = $1`,
      [id],
    );
    await client.query("COMMIT");
    res.json({ success: true, message: "Boat booking cancelled" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Cancel kayak booking error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};

// ดึงรายการจองเรือทั้งหมดในระบบสำหรับ admin หรือ boat staff
export const getAllKayakBookings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT bb.*,
              (
                SELECT string_agg(bt.type_name, ', ' ORDER BY bnb.booking_boat_id)
                FROM booking_boat bnb
                JOIN boat_types bt ON bt.boat_type_id = bnb.boat_type_id
                WHERE bnb.boat_booking_id = bb.boat_booking_id
              ) as kayak_name,
              m.first_name || ' ' || m.last_name as user_name, m.email as user_email,
              s.first_name || ' ' || s.last_name as approved_by_name,
              ${BOATS_JSON_SQL} AS boats
       FROM boat_bookings bb
       JOIN members m ON bb.member_id = m.member_id
       LEFT JOIN staff s ON bb.approved_by_staff_id = s.staff_id
       ORDER BY bb.created_at DESC`,
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get all kayak bookings error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getAllKayaksAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const query = `
      SELECT 
        bt.boat_type_id,
        bt.boat_type_id AS id,
        bt.type_name AS name,
        bt.type_name,
        bt.description,
        bt.seat_count AS capacity,
        bt.seat_count,
        bt.price AS price_per_hour,
        bt.price,
        bt.quantity,
        bt.is_active,
        COALESCE(
          (SELECT bi.image_path FROM boat_images bi WHERE bi.boat_type_id = bt.boat_type_id LIMIT 1), 
          ''
        ) AS boat_image,
        COALESCE(
          (SELECT json_agg(bi.image_path) FROM boat_images bi WHERE bi.boat_type_id = bt.boat_type_id),
          '[]'::json
        ) AS gallery_images
      FROM boat_types bt
      ORDER BY bt.boat_type_id DESC
    `;

    const result = await pool.query(query);
    
    res.status(200).json({ 
      success: true, 
      data: result.rows 
    });
  } catch (error) {
    console.error('getAllKayaksAdmin error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรอบเวลาทั้งหมด พร้อมรายการเรือทุกประเภทในรอบนั้น
export const getKayakScheduleAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
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
    console.error("Get kayak schedule admin error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// สร้างประเภทเรือใหม่ในระบบ
export const createKayak = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const client = await pool.connect();
  try {
    const {
      name,
      description,
      capacity,
      price_per_hour,
      quantity,
      boat_image,
      gallery_images,
    } = req.body;

    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO boat_types (type_name, description, seat_count, price, quantity, is_active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING boat_type_id as id`,
      [name, description, capacity, price_per_hour, quantity || 1],
    );

    const boatTypeId = result.rows[0].id;

    // 1. บันทึกรูปภาพหลักลงตาราง boat_images
    if (boat_image) {
      await client.query(
        `INSERT INTO boat_images (boat_type_id, image_path) VALUES ($1, $2)`,
        [boatTypeId, boat_image],
      );
    }

    // 2. บันทึกรูป Gallery เพิ่มเติมลงตาราง boat_images
    if (Array.isArray(gallery_images) && gallery_images.length > 0) {
      for (const imgPath of gallery_images) {
        if (imgPath && imgPath !== boat_image) {
          await client.query(
            `INSERT INTO boat_images (boat_type_id, image_path) VALUES ($1, $2)`,
            [boatTypeId, imgPath],
          );
        }
      }
    }

    await client.query("COMMIT");
    res.status(201).json({
      success: true,
      message: "Boat type created",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create kayak error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};

// สร้างรอบเวลาใหม่ พร้อมลงข้อมูลรายการเรือใน round_boats
export const createBoatRound = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const client = await pool.connect();
  try {
    const { start_time, end_time, max_booking, total_slots, boats } = req.body;

    if (!start_time || !end_time) {
      res.status(400).json({
        success: false,
        message: "กรุณากรอก start_time และ end_time ให้ครบถ้วน",
      });
      return;
    }

    const formattedStartTime = String(start_time).includes("T")
      ? start_time.split("T")[1].slice(0, 8)
      : start_time;
    const formattedEndTime = String(end_time).includes("T")
      ? end_time.split("T")[1].slice(0, 8)
      : end_time;

    await client.query("BEGIN");

    // บันทึกรอบเวลา (ไม่ต้องบังคับใส่ boat_type_id)
    const result = await client.query(
      `INSERT INTO boat_rounds (start_time, end_time, max_booking, total_slots, is_active)
       VALUES ($1, $2, $3, $4, true) RETURNING *`,
      [
        formattedStartTime,
        formattedEndTime,
        max_booking || null,
        total_slots || null,
      ],
    );

    const newRoundId = result.rows[0].boat_round_id;

    // วนลูปบันทึกเรือทุกประเภทที่ส่งมาจาก Frontend ลงตาราง round_boats
    if (Array.isArray(boats) && boats.length > 0) {
      for (const item of boats) {
        if (item.boat_type_id) {
          await client.query(
            `INSERT INTO round_boats (boat_round_id, boat_type_id, quantity) VALUES ($1, $2, $3)`,
            [newRoundId, Number(item.boat_type_id), Number(item.quantity || 1)],
          );
        }
      }
    }

    await client.query("COMMIT");
    res.status(201).json({
      success: true,
      message: "Boat round created",
      data: result.rows[0],
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Create boat round error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  } finally {
    client.release();
  }
};

// อัปเดตสถานะการจองเรือ
export const updateKayakBookingStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status } = req.body;
    const user = req.user as AuthPayload;

    const allowed = ["approved", "rejected", "pending", "checked_out"];
    if (!allowed.includes(status)) {
      res.status(400).json({ success: false, message: "Invalid status" });
      return;
    }

    await client.query("BEGIN");

    let query = `UPDATE boat_bookings SET status = $1, updated_at = NOW()`;
    const params: Array<string | number> = [status];

    if (status === "approved" || status === "rejected") {
      query += `, approved_by_staff_id = $2`;
      params.push(user.id);
    }

    params.push(id);
    query += ` WHERE boat_booking_id = $${params.length} RETURNING *`;

    const result = await client.query(query, params);
    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }

    await client.query(
      `UPDATE booking_boat SET status = $1, updated_at = NOW()
       WHERE boat_booking_id = $2`,
      [status, id],
    );
    await client.query("COMMIT");

    if (status === "approved" || status === "rejected") {
      (async () => {
        try {
          const infoRes = await pool.query(
            `SELECT m.email, m.first_name, m.last_name,
                    bb.start_time, bb.end_time,
                    (
                      SELECT string_agg(bt.type_name, ', ' ORDER BY bnb.booking_boat_id)
                      FROM booking_boat bnb
                      JOIN boat_types bt ON bt.boat_type_id = bnb.boat_type_id
                      WHERE bnb.boat_booking_id = bb.boat_booking_id
                    ) AS type_name
             FROM boat_bookings bb
             JOIN members m ON bb.member_id = m.member_id
             WHERE bb.boat_booking_id = $1`,
            [id],
          );
          if (infoRes.rows.length > 0) {
            const info = infoRes.rows[0];
            const customerName =
              `${info.first_name || ""} ${info.last_name || ""}`.trim() ||
              info.email;
            const timeRange = `${info.start_time || ""} - ${info.end_time || ""}`;
            await sendBookingStatusEmail({
              to: info.email,
              customerName,
              bookingType: "kayak",
              bookingId: Number(id),
              status: status as "approved" | "rejected",
              details: `เรือคายัค ${info.type_name || ""} (รอบเวลา ${timeRange})`,
            });
          }
        } catch (err) {
          console.error("Send boat booking status mail error:", err);
        }
      })();
    }

    res.json({
      success: true,
      message: "Booking status updated",
      data: result.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update kayak booking status error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};

// บันทึกการ check out เรือคายัค
export const checkoutKayakBooking = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query("BEGIN");
    const booking = await client.query(
      "SELECT status FROM boat_bookings WHERE boat_booking_id = $1 FOR UPDATE",
      [id],
    );
    if (booking.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }
    if (booking.rows[0].status !== "approved") {
      await client.query("ROLLBACK");
      res.status(400).json({
        success: false,
        message: `ไม่สามารถ checkout ได้ เนื่องจากสถานะปัจจุบันคือ: ${booking.rows[0].status}`,
      });
      return;
    }

    await client.query(
      `UPDATE boat_bookings SET status = 'checked_out', updated_at = NOW() WHERE boat_booking_id = $1`,
      [id],
    );
    await client.query(
      `UPDATE booking_boat SET status = 'checked_out', updated_at = NOW() WHERE boat_booking_id = $1`,
      [id],
    );
    await client.query("COMMIT");
    res.json({ success: true, message: "เช็คเอาต์สำเร็จ" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Checkout kayak booking error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};

// ลบประเภทเรือออกจากระบบ พร้อมลบไฟล์รูปภาพออกจาก Cloudinary
export const deleteKayak = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const bookingCheck = await pool.query(
      `SELECT COUNT(*) as count FROM booking_boat
       WHERE boat_type_id = $1 AND status NOT IN ('cancelled', 'rejected')`,
      [id],
    );

    if (Number(bookingCheck.rows[0].count) > 0) {
      res.status(400).json({
        success: false,
        message: "ไม่สามารถลบได้ เนื่องจากมีการจองที่ยังค้างอยู่",
      });
      return;
    }

    // ดึงรายการรูปทั้งหมดของเรือลำนี้เตรียมไว้ลบออกจาก Cloudinary
    const imagesRes = await pool.query(
      `SELECT image_path FROM boat_images WHERE boat_type_id = $1`,
      [id],
    );

    const result = await pool.query(
      `DELETE FROM boat_types WHERE boat_type_id = $1 RETURNING *`,
      [id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: "Boat type not found" });
      return;
    }

    // ลบไฟล์รูปทั้งหมดออกจาก Cloudinary แบบ Cleanup
    for (const row of imagesRes.rows) {
      if (row.image_path) {
        await deleteCloudinaryImage(row.image_path).catch(
          (cleanupError: unknown) => {
            console.error("Delete kayak Cloudinary cleanup error:", cleanupError);
          },
        );
      }
    }

    res.json({ success: true, message: "Boat type deleted successfully" });
  } catch (error) {
    console.error("Delete kayak error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ดึงรูปทั้งหมดของ boat type
export const getBoatImages = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT boat_image_id as id, image_path FROM boat_images WHERE boat_type_id = $1 ORDER BY boat_image_id ASC`,
      [id],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get boat images error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// เพิ่มรูปให้ boat type
export const addBoatImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { image_path } = req.body;
    if (!image_path) {
      res
        .status(400)
        .json({ success: false, message: "image_path is required" });
      return;
    }
    const check = await pool.query(
      "SELECT boat_type_id FROM boat_types WHERE boat_type_id = $1",
      [id],
    );
    if (check.rows.length === 0) {
      res.status(404).json({ success: false, message: "Boat type not found" });
      return;
    }
    const result = await pool.query(
      `INSERT INTO boat_images (boat_type_id, image_path) VALUES ($1, $2) RETURNING boat_image_id as id, image_path`,
      [id, image_path],
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Add boat image error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ลบรูปของ boat type พร้อมลบไฟล์บน Cloudinary
export const deleteBoatImage = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { imageId } = req.params;
    const result = await pool.query(
      `DELETE FROM boat_images WHERE boat_image_id = $1 RETURNING boat_image_id, image_path`,
      [imageId],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: "Image not found" });
      return;
    }
    await deleteCloudinaryImage(result.rows[0].image_path).catch(
      (cleanupError: unknown) => {
        console.error("Deleted boat image cleanup error:", cleanupError);
      },
    );
    res.json({ success: true, message: "Image deleted" });
  } catch (error) {
    console.error("Delete boat image error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// อัปเดตข้อมูลประเภทเรือเดิม พร้อมจัดการ Cloudinary Cleanup รูปภาพที่ถูกนำออก
export const updateKayak = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const body = req.body;
    const { boat_image, gallery_images } = body;

    const fieldMapping: Record<string, string> = {
      name: "type_name",
      type_name: "type_name",
      description: "description",
      capacity: "seat_count",
      seat_count: "seat_count",
      price_per_hour: "price",
      price: "price",
      quantity: "quantity",
      is_active: "is_active",
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

    await client.query("BEGIN");

    if (updates.length > 0) {
      values.push(id);
      const query = `
        UPDATE boat_types 
        SET ${updates.join(", ")} 
        WHERE boat_type_id = $${paramIndex}`;
      await client.query(query, values);
    }

    // จัดการอัปเดตรูปภาพแบบเดียวกับมาตรฐานห้องพัก (พร้อม Cloudinary Cleanup)
    if (boat_image !== undefined || gallery_images !== undefined) {
      // 1. ดึงรายการรูปเดิมจากตาราง boat_images
      const oldImagesRes = await client.query(
        `SELECT image_path FROM boat_images WHERE boat_type_id = $1`,
        [id],
      );
      const oldImagePaths: string[] = oldImagesRes.rows.map(
        (row) => row.image_path,
      );

      // 2. รวบรวมรูปภาพชุดใหม่ทั้งหมด
      const newImagePaths: string[] = [];
      if (boat_image) {
        newImagePaths.push(boat_image);
      }
      if (Array.isArray(gallery_images)) {
        for (const imgPath of gallery_images) {
          if (imgPath && !newImagePaths.includes(imgPath)) {
            newImagePaths.push(imgPath);
          }
        }
      }

      // 3. เปรียบเทียบหาไฟล์รูปเดิมที่ถูกตัดออก
      const removedImagePaths = oldImagePaths.filter(
        (oldPath) => !newImagePaths.includes(oldPath),
      );

      // 4. ลบข้อมูลรูปเดิมใน DB
      await client.query(`DELETE FROM boat_images WHERE boat_type_id = $1`, [
        id,
      ]);

      // 5. บันทึกรูปหลักใหม่ลง DB
      if (boat_image) {
        await client.query(
          `INSERT INTO boat_images (boat_type_id, image_path) VALUES ($1, $2)`,
          [id, boat_image],
        );
      }

      // 6. บันทึกรูป Gallery ใหม่ลง DB
      if (Array.isArray(gallery_images)) {
        for (const imgPath of gallery_images) {
          if (imgPath && imgPath !== boat_image) {
            await client.query(
              `INSERT INTO boat_images (boat_type_id, image_path) VALUES ($1, $2)`,
              [id, imgPath],
            );
          }
        }
      }

      // 7. สั่งลบรูปที่ไม่ได้ใช้แล้วออกจาก Cloudinary
      for (const imgPath of removedImagePaths) {
        await deleteCloudinaryImage(imgPath).catch((cleanupError: unknown) => {
          console.error(
            "Update kayak Cloudinary cleanup error:",
            cleanupError,
          );
        });
      }
    }

    await client.query("COMMIT");
    res.json({ success: true, message: "Boat type updated" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update kayak error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};

// อัปเดตรอบเวลาเรือ + ซิงก์ตาราง round_boats
export const updateBoatRound = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const body = req.body;
    const { boats, boat_type_id } = body;

    await client.query("BEGIN");

    // 1. อัปเดตข้อมูลพื้นฐานในตาราง boat_rounds
    const allowedFields = [
      "boat_type_id",
      "start_time",
      "end_time",
      "max_booking",
      "total_slots",
      "is_active",
    ];
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        let val =
          (field === "max_booking" || field === "total_slots") &&
          body[field] === ""
            ? null
            : body[field];
        if (
          (field === "start_time" || field === "end_time") &&
          typeof val === "string" &&
          val.includes("T")
        ) {
          val = val.split("T")[1].slice(0, 8);
        }
        values.push(val);
        paramIndex++;
      }
    });

    if (updates.length > 0) {
      values.push(id);
      const query = `
        UPDATE boat_rounds 
        SET ${updates.join(", ")} 
        WHERE boat_round_id = $${paramIndex} 
        RETURNING *`;
      await client.query(query, values);
    }

    // 2. อัปเดตข้อมูลรายการเรือลงในตาราง round_boats
    if (Array.isArray(boats) && boats.length > 0) {
      // กรณี Frontend ส่งมาเป็น Array หลายประเภท
      await client.query(`DELETE FROM round_boats WHERE boat_round_id = $1`, [
        id,
      ]);
      for (const item of boats) {
        if (item.boat_type_id) {
          await client.query(
            `INSERT INTO round_boats (boat_round_id, boat_type_id, quantity) VALUES ($1, $2, $3)`,
            [id, Number(item.boat_type_id), Number(item.quantity || 1)],
          );
        }
      }
    } else if (boat_type_id) {
      // กรณี Frontend แบบเก่าส่งมาแค่ประเภทเดียว (Fallback)
      await client.query(`DELETE FROM round_boats WHERE boat_round_id = $1`, [
        id,
      ]);
      await client.query(
        `INSERT INTO round_boats (boat_round_id, boat_type_id, quantity) VALUES ($1, $2, 1)`,
        [id, Number(boat_type_id)],
      );
    }

    await client.query("COMMIT");
    res.json({ success: true, message: "Boat round updated successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update boat round error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};

// ลบรอบเวลาเรือ
export const deleteBoatRound = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const bookingCheck = await client.query(
      `SELECT COUNT(*) as count FROM booking_boat
       WHERE boat_round_id = $1 AND status NOT IN ('cancelled', 'rejected')`,
      [id],
    );

    if (Number(bookingCheck.rows[0].count) > 0) {
      client.release();
      res.status(400).json({
        success: false,
        message: "Cannot delete round with active bookings",
      });
      return;
    }

    await client.query("BEGIN");
    await client.query(`DELETE FROM round_boats WHERE boat_round_id = $1`, [
      id,
    ]);
    const result = await client.query(
      `DELETE FROM boat_rounds WHERE boat_round_id = $1 RETURNING *`,
      [id],
    );

    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      res.status(404).json({ success: false, message: "Boat round not found" });
      return;
    }

    await client.query("COMMIT");
    res.json({ success: true, message: "Boat round deleted successfully" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete boat round error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};