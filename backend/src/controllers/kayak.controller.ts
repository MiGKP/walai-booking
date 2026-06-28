import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthPayload } from '../types';

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

// ดึงรอบเวลาของเรือที่เปิดใช้งานอยู่ เพื่อให้ลูกค้าเลือกช่วงเวลาจองได้ถูกต้อง
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

// สร้างการจองเรือใหม่ โดยตรวจสอบราคารอบจองและความพร้อมของเรือก่อนบันทึกลงฐานข้อมูล
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

    // Get round info to check max_booking and total_slots
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

    // Check availability inside transaction to prevent race condition
    const conflict = await client.query(
      `SELECT COUNT(*) as booked_count, COALESCE(SUM(num_passengers), 0) as total_passengers
       FROM boat_bookings
       WHERE boat_type_id = $1 AND booking_date = $2 AND boat_round_id = $3 AND status NOT IN ('cancelled', 'rejected')`,
      [kayak_id, booking_date, round_id]
    );

    const bookedCount = Number(conflict.rows[0].booked_count);
    const totalPassengers = Number(conflict.rows[0].total_passengers);

    // Check boat quantity limit (per type)
    if (bookedCount >= quantity) {
      await client.query('ROLLBACK');
      res.status(409).json({ success: false, message: 'เรือประเภทนี้เต็มในรอบที่เลือก' });
      return;
    }

    // Check max_booking limit per type (if specified)
    if (max_booking && (totalPassengers + (num_passengers || 1)) > max_booking) {
      await client.query('ROLLBACK');
      res.status(409).json({ success: false, message: `เกินจำนวนที่รับจองสำหรับเรือประเภทนี้ในรอบนี้ (สูงสุด ${max_booking})` });
      return;
    }

    // Check total_slots capacity pool (all boat types combined across same time slot)
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
    res.status(201).json({ success: true, message: 'Boat booking created', data: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create kayak booking error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
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

// ดึงรายการจองเรือทั้งหมดในระบบสำหรับ admin หรือ boat staff เพื่อใช้ตรวจสอบและอนุมัติการจอง
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

// ดึงประเภทเรือทั้งหมด (admin) รวมที่ปิดใช้งานด้วย
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

// ดึงรอบเวลาทั้งหมด (admin) รวมที่ปิดใช้งานด้วย
export const getKayakScheduleAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`SELECT * FROM boat_rounds ORDER BY boat_type_id, start_time`);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get kayak schedule admin error:', error);
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
    const { boat_type_id, start_time, end_time, max_booking, total_slots } = req.body;
    const result = await pool.query(
      `INSERT INTO boat_rounds (boat_type_id, start_time, end_time, max_booking, total_slots, is_active)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [boat_type_id, start_time, end_time, max_booking || null, total_slots || null]
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
    res.json({ success: true, message: 'Booking status updated', data: result.rows[0] });
  } catch (error) {
    console.error('Update kayak booking status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// บันทึกการ check out เรือคายัค — เปลี่ยนสถานะเป็น checked_out
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

// ลบประเภทเรือออกจากระบบ (hard delete)
export const deleteKayak = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Check if there are active bookings
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

// ลบรูปของ boat type
export const deleteBoatImage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageId } = req.params;
    const result = await pool.query(
      `DELETE FROM boat_images WHERE boat_image_id = $1 RETURNING boat_image_id`,
      [imageId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Image not found' });
      return;
    }
    res.json({ success: true, message: 'Image deleted' });
  } catch (error) {
    console.error('Delete boat image error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// อัปเดตรอบเวลาเรือ
export const updateBoatRound = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { boat_type_id, start_time, end_time, max_booking, total_slots, is_active } = req.body;
    
    const result = await pool.query(
      `UPDATE boat_rounds SET boat_type_id=$1, start_time=$2, end_time=$3, max_booking=$4, total_slots=$5, is_active=$6
       WHERE boat_round_id=$7 RETURNING *`,
      [boat_type_id, start_time, end_time, max_booking || null, total_slots || null, is_active, id]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Boat round not found' });
      return;
    }
    
    res.json({ success: true, message: 'Boat round updated', data: result.rows[0] });
  } catch (error) {
    console.error('Update boat round error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ลบรอบเวลาเรือ (hard delete)
export const deleteBoatRound = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Check if there are active bookings
    const bookingCheck = await pool.query(
      `SELECT COUNT(*) as count FROM boat_bookings 
       WHERE boat_round_id = $1 AND status NOT IN ('cancelled', 'rejected')`,
      [id]
    );
    
    if (Number(bookingCheck.rows[0].count) > 0) {
      res.status(400).json({ success: false, message: 'Cannot delete round with active bookings' });
      return;
    }

    const result = await pool.query(
      `DELETE FROM boat_rounds WHERE boat_round_id = $1 RETURNING *`,
      [id]
    );
    
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Boat round not found' });
      return;
    }
    
    res.json({ success: true, message: 'Boat round deleted successfully' });
  } catch (error) {
    console.error('Delete boat round error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

