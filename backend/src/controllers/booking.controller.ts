import { parsePagination, paginationMeta } from '../utils/pagination';
import { Request, Response } from 'express';
import { safeRollback } from '../utils/safe-rollback';
import { bangkokToday } from '../utils/bangkok-date';
import { assertStatusTransition } from '../services/booking-status';
import pool from '../config/database';
import { AuthPayload } from '../types';
import {
  sendBookingConfirmationEmail,
  sendBookingStatusEmail,
} from '../services/mail.service';
import {
  assertGuestsFitCapacity,
  countCapacityChildren,
  lineSubtotal,
  nightsBetween,
  sumCapacity,
  sumSubtotals,
} from '../services/booking-room.math';
import {
  loadApplyContext,
  loadPromosForApply,
  persistBookingPromotions,
  restoreBookingPromotions,
} from '../services/promotion-ledger';
import { ApplyLine, PromoApplyError, applyPromotionList, headerPromotionId } from '../services/promotion-apply';
import { cancelBoatAddonsForRoomBooking, approveBoatAddonsForRoomBooking } from '../services/boat-booking-lifecycle';
export { approveBoatAddonsForRoomBooking } from '../services/boat-booking-lifecycle';
import { mapDbError } from '../utils/db-errors';
import { parsePositiveInt } from '../utils/ids';

interface BookingItemInput {
  room_type_id: number;
  quantity: number;
  promotion_id: number | null;
  // ห้องเฉพาะเจาะจงที่ลูกค้าเลือกจากหน้ารายละเอียดห้อง (ไม่บังคับ) — ถ้าไม่ระบุ backend เลือกห้องว่างให้อัตโนมัติ
  room_id: number | null;
}

interface RoomTypeRow {
  id: number;
  price: number;
  capacity: number;
  room_name: string;
  type_name: string | null;
}

const ROOMS_JSON_SQL = `COALESCE((
  SELECT json_agg(json_build_object(
    'booking_room_id', br.booking_room_id,
    'room_id', br.room_id,
    'room_type_id', r.room_type_id,
    'room_number', r.room_number,
    'room_name', rt.room_name,
    'type_name', rt.type_name,
    'price_per_night', br.price_per_night,
    'nights', br.nights,
    'subtotal', br.subtotal,
    'status', br.status,
    'checkin_at', br.checkin_at,
    'checkout_at', br.checkout_at
  ) ORDER BY br.booking_room_id)
  FROM booking_room br
  JOIN rooms r ON r.room_id = br.room_id
  JOIN room_types rt ON rt.id = r.room_type_id
  WHERE br.room_booking_id = rb.room_booking_id
), '[]'::json)`;

// Only physical-room addon grants belong here; legacy NULL booking_room_id
// grants are redeemed through the general wallet. Keep exhausted addon grants.
const BOAT_TICKET_SUMMARY_SQL = `(
  SELECT json_build_object(
    'total_tickets', COALESCE(SUM(mbt.total_tickets), 0),
    'used_tickets', COALESCE(SUM(mbt.used_tickets), 0),
    'remaining_tickets', COALESCE(SUM(mbt.total_tickets - mbt.used_tickets), 0),
    'bookable_tickets', COALESCE(SUM(mbt.total_tickets - mbt.used_tickets) FILTER (
      WHERE btr.status IN ('pending', 'paid', 'approved')
        AND rb.status IN ('pending', 'paid', 'approved')
        AND (mbt.mode = 'free' OR rb.status = 'pending')
    ), 0),
    'free_tickets', COALESCE(SUM(mbt.total_tickets) FILTER (WHERE mbt.mode = 'free'), 0),
    'paid_tickets', COALESCE(SUM(mbt.total_tickets) FILTER (WHERE mbt.mode = 'paid'), 0),
    'valid_from', to_char(rb.check_in, 'YYYY-MM-DD'),
    'valid_to', to_char(rb.check_out, 'YYYY-MM-DD')
  )
  FROM member_boat_tickets mbt
  LEFT JOIN booking_room btr ON btr.booking_room_id = mbt.booking_room_id
                           AND btr.room_booking_id = rb.room_booking_id
  WHERE mbt.room_booking_id = rb.room_booking_id
    AND mbt.booking_room_id IS NOT NULL
)`;

// บัตรเสริมเรือคายัคที่ผูกกับบิลจองห้องนี้ — ใช้แสดง/พิมพ์/มอบบัตรตอนเช็คอิน
const BOAT_ADDONS_JSON_SQL = `COALESCE((
  SELECT json_agg(json_build_object(
    'boat_booking_id', bb.boat_booking_id,
    'booking_room_id', bb.booking_room_id,
    'boat_type_name', bt.type_name,
    'booking_date', bb.booking_date,
    'start_time', bb.start_time,
    'end_time', bb.end_time,
    'boat_count', bnb.boat_count,
    'num_passengers', bnb.num_passengers,
    'mode', bb.addon_mode,
    'price', bb.total_price,
    'status', bb.status,
    'printed_at', bb.printed_at,
    'handed_out_at', bb.handed_out_at
  ) ORDER BY bb.booking_date)
  FROM boat_bookings bb
  JOIN booking_boat bnb ON bnb.boat_booking_id = bb.boat_booking_id
  JOIN boat_types bt ON bt.boat_type_id = bnb.boat_type_id
  WHERE bb.room_booking_id = rb.room_booking_id AND bb.is_addon = true
), '[]'::json)`;

function normalizeItems(body: Record<string, unknown>): BookingItemInput[] {
  if (Array.isArray(body.items) && body.items.length > 0) {
    return body.items.map((raw) => {
      const item = raw as Record<string, unknown>;
      return {
        room_type_id: Number(item.room_type_id),
        quantity: Number(item.quantity),
        promotion_id: item.promotion_id != null ? Number(item.promotion_id) : null,
        room_id: item.room_id != null ? Number(item.room_id) : null,
      };
    });
  }
  return [{ room_type_id: Number(body.room_type_id), quantity: 1, promotion_id: null, room_id: null }];
}

function normalizeGuests(body: Record<string, unknown>): {
  adults: number;
  children: number;
} {
  if (body.adults != null) {
    return {
      adults: Number(body.adults),
      children: Number(body.children ?? 0),
    };
  }
  return { adults: Number(body.guests), children: 0 };
}

async function applyPromotionDiscount(
  client: { query: typeof pool.query },
  promotionId: number,
  basePrice: number,
  nights: number,
  memberId: number,
  roomTypeIds: number[]
): Promise<{
  finalPrice: number;
  line: ApplyLine | null;
  boatTicketCount: number;
  boatAddonMode: 'free' | 'paid';
  boatAddonPrice: number;
}> {
  // ใช้ตรรกะตรวจสอบชุดเดียวกับการจองคายัค (วันที่, usage limit, wallet, applies_to) เพื่อไม่ให้สองทางตรวจต่างกัน
  const catalog = await loadPromosForApply(client, [promotionId]);
  if (!catalog[0].is_active) {
    throw new PromoApplyError('โปรโมชั่นไม่ถูกต้องหรือหมดอายุแล้ว');
  }
  const ctxExtra = await loadApplyContext(client, memberId, [promotionId]);
  const result = applyPromotionList(catalog, {
    memberId,
    nights,
    basePrice,
    now: new Date(),
    scope: 'room',
    roomTypeIds,
    ...ctxExtra,
  });

  const boatRes = await client.query(
    'SELECT boat_ticket_count, boat_addon_mode, boat_addon_price FROM promotions WHERE id = $1',
    [promotionId]
  );
  const boat = boatRes.rows[0] ?? {};
  return {
    finalPrice: result.totalPrice,
    line: result.lines[0] ?? null,
    boatTicketCount: Number(boat.boat_ticket_count) || 0,
    boatAddonMode: boat.boat_addon_mode === 'paid' ? 'paid' : 'free',
    boatAddonPrice: Number(boat.boat_addon_price) || 0,
  };
}

// Candidate rooms are already locked globally by room_id. Check overlaps in a
// later statement so READ COMMITTED sees bookings committed while waiting.
async function pickAvailableRoom(
  client: { query: typeof pool.query },
  roomTypeId: number,
  checkIn: string,
  checkOut: string,
  excludeRoomIds: number[]
): Promise<{ rows: Array<{ room_id: number; room_number: string }> }> {
  const candidates = await client.query(
    `SELECT r.room_id, r.room_number
     FROM rooms r
     WHERE r.room_type_id = $1 AND r.status <> 'maintenance'
       AND r.room_id <> ALL($2::int[])
     ORDER BY r.room_id`,
    [roomTypeId, excludeRoomIds]
  );
  for (const candidate of candidates.rows as Array<{ room_id: number; room_number: string }>) {
    const busy = await client.query(
      `SELECT 1
       FROM booking_room br
       JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
       WHERE br.room_id = $1 AND br.status NOT IN ('cancelled', 'rejected', 'checked_out')
         AND rb.check_in < $3 AND rb.check_out > $2
       LIMIT 1`,
      [candidate.room_id, checkIn, checkOut]
    );
    if (busy.rows.length === 0) {
      return { rows: [candidate] };
    }
  }
  return { rows: [] };
}

export const createRoomBooking = async (
  req: Request,
  res: Response
): Promise<void> => {
  const client = await pool.connect();
  try {
    const user = req.user as AuthPayload;
    const body = req.body as Record<string, unknown>;
    const checkInDate = String(body.check_in_date);
    const checkOutDate = String(body.check_out_date);
    if (checkInDate < bangkokToday()) {
      res.status(400).json({ success: false, message: 'ไม่สามารถจองวันที่ย้อนหลังได้' });
      return;
    }
    const specialRequests =
      typeof body.special_requests === 'string' ? body.special_requests : null;
    // เวลาที่คาดว่าจะถึง เก็บแยกจากคำขอพิเศษ (เดิมฝังรวมกันเป็นข้อความ "[Arrival: HH:MM] ...")
    const arrivalTime =
      typeof body.arrival_time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(body.arrival_time)
        ? body.arrival_time
        : null;
    const guestName = typeof body.guest_name === 'string' ? body.guest_name.trim() || null : null;
    const guestPhone = typeof body.guest_phone === 'string' ? body.guest_phone.trim() || null : null;
    const guestEmail = typeof body.guest_email === 'string' ? body.guest_email.trim() || null : null;
    // legacy: โปรโมชั่นเดียวสำหรับทั้งออเดอร์ (ยังรองรับไว้เผื่อผู้เรียกเก่าที่ไม่ได้ส่ง promotion_id แยกตาม item)
    const legacyPromotionId =
      body.promotion_id != null ? Number(body.promotion_id) : null;

    const items = normalizeItems(body);
    const { adults, children } = normalizeGuests(body);
    const childAges = Array.isArray(body.child_ages) ? body.child_ages.map((a) => Number(a)) : [];
    const nights = nightsBetween(checkInDate, checkOutDate);

    for (const item of items) {
      if (
        !Number.isInteger(item.room_type_id) ||
        item.room_type_id < 1 ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        (item.room_id != null && (!Number.isInteger(item.room_id) || item.room_id < 1))
      ) {
        res.status(400).json({
          success: false,
          message: 'รายการห้องไม่ถูกต้อง',
        });
        return;
      }
    }

    // อายุเด็กต้องมีครบตามจำนวนเด็กที่ระบุ (ณ วันเข้าพัก) ใช้กันความจุ/แสดงผลย้อนหลัง
    if (
      childAges.length !== children ||
      childAges.some((age) => !Number.isInteger(age) || age < 0 || age > 17)
    ) {
      res.status(400).json({
        success: false,
        message: 'กรุณาระบุอายุของเด็กแต่ละคนให้ครบ (0-17 ปี)',
      });
      return;
    }

    await client.query('BEGIN');

    const typeMap = new Map<number, RoomTypeRow>();
    for (const item of items) {
      if (typeMap.has(item.room_type_id)) continue;
      const roomTypeRes = await client.query(
        `SELECT id, price, capacity, room_name, type_name
         FROM room_types WHERE id = $1 AND status = true`,
        [item.room_type_id]
      );
      if (roomTypeRes.rows.length === 0) {
        await safeRollback(client);
        res.status(404).json({
          success: false,
          message: `ไม่พบประเภทห้อง id ${item.room_type_id}`,
        });
        return;
      }
      typeMap.set(item.room_type_id, roomTypeRes.rows[0] as RoomTypeRow);
    }

    const capacityItems = items.map((item) => ({
      capacity: Number(typeMap.get(item.room_type_id)!.capacity),
      quantity: item.quantity,
    }));
    const ageConfig = await client.query(
      'SELECT infant_max_age_exclusive FROM resort_info WHERE id = 3'
    );
    const infantMaxAgeExclusive = ageConfig.rows.length === 0
      ? 6 : ageConfig.rows[0].infant_max_age_exclusive as unknown;
    if (typeof infantMaxAgeExclusive !== 'number' || !Number.isInteger(infantMaxAgeExclusive) || infantMaxAgeExclusive < 0 || infantMaxAgeExclusive > 18) {
      throw new Error('Invalid infant age configuration');
    }
    try {
      assertGuestsFitCapacity(adults, countCapacityChildren(childAges, infantMaxAgeExclusive), sumCapacity(capacityItems));
    } catch (err) {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: err instanceof Error ? err.message : 'ผู้เข้าพักเกินความจุ',
      });
      return;
    }

    const lockedRooms: Array<{
      room_id: number;
      room_type_id: number;
      price_per_night: number;
      room_name: string;
      room_number: string;
    }> = [];

    // Lock the complete candidate set in one global order, including explicit
    // room choices. Reversed carts must never acquire physical rooms in reverse.
    // Blocking locks let a fresh overlap query decide availability after waiting.
    const allocationTypeIds = [...typeMap.keys()].sort((a, b) => a - b);
    await client.query(
      `SELECT room_id FROM rooms
       WHERE room_type_id = ANY($1::int[])
       ORDER BY room_id FOR UPDATE`,
      [allocationTypeIds]
    );

    // Exclude rooms allocated earlier in this transaction but not yet inserted.
    const lockedRoomIds: number[] = [];
    const explicitRoomIds = items
      .map((item) => item.room_id)
      .filter((roomId): roomId is number => roomId !== null);

    for (const item of items) {
      const roomType = typeMap.get(item.room_type_id)!;
      for (let i = 0; i < item.quantity; i += 1) {
        // หน่วยแรกของแต่ละ item เท่านั้นที่ผูกกับห้องเฉพาะเจาะจงที่ลูกค้าเลือกไว้ (ถ้ามี)
        // ส่วนที่เกินมา (quantity > 1 บนห้องเดียวกัน) ให้ระบบเลือกห้องว่างประเภทเดียวกันให้อัตโนมัติ
        const requestedRoomId = i === 0 ? item.room_id : null;

        const roomQuery = requestedRoomId
          ? await client.query(
              `SELECT r.room_id, r.room_number
               FROM rooms r
               WHERE r.room_id = $1 AND r.room_type_id = $2 AND r.status <> 'maintenance'
                 AND r.room_id <> ALL($3::int[])
                 AND r.room_id NOT IN (
                   SELECT br.room_id
                   FROM booking_room br
                   JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
                   WHERE br.status NOT IN ('cancelled', 'rejected', 'checked_out')
                     AND rb.check_in < $5 AND rb.check_out > $4
                 )`,
              [requestedRoomId, item.room_type_id, lockedRoomIds, checkInDate, checkOutDate]
            )
          : await pickAvailableRoom(client, item.room_type_id, checkInDate, checkOutDate, [...lockedRoomIds, ...explicitRoomIds]);

        if (roomQuery.rows.length === 0) {
          await safeRollback(client);
          res.status(409).json({
            success: false,
            message: requestedRoomId
              ? `ห้อง ${roomType.room_name} ที่เลือกไว้ไม่ว่างแล้วสำหรับวันที่นี้ กรุณาเลือกห้องอื่น`
              : `ห้องประเภท ${roomType.room_name} ว่างไม่พอสำหรับวันที่เลือก`,
          });
          return;
        }

        lockedRoomIds.push(roomQuery.rows[0].room_id);
        lockedRooms.push({
          room_id: roomQuery.rows[0].room_id,
          room_type_id: item.room_type_id,
          price_per_night: Number(roomType.price),
          room_name: roomType.room_name,
          room_number: String(roomQuery.rows[0].room_number),
        });
      }
    }

    const subtotals = lockedRooms.map((room) =>
      lineSubtotal(room.price_per_night, nights)
    );
    const faceValueTotal = sumSubtotals(subtotals);

    // แต่ละประเภทห้องใช้โปรโมชั่นของตัวเองได้ (1 ประเภทห้อง : 1 โปรโมชั่น) — คิดส่วนลดแยกตามยอดรวมของประเภทนั้นๆ
    const promotionByType = new Map<number, number>();
    for (const item of items) {
      if (item.promotion_id) promotionByType.set(item.room_type_id, item.promotion_id);
    }
    const usesPerItemPromotions = promotionByType.size > 0;
    // โค้ดเดียวกันใช้ซ้ำข้ามประเภทห้องในบิลเดียวกันไม่ได้ (wallet/usage จะถูกนับซ้ำ)
    const perItemPromoIds = [...promotionByType.values()];
    if (new Set(perItemPromoIds).size !== perItemPromoIds.length) {
      await safeRollback(client);
      res.status(400).json({ success: false, message: 'ไม่สามารถใช้โค้ดเดียวกันกับหลายประเภทห้องในการจองเดียวกันได้' });
      return;
    }
    if (perItemPromoIds.length > 1) {
      const promoCheck = await client.query(
        `SELECT id, stackable FROM promotions WHERE id = ANY($1::int[])`,
        [perItemPromoIds]
      );
      const allStackable = promoCheck.rows.length === perItemPromoIds.length && promoCheck.rows.every((p: { stackable: boolean }) => p.stackable);
      if (!allStackable) {
        await safeRollback(client);
        res.status(400).json({ success: false, message: 'โค้ดนี้ใช้ร่วมกับโปรโมชั่นอื่นไม่ได้' });
        return;
      }
    }

    let totalPrice = faceValueTotal;
    const appliedPromotions: Array<{ room_type_id: number; promotion_id: number; discount_amount: number; line: ApplyLine | null }> = [];
    // บัตรพายเรือ (โปรโมชั่นเสริม) ที่จะแจกให้ "ต่อห้องพักจริง" — คีย์คือ room_type_id เพื่อ map กลับไปห้องแต่ละห้องทีหลัง
    const boatGrantByRoomType = new Map<
      number,
      { promotionId: number; ticketsPerRoom: number; mode: 'free' | 'paid'; unitPrice: number }
    >();
    let legacyBoatGrant: { promotionId: number; ticketsPerRoom: number; mode: 'free' | 'paid'; unitPrice: number } | null = null;
    let legacyApplyLine: ApplyLine | null = null;

    let bookingMemberId = user.id;
    if (user.role !== 'customer') {
      const adminMemberRes = await client.query('SELECT member_id FROM members WHERE email = $1', [user.email]);
      if (adminMemberRes.rows.length > 0) {
        bookingMemberId = adminMemberRes.rows[0].member_id;
      } else {
        const newAdminMember = await client.query(
          `INSERT INTO members (email, password, first_name, last_name, phone, is_active)
           VALUES ($1, 'ADMIN_TEST_ACCOUNT', COALESCE($2, 'Admin'), 'Staff', COALESCE($3, '0800000000'), true)
           RETURNING member_id`,
          [user.email, guestName || 'Admin', guestPhone || '0800000000']
        );
        bookingMemberId = newAdminMember.rows[0].member_id;
      }
    }

    if (usesPerItemPromotions) {
      totalPrice = 0;
      // รวมยอดหน้าตั๋วของแต่ละประเภทห้อง (อาจมีหลายห้องต่อประเภท)
      const typeSubtotals = new Map<number, number>();
      lockedRooms.forEach((room, idx) => {
        typeSubtotals.set(room.room_type_id, (typeSubtotals.get(room.room_type_id) ?? 0) + subtotals[idx]);
      });

      for (const [roomTypeId, typeSubtotal] of typeSubtotals) {
        const promoId = promotionByType.get(roomTypeId);
        if (!promoId) {
          totalPrice += typeSubtotal;
          continue;
        }
        try {
          const { finalPrice, line, boatTicketCount, boatAddonMode, boatAddonPrice } = await applyPromotionDiscount(client, promoId, typeSubtotal, nights, bookingMemberId, [roomTypeId]);
          appliedPromotions.push({
            room_type_id: roomTypeId,
            promotion_id: promoId,
            discount_amount: typeSubtotal - finalPrice,
            line,
          });
          totalPrice += finalPrice;
          if (boatTicketCount > 0) {
            boatGrantByRoomType.set(roomTypeId, {
              promotionId: promoId,
              ticketsPerRoom: boatTicketCount,
              mode: boatAddonMode,
              unitPrice: boatAddonPrice,
            });
          }
        } catch (err) {
          await safeRollback(client);
          res.status(400).json({
            success: false,
            message: err instanceof Error ? err.message : 'โปรโมชั่นไม่ถูกต้อง',
          });
          return;
        }
      }
    } else if (legacyPromotionId) {
      try {
        const { finalPrice, line, boatTicketCount, boatAddonMode, boatAddonPrice } = await applyPromotionDiscount(client, legacyPromotionId, faceValueTotal, nights, bookingMemberId, [...new Set(lockedRooms.map(room => room.room_type_id))]);
        totalPrice = finalPrice;
        legacyApplyLine = line;
        if (boatTicketCount > 0) {
          legacyBoatGrant = {
            promotionId: legacyPromotionId,
            ticketsPerRoom: boatTicketCount,
            mode: boatAddonMode,
            unitPrice: boatAddonPrice,
          };
        }
      } catch (err) {
        await safeRollback(client);
        res.status(400).json({
          success: false,
          message: err instanceof Error ? err.message : 'โปรโมชั่นไม่ถูกต้อง',
        });
        return;
      }
    }

    // Multiple codes live in the ledger; the legacy header stores a single code only.
    const primaryPromotionId = usesPerItemPromotions
      ? headerPromotionId(appliedPromotions.map(applied => applied.promotion_id))
      : legacyPromotionId;

    const guestTotal = adults + children;
    const headerRes = await client.query(
      `INSERT INTO room_bookings (
         member_id, check_in, check_out, guest_count, adults, children, child_ages,
         special_request, arrival_time, promotion_id, status, total_price, guest_name, guest_phone, guest_email
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, $12, $13, $14)
       RETURNING *`,
      [
        bookingMemberId,
        checkInDate,
        checkOutDate,
        guestTotal,
        adults,
        children,
        childAges,
        specialRequests,
        arrivalTime,
        primaryPromotionId,
        totalPrice,
        guestName,
        guestPhone,
        guestEmail,
      ]
    );
    const header = headerRes.rows[0];
    const roomBookingId = header.room_booking_id as number;

    const lineRows: unknown[] = [];
    for (let i = 0; i < lockedRooms.length; i += 1) {
      const room = lockedRooms[i];
      const lineRes = await client.query(
        `INSERT INTO booking_room (
           room_booking_id, room_id, price_per_night, nights, subtotal, status
         ) VALUES ($1, $2, $3, $4, $5, 'pending')
         RETURNING *`,
        [
          roomBookingId,
          room.room_id,
          room.price_per_night,
          nights,
          subtotals[i],
        ]
      );
      lineRows.push({
        ...lineRes.rows[0],
        room_name: room.room_name,
        room_number: room.room_number,
      });
    }

    for (const applied of appliedPromotions) {
      await client.query(
        `INSERT INTO booking_room_promotions (room_booking_id, room_type_id, promotion_id, discount_amount)
         VALUES ($1, $2, $3, $4)`,
        [roomBookingId, applied.room_type_id, applied.promotion_id, applied.discount_amount]
      );
    }
    // บันทึก ledger ผ่าน persistBookingPromotions เพื่อให้ usage_count, wallet และการคืนโควตาตอนยกเลิกทำงานตรงกัน
    const ledgerLines: ApplyLine[] = appliedPromotions
      .map((applied) => applied.line)
      .filter((line): line is ApplyLine => line !== null);
    if (legacyApplyLine) ledgerLines.push(legacyApplyLine);
    if (ledgerLines.length > 0) {
      await persistBookingPromotions(client, {
        memberId: bookingMemberId,
        roomBookingId,
        result: { totalPrice, lines: ledgerLines, headerPromotionId: primaryPromotionId },
      });
    }

    // แจกบัตรพายเรือ (โปรโมชั่นเสริม ฟรีหรือขาย) เข้าบัญชีของ "แต่ละห้องพักจริง" — 1 ห้อง = N ครั้งตามโปรโมชั่นที่ใช้กับห้องนั้น
    let totalBoatTickets = 0;
    for (let i = 0; i < lockedRooms.length; i += 1) {
      const room = lockedRooms[i];
      const grant = usesPerItemPromotions
        ? boatGrantByRoomType.get(room.room_type_id)
        : legacyBoatGrant;
      if (!grant) continue;
      const bookingRoomId = (lineRows[i] as { booking_room_id: number }).booking_room_id;
      await client.query(
        `INSERT INTO member_boat_tickets (member_id, promotion_id, room_booking_id, booking_room_id, total_tickets, mode, unit_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [bookingMemberId, grant.promotionId, roomBookingId, bookingRoomId, grant.ticketsPerRoom, grant.mode, grant.unitPrice]
      );
      totalBoatTickets += grant.ticketsPerRoom;
    }

    const ticketSummary = await client.query(
      `SELECT ${BOAT_TICKET_SUMMARY_SQL} AS boat_ticket_summary
       FROM room_bookings rb WHERE rb.room_booking_id = $1`,
      [roomBookingId]
    );

    await client.query('COMMIT');

    (async () => {
      try {
        const memberRes = await pool.query(
          'SELECT email, first_name, last_name FROM members WHERE member_id = $1',
          [user.id]
        );
        if (memberRes.rows.length === 0) return;
        const m = memberRes.rows[0];
        const customerName =
          guestName || `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email;
        const details = lockedRooms
          .map((r) => `${r.room_name} (ห้อง ${r.room_number})`)
          .join(', ');
        const checkInStr = new Date(checkInDate).toLocaleDateString('th-TH');
        const checkOutStr = new Date(checkOutDate).toLocaleDateString('th-TH');
        await sendBookingConfirmationEmail({
          to: guestEmail || m.email,
          customerName,
          bookingType: 'room',
          bookingId: roomBookingId,
          details,
          dateInfo: `${checkInStr} - ${checkOutStr}`,
          totalPrice: Number(totalPrice),
        });
      } catch (err) {
        console.error('Send booking confirmation mail error:', err);
      }
    })();

    res.status(201).json({
      success: true,
      message: 'Booking created',
      data: { ...header, rooms: lineRows, applied_promotions: appliedPromotions, boat_tickets_granted: totalBoatTickets, boat_ticket_summary: ticketSummary.rows[0]?.boat_ticket_summary },
    });
  } catch (error) {
    await safeRollback(client);
    console.error('Create room booking error:', error);
    if (error instanceof PromoApplyError) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    if (error instanceof Error && error.message.includes('check_out_date')) {
      res.status(400).json({ success: false, message: error.message });
      return;
    }
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const getUserRoomBookings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const [result, resortRes] = await Promise.all([
      pool.query(
        `SELECT rb.room_booking_id as id, rb.room_booking_id,
                rb.check_in as check_in_date, rb.check_out as check_out_date,
                rb.guest_count as guests, rb.adults, rb.children, rb.child_ages,
                rb.guest_name, rb.guest_phone, rb.guest_email,
                rb.total_price, rb.status, rb.special_request, rb.arrival_time, rb.created_at,
                rb.reject_reason, rb.payment_status, rb.payment_date,
                (SELECT MIN(brc.checkin_at) FROM booking_room brc WHERE brc.room_booking_id = rb.room_booking_id) AS checkin_at,
                rb.checkout_at,
                ${ROOMS_JSON_SQL} AS rooms,
                ${BOAT_TICKET_SUMMARY_SQL} AS boat_ticket_summary,
                (
                  SELECT json_agg(json_build_object(
                    'name', p.name,
                    'code', p.code,
                    'discount_amount', brp.discount_amount
                  ))
                  FROM booking_room_promotions brp
                  JOIN promotions p ON p.id = brp.promotion_id
                  WHERE brp.room_booking_id = rb.room_booking_id
                ) AS promotions,
                first_room.room_name,
                first_room.type_name AS room_type,
                first_room.room_number,
                (
                  SELECT json_agg(image_path)
                  FROM room_images ri
                  WHERE ri.room_type_id = first_room.room_type_id
                ) AS room_images, (SELECT COUNT(*) > 0 FROM member_boat_tickets mbt WHERE mbt.room_booking_id = rb.room_booking_id AND mbt.booking_room_id IS NOT NULL AND mbt.used_tickets < mbt.total_tickets) AS has_unused_boat_tickets
         FROM room_bookings rb
         LEFT JOIN LATERAL (
           SELECT rt.room_name, rt.type_name, r.room_number, r.room_type_id
           FROM booking_room br
           JOIN rooms r ON r.room_id = br.room_id
           JOIN room_types rt ON rt.id = r.room_type_id
           WHERE br.room_booking_id = rb.room_booking_id
           ORDER BY br.booking_room_id
           LIMIT 1
         ) first_room ON true
         WHERE rb.member_id = $1
         ORDER BY rb.created_at DESC`,
        [user.id]
      ),
      pool.query(`SELECT payment_due_days FROM resort_info ORDER BY id ASC LIMIT 1`),
    ]);
    const payment_due_days = Number(resortRes.rows[0]?.payment_due_days ?? 3);
    res.json({ success: true, data: result.rows, payment_due_days });
  } catch (error) {
    console.error('Get user bookings error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getRoomBookingById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, message: 'Invalid id' });
      return;
    }

    const result = await pool.query(
      `SELECT rb.room_booking_id as id, rb.room_booking_id,
              to_char(rb.check_in, 'YYYY-MM-DD') as check_in_date,
              to_char(rb.check_out, 'YYYY-MM-DD') as check_out_date,
              rb.guest_count as guests, rb.adults, rb.children, rb.child_ages,
              rb.guest_name, rb.guest_phone, rb.guest_email,
              rb.total_price, rb.status, rb.special_request, rb.arrival_time, rb.created_at,
              ${ROOMS_JSON_SQL} AS rooms,
              ${BOAT_TICKET_SUMMARY_SQL} AS boat_ticket_summary
       FROM room_bookings rb
       WHERE rb.room_booking_id = $1 AND (($3 = 'customer' AND rb.member_id = $2) OR $3 = 'admin')`,
      [id, user.id, user.role]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    const booking = result.rows[0];
    const roomTypeId = await pool.query(
      `SELECT r.room_type_id
       FROM booking_room br
       JOIN rooms r ON r.room_id = br.room_id
       WHERE br.room_booking_id = $1
       ORDER BY br.booking_room_id
       LIMIT 1`,
      [id]
    );
    // ห้องพักผูก amenity ผ่าน room_types.amenity_ids (array) ไม่ใช่ตาราง junction (touch)
    const roomTypeRes = await pool.query(
      `SELECT amenity_ids FROM room_types WHERE id = $1`,
      [roomTypeId.rows[0]?.room_type_id]
    );
    const amResult = await pool.query(
      `SELECT name FROM room_amenities WHERE id = ANY($1::integer[]) AND status = true`,
      [roomTypeRes.rows[0]?.amenity_ids || []]
    );
    const amenities = amResult.rows.map((r: { name: string }) => r.name);

    // โปรโมชั่นที่ใช้จริงในการจองนี้ (อาจมีมากกว่า 1 อัน ถ้าจองหลายประเภทห้อง)
    const promoResult = await pool.query(
      `SELECT p.name, p.code, brp.discount_amount, brp.room_type_id, rt.type_name
       FROM booking_room_promotions brp
       JOIN promotions p ON p.id = brp.promotion_id
       LEFT JOIN room_types rt ON rt.id = brp.room_type_id
       WHERE brp.room_booking_id = $1
       ORDER BY brp.room_type_id`,
      [id]
    );
    const promotions = promoResult.rows.map((r) => ({
      name: r.name,
      code: r.code,
      discount_amount: Number(r.discount_amount),
      room_type_id: r.room_type_id,
      type_name: r.type_name,
    }));

    res.json({ success: true, data: { ...booking, amenities, promotions } });
  } catch (error) {
    console.error('Get booking error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const cancelRoomBooking = async (
  req: Request,
  res: Response
): Promise<void> => {
  const client = await pool.connect();
  try {
    const user = req.user as AuthPayload;
    const id = parsePositiveInt(req.params.id);
    if (id === null) {
      res.status(400).json({ success: false, message: 'Invalid id' });
      return;
    }

    await client.query('BEGIN');
    const booking = await client.query(
      'SELECT * FROM room_bookings WHERE room_booking_id = $1 AND member_id = $2 FOR UPDATE',
      [id, user.id]
    );
    if (booking.rows.length === 0) {
      await safeRollback(client);
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    if (booking.rows[0].status !== 'pending') {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: `Cannot cancel booking with status: ${booking.rows[0].status}`,
      });
      return;
    }

    await client.query(
      `UPDATE room_bookings SET status = 'cancelled', updated_at = NOW() WHERE room_booking_id = $1`,
      [id]
    );
    await client.query(
      `UPDATE booking_room SET status = 'cancelled', updated_at = NOW()
       WHERE room_booking_id = $1 AND status <> 'checked_out'`,
      [id]
    );
    // คืนโควตาโปรโมชั่นและ usage_count (สถานะเป็น pending เสมอในจุดนี้)
    await restoreBookingPromotions(client, { previousStatus: 'pending', roomBookingId: Number(id) });
    // ยกเลิกบัตรเสริมเรือคายัค (ถ้าจองไว้แล้ว) พร้อมกับห้องพักนี้
    await cancelBoatAddonsForRoomBooking(client, Number(id), 'pending');
    // เพิกถอนบัตรพายเรือฟรีที่แจกไว้จากการจองนี้ (เฉพาะที่ยังไม่ถูกใช้เลย)
    await client.query(
      `DELETE FROM member_boat_tickets WHERE room_booking_id = $1 AND used_tickets = 0`,
      [id]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: 'Booking cancelled' });
  } catch (error) {
    await safeRollback(client);
    console.error('Cancel booking error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const getAllRoomBookings = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const pagination = parsePagination(req.query);
    const params: (string | number)[] = [];
    let where = 'WHERE 1=1';
    const pendingSlip = "NULLIF(rb.payment_slip, '') IS NOT NULL AND rb.status NOT IN ('approved', 'checked_out', 'rejected', 'cancelled')";
    const unpaidPending = "NULLIF(rb.payment_slip, '') IS NULL AND rb.status = 'pending'";
    if (req.query.filter === 'has_slip') where += ` AND (${pendingSlip})`;
    else if (req.query.filter === 'pending') where += ` AND (${unpaidPending})`;
    else if (req.query.filter === 'approved' || req.query.filter === 'checked_out') {
      params.push(req.query.filter); where += ` AND rb.status = $${params.length}`;
    }
    if (typeof req.query.status === 'string') { params.push(req.query.status); where += ` AND rb.status = $${params.length}`; }
    const type = req.query.room_type;
    if (typeof type === 'string' && type !== 'all') {
      params.push(type);
      where += ` AND EXISTS (SELECT 1 FROM booking_room br JOIN rooms r ON r.room_id = br.room_id
         JOIN room_types rt ON rt.id = r.room_type_id
         WHERE br.room_booking_id = rb.room_booking_id AND COALESCE(NULLIF(rt.type_name, ''), rt.room_name) = $${params.length})`;
    }
    for (const [key, operator] of [['date_from', '>='], ['date_to', '<=']]) {
      if (typeof req.query[key] === 'string') { params.push(req.query[key] as string); where += ` AND rb.check_in::date ${operator} $${params.length}::date`; }
    }
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      params.push(`%${req.query.search.trim()}%`);
      where += ` AND (rb.room_booking_id::text ILIKE $${params.length}
        OR CONCAT_WS(' ', m.first_name, m.last_name) ILIKE $${params.length}
        OR m.phone ILIKE $${params.length} OR m.email ILIKE $${params.length}
        OR rb.guest_name ILIKE $${params.length} OR rb.guest_phone ILIKE $${params.length} OR rb.guest_email ILIKE $${params.length} OR EXISTS (SELECT 1 FROM booking_room br JOIN rooms r ON r.room_id = br.room_id
          JOIN room_types rt ON rt.id = r.room_type_id WHERE br.room_booking_id = rb.room_booking_id
          AND (rt.room_name ILIKE $${params.length} OR rt.type_name ILIKE $${params.length} OR r.room_number::text ILIKE $${params.length} OR r.room_id::text ILIKE $${params.length})))`;
    }
    const from = `FROM room_bookings rb
       JOIN members m ON rb.member_id = m.member_id
       LEFT JOIN staff s ON rb.approved_by_staff_id = s.staff_id`;
    let extra = {};
    if (pagination) {
      const count = await pool.query(`SELECT COUNT(*) AS total ${from} ${where}`, params);
      const summary = await pool.query(`SELECT COUNT(*) AS "all",
        COUNT(*) FILTER (WHERE ${pendingSlip}) AS has_slip,
        COUNT(*) FILTER (WHERE ${unpaidPending}) AS pending,
        COUNT(*) FILTER (WHERE rb.status = 'approved') AS approved,
        COUNT(*) FILTER (WHERE rb.status = 'checked_out') AS checked_out,
        COALESCE(SUM(rb.total_price) FILTER (WHERE rb.status IN ('approved', 'checked_out')), 0) AS "totalRevenue",
        COALESCE(SUM(rb.total_price) FILTER (WHERE ${pendingSlip}), 0) AS "pendingRevenue"
        ${from}`);
      const row = summary.rows[0];
      extra = { pagination: paginationMeta(pagination, Number(count.rows[0].total)),
        summary: { all: Number(row.all), has_slip: Number(row.has_slip), pending: Number(row.pending), approved: Number(row.approved),
          checked_out: Number(row.checked_out), totalRevenue: Number(row.totalRevenue), pendingRevenue: Number(row.pendingRevenue) } };
    }
    const sortColumns: Record<string, string> = { check_in: 'rb.check_in', total_price: 'rb.total_price', created_at: 'rb.created_at' };
    const sort = typeof req.query.sort === 'string' ? sortColumns[req.query.sort] || 'rb.created_at' : 'rb.created_at';
    const direction = req.query.sort_dir === 'asc' ? 'ASC' : 'DESC';
    const result = await pool.query(
      `SELECT rb.room_booking_id, rb.room_booking_id as id,
              rb.check_in, rb.check_out,
              rb.check_in as check_in_date, rb.check_out as check_out_date,
              rb.checkout_at,
              rb.guest_count as guests, rb.adults, rb.children, rb.child_ages,
              rb.guest_name, rb.guest_phone, rb.guest_email,
              rb.total_price, rb.status, rb.special_request, rb.arrival_time,
              rb.payment_status, rb.payment_slip, rb.created_at,
              COALESCE(rb.guest_name, CONCAT_WS(' ', m.first_name, m.last_name)) as user_name,
              COALESCE(rb.guest_email, m.email) as user_email, COALESCE(rb.guest_phone, m.phone) as user_phone,
              CONCAT_WS(' ', s.first_name, s.last_name) as approved_by_name,
              ${ROOMS_JSON_SQL} AS rooms,
              ${BOAT_ADDONS_JSON_SQL} AS boat_addons,
              (
                SELECT rt.room_name
                FROM booking_room br
                JOIN rooms r ON r.room_id = br.room_id
                JOIN room_types rt ON rt.id = r.room_type_id
                WHERE br.room_booking_id = rb.room_booking_id
                ORDER BY br.booking_room_id LIMIT 1
              ) AS room_name,
              (
                SELECT rt.type_name FROM booking_room br
                JOIN rooms r ON r.room_id = br.room_id
                JOIN room_types rt ON rt.id = r.room_type_id
                WHERE br.room_booking_id = rb.room_booking_id
                ORDER BY br.booking_room_id LIMIT 1
              ) AS type_name,
              (
                SELECT r.room_number
                FROM booking_room br
                JOIN rooms r ON r.room_id = br.room_id
                WHERE br.room_booking_id = rb.room_booking_id
                ORDER BY br.booking_room_id LIMIT 1
              ) AS room_number
       ${from} ${where}
       ORDER BY ${sort} ${direction}, rb.room_booking_id DESC
       ${pagination ? `LIMIT $${params.length + 1} OFFSET $${params.length + 2}` : ''}`,
      pagination ? [...params, pagination.limit, pagination.offset] : params
    );
    res.json({ success: true, data: result.rows, ...extra });
  } catch (error) {
    console.error('Get all bookings error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateRoomBookingStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  const client = await pool.connect();
  try {
    const id = parsePositiveInt(req.params.id);
    const { status, reject_reason } = req.body;
    const user = req.user as AuthPayload;

    if (id === null) {
      res.status(400).json({ success: false, message: 'Invalid id' });
      return;
    }
    const allowed = ['approved', 'rejected', 'pending', 'cancelled'];
    if (!allowed.includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status' });
      return;
    }

    await client.query('BEGIN');

    const previous = await client.query(
      'SELECT status FROM room_bookings WHERE room_booking_id = $1 FOR UPDATE',
      [id]
    );
    if (previous.rows.length === 0) {
      await safeRollback(client);
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    const previousStatus = String(previous.rows[0].status);

    const transitionError = assertStatusTransition(previousStatus, status);
    if (transitionError) {
      await safeRollback(client);
      res.status(400).json({ success: false, message: transitionError });
      return;
    }

    // ห้องที่เช็คอินหรือเช็คเอาท์แล้วต้องไม่ถูกย้อนสถานะหรือยกเลิกผ่านการเปลี่ยนสถานะ header
    if (status === 'rejected' || status === 'cancelled' || status === 'pending') {
      const activeOrDone = await client.query(
        "SELECT 1 FROM booking_room WHERE room_booking_id = $1 AND status IN ('checked_in', 'checked_out') LIMIT 1",
        [id]
      );
      if (activeOrDone.rows.length > 0) {
        await safeRollback(client);
        res.status(400).json({ success: false, message: 'ไม่สามารถเปลี่ยนสถานะได้ เนื่องจากมีห้องที่เช็คอินหรือเช็คเอาท์แล้ว' });
        return;
      }
    }

    let query = `UPDATE room_bookings SET status = $1, updated_at = NOW()`;
    const params: Array<string | number> = [status];

    if (status === 'approved' || status === 'rejected') {
      query += `, approved_by_staff_id = $2`;
      params.push(user.id);
    }

    if (status === 'rejected') {
      query += `, reject_reason = $${params.length + 1}`;
      params.push(typeof reject_reason === 'string' && reject_reason.trim() ? reject_reason.trim() : 'ไม่ระบุเหตุผล');
    }

    params.push(id);
    query += ` WHERE room_booking_id = $${params.length} RETURNING *`;

    const result = await client.query(query, params);

    await client.query(
      `UPDATE booking_room SET status = $1, updated_at = NOW()
       WHERE room_booking_id = $2 AND status <> 'checked_out'`,
      [status, id]
    );

    if (status === 'rejected' || status === 'cancelled') {
      // คืนโควตาโปรโมชั่นเมื่อ header เดิมเป็น pending/paid (ตรรกะอยู่ใน restoreBookingPromotions)
      await restoreBookingPromotions(client, { previousStatus, roomBookingId: Number(id) });
      // ยกเลิกบัตรเสริมเรือคายัคที่จองไว้แล้ว (คืนโควตารอบเรือ) พร้อมกับห้องพักนี้
      await cancelBoatAddonsForRoomBooking(client, Number(id), previousStatus);
      // เพิกถอนบัตรพายเรือฟรีที่แจกไว้จากการจองนี้ (เฉพาะที่ยังไม่ถูกใช้เลย)
      await client.query(
        `DELETE FROM member_boat_tickets WHERE room_booking_id = $1 AND used_tickets = 0`,
        [id]
      );
    } else if (status === 'approved') {
      // ยืนยันบัตรเสริมเรือคายัคที่จองไว้แล้วให้เป็นสถานะเดียวกับห้องพัก
      await approveBoatAddonsForRoomBooking(client, Number(id));
    }

    await client.query('COMMIT');

    if (status === 'approved' || status === 'rejected') {
      (async () => {
        try {
          const infoRes = await pool.query(
            `SELECT COALESCE(rb.guest_email, m.email) AS email,
                    COALESCE(rb.guest_name, CONCAT_WS(' ', m.first_name, m.last_name)) AS customer_name,
                    (
                      SELECT string_agg(rt.room_name || ' (ห้อง ' || r.room_number || ')', ', ' ORDER BY br.booking_room_id)
                      FROM booking_room br
                      JOIN rooms r ON r.room_id = br.room_id
                      JOIN room_types rt ON rt.id = r.room_type_id
                      WHERE br.room_booking_id = rb.room_booking_id
                    ) AS details
             FROM room_bookings rb
             JOIN members m ON rb.member_id = m.member_id
             WHERE rb.room_booking_id = $1`,
            [id]
          );
          if (infoRes.rows.length > 0) {
            const info = infoRes.rows[0];
            const customerName =
              info.customer_name ||
              info.email;
            await sendBookingStatusEmail({
              to: info.email,
              customerName,
              bookingType: 'room',
              bookingId: Number(id),
              status: status as 'approved' | 'rejected',
              details: info.details || 'การจองห้องพัก',
            });
          }
        } catch (err) {
          console.error('Send booking status mail error:', err);
        }
      })();
    }

    res.json({
      success: true,
      message: 'Booking status updated',
      data: result.rows[0],
    });
  } catch (error) {
    await safeRollback(client);
    console.error('Update booking status error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};

/** เมื่อทุกห้องในบิลนี้ถูกเช็คเอาต์ครบแล้ว ให้อัปเดตสถานะหัวการจองเป็น checked_out ด้วย
 *  (ต้องเรียกภายใน transaction เดียวกับที่ UPDATE booking_room มาก่อนหน้า) */
async function syncHeaderStatusIfAllCheckedOut(
  client: import('pg').PoolClient,
  roomBookingId: number
): Promise<void> {
  if (!roomBookingId) return;
  const remaining = await client.query(
    `SELECT COUNT(*)::int AS cnt FROM booking_room
     WHERE room_booking_id = $1 AND status NOT IN ('checked_out', 'cancelled', 'rejected')`,
    [roomBookingId]
  );
  if (remaining.rows[0]?.cnt === 0) {
    await client.query(
      `UPDATE room_bookings SET status = 'checked_out', updated_at = NOW()
       WHERE room_booking_id = $1 AND status = 'approved'`,
      [roomBookingId]
    );
  }
}

/** Check-in ทีละห้อง (ที่หน้าเคาน์เตอร์เมื่อลูกค้ามาถึงจริง) */
export const checkinBookingRoom = async (
  req: Request,
  res: Response
): Promise<void> => {
  const client = await pool.connect();
  try {
    const bookingRoomId = Number(req.params.bookingRoomId);
    if (!Number.isInteger(bookingRoomId) || bookingRoomId < 1) {
      res.status(400).json({ success: false, message: 'Invalid booking_room id' });
      return;
    }

    await client.query('BEGIN');
    // Serialize every line action with header cancellation and other lines.
    // Always acquire the header before the room line to avoid reversed locks.
    await client.query(
      `SELECT rb.room_booking_id FROM room_bookings rb
       WHERE rb.room_booking_id = (
         SELECT room_booking_id FROM booking_room WHERE booking_room_id = $1
       ) FOR UPDATE OF rb`,
      [bookingRoomId]
    );
    const lineRes = await client.query(
      `SELECT br.booking_room_id, br.room_id, br.status AS line_status, rb.status AS header_status
       FROM booking_room br
       JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
       WHERE br.booking_room_id = $1
       FOR UPDATE OF br`,
      [bookingRoomId]
    );

    if (lineRes.rows.length === 0) {
      await safeRollback(client);
      res.status(404).json({ success: false, message: 'Booking room not found' });
      return;
    }

    const line = lineRes.rows[0];
    if (line.header_status !== 'approved') {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: 'เช็คอินได้เมื่อหัวการจองเป็น approved',
      });
      return;
    }
    if (line.line_status !== 'approved') {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: `Cannot check in line with status: ${line.line_status}`,
      });
      return;
    }

    await client.query(
      `UPDATE booking_room
       SET status = 'checked_in', checkin_at = NOW(), updated_at = NOW()
       WHERE booking_room_id = $1`,
      [bookingRoomId]
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'เช็คอินห้องสำเร็จ' });
  } catch (error) {
    await safeRollback(client);
    console.error('Checkin booking room error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};

/** Legacy: check out every checked-in line under a header booking. */
export const checkoutRoomBooking = async (
  req: Request,
  res: Response
): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');
    const booking = await client.query(
      `SELECT status FROM room_bookings WHERE room_booking_id = $1 FOR UPDATE`,
      [id]
    );
    if (booking.rows.length === 0) {
      await safeRollback(client);
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    if (booking.rows[0].status !== 'approved') {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: 'เช็คเอาต์ได้เฉพาะการจองที่อนุมัติแล้ว',
      });
      return;
    }

    const lines = await client.query(
      `UPDATE booking_room
       SET status = 'checked_out', checkout_at = NOW(), updated_at = NOW()
       WHERE room_booking_id = $1 AND status = 'checked_in'
       RETURNING room_id`,
      [id]
    );
    if ((lines.rowCount ?? 0) === 0) {
      await safeRollback(client);
      res.status(400).json({ success: false, message: 'ยังไม่มีห้องที่เช็คอินในการจองนี้' });
      return;
    }

    for (const line of lines.rows) {
      await client.query(
        `UPDATE rooms SET status = 'available' WHERE room_id = $1 AND status <> 'maintenance'`,
        [line.room_id]
      );
    }

    await syncHeaderStatusIfAllCheckedOut(client, Number(id));

    await client.query('COMMIT');
    res.json({
      success: true,
      message: 'เช็คเอาต์สำเร็จเรียบร้อย',
      data: { checked_out_count: lines.rowCount ?? 0 },
    });
  } catch (error) {
    await safeRollback(client);
    console.error('Checkout room booking error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};

export const checkoutBookingRoom = async (
  req: Request,
  res: Response
): Promise<void> => {
  const client = await pool.connect();
  try {
    const bookingRoomId = Number(req.params.bookingRoomId);
    if (!Number.isInteger(bookingRoomId) || bookingRoomId < 1) {
      res.status(400).json({ success: false, message: 'Invalid booking_room id' });
      return;
    }

    await client.query('BEGIN');
    await client.query(
      `SELECT rb.room_booking_id FROM room_bookings rb
       WHERE rb.room_booking_id = (
         SELECT room_booking_id FROM booking_room WHERE booking_room_id = $1
       ) FOR UPDATE OF rb`,
      [bookingRoomId]
    );
    const lineRes = await client.query(
      `SELECT br.booking_room_id, br.room_id, br.room_booking_id, br.status AS line_status, rb.status AS header_status
       FROM booking_room br
       JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
       WHERE br.booking_room_id = $1
       FOR UPDATE OF br`,
      [bookingRoomId]
    );

    if (lineRes.rows.length === 0) {
      await safeRollback(client);
      res.status(404).json({ success: false, message: 'Booking room not found' });
      return;
    }

    const line = lineRes.rows[0];
    if (line.header_status !== 'approved') {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: 'เช็คเอาต์ได้เมื่อหัวการจองเป็น approved',
      });
      return;
    }
    if (line.line_status !== 'checked_in') {
      await safeRollback(client);
      res.status(400).json({
        success: false,
        message: `Cannot check out line with status: ${line.line_status}`,
      });
      return;
    }

    await client.query(
      `UPDATE booking_room
       SET status = 'checked_out', checkout_at = NOW(), updated_at = NOW()
       WHERE booking_room_id = $1`,
      [bookingRoomId]
    );
    await client.query(
      `UPDATE rooms SET status = 'available' WHERE room_id = $1 AND status <> 'maintenance'`,
      [line.room_id]
    );

    await syncHeaderStatusIfAllCheckedOut(client, line.room_booking_id);

    await client.query('COMMIT');
    res.json({ success: true, message: 'เช็คเอาต์ห้องสำเร็จ' });
  } catch (error) {
    await safeRollback(client);
    console.error('Checkout booking room error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};
