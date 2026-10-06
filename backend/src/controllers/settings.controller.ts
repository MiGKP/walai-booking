import { Request, Response } from 'express';
import { safeRollback } from '../utils/safe-rollback';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import type { PoolClient } from 'pg';
import { parsePositiveInt } from '../utils/ids';

// คืนค่า rollback แบบเงียบ เพื่อไม่ให้ error ของ ROLLBACK บดบัง error เดิม
const rollbackQuietly = async (client: PoolClient): Promise<void> => {
  try {
    await safeRollback(client);
  } catch (rollbackError) {
    console.error('Rollback error:', rollbackError);
  }
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const isValidIsoDate = (value: string): boolean => {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

// คืน undefined ถ้าไม่ได้ส่งค่ามา, คืน null ถ้าไม่ใช่จำนวนเต็มในช่วงที่กำหนด
const parseQueryInt = (value: unknown, min: number, max: number): number | null | undefined => {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
};

// ฟิลด์การชำระเงินที่ใช้เป็นปลายทางโอนเงิน แก้ไขได้เฉพาะ admin
const ADMIN_ONLY_RESORT_FIELDS = ['promptpay_id', 'bank_account_no', 'bank_account_name'];

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
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    const { bank_name, account_number, account_name, promptpay_id, is_primary } = req.body;
    await client.query('BEGIN');
    if (is_primary) {
      await client.query(`UPDATE bank_accounts SET is_primary = false`);
    }
    const result = await client.query(
      `INSERT INTO bank_accounts (bank_name, account_number, account_name, promptpay_id, is_primary)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [bank_name, account_number, account_name, promptpay_id || null, is_primary ?? false]
    );
    await client.query('COMMIT');
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (client) await rollbackQuietly(client);
    console.error('Create bank account error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client?.release();
  }
};

export const updateBankAccount = async (req: Request, res: Response): Promise<void> => {
  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    const { id } = req.params;
    const { bank_name, account_number, account_name, promptpay_id, is_primary } = req.body;
    await client.query('BEGIN');

    // ยืนยันว่ามีรายการที่จะแก้ไขจริงก่อน จึงค่อยล้างค่าหลักของรายการอื่น
    const target = await client.query(
      `SELECT bank_account_id FROM bank_accounts WHERE bank_account_id=$1 FOR UPDATE`,
      [id]
    );
    if (target.rows.length === 0) {
      await rollbackQuietly(client);
      res.status(404).json({ success: false, message: 'Bank account not found' });
      return;
    }
    if (is_primary) {
      await client.query(`UPDATE bank_accounts SET is_primary = false WHERE bank_account_id <> $1`, [id]);
    }
    const result = await client.query(
      `UPDATE bank_accounts SET bank_name=$1, account_number=$2, account_name=$3, promptpay_id=$4, is_primary=$5
       WHERE bank_account_id=$6 RETURNING *`,
      [bank_name, account_number, account_name, promptpay_id || null, is_primary ?? false, id]
    );
    await client.query('COMMIT');
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    if (client) await rollbackQuietly(client);
    console.error('Update bank account error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client?.release();
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

// คอลัมน์ของ resort_info ที่ endpoint สาธารณะส่งออกได้ (ไม่ใช้ SELECT * เพื่อไม่ให้ข้อมูลอื่นรั่ว)
const RESORT_PUBLIC_COLUMNS =
  'id, name, address, coordinates, phone, email, facebook, line_id, operating_days, operating_hours, additional_terms, payment_due_days, bank_account_no, bank_account_name, promptpay_id, facilities, checkin_time_from, checkin_time_to, checkout_time, important_info, kids_policy, parking_info, infant_max_age_exclusive';

// ─── Resort Info (รวม contact + site info ใน table resort_info) ────────────────

// ─── Resort Info (รวม contact + site info ใน table resort_info) ────────────────

export const getResortInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, name } = req.query;

    // 1. ถ้าส่ง ?id=4 หรือ ?id=5 มา
    if (id) {
      const result = await pool.query(`SELECT ${RESORT_PUBLIC_COLUMNS} FROM resort_info WHERE id = $1 LIMIT 1`, [id]);
      res.json({ success: true, data: result.rows[0] || null });
      return;
    }

    // 2. ถ้าส่ง ?name=ห้องพัก มา
    if (name) {
      const result = await pool.query(
        `SELECT ${RESORT_PUBLIC_COLUMNS} FROM resort_info WHERE name LIKE $1 LIMIT 1`,
        [`%${name}%`]
      );
      res.json({ success: true, data: result.rows[0] || null });
      return;
    }

    // 3. ถ้าไม่ระบุ ให้คืนค่าทุกแถว (สถานที่หลัก=3, ห้องพัก=4, เรือ=5)
    const result = await pool.query(`SELECT ${RESORT_PUBLIC_COLUMNS} FROM resort_info ORDER BY id ASC`);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get resort info error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const upsertResortInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const role = (req as AuthRequest).user?.role;
    const isAdmin = role === 'admin';
    const staffTargetId = role === 'room_staff' ? 4 : role === 'boat_staff' ? 5 : null;
    if (!isAdmin && staffTargetId === null) {
      res.status(403).json({ success: false, message: 'Forbidden' });
      return;
    }
    const rawId = req.params.id ?? req.body.id;
    let targetId: number | null = null;
    if (rawId !== undefined && rawId !== null && rawId !== '') {
      targetId = parsePositiveInt(rawId);
      if (targetId === null) {
        res.status(400).json({ success: false, message: 'Invalid id' });
        return;
      }
    }
    const targetName = typeof req.body.name === 'string' ? req.body.name : '';

    // Staff are scoped by role; editable names never select another resort row.
    if (!isAdmin) {
      if (targetId !== null && targetId !== staffTargetId) {
        res.status(403).json({ success: false, message: 'ไม่มีสิทธิ์แก้ไขจุดบริการนี้' });
        return;
      }
      targetId = staffTargetId;
    }

    // Preserve legacy admin name mapping when no explicit row was supplied.
    if (!targetId) {
      if (!targetName) {
        targetId = 3;
      } else if (targetName.includes('ห้อง') || targetName.includes('room')) {
        targetId = 4; // ID จุดบริการห้องพัก
      } else if (targetName.includes('เรือ') || targetName.includes('boat')) {
        targetId = 5; // ID จุดบริการเรือ
      } else {
        targetId = 3; // ID สถานที่หลัก
      }
    }

    if (![3, 4, 5].includes(targetId)) {
      res.status(400).json({ success: false, message: 'Invalid resort id' });
      return;
    }

    if (req.body.infant_max_age_exclusive !== undefined) {
      if (!isAdmin) {
        res.status(403).json({ success: false, message: 'เฉพาะผู้ดูแลระบบที่แก้ไขเกณฑ์อายุเด็กเล็กได้' });
        return;
      }
      const rawAge = req.body.infant_max_age_exclusive;
      const age = typeof rawAge === 'number' || (typeof rawAge === 'string' && /^\d+$/.test(rawAge))
        ? Number(rawAge) : NaN;
      if (targetId !== 3 || !Number.isInteger(age) || age < 0 || age > 18) {
        res.status(400).json({ success: false, message: 'เกณฑ์อายุเด็กเล็กต้องเป็นจำนวนเต็ม 0–18 และกำหนดที่สถานที่หลักเท่านั้น' });
        return;
      }
    }

    const allowed = [
      'name', 'address', 'coordinates', 'phone', 'email', 'facebook', 'line_id',
      'operating_days', 'operating_hours', 'additional_terms', 'payment_due_days',
      'promptpay_id', 'bank_account_no', 'bank_account_name',
      'checkin_time_from', 'checkin_time_to', 'checkout_time', 'important_info', 'kids_policy', 'parking_info', 'infant_max_age_exclusive',
    ];

    const updates: { col: string; val: unknown }[] = [];
    for (const col of allowed) {
      if (req.body[col] === undefined) continue;
      if (!isAdmin && ADMIN_ONLY_RESORT_FIELDS.includes(col)) continue;
      // ค่าว่างเป็น NULL ตามเดิม แต่ค่าตัวเลข 0 และ false ต้องคงไว้
      const raw = req.body[col];
      updates.push({ col, val: col === 'infant_max_age_exclusive' ? Number(raw) : raw === '' ? null : (raw ?? null) });
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
    const { day_of_week, open_time, close_time, is_open, advance_booking_minutes } = req.body;
    const advanceMin = advance_booking_minutes != null ? Number(advance_booking_minutes) : 60;
    const existing = await pool.query(
      `SELECT id FROM boat_operating_hours WHERE day_of_week = $1`, [day_of_week]
    );
    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE boat_operating_hours
         SET open_time=$1, close_time=$2, is_open=$3, advance_booking_minutes=$4
         WHERE day_of_week=$5 RETURNING *`,
        [open_time, close_time, is_open ?? true, advanceMin, day_of_week]
      );
    } else {
      result = await pool.query(
        `INSERT INTO boat_operating_hours (day_of_week, open_time, close_time, is_open, advance_booking_minutes)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [day_of_week, open_time, close_time, is_open ?? true, advanceMin]
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

    // ตรวจค่าก่อนนำไปใช้ใน SQL: date = YYYY-MM-DD, year/month = จำนวนเต็มในช่วงที่สมเหตุสมผล
    const dateProvided = date !== undefined && date !== '';
    if (dateProvided && (typeof date !== 'string' || !isValidIsoDate(date))) {
      res.status(400).json({ success: false, message: 'date ต้องเป็นวันที่รูปแบบ YYYY-MM-DD' });
      return;
    }
    const yearParam = parseQueryInt(year, 1970, 2100);
    const monthParam = parseQueryInt(month, 1, 12);
    if (yearParam === null || monthParam === null) {
      res.status(400).json({ success: false, message: 'year และ month ต้องเป็นจำนวนเต็มที่อยู่ในช่วงที่ถูกต้อง' });
      return;
    }

    const summaryParams: any[] = [];
    const chartParams: any[] = [];
    let whereClause = '';
    let chartWhereClause = '';

    if (period === 'day' && typeof date === 'string' && date) {
      summaryParams.push(date);
      whereClause = `WHERE DATE(created_at) = $1`;
    } else {
      const y = (period === 'month' && yearParam !== undefined) ? yearParam : new Date().getFullYear();
      const m = (period === 'month' && monthParam !== undefined) ? monthParam : new Date().getMonth() + 1;
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

// นโยบายคืนเงินบัตรเสริมที่ชำระแล้ว: คืนเต็มจำนวนถ้ายกเลิกก่อนเข้าพัก full_refund_hours ชั่วโมง ที่เหลือคืน late_refund_percent
export const getCancellationPolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT full_refund_hours, late_refund_percent, updated_at FROM cancellation_policies WHERE id = 1`
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Get cancellation policy error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const upsertCancellationPolicy = async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as Record<string, unknown>;
    const result = await pool.query(
      `INSERT INTO cancellation_policies (id, full_refund_hours, late_refund_percent, updated_at)
       VALUES (1, $1, $2, NOW())
       ON CONFLICT (id) DO UPDATE
         SET full_refund_hours = EXCLUDED.full_refund_hours,
             late_refund_percent = EXCLUDED.late_refund_percent,
             updated_at = NOW()
       RETURNING full_refund_hours, late_refund_percent, updated_at`,
      [Number(body.full_refund_hours), Number(body.late_refund_percent)]
    );
    res.json({ success: true, message: 'บันทึกนโยบายการคืนเงินสำเร็จ', data: result.rows[0] });
  } catch (error) {
    console.error('Upsert cancellation policy error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
