import { Request, Response } from "express";
import pool from "../config/database";
import { deleteCloudinaryImage } from "../services/cloudinary.service";

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
    .map((item) => String(item || "").trim())
    .filter((item) => item.length > 0);
};

const cleanupRemovedRoomImages = async (urls: string[]): Promise<void> => {
  const results = await Promise.allSettled(
    urls.map((url) => deleteCloudinaryImage(url)),
  );
  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error("Removed room image cleanup error:", result.reason);
    }
  });
};

// ดึงรายการประเภทห้องพักทั้งหมดที่เปิดใช้งานอยู่ พร้อมรูป, จำนวนห้องว่าง และสิ่งอำนวยความสะดวกสำหรับหน้าแสดงผลฝั่งลูกค้า
export const getAllRooms = async (req: Request, res: Response): Promise<void> => {
  try {
    const { min_price, max_price, capacity, check_in, check_out } = req.query;
    const isAdmin = req.query.is_admin === 'true';
    
    // ยึด $1 เป็น isAdmin เสมอ
    const params: any[] = [isAdmin];
    let idx = 2;

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
      params.push(check_out, check_in);
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
      WHERE ($1::boolean IS TRUE OR rt.status = true)
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

// ดึงรายละเอียดของห้องพักตาม room type id
export const getRoomById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const isAdmin = req.query.is_admin === 'true';
    
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
      WHERE rt.id = $1 AND ($2::boolean IS TRUE OR rt.status = true)
    `, [id, isAdmin]);

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

const MAX_CALENDAR_DAYS = 62;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface CalendarDay {
  date: string;
  available_count: number;
  total_rooms: number;
  is_full: boolean;
}

// ดึงสถานะห้องว่างรายคืนสำหรับปฏิทินจอง — ถ้าไม่ส่ง room_type_id จะรวมทุกประเภท
// นับ 1 คืน = ช่วง check_in <= วันนั้น < check_out ให้ตรงกับเงื่อนไขตอนสร้าง booking
export const getRoomCalendar = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { room_type_id, start, end } = req.query;

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

    const roomTypeId =
      room_type_id === undefined || room_type_id === ""
        ? null
        : Number(room_type_id);
    if (roomTypeId !== null && !Number.isInteger(roomTypeId)) {
      res.status(400).json({
        success: false,
        message: "room_type_id ไม่ถูกต้อง",
        code: "INVALID_ROOM_TYPE",
      });
      return;
    }

    const result = await pool.query(
      `WITH days AS (
         SELECT generate_series($2::date, $3::date, interval '1 day')::date AS day
       ),
       stock AS (
         SELECT COUNT(*)::int AS total_rooms
         FROM rooms r
         JOIN room_types rt ON rt.id = r.room_type_id
         WHERE r.status <> 'maintenance'
           AND rt.status = true
           AND ($1::int IS NULL OR r.room_type_id = $1::int)
       )
       SELECT
         to_char(d.day, 'YYYY-MM-DD') AS date,
         s.total_rooms,
         GREATEST(s.total_rooms - COALESCE((
           SELECT COUNT(DISTINCT rb.room_id)
           FROM room_bookings rb
           JOIN rooms r ON r.room_id = rb.room_id
           WHERE rb.status NOT IN ('cancelled', 'rejected')
             AND r.status <> 'maintenance'
             AND ($1::int IS NULL OR r.room_type_id = $1::int)
             AND rb.check_in <= d.day
             AND rb.check_out > d.day
         ), 0), 0)::int AS available_count
       FROM days d
       CROSS JOIN stock s
       ORDER BY d.day`,
      [roomTypeId, start, end],
    );

    const days: CalendarDay[] = result.rows.map((row) => {
      const availableCount = Number(row.available_count);
      return {
        date: String(row.date),
        available_count: availableCount,
        total_rooms: Number(row.total_rooms),
        is_full: availableCount <= 0,
      };
    });

    res.json({
      success: true,
      data: {
        start,
        end,
        room_type_id: roomTypeId,
        total_rooms: days[0]?.total_rooms ?? 0,
        days,
      },
    });
  } catch (error) {
    console.error("Get room calendar error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      code: "SERVER_ERROR",
    });
  }
};

// ตรวจสอบว่าห้องประเภทที่เลือกยังมีห้องว่างในช่วงวันที่ต้องการหรือไม่ โดยตัดรายการที่ชนกับ booking เดิมออก
export const checkRoomAvailability = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { room_type_id, check_in_date, check_out_date } = req.query;

    if (!room_type_id || !check_in_date || !check_out_date) {
      res.status(400).json({ success: false, message: "Missing parameters" });
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
      [room_type_id, check_in_date, check_out_date],
    );

    res.json({
      success: true,
      data: {
        available: availableRoom.rows.length > 0,
        available_room: availableRoom.rows[0] || null,
      },
    });
  } catch (error) {
    console.error("Check availability error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// สร้างประเภทห้องพักใหม่ในระบบ และบันทึกความสัมพันธ์กับสิ่งอำนวยความสะดวกที่เลือกไว้
export const createRoom = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const {
      type_name,
      description,
      capacity,
      price,
      room_image,
      amenities,
      gallery_images,
    } = req.body;
    const amenityIds = normalizeAmenityIds(amenities);
    const galleryImages = normalizeImagePaths(gallery_images);

    if (!room_image) {
      res
        .status(400)
        .json({ success: false, message: "Room cover image is required" });
      return;
    }

    const result = await pool.query(
      `INSERT INTO room_types (room_name, type_name, description, capacity, price, room_image, amenity_ids, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true) RETURNING *`,
      [
        type_name,
        type_name,
        description,
        capacity,
        price,
        room_image,
        amenityIds,
      ],
    );

    const roomType = result.rows[0];

    for (const imagePath of galleryImages) {
      await pool.query(
        `INSERT INTO room_images (room_type_id, image_path)
         VALUES ($1, $2)`,
        [roomType.id, imagePath],
      );
    }

    res
      .status(201)
      .json({ success: true, message: "Room type created", data: roomType });
  } catch (error) {
    console.error("Create room error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// สร้างห้องจริงรายห้องภายใต้ประเภทห้องที่มีอยู่แล้ว เช่น ห้องหมายเลข 101, 102 เพื่อใช้จองจริงในระบบ
export const createSingleRoom = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { room_type_id, room_number } = req.body;

    const result = await pool.query(
      `INSERT INTO rooms (room_type_id, room_number, status) VALUES ($1, $2, 'available') RETURNING *`,
      [room_type_id, room_number],
    );

    res
      .status(201)
      .json({ success: true, message: "Room created", data: result.rows[0] });
  } catch (error) {
    console.error("Create single room error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// สร้างสิ่งอำนวยความสะดวกใหม่
export const createRoomAmenity = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // 1. รับค่า status เพิ่มเติมจาก req.body (กำหนดค่าเริ่มต้นเป็น true หากไม่ได้ส่งมา)
    const { name, status = true } = req.body;

    if (!String(name || "").trim()) {
      res
        .status(400)
        .json({ success: false, message: "Amenity name is required" });
      return;
    }

    // 2. เปลี่ยนตรง VALUES จาก true เป็น $2 เพื่อบันทึกค่าตามที่ส่งมาจากหน้าเว็บ
    const result = await pool.query(
      `INSERT INTO room_amenities (name, status) VALUES ($1, $2) RETURNING *`,
      [String(name).trim(), Boolean(status)],
    );

    res.status(201).json({
      success: true,
      message: "Amenity created",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Create amenity error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// อัปเดตข้อมูลประเภทห้องพักเดิม เช่น ชื่อ รายละเอียด ราคา สถานะ และข้อมูลประกอบอื่น ๆ
export const updateRoom = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      room_name,
      type_name,
      description,
      capacity,
      price,
      room_image,
      amenity_ids,
      amenities,
      gallery_images,
      status,
    } = req.body;
    const normalizedAmenityIds = normalizeAmenityIds(amenity_ids ?? amenities);
    const galleryImages = normalizeImagePaths(gallery_images);

    const currentRoomResult = await pool.query(
      "SELECT room_image FROM room_types WHERE id = $1 LIMIT 1",
      [id],
    );
    if (currentRoomResult.rows.length === 0) {
      res.status(404).json({ success: false, message: "Room type not found" });
      return;
    }
    const currentGalleryResult = await pool.query(
      "SELECT image_path FROM room_images WHERE room_type_id = $1",
      [id],
    );
    const previousImages = [
      String(currentRoomResult.rows[0].room_image || ""),
      ...currentGalleryResult.rows.map(
        (row: { image_path: string }) => row.image_path,
      ),
    ].filter(Boolean);

    const result = await pool.query(
      `UPDATE room_types SET room_name=$1, type_name=$2, description=$3, capacity=$4, price=$5,
       room_image=$6, amenity_ids=$7, status=$8
       WHERE id=$9 RETURNING *`,
      [
        room_name,
        type_name,
        description,
        capacity,
        price,
        room_image,
        normalizedAmenityIds,
        status,
        id,
      ],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: "Room type not found" });
      return;
    }

    await pool.query("DELETE FROM room_images WHERE room_type_id = $1", [id]);

    for (const imagePath of galleryImages) {
      await pool.query(
        `INSERT INTO room_images (room_type_id, image_path)
         VALUES ($1, $2)`,
        [id, imagePath],
      );
    }

    const retainedImages = new Set([
      String(room_image || ""),
      ...galleryImages,
    ]);
    const removedImages = previousImages.filter(
      (imagePath) => !retainedImages.has(imagePath),
    );
    await cleanupRemovedRoomImages(removedImages);

    res.json({
      success: true,
      message: "Room type updated",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update room error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ลบประเภทห้องพัก (สั่งลบรูปภาพออกจาก Cloudinary)
export const deleteRoom = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    const roomResult = await pool.query(
      "SELECT room_image FROM room_types WHERE id = $1 LIMIT 1",
      [id],
    );

    if (roomResult.rows.length === 0) {
      res.status(404).json({ success: false, message: "Room type not found" });
      return;
    }

    const galleryResult = await pool.query(
      "SELECT image_path FROM room_images WHERE room_type_id = $1",
      [id],
    );

    const imagesToDelete = [
      String(roomResult.rows[0].room_image || ""),
      ...galleryResult.rows.map(
        (row: { image_path: string }) => row.image_path,
      ),
    ].filter(Boolean);

    if (imagesToDelete.length > 0) {
      await cleanupRemovedRoomImages(imagesToDelete);
    }

    await pool.query("DELETE FROM room_images WHERE room_type_id = $1", [id]);
    await pool.query("DELETE FROM room_types WHERE id = $1", [id]);
    // ถ้าต้องการใช้ Soft Delete เหมือนเดิม ให้เปิดใช้บรรทัดนี้แทน:
    // await pool.query('UPDATE room_types SET status = false WHERE id = $1', [id]);

    res.json({
      success: true,
      message: "Room type and images deleted successfully",
    });
  } catch (error) {
    console.error("Delete room error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ดึงรายการสิ่งอำนวยความสะดวกทั้งหมดเพื่อใช้ในหน้า form ฝั่ง admin และหน้าแสดงรายละเอียดห้องพัก
export const getAmenities = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await pool.query(
      "SELECT id, name, status FROM room_amenities ORDER BY id ASC",
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get amenities error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// อัปเดตข้อมูลห้องย่อย เช่น หมายเลขห้องหรือสถานะ
export const updateSingleRoom = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { room_number, status } = req.body;
    const result = await pool.query(
      `UPDATE rooms SET room_number = COALESCE($1, room_number), status = COALESCE($2, status)
       WHERE room_id = $3 RETURNING *`,
      [room_number || null, status || null, id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: "Room not found" });
      return;
    }
    res.json({ success: true, message: "Room updated", data: result.rows[0] });
  } catch (error) {
    console.error("Update single room error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ลบห้องย่อยออกจากระบบ
export const deleteSingleRoom = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const bookingCheck = await pool.query(
      `SELECT COUNT(*) as count FROM room_bookings WHERE room_id = $1 AND status NOT IN ('cancelled', 'rejected')`,
      [id],
    );
    if (Number(bookingCheck.rows[0].count) > 0) {
      res.status(400).json({
        success: false,
        message: "ไม่สามารถลบได้ เนื่องจากมีการจองที่ยังค้างอยู่",
      });
      return;
    }
    const result = await pool.query(
      "DELETE FROM rooms WHERE room_id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: "Room not found" });
      return;
    }
    res.json({ success: true, message: "Room deleted" });
  } catch (error) {
    console.error("Delete single room error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// อัปเดตข้อมูลสิ่งอำนวยความสะดวก (ชื่อ และ สถานะ)
export const updateAmenity = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, status } = req.body;

    if (!String(name || "").trim()) {
      res
        .status(400)
        .json({ success: false, message: "Amenity name is required" });
      return;
    }

    // UPDATE ทั้ง name และ status (แปลงค่า status เป็น boolean ก่อนอัปเดต)
    const result = await pool.query(
      `UPDATE room_amenities 
       SET name = $1, status = $2 
       WHERE id = $3 
       RETURNING *`,
      [String(name).trim(), Boolean(status), Number(id)]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ success: false, message: "Amenity not found" });
      return;
    }

    res.json({
      success: true,
      message: "Amenity updated successfully",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update amenity error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ลบสิ่งอำนวยความสะดวกออกจากระบบ
export const deleteAmenity = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;

    // 1. เคลียร์ ID นี้ออกจาก amenity_ids ใน room_types ก่อน
    await pool.query(
      `UPDATE room_types SET amenity_ids = array_remove(amenity_ids, $1::integer)`,
      [id]
    );

    // 2. ลบรายการออกจากตาราง room_amenities
    const result = await pool.query(
      "DELETE FROM room_amenities WHERE id = $1 RETURNING *",
      [id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: "Amenity not found" });
      return;
    }

    res.json({ success: true, message: "Amenity deleted" });
  } catch (error) {
    console.error("Delete amenity error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ดึงห้องย่อยทั้งหมดในระบบพร้อมชื่อประเภทห้อง เพื่อให้ admin ใช้ตรวจสอบหมายเลขห้องและสถานะการใช้งาน
export const getAllSingleRooms = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT r.room_id, r.room_number, r.status, rt.room_name, rt.type_name 
      FROM rooms r 
      JOIN room_types rt ON r.room_type_id = rt.id 
      ORDER BY r.room_number ASC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get single rooms error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// 📌 อัปเดตสถานะ เปิด/ปิด การใช้งานประเภทห้องพัก (Toggle Status)
export const toggleRoomTypeStatus = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // ตรวจสอบค่า status ที่ส่งมา
    if (typeof status !== "boolean") {
      res.status(400).json({
        success: false,
        message: "กรุณาระบุค่า status เป็น boolean (true/false)",
      });
      return;
    }

    // UPDATE ข้อมูลตาราง room_types (ประเภทห้องพัก)
    const query = `
      UPDATE room_types 
      SET status = $1
      WHERE id = $2 
      RETURNING *;
    `;
    const result = await pool.query(query, [status, Number(id)]);

    // กรณีไม่พบประเภทห้องตาม ID ที่ระบุ
    if (result.rowCount === 0) {
      res.status(404).json({
        success: false,
        message: "ไม่พบข้อมูลประเภทห้องพักที่ต้องการอัปเดต",
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "อัปเดตสถานะประเภทห้องพักสำเร็จ",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Toggle room type status error:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการอัปเดตสถานะ",
    });
  }
};

// 📌 อัปเดตสถานะ เปิด/ปิด การใช้งานสิ่งอำนวยความสะดวก (Toggle Amenity Status)
export const toggleAmenityStatus = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // ตรวจสอบค่า status ที่ส่งมา
    if (typeof status !== "boolean") {
      res.status(400).json({
        success: false,
        message: "กรุณาระบุค่า status เป็น boolean (true/false)",
      });
      return;
    }

    // UPDATE ข้อมูลตาราง room_amenities สำหรับ PostgreSQL
    const result = await pool.query(
      `UPDATE room_amenities SET status = $1 WHERE id = $2 RETURNING *`,
      [status, Number(id)]
    );

    if (result.rowCount === 0) {
      res.status(404).json({
        success: false,
        message: "ไม่พบข้อมูลสิ่งอำนวยความสะดวกที่ต้องการอัปเดต",
      });
      return;
    }

    res.json({
      success: true,
      message: "อัปเดตสถานะสิ่งอำนวยความสะดวกสำเร็จ",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Toggle amenity status error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// สร้างห้องพักย่อยครั้งละหลายห้องแบบ Auto-generate หมายเลขห้อง (Batch Insert)
export const createBatchSingleRooms = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const client = await pool.connect();
  try {
    const { room_type_id, prefix = "A", quantity, start_number = 1 } = req.body;

    const parsedRoomTypeId = Number(room_type_id);
    const parsedQuantity = Number(quantity);
    const parsedStartNumber = Number(start_number);

    if (!parsedRoomTypeId || !parsedQuantity || parsedQuantity <= 0) {
      res.status(400).json({
        success: false,
        message: "กรุณาระบุประเภทห้องพักและจำนวนห้องที่ถูกต้อง",
      });
      return;
    }

    const cleanPrefix = String(prefix).trim().toUpperCase();

    // 1. ตรวจสอบว่าประเภทห้องพักมีอยู่จริงไหม (ลองเช็กทั้ง id และ room_type_id เพื่อป้องกัน Column name Error)
    const typeCheck = await client.query(
      `SELECT * FROM room_types WHERE id = $1 OR room_type_id = $1`,
      [parsedRoomTypeId]
    ).catch(async () => {
      // Fallback กรณีตารางใช้ชื่อ id อย่างเดียว
      return await client.query(`SELECT id FROM room_types WHERE id = $1`, [parsedRoomTypeId]);
    });

    if (typeCheck.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: "ไม่พบประเภทห้องพักที่ระบุในระบบ",
      });
      return;
    }

    // 2. สร้าง Array หมายเลขห้องพัก
    const roomNumbersToInsert: string[] = [];
    for (let i = 0; i < parsedQuantity; i++) {
      const currentNum = parsedStartNumber + i;
      const formattedNum = String(currentNum); 
      const roomNumber = `${cleanPrefix}${formattedNum}`;
      roomNumbersToInsert.push(roomNumber);
    }

    // 3. ตรวจสอบหมายเลขห้องซ้ำในตาราง rooms
    const existingCheck = await client.query(
      `SELECT room_number FROM rooms WHERE room_number = ANY($1::text[])`,
      [roomNumbersToInsert]
    );

    if (existingCheck.rows.length > 0) {
      const duplicateRooms = existingCheck.rows.map((r: any) => r.room_number).join(", ");
      res.status(400).json({
        success: false,
        message: `ไม่สามารถสร้างได้ เนื่องจากมีหมายเลขห้องซ้ำในระบบ: ${duplicateRooms}`,
      });
      return;
    }

    // 4. บันทึกลงตาราง rooms
    await client.query("BEGIN");

    const insertedRooms = [];
    for (const roomNumber of roomNumbersToInsert) {
      const result = await client.query(
        `INSERT INTO rooms (room_type_id, room_number, status) 
         VALUES ($1, $2, 'available') 
         RETURNING *`,
        [parsedRoomTypeId, roomNumber],
      );
      insertedRooms.push(result.rows[0]);
    }

    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: `เพิ่มห้องพักจำนวน ${insertedRooms.length} ห้องสำเร็จ`,
      data: insertedRooms,
    });
  } catch (error: any) {
    await client.query("ROLLBACK");
    console.error("Create batch single rooms error details:", error);

    if (error.code === "23505") {
      res.status(400).json({
        success: false,
        message: "ไม่สามารถสร้างได้ เนื่องจากมีหมายเลขห้องซ้ำในระบบ",
      });
      return;
    }

    if (error.code === "23503") {
      res.status(400).json({
        success: false,
        message: "ประเภทห้องพักไม่ถูกต้อง (Foreign Key Error)",
      });
      return;
    }

    res.status(500).json({ 
      success: false, 
      message: error.message || "Internal server error" 
    });
  } finally {
    client.release();
  }
};

// ดึงข้อมูล Prefix และ เลขห้องถัดไปอัตโนมัติ ตามประเภทห้อง
export const getNextRoomNumber = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { room_type_id } = req.query;

    if (!room_type_id) {
      res.status(400).json({ success: false, message: "กรุณาระบุประเภทห้องพัก" });
      return;
    }

    // ค้นหาห้องล่าสุดของ room_type_id นี้
    const result = await pool.query(
      `SELECT room_number FROM rooms 
       WHERE room_type_id = $1 
       ORDER BY room_id DESC LIMIT 1`,
      [room_type_id]
    );

    if (result.rows.length === 0) {
      // ถ้ายังไม่มีห้องในประเภทนี้เลย ให้เริ่มที่ Zone A ลำดับที่ 1
      res.status(200).json({
        success: true,
        data: { prefix: "A", next_number: 1 },
      });
      return;
    }

    const lastRoomNumber = result.rows[0].room_number; // เช่น "A105"

    // แยก Prefix (ตัวอักษร) และ Number (ตัวเลข) ด้วย Regex
    const match = lastRoomNumber.match(/^([A-Za-z]+)(\d+)$/);

    if (match) {
      const prefix = match[1]; // ได้ "A"
      const nextNumber = parseInt(match[2], 10) + 1; // 105 + 1 = 106

      res.status(200).json({
        success: true,
        data: { prefix, next_number: nextNumber },
      });
    } else {
      // กรณี Format เลขห้องเดิมไม่ตรงรูปแบบ ให้ Default ไว้ที่ Zone A เริ่มที่ 1
      res.status(200).json({
        success: true,
        data: { prefix: "A", next_number: 1 },
      });
    }
  } catch (error: any) {
    console.error("Get next room number error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};