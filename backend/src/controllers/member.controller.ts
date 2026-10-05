import { Request, Response } from 'express';
import pool from '../config/database';
import { mapDbError } from '../utils/db-errors';
import { parsePositiveInt } from '../utils/ids';

// ─── Members Management ────────────────────────────────────────────────────────

// ดึงรายการสมาชิกทั้งหมด (พร้อมแบ่งหน้า หรือค้นหา)
export const getAllMembers = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT member_id, first_name, last_name, email, phone, created_at 
       FROM members 
       ORDER BY created_at DESC`
    );
    
    res.json({
      success: true,
      data: result.rows,
    });
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
