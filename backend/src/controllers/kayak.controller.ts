import { restoreBoatTicketRedemptions } from '../services/boat-booking-lifecycle';
import { validateBoatBookingTime } from '../services/boat-booking-time';
import { boatCheckinWindow, boatCheckinError } from '../services/boat-checkin-time';
export { restoreBoatTicketRedemptions } from '../services/boat-booking-lifecycle';
import { parsePagination, paginationMeta } from '../utils/pagination';
import { Request, Response } from "express";
import { safeRollback } from '../utils/safe-rollback';
import { bangkokToday } from "../utils/bangkok-date";
import { assertStatusTransition } from '../services/booking-status';
import { PoolClient } from "pg";
import pool from "../config/database";
import { AuthPayload } from "../types";
import {
  sendBookingConfirmationEmail,
  sendBookingStatusEmail,
} from "../services/mail.service";
import { deleteCloudinaryImage } from "../services/cloudinary.service";
import { mapDbError } from "../utils/db-errors";
import { parsePositiveInt } from "../utils/ids";
import {
  boatsNeeded,
  lineSubtotal,
  sumPassengerCounts,
  sumSubtotals,
} from "../services/booking-boat.math";
import {
  MEMBER_TYPE_IDS_SQL,
  memberTypeIdsFromRow,
  parseRoundBoats,
  pickCanonicalRoundId,
  pickRoundForType,
  remainingBoats,
  roundIncludesTypeSql,
  roundTypeQuantitySql,
  typeCapacity,
  type RoundBoatInput,
} from "../services/round-boats";
import {
  ApplyResult,
  PromoApplyError,
  applyPromotionList,
  parsePromotionIds,
} from "../services/promotion-apply";
import {
  loadApplyContext,
  loadPromosForApply,
  persistBookingPromotions,
  restoreBookingPromotions,
} from "../services/promotion-ledger";

interface KayakItemInput {
  boat_type_id: number;
  num_passengers: number;
  /** ผู้ใช้เลือกจำนวนเรือเองได้ (ค่าเริ่มต้นคำนวณจากจำนวนผู้โดยสาร) — ต้องไม่น้อยกว่าที่คำนวณได้ */
  boat_count?: number;
  /** จำนวนบัตรพายเรือฟรีที่จะใช้กับบรรทัดนี้ (จากกระเป๋า member_boat_tickets) */
  free_tickets_used?: number;
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
        boat_count: item.boat_count != null ? Number(item.boat_count) : undefined,
        free_tickets_used: item.free_tickets_used != null ? Number(item.free_tickets_used) : undefined,
      };
    });
  }
  return [
    {
      boat_type_id: Number(body.kayak_id),
      num_passengers: Number(body.num_passengers ?? 1),
      boat_count: body.boat_count != null ? Number(body.boat_count) : undefined,
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

// Inventory is reused on different dates and after each time window ends.
// Group simultaneous event deltas before the running sum so adjacent bookings
// do not temporarily count the ending reservation and its replacement together.
async function peakReservedBoats(
  client: PoolClient,
  boatTypeId: number,
  boatRoundId: number | null = null,
): Promise<number> {
  const result = await client.query(
    `WITH reservations AS (
       SELECT bb.booking_date, bnb.boat_count,
              COALESCE(bb.start_time, br.start_time) AS start_time,
              COALESCE(bb.end_time, br.end_time) AS end_time
       FROM booking_boat bnb
       JOIN boat_bookings bb ON bb.boat_booking_id = bnb.boat_booking_id
       JOIN boat_rounds br ON br.boat_round_id = bnb.boat_round_id
       WHERE bnb.boat_type_id = $1
         AND ($2::int IS NULL OR bnb.boat_round_id = $2)
         AND bnb.status NOT IN ('cancelled', 'rejected', 'checked_out')
     ), events AS (
       SELECT booking_date, start_time AS event_time, boat_count AS delta FROM reservations
       UNION ALL
       SELECT booking_date, end_time AS event_time, -boat_count AS delta FROM reservations
     ), simultaneous AS (
       SELECT booking_date, event_time, SUM(delta) AS delta
       FROM events GROUP BY booking_date, event_time
     ), demand AS (
       SELECT SUM(delta) OVER (
         PARTITION BY booking_date ORDER BY event_time
         ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
       ) AS boats FROM simultaneous
     )
     SELECT COALESCE(MAX(boats), 0)::int AS n FROM demand`,
    [boatTypeId, boatRoundId],
  );
  return Number(result.rows[0].n);
}

// ตรวจนโยบายจองเรือล่วงหน้า (resort_info id = 5) — คืนข้อความ 400 เมื่อจองวันนี้ใกล้เวลาเริ่มรอบเกินไป หรือรอบเริ่มไปแล้ว
async function advanceBookingError(
  client: PoolClient,
  bookingDate: string,
  startTime: string,
): Promise<string | null> {
  if (bookingDate !== bangkokToday()) return null;
  const policy = await client.query(
    `SELECT COALESCE((SELECT boat_advance_booking_minutes FROM resort_info WHERE id = 5), 60) AS minutes`,
  );
  const minutes = Number(policy.rows[0].minutes);
  const timing = await client.query(
    `SELECT EXTRACT(EPOCH FROM (($1::date + $2::time) AT TIME ZONE 'Asia/Bangkok') - NOW()) / 60 AS minutes_until`,
    [bookingDate, startTime],
  );
  const minutesUntil = Number(timing.rows[0].minutes_until);
  if (minutesUntil < minutes) {
    return `ต้องจองล่วงหน้าอย่างน้อย ${minutes} นาทีก่อนเวลาเริ่มรอบ`;
  }
  return null;
}

// บวก/ลบวันจากสตริงวันที่ล้วน (YYYY-MM-DD) โดยไม่ยุ่งกับ timezone ของเครื่อง — ใช้ UTC เที่ยงคืนเสมอ กันวันเพี้ยน
function addDaysToDateStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ยอดคงเหลือบัตรพายเรือฟรีทั้งหมดของสมาชิก (เฉพาะกระเป๋ารวมแบบเดิม — ไม่รวมบัตรที่ผูกกับห้องพักเฉพาะ (booking_room_id))
async function getBoatTicketBalance(
  client: { query: typeof pool.query },
  memberId: number,
): Promise<number> {
  const r = await client.query(
    `SELECT COALESCE(SUM(total_tickets - used_tickets), 0) AS balance
     FROM member_boat_tickets WHERE member_id = $1 AND booking_room_id IS NULL`,
    [memberId],
  );
  return Number(r.rows[0].balance);
}

// หักบัตรพายเรือฟรีแบบ FIFO (ใบเก่าสุดก่อน) แล้วบันทึกการใช้ผูกกับการจองเรือนี้ (กระเป๋ารวมแบบเดิม)
async function redeemBoatTickets(
  client: { query: typeof pool.query },
  memberId: number,
  boatBookingId: number,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) return;
  const grants = await client.query(
    `SELECT id, total_tickets, used_tickets FROM member_boat_tickets
     WHERE member_id = $1 AND booking_room_id IS NULL AND total_tickets > used_tickets
     ORDER BY created_at ASC, id ASC
     FOR UPDATE`,
    [memberId],
  );
  let remaining = quantity;
  for (const grant of grants.rows) {
    if (remaining <= 0) break;
    const available = Number(grant.total_tickets) - Number(grant.used_tickets);
    const take = Math.min(available, remaining);
    if (take <= 0) continue;
    await client.query(
      `UPDATE member_boat_tickets SET used_tickets = used_tickets + $1 WHERE id = $2`,
      [take, grant.id],
    );
    await client.query(
      `INSERT INTO boat_ticket_redemptions (member_boat_ticket_id, boat_booking_id, quantity) VALUES ($1, $2, $3)`,
      [grant.id, boatBookingId, take],
    );
    remaining -= take;
  }
  if (remaining > 0) {
    throw new Error("บัตรพายเรือไม่พอ");
  }
}

// ยอดคงเหลือบัตรเสริมที่ผูกกับ "ห้องพักจริง" ห้องหนึ่งโดยเฉพาะ (โปรโมชั่นเสริม — ฟรีหรือขาย)
export async function getRoomBoatTicketBalance(
  client: { query: typeof pool.query },
  bookingRoomId: number,
): Promise<{ balance: number; mode: 'free' | 'paid'; unitPrice: number } | null> {
  const r = await client.query(
    `SELECT mode, unit_price, SUM(total_tickets - used_tickets) AS balance
     FROM member_boat_tickets WHERE booking_room_id = $1
     GROUP BY mode, unit_price
     ORDER BY MIN(created_at) ASC
     LIMIT 1`,
    [bookingRoomId],
  );
  if (r.rows.length === 0) return null;
  return {
    balance: Number(r.rows[0].balance),
    mode: r.rows[0].mode === 'paid' ? 'paid' : 'free',
    unitPrice: Number(r.rows[0].unit_price) || 0,
  };
}

const ROOM_BOAT_TICKETS_SHORT_MESSAGE = "บัตรเสริมไม่พอสำหรับห้องนี้";

// หักบัตรเสริมที่ผูกกับห้องพักจริงห้องนั้น แบบ FIFO เหมือนกระเป๋ารวม แต่กรองเฉพาะ booking_room_id นี้
export async function redeemRoomBoatTickets(
  client: { query: typeof pool.query },
  bookingRoomId: number,
  boatBookingId: number,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) return;
  const grants = await client.query(
    `SELECT id, total_tickets, used_tickets FROM member_boat_tickets
     WHERE booking_room_id = $1 AND total_tickets > used_tickets
     ORDER BY created_at ASC, id ASC
     FOR UPDATE`,
    [bookingRoomId],
  );
  let remaining = quantity;
  for (const grant of grants.rows) {
    if (remaining <= 0) break;
    const available = Number(grant.total_tickets) - Number(grant.used_tickets);
    const take = Math.min(available, remaining);
    if (take <= 0) continue;
    await client.query(
      `UPDATE member_boat_tickets SET used_tickets = used_tickets + $1 WHERE id = $2`,
      [take, grant.id],
    );
    await client.query(
      `INSERT INTO boat_ticket_redemptions (member_boat_ticket_id, boat_booking_id, quantity) VALUES ($1, $2, $3)`,
      [grant.id, boatBookingId, take],
    );
    remaining -= take;
  }
  if (remaining > 0) {
    throw new Error(ROOM_BOAT_TICKETS_SHORT_MESSAGE);
  }
}

// คืนบัตรพายเรือ (ฟรีหรือเสริม) ที่เคยใช้กับการจองนี้ (เรียกตอนยกเลิก/ปฏิเสธการจอง)
async function replaceRoundBoats(
  client: PoolClient,
  roundId: number,
  boats: RoundBoatInput[]
): Promise<void> {
  await client.query(`DELETE FROM round_boats WHERE boat_round_id = $1`, [
    roundId,
  ]);
  for (const item of boats) {
    await client.query(
      `INSERT INTO round_boats (boat_round_id, boat_type_id, quantity)
       VALUES ($1, $2, $3)`,
      [roundId, item.boat_type_id, item.quantity],
    );
  }
}

async function boatTypesExist(
  client: PoolClient,
  typeIds: number[]
): Promise<boolean> {
  const unique = [...new Set(typeIds)];
  if (unique.length === 0) return false;
  const result = await client.query(
    `SELECT COUNT(*)::int AS count FROM boat_types WHERE boat_type_id = ANY($1::int[])`,
    [unique],
  );
  return Number(result.rows[0].count) === unique.length;
}

function toTimeSql(value: unknown): string {
  const raw = String(value ?? "");
  return raw.includes("T") ? raw.split("T")[1].slice(0, 8) : raw;
}

// แปลงเวลารูปแบบ HH:MM หรือ HH:MM:SS เป็นนาทีนับจากเที่ยงคืน; คืน null ถ้ารูปแบบไม่ถูกต้อง
function timeToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
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
             (SELECT image_path FROM boat_images bi WHERE bi.boat_type_id = bt.boat_type_id LIMIT 1) as image,
             (SELECT coalesce(json_agg(image_path), '[]'::json) FROM boat_images bi WHERE bi.boat_type_id = bt.boat_type_id) as images
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
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }
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

    const [conflictRes, boatRes, roundRes, poolRes, quotaRes] = await Promise.all([
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
        `SELECT total_slots, start_time, end_time, boat_type_id FROM boat_rounds WHERE boat_round_id = $1`,
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
      pool.query(
        `SELECT quantity FROM round_boats WHERE boat_round_id = $1 AND boat_type_id = $2`,
        [boat_round_id, kayak_id],
      ),
    ]);

    const booked = Number(conflictRes.rows[0].booked_count);
    const fleet = Number(boatRes.rows[0]?.quantity || 0);
    const isSharedRound = roundRes.rows[0]?.boat_type_id == null;
    const roundQuantity =
      isSharedRound && quotaRes.rows.length > 0
        ? Number(quotaRes.rows[0].quantity)
        : null;
    const total = typeCapacity(fleet, roundQuantity);
    const total_slots = roundRes.rows[0]?.total_slots ?? null;
    const pool_booked = Number(poolRes.rows[0].total_booked);
    // รอบที่จองไม่ได้ตามนโยบายล่วงหน้า (เช่น เริ่มไปแล้วหรือเหลือเวลาน้อยกว่าที่กำหนด) ให้ถือว่าเหลือ 0
    const bookableRes = roundRes.rows[0]?.start_time
      ? await pool.query(`SELECT ${bookableSql("$1::date", "$2::time")} AS bookable`, [booking_date, roundRes.rows[0].start_time])
      : null;
    const isBookable = bookableRes == null || bookableRes.rows[0]?.bookable !== false;
    const remaining = !isBookable ? 0 : remainingBoats({
      fleetQuantity: fleet,
      roundQuantity,
      typeBooked: booked,
      totalSlots: total_slots === null ? null : Number(total_slots),
      poolBooked: pool_booked,
    });

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

// นโยบายจองเรือล่วงหน้า (resort_info id = 5) — รอบของวันนี้ที่เหลือเวลาน้อยกว่าที่กำหนดหรือเริ่มไปแล้วจะจองไม่ได้
const ADVANCE_MINUTES_SQL = `COALESCE((SELECT boat_advance_booking_minutes FROM resort_info WHERE id = 5), 60)`;
function bookableSql(dayExpr: string, timeExpr: string): string {
  return `NOT (${dayExpr} = (NOW() AT TIME ZONE 'Asia/Bangkok')::date
    AND EXTRACT(EPOCH FROM ((${dayExpr} + ${timeExpr}) AT TIME ZONE 'Asia/Bangkok') - NOW()) / 60 < ${ADVANCE_MINUTES_SQL})`;
}

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

    const typeExpr = "$1::int";
    const membershipSql = roundIncludesTypeSql("br", typeExpr);
    const roundQtySql = roundTypeQuantitySql("br", typeExpr);

    const result = await pool.query(
      `WITH days AS (
         SELECT generate_series($2::date, $3::date, interval '1 day')::date AS day
       ),
       rounds AS (
         SELECT DISTINCT ON (br.start_time, br.end_time)
           br.boat_round_id,
           br.start_time,
           br.end_time,
           br.total_slots,
           LEAST(
             (SELECT COALESCE(quantity, 0)::int FROM boat_types WHERE boat_type_id = $1::int),
             (${roundQtySql})::int
           ) AS quantity
         FROM boat_rounds br
         WHERE br.is_active = true AND ${membershipSql}
         ORDER BY br.start_time, br.end_time,
           (SELECT COUNT(*) FROM round_boats rb WHERE rb.boat_round_id = br.boat_round_id) DESC,
           br.boat_round_id ASC
       ),
       grid AS (
         SELECT
           d.day,
           r.boat_round_id,
           r.total_slots,
           r.quantity,
           ${bookableSql("d.day", "r.start_time")} AS bookable,
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
           WHERE g.bookable AND LEAST(
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

    const typeExpr = "$1::int";
    const membershipSql = roundIncludesTypeSql("br", typeExpr);
    const roundQtySql = roundTypeQuantitySql("br", typeExpr);

    const result = await pool.query(
      `SELECT DISTINCT ON (br.start_time, br.end_time)
         br.boat_round_id,
         br.start_time,
         br.end_time,
         br.total_slots,
         (SELECT COALESCE(quantity, 0)::int FROM boat_types WHERE boat_type_id = $1::int) AS fleet,
         ${bookableSql("$2::date", "br.start_time")} AS bookable,
         (${roundQtySql})::int AS round_qty,
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
       WHERE br.is_active = true AND ${membershipSql}
       ORDER BY br.start_time, br.end_time,
         (SELECT COUNT(*) FROM round_boats rb WHERE rb.boat_round_id = br.boat_round_id) DESC,
         br.boat_round_id ASC`,
      [kayakId, booking_date],
    );

    const rounds: KayakRoundAvailability[] = result.rows.map((row) => {
      const fleet = Number(row.fleet);
      const roundQuantity = Number(row.round_qty);
      const booked = Number(row.booked);
      const totalSlots =
        row.total_slots === null ? null : Number(row.total_slots);
      const poolBooked = Number(row.pool_booked);
      const total = typeCapacity(fleet, roundQuantity);
      const remaining = row.bookable !== true ? 0 : remainingBoats({
        fleetQuantity: fleet,
        roundQuantity,
        typeBooked: booked,
        totalSlots,
        poolBooked,
      });

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
    if (kayak_id && !(Number.isInteger(Number(kayak_id)) && Number(kayak_id) > 0)) {
      res.status(400).json({ success: false, message: "kayak_id ไม่ถูกต้อง", code: "INVALID_KAYAK" });
      return;
    }
    let query = `SELECT * FROM boat_rounds br WHERE br.is_active = true`;
    const params: string[] = [];
    if (kayak_id) {
      query += ` AND ${roundIncludesTypeSql("br", "$1")}`;
      params.push(String(kayak_id));
    }
    query += ` ORDER BY br.start_time`;

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
    if (booking_date < bangkokToday()) {
      res.status(400).json({ success: false, message: "ไม่สามารถจองวันที่ย้อนหลังได้" });
      return;
    }

    if (user.role !== "customer" && user.role !== "admin") {
      res.status(403).json({
        success: false,
        message: "เฉพาะสมาชิกลูกค้าหรือผู้ดูแลระบบเท่านั้นที่สามารถจองเรือได้",
      });
      return;
    }

    let bookingMemberId = user.id;
    if (user.role === 'admin') {
      const adminMemberRes = await client.query('SELECT member_id FROM members WHERE email = $1', [user.email]);
      if (adminMemberRes.rows.length > 0) {
        bookingMemberId = adminMemberRes.rows[0].member_id;
      } else {
        const newAdminMember = await client.query(
          `INSERT INTO members (email, password, first_name, last_name, phone, is_active)
           VALUES ($1, 'ADMIN_TEST_ACCOUNT', 'Admin', 'Staff', '0800000000', true)
           RETURNING member_id`,
          [user.email]
        );
        bookingMemberId = newAdminMember.rows[0].member_id;
      }
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
      if (
        item.free_tickets_used != null &&
        (!Number.isInteger(item.free_tickets_used) || item.free_tickets_used < 0)
      ) {
        res.status(400).json({ success: false, message: "free_tickets_used ไม่ถูกต้อง" });
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
        await safeRollback(client);
        res.status(404).json({ success: false, message: "Boat round not found" });
        return;
      }
      startTime = normalizeTimePart(roundLookup.rows[0].start_time);
      endTime = normalizeTimePart(roundLookup.rows[0].end_time);
    }

    if (!startTime || !endTime) {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: "ต้องระบุ start_time และ end_time",
      });
      return;
    }

    const advanceError = await advanceBookingError(client, booking_date, startTime);
    if (advanceError) {
      await safeRollback(client);
      res.status(400).json({ success: false, message: advanceError });
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
    const timeError = await validateBoatBookingTime(client, booking_date, startTime, endTime);
    if (timeError) {
      await safeRollback(client);
      res.status(400).json({ success: false, message: timeError });
      return;
    }
    let poolSlots: number | null = null;

    // Lock types in ascending id order to reduce deadlock risk
    const sortedItems = [...items].sort((a, b) => a.boat_type_id - b.boat_type_id);

    const candidateRes = await client.query(
      `SELECT br.boat_round_id, br.boat_type_id, br.max_booking, br.total_slots, br.is_active,
              ${MEMBER_TYPE_IDS_SQL} AS member_type_ids
       FROM boat_rounds br
       WHERE br.start_time = $1::time
         AND br.end_time = $2::time
       ORDER BY br.boat_round_id
       FOR UPDATE OF br`,
      [startTime, endTime],
    );

    const candidates = candidateRes.rows.filter((row: { is_active: boolean }) => row.is_active).map((row) => ({
      boat_round_id: Number(row.boat_round_id),
      boat_type_id: row.boat_type_id == null ? null : Number(row.boat_type_id),
      memberTypeIds: memberTypeIdsFromRow(row),
      max_booking: row.max_booking == null ? null : Number(row.max_booking),
      total_slots: row.total_slots == null ? null : Number(row.total_slots),
    }));

    const coveringRoundId = pickCanonicalRoundId(
      candidates,
      sortedItems.map((item) => item.boat_type_id),
    );

    for (const item of sortedItems) {
      const btResult = await client.query(
        `SELECT boat_type_id, type_name, price, quantity, seat_count
         FROM boat_types WHERE boat_type_id = $1 FOR UPDATE`,
        [item.boat_type_id],
      );
      if (btResult.rows.length === 0) {
        await safeRollback(client);
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
        const minBoatCount = boatsNeeded(item.num_passengers, seatCount);
        if (item.boat_count != null) {
          if (!Number.isInteger(item.boat_count) || item.boat_count < minBoatCount) {
            throw new Error(
              `จำนวนเรือของ ${boatType.type_name} ต้องมีอย่างน้อย ${minBoatCount} ลำสำหรับผู้โดยสาร ${item.num_passengers} คน`
            );
          }
          boatCount = item.boat_count;
        } else {
          boatCount = minBoatCount;
        }
      } catch (err) {
        await safeRollback(client);
        res.status(400).json({
          success: false,
          message: err instanceof Error ? err.message : "ข้อมูลผู้โดยสารไม่ถูกต้อง",
        });
        return;
      }

      const roundId =
        coveringRoundId ?? pickRoundForType(candidates, item.boat_type_id);
      const round = candidates.find((c) => c.boat_round_id === roundId);
      if (roundId == null || !round) {
        await safeRollback(client);
        res.status(409).json({
          success: false,
          message: `ไม่มีรอบเวลาที่เลือกสำหรับเรือ ${boatType.type_name}`,
        });
        return;
      }
      if (poolSlots === null && round.total_slots != null) {
        poolSlots = round.total_slots;
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

      const quotaRes = await client.query(
        `SELECT quantity FROM round_boats
         WHERE boat_round_id = $1 AND boat_type_id = $2
         FOR UPDATE`,
        [round.boat_round_id, item.boat_type_id],
      );
      const roundQuantity =
        round.boat_type_id == null && quotaRes.rows.length > 0
          ? Number(quotaRes.rows[0].quantity)
          : null;
      const quantity = typeCapacity(
        Number(boatType.quantity || 0),
        roundQuantity,
      );

      if (bookedBoats + boatCount > quantity) {
        await safeRollback(client);
        res.status(409).json({
          success: false,
          message: `เรือ ${boatType.type_name} เต็มในรอบที่เลือก (ต้องการ ${boatCount} ลำ)`,
        });
        return;
      }

      // Passenger cap stays per-type only on leftover 1:1 rounds.
      // Shared M2M rounds use round_boats.quantity + total_slots instead.
      const maxBooking = coveringRoundId != null ? null : round.max_booking;
      if (maxBooking != null && totalPassengers + item.num_passengers > maxBooking) {
        await safeRollback(client);
        res.status(409).json({
          success: false,
          message: `เกินจำนวนที่รับจองสำหรับเรือ ${boatType.type_name} ในรอบนี้ (สูงสุด ${maxBooking})`,
        });
        return;
      }

      const unitPrice = Number(boatType.price);
      prepared.push({
        boat_type_id: item.boat_type_id,
        boat_round_id: round.boat_round_id,
        type_name: String(boatType.type_name),
        num_passengers: item.num_passengers,
        boat_count: boatCount,
        unit_price: unitPrice,
        subtotal: lineSubtotal(unitPrice, boatCount),
        max_booking: maxBooking,
        total_slots: round.total_slots,
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
        await safeRollback(client);
        res.status(409).json({
          success: false,
          message: `ท่าเรือเต็มในรอบนี้ (รองรับสูงสุด ${poolSlots} ลำ รวมทุกประเภท)`,
        });
        return;
      }
    }

    // ใช้บัตรพายเรือฟรี (ถ้ามี) — หักราคาบรรทัดนั้นตามจำนวนบัตรที่ใช้ ไม่เกินจำนวนเรือของบรรทัดนั้นและยอดคงเหลือของสมาชิก
    const freeTicketsByType = new Map<number, number>();
    for (const item of items) {
      if (item.free_tickets_used) freeTicketsByType.set(item.boat_type_id, item.free_tickets_used);
    }
    let totalFreeTicketsApplied = 0;
    const totalFreeTicketsRequested = [...freeTicketsByType.values()].reduce((a, b) => a + b, 0);
    if (totalFreeTicketsRequested > 0) {
      let budget = await getBoatTicketBalance(client, bookingMemberId);
      for (const line of prepared) {
        const requested = freeTicketsByType.get(line.boat_type_id) ?? 0;
        if (requested <= 0) continue;
        const applied = Math.min(requested, line.boat_count, budget);
        if (applied <= 0) continue;
        line.subtotal = Math.max(0, line.subtotal - applied * line.unit_price);
        budget -= applied;
        totalFreeTicketsApplied += applied;
      }
      if (totalFreeTicketsApplied < totalFreeTicketsRequested) {
        // ขอใช้มากกว่าที่มีจริง (หรือมากกว่าจำนวนเรือของบรรทัดนั้น) — แจ้งเตือนแทนที่จะเงียบๆ ใช้แค่บางส่วน
        await safeRollback(client);
        res.status(400).json({ success: false, message: "บัตรพายเรือไม่พอ หรือจำนวนที่ขอใช้เกินจำนวนเรือของบรรทัดนั้น" });
        return;
      }
    }

    const totalPassengersHeader = sumPassengerCounts(prepared);
    let totalPrice = sumSubtotals(prepared.map((line) => line.subtotal));
    const promoIds = parsePromotionIds(body);
    let applyResult: ApplyResult = {
      totalPrice,
      lines: [],
      headerPromotionId: null,
    };
    if (promoIds.length > 0) {
      try {
        const catalog = await loadPromosForApply(client, promoIds);
        const ctxExtra = await loadApplyContext(client, bookingMemberId, promoIds);
        applyResult = applyPromotionList(catalog, {
          memberId: bookingMemberId,
          nights: null,
          basePrice: totalPrice,
          now: new Date(),
          scope: 'kayak',
          ...ctxExtra,
        });
        totalPrice = applyResult.totalPrice;
      } catch (err) {
        await safeRollback(client);
        res.status(400).json({
          success: false,
          message:
            err instanceof PromoApplyError || err instanceof Error
              ? err.message
              : "โปรโมชั่นไม่ถูกต้อง",
        });
        return;
      }
    }

    const headerRes = await client.query(
      `INSERT INTO boat_bookings (
         member_id, booking_date, start_time, end_time,
         num_passengers, total_price, status
       ) VALUES ($1, $2, $3::time, $4::time, $5, $6, 'pending')
       RETURNING *`,
      [
        bookingMemberId,
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

    if (applyResult.lines.length > 0) {
      await persistBookingPromotions(client, {
        memberId: bookingMemberId,
        boatBookingId: Number(header.boat_booking_id),
        result: applyResult,
      });
    }

    if (totalFreeTicketsApplied > 0) {
      try {
        await redeemBoatTickets(client, bookingMemberId, Number(header.boat_booking_id), totalFreeTicketsApplied);
      } catch (err) {
        await safeRollback(client);
        res.status(400).json({
          success: false,
          message: err instanceof Error ? err.message : "ใช้บัตรพายเรือไม่สำเร็จ",
        });
        return;
      }
    }

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
        boat_tickets_used: totalFreeTicketsApplied,
      },
    });
  } catch (error) {
    await safeRollback(client);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    console.error("Create kayak booking error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};

// ข้อมูลบัตรเสริมของห้องพักจริงห้องหนึ่ง (ยอดคงเหลือ, โหมด, ราคา, ช่วงวันที่ใช้ได้, รายการที่จองไปแล้ว)
// ใช้แสดงหน้าเลือกประเภทเรือ/เวลา ตอนลูกค้ากดชำระเงินห้องพัก
export const getBoatAddonInfo = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const bookingRoomId = parsePositiveInt(req.params.bookingRoomId);
    if (bookingRoomId === null) {
      res.status(400).json({ success: false, message: "Invalid booking_room id" });
      return;
    }

    const roomRes = await pool.query(
      `SELECT br.booking_room_id, br.status AS room_line_status, rb.room_booking_id, rb.member_id, rb.check_in::text AS check_in, rb.check_out::text AS check_out, rb.status AS room_status
       FROM booking_room br
       JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
       WHERE br.booking_room_id = $1`,
      [bookingRoomId],
    );
    if (roomRes.rows.length === 0) {
      res.status(404).json({ success: false, message: "Booking room not found" });
      return;
    }
    const room = roomRes.rows[0];
    if (room.member_id !== user.id && user.role === "customer") {
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }

    const ticketInfo = await getRoomBoatTicketBalance(pool, bookingRoomId);
    const ticketTotals = await pool.query(
      `SELECT COALESCE(SUM(total_tickets), 0) AS total_tickets,
              COALESCE(SUM(used_tickets), 0) AS used_tickets
       FROM member_boat_tickets WHERE booking_room_id = $1`,
      [bookingRoomId],
    );

    // ใช้สิทธิ์ได้รวมวันเช็คอินและวันเช็คเอาต์ ตามรอบเรือที่เปิดให้จอง
    const validFrom = addDaysToDateStr(room.check_in, 0);
    const validTo = addDaysToDateStr(room.check_out, 0);

    const existingRes = await pool.query(
      `SELECT bb.boat_booking_id, bb.booking_date, bb.start_time, bb.end_time, bb.status,
              bb.addon_mode AS mode, bb.total_price AS price, bb.printed_at, bb.handed_out_at, bb.checkin_at,
              bnb.boat_type_id, bt.type_name AS boat_type_name, bnb.boat_count, bnb.num_passengers
       FROM boat_bookings bb
       JOIN booking_boat bnb ON bnb.boat_booking_id = bb.boat_booking_id
       JOIN boat_types bt ON bt.boat_type_id = bnb.boat_type_id
       WHERE bb.booking_room_id = $1 AND bb.is_addon = true
       ORDER BY bb.booking_date ASC`,
      [bookingRoomId],
    );

    res.json({
      success: true,
      data: {
        room_status: room.room_status,
        room_line_status: room.room_line_status,
        balance: ticketInfo?.balance ?? 0,
        total_tickets: Number(ticketTotals.rows[0]?.total_tickets ?? 0),
        used_tickets: Number(ticketTotals.rows[0]?.used_tickets ?? 0),
        mode: ticketInfo?.mode ?? "free",
        unit_price: ticketInfo?.unitPrice ?? 0,
        valid_from: validFrom > validTo ? null : validFrom,
        valid_to: validFrom > validTo ? null : validTo,
        existing_addons: existingRes.rows,
      },
    });
  } catch (error) {
    console.error("Get boat addon info error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// สร้างการจองเรือ "บัตรเสริม" ผูกกับห้องพักจริง — จองคิวรอบจริงทันที (กันโควตา) ต้องอยู่ในช่วงวันที่เข้าพักเท่านั้น
export const createBoatAddon = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const client = await pool.connect();
  try {
    const user = req.user as AuthPayload;
    const bookingRoomId = parsePositiveInt(req.params.bookingRoomId);
    const body = req.body as Record<string, unknown>;
    const boatTypeId = Number(body.boat_type_id);
    const boatRoundId = Number(body.boat_round_id);
    const bookingDate = String(body.booking_date);
    if (bookingDate < bangkokToday()) {
      res.status(400).json({ success: false, message: "ไม่สามารถจองวันที่ย้อนหลังได้" });
      return;
    }
    const numPassengers = Math.max(1, Number(body.num_passengers) || 1);

    if (bookingRoomId === null) {
      res.status(400).json({ success: false, message: "Invalid booking_room id" });
      return;
    }
    if (!Number.isInteger(boatTypeId) || !Number.isInteger(boatRoundId) || !bookingDate) {
      res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
      return;
    }

    await client.query("BEGIN");

    // Slip submission and room status actions lock the header before its lines.
    // Match that order, and keep the header locked while checking paid addons so
    // a slip cannot be accepted against an amount that changes underneath it.
    const roomHeader = await client.query(
      `SELECT rb.room_booking_id
       FROM room_bookings rb
       WHERE rb.room_booking_id = (
         SELECT room_booking_id FROM booking_room WHERE booking_room_id = $1
       ) FOR UPDATE OF rb`,
      [bookingRoomId],
    );
    if (roomHeader.rows.length === 0) {
      await safeRollback(client);
      res.status(404).json({ success: false, message: "Booking room not found" });
      return;
    }

    const roomRes = await client.query(
      `SELECT br.booking_room_id, br.status AS room_line_status, rb.room_booking_id, rb.member_id, rb.check_in::text AS check_in, rb.check_out::text AS check_out, rb.status AS room_status
       FROM booking_room br
       JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
       WHERE br.booking_room_id = $1
       FOR UPDATE OF br`,
      [bookingRoomId],
    );
    if (roomRes.rows.length === 0) {
      await safeRollback(client);
      res.status(404).json({ success: false, message: "Booking room not found" });
      return;
    }
    const room = roomRes.rows[0];
    if (room.member_id !== user.id) {
      await safeRollback(client);
      res.status(403).json({ success: false, message: "Forbidden" });
      return;
    }
    if (!["pending", "paid", "approved"].includes(room.room_status)) {
      await safeRollback(client);
      res.status(400).json({ success: false, message: "ห้องพักนี้ไม่สามารถใช้บัตรเสริมได้แล้ว" });
      return;
    }

    if (!["pending", "paid", "approved", "checked_in"].includes(room.room_line_status ?? room.room_status)) {
      await safeRollback(client);
      res.status(400).json({ success: false, message: "ห้องที่สิ้นสุดการเข้าพักแล้วไม่สามารถจองเรือเสริมได้" });
      return;
    }

    // รวมวันเช็คอินและวันเช็คเอาต์ แต่ยังตรวจรอบ เวลาเผื่อจอง และโควตาเรือ
    const validFrom = addDaysToDateStr(room.check_in, 0);
    const validTo = addDaysToDateStr(room.check_out, 0);
    if (validFrom > validTo || bookingDate < validFrom || bookingDate > validTo) {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: "เลือกวันที่ใช้สิทธิ์ได้ตั้งแต่วันเช็คอินถึงวันเช็คเอาต์เท่านั้น",
      });
      return;
    }

    const ticketInfo = await getRoomBoatTicketBalance(client, bookingRoomId);
    if (!ticketInfo || ticketInfo.balance <= 0) {
      await safeRollback(client);
      res.status(400).json({ success: false, message: "ห้องนี้ไม่มีบัตรเสริมเหลือแล้ว" });
      return;
    }

    // Use the same shared-window lock set and order as normal kayak bookings.
    // Never lock the selected round first: distinct selected IDs could deadlock
    // while each request subsequently waits for the other round in this pool.
    const roundLookup = await client.query(
      `SELECT br.boat_round_id, br.start_time, br.end_time, br.total_slots
       FROM boat_rounds br
       WHERE br.boat_round_id = $1 AND br.is_active = true`,
      [boatRoundId],
    );
    if (roundLookup.rows.length === 0) {
      await safeRollback(client);
      res.status(404).json({ success: false, message: "ไม่พบรอบเวลาที่เลือก" });
      return;
    }
    const selectedWindow = roundLookup.rows[0];
    const timeError = await validateBoatBookingTime(client, bookingDate, String(selectedWindow.start_time), String(selectedWindow.end_time));
    if (timeError) {
      await safeRollback(client);
      res.status(400).json({ success: false, message: timeError });
      return;
    }
    const roundRes = await client.query(
      `SELECT br.boat_round_id, br.start_time, br.end_time, br.total_slots, br.is_active
       FROM boat_rounds br
       WHERE br.start_time = $1::time AND br.end_time = $2::time
       ORDER BY br.boat_round_id FOR UPDATE OF br`,
      [selectedWindow.start_time, selectedWindow.end_time],
    );
    const round = roundRes.rows.find((row: { boat_round_id: number; is_active: boolean }) => row.is_active && Number(row.boat_round_id) === boatRoundId);
    if (!round) {
      await safeRollback(client);
      res.status(409).json({ success: false, message: "รอบเวลาที่เลือกเปลี่ยนไปแล้ว กรุณาเลือกอีกครั้ง" });
      return;
    }

    const addonAdvanceError = await advanceBookingError(client, bookingDate, String(round.start_time));
    if (addonAdvanceError) {
      await safeRollback(client);
      res.status(400).json({ success: false, message: addonAdvanceError });
      return;
    }

    const btRes = await client.query(
      `SELECT boat_type_id, type_name, price, quantity, seat_count FROM boat_types WHERE boat_type_id = $1 FOR UPDATE`,
      [boatTypeId],
    );
    if (btRes.rows.length === 0) {
      await safeRollback(client);
      res.status(404).json({ success: false, message: "ไม่พบประเภทเรือ" });
      return;
    }
    const boatType = btRes.rows[0];

    // ประเภทเรือต้องอยู่ในรอบเวลาที่เลือก (เหมือนการจองเรือปกติใน createKayakBooking)
    const memberRes = await client.query(
      `SELECT 1 FROM boat_rounds br
       WHERE br.boat_round_id = $1 AND ${roundIncludesTypeSql("br", "$2::int")}`,
      [boatRoundId, boatTypeId],
    );
    if (memberRes.rows.length === 0) {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: `เรือ ${boatType.type_name} ไม่ได้อยู่ในรอบเวลาที่เลือก`,
      });
      return;
    }

    const seatCount = Number(boatType.seat_count || 1);
    const minBoatCount = boatsNeeded(numPassengers, seatCount);
    const requestedBoats = body.boat_count == null ? null : Number(body.boat_count);
    if (requestedBoats !== null && !Number.isInteger(requestedBoats)) {
      await safeRollback(client);
      res.status(400).json({ success: false, message: "จำนวนเรือต้องเป็นจำนวนเต็ม" });
      return;
    }
    const boatCount = requestedBoats !== null && requestedBoats >= minBoatCount ? requestedBoats : minBoatCount;

    if (boatCount > ticketInfo.balance) {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: `บัตรเสริมเหลือไม่พอ (เหลือ ${ticketInfo.balance} ครั้ง ต้องการ ${boatCount} ลำ)`,
      });
      return;
    }

    const conflict = await client.query(
      `SELECT COALESCE(SUM(bnb.boat_count), 0) as booked_boats
       FROM booking_boat bnb
       JOIN boat_bookings bb ON bb.boat_booking_id = bnb.boat_booking_id
       WHERE bnb.boat_type_id = $1
         AND bb.booking_date = $2
         AND bnb.boat_round_id = $3
         AND bnb.status NOT IN ('cancelled', 'rejected')`,
      [boatTypeId, bookingDate, boatRoundId],
    );
    const bookedBoats = Number(conflict.rows[0].booked_boats);

    const quotaRes = await client.query(
      `SELECT quantity FROM round_boats WHERE boat_round_id = $1 AND boat_type_id = $2 FOR UPDATE`,
      [boatRoundId, boatTypeId],
    );
    const roundQuantity = quotaRes.rows.length > 0 ? Number(quotaRes.rows[0].quantity) : null;
    const quantity = typeCapacity(Number(boatType.quantity || 0), roundQuantity);

    if (bookedBoats + boatCount > quantity) {
      await safeRollback(client);
      res.status(409).json({
        success: false,
        message: `เรือ ${boatType.type_name} เต็มในรอบที่เลือกแล้ว`,
      });
      return;
    }

    // ท่าเรือรวมทุกประเภทในช่วงเวลาเดียวกัน (total_slots) ต้องไม่เกินความจุ
    const poolSlots = round.total_slots == null ? null : Number(round.total_slots);
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
        [bookingDate, round.start_time, round.end_time],
      );
      const totalBooked = Number(poolRes.rows[0].total_booked);
      if (totalBooked + boatCount > poolSlots) {
        await safeRollback(client);
        res.status(409).json({
          success: false,
          message: `ท่าเรือเต็มในรอบนี้ (รองรับสูงสุด ${poolSlots} ลำ รวมทุกประเภท)`,
        });
        return;
      }
    }

    // บัตรเสริมแบบชำระเงินเพิ่มได้เฉพาะก่อนชำระค่าห้อง เพื่อไม่ให้ยอดไม่ตรงกับสลิปที่ลูกค้าโอนแล้ว
    if (ticketInfo.mode === "paid" && (room.room_status === "paid" || room.room_status === "approved")) {
      await safeRollback(client);
      res.status(400).json({ success: false, message: "ไม่สามารถเพิ่มบัตรเสริมแบบชำระเงินหลังชำระค่าห้องแล้ว" });
      return;
    }
    const priceCharged = ticketInfo.mode === "paid" ? ticketInfo.unitPrice * boatCount : 0;
    // ราคาต่อหน่วยในบรรทัดต้องตรงกับ subtotal: โหมดขายใช้ราคาบัตรเสริม, โหมดฟรีคงราคาเรือปกติไว้อ้างอิง
    const lineUnitPrice = ticketInfo.mode === "paid" ? ticketInfo.unitPrice : Number(boatType.price);
    const initialStatus = room.room_status === "approved" ? "approved" : "pending";

    const headerRes = await client.query(
      `INSERT INTO boat_bookings (
         member_id, booking_date, start_time, end_time, num_passengers, total_price, status,
         room_booking_id, booking_room_id, is_addon, addon_mode
       ) VALUES ($1, $2, $3::time, $4::time, $5, $6, $7, $8, $9, true, $10)
       RETURNING *`,
      [
        user.id,
        bookingDate,
        round.start_time,
        round.end_time,
        numPassengers,
        priceCharged,
        initialStatus,
        room.room_booking_id,
        bookingRoomId,
        ticketInfo.mode,
      ],
    );
    const header = headerRes.rows[0];

    await client.query(
      `INSERT INTO booking_boat (
         boat_booking_id, boat_type_id, boat_round_id, num_passengers, boat_count, unit_price, subtotal, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [header.boat_booking_id, boatTypeId, boatRoundId, numPassengers, boatCount, lineUnitPrice, priceCharged, initialStatus],
    );

    try {
      await redeemRoomBoatTickets(client, bookingRoomId, header.boat_booking_id, boatCount);
    } catch (redeemError) {
      if (redeemError instanceof Error && redeemError.message === ROOM_BOAT_TICKETS_SHORT_MESSAGE) {
        await safeRollback(client);
        res.status(400).json({ success: false, message: ROOM_BOAT_TICKETS_SHORT_MESSAGE });
        return;
      }
      throw redeemError;
    }

    if (ticketInfo.mode === "paid" && priceCharged > 0) {
      await client.query(
        `UPDATE room_bookings SET total_price = total_price + $1, updated_at = NOW() WHERE room_booking_id = $2`,
        [priceCharged, room.room_booking_id],
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "เพิ่มบัตรเสริมสำเร็จ",
      data: {
        ...header,
        boat_type_name: boatType.type_name,
        boat_count: boatCount,
        price_charged: priceCharged,
      },
    });
  } catch (error) {
    await safeRollback(client);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    console.error("Create boat addon error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};

// พนักงานกดมอบบัตรเสริม (พิมพ์+มอบให้ลูกค้าพร้อมกุญแจห้องตอนเช็คอิน)
const CANCELLED_ADDON_MESSAGE = "บัตรเสริมนี้ถูกยกเลิกหรือปฏิเสธแล้ว";

// ตรวจว่าบัตรเสริมมีอยู่และยังใช้งานได้ — คืนข้อความตอบกลับ 404/400 หรือ null เมื่อผ่าน
async function findActiveAddonError(boatBookingId: number): Promise<{ status: number; message: string } | null> {
  const found = await pool.query(
    `SELECT status FROM boat_bookings WHERE boat_booking_id = $1 AND is_addon = true`,
    [boatBookingId],
  );
  if (found.rows.length === 0) return { status: 404, message: "ไม่พบบัตรเสริมนี้" };
  if (["cancelled", "rejected"].includes(String(found.rows[0].status))) {
    return { status: 400, message: CANCELLED_ADDON_MESSAGE };
  }
  return null;
}

export const printBoatAddon = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const boatBookingId = parsePositiveInt(req.params.boatBookingId);
    if (boatBookingId === null) {
      res.status(400).json({ success: false, message: "Invalid boat booking id" });
      return;
    }
    const result = await pool.query(
      `UPDATE boat_bookings SET printed_at = COALESCE(printed_at, NOW())
       WHERE boat_booking_id = $1 AND is_addon = true AND status NOT IN ('cancelled', 'rejected')
       RETURNING *`,
      [boatBookingId],
    );
    if (result.rows.length === 0) {
      const blocked = await findActiveAddonError(boatBookingId);
      res.status(blocked?.status ?? 404).json({ success: false, message: blocked?.message ?? "ไม่พบบัตรเสริมนี้" });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Print boat addon error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const handOutBoatAddon = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const boatBookingId = parsePositiveInt(req.params.boatBookingId);
    if (boatBookingId === null) {
      res.status(400).json({ success: false, message: "Invalid boat booking id" });
      return;
    }
    const staffId = ["admin", "room_staff", "boat_staff"].includes(user?.role) ? user.id : null;
    // มอบได้เฉพาะบัตรที่อนุมัติแล้ว และห้องพักต้องอนุมัติแล้ว (กันมอบบัตรก่อนลูกค้าชำระค่าห้อง)
    // ไม่เขียนทับ handed_out_at ถ้าเคยมอบแล้ว (เรียกซ้ำได้โดยไม่เปลี่ยนเวลาเดิม)
    const result = await pool.query(
      `UPDATE boat_bookings
       SET handed_out_at = COALESCE(handed_out_at, NOW()),
           handed_out_by_staff_id = COALESCE(handed_out_by_staff_id, $2)
       WHERE boat_booking_id = $1 AND is_addon = true AND status = 'approved'
         AND EXISTS (
           SELECT 1 FROM room_bookings rb
           WHERE rb.room_booking_id = boat_bookings.room_booking_id AND rb.status = 'approved'
         )
       RETURNING *`,
      [boatBookingId, staffId],
    );
    if (result.rows.length === 0) {
      const blocked = await findActiveAddonError(boatBookingId);
      if (blocked) {
        res.status(blocked.status).json({ success: false, message: blocked.message });
        return;
      }
      res.status(400).json({ success: false, message: "มอบบัตรเสริมได้เมื่อการจองห้องพักได้รับการอนุมัติแล้ว" });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Hand out boat addon error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ดึงรายละเอียดการจองเรือรายการเดียว (ใช้ในหน้าชำระเงิน) — เจ้าของการจองหรือ admin/boat_staff เท่านั้น
export const getKayakBookingById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }

    const result = await pool.query(
      `SELECT bb.*, ${BOATS_JSON_SQL} AS boats
       FROM boat_bookings bb
       WHERE bb.boat_booking_id = $1 AND (($3 = 'customer' AND bb.member_id = $2) OR $3 IN ('admin', 'boat_staff'))`,
      [id, user.id, user.role],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error("Get kayak booking error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
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
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }

    await client.query("BEGIN");
    const booking = await client.query(
      "SELECT * FROM boat_bookings WHERE boat_booking_id = $1 AND member_id = $2 FOR UPDATE",
      [id, user.id],
    );
    if (booking.rows.length === 0) {
      await safeRollback(client);
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }
    if (booking.rows[0].is_addon) {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: "บัตรเสริมต้องยกเลิกผ่านการยกเลิกบัตรเสริมจากหน้าห้องพัก",
      });
      return;
    }
    if (booking.rows[0].status !== "pending") {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: `Cannot cancel booking with status: ${booking.rows[0].status}`,
      });
      return;
    }

    await restoreBookingPromotions(client, {
      previousStatus: String(booking.rows[0].status),
      boatBookingId: Number(id),
    });
    await restoreBoatTicketRedemptions(client, Number(id));

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
    await safeRollback(client);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
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
    const pagination = parsePagination(req.query);
    const params: (string | number)[] = [];
    let where = 'WHERE 1=1';
    const pendingSlip = "NULLIF(bb.payment_slip, '') IS NOT NULL AND bb.status NOT IN ('approved', 'checked_out', 'rejected', 'cancelled')";
    const unpaidPending = "NULLIF(bb.payment_slip, '') IS NULL AND bb.status = 'pending'";
    if (req.query.filter === 'has_slip') where += ` AND (${pendingSlip})`;
    else if (req.query.filter === 'pending') where += ` AND (${unpaidPending})`;
    else if (req.query.filter === 'approved' || req.query.filter === 'checked_out') {
      params.push(req.query.filter); where += ` AND bb.status = $${params.length}`;
    }
    if (typeof req.query.status === 'string') { params.push(req.query.status); where += ` AND bb.status = $${params.length}`; }
    const type = req.query.boat_type;
    if (typeof type === 'string' && type !== 'all') {
      params.push(type);
      where += ` AND EXISTS (SELECT 1 FROM booking_boat bnb JOIN boat_types bt ON bt.boat_type_id = bnb.boat_type_id
         WHERE bnb.boat_booking_id = bb.boat_booking_id AND bt.type_name = $${params.length})`;
    }
    for (const [key, operator] of [['date_from', '>='], ['date_to', '<=']]) {
      if (typeof req.query[key] === 'string') { params.push(req.query[key] as string); where += ` AND bb.booking_date::date ${operator} $${params.length}::date`; }
    }
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      params.push(`%${req.query.search.trim()}%`);
      where += ` AND (bb.boat_booking_id::text ILIKE $${params.length}
        OR CONCAT_WS(' ', m.first_name, m.last_name) ILIKE $${params.length}
        OR m.phone ILIKE $${params.length} OR m.email ILIKE $${params.length}
         OR EXISTS (SELECT 1 FROM booking_boat bnb JOIN boat_types bt ON bt.boat_type_id = bnb.boat_type_id
          WHERE bnb.boat_booking_id = bb.boat_booking_id AND bt.type_name ILIKE $${params.length}))`;
    }
    const from = `FROM boat_bookings bb
       JOIN members m ON bb.member_id = m.member_id
       LEFT JOIN staff s ON bb.approved_by_staff_id = s.staff_id`;
    let extra = {};
    if (pagination) {
      const count = await pool.query(`SELECT COUNT(*) AS total ${from} ${where}`, params);
      const summary = await pool.query(`SELECT COUNT(*) AS "all",
        COUNT(*) FILTER (WHERE ${pendingSlip}) AS has_slip,
        COUNT(*) FILTER (WHERE ${unpaidPending}) AS pending,
        COUNT(*) FILTER (WHERE bb.status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE bb.status = 'checked_out') AS checked_out,
        COALESCE(SUM(bb.total_price) FILTER (WHERE bb.status IN ('approved', 'checked_out')), 0) AS "totalRevenue",
        COALESCE(SUM(bb.total_price) FILTER (WHERE ${pendingSlip}), 0) AS "pendingRevenue"
        ${from}`);
      const row = summary.rows[0];
      extra = { pagination: paginationMeta(pagination, Number(count.rows[0].total)),
        summary: { all: Number(row.all), has_slip: Number(row.has_slip), pending: Number(row.pending), approved: Number(row.approved),
          checked_out: Number(row.checked_out), totalRevenue: Number(row.totalRevenue), pendingRevenue: Number(row.pendingRevenue) } };
    }
    const result = await pool.query(
      `SELECT bb.*,
              (
                SELECT string_agg(bt.type_name, ', ' ORDER BY bnb.booking_boat_id)
                FROM booking_boat bnb
                JOIN boat_types bt ON bt.boat_type_id = bnb.boat_type_id
                WHERE bnb.boat_booking_id = bb.boat_booking_id
              ) as kayak_name,
              CONCAT_WS(' ', m.first_name, m.last_name) as user_name, m.email as user_email, m.phone as user_phone,
              CONCAT_WS(' ', s.first_name, s.last_name) as approved_by_name,
              ${BOATS_JSON_SQL} AS boats
       ${from} ${where}
       ORDER BY bb.created_at DESC, bb.boat_booking_id DESC
       ${pagination ? `LIMIT $${params.length + 1} OFFSET $${params.length + 2}` : ''}`,
      pagination ? [...params, pagination.limit, pagination.offset] : params
    );
    res.json({ success: true, data: result.rows, ...extra });
  } catch (error: unknown) {
    console.error("Get all kayak bookings error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getAllKayaksAdmin = async (
  req: Request,
  res: Response,
): Promise<void> => {
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
      data: result.rows,
    });
  } catch (error) {
    console.error("getAllKayaksAdmin error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
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

    // ตรวจค่าก่อนบันทึก: quantity = 0 ต้องคงเป็น 0 (เดิม quantity || 1 ทำให้กลายเป็น 1)
    const typeName = typeof name === "string" ? name.trim() : "";
    if (!typeName) {
      res.status(400).json({ success: false, message: "กรุณาระบุชื่อประเภทเรือ" });
      return;
    }
    const seats = Number(capacity);
    if (!Number.isInteger(seats) || seats < 1) {
      res.status(400).json({ success: false, message: "จำนวนที่นั่งต้องเป็นจำนวนเต็มอย่างน้อย 1" });
      return;
    }
    const price = Number(price_per_hour);
    if (!Number.isFinite(price) || price < 0) {
      res.status(400).json({ success: false, message: "ราคาต้องเป็นตัวเลขที่ไม่ติดลบ" });
      return;
    }
    const fleetQty = quantity == null || quantity === "" ? 1 : Number(quantity);
    if (!Number.isInteger(fleetQty) || fleetQty < 1) {
      res.status(400).json({ success: false, message: "จำนวนลำต้องเป็นจำนวนเต็มอย่างน้อย 1" });
      return;
    }

    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO boat_types (type_name, description, seat_count, price, quantity, is_active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING boat_type_id as id`,
      [typeName, description ?? null, seats, price, fleetQty],
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
    await safeRollback(client);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
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
    const body = req.body as Record<string, unknown>;
    const boats = parseRoundBoats(body);
    const start_time = body.start_time;
    const end_time = body.end_time;

    if (!start_time || !end_time) {
      res.status(400).json({
        success: false,
        message: "กรุณากรอก start_time และ end_time ให้ครบถ้วน",
      });
      return;
    }

    if (boats.length === 0) {
      res.status(400).json({
        success: false,
        message: "กรุณาเลือกประเภทเรืออย่างน้อย 1 ประเภท",
      });
      return;
    }

    const typeIds = boats.map((item) => item.boat_type_id);
    if (new Set(typeIds).size !== typeIds.length) {
      res.status(400).json({
        success: false,
        message: "ไม่สามารถเลือกประเภทเรือซ้ำในรอบเดียวกันได้",
      });
      return;
    }

    const formattedStartTime = toTimeSql(start_time);
    const formattedEndTime = toTimeSql(end_time);
    if (formattedEndTime <= formattedStartTime) {
      res.status(400).json({
        success: false,
        message: "เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น",
      });
      return;
    }

    const quotaSum = boats.reduce((sum, item) => sum + item.quantity, 0);
    const totalSlots =
      body.total_slots === "" || body.total_slots == null
        ? quotaSum
        : Number(body.total_slots);
    const maxBooking =
      body.max_booking === "" || body.max_booking == null
        ? null
        : Number(body.max_booking);

    await client.query("BEGIN");

    if (!(await boatTypesExist(client, typeIds))) {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: "มีประเภทเรือที่ไม่ถูกต้องในรายการ",
      });
      return;
    }

    // Shared round: types live in round_boats, not boat_rounds.boat_type_id
    const result = await client.query(
      `INSERT INTO boat_rounds (start_time, end_time, max_booking, total_slots, is_active, boat_type_id)
       VALUES ($1, $2, $3, $4, true, NULL) RETURNING *`,
      [formattedStartTime, formattedEndTime, maxBooking, totalSlots],
    );

    const newRoundId = Number(result.rows[0].boat_round_id);
    await replaceRoundBoats(client, newRoundId, boats);

    await client.query("COMMIT");
    res.status(201).json({
      success: true,
      message: "Boat round created",
      data: result.rows[0],
    });
  } catch (error) {
    await safeRollback(client);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    console.error("Create boat round error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
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
    const id = parsePositiveInt(req.params.id);
    const { status, reject_reason } = req.body;
    const user = req.user as AuthPayload;

    if (id === null) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }
    const allowed = ["approved", "rejected", "pending", "checked_out"];
    if (!allowed.includes(status)) {
      res.status(400).json({ success: false, message: "Invalid status" });
      return;
    }

    await client.query("BEGIN");

    await lockAddonRoomHeader(client, id);
    const current = await client.query(
      `SELECT status, is_addon, checkin_at FROM boat_bookings WHERE boat_booking_id = $1 FOR UPDATE`,
      [id],
    );
    if (current.rows.length === 0) {
      await safeRollback(client);
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }
    const previousStatus = String(current.rows[0].status);
    const transitionError = assertStatusTransition(previousStatus, status);
    if (transitionError) {
      await safeRollback(client);
      res.status(400).json({ success: false, message: transitionError });
      return;
    }
    // เรือที่ลงน้ำไปแล้ว (เช็คอินแล้ว) ต้องไม่ถูกย้อนสถานะเป็น pending/rejected ผ่าน header
    if ((status === "rejected" || status === "pending") && current.rows[0].checkin_at) {
      await safeRollback(client);
      res.status(400).json({ success: false, message: "ไม่สามารถเปลี่ยนสถานะได้ เนื่องจากลูกค้าเช็คอินลงเรือแล้ว" });
      return;
    }
    // บัตรเสริมที่ถูกปฏิเสธต้องปรับยอดห้องและบันทึกการคืนเงินเหมือนการยกเลิกโดยลูกค้า
    if (status === "rejected" && current.rows[0].is_addon) {
      const addonResult = await cancelBoatAddonInTx(
        client,
        Number(id),
        { id: user.id, role: user.role },
        "ปฏิเสธโดยเจ้าหน้าที่",
      );
      if (!addonResult.ok) {
        await safeRollback(client);
        res.status(addonResult.status).json({ success: false, message: addonResult.message });
        return;
      }
      await client.query("COMMIT");
      res.json({
        success: true,
        message: "ปฏิเสธบัตรเสริมสำเร็จ",
        data: {
          refund_amount: addonResult.refund,
          percent_applied: addonResult.percent,
          room_total_reduction: addonResult.roomTotalReduction,
        },
      });
      return;
    }

    if (status === "rejected" || status === "cancelled") {
      await restoreBookingPromotions(client, {
        previousStatus,
        boatBookingId: Number(id),
      });
      await restoreBoatTicketRedemptions(client, Number(id));
    }

    let query = `UPDATE boat_bookings SET status = $1, updated_at = NOW()`;
    const params: Array<string | number> = [status];

    if (status === "approved" || status === "rejected") {
      query += `, approved_by_staff_id = $2`;
      params.push(user.id);
    }

    if (status === "rejected") {
      query += `, reject_reason = $${params.length + 1}`;
      params.push(
        typeof reject_reason === "string" && reject_reason.trim()
          ? reject_reason.trim()
          : "ไม่ระบุเหตุผล",
      );
    }

    params.push(id);
    query += ` WHERE boat_booking_id = $${params.length} RETURNING *`;

    const result = await client.query(query, params);
    if (result.rows.length === 0) {
      await safeRollback(client);
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
              details: `เรือคายัค ${info.type_name || "เรือคายัค"} (รอบเวลา ${timeRange})`,
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
    await safeRollback(client);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
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
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }

    await client.query("BEGIN");
    const booking = await client.query(
      "SELECT status FROM boat_bookings WHERE boat_booking_id = $1 FOR UPDATE",
      [id],
    );
    if (booking.rows.length === 0) {
      await safeRollback(client);
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }
    if (booking.rows[0].status !== "approved") {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: `ไม่สามารถ checkout ได้ เนื่องจากสถานะปัจจุบันคือ: ${booking.rows[0].status}`,
      });
      return;
    }

    await client.query(
      `UPDATE boat_bookings SET status = 'checked_out', checkout_at = COALESCE(checkout_at, NOW()), updated_at = NOW() WHERE boat_booking_id = $1`,
      [id],
    );
    await client.query(
      `UPDATE booking_boat SET status = 'checked_out', updated_at = NOW() WHERE boat_booking_id = $1`,
      [id],
    );
    await client.query("COMMIT");
    res.json({ success: true, message: "เช็คเอาต์สำเร็จ" });
  } catch (error) {
    await safeRollback(client);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    console.error("Checkout kayak booking error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};

/** เช็คอิน / บันทึกการปล่อยเรือลงน้ำ (ท่าเรือ) */
export const checkinKayakBooking = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const client = await pool.connect();
  try {
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }
    const user = req.user as AuthPayload;

    await client.query("BEGIN");
    await lockAddonRoomHeader(client, id);
    const booking = await client.query(
      `SELECT status, checkin_at, booking_date::text, start_time::text, end_time::text,
              clock_timestamp() AS current_time
       FROM boat_bookings WHERE boat_booking_id = $1 FOR UPDATE`,
      [id],
    );
    if (booking.rows.length === 0) {
      await safeRollback(client);
      res.status(404).json({ success: false, message: "Booking not found" });
      return;
    }
    if (booking.rows[0].status !== "approved") {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: `สามารถเช็คอินได้เฉพาะรายการที่อนุมัติแล้วเท่านั้น (สถานะปัจจุบัน: ${booking.rows[0].status})`,
      });
      return;
    }

    if (booking.rows[0].checkin_at) {
      await safeRollback(client);
      res.status(409).json({ success: false, message: 'รายการนี้เช็คอินแล้ว' });
      return;
    }
    const settings = await client.query('SELECT boat_checkin_advance_minutes FROM resort_info WHERE id = 5');
    const advance = Number(settings.rows[0]?.boat_checkin_advance_minutes ?? 15);
    const window = boatCheckinWindow(booking.rows[0].booking_date, booking.rows[0].start_time, booking.rows[0].end_time, advance);
    const timeError = boatCheckinError(window, new Date(booking.rows[0].current_time));
    if (timeError) {
      await safeRollback(client);
      res.status(400).json({ success: false, message: timeError });
      return;
    }
    await client.query(
      `UPDATE boat_bookings
       SET checkin_at = NOW(), checkin_by_staff_id = $2, updated_at = NOW()
       WHERE boat_booking_id = $1`,
      [id, user?.id ?? null],
    );
    await client.query("COMMIT");
    res.json({ success: true, message: "เช็คอินปล่อยเรือลงน้ำสำเร็จ" });
  } catch (error) {
    await safeRollback(client);
    console.error("Checkin kayak booking error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};

/** ดึงข้อมูลรอบเรือและรายการเช็คอินประจำวัน (หน้าท่าเรือ) */
export const getKayakCheckinSessions = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const dateParam = typeof req.query.date === "string" && req.query.date ? req.query.date : null;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

    const params: (string | number)[] = [];
    let where = `WHERE bb.status IN ('approved', 'checked_out')`;

    if (dateParam) {
      params.push(dateParam);
      where += ` AND bb.booking_date::date = $${params.length}::date`;
    } else {
      where += ` AND bb.booking_date::date = CURRENT_DATE`;
    }

    if (search) {
      params.push(`%${search}%`);
      where += ` AND (
        bb.boat_booking_id::text ILIKE $${params.length}
        OR CONCAT_WS(' ', m.first_name, m.last_name) ILIKE $${params.length}
        OR m.phone ILIKE $${params.length}
      )`;
    }

    const query = `
      SELECT bb.boat_booking_id,
             bb.booking_date::text,
             bb.start_time,
             bb.end_time,
             bb.total_price,
             bb.status,
             bb.checkin_at,
             bb.checkout_at,
             bb.is_addon,
             bb.room_booking_id,
             bb.booking_room_id,
             CONCAT_WS(' ', m.first_name, m.last_name) AS customer_name,
             m.phone AS customer_phone,
             m.email AS customer_email,
             COALESCE(
               (
                 SELECT json_agg(
                   json_build_object(
                     'booking_boat_id', bnb.booking_boat_id,
                     'boat_type_id', bnb.boat_type_id,
                     'boat_type_name', bt.type_name,
                     'boat_count', bnb.boat_count,
                     'num_passengers', bnb.num_passengers
                   )
                 )
                 FROM booking_boat bnb
                 JOIN boat_types bt ON bt.boat_type_id = bnb.boat_type_id
                 WHERE bnb.boat_booking_id = bb.boat_booking_id
               ),
               '[]'::json
             ) AS boats
      FROM boat_bookings bb
      JOIN members m ON bb.member_id = m.member_id
      ${where}
      ORDER BY bb.start_time ASC, bb.boat_booking_id ASC
    `;

    const result = await pool.query(query, params);
    const settings = await pool.query('SELECT boat_checkin_advance_minutes FROM resort_info WHERE id = 5');
    const advance = Number(settings.rows[0]?.boat_checkin_advance_minutes ?? 15);
    const now = new Date();
    const rows = result.rows.map((row) => {
      const window = boatCheckinWindow(row.booking_date, row.start_time, row.end_time, advance);
      const reason = boatCheckinError(window, now);
      return { ...row, checkin_opens_at: window?.opensAt ?? null, checkin_closes_at: window?.closesAt ?? null,
        can_checkin: row.status === 'approved' && !row.checkin_at && !reason, checkin_unavailable_reason: reason };
    });

    const summary = {
      total_bookings: rows.length,
      waiting_count: rows.filter((r) => r.status === "approved" && !r.checkin_at).length,
      on_water_count: rows.filter((r) => r.status === "approved" && r.checkin_at).length,
      checked_out_count: rows.filter((r) => r.status === "checked_out").length,
      total_boats: rows.reduce((sum, r) => {
        const boatSum = (r.boats || []).reduce((acc: number, b: any) => acc + (Number(b.boat_count) || 0), 0);
        return sum + boatSum;
      }, 0),
    };

    res.json({
      success: true,
      data: {
        summary,
        bookings: rows,
      },
    });
  } catch (error) {
    console.error("Get kayak checkin sessions error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ลบประเภทเรือออกจากระบบ พร้อมลบไฟล์รูปภาพออกจาก Cloudinary
export const deleteKayak = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const client = await pool.connect();
  try {
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }

    await client.query("BEGIN");

    // ล็อกแถวประเภทเรือก่อน เพื่อให้การตรวจการจองกับการลบเป็นชุดเดียวกัน (สอดคล้องกับ createKayakBooking)
    const locked = await client.query(
      `SELECT boat_type_id FROM boat_types WHERE boat_type_id = $1 FOR UPDATE`,
      [id],
    );
    if (locked.rows.length === 0) {
      await safeRollback(client);
      res.status(404).json({ success: false, message: "Boat type not found" });
      return;
    }

    const bookingCheck = await client.query(
      `SELECT COUNT(*) as count FROM booking_boat
       WHERE boat_type_id = $1 AND status NOT IN ('cancelled', 'rejected')`,
      [id],
    );

    if (Number(bookingCheck.rows[0].count) > 0) {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: "ไม่สามารถลบได้ เนื่องจากมีประวัติการจองของเรือนี้แล้ว ใช้การปิดใช้งานแทนได้",
      });
      return;
    }

    // ดึงรายการรูปทั้งหมดของเรือลำนี้เตรียมไว้ลบออกจาก Cloudinary
    const imagesRes = await client.query(
      `SELECT image_path FROM boat_images WHERE boat_type_id = $1`,
      [id],
    );

    await client.query(`DELETE FROM boat_types WHERE boat_type_id = $1`, [id]);
    await client.query("COMMIT");

    // ลบไฟล์รูปทั้งหมดออกจาก Cloudinary หลัง COMMIT สำเร็จเท่านั้น
    for (const row of imagesRes.rows) {
      if (row.image_path) {
        await deleteCloudinaryImage(row.image_path).catch(
          (cleanupError: unknown) => {
            console.error(
              "Delete kayak Cloudinary cleanup error:",
              cleanupError,
            );
          },
        );
      }
    }

    res.json({ success: true, message: "Boat type deleted successfully" });
  } catch (error) {
    await safeRollback(client);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    console.error("Delete kayak error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};

// ดึงรูปทั้งหมดของ boat type
export const getBoatImages = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }
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
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }
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
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
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
    const id = parsePositiveInt(req.params.id);
    const imageId = parsePositiveInt(req.params.imageId);
    if (id === null || imageId === null) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }
    // ลบได้เฉพาะรูปที่เป็นของเรือ (boat_type_id) ตาม URL เท่านั้น
    const result = await pool.query(
      `DELETE FROM boat_images WHERE boat_image_id = $1 AND boat_type_id = $2 RETURNING boat_image_id, image_path`,
      [imageId, id],
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
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
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
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }
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

    // ตรวจค่าที่ส่งมาก่อนเขียนลงฐาน (เฉพาะฟิลด์ที่ส่งมา)
    if (body.name !== undefined || body.type_name !== undefined) {
      const newName = String(body.name ?? body.type_name ?? "").trim();
      if (!newName) {
        res.status(400).json({ success: false, message: "กรุณาระบุชื่อประเภทเรือ" });
        return;
      }
    }
    if (body.capacity !== undefined || body.seat_count !== undefined) {
      const seats = Number(body.capacity ?? body.seat_count);
      if (!Number.isInteger(seats) || seats < 1) {
        res.status(400).json({ success: false, message: "จำนวนที่นั่งต้องเป็นจำนวนเต็มอย่างน้อย 1" });
        return;
      }
    }
    if (body.price_per_hour !== undefined || body.price !== undefined) {
      const price = Number(body.price_per_hour ?? body.price);
      if (!Number.isFinite(price) || price < 0) {
        res.status(400).json({ success: false, message: "ราคาต้องเป็นตัวเลขที่ไม่ติดลบ" });
        return;
      }
    }
    if (body.is_active !== undefined && typeof body.is_active !== "boolean") {
      res.status(400).json({ success: false, message: "is_active ต้องเป็น true หรือ false" });
      return;
    }

    // รูปที่ถูกนำออกจะลบจาก Cloudinary หลัง COMMIT เท่านั้น (ถ้า rollback แถวใน DB ยังชี้ไฟล์เดิมอยู่)
    let removedImagePaths: string[] = [];

    await client.query("BEGIN");

    if (body.quantity !== undefined) {
      const newQuantity = Number(body.quantity);
      if (!Number.isInteger(newQuantity) || newQuantity < 1) {
        await safeRollback(client);
        res.status(400).json({ success: false, message: "จำนวนเรือต้องเป็นจำนวนเต็มอย่างน้อย 1" });
        return;
      }
      await client.query('SELECT boat_type_id FROM boat_types WHERE boat_type_id = $1 FOR UPDATE', [id]);
      const activeBoats = await peakReservedBoats(client, id);
      if (newQuantity < activeBoats) {
        await safeRollback(client);
        res.status(400).json({
          success: false,
          message: `ลดจำนวนเรือไม่ได้ เนื่องจากมีการจองที่ยังไม่เช็คเอาต์ ${activeBoats} ลำ`,
        });
        return;
      }
    }

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
      removedImagePaths = oldImagePaths.filter(
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

    }

    await client.query("COMMIT");

    // 7. สั่งลบรูปที่ไม่ได้ใช้แล้วออกจาก Cloudinary หลัง COMMIT สำเร็จ
    for (const imgPath of removedImagePaths) {
      await deleteCloudinaryImage(imgPath).catch((cleanupError: unknown) => {
        console.error("Update kayak Cloudinary cleanup error:", cleanupError);
      });
    }
    res.json({ success: true, message: "Boat type updated" });
  } catch (error) {
    await safeRollback(client);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
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
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const hasBoatsPayload =
      Array.isArray(body.boats) || body.boat_type_id != null;
    const boats = hasBoatsPayload ? parseRoundBoats(body) : [];

    if (hasBoatsPayload && boats.length === 0) {
      res.status(400).json({
        success: false,
        message: "กรุณาเลือกประเภทเรืออย่างน้อย 1 ประเภท",
      });
      return;
    }

    if (hasBoatsPayload) {
      const typeIds = boats.map((item) => item.boat_type_id);
      if (new Set(typeIds).size !== typeIds.length) {
        res.status(400).json({
          success: false,
          message: "ไม่สามารถเลือกประเภทเรือซ้ำในรอบเดียวกันได้",
        });
        return;
      }
    }

    await client.query("BEGIN");

    // Hold the round before reading reservation demand, matching booking paths.
    const lockedRound = await client.query(
      'SELECT boat_round_id FROM boat_rounds WHERE boat_round_id = $1 FOR UPDATE',
      [id],
    );
    if (lockedRound.rows.length === 0) {
      await safeRollback(client);
      res.status(404).json({ success: false, message: "Boat round not found" });
      return;
    }

    if (hasBoatsPayload && !(await boatTypesExist(client, boats.map((b) => b.boat_type_id)))) {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: "มีประเภทเรือที่ไม่ถูกต้องในรายการ",
      });
      return;
    }

    const allowedFields = [
      "start_time",
      "end_time",
      "max_booking",
      "total_slots",
      "is_active",
    ];
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    allowedFields.forEach((field) => {
      if (body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        let val: unknown =
          (field === "max_booking" || field === "total_slots") &&
          body[field] === ""
            ? null
            : body[field];
        if (
          (field === "start_time" || field === "end_time") &&
          typeof val === "string"
        ) {
          val = toTimeSql(val);
        }
        values.push(val);
        paramIndex++;
      }
    });

    // Membership is round_boats; clear leftover 1:1 column when types are posted.
    if (hasBoatsPayload) {
      updates.push(`boat_type_id = NULL`);
    }

    if (body.start_time !== undefined || body.end_time !== undefined) {
      const current = await client.query(
        `SELECT start_time, end_time FROM boat_rounds WHERE boat_round_id = $1`,
        [id],
      );
      if (current.rows.length === 0) {
        await safeRollback(client);
        res.status(404).json({ success: false, message: "Boat round not found" });
        return;
      }
      const startSql = body.start_time !== undefined ? toTimeSql(body.start_time) : String(current.rows[0].start_time);
      const endSql = body.end_time !== undefined ? toTimeSql(body.end_time) : String(current.rows[0].end_time);
      const startMin = timeToMinutes(startSql);
      const endMin = timeToMinutes(endSql);
      if (startMin === null || endMin === null) {
        await safeRollback(client);
        res.status(400).json({ success: false, message: "รูปแบบเวลาไม่ถูกต้อง" });
        return;
      }
      if (startMin >= endMin) {
        await safeRollback(client);
        res.status(400).json({ success: false, message: "เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุด" });
        return;
      }
      // การจองเก็บเวลาไว้ในหัวบิลแล้ว การย้ายช่วงเวลาของรอบที่มีการจองจะทำให้ข้อมูลไม่ตรงกัน จึงไม่อนุญาต
      const changed = startSql !== String(current.rows[0].start_time) || endSql !== String(current.rows[0].end_time);
      if (changed) {
        const activeRes = await client.query(
          `SELECT COUNT(*)::int AS n FROM booking_boat WHERE boat_round_id = $1 AND status NOT IN ('cancelled', 'rejected')`,
          [id],
        );
        if (Number(activeRes.rows[0].n) > 0) {
          await safeRollback(client);
          res.status(400).json({
            success: false,
            message: "เปลี่ยนเวลาของรอบนี้ไม่ได้ เนื่องจากมีการจองในรอบนี้อยู่ ใช้การปิดใช้งานรอบแทนได้",
          });
          return;
        }
      }
    }

    if (updates.length > 0) {
      values.push(id);
      const query = `
        UPDATE boat_rounds
        SET ${updates.join(", ")}
        WHERE boat_round_id = $${paramIndex}
        RETURNING *`;
      const updated = await client.query(query, values);
      if (updated.rows.length === 0) {
        await safeRollback(client);
        res.status(404).json({ success: false, message: "Boat round not found" });
        return;
      }
    }

    if (hasBoatsPayload) {
      const newQuota = new Map<number, number>(boats.map((b) => [b.boat_type_id, Number(b.quantity)]));
      const existingRes = await client.query(
        `SELECT boat_type_id FROM round_boats WHERE boat_round_id = $1`,
        [id],
      );
      const typeIds = new Set<number>([
        ...newQuota.keys(),
        ...existingRes.rows.map((row: { boat_type_id: number }) => Number(row.boat_type_id)),
      ]);
      for (const typeId of typeIds) {
        const activeBoats = await peakReservedBoats(client, typeId, id);
        const quota = newQuota.get(typeId) ?? 0;
        if (quota < activeBoats) {
          await safeRollback(client);
          res.status(400).json({
            success: false,
            message: `ลดโควตาเรือไม่ได้ เนื่องจากมีการจองที่ยังไม่เช็คเอาต์ ${activeBoats} ลำ`,
          });
          return;
        }
      }
      await replaceRoundBoats(client, Number(id), boats);
    }

    await client.query("COMMIT");
    res.json({ success: true, message: "Boat round updated successfully" });
  } catch (error) {
    await safeRollback(client);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
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
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }

    await client.query("BEGIN");

    // ล็อกแถวรอบเวลาก่อน เพื่อให้การตรวจการจองกับการลบเป็นชุดเดียวกัน (สอดคล้องกับ createKayakBooking)
    const locked = await client.query(
      `SELECT boat_round_id FROM boat_rounds WHERE boat_round_id = $1 FOR UPDATE`,
      [id],
    );
    if (locked.rows.length === 0) {
      await safeRollback(client);
      res.status(404).json({ success: false, message: "Boat round not found" });
      return;
    }

    const bookingCheck = await client.query(
      `SELECT COUNT(*) as count FROM booking_boat
       WHERE boat_round_id = $1 AND status NOT IN ('cancelled', 'rejected')`,
      [id],
    );

    if (Number(bookingCheck.rows[0].count) > 0) {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: "ไม่สามารถลบรอบเวลาได้ เนื่องจากมีประวัติการจองแล้ว ใช้การปิดใช้งานแทนได้",
      });
      return;
    }

    await client.query(`DELETE FROM round_boats WHERE boat_round_id = $1`, [
      id,
    ]);
    await client.query(`DELETE FROM boat_rounds WHERE boat_round_id = $1`, [
      id,
    ]);

    await client.query("COMMIT");
    res.json({ success: true, message: "Boat round deleted successfully" });
  } catch (error) {
    await safeRollback(client);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    console.error("Delete boat round error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};
// ยกเลิกบัตรเสริม (boat add-on) พร้อมปรับยอดห้องและบันทึกการคืนเงินแยก
// - ห้องยังไม่ชำระ: ตัดยอดบัตรเสริมออกจากยอดห้องทั้งจำนวน (ยังไม่มีเงินเข้า จึงไม่มีรายการคืน)
// - ห้องชำระแล้ว: คืนตามนโยบาย (cancellation_policies) และตัดยอดห้องเฉพาะส่วนที่คืน บันทึกใน booking_refunds
// ฟังก์ชันนี้ไม่เปิด/ปิด transaction เอง ผู้เรียกต้อง BEGIN/COMMIT/ROLLBACK
type AddonCancelResult =
  | { ok: true; refund: number; percent: number; roomTotalReduction: number }
  | { ok: false; status: number; message: string };

// Room approval/payment/cancellation owns the room header before its addons.
// Acquire that same header first; a joined FOR UPDATE cannot guarantee which
// relation locks first. Normal standalone boat bookings have no room to lock.
async function lockAddonRoomHeader(
  client: PoolClient,
  boatBookingId: number,
): Promise<void> {
  await client.query(
    `SELECT rb.room_booking_id FROM room_bookings rb
     WHERE rb.room_booking_id = (
       SELECT room_booking_id FROM boat_bookings
       WHERE boat_booking_id = $1 AND is_addon = true
     ) FOR UPDATE OF rb`,
    [boatBookingId],
  );
}

async function cancelBoatAddonInTx(
  client: PoolClient,
  boatBookingId: number,
  actor: { id: number; role: string },
  reason: string | null,
): Promise<AddonCancelResult> {
  await lockAddonRoomHeader(client, boatBookingId);
  const addonRes = await client.query(
    `SELECT bb.boat_booking_id, bb.member_id, bb.room_booking_id, bb.status, bb.total_price,
            bb.handed_out_at, bb.checkin_at,
            (EXTRACT(EPOCH FROM ((bb.booking_date + bb.start_time) AT TIME ZONE 'Asia/Bangkok') - NOW()) / 3600)::float8 AS hours_before_start,
            rb.status AS room_status
     FROM boat_bookings bb
     JOIN room_bookings rb ON rb.room_booking_id = bb.room_booking_id
     WHERE bb.boat_booking_id = $1 AND bb.is_addon = true
     FOR UPDATE OF bb`,
    [boatBookingId],
  );
  if (addonRes.rows.length === 0) {
    return { ok: false, status: 404, message: "ไม่พบบัตรเสริม" };
  }
  const addon = addonRes.rows[0];
  if (actor.role === "customer" && Number(addon.member_id) !== actor.id) {
    return { ok: false, status: 404, message: "ไม่พบบัตรเสริม" };
  }
  if (!["pending", "approved"].includes(String(addon.status)) || addon.handed_out_at || addon.checkin_at) {
    return { ok: false, status: 400, message: "บัตรเสริมนี้ไม่สามารถยกเลิกได้แล้ว" };
  }
  if (!["pending", "paid", "approved"].includes(String(addon.room_status))) {
    return { ok: false, status: 400, message: "ห้องพักนี้ไม่สามารถแก้ไขรายการได้แล้ว" };
  }

  const roomPaid = addon.room_status === "paid" || addon.room_status === "approved";
  const charged = Number(addon.total_price) || 0;
  const hoursBefore = Number(addon.hours_before_start);
  let percent = 0;
  let refund = 0;
  if (charged > 0 && roomPaid) {
    const policyRes = await client.query(
      `SELECT full_refund_hours, late_refund_percent FROM cancellation_policies WHERE id = 1`,
    );
    const policy = policyRes.rows[0] ?? { full_refund_hours: 48, late_refund_percent: 0 };
    percent = hoursBefore >= Number(policy.full_refund_hours)
      ? 100
      : Number(policy.late_refund_percent);
    refund = Number(((charged * percent) / 100).toFixed(2));
  }
  // ห้องยังไม่ชำระ: ยอดบัตรเสริมยังไม่ได้รับเงิน จึงตัดออกทั้งจำนวน
  const roomTotalReduction = roomPaid ? refund : charged;

  if (charged > 0 && roomPaid) {
    await client.query(
      `INSERT INTO booking_refunds (
         room_booking_id, boat_booking_id, amount, percent_applied, hours_before_start,
         reason, cancelled_by_user_id, cancelled_by_role
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        addon.room_booking_id,
        boatBookingId,
        refund,
        percent,
        Number(hoursBefore.toFixed(2)),
        reason,
        actor.id,
        actor.role,
      ],
    );
  }

  await restoreBookingPromotions(client, {
    previousStatus: String(addon.status),
    boatBookingId,
  });
  await restoreBoatTicketRedemptions(client, boatBookingId);

  await client.query(
    `UPDATE boat_bookings SET status = 'cancelled', updated_at = NOW() WHERE boat_booking_id = $1`,
    [boatBookingId],
  );
  await client.query(
    `UPDATE booking_boat SET status = 'cancelled', updated_at = NOW() WHERE boat_booking_id = $1`,
    [boatBookingId],
  );
  if (roomTotalReduction > 0) {
    await client.query(
      `UPDATE room_bookings SET total_price = GREATEST(total_price - $1, 0), updated_at = NOW()
       WHERE room_booking_id = $2`,
      [roomTotalReduction, addon.room_booking_id],
    );
  }

  return { ok: true, refund, percent, roomTotalReduction };
}

export const cancelBoatAddon = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const client = await pool.connect();
  try {
    const user = req.user as AuthPayload;
    const boatBookingId = parsePositiveInt(req.params.boatBookingId);
    if (boatBookingId === null) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }
    const body = req.body as Record<string, unknown>;
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;

    await client.query("BEGIN");
    const result = await cancelBoatAddonInTx(client, boatBookingId, user, reason);
    if (!result.ok) {
      await safeRollback(client);
      res.status(result.status).json({ success: false, message: result.message });
      return;
    }
    await client.query("COMMIT");
    res.json({
      success: true,
      message: "ยกเลิกบัตรเสริมสำเร็จ",
      data: {
        refund_amount: result.refund,
        percent_applied: result.percent,
        room_total_reduction: result.roomTotalReduction,
      },
    });
  } catch (error) {
    await safeRollback(client);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    console.error("Cancel boat addon error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};
