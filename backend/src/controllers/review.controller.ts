import { Request, Response } from "express";
import pool from "../config/database";
import { AuthPayload } from "../types";

// ดึงรีวิวล่าสุดสำหรับหน้าแรก (public)
export const getPublicReviews = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 6, 1), 20);
    const result = await pool.query(
      `SELECT rv.review_id, rv.rating, rv.comment, rv.review_date,
              m.first_name, m.last_name, m.image_profile,
              rt.room_name, rt.type_name
       FROM reviews rv
       JOIN members m ON m.member_id = rv.member_id
       JOIN room_bookings rb ON rb.room_booking_id = rv.room_booking_id
       JOIN rooms r ON r.room_id = rb.room_id
       JOIN room_types rt ON rt.id = r.room_type_id
       WHERE rv.comment IS NOT NULL AND TRIM(rv.comment) <> ''
       ORDER BY rv.review_date DESC
       LIMIT $1`,
      [limit],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get public reviews error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ดึงรีวิวทั้งหมดของ room_type นั้น (public) พร้อมชื่อผู้รีวิว
export const getReviewsByRoomType = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { room_type_id } = req.params;
    const result = await pool.query(
      `SELECT rv.review_id, rv.rating, rv.comment, rv.review_date,
              m.first_name, m.last_name, m.image_profile,
              rb.check_in, rb.check_out
       FROM reviews rv
       JOIN members m ON m.member_id = rv.member_id
       JOIN room_bookings rb ON rb.room_booking_id = rv.room_booking_id
       JOIN rooms r ON r.room_id = rb.room_id
       JOIN room_types rt ON rt.id = r.room_type_id
       WHERE rt.id = $1
       ORDER BY rv.review_date DESC`,
      [room_type_id],
    );
    const avg =
      result.rows.length > 0
        ? result.rows.reduce(
            (sum: number, r: any) => sum + Number(r.rating),
            0,
          ) / result.rows.length
        : null;
    res.json({
      success: true,
      data: result.rows,
      avg_rating: avg ? Math.round(avg * 10) / 10 : null,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Get reviews error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ดึงรีวิวของ member ที่ login อยู่ทั้งหมด
export const getMyReviews = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const result = await pool.query(
      `SELECT rv.review_id, rv.rating, rv.comment, rv.review_date, rv.room_booking_id,
              rt.room_name, rt.type_name, rt.room_image,
              rb.check_in, rb.check_out
       FROM reviews rv
       JOIN room_bookings rb ON rb.room_booking_id = rv.room_booking_id
       JOIN rooms r ON r.room_id = rb.room_id
       JOIN room_types rt ON rt.id = r.room_type_id
       WHERE rv.member_id = $1
       ORDER BY rv.review_date DESC`,
      [user.id],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get my reviews error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ดึงรายการ booking ที่ approved/completed ของ member ที่ยังไม่ได้รีวิว
export const getReviewableBookings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const result = await pool.query(
      `SELECT rb.room_booking_id, rb.check_in, rb.check_out,
              rt.room_name, rt.type_name, rt.room_image
       FROM room_bookings rb
       JOIN rooms r ON r.room_id = rb.room_id
       JOIN room_types rt ON rt.id = r.room_type_id
       WHERE rb.member_id = $1
         AND rb.status = 'approved'
         AND rb.room_booking_id NOT IN (
           SELECT room_booking_id FROM reviews WHERE member_id = $1
         )
       ORDER BY rb.check_out DESC`,
      [user.id],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error("Get reviewable bookings error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ดึงรีวิวทั้งหมด (admin / staff)
export const getAllReviews = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { room_type_id, min_rating, max_rating } = req.query;
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let idx = 1;

    if (room_type_id) {
      whereClause += ` AND rt.id = $${idx++}`;
      params.push(Number(room_type_id));
    }
    if (min_rating) {
      whereClause += ` AND rv.rating >= $${idx++}`;
      params.push(Number(min_rating));
    }
    if (max_rating) {
      whereClause += ` AND rv.rating <= $${idx++}`;
      params.push(Number(max_rating));
    }

    // 🔧 เพิ่ม JOIN rooms r ON r.room_id = rb.room_id และเปลี่ยน JOIN room_types เป็น rt.id = r.room_type_id
    const result = await pool.query(
      `SELECT rv.review_id, rv.rating, rv.comment, rv.review_date,
              m.first_name, m.last_name, m.image_profile, m.email,
              rt.room_name, rt.type_name, rt.room_image, rt.id AS room_type_id,
              rb.check_in, rb.check_out, rb.room_booking_id
       FROM reviews rv
       JOIN members m ON m.member_id = rv.member_id
       JOIN room_bookings rb ON rb.room_booking_id = rv.room_booking_id
       JOIN rooms r ON r.room_id = rb.room_id
       JOIN room_types rt ON rt.id = r.room_type_id
       ${whereClause}
       ORDER BY rv.review_date DESC`,
      params,
    );

    const avg =
      result.rows.length > 0
        ? result.rows.reduce(
            (sum: number, r: any) => sum + Number(r.rating),
            0,
          ) / result.rows.length
        : null;

    res.json({
      success: true,
      data: result.rows,
      avg_rating: avg ? Math.round(avg * 10) / 10 : null,
      total: result.rows.length,
    });
  } catch (error) {
    console.error("Get all reviews error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ลบรีวิว (admin) — ลบได้ทุก review
export const adminDeleteReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM reviews WHERE review_id=$1 RETURNING review_id",
      [id],
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: "ไม่พบรีวิว" });
      return;
    }
    res.json({ success: true, message: "ลบรีวิวสำเร็จ" });
  } catch (error) {
    console.error("Admin delete review error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// สร้างรีวิวใหม่ — 1 booking = 1 review เท่านั้น
export const createReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const { room_booking_id, rating, comment } = req.body;

    if (!room_booking_id || !rating) {
      res
        .status(400)
        .json({
          success: false,
          message: "room_booking_id และ rating จำเป็นต้องระบุ",
        });
      return;
    }
    if (Number(rating) < 1 || Number(rating) > 5) {
      res
        .status(400)
        .json({ success: false, message: "rating ต้องอยู่ระหว่าง 1-5" });
      return;
    }

    // ตรวจสอบว่า booking เป็นของ member และ status เหมาะสม
    const bookingCheck = await pool.query(
      `SELECT rb.room_booking_id FROM room_bookings rb
       WHERE rb.room_booking_id = $1 AND rb.member_id = $2 AND rb.status = 'approved'`,
      [room_booking_id, user.id],
    );
    if (bookingCheck.rows.length === 0) {
      res
        .status(403)
        .json({ success: false, message: "ไม่พบการจองหรือไม่มีสิทธิ์รีวิว" });
      return;
    }

    // ตรวจสอบว่ายังไม่เคยรีวิว booking นี้
    const existing = await pool.query(
      "SELECT review_id FROM reviews WHERE room_booking_id = $1 AND member_id = $2",
      [room_booking_id, user.id],
    );
    if (existing.rows.length > 0) {
      res
        .status(409)
        .json({ success: false, message: "คุณได้รีวิวการจองนี้ไปแล้ว" });
      return;
    }

    const result = await pool.query(
      `INSERT INTO reviews (member_id, room_booking_id, rating, comment, review_date)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [user.id, room_booking_id, Number(rating), comment || null],
    );
    res
      .status(201)
      .json({ success: true, message: "รีวิวสำเร็จ", data: result.rows[0] });
  } catch (error) {
    console.error("Create review error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// แก้ไขรีวิว — เฉพาะเจ้าของเท่านั้น
export const updateReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const { id } = req.params;
    const { rating, comment } = req.body;

    if (Number(rating) < 1 || Number(rating) > 5) {
      res
        .status(400)
        .json({ success: false, message: "rating ต้องอยู่ระหว่าง 1-5" });
      return;
    }

    const result = await pool.query(
      `UPDATE reviews SET rating=$1, comment=$2
       WHERE review_id=$3 AND member_id=$4 RETURNING *`,
      [Number(rating), comment || null, id, user.id],
    );
    if (result.rows.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "ไม่พบรีวิวหรือไม่มีสิทธิ์แก้ไข" });
      return;
    }
    res.json({
      success: true,
      message: "แก้ไขรีวิวสำเร็จ",
      data: result.rows[0],
    });
  } catch (error) {
    console.error("Update review error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ลบรีวิว — เฉพาะเจ้าของเท่านั้น
export const deleteReview = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const user = req.user as AuthPayload;
    const { id } = req.params;
    const result = await pool.query(
      "DELETE FROM reviews WHERE review_id=$1 AND member_id=$2 RETURNING review_id",
      [id, user.id],
    );
    if (result.rows.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "ไม่พบรีวิวหรือไม่มีสิทธิ์ลบ" });
      return;
    }
    res.json({ success: true, message: "ลบรีวิวสำเร็จ" });
  } catch (error) {
    console.error("Delete review error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
