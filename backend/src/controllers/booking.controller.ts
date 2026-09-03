import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthPayload } from '../types';
import {
  sendBookingConfirmationEmail,
  sendBookingStatusEmail,
} from '../services/mail.service';
import {
  assertGuestsFitCapacity,
  lineSubtotal,
  nightsBetween,
  sumCapacity,
  sumSubtotals,
} from '../services/booking-room.math';

interface BookingItemInput {
  room_type_id: number;
  quantity: number;
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
      };
    });
  }
  return [{ room_type_id: Number(body.room_type_id), quantity: 1 }];
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
): Promise<number> {
  const promoRes = await client.query(
    `SELECT discount_type, discount_value, max_discount, min_nights, min_price, is_active
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
  return Math.max(0, basePrice - discountAmount);
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
    const promotionId =
      body.promotion_id != null ? Number(body.promotion_id) : null;

    const items = normalizeItems(body);
    const { adults, children } = normalizeGuests(body);
    const nights = nightsBetween(checkInDate, checkOutDate);

    for (const item of items) {
      if (
        !Number.isInteger(item.room_type_id) ||
        item.room_type_id < 1 ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1
      ) {
        res.status(400).json({
          success: false,
          message: 'รายการห้องไม่ถูกต้อง',
        });
        return;
      }
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
      assertGuestsFitCapacity(adults, children, sumCapacity(capacityItems));
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

    for (const item of items) {
      const roomType = typeMap.get(item.room_type_id)!;
      for (let i = 0; i < item.quantity; i += 1) {
        const availableRoom = await client.query(
          `SELECT r.room_id, r.room_number
           FROM rooms r
           WHERE r.room_type_id = $1 AND r.status <> 'maintenance'
             AND r.room_id NOT IN (
               SELECT br.room_id
               FROM booking_room br
               JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
               WHERE br.status NOT IN ('cancelled', 'rejected')
                 AND rb.check_in < $3 AND rb.check_out > $2
             )
           LIMIT 1
           FOR UPDATE SKIP LOCKED`,
          [item.room_type_id, checkInDate, checkOutDate]
        );

        if (availableRoom.rows.length === 0) {
          await client.query('ROLLBACK');
          res.status(409).json({
            success: false,
            message: `ห้องประเภท ${roomType.room_name} ว่างไม่พอสำหรับวันที่เลือก`,
          });
          return;
        }

        lockedRooms.push({
          room_id: availableRoom.rows[0].room_id,
          room_type_id: item.room_type_id,
          price_per_night: Number(roomType.price),
          room_name: roomType.room_name,
          room_number: String(availableRoom.rows[0].room_number),
        });
      }
    }

    const subtotals = lockedRooms.map((room) =>
      lineSubtotal(room.price_per_night, nights)
    );
    let totalPrice = sumSubtotals(subtotals);

    if (promotionId) {
      try {
        totalPrice = await applyPromotionDiscount(
          client,
          promotionId,
          totalPrice,
          nights
        );
      } catch (err) {
        await client.query('ROLLBACK');
        res.status(400).json({
          success: false,
          message: err instanceof Error ? err.message : 'โปรโมชั่นไม่ถูกต้อง',
        });
        return;
      }
    }

    const guestTotal = adults + children;
    const headerRes = await client.query(
      `INSERT INTO room_bookings (
         member_id, check_in, check_out, guest_count, adults, children,
         special_request, promotion_id, status, total_price
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', $9)
       RETURNING *`,
      [
        user.id,
        checkInDate,
        checkOutDate,
        guestTotal,
        adults,
        children,
        specialRequests,
        promotionId,
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

    if (promotionId) {
      await client.query(
        'UPDATE promotions SET usage_count = usage_count + 1 WHERE id = $1',
        [promotionId]
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
      data: { ...header, rooms: lineRows },
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
                rb.guest_count as guests, rb.adults, rb.children,
                rb.total_price, rb.status, rb.special_request, rb.created_at,
                ${ROOMS_JSON_SQL} AS rooms,
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
              rb.guest_count as guests, rb.adults, rb.children,
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
    const amResult = await pool.query(
      `SELECT ra.name FROM room_amenities ra
       JOIN room_type_amenities rta ON ra.amenity_id = rta.amenity_id
       WHERE rta.room_type_id = $1 AND ra.status = true`,
      [roomTypeId.rows[0]?.room_type_id]
    );
    const amenities = amResult.rows.map((r: { name: string }) => r.name);

    res.json({ success: true, data: { ...booking, amenities } });
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
              rb.guest_count as guests, rb.adults, rb.children,
              rb.total_price, rb.status,
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
    const { status } = req.body;
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

/** Check-in is not part of the multi-room schema; keep route for compatibility. */
export const checkinRoomBooking = async (
  req: Request,
  res: Response
): Promise<void> => {
  res.status(400).json({
    success: false,
    message:
      'สถานะ checked_in ยังไม่รองรับในระบบ — ใช้สถานะ approved จนถึงเช็คเอาต์ทีละห้อง',
  });
};

/** Legacy: check out every approved line under a header booking. */
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
       WHERE room_booking_id = $1 AND status = 'approved'
       RETURNING room_id`,
      [id]
    );

    for (const line of lines.rows) {
      await client.query(
        `UPDATE rooms SET status = 'available' WHERE room_id = $1 AND status <> 'maintenance'`,
        [line.room_id]
      );
    }

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
        message: 'เช็คเอาต์ได้เมื่อหัวการจองเป็น approved',
      });
      return;
    }
    if (line.line_status !== 'approved') {
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
