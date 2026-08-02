import { Request, Response } from 'express';
import pool from '../config/database';

// ─── Bank Accounts ─────────────────────────────────────────────────────────────

export const getBankAccounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`SELECT * FROM bank_accounts ORDER BY is_primary DESC, created_at ASC`);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get bank accounts error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { bank_name, account_number, account_name, promptpay_id, is_primary } = req.body;
    if (is_primary) {
      await pool.query(`UPDATE bank_accounts SET is_primary = false`);
    }
    const result = await pool.query(
      `INSERT INTO bank_accounts (bank_name, account_number, account_name, promptpay_id, is_primary)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [bank_name, account_number, account_name, promptpay_id || null, is_primary ?? false]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Create bank account error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updateBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { bank_name, account_number, account_name, promptpay_id, is_primary } = req.body;
    if (is_primary) {
      await pool.query(`UPDATE bank_accounts SET is_primary = false`);
    }
    const result = await pool.query(
      `UPDATE bank_accounts SET bank_name=$1, account_number=$2, account_name=$3, promptpay_id=$4, is_primary=$5
       WHERE bank_account_id=$6 RETURNING *`,
      [bank_name, account_number, account_name, promptpay_id || null, is_primary ?? false, id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Bank account not found' });
      return;
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Update bank account error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const deleteBankAccount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `DELETE FROM bank_accounts WHERE bank_account_id=$1 RETURNING bank_account_id`,
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Bank account not found' });
      return;
    }
    res.json({ success: true, message: 'Bank account deleted' });
  } catch (error) {
    console.error('Delete bank account error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Resort Info (รวม contact + site info ใน table resort_info) ────────────────

// ─── Resort Info (รวม contact + site info ใน table resort_info) ────────────────

export const getResortInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, name } = req.query;

    // 1. ถ้าส่ง ?id=4 หรือ ?id=5 มา
    if (id) {
      const result = await pool.query(`SELECT * FROM resort_info WHERE id = $1 LIMIT 1`, [id]);
      res.json({ success: true, data: result.rows[0] || null });
      return;
    }

    // 2. ถ้าส่ง ?name=ห้องพัก มา
    if (name) {
      const result = await pool.query(
        `SELECT * FROM resort_info WHERE name LIKE $1 LIMIT 1`,
        [`%${name}%`]
      );
      res.json({ success: true, data: result.rows[0] || null });
      return;
    }

    // 3. ถ้าไม่ระบุ ให้คืนค่าทุกแถว (สถานที่หลัก=3, ห้องพัก=4, เรือ=5)
    const result = await pool.query(`SELECT * FROM resort_info ORDER BY id ASC`);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get resort info error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const upsertResortInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    // ดึง id จาก URL params หรือ request body
    let targetId = req.params.id ? Number(req.params.id) : req.body.id ? Number(req.body.id) : null;
    const targetName = req.body.name;

    // 🎯 Mapping ID อัตโนมัติตามประเภท หากไม่ได้ส่ง id มาตรงๆ
    if (!targetId && targetName) {
      if (targetName.includes('ห้อง') || targetName.includes('room')) {
        targetId = 4; // ID จุดบริการห้องพัก
      } else if (targetName.includes('เรือ') || targetName.includes('boat')) {
        targetId = 5; // ID จุดบริการเรือ
      } else {
        targetId = 3; // ID สถานที่หลัก
      }
    }

    const allowed = [
      'name', 'address', 'coordinates', 'phone', 'email', 'facebook', 'line_id',
      'operating_days', 'operating_hours', 'additional_terms', 'payment_due_days',
      'promptpay_id', 'bank_account_no', 'bank_account_name',
    ];

    const updates: { col: string; val: any }[] = [];
    for (const col of allowed) {
      if (req.body[col] !== undefined) {
        updates.push({ col, val: req.body[col] || null });
      }
    }

    if (updates.length === 0) {
      res.status(400).json({ success: false, message: 'No fields to update' });
      return;
    }

    // ค้นหาแถวในตารางตาม targetId
    let existing;
    if (targetId) {
      existing = await pool.query(`SELECT id FROM resort_info WHERE id = $1 LIMIT 1`, [targetId]);
    }

    let result;

    if (existing && existing.rows.length > 0) {
      // 🟢 มีข้อมูลเดิม -> อัปเดตเฉพาะแถว ID ที่ระบุเท่านั้น (3, 4, หรือ 5)
      const setClauses = updates.map((u, i) => `${u.col}=$${i + 1}`).join(', ');
      const values = [...updates.map(u => u.val), targetId];
      result = await pool.query(
        `UPDATE resort_info SET ${setClauses} WHERE id=$${updates.length + 1} RETURNING *`,
        values
      );
    } else {
      // 🟡 กรณีหา ID ไม่เจอ -> INSERT ใหม่โดยกำหนด ID หากระบุมา
      if (targetId) {
        updates.push({ col: 'id', val: targetId });
      }
      const cols = updates.map(u => u.col).join(', ');
      const placeholders = updates.map((_, i) => `$${i + 1}`).join(', ');
      result = await pool.query(
        `INSERT INTO resort_info (${cols}) VALUES (${placeholders}) RETURNING *`,
        updates.map(u => u.val)
      );
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error: any) {
    console.error('Upsert resort info error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Boat Operating Hours ───────────────────────────────────────────────────────

export const getBoatHours = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(`SELECT * FROM boat_operating_hours ORDER BY day_of_week ASC`);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get boat hours error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const upsertBoatHours = async (req: Request, res: Response): Promise<void> => {
  try {
    const { day_of_week, open_time, close_time, is_open } = req.body;
    const existing = await pool.query(
      `SELECT id FROM boat_operating_hours WHERE day_of_week = $1`, [day_of_week]
    );
    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE boat_operating_hours SET open_time=$1, close_time=$2, is_open=$3 WHERE day_of_week=$4 RETURNING *`,
        [open_time, close_time, is_open ?? true, day_of_week]
      );
    } else {
      result = await pool.query(
        `INSERT INTO boat_operating_hours (day_of_week, open_time, close_time, is_open)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [day_of_week, open_time, close_time, is_open ?? true]
      );
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Upsert boat hours error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// สถิติสรุปสำหรับหน้าแรก (public)
export const getLandingStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const [roomTypesRes, boatTypesRes, guestsRes, reviewsRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM room_types WHERE status = true`),
      pool.query(`SELECT COUNT(*)::int AS total FROM boat_types WHERE is_active = true`),
      pool.query(`
        SELECT COUNT(DISTINCT member_id)::int AS total FROM (
          SELECT member_id FROM room_bookings WHERE status IN ('approved', 'checked_out', 'paid')
          UNION
          SELECT member_id FROM boat_bookings WHERE status IN ('approved', 'checked_out', 'paid')
        ) guests
      `),
      pool.query(`
        SELECT ROUND(AVG(rating)::numeric, 1) AS avg_rating, COUNT(*)::int AS total
        FROM reviews
      `),
    ]);

    res.json({
      success: true,
      data: {
        room_type_count: Number(roomTypesRes.rows[0]?.total || 0),
        boat_type_count: Number(boatTypesRes.rows[0]?.total || 0),
        guest_count: Number(guestsRes.rows[0]?.total || 0),
        avg_rating: reviewsRes.rows[0]?.avg_rating != null ? Number(reviewsRes.rows[0].avg_rating) : null,
        review_count: Number(reviewsRes.rows[0]?.total || 0),
      },
    });
  } catch (error) {
    console.error('Get landing stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ─── Statistics ─────────────────────────────────────────────────────────────────

export const getStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period, date, month, year } = req.query;

    const summaryParams: any[] = [];
    const chartParams: any[] = [];
    let whereClause = '';
    let chartWhereClause = '';

    if (period === 'day' && date) {
      summaryParams.push(date);
      whereClause = `WHERE DATE(created_at) = $1`;
    } else {
      const y = (period === 'month' && year) ? Number(year) : new Date().getFullYear();
      const m = (period === 'month' && month) ? Number(month) : new Date().getMonth() + 1;
      summaryParams.push(y, m);
      chartParams.push(y, m);
      whereClause = `WHERE EXTRACT(YEAR FROM created_at) = $1 AND EXTRACT(MONTH FROM created_at) = $2`;
      chartWhereClause = whereClause;
    }

    // รายได้รวมการจองที่ยืนยันแล้ว + เช็คเอาต์แล้ว (checked_out = จบงานแล้วแต่เคยอนุมัติชำระเงิน)
    const revenueStatusFilter = `status IN ('approved', 'checked_out')`;

    const summaryRoomQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE ${revenueStatusFilter})::int as approved_count,
        COUNT(*) FILTER (WHERE status = 'pending')::int as pending_count,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int as cancelled_count,
        COALESCE(SUM(total_price) FILTER (WHERE ${revenueStatusFilter}), 0)::numeric as revenue
      FROM room_bookings ${whereClause}`;

    const summaryKayakQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE ${revenueStatusFilter})::int as approved_count,
        COUNT(*) FILTER (WHERE status = 'pending')::int as pending_count,
        COUNT(*) FILTER (WHERE status = 'cancelled')::int as cancelled_count,
        COALESCE(SUM(total_price) FILTER (WHERE ${revenueStatusFilter}), 0)::numeric as revenue
      FROM boat_bookings ${whereClause}`;

    const chartRoomQuery = chartWhereClause ? `
      SELECT 
        TO_CHAR(DATE(created_at), 'YYYY-MM-DD') as day,
        COALESCE(SUM(total_price) FILTER (WHERE ${revenueStatusFilter}), 0)::numeric as revenue,
        COUNT(*) FILTER (WHERE ${revenueStatusFilter})::int as approved_count
      FROM room_bookings ${chartWhereClause}
      GROUP BY DATE(created_at) ORDER BY day ASC` : null;

    const chartKayakQuery = chartWhereClause ? `
      SELECT 
        TO_CHAR(DATE(created_at), 'YYYY-MM-DD') as day,
        COALESCE(SUM(total_price) FILTER (WHERE ${revenueStatusFilter}), 0)::numeric as revenue,
        COUNT(*) FILTER (WHERE ${revenueStatusFilter})::int as approved_count
      FROM boat_bookings ${chartWhereClause}
      GROUP BY DATE(created_at) ORDER BY day ASC` : null;

    const queries: Promise<any>[] = [
      pool.query(summaryRoomQuery, summaryParams),
      pool.query(summaryKayakQuery, summaryParams),
      pool.query(`SELECT COUNT(*)::int as total FROM members`),
    ];
    if (chartRoomQuery) queries.push(pool.query(chartRoomQuery, chartParams));
    if (chartKayakQuery) queries.push(pool.query(chartKayakQuery, chartParams));

    const results = await Promise.all(queries);
    const [roomSummaryRes, kayakSummaryRes, memberRes, roomChartRes, kayakChartRes] = results;

    res.json({
      success: true,
      data: {
        room_summary: roomSummaryRes.rows[0] || {},
        kayak_summary: kayakSummaryRes.rows[0] || {},
        room_chart: roomChartRes?.rows || [],
        kayak_chart: kayakChartRes?.rows || [],
        total_members: Number(memberRes.rows[0].total),
        period: period || 'month',
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
