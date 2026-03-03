import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthPayload } from '../types';

export const createRoomBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const { room_type_id, check_in_date, check_out_date, guests, special_requests, promotion_id } = req.body;

    // Verify room type exists
    const roomTypeRes = await pool.query('SELECT price FROM room_types WHERE id = $1 AND status = true', [room_type_id]);
    if (roomTypeRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Room type not found or unavailable' });
      return;
    }

    // Find an available room of this type
    const availableRoom = await pool.query(
      `SELECT r.room_id 
       FROM rooms r
       WHERE r.room_type_id = $1 AND r.status != 'maintenance'
       AND r.room_id NOT IN (
         SELECT rb.room_id FROM room_bookings rb
         WHERE rb.status NOT IN ('cancelled', 'rejected')
         AND (rb.check_in < $3 AND rb.check_out > $2)
       ) LIMIT 1`,
      [room_type_id, check_in_date, check_out_date]
    );

    if (availableRoom.rows.length === 0) {
      res.status(409).json({ success: false, message: 'No rooms available for selected dates' });
      return;
    }

    const room_id = availableRoom.rows[0].room_id;

    // Database Trigger `calculate_booking_price` will handle total_price computation
    const result = await pool.query(
      `INSERT INTO room_bookings (member_id, room_id, check_in, check_out, guest_count, special_request, promotion_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
      [user.id, room_id, check_in_date, check_out_date, guests, special_requests, promotion_id || null]
    );

    res.status(201).json({ success: true, message: 'Booking created', data: result.rows[0] });
  } catch (error) {
    console.error('Create room booking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getUserRoomBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const result = await pool.query(
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
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get user bookings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

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
    
    // Mock amenities temporarily
    const amResult = await pool.query('SELECT name FROM room_amenities WHERE status = true');
    const amenities = amResult.rows.map(r => r.name);
    
    res.json({ success: true, data: { ...result.rows[0], amenities } });
  } catch (error) {
    console.error('Get booking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

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

export const getAllRoomBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT rb.room_booking_id as id, rb.check_in as check_in_date, rb.check_out as check_out_date,
              rb.guest_count as guests, rb.total_price, rb.status, rb.created_at,
              rt.room_name, m.first_name || ' ' || m.last_name as user_name, m.email as user_email
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

export const updateRoomBookingStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

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

