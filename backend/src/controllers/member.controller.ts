import { Request, Response } from 'express';
import pool from '../config/database';

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

// สลับสถานะสมาชิก (เช่น active / inactive หรือ true / false)
export const toggleMemberStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const result = await pool.query(
      `UPDATE members 
       SET status = $1 
       WHERE member_id = $2 
       RETURNING member_id, first_name, last_name, email, status`,
      [status, id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Member not found' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Toggle member status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};