import { Request, Response } from "express";
import { safeRollback } from '../utils/safe-rollback';
import pool from "../config/database";
import { deleteCloudinaryImage } from "../services/cloudinary.service";
import { AuthRequest } from "../middleware/auth.middleware";
import type { PoolClient } from "pg";
import { mapDbError } from "../utils/db-errors";
import { parsePositiveInt } from "../utils/ids";

// is_admin=true จะแสดงห้อง/ประเภทห้องที่ปิดใช้งานได้ เฉพาะเมื่อผู้เรียกมี JWT ของ staff ที่มีสิทธิ์เท่านั้น
const canViewInactiveRooms = (req: Request): boolean => {
  const role = (req as AuthRequest).user?.role;
  return role === "admin" || role === "room_staff";
};

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

// ตอบ error กลับตามรหัส PostgreSQL ถ้าเป็นความผิดพลาดจากข้อมูลผู้ใช้ มิฉะนั้นตอบ 500 แบบไม่เปิดเผยรายละเอียด
const respondWithDbError = (res: Response, error: unknown, label: string): void => {
  const mapped = mapDbError(error);
  if (mapped) {
    res.status(mapped.status).json({ success: false, message: mapped.message });
    return;
  }
  console.error(label, error);
  res.status(500).json({ success: false, message: "Internal server error" });
};

// ยกเลิก transaction ที่ค้างอยู่ โดยไม่ให้ error ของ ROLLBACK บดบัง error เดิม
const rollbackQuietly = async (client: PoolClient): Promise<void> => {
  try {
    await safeRollback(client);
  } catch (rollbackError) {
    console.error("Rollback error:", rollbackError);
  }
};

// หมายเลขห้องที่ซ้ำกันเองภายในคำขอเดียวกัน
const findDuplicateNumbers = (roomNumbers: string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const roomNumber of roomNumbers) {
    if (seen.has(roomNumber)) duplicates.add(roomNumber);
    seen.add(roomNumber);
  }
  return Array.from(duplicates);
};

// ตรวจว่าค่าที่ส่งมาเป็นตัวเลขที่ใช้ได้ (ไม่ว่างและไม่ใช่ NaN)
const isNumberInput = (value: unknown): boolean => {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim() !== "" && Number.isFinite(Number(value));
  return false;
};

interface RoomTypeRow {
  id: number;
  room_name: string | null;
  type_name: string | null;
  description: string | null;
  capacity: number | null;
  price: string | number | null;
  room_image: string | null;
  amenity_ids: number[] | null;
  status: boolean;
}

// ดึงรายการประเภทห้องพักทั้งหมดที่เปิดใช้งานอยู่ พร้อมรูป, จำนวนห้องว่าง และสิ่งอำนวยความสะดวกสำหรับหน้าแสดงผลฝั่งลูกค้า
export const getAllRooms = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { min_price, max_price, capacity, check_in, check_out } = req.query;
    const isAdmin = req.query.is_admin === "true" && canViewInactiveRooms(req);

    // ยึด $1 เป็น isAdmin เสมอ
    const params: any[] = [isAdmin];
    let idx = 2;

    let availableCountSubquery: string;
    if (check_in && check_out) {
      availableCountSubquery = `(
        SELECT COUNT(*) FROM rooms r
        WHERE r.room_type_id = rt.id AND r.status != 'maintenance'
        AND r.room_id NOT IN (
          SELECT br.room_id
          FROM booking_room br
          JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
          WHERE br.status NOT IN ('cancelled', 'rejected', 'checked_out')
          AND rb.check_in < $${idx} AND rb.check_out > $${idx + 1}
        )
      )`;
      params.push(check_out, check_in);
      idx += 2;
    } else {
      availableCountSubquery = `(SELECT COUNT(*) FROM rooms r WHERE r.room_type_id = rt.id AND r.status = 'available')`;
    }

    // ในไฟล์ Backend Controller (getAllRooms)
    let query = `
  SELECT rt.id, rt.room_name, rt.type_name, rt.description, 
         rt.price as price_per_night, rt.capacity, rt.room_image as main_image, rt.status,
         (SELECT json_agg(image_path) FROM room_images ri WHERE ri.room_type_id = rt.id) as images,
         (SELECT COUNT(*) FROM rooms r WHERE r.room_type_id = rt.id) as room_count,
         ${availableCountSubquery} as available_count,
         (
           SELECT json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.id)
           FROM room_amenities a
           WHERE a.id = ANY(COALESCE(rt.amenity_ids, ARRAY[]::integer[]))
         ) as amenities,
         (
           -- "ยอดจองวันนี้" = จำนวนครั้งที่ลูกค้ากดชำระเงินสำเร็จ (ส่งสลิป) ในช่วง 24 ชม.ที่ผ่านมา
           -- นับเป็น "ครั้ง" ตามจำนวนบิล (room_booking_id) ไม่ใช่จำนวนห้อง — จองหลายห้องในบิลเดียวกันนับ 1 ครั้ง
           SELECT COUNT(DISTINCT rb.room_booking_id)::int
           FROM booking_room br
           JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
           JOIN rooms r ON r.room_id = br.room_id
           WHERE r.room_type_id = rt.id
             AND rb.payment_submitted_at IS NOT NULL
             AND rb.payment_submitted_at >= NOW() - INTERVAL '24 hours'
             AND rb.status NOT IN ('rejected', 'cancelled')
         ) as today_bookings,
         (
           SELECT COALESCE(AVG(rating), 0)::numeric(3,1)
           FROM reviews rev
           WHERE rev.room_type_id = rt.id
         ) as avg_rating,
         (
           SELECT COUNT(*)::int
           FROM reviews rev
           WHERE rev.room_type_id = rt.id
         ) as review_count,
         (
           SELECT json_agg(json_build_object('id', p.id, 'name', p.name, 'code', p.code, 'description', p.description, 'discount_value', p.discount_value, 'discount_type', p.discount_type, 'min_nights', p.min_nights, 'max_discount', p.max_discount, 'boat_ticket_count', p.boat_ticket_count, 'boat_addon_mode', p.boat_addon_mode, 'boat_addon_price', p.boat_addon_price, 'stackable', p.stackable, 'min_price', p.min_price, 'room_type_id', p.room_type_id, 'room_count', p.room_count, 'is_collectible', p.is_collectible, 'applies_to', p.applies_to))
           FROM promotions p
           WHERE p.is_active = true
             AND (p.start_date IS NULL OR p.start_date <= (now() AT TIME ZONE 'Asia/Bangkok')::date)
             AND (p.end_date IS NULL OR p.end_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date)
             AND (p.room_type_id = rt.id OR p.room_type_id IS NULL)
                 AND (p.usage_limit IS NULL OR p.usage_count < p.usage_limit)
                 AND COALESCE(p.applies_to, 'both') IN ('room', 'both')
         ) as available_promotions,
         (
           SELECT json_agg(json_build_object('room_id', r.room_id, 'room_number', r.room_number))
           FROM rooms r
           WHERE r.room_type_id = rt.id AND r.status != 'maintenance'
           ${
             check_in && check_out
               ? `AND r.room_id NOT IN (
                    SELECT br.room_id
                    FROM booking_room br
                    JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
                    WHERE br.status NOT IN ('cancelled', 'rejected', 'checked_out')
                    AND rb.check_in < $2 AND rb.check_out > $3
                  )`
               : ""
           }
         ) as rooms
  FROM room_types rt
  WHERE ($1::boolean IS TRUE OR rt.status = true)
`;

    if (min_price) {
      query += ` AND rt.price >= $${idx++}`;
      params.push(Number(min_price));
    }
    if (max_price) {
      query += ` AND rt.price <= $${idx++}`;
      params.push(Number(max_price));
    }
    if (capacity) {
      query += ` AND rt.capacity >= $${idx++}`;
      params.push(Number(capacity));
    }

    query += " ORDER BY rt.price ASC";

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get rooms error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ดึงรายละเอียดของห้องพักตาม room type id
export const getRoomById = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const roomTypeId = parsePositiveInt(req.params.id);
    if (roomTypeId === null) {
      res.status(400).json({ success: false, message: "Invalid id" });
      return;
    }
    const { check_in, check_out } = req.query;
    const isAdmin = req.query.is_admin === "true" && canViewInactiveRooms(req);

    let roomsSubquery: string;
    const params: any[] = [roomTypeId, isAdmin];

    if (check_in && check_out) {
      roomsSubquery = `
        SELECT json_agg(json_build_object(
          'room_id', r.room_id, 
          'room_number', r.room_number, 
          'status', r.status,
          'is_available', (
            r.status != 'maintenance' AND r.room_id NOT IN (
              SELECT br.room_id
              FROM booking_room br
              JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
              WHERE br.status NOT IN ('cancelled', 'rejected', 'checked_out')
              AND (rb.check_in < $4 AND rb.check_out > $3)
            )
          )
        )) 
        FROM rooms r WHERE r.room_type_id = rt.id
      `;
      params.push(check_in, check_out);
    } else {
      roomsSubquery = `
        SELECT json_agg(json_build_object('room_id', r.room_id, 'room_number', r.room_number, 'status', r.status, 'is_available', true)) 
        FROM rooms r WHERE r.room_type_id = rt.id
      `;
    }

    const rtResult = await pool.query(
      `
      SELECT rt.id, rt.room_name, rt.type_name, rt.description,
             rt.price as price_per_night, rt.capacity, rt.room_image as main_image, rt.status,
             (SELECT json_agg(image_path) FROM room_images ri WHERE ri.room_type_id = rt.id) as images,
             (
               SELECT json_agg(json_build_object('id', a.id, 'name', a.name) ORDER BY a.id)
               FROM room_amenities a
               WHERE a.id = ANY(COALESCE(rt.amenity_ids, ARRAY[]::integer[]))
             ) as amenities,
             (${roomsSubquery}) as rooms,
             (
               SELECT json_agg(json_build_object('id', p.id, 'name', p.name, 'code', p.code, 'description', p.description, 'discount_value', p.discount_value, 'discount_type', p.discount_type, 'min_nights', p.min_nights, 'max_discount', p.max_discount, 'boat_ticket_count', p.boat_ticket_count, 'boat_addon_mode', p.boat_addon_mode, 'boat_addon_price', p.boat_addon_price, 'stackable', p.stackable, 'min_price', p.min_price, 'room_type_id', p.room_type_id, 'room_count', p.room_count, 'is_collectible', p.is_collectible, 'applies_to', p.applies_to))
               FROM promotions p
               WHERE p.is_active = true
                 AND (p.start_date IS NULL OR p.start_date <= (now() AT TIME ZONE 'Asia/Bangkok')::date)
                 AND (p.end_date IS NULL OR p.end_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date)
                 AND (p.room_type_id = rt.id OR p.room_type_id IS NULL)
                 AND (p.usage_limit IS NULL OR p.usage_count < p.usage_limit)
                 AND COALESCE(p.applies_to, 'both') IN ('room', 'both')
             ) as available_promotions
      FROM room_types rt
      WHERE rt.id = $1 AND ($2::boolean IS TRUE OR rt.status = true)
    `,
      params,
    );

    if (rtResult.rows.length === 0) {
      res.status(404).json({ success: false, message: "Room type not found" });
      return;
    }

    res.json({ success: true, data: rtResult.rows[0] });
  } catch (error) {
    console.error("Get room error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
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
           SELECT COUNT(DISTINCT br.room_id)
           FROM booking_room br
           JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
           JOIN rooms r ON r.room_id = br.room_id
           WHERE br.status NOT IN ('cancelled', 'rejected', 'checked_out')
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
         SELECT br.room_id
         FROM booking_room br
         JOIN room_bookings rb ON rb.room_booking_id = br.room_booking_id
         WHERE br.status NOT IN ('cancelled', 'rejected', 'checked_out')
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
  let client: PoolClient | null = null;
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

    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query(
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
      await client.query(
        `INSERT INTO room_images (room_type_id, image_path)
         VALUES ($1, $2)`,
        [roomType.id, imagePath],
      );
    }
    await client.query("COMMIT");

    res
      .status(201)
      .json({ success: true, message: "Room type created", data: roomType });
  } catch (error) {
    if (client) await rollbackQuietly(client);
    respondWithDbError(res, error, "Create room error:");
  } finally {
    client?.release();
  }
};

// สร้างห้องจริงรายห้องภายใต้ประเภทห้องที่มีอยู่แล้ว เช่น ห้องหมายเลข 101, 102 เพื่อใช้จองจริงในระบบ
export const createSingleRoom = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { room_type_id, room_number } = req.body;

    if (!String(room_number ?? "").trim()) {
      res.status(400).json({ success: false, message: "กรุณาระบุหมายเลขห้อง" });
      return;
    }

    // คำสั่ง INSERT เดียวเป็น atomic อยู่แล้ว จึงไม่ต้องครอบด้วย transaction
    const result = await pool.query(
      `INSERT INTO rooms (room_type_id, room_number, status) VALUES ($1, $2, 'available') RETURNING *`,
      [room_type_id, room_number],
    );

    res
      .status(201)
      .json({ success: true, message: "Room created", data: result.rows[0] });
  } catch (error) {
    respondWithDbError(res, error, "Create single room error:");
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

// อัปเดตข้อมูลประเภทห้องพักเดิม แก้เฉพาะฟิลด์ที่ส่งมา ฟิลด์ที่ไม่ได้ส่งจะคงค่าเดิมไว้ (ส่ง null เพื่อล้างค่าได้เฉพาะฟิลด์ข้อความบางตัว)
export const updateRoom = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const roomTypeId = parsePositiveInt(req.params.id);
  if (roomTypeId === null) {
    res.status(400).json({ success: false, message: "Invalid id" });
    return;
  }

  let client: PoolClient | null = null;
  try {
    const body = req.body as Record<string, unknown>;
    const has = (key: string): boolean =>
      Object.prototype.hasOwnProperty.call(body, key);
    const textOrNull = (key: string): string | null => {
      const raw = body[key];
      return raw === null || raw === undefined || raw === ""
        ? null
        : String(raw);
    };

    if (
      (has("capacity") && !isNumberInput(body.capacity)) ||
      (has("price") && !isNumberInput(body.price))
    ) {
      res
        .status(400)
        .json({ success: false, message: "ราคาและความจุต้องเป็นตัวเลข" });
      return;
    }

    client = await pool.connect();
    await client.query("BEGIN");

    const currentResult = await client.query<RoomTypeRow>(
      "SELECT * FROM room_types WHERE id = $1 FOR UPDATE",
      [roomTypeId],
    );
    if (currentResult.rows.length === 0) {
      await rollbackQuietly(client);
      res.status(404).json({ success: false, message: "Room type not found" });
      return;
    }
    const current = currentResult.rows[0];

    const currentGalleryResult = await client.query<{ image_path: string }>(
      "SELECT image_path FROM room_images WHERE room_type_id = $1",
      [roomTypeId],
    );
    const previousGallery = currentGalleryResult.rows.map(
      (row) => row.image_path,
    );

    // gallery_images ไม่ได้ส่งมา = คงรูปเดิมไว้ ส่งมาแล้ว = แทนที่ทั้งชุด
    const replaceGallery = has("gallery_images");
    const galleryImages = replaceGallery
      ? normalizeImagePaths(body.gallery_images)
      : previousGallery;

    const requestedAmenities = body.amenity_ids ?? body.amenities;
    const amenityIds =
      requestedAmenities === undefined
        ? normalizeAmenityIds(current.amenity_ids)
        : normalizeAmenityIds(requestedAmenities);

    const roomName = textOrNull("room_name") ?? current.room_name;
    const typeName = textOrNull("type_name") ?? current.type_name;
    const description = has("description")
      ? textOrNull("description")
      : current.description;
    const capacity = has("capacity") ? Number(body.capacity) : current.capacity;
    const price = has("price") ? Number(body.price) : current.price;
    const roomImage = textOrNull("room_image") ?? current.room_image;
    const status = has("status")
      ? body.status === true || body.status === "true"
      : current.status;

    const result = await client.query(
      `UPDATE room_types SET room_name=$1, type_name=$2, description=$3, capacity=$4, price=$5,
       room_image=$6, amenity_ids=$7, status=$8
       WHERE id=$9 RETURNING *`,
      [
        roomName,
        typeName,
        description,
        capacity,
        price,
        roomImage,
        amenityIds,
        status,
        roomTypeId,
      ],
    );

    if (replaceGallery) {
      await client.query("DELETE FROM room_images WHERE room_type_id = $1", [
        roomTypeId,
      ]);
      for (const imagePath of galleryImages) {
        await client.query(
          `INSERT INTO room_images (room_type_id, image_path)
           VALUES ($1, $2)`,
          [roomTypeId, imagePath],
        );
      }
    }
    await client.query("COMMIT");

    // ลบรูปจาก Cloudinary เฉพาะหลัง COMMIT สำเร็จ
    const previousImages = [current.room_image ?? "", ...previousGallery].filter(
      Boolean,
    );
    const retainedImages = new Set([roomImage ?? "", ...galleryImages]);
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
    if (client) await rollbackQuietly(client);
    respondWithDbError(res, error, "Update room error:");
  } finally {
    client?.release();
  }
};

// ลบประเภทห้องพัก (สั่งลบรูปภาพออกจาก Cloudinary หลัง COMMIT สำเร็จเท่านั้น)
export const deleteRoom = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const roomTypeId = parsePositiveInt(req.params.id);
  if (roomTypeId === null) {
    res.status(400).json({ success: false, message: "Invalid id" });
    return;
  }

  try {
    // ปิดใช้งานแทนการลบ: คงประวัติการจองไว้และไม่ติด foreign key (หน้าบ้านซ่อนประเภทที่ status = false)
    const result = await pool.query(
      "UPDATE room_types SET status = false WHERE id = $1",
      [roomTypeId],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ success: false, message: "Room type not found" });
      return;
    }
    res.json({ success: true, message: "ปิดใช้งานประเภทห้องแล้ว" });
  } catch (error) {
    console.error("Deactivate room type error:", error);
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

// อัปเดตข้อมูลห้องย่อย เช่น หมายเลขห้อง สถานะ และประเภทห้อง
export const updateSingleRoom = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const { room_number, status, room_type_id } = req.body; // 👈 เพิ่ม room_type_id

    // คำสั่ง UPDATE เดียวเป็น atomic อยู่แล้ว จึงไม่ต้องครอบด้วย transaction
    const result = await pool.query(
      `UPDATE rooms
       SET room_number = COALESCE($1, room_number),
           status = COALESCE($2, status),
           room_type_id = COALESCE($3, room_type_id)
       WHERE room_id = $4 RETURNING *`,
      [room_number || null, status || null, room_type_id || null, id], // 👈 ส่ง parameter ให้ครบ 4 ตัว
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: "Room not found" });
      return;
    }
    res.json({ success: true, message: "Room updated", data: result.rows[0] });
  } catch (error) {
    respondWithDbError(res, error, "Update single room error:");
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
      `SELECT COUNT(*) as count FROM booking_room WHERE room_id = $1 AND status NOT IN ('cancelled', 'rejected')`,
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
       SET name = $1, status = COALESCE($2, status) 
       WHERE id = $3 
       RETURNING *`,
      [String(name).trim(), status === undefined ? null : status === true || status === 'true', Number(id)],
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

// ลบสิ่งอำนวยความสะดวกออกจากระบบ (และเอา ID ออกจาก amenity_ids ของห้องที่เกี่ยวข้องในรายการเดียวกัน)
export const deleteAmenity = async (
  req: Request,
  res: Response,
): Promise<void> => {
  const amenityId = parsePositiveInt(req.params.id);
  if (amenityId === null) {
    res.status(400).json({ success: false, message: "Invalid id" });
    return;
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query("BEGIN");

    // 1. ลบรายการออกจากตาราง room_amenities
    const result = await client.query(
      "DELETE FROM room_amenities WHERE id = $1 RETURNING *",
      [amenityId],
    );

    if (result.rows.length === 0) {
      await rollbackQuietly(client);
      res.status(404).json({ success: false, message: "Amenity not found" });
      return;
    }

    // 2. เคลียร์ ID นี้ออกจาก amenity_ids เฉพาะประเภทห้องที่มี ID นี้อยู่จริง
    await client.query(
      `UPDATE room_types SET amenity_ids = array_remove(amenity_ids, $1::integer)
       WHERE $1::integer = ANY(amenity_ids)`,
      [amenityId],
    );
    await client.query("COMMIT");

    res.json({ success: true, message: "Amenity deleted" });
  } catch (error) {
    if (client) await rollbackQuietly(client);
    respondWithDbError(res, error, "Delete amenity error:");
  } finally {
    client?.release();
  }
};

// ดึงห้องย่อยทั้งหมดในระบบพร้อมชื่อประเภทห้อง
export const getAllSingleRooms = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await pool.query(`
      SELECT 
        r.room_id, 
        r.room_number, 
        r.status, 
        r.room_type_id, -- 👈 เพิ่มตรงนี้เพื่อส่ง room_type_id กลับไป Frontend
        rt.room_name, 
        rt.type_name 
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

    // UPDATE ข้อมูลตาราง room_amenities สำหรับ PostgreSQL
    const result = await pool.query(
      `UPDATE room_amenities SET status = $1 WHERE id = $2 RETURNING *`,
      [status, Number(id)],
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

// จำนวนห้องสูงสุดที่สร้างได้ในการเรียกหนึ่งครั้ง (Auto-Run)
const MAX_BATCH_ROOM_QUANTITY = 50;

interface BatchRoomInput {
  room_type_id?: unknown;
  room_number?: unknown;
}

// บันทึกห้องพักย่อยแบบหลายห้อง (รองรับทั้ง Hybrid Smart Mapping และ Auto-Run เดิม)
export const createBatchSingleRooms = async (
  req: Request,
  res: Response,
): Promise<void> => {
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    const { rooms, room_type_id, quantity, start_number = 1 } = req.body;
    const roomsToInsert: { roomTypeId: number; roomNumber: string }[] = [];

    // --- กรณีที่ 1: รับข้อมูลแบบ Mapped Array จากหน้า Visual Preview บน Frontend ---
    if (Array.isArray(rooms) && rooms.length > 0) {
      for (const item of rooms as BatchRoomInput[]) {
        const roomTypeId = parsePositiveInt(item?.room_type_id);
        const roomNumber = String(item?.room_number ?? "").trim();
        if (roomTypeId === null || roomNumber === "") {
          res.status(400).json({
            success: false,
            message: "ข้อมูลห้องพักไม่ถูกต้อง กรุณาระบุประเภทห้องและหมายเลขห้อง",
          });
          return;
        }
        roomsToInsert.push({ roomTypeId, roomNumber });
      }
    } else {
      // --- กรณีที่ 2: Auto-Run แบบเดิม (Fallback) ---
      const parsedRoomTypeId = parsePositiveInt(room_type_id);
      const parsedQuantity = parsePositiveInt(quantity);
      const parsedStartNumber = parsePositiveInt(start_number);

      if (parsedRoomTypeId === null || parsedQuantity === null) {
        res.status(400).json({
          success: false,
          message: "กรุณาระบุประเภทห้องพักและจำนวนห้องที่ถูกต้อง",
        });
        return;
      }
      if (parsedQuantity > MAX_BATCH_ROOM_QUANTITY) {
        res.status(400).json({
          success: false,
          message: `จำนวนห้องต่อครั้งต้องอยู่ระหว่าง 1 ถึง ${MAX_BATCH_ROOM_QUANTITY} ห้อง`,
        });
        return;
      }
      if (parsedStartNumber === null) {
        res.status(400).json({
          success: false,
          message: "เลขเริ่มต้นต้องเป็นจำนวนเต็มบวก",
        });
        return;
      }

      const typeCheck = await client.query(
        `SELECT type_name FROM room_types WHERE id = $1`,
        [parsedRoomTypeId],
      );

      if (typeCheck.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: "ไม่พบประเภทห้องพักที่ระบุในระบบ",
        });
        return;
      }

      const typeName = typeCheck.rows[0].type_name || "";
      const words = typeName.trim().split(/\s+/);
      const targetWord = words[1] || words[0] || "";
      const cleanPrefix = targetWord.charAt(0).toUpperCase();

      for (let i = 0; i < parsedQuantity; i++) {
        roomsToInsert.push({
          roomTypeId: parsedRoomTypeId,
          roomNumber: `${cleanPrefix}${parsedStartNumber + i}`,
        });
      }
    }

    const duplicatesInRequest = findDuplicateNumbers(
      roomsToInsert.map((room) => room.roomNumber),
    );
    if (duplicatesInRequest.length > 0) {
      res.status(400).json({
        success: false,
        message: `ไม่สามารถสร้างได้ เนื่องจากมีหมายเลขห้องซ้ำกันในคำขอเดียวกัน: ${duplicatesInRequest.join(", ")}`,
      });
      return;
    }

    // ตรวจหมายเลขห้องซ้ำกับข้อมูลในระบบ (ชั้นสุดท้ายคือ unique constraint ซึ่งจะได้ 23505 -> 409)
    const existingCheck = await client.query<{ room_number: string }>(
      `SELECT room_number FROM rooms WHERE room_number = ANY($1::text[])`,
      [roomsToInsert.map((room) => room.roomNumber)],
    );

    if (existingCheck.rows.length > 0) {
      const duplicateRooms = existingCheck.rows
        .map((r) => r.room_number)
        .join(", ");
      res.status(400).json({
        success: false,
        message: `ไม่สามารถสร้างได้ เนื่องจากมีหมายเลขห้องซ้ำในระบบ: ${duplicateRooms}`,
      });
      return;
    }

    await client.query("BEGIN");
    const insertedRooms: unknown[] = [];
    for (const room of roomsToInsert) {
      const result = await client.query(
        `INSERT INTO rooms (room_type_id, room_number, status)
         VALUES ($1, $2, 'available')
         RETURNING *`,
        [room.roomTypeId, room.roomNumber],
      );
      insertedRooms.push(result.rows[0]);
    }
    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: `เพิ่มห้องพักจำนวน ${insertedRooms.length} ห้องสำเร็จ`,
      data: insertedRooms,
    });
  } catch (error) {
    if (client) await rollbackQuietly(client);
    respondWithDbError(res, error, "Create batch single rooms error details:");
  } finally {
    client?.release();
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
      res
        .status(400)
        .json({ success: false, message: "กรุณาระบุ room_type_id" });
      return;
    }

    // 1. ดึง type_name เพื่อหา Prefix จากคำที่ 2
    const typeRes = await pool.query(
      `SELECT type_name FROM room_types WHERE id = $1`,
      [room_type_id],
    );

    if (typeRes.rows.length === 0) {
      res.status(404).json({ success: false, message: "ไม่พบประเภทห้องพัก" });
      return;
    }

    const typeName = typeRes.rows[0].type_name || "";
    const words = typeName.trim().split(/\s+/);
    // ถอดตัวอักษรแรกของคำที่ 2 (หากไม่มีให้ใช้คำแรก)
    const targetWord = words[1] || words[0] || "";
    const prefix = targetWord.charAt(0).toUpperCase();

    // 2. ค้นหาเลขห้องล่าสุดที่ขึ้นต้นด้วย Prefix นี้
    const result = await pool.query(
      `SELECT room_number 
       FROM rooms 
       WHERE room_number ~ ('^' || $1 || '[0-9]+$') 
       ORDER BY CAST(SUBSTRING(room_number FROM LENGTH($1) + 1) AS INTEGER) DESC 
       LIMIT 1`,
      [prefix],
    );

    let nextNumber = 1;
    if (result.rows.length > 0) {
      const currentNumStr = result.rows[0].room_number.replace(prefix, "");
      nextNumber = parseInt(currentNumStr, 10) + 1;
    }

    res.status(200).json({
      success: true,
      data: {
        prefix,
        next_number: nextNumber,
      },
    });
  } catch (error: any) {
    console.error("Get next room number error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
