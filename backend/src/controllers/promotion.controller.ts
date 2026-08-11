import { Request, Response } from 'express';
import pool from '../config/database';

// ดึงรายการโปรโมชั่นทั้งหมดที่ยังใช้งานได้สำหรับฝั่งลูกค้า (is_active = true เท่านั้น)
export const getActivePromotions = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date().toISOString();
    const result = await pool.query(
      `SELECT id, code, name, description, discount_type, discount_value,
              min_nights, min_price, max_discount, start_date, end_date,
              usage_limit, usage_count, is_active
       FROM promotions
       WHERE is_active = true
         AND (start_date IS NULL OR start_date <= $1)
         AND (end_date IS NULL OR end_date >= $1)
         AND (usage_limit IS NULL OR usage_count < usage_limit)
       ORDER BY created_at DESC`,
      [now]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get active promotions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ดึงรายการโปรโมชั่นทั้งหมดสำหรับ Admin (รวมที่ปิดใช้งานแล้ว)
export const getAllPromotions = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, code, name, description, discount_type, discount_value,
              min_nights, min_price, max_discount, start_date, end_date,
              usage_limit, usage_count, is_active, created_at,
              room_type_id, room_count, boat_ticket_count
       FROM promotions
       ORDER BY created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get all promotions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ตรวจสอบโค้ดโปรโมชั่นและคำนวณส่วนลด
export const validatePromoCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, price, nights } = req.body;
    if (!code) {
      res.status(400).json({ success: false, message: 'Promotion code is required' });
      return;
    }

    const now = new Date().toISOString();
    const result = await pool.query(
      `SELECT * FROM promotions
       WHERE UPPER(code) = UPPER($1)
         AND is_active = true
         AND (start_date IS NULL OR start_date <= $2)
         AND (end_date IS NULL OR end_date >= $2)
         AND (usage_limit IS NULL OR usage_count < usage_limit)`,
      [code, now]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'โค้ดโปรโมชั่นไม่ถูกต้องหรือหมดอายุแล้ว' });
      return;
    }

    const promo = result.rows[0];

    // ตรวจสอบเงื่อนไขขั้นต่ำ
    if (promo.min_nights && nights && Number(nights) < Number(promo.min_nights)) {
      res.status(400).json({
        success: false,
        message: `โปรโมชั่นนี้ต้องจองขั้นต่ำ ${promo.min_nights} คืน`,
      });
      return;
    }
    if (promo.min_price && price && Number(price) < Number(promo.min_price)) {
      res.status(400).json({
        success: false,
        message: `โปรโมชั่นนี้ต้องมียอดขั้นต่ำ ฿${Number(promo.min_price).toLocaleString()}`,
      });
      return;
    }

    // คำนวณส่วนลด
    let discountAmount = 0;
    if (price) {
      const basePrice = Number(price);
      if (promo.discount_type === 'percent') {
        discountAmount = (basePrice * Number(promo.discount_value)) / 100;
        if (promo.max_discount) {
          discountAmount = Math.min(discountAmount, Number(promo.max_discount));
        }
      } else {
        discountAmount = Math.min(Number(promo.discount_value), basePrice);
      }
      discountAmount = Math.round(discountAmount);
    }

    res.json({
      success: true,
      data: {
        id: promo.id,
        code: promo.code,
        name: promo.name,
        description: promo.description,
        discount_type: promo.discount_type,
        discount_value: promo.discount_value,
        discount_amount: discountAmount,
        final_price: price ? Math.max(0, Number(price) - discountAmount) : null,
      },
    });
  } catch (error) {
    console.error('Validate promo code error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// สร้างโปรโมชั่นใหม่ (Admin only)
export const createPromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      code, name, description, discount_type, discount_value,
      min_nights, min_price, max_discount, start_date, end_date,
      usage_limit, is_active, room_type_id, room_count, boat_ticket_count
    } = req.body;

    // ตรวจสอบ code ซ้ำ
    const existing = await pool.query('SELECT id FROM promotions WHERE UPPER(code) = UPPER($1)', [code]);
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, message: 'โค้ดโปรโมชั่นนี้มีในระบบแล้ว' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO promotions (code, name, description, discount_type, discount_value,
                               min_nights, min_price, max_discount, start_date, end_date,
                               usage_limit, is_active, room_type_id, room_count, boat_ticket_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        code.toUpperCase().trim(), name, description || null,
        discount_type, discount_value,
        min_nights || null, min_price || null, max_discount || null,
        start_date || null, end_date || null,
        usage_limit || null, is_active !== false,
        room_type_id || null, room_count || 1, boat_ticket_count || 0
      ]
    );

    res.status(201).json({ success: true, message: 'สร้างโปรโมชั่นสำเร็จ', data: result.rows[0] });
  } catch (error) {
    console.error('Create promotion error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// อัปเดตโปรโมชั่น (Admin & Room Staff)
export const updatePromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      code, name, description, discount_type, discount_value,
      min_nights, min_price, max_discount, start_date, end_date,
      usage_limit, is_active, room_type_id, room_count, boat_ticket_count
    } = req.body;

    // ตรวจสอบ code ซ้ำ (ยกเว้น id ปัจจุบัน)
    if (code) {
      const existing = await pool.query(
        'SELECT id FROM promotions WHERE UPPER(code) = UPPER($1) AND id != $2',
        [code, id]
      );
      if (existing.rows.length > 0) {
        res.status(409).json({ success: false, message: 'โค้ดโปรโมชั่นนี้มีในระบบแล้ว' });
        return;
      }
    }

    const result = await pool.query(
      `UPDATE promotions
       SET code = COALESCE(UPPER($1), code),
           name = COALESCE($2, name),
           description = $3,
           discount_type = COALESCE($4, discount_type),
           discount_value = COALESCE($5, discount_value),
           min_nights = $6,
           min_price = $7,
           max_discount = $8,
           start_date = $9,
           end_date = $10,
           usage_limit = $11,
           is_active = COALESCE($12, is_active),
           room_type_id = $13,
           room_count = COALESCE($14, room_count),
           boat_ticket_count = COALESCE($15, boat_ticket_count),
           updated_at = NOW()
       WHERE id = $16
       RETURNING *`,
      [
        code?.toUpperCase().trim() || null,
        name || null,
        description || null,
        discount_type || null,
        discount_value || null,
        min_nights ?? null,
        min_price ?? null,
        max_discount ?? null,
        start_date || null,
        end_date || null,
        usage_limit ?? null,
        is_active !== undefined ? is_active : null,
        room_type_id ?? null,
        room_count ?? 1,
        boat_ticket_count ?? 0,
        id,
      ]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Promotion not found' });
      return;
    }

    res.json({ success: true, message: 'อัปเดตโปรโมชั่นสำเร็จ', data: result.rows[0] });
  } catch (error) {
    console.error('Update promotion error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// ลบโปรโมชั่น (Admin only)
export const deletePromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // 1. เช็คว่าถูกใช้งานไปแล้วหรือยัง[cite: 1, 2]
    const checkUsage = await pool.query('SELECT usage_count FROM promotions WHERE id = $1', [id]);
    if (checkUsage.rows.length === 0) {
      res.status(404).json({ success: false, message: 'ไม่พบข้อมูลโปรโมชั่น' });
      return;
    }

    if (checkUsage.rows[0].usage_count > 0) {
      res.status(400).json({ 
        success: false, 
        message: 'ไม่สามารถลบได้ เนื่องจากแพ็คเกจ/โปรโมชั่นนี้เคยถูกใช้งานแล้ว' 
      });
      return;
    }

    // 2. ถ้ายังไม่เคยถูกใช้งาน ให้ลบได้[cite: 1, 2]
    await pool.query('DELETE FROM promotions WHERE id = $1', [id]);
    res.json({ success: true, message: 'ลบแพ็คเกจสำเร็จ' });
  } catch (error) {
    console.error('Delete promotion error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// toggle สถานะ active/inactive
export const togglePromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE promotions SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = $1 RETURNING id, is_active`,
      [id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Promotion not found' });
      return;
    }
    const active = result.rows[0].is_active;
    res.json({ success: true, message: active ? 'เปิดใช้งานโปรโมชั่นแล้ว' : 'ปิดใช้งานโปรโมชั่นแล้ว', data: result.rows[0] });
  } catch (error) {
    console.error('Toggle promotion error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
