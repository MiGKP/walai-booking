import { Request, Response } from 'express';
import pool from '../config/database';

const normalizeAmenityIds = (value: unknown): number[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
};

const normalizeImagePaths = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || '').trim())
    .filter((item) => item.length > 0);
};

// ดึงรายการประเภทห้องพักทั้งหมดที่เปิดใช้งานอยู่ พร้อมรูป, จำนวนห้องว่าง และสิ่งอำนวยความสะดวกสำหรับหน้าแสดงผลฝั่งลูกค้า
// รับ check_in/check_out เพื่อคำนวณ available_count ตามช่วงวันจริง
export const getAllRooms = async (req: Request, res: Response): Promise<void> => {
  try {
    const { min_price, max_price, capacity, check_in, check_out } = req.query;
    
    const params: any[] = [];
    let idx = 1;

    // Build available_count subquery — ถ้าส่ง check_in/check_out มาให้นับเฉพาะห้องที่ไม่ถูกจองช่วงนั้น
    let availableCountSubquery: string;
    if (check_in && check_out) {
      availableCountSubquery = `(
        SELECT COUNT(*) FROM rooms r
        WHERE r.room_type_id = rt.id AND r.status != 'maintenance'
        AND r.room_id NOT IN (
          SELECT rb.room_id FROM room_bookings rb
          WHERE rb.status NOT IN ('cancelled', 'rejected')
          AND rb.check_in < $${idx} AND rb.check_out > $${idx + 1}
        )
      )`;
      params.push(check_out, check_in); // check_out=$idx, check_in=$idx+1
      idx += 2;
    } else {
      availableCountSubquery = `(SELECT COUNT(*) FROM rooms r WHERE r.room_type_id = rt.id AND r.status = 'available')`;
    }

    let query = `
      SELECT rt.id, rt.room_name, rt.type_name, rt.description, 
             rt.price as price_per_night, rt.capacity, rt.room_image as main_image, rt.status,
             (SELECT json_agg(image_path) FROM room_images ri WHERE ri.room_type_id = rt.id) as images,
             ${availableCountSubquery} as available_count,
             (
                SELECT json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.id)
                FROM room_amenities a
                WHERE a.id = ANY(COALESCE(rt.amenity_ids, ARRAY[]::integer[]))
             ) as amenities
      FROM room_types rt 
      WHERE rt.status = true
    `;

    if (min_price) { query += ` AND rt.price >= $${idx++}`; params.push(Number(min_price)); }
    if (max_price) { query += ` AND rt.price <= $${idx++}`; params.push(Number(max_price)); }
    if (capacity) { query += ` AND rt.capacity >= $${idx++}`; params.push(Number(capacity)); }

    query += ' ORDER BY rt.price ASC';
    
    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรายละเอียดของห้องพักตาม room type id เพื่อใช้ในหน้ารายละเอียดห้อง รวมถึงรูปและรายการห้องย่อยที่เกี่ยวข้อง
export const getRoomById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    // Fetch room type details
    const rtResult = await pool.query(`
      SELECT rt.id, rt.room_name, rt.type_name, rt.description, 
             rt.price as price_per_night, rt.capacity, rt.room_image as main_image, rt.status,
             (SELECT json_agg(image_path) FROM room_images ri WHERE ri.room_type_id = rt.id) as images,
             (
               SELECT json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.id)
               FROM room_amenities a
               WHERE a.id = ANY(COALESCE(rt.amenity_ids, ARRAY[]::integer[]))
             ) as amenities,
             (SELECT json_agg(json_build_object('room_id', r.room_id, 'room_number', r.room_number, 'status', r.status)) 
              FROM rooms r WHERE r.room_type_id = rt.id) as rooms
      FROM room_types rt 
      WHERE rt.id = $1 AND rt.status = true
    `, [id]);

    if (rtResult.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Room type not found' });
      return;
    }

    res.json({ success: true, data: rtResult.rows[0] });
  } catch (error) {
    console.error('Get room error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ตรวจสอบว่าห้องประเภทที่เลือกยังมีห้องว่างในช่วงวันที่ต้องการหรือไม่ โดยตัดรายการที่ชนกับ booking เดิมออก
export const checkRoomAvailability = async (req: Request, res: Response): Promise<void> => {
  try {
    const { room_type_id, check_in_date, check_out_date } = req.query;

    if (!room_type_id || !check_in_date || !check_out_date) {
      res.status(400).json({ success: false, message: 'Missing parameters' });
      return;
    }

    // Find a room of this type that is NOT booked during this period
    const availableRoom = await pool.query(
      `SELECT r.room_id, r.room_number 
       FROM rooms r
       WHERE r.room_type_id = $1 AND r.status != 'maintenance'
       AND r.room_id NOT IN (
         SELECT rb.room_id FROM room_bookings rb
         WHERE rb.status NOT IN ('cancelled', 'rejected')
         AND (rb.check_in < $3 AND rb.check_out > $2)
       ) LIMIT 1`,
      [room_type_id, check_in_date, check_out_date]
    );

    res.json({
      success: true,
      data: { 
        available: availableRoom.rows.length > 0,
        available_room: availableRoom.rows[0] || null
      },
    });
  } catch (error) {
    console.error('Check availability error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// สร้างประเภทห้องพักใหม่ในระบบ และบันทึกความสัมพันธ์กับสิ่งอำนวยความสะดวกที่เลือกไว้
export const createRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { type_name, description, capacity, price, room_image, amenities, gallery_images } = req.body;
    const amenityIds = normalizeAmenityIds(amenities);
    const galleryImages = normalizeImagePaths(gallery_images);

    if (!room_image) {
      res.status(400).json({ success: false, message: 'Room cover image is required' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO room_types (room_name, type_name, description, capacity, price, room_image, amenity_ids, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *`,
      [type_name, type_name, description, capacity, price, room_image, amenityIds]
    );

    const roomType = result.rows[0];

    for (const imagePath of galleryImages) {
      await pool.query(
        `INSERT INTO room_images (room_type_id, image_path)
         VALUES ($1, $2)`,
        [roomType.id, imagePath]
      );
    }

    res.status(201).json({ success: true, message: 'Room type created', data: roomType });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// สร้างห้องจริงรายห้องภายใต้ประเภทห้องที่มีอยู่แล้ว เช่น ห้องหมายเลข 101, 102 เพื่อใช้จองจริงในระบบ
export const createSingleRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { room_type_id, room_number } = req.body;
    
    const result = await pool.query(
      `INSERT INTO rooms (room_type_id, room_number, status) VALUES ($1, $2, 'available') RETURNING *`,
      [room_type_id, room_number]
    );
    
    res.status(201).json({ success: true, message: 'Room created', data: result.rows[0] });
  } catch (error) {
    console.error('Create single room error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// สร้างสิ่งอำนวยความสะดวกใหม่ เช่น Wi-Fi, เครื่องปรับอากาศ เพื่อนำไปผูกกับประเภทห้องภายหลัง
export const createRoomAmenity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;

    if (!String(name || '').trim()) {
      res.status(400).json({ success: false, message: 'Amenity name is required' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO room_amenities (name, status) VALUES ($1, true) RETURNING *`,
      [String(name).trim()]
    );
    
    res.status(201).json({ success: true, message: 'Amenity created', data: result.rows[0] });
  } catch (error) {
    console.error('Create amenity error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// อัปเดตข้อมูลประเภทห้องพักเดิม เช่น ชื่อ รายละเอียด ราคา สถานะ และข้อมูลประกอบอื่น ๆ
export const updateRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { room_name, type_name, description, capacity, price, room_image, amenity_ids, amenities, gallery_images, status } = req.body;
    const normalizedAmenityIds = normalizeAmenityIds(amenity_ids ?? amenities);
    const galleryImages = normalizeImagePaths(gallery_images);

    const result = await pool.query(
      `UPDATE room_types SET room_name=$1, type_name=$2, description=$3, capacity=$4, price=$5,
       room_image=$6, amenity_ids=$7, status=$8
       WHERE id=$9 RETURNING *`,
      [room_name, type_name, description, capacity, price, room_image, normalizedAmenityIds, status, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Room type not found' });
      return;
    }

    await pool.query('DELETE FROM room_images WHERE room_type_id = $1', [id]);

    for (const imagePath of galleryImages) {
      await pool.query(
        `INSERT INTO room_images (room_type_id, image_path)
         VALUES ($1, $2)`,
        [id, imagePath]
      );
    }

    res.json({ success: true, message: 'Room type updated', data: result.rows[0] });
  } catch (error) {
    console.error('Update room error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ปิดการใช้งานประเภทห้องแบบ soft delete โดยเปลี่ยน status เป็น false แทนการลบข้อมูลจริงออกจากฐานข้อมูล
export const deleteRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await pool.query('UPDATE room_types SET status = false WHERE id = $1', [id]);
    res.json({ success: true, message: 'Room type deactivated' });
  } catch (error) {
    console.error('Delete room error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรายการสิ่งอำนวยความสะดวกทั้งหมดเพื่อใช้ในหน้า form ฝั่ง admin และหน้าแสดงรายละเอียดห้องพัก
export const getAmenities = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query('SELECT id, name, status FROM room_amenities ORDER BY id ASC');
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get amenities error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// อัปเดตข้อมูลห้องย่อย เช่น หมายเลขห้องหรือสถานะ
export const updateSingleRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { room_number, status } = req.body;
    const result = await pool.query(
      `UPDATE rooms SET room_number = COALESCE($1, room_number), status = COALESCE($2, status)
       WHERE room_id = $3 RETURNING *`,
      [room_number || null, status || null, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }
    res.json({ success: true, message: 'Room updated', data: result.rows[0] });
  } catch (error) {
    console.error('Update single room error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ลบห้องย่อยออกจากระบบ
export const deleteSingleRoom = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingCheck = await pool.query(
      `SELECT COUNT(*) as count FROM room_bookings WHERE room_id = $1 AND status NOT IN ('cancelled', 'rejected')`,
      [id]
    );
    if (Number(bookingCheck.rows[0].count) > 0) {
      res.status(400).json({ success: false, message: 'ไม่สามารถลบได้ เนื่องจากมีการจองที่ยังค้างอยู่' });
      return;
    }
    const result = await pool.query('DELETE FROM rooms WHERE room_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Room not found' });
      return;
    }
    res.json({ success: true, message: 'Room deleted' });
  } catch (error) {
    console.error('Delete single room error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// อัปเดตชื่อสิ่งอำนวยความสะดวก
export const updateAmenity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!String(name || '').trim()) {
      res.status(400).json({ success: false, message: 'Amenity name is required' });
      return;
    }
    const result = await pool.query(
      `UPDATE room_amenities SET name = $1 WHERE id = $2 RETURNING *`,
      [String(name).trim(), id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Amenity not found' });
      return;
    }
    res.json({ success: true, message: 'Amenity updated', data: result.rows[0] });
  } catch (error) {
    console.error('Update amenity error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ลบสิ่งอำนวยความสะดวกออกจากระบบ
export const deleteAmenity = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM room_amenities WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Amenity not found' });
      return;
    }
    res.json({ success: true, message: 'Amenity deleted' });
  } catch (error) {
    console.error('Delete amenity error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงห้องย่อยทั้งหมดในระบบพร้อมชื่อประเภทห้อง เพื่อให้ admin ใช้ตรวจสอบหมายเลขห้องและสถานะการใช้งาน
export const getAllSingleRooms = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT r.room_id, r.room_number, r.status, rt.room_name, rt.type_name 
      FROM rooms r 
      JOIN room_types rt ON r.room_type_id = rt.id 
      ORDER BY r.room_number ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get single rooms error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

