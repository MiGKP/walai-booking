import { Request, Response } from 'express';
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
  nights: number
): Promise<{ finalPrice: number; boatTicketCount: number }> {
  const promoRes = await client.query(
    `SELECT discount_type, discount_value, max_discount, min_nights, min_price, is_active, boat_ticket_count
     FROM promotions WHERE id = $1`,
    [promotionId]
  );
  if (promoRes.rows.length === 0 || !promoRes.rows[0].is_active) {
    throw new Error('โปรโมชั่นไม่ถูกต้องหรือหมดอายุแล้ว');
  }
  const promo = promoRes.rows[0];
  if (promo.min_nights != null && nights < Number(promo.min_nights)) {
    throw new Error(`โปรโมชั่นนี้ต้องจองขั้นต่ำ ${promo.min_nights} คืน`);
  }
  if (promo.min_price != null && basePrice < Number(promo.min_price)) {
    throw new Error(
      `โปรโมชั่นนี้ต้องมียอดขั้นต่ำ ฿${Number(promo.min_price).toLocaleString()}`
    );
  }

  let discountAmount = 0;
  if (promo.discount_type === 'percent') {
    discountAmount = (basePrice * Number(promo.discount_value)) / 100;
    if (promo.max_discount != null) {
      discountAmount = Math.min(discountAmount, Number(promo.max_discount));
    }
  } else {
    discountAmount = Math.min(Number(promo.discount_value), basePrice);
  }
  discountAmount = Math.round(discountAmount);
  return {
    finalPrice: Math.max(0, basePrice - discountAmount),
    boatTicketCount: Number(promo.boat_ticket_count) || 0,
  };
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
    const specialRequests =
      typeof body.special_requests === 'string' ? body.special_requests : null;
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
        await client.query('ROLLBACK');
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
    try {
      assertGuestsFitCapacity(adults, countCapacityChildren(childAges), sumCapacity(capacityItems));
    } catch (err) {
      await client.query('ROLLBACK');
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

    // ห้องที่ถูกจับจองไปแล้วภายใน transaction นี้ (ยังไม่ถูก insert ลง booking_room) กันไม่ให้ query
    // รอบถัดไปหยิบห้องเดียวกันซ้ำ เพราะ lock ของธุรกรรมตัวเองไม่ถูก SKIP LOCKED กันเอง
    const lockedRoomIds: number[] = [];

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
                   WHERE br.status NOT IN ('cancelled', 'rejected')
                     AND rb.check_in < $5 AND rb.check_out > $4
                 )
               FOR UPDATE`,
              [requestedRoomId, item.room_type_id, lockedRoomIds, checkInDate, checkOutDate]
            )
          : await client.query(
              `SELECT r.room_id, r.room_number
               FROM rooms r
               WHERE r.room_type_id = $1 AND r.status <> 'maintenance'
                 AND r.room_id <> ALL($4::int[])
                 AND r.room_id NOT IN (
                   SELECT br.room_id
                   FROM booking_room br
                   JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
                   WHERE br.status NOT IN ('cancelled', 'rejected')
                     AND rb.check_in < $3 AND rb.check_out > $2
                 )
               LIMIT 1
               FOR UPDATE SKIP LOCKED`,
              [item.room_type_id, checkInDate, checkOutDate, lockedRoomIds]
            );

        if (roomQuery.rows.length === 0) {
          await client.query('ROLLBACK');
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

    let totalPrice = faceValueTotal;
    const appliedPromotions: Array<{ room_type_id: number; promotion_id: number; discount_amount: number }> = [];
    // จำนวนบัตรพายเรือฟรีที่จะแจกให้สมาชิกเมื่อจองสำเร็จ (จากโปรโมชั่นที่มี boat_ticket_count > 0)
    let totalBoatTickets = 0;

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
          const { finalPrice, boatTicketCount } = await applyPromotionDiscount(client, promoId, typeSubtotal, nights);
          appliedPromotions.push({
            room_type_id: roomTypeId,
            promotion_id: promoId,
            discount_amount: typeSubtotal - finalPrice,
          });
          totalPrice += finalPrice;
          totalBoatTickets += boatTicketCount;
        } catch (err) {
          await client.query('ROLLBACK');
          res.status(400).json({
            success: false,
            message: err instanceof Error ? err.message : 'โปรโมชั่นไม่ถูกต้อง',
          });
          return;
        }
      }
    } else if (legacyPromotionId) {
      try {
        const { finalPrice, boatTicketCount } = await applyPromotionDiscount(client, legacyPromotionId, faceValueTotal, nights);
        totalPrice = finalPrice;
        totalBoatTickets += boatTicketCount;
      } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({
          success: false,
          message: err instanceof Error ? err.message : 'โปรโมชั่นไม่ถูกต้อง',
        });
        return;
      }
    }

    // เก็บโปรโมชั่นตัวแรกไว้ในคอลัมน์เดิม (room_bookings.promotion_id) เพื่อ backward-compat กับโค้ด/รายงานเดิม
    const primaryPromotionId = appliedPromotions[0]?.promotion_id ?? legacyPromotionId ?? null;

    const guestTotal = adults + children;
    const headerRes = await client.query(
      `INSERT INTO room_bookings (
         member_id, check_in, check_out, guest_count, adults, children, child_ages,
         special_request, promotion_id, status, total_price
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
       RETURNING *`,
      [
        user.id,
        checkInDate,
        checkOutDate,
        guestTotal,
        adults,
        children,
        childAges,
        specialRequests,
        primaryPromotionId,
        totalPrice,
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
      await client.query(
        'UPDATE promotions SET usage_count = usage_count + 1 WHERE id = $1',
        [applied.promotion_id]
      );
    }
    if (!usesPerItemPromotions && legacyPromotionId) {
      await client.query(
        'UPDATE promotions SET usage_count = usage_count + 1 WHERE id = $1',
        [legacyPromotionId]
      );
    }

    // แจกบัตรพายเรือฟรีเข้ากระเป๋าสมาชิก ถ้าโปรโมชั่นที่ใช้มี boat_ticket_count > 0
    if (totalBoatTickets > 0) {
      const grantPromotionId = appliedPromotions[0]?.promotion_id ?? legacyPromotionId ?? null;
      await client.query(
        `INSERT INTO member_boat_tickets (member_id, promotion_id, room_booking_id, total_tickets)
         VALUES ($1, $2, $3, $4)`,
        [user.id, grantPromotionId, roomBookingId, totalBoatTickets]
      );
    }

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
          `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email;
        const details = lockedRooms
          .map((r) => `${r.room_name} (ห้อง ${r.room_number})`)
          .join(', ');
        const checkInStr = new Date(checkInDate).toLocaleDateString('th-TH');
        const checkOutStr = new Date(checkOutDate).toLocaleDateString('th-TH');
        await sendBookingConfirmationEmail({
          to: m.email,
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
      data: { ...header, rooms: lineRows, applied_promotions: appliedPromotions, boat_tickets_granted: totalBoatTickets },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create room booking error:', error);
    if (error instanceof Error && error.message.includes('check_out_date')) {
      res.status(400).json({ success: false, message: error.message });
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
                rb.total_price, rb.status, rb.special_request, rb.created_at,
                rb.reject_reason, rb.payment_status, rb.payment_date,
                rb.checkin_at, rb.checkout_at,
                ${ROOMS_JSON_SQL} AS rooms,
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
                (
                  SELECT rt.room_name
                  FROM booking_room br
                  JOIN rooms r ON r.room_id = br.room_id
                  JOIN room_types rt ON rt.id = r.room_type_id
                  WHERE br.room_booking_id = rb.room_booking_id
                  ORDER BY br.booking_room_id
                  LIMIT 1
                ) AS room_name,
                (
                  SELECT rt.type_name
                  FROM booking_room br
                  JOIN rooms r ON r.room_id = br.room_id
                  JOIN room_types rt ON rt.id = r.room_type_id
                  WHERE br.room_booking_id = rb.room_booking_id
                  ORDER BY br.booking_room_id
                  LIMIT 1
                ) AS room_type,
                (
                  SELECT r.room_number
                  FROM booking_room br
                  JOIN rooms r ON r.room_id = br.room_id
                  WHERE br.room_booking_id = rb.room_booking_id
                  ORDER BY br.booking_room_id
                  LIMIT 1
                ) AS room_number,
                (
                  SELECT json_agg(image_path)
                  FROM room_images ri
                  WHERE ri.room_type_id = (
                    SELECT r.room_type_id
                    FROM booking_room br
                    JOIN rooms r ON r.room_id = br.room_id
                    WHERE br.room_booking_id = rb.room_booking_id
                    ORDER BY br.booking_room_id
                    LIMIT 1
                  )
                ) AS room_images
         FROM room_bookings rb
         WHERE rb.member_id = $1
         ORDER BY rb.created_at DESC`,
        [user.id]
      ),
      pool.query(`SELECT payment_due_days FROM resort_info LIMIT 1`),
    ]);
    const payment_due_days = Number(resortRes.rows[0]?.payment_due_days ?? 3);
    res.json({ success: true, data: result.rows, payment_due_days });
  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getRoomBookingById = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT rb.room_booking_id as id, rb.room_booking_id,
              rb.check_in as check_in_date, rb.check_out as check_out_date,
              rb.guest_count as guests, rb.adults, rb.children, rb.child_ages,
              rb.total_price, rb.status, rb.special_request, rb.created_at,
              ${ROOMS_JSON_SQL} AS rooms
       FROM room_bookings rb
       WHERE rb.room_booking_id = $1 AND (rb.member_id = $2 OR $3 = 'admin')`,
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
      `SELECT p.name, p.code, brp.discount_amount
       FROM booking_room_promotions brp
       JOIN promotions p ON p.id = brp.promotion_id
       WHERE brp.room_booking_id = $1`,
      [id]
    );
    const promotions = promoResult.rows.map((r) => ({
      name: r.name,
      code: r.code,
      discount_amount: Number(r.discount_amount),
    }));

    res.json({ success: true, data: { ...booking, amenities, promotions } });
  } catch (error) {
    console.error('Get booking error:', error);
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
    const { id } = req.params;

    await client.query('BEGIN');
    const booking = await client.query(
      'SELECT * FROM room_bookings WHERE room_booking_id = $1 AND member_id = $2 FOR UPDATE',
      [id, user.id]
    );
    if (booking.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    if (booking.rows[0].status !== 'pending') {
      await client.query('ROLLBACK');
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
    // เพิกถอนบัตรพายเรือฟรีที่แจกไว้จากการจองนี้ (เฉพาะที่ยังไม่ถูกใช้เลย)
    await client.query(
      `DELETE FROM member_boat_tickets WHERE room_booking_id = $1 AND used_tickets = 0`,
      [id]
    );
    await client.query('COMMIT');
    res.json({ success: true, message: 'Booking cancelled' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cancel booking error:', error);
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
    const result = await pool.query(
      `SELECT rb.room_booking_id, rb.room_booking_id as id,
              rb.check_in, rb.check_out,
              rb.check_in as check_in_date, rb.check_out as check_out_date,
              rb.checkout_at,
              rb.guest_count as guests, rb.adults, rb.children, rb.child_ages,
              rb.total_price, rb.status, rb.special_request,
              rb.payment_status, rb.payment_slip, rb.created_at,
              m.first_name || ' ' || m.last_name as user_name,
              m.email as user_email, m.phone as user_phone,
              s.first_name || ' ' || s.last_name as approved_by_name,
              ${ROOMS_JSON_SQL} AS rooms,
              (
                SELECT rt.room_name
                FROM booking_room br
                JOIN rooms r ON r.room_id = br.room_id
                JOIN room_types rt ON rt.id = r.room_type_id
                WHERE br.room_booking_id = rb.room_booking_id
                ORDER BY br.booking_room_id LIMIT 1
              ) AS room_name,
              (
                SELECT r.room_number
                FROM booking_room br
                JOIN rooms r ON r.room_id = br.room_id
                WHERE br.room_booking_id = rb.room_booking_id
                ORDER BY br.booking_room_id LIMIT 1
              ) AS room_number
       FROM room_bookings rb
       JOIN members m ON rb.member_id = m.member_id
       LEFT JOIN staff s ON rb.approved_by_staff_id = s.staff_id
       ORDER BY rb.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get all bookings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateRoomBookingStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status, reject_reason } = req.body;
    const user = req.user as AuthPayload;

    const allowed = ['approved', 'rejected', 'pending', 'cancelled'];
    if (!allowed.includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status' });
      return;
    }

    await client.query('BEGIN');

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
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    await client.query(
      `UPDATE booking_room SET status = $1, updated_at = NOW()
       WHERE room_booking_id = $2 AND status <> 'checked_out'`,
      [status, id]
    );

    if (status === 'rejected' || status === 'cancelled') {
      // เพิกถอนบัตรพายเรือฟรีที่แจกไว้จากการจองนี้ (เฉพาะที่ยังไม่ถูกใช้เลย)
      await client.query(
        `DELETE FROM member_boat_tickets WHERE room_booking_id = $1 AND used_tickets = 0`,
        [id]
      );
    }

    await client.query('COMMIT');

    if (status === 'approved' || status === 'rejected') {
      (async () => {
        try {
          const infoRes = await pool.query(
            `SELECT m.email, m.first_name, m.last_name,
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
              `${info.first_name || ''} ${info.last_name || ''}`.trim() ||
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
    await client.query('ROLLBACK');
    console.error('Update booking status error:', error);
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
    const lineRes = await client.query(
      `SELECT br.booking_room_id, br.room_id, br.status AS line_status, rb.status AS header_status
       FROM booking_room br
       JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
       WHERE br.booking_room_id = $1
       FOR UPDATE OF br`,
      [bookingRoomId]
    );

    if (lineRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Booking room not found' });
      return;
    }

    const line = lineRes.rows[0];
    if (line.header_status !== 'approved') {
      await client.query('ROLLBACK');
      res.status(400).json({
        success: false,
        message: 'เช็คอินได้เมื่อหัวการจองเป็น approved',
      });
      return;
    }
    if (line.line_status !== 'approved') {
      await client.query('ROLLBACK');
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
    await client.query('ROLLBACK');
    console.error('Checkin booking room error:', error);
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
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    if (booking.rows[0].status !== 'approved') {
      await client.query('ROLLBACK');
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
    await client.query('ROLLBACK');
    console.error('Checkout room booking error:', error);
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
    const lineRes = await client.query(
      `SELECT br.booking_room_id, br.room_id, br.room_booking_id, br.status AS line_status, rb.status AS header_status
       FROM booking_room br
       JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
       WHERE br.booking_room_id = $1
       FOR UPDATE OF br`,
      [bookingRoomId]
    );

    if (lineRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Booking room not found' });
      return;
    }

    const line = lineRes.rows[0];
    if (line.header_status !== 'approved') {
      await client.query('ROLLBACK');
      res.status(400).json({
        success: false,
        message: 'เช็คเอาต์ได้เมื่อหัวการจองเป็น approved',
      });
      return;
    }
    if (line.line_status !== 'checked_in') {
      await client.query('ROLLBACK');
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
    await client.query('ROLLBACK');
    console.error('Checkout booking room error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};
