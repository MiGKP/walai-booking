import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthPayload } from '../types';

// สร้างรายการจองห้องพักใหม่ โดยตรวจสอบว่าห้องประเภทที่เลือกมีอยู่จริงและยังมีห้องว่างในช่วงวันที่ต้องการ
export const createRoomBooking = async (req: Request, res: Response): Promise<void> => {
  const client = await pool.connect();
  try {
    const user = req.user as AuthPayload;
    const { room_type_id, check_in_date, check_out_date, guests, special_requests, promotion_id } = req.body;

    await client.query('BEGIN');

    // Verify room type exists
    const roomTypeRes = await client.query('SELECT price FROM room_types WHERE id = $1 AND status = true', [room_type_id]);
    if (roomTypeRes.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ success: false, message: 'Room type not found or unavailable' });
      return;
    }

    // Find an available room and lock it to prevent race condition
    const availableRoom = await client.query(
      `SELECT r.room_id 
       FROM rooms r
       WHERE r.room_type_id = $1 AND r.status != 'maintenance'
       AND r.room_id NOT IN (
         SELECT rb.room_id FROM room_bookings rb
         WHERE rb.status NOT IN ('cancelled', 'rejected')
         AND (rb.check_in < $3 AND rb.check_out > $2)
       ) LIMIT 1
       FOR UPDATE SKIP LOCKED`,
      [room_type_id, check_in_date, check_out_date]
    );

    if (availableRoom.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(409).json({ success: false, message: 'No rooms available for selected dates' });
      return;
    }

    const room_id = availableRoom.rows[0].room_id;

    // Database Trigger `calculate_booking_price` will handle total_price computation
    const result = await client.query(
      `INSERT INTO room_bookings (member_id, room_id, check_in, check_out, guest_count, special_request, promotion_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
      [user.id, room_id, check_in_date, check_out_date, guests, special_requests, promotion_id || null]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Booking created', data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create room booking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
};

// ดึงรายการจองห้องพักทั้งหมดของ member ที่ login อยู่ เพื่อแสดงในหน้าประวัติการจองของผู้ใช้
export const getUserRoomBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const [result, resortRes] = await Promise.all([
      pool.query(
        `SELECT rb.room_booking_id as id, rb.check_in as check_in_date, rb.check_out as check_out_date,
                rb.guest_count as guests, rb.total_price, rb.status, rb.special_request, rb.created_at,
                rt.room_name, rt.type_name as room_type, r.room_number,
                (SELECT json_agg(image_path) FROM room_images ri WHERE ri.room_type_id = rt.id) as room_images
         FROM room_bookings rb
         JOIN rooms r ON rb.room_id = r.room_id
         JOIN room_types rt ON r.room_type_id = rt.id
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

// ดึงรายละเอียดการจองห้องพักรายรายการตาม id โดยอนุญาตให้เจ้าของรายการหรือ admin เข้าถึงได้
export const getRoomBookingById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT rb.room_booking_id as id, rb.check_in as check_in_date, rb.check_out as check_out_date,
              rb.guest_count as guests, rb.total_price, rb.status, rb.special_request, rb.created_at,
              rt.room_name, rt.type_name as room_type, r.room_number, rt.price as price_per_night,
              (SELECT json_agg(image_path) FROM room_images ri WHERE ri.room_type_id = rt.id) as room_images
       FROM room_bookings rb
       JOIN rooms r ON rb.room_id = r.room_id
       JOIN room_types rt ON r.room_type_id = rt.id
       WHERE rb.room_booking_id = $1 AND (rb.member_id = $2 OR $3 = 'admin')`,
      [id, user.id, user.role]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    
    const booking = result.rows[0];
    const roomTypeId = await pool.query(
      'SELECT r.room_type_id FROM rooms r JOIN room_bookings rb ON r.room_id = rb.room_id WHERE rb.room_booking_id = $1',
      [id]
    );
    const amResult = await pool.query(
      `SELECT ra.name FROM room_amenities ra
       JOIN room_type_amenities rta ON ra.amenity_id = rta.amenity_id
       WHERE rta.room_type_id = $1 AND ra.status = true`,
      [roomTypeId.rows[0]?.room_type_id]
    );
    const amenities = amResult.rows.map(r => r.name);
    
    res.json({ success: true, data: { ...booking, amenities } });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ยกเลิกการจองห้องพักของ member เฉพาะรายการที่เป็นของตัวเอง และป้องกันการยกเลิกซ้ำ
export const cancelRoomBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const { id } = req.params;

    const booking = await pool.query(
      'SELECT * FROM room_bookings WHERE room_booking_id = $1 AND member_id = $2',
      [id, user.id]
    );
    if (booking.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    if (booking.rows[0].status === 'cancelled') {
      res.status(400).json({ success: false, message: 'Booking already cancelled' });
      return;
    }

    await pool.query(
      `UPDATE room_bookings SET status = 'cancelled' WHERE room_booking_id = $1`,
      [id]
    );
    res.json({ success: true, message: 'Booking cancelled' });
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรายการจองห้องพักทั้งหมดในระบบสำหรับ admin หรือ room staff เพื่อใช้ตรวจสอบและอนุมัติการจอง
export const getAllRoomBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT rb.room_booking_id, rb.room_booking_id as id,
              rb.check_in, rb.check_out,
              rb.check_in as check_in_date, rb.check_out as check_out_date,
              rb.guest_count as guests, rb.total_price, rb.status,
              rb.payment_status, rb.payment_slip, rb.created_at,
              rt.type_name as room_name, r.room_number,
              m.first_name || ' ' || m.last_name as user_name, m.email as user_email
       FROM room_bookings rb
       JOIN rooms r ON rb.room_id = r.room_id
       JOIN room_types rt ON r.room_type_id = rt.id
       JOIN members m ON rb.member_id = m.member_id
       ORDER BY rb.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get all bookings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// อัปเดตสถานะการจองห้องพัก เช่น approved, rejected หรือ pending จากฝั่งพนักงานหรือผู้ดูแลระบบ
export const updateRoomBookingStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowed = ['approved', 'rejected', 'pending', 'cancelled'];
    if (!allowed.includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status' });
      return;
    }

    const result = await pool.query(
      `UPDATE room_bookings SET status = $1 WHERE room_booking_id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    res.json({ success: true, message: 'Booking status updated', data: result.rows[0] });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

