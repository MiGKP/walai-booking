import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthPayload } from '../types';
import { mapDbError } from '../utils/db-errors';
import { parsePositiveInt } from '../utils/ids';
import { parsePagination, paginationMeta } from '../utils/pagination';

// ดึงรีวิวล่าสุดสำหรับหน้าแรก (public)
export const getPublicReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 20);
    const result = await pool.query(
      `SELECT rv.review_id, rv.rating, rv.comment, rv.review_date,
              m.first_name, LEFT(m.last_name, 1) AS last_name, m.image_profile,
              rt.room_name, rt.type_name
       FROM reviews rv
       JOIN members m ON m.member_id = rv.member_id
       JOIN room_types rt ON rt.id = rv.room_type_id
       WHERE rv.comment IS NOT NULL AND TRIM(rv.comment) <> ''
       ORDER BY rv.review_date DESC
       LIMIT $1`,
      [limit]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get public reviews error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรีวิวทั้งหมดของ room_type นั้น (public) พร้อมชื่อผู้รีวิว
export const getReviewsByRoomType = async (req: Request, res: Response): Promise<void> => {
  try {
    const roomTypeId = parsePositiveInt(req.params.room_type_id);
    if (roomTypeId == null) {
      res.status(400).json({ success: false, message: 'รหัสประเภทห้องไม่ถูกต้อง' });
      return;
    }
    const result = await pool.query(
      `SELECT rv.review_id, rv.rating, rv.comment, rv.review_date,
              m.first_name, LEFT(m.last_name, 1) AS last_name, m.image_profile,
              rb.check_in, rb.check_out
       FROM reviews rv
       JOIN members m ON m.member_id = rv.member_id
       JOIN room_bookings rb ON rb.room_booking_id = rv.room_booking_id
       WHERE rv.room_type_id = $1
       ORDER BY rv.review_date DESC`,
      [roomTypeId]
    );
    const avg = result.rows.length > 0
      ? result.rows.reduce((sum: number, r: any) => sum + Number(r.rating), 0) / result.rows.length
      : null;
    res.json({ success: true, data: result.rows, avg_rating: avg ? Math.round(avg * 10) / 10 : null, total: result.rows.length });
  } catch (error) {
    console.error('Get reviews error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรีวิวของ member ที่ login อยู่ทั้งหมด
export const getMyReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const result = await pool.query(
      `SELECT rv.review_id, rv.rating, rv.comment, rv.review_date, rv.room_booking_id, rv.room_type_id,
              rt.room_name, rt.type_name, rt.room_image,
              rb.check_in, rb.check_out
       FROM reviews rv
       JOIN room_bookings rb ON rb.room_booking_id = rv.room_booking_id
       JOIN room_types rt ON rt.id = rv.room_type_id
       WHERE rv.member_id = $1
       ORDER BY rv.review_date DESC`,
      [user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get my reviews error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรายการ booking ที่ approved/completed ของ member ที่ยังไม่ได้รีวิว
export const getReviewableBookings = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    // หนึ่งแถวต่อ "ประเภทห้อง" ที่มีอยู่ในบิลนั้น (ไม่ใช่ต่อบิล) เพื่อให้รีวิวแยกตามประเภทห้องได้
    // เมื่อจองหลายประเภทห้องรวมกันในบิลเดียว (เช่น 1 Standard + 1 Deluxe)
    const result = await pool.query(
      `SELECT DISTINCT rb.room_booking_id, rt.id AS room_type_id, rt.room_name, rt.type_name, rt.room_image,
              rb.check_in, rb.check_out
       FROM room_bookings rb
       JOIN booking_room br ON br.room_booking_id = rb.room_booking_id
       JOIN rooms r ON r.room_id = br.room_id
       JOIN room_types rt ON rt.id = r.room_type_id
       WHERE rb.member_id = $1
         AND rb.status IN ('approved', 'checked_out')
         AND NOT EXISTS (
           SELECT 1 FROM booking_room x
           WHERE x.room_booking_id = rb.room_booking_id AND x.status <> 'checked_out'
         )
         AND NOT EXISTS (
           SELECT 1 FROM reviews rv
           WHERE rv.room_booking_id = rb.room_booking_id AND rv.member_id = $1 AND rv.room_type_id = rt.id
         )
       ORDER BY rb.check_out DESC`,
      [user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get reviewable bookings error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรีวิวทั้งหมด (admin only)
export const getAllReviews = async (req: Request, res: Response): Promise<void> => {
  try {
    const { room_type_id, min_rating, max_rating, search } = req.query;
    const pagination = parsePagination(req.query);
    let whereClause = 'WHERE 1=1';
    const params: (string | number)[] = [];
    if (room_type_id) { params.push(Number(room_type_id)); whereClause += ` AND rv.room_type_id = $${params.length}`; }
    if (min_rating) { params.push(Number(min_rating)); whereClause += ` AND rv.rating >= $${params.length}`; }
    if (max_rating) { params.push(Number(max_rating)); whereClause += ` AND rv.rating <= $${params.length}`; }
    if (typeof search === 'string' && search.trim()) {
      params.push(`%${search.trim()}%`);
      whereClause += ` AND (CONCAT_WS(' ', m.first_name, m.last_name) ILIKE $${params.length}
        OR m.email ILIKE $${params.length} OR rt.room_name ILIKE $${params.length}
        OR rt.type_name ILIKE $${params.length} OR rv.comment ILIKE $${params.length})`;
    }
    const fromClause = `FROM reviews rv
       JOIN members m ON m.member_id = rv.member_id
       JOIN room_bookings rb ON rb.room_booking_id = rv.room_booking_id
       JOIN room_types rt ON rt.id = rv.room_type_id
       ${whereClause}`;
    let aggregate: { total: number; avg_rating: number | null; ratingCounts: Record<number, number> } | undefined;
    if (pagination) {
      const stats = await pool.query(`SELECT COUNT(*) AS total, AVG(rv.rating) AS avg_rating,
        COUNT(*) FILTER (WHERE rv.rating = 5) AS rating_5,
        COUNT(*) FILTER (WHERE rv.rating = 4) AS rating_4,
        COUNT(*) FILTER (WHERE rv.rating = 3) AS rating_3,
        COUNT(*) FILTER (WHERE rv.rating = 2) AS rating_2,
        COUNT(*) FILTER (WHERE rv.rating = 1) AS rating_1 ${fromClause}`, params);
      const row = stats.rows[0];
      aggregate = { total: Number(row.total), avg_rating: row.avg_rating == null ? null : Math.round(Number(row.avg_rating) * 10) / 10,
        ratingCounts: { 1: Number(row.rating_1), 2: Number(row.rating_2), 3: Number(row.rating_3), 4: Number(row.rating_4), 5: Number(row.rating_5) } };
    }
    const result = await pool.query(
      `SELECT rv.review_id, rv.rating, rv.comment, rv.review_date,
              m.first_name, m.last_name, m.image_profile, m.email,
              rt.room_name, rt.type_name, rt.room_image, rt.id AS room_type_id,
              rb.check_in, rb.check_out, rb.room_booking_id
       ${fromClause}
       ORDER BY rv.review_date DESC, rv.review_id DESC
       ${pagination ? `LIMIT $${params.length + 1} OFFSET $${params.length + 2}` : ''}`,
      pagination ? [...params, pagination.limit, pagination.offset] : params
    );
    const avg = result.rows.length > 0
      ? result.rows.reduce((sum: number, row: { rating: number }) => sum + Number(row.rating), 0) / result.rows.length : null;
    res.json({ success: true, data: result.rows,
      avg_rating: aggregate ? aggregate.avg_rating : avg == null ? null : Math.round(avg * 10) / 10,
      total: aggregate ? aggregate.total : result.rows.length,
      ...(pagination && aggregate ? { pagination: paginationMeta(pagination, aggregate.total), summary: aggregate } : {}) });
  } catch (error) {
    console.error('Get all reviews error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ลบรีวิว (admin) — ลบได้ทุก review
export const adminDeleteReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const reviewId = parsePositiveInt(req.params.id);
    if (reviewId == null) {
      res.status(400).json({ success: false, message: 'รหัสรีวิวไม่ถูกต้อง' });
      return;
    }
    const result = await pool.query(
      'DELETE FROM reviews WHERE review_id=$1 RETURNING review_id',
      [reviewId]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'ไม่พบรีวิว' });
      return;
    }
    res.json({ success: true, message: 'ลบรีวิวสำเร็จ' });
  } catch (error) {
    console.error('Admin delete review error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// สร้างรีวิวใหม่ — 1 booking = 1 review เท่านั้น
export const createReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const { room_booking_id, room_type_id, rating, comment } = req.body;

    const bookingId = parsePositiveInt(room_booking_id);
    const roomTypeId = parsePositiveInt(room_type_id);
    if (bookingId == null || roomTypeId == null || !rating) {
      res.status(400).json({ success: false, message: 'room_booking_id, room_type_id และ rating จำเป็นต้องระบุ' });
      return;
    }
    if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
      res.status(400).json({ success: false, message: 'rating ต้องอยู่ระหว่าง 1-5' });
      return;
    }

    // ตรวจสอบว่า booking เป็นของ member, status เหมาะสม, และมีห้องประเภทนี้อยู่ในบิลจริง
    // (จองหลายประเภทห้องในบิลเดียวกันได้ จึงต้องเช็คว่า room_type_id ที่ส่งมาตรงกับห้องเส้นใดเส้นหนึ่งในบิลนี้จริง)
    const bookingCheck = await pool.query(
      `SELECT 1 FROM room_bookings rb
       JOIN booking_room br ON br.room_booking_id = rb.room_booking_id
       JOIN rooms r ON r.room_id = br.room_id
       WHERE rb.room_booking_id = $1 AND rb.member_id = $2 AND rb.status = 'checked_out' AND r.room_type_id = $3
       LIMIT 1`,
      [bookingId, user.id, roomTypeId]
    );
    if (bookingCheck.rows.length === 0) {
      res.status(403).json({ success: false, message: 'ไม่พบห้องประเภทนี้ในการจอง หรือไม่มีสิทธิ์รีวิว' });
      return;
    }

    // ตรวจสอบว่ายังไม่เคยรีวิวห้องประเภทนี้ในบิลนี้ (ประเภทอื่นในบิลเดียวกันยังรีวิวแยกได้)
    const existing = await pool.query(
      'SELECT review_id FROM reviews WHERE room_booking_id = $1 AND member_id = $2 AND room_type_id = $3',
      [bookingId, user.id, roomTypeId]
    );
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, message: 'คุณได้รีวิวห้องประเภทนี้ในการจองนี้ไปแล้ว' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO reviews (member_id, room_booking_id, room_type_id, rating, comment, review_date)
       VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
      [user.id, bookingId, roomTypeId, Number(rating), comment || null]
    );
    res.status(201).json({ success: true, message: 'รีวิวสำเร็จ', data: result.rows[0] });
  } catch (error) {
    console.error('Create review error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      const message = mapped.status === 409 ? 'คุณได้รีวิวห้องประเภทนี้ในการจองนี้ไปแล้ว' : mapped.message;
      res.status(mapped.status).json({ success: false, message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// แก้ไขรีวิว — เฉพาะเจ้าของเท่านั้น
export const updateReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const reviewId = parsePositiveInt(req.params.id);
    if (reviewId == null) {
      res.status(400).json({ success: false, message: 'รหัสรีวิวไม่ถูกต้อง' });
      return;
    }
    const { rating, comment } = req.body;

    if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
      res.status(400).json({ success: false, message: 'rating ต้องอยู่ระหว่าง 1-5' });
      return;
    }

    const result = await pool.query(
      `UPDATE reviews SET rating=$1, comment=$2
       WHERE review_id=$3 AND member_id=$4 RETURNING *`,
      [Number(rating), comment || null, reviewId, user.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'ไม่พบรีวิวหรือไม่มีสิทธิ์แก้ไข' });
      return;
    }
    res.json({ success: true, message: 'แก้ไขรีวิวสำเร็จ', data: result.rows[0] });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ลบรีวิว — เฉพาะเจ้าของเท่านั้น
export const deleteReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const reviewId = parsePositiveInt(req.params.id);
    if (reviewId == null) {
      res.status(400).json({ success: false, message: 'รหัสรีวิวไม่ถูกต้อง' });
      return;
    }
    const result = await pool.query(
      'DELETE FROM reviews WHERE review_id=$1 AND member_id=$2 RETURNING review_id',
      [reviewId, user.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'ไม่พบรีวิวหรือไม่มีสิทธิ์ลบ' });
      return;
    }
    res.json({ success: true, message: 'ลบรีวิวสำเร็จ' });
  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
