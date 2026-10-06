import { Request, Response } from 'express';
import pool from '../config/database';
import { mapDbError } from '../utils/db-errors';
import { parsePositiveInt } from '../utils/ids';
import { parsePagination, paginationMeta } from '../utils/pagination';

// ─── Members Management ────────────────────────────────────────────────────────

// ดึงรายการสมาชิกทั้งหมด (พร้อมแบ่งหน้า หรือค้นหา)
export const getAllMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const pagination = parsePagination(req.query);
    const params: (string | number)[] = [];
    let where = 'WHERE 1=1';
    if (typeof req.query.search === 'string' && req.query.search.trim()) {
      params.push(`%${req.query.search.trim()}%`);
      where += ` AND (CONCAT_WS(' ', first_name, last_name) ILIKE $${params.length} OR email ILIKE $${params.length} OR phone ILIKE $${params.length})`;
    }
    if (req.query.status === 'active') where += ' AND is_active IS DISTINCT FROM false';
    if (req.query.status === 'inactive') where += ' AND is_active = false';
    let extra = {};
    if (pagination) {
      const count = await pool.query(`SELECT COUNT(*) AS total FROM members ${where}`, params);
      const summary = await pool.query(`SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE is_active IS DISTINCT FROM false) AS active,
        COUNT(*) FILTER (WHERE is_active = false) AS inactive FROM members`);
      const totals = summary.rows[0];
      extra = { pagination: paginationMeta(pagination, Number(count.rows[0].total)),
        summary: { total: Number(totals.total), active: Number(totals.active), inactive: Number(totals.inactive) } };
    }
    const result = await pool.query(
      `SELECT member_id, member_id AS id, first_name, last_name, email, phone, is_active,
              image_profile, line_id, facebook, created_at,
              (SELECT COUNT(*) FROM room_bookings rb WHERE rb.member_id = members.member_id) AS room_booking_count,
              (SELECT COUNT(*) FROM boat_bookings bb WHERE bb.member_id = members.member_id) AS boat_booking_count
       FROM members ${where}
       ORDER BY created_at DESC, member_id DESC
       ${pagination ? `LIMIT $${params.length + 1} OFFSET $${params.length + 2}` : ''}`,
      pagination ? [...params, pagination.limit, pagination.offset] : params
    );
    res.json({ success: true, data: result.rows, ...extra });
  } catch (error) {
    console.error('Get all members error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// สลับสถานะการใช้งานของสมาชิก (is_active) โดย admin ต้องส่งค่าเป็น boolean เท่านั้น
export const toggleMemberStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const memberId = parsePositiveInt(req.params.id);
    if (memberId === null) {
      res.status(400).json({ success: false, message: 'Invalid member id' });
      return;
    }
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') {
      res.status(400).json({ success: false, message: 'status must be boolean' });
      return;
    }

    const result = await pool.query(
      `UPDATE members
       SET is_active = $1
       WHERE member_id = $2
       RETURNING member_id, first_name, last_name, email, is_active`,
      [is_active, memberId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Member not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Toggle member status error:', error);
    const dbError = mapDbError(error);
    if (dbError) {
      res.status(dbError.status).json({ success: false, message: dbError.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
