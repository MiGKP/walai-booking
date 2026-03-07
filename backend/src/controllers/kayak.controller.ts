import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthPayload } from '../types';

// ดึงรายการประเภทเรือทั้งหมดที่เปิดใช้งานอยู่ พร้อมข้อมูลที่ frontend ใช้แสดง เช่น ความจุ ราคา และรูปหลัก
export const getAllKayaks = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT bt.boat_type_id as id, bt.type_name as name, bt.description, 
             bt.seat_count as capacity, bt.price as price_per_hour, bt.quantity,
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

// ดึงรายละเอียดของเรือรายประเภทตาม id เพื่อใช้ในหน้ารายละเอียดก่อนตัดสินใจจอง
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

    const conflict = await pool.query(
      `SELECT COUNT(*) as booked_count 
       FROM boat_bookings
       WHERE boat_type_id = $1
       AND booking_date = $2
       AND boat_round_id = $3
       AND status NOT IN ('cancelled', 'rejected')`,
      [kayak_id, booking_date, boat_round_id]
    );
    
    const max_qty = await pool.query(`SELECT quantity FROM boat_types WHERE boat_type_id = $1`, [kayak_id]);
    const max = max_qty.rows[0]?.quantity || 0;

    res.json({ success: true, data: { available: Number(conflict.rows[0].booked_count) < max } });
  } catch (error) {
    console.error('Check kayak availability error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรอบเวลาของเรือที่เปิดใช้งานอยู่ เพื่อให้ลูกค้าเลือกช่วงเวลาจองได้ถูกต้อง
export const getKayakSchedule = async (req: Request, res: Response): Promise<void> => {
  try {
    // Return available rounds for a boat type
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

// สร้างการจองเรือใหม่ โดยตรวจสอบราคารอบจองและความพร้อมของเรือก่อนบันทึกลงฐานข้อมูล
export const createKayakBooking = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const { kayak_id, booking_date, boat_round_id, num_passengers } = req.body;

    // We need to fetch the start_time and end_time to match old API if round_id is not provided
    // For now, if frontend still uses start_time and end_time, we might need to find a matching round
    let round_id = boat_round_id;
    let price_per_hour = 0;
    
    const btResult = await pool.query('SELECT price FROM boat_types WHERE boat_type_id = $1', [kayak_id]);
    if (btResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Boat type not found' });
      return;
    }
    price_per_hour = btResult.rows[0].price;

    // Check availability
    const conflict = await pool.query(
      `SELECT COUNT(*) as booked_count 
       FROM boat_bookings
       WHERE boat_type_id = $1 AND booking_date = $2 AND boat_round_id = $3 AND status NOT IN ('cancelled', 'rejected')`,
      [kayak_id, booking_date, round_id]
    );
    
    const typeRes = await pool.query('SELECT quantity FROM boat_types WHERE boat_type_id = $1', [kayak_id]);
    if (Number(conflict.rows[0].booked_count) >= typeRes.rows[0].quantity) {
      res.status(409).json({ success: false, message: 'Boat is fully booked for this round' });
      return;
    }

    const total_price = price_per_hour; // assuming price is per round/hour

    const result = await pool.query(
      `INSERT INTO boat_bookings (member_id, boat_type_id, boat_round_id, booking_date, num_passengers, total_price, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [user.id, kayak_id, round_id, booking_date, num_passengers || 1, total_price]
    );

    res.status(201).json({ success: true, message: 'Boat booking created', data: result.rows[0] });
  } catch (error) {
    console.error('Create kayak booking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรายการจองเรือทั้งหมดของ member ที่ login อยู่ พร้อมชื่อเรือ รูป และรอบเวลาที่จอง
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

// ยกเลิกการจองเรือของผู้ใช้เฉพาะรายการที่เป็นเจ้าของ และป้องกันการยกเลิกซ้ำ
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
    if (booking.rows[0].status === 'cancelled') {
      res.status(400).json({ success: false, message: 'Booking already cancelled' });
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

// ดึงรายการจองเรือทั้งหมดในระบบสำหรับ admin หรือ boat staff เพื่อใช้ตรวจสอบและอนุมัติการจอง
export const getAllKayakBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT bb.*, bt.type_name as kayak_name,
              m.first_name || ' ' || m.last_name as user_name, m.email as user_email,
              br.start_time, br.end_time
       FROM boat_bookings bb
       JOIN boat_types bt ON bb.boat_type_id = bt.boat_type_id
       JOIN members m ON bb.member_id = m.member_id
       LEFT JOIN boat_rounds br ON bb.boat_round_id = br.boat_round_id
       ORDER BY bb.created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get all kayak bookings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// สร้างประเภทเรือใหม่ในระบบ เช่น เรือ 1 ที่นั่ง หรือ 2 ที่นั่ง พร้อมจำนวนและราคา
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

// สร้างรอบเวลาใหม่ของเรือแต่ละประเภท เช่น 09:00-10:00 เพื่อใช้กับระบบจองเรือ
export const createBoatRound = async (req: Request, res: Response): Promise<void> => {
  try {
    const { boat_type_id, start_time, end_time } = req.body;
    const result = await pool.query(
      `INSERT INTO boat_rounds (boat_type_id, start_time, end_time, is_active)
       VALUES ($1, $2, $3, true) RETURNING *`,
      [boat_type_id, start_time, end_time]
    );
    res.status(201).json({ success: true, message: 'Boat round created', data: result.rows[0] });
  } catch (error) {
    console.error('Create boat round error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// อัปเดตสถานะการจองเรือจากฝั่งพนักงานหรือผู้ดูแล เช่น approved, rejected หรือ pending
export const updateKayakBookingStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const authUser = req.user as AuthPayload;

    const allowed = ['approved', 'rejected', 'pending'];
    if (!allowed.includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status' });
      return;
    }

    const result = await pool.query(
      `UPDATE boat_bookings SET status = $1, updated_at = NOW() WHERE boat_booking_id = $2 RETURNING *`,
      [status, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }
    res.json({ success: true, message: 'Booking status updated', data: result.rows[0] });
  } catch (error) {
    console.error('Update kayak booking status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// อัปเดตข้อมูลประเภทเรือเดิม เช่น ชื่อ รายละเอียด จำนวน ราคา และสถานะการเปิดใช้งาน
export const updateKayak = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, description, capacity, price_per_hour, quantity, is_active } = req.body;
    const result = await pool.query(
      `UPDATE boat_types SET type_name=$1, description=$2, seat_count=$3,
       price=$4, quantity=$5, is_active=$6
       WHERE boat_type_id=$7 RETURNING *`,
      [name, description, capacity, price_per_hour, quantity, is_active, id]
    );
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

