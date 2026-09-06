import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthPayload } from '../types';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  PromoApplyError,
  applyPromotionList,
  isPromoInWindow,
  parsePromotionIds,
} from '../services/promotion-apply';
import { loadApplyContext, loadPromosForApply } from '../services/promotion-ledger';

function requireCustomer(req: Request, res: Response): AuthPayload | null {
  const user = (req as AuthRequest).user;
  if (!user || user.role !== 'customer') {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return null;
  }
  return user;
}

function catalogDay(now: Date): string {
  return now.toISOString();
}

export const getActivePromotions = async (req: Request, res: Response): Promise<void> => {
  try {
    const now = catalogDay(new Date());
    const result = await pool.query(
      `SELECT id, code, name, description, discount_type, discount_value,
              min_nights, min_price, max_discount, start_date, end_date,
              usage_limit, usage_count, is_active,
              usage_limit_per_member, is_collectible, stackable
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

export const getAllPromotions = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, code, name, description, discount_type, discount_value,
              min_nights, min_price, max_discount, start_date, end_date,
              usage_limit, usage_count, is_active, created_at,
              room_type_id, room_count, boat_ticket_count,
              usage_limit_per_member, is_collectible, stackable
       FROM promotions
       ORDER BY created_at DESC`
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Get all promotions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const validatePromoCode = async (req: Request, res: Response): Promise<void> => {
  let ids: number[] = [];
  try {
    const body = req.body as Record<string, unknown>;
    ids = parsePromotionIds(body);
    const now = new Date();

    if (ids.length === 0) {
      const code = typeof body.code === 'string' ? body.code : '';
      const found = await pool.query(
        `SELECT id FROM promotions
         WHERE UPPER(code) = UPPER($1)
           AND is_active = true
           AND (start_date IS NULL OR start_date <= $2)
           AND (end_date IS NULL OR end_date >= $2)
           AND (usage_limit IS NULL OR usage_count < usage_limit)`,
        [code, now.toISOString()]
      );
      if (found.rows.length === 0) {
        res.status(404).json({
          success: false,
          message: 'โค้ดโปรโมชั่นไม่ถูกต้องหรือหมดอายุแล้ว',
        });
        return;
      }
      ids = [Number(found.rows[0].id)];
    }

    const catalog = await loadPromosForApply(pool, ids);
    const user = (req as AuthRequest).user;
    const memberId = user?.role === 'customer' ? user.id : 0;
    const ctxExtra =
      memberId > 0
        ? await loadApplyContext(pool, memberId, ids)
        : { memberUsedCountByPromoId: {}, walletsByPromoId: {} };

    const priceRaw = body.price;
    const nightsRaw = body.nights;
    const hasPrice = priceRaw != null && priceRaw !== '';
    const basePrice = hasPrice ? Number(priceRaw) : 0;
    const nights =
      nightsRaw != null && nightsRaw !== '' ? Number(nightsRaw) : null;

    const result = applyPromotionList(catalog, {
      memberId,
      nights,
      basePrice: hasPrice ? basePrice : 0,
      now,
      skipMinPrice: !hasPrice,
      ...ctxExtra,
    });

    const first = catalog[0];
    const discountAmount = hasPrice
      ? Math.round(basePrice - result.totalPrice)
      : 0;
    const lines = result.lines.map((line, index) => {
      const promo = catalog[index];
      return {
        id: line.promotion_id,
        code: promo?.code,
        name: promo?.name,
        discount_amount: hasPrice ? line.discount_amount : 0,
        is_collectible: promo?.is_collectible ?? false,
        stackable: promo?.stackable ?? false,
      };
    });

    res.json({
      success: true,
      data: {
        id: first?.id,
        code: first?.code,
        name: first?.name,
        description: first?.description ?? null,
        discount_type: first?.discount_type,
        discount_value: first?.discount_value,
        discount_amount: discountAmount,
        final_price: hasPrice ? result.totalPrice : null,
        lines,
        is_collectible: first?.is_collectible ?? false,
        stackable: catalog.every((p) => p.stackable) && catalog.length > 0,
      },
    });
  } catch (error) {
    if (error instanceof PromoApplyError) {
      const payload: { success: false; message: string; data?: { id: number; needs_collect: true } } = {
        success: false,
        message: error.message,
      };
      if (error.message === 'ต้องเก็บโค้ดนี้ก่อนใช้') {
        const firstId = ids[0];
        if (firstId != null) {
          payload.data = { id: firstId, needs_collect: true };
        }
      }
      res.status(400).json(payload);
      return;
    }
    console.error('Validate promo code error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const collectPromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireCustomer(req, res);
    if (!user) return;
    const id = Number(req.params.id);
    const catalog = await loadPromosForApply(pool, [id]);
    const promo = catalog[0];
    if (!promo) {
      res.status(404).json({ success: false, message: 'ไม่พบข้อมูลโปรโมชั่น' });
      return;
    }
    if (!promo.is_collectible) {
      res.status(409).json({
        success: false,
        message: 'โปรโมชั่นนี้ไม่ต้องเก็บโค้ด',
      });
      return;
    }
    if (!isPromoInWindow(promo, new Date())) {
      res.status(409).json({ success: false, message: 'โปรโมชั่นหมดอายุแล้ว' });
      return;
    }

    const inserted = await pool.query(
      `INSERT INTO member_promotions (member_id, promotion_id, status)
       VALUES ($1, $2, 'saved')
       ON CONFLICT (member_id, promotion_id) DO NOTHING
       RETURNING *`,
      [user.id, id]
    );
    if (inserted.rows.length > 0) {
      res.json({ success: true, message: 'เก็บโค้ดแล้ว', data: inserted.rows[0] });
      return;
    }
    const existing = await pool.query(
      `SELECT * FROM member_promotions
       WHERE member_id = $1 AND promotion_id = $2`,
      [user.id, id]
    );
    const row = existing.rows[0] as { status: string } | undefined;
    if (!row) {
      res.status(500).json({ success: false, message: 'Internal server error' });
      return;
    }
    if (row.status === 'used') {
      res.status(409).json({
        success: false,
        message: 'ใช้โค้ดนี้ครบจำนวนครั้งแล้ว',
      });
      return;
    }
    if (row.status === 'expired') {
      res.status(409).json({ success: false, message: 'โปรโมชั่นหมดอายุแล้ว' });
      return;
    }
    res.json({ success: true, message: 'เก็บโค้ดแล้ว', data: row });
  } catch (error) {
    if (error instanceof PromoApplyError) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    console.error('Collect promotion error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const uncollectPromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireCustomer(req, res);
    if (!user) return;
    const id = Number(req.params.id);
    const used = await pool.query(
      `SELECT 1 FROM booking_promotions
       WHERE member_id = $1 AND promotion_id = $2 LIMIT 1`,
      [user.id, id]
    );
    if (used.rows.length > 0) {
      res.status(400).json({
        success: false,
        message: 'ไม่สามารถลบโค้ดที่เคยใช้แล้วได้',
      });
      return;
    }
    await pool.query(
      `DELETE FROM member_promotions WHERE member_id = $1 AND promotion_id = $2`,
      [user.id, id]
    );
    res.json({ success: true, message: 'เอาโค้ดออกจากกระเป๋าแล้ว' });
  } catch (error) {
    console.error('Uncollect promotion error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getMyPromotions = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireCustomer(req, res);
    if (!user) return;
    const now = new Date();
    const result = await pool.query(
      `SELECT mp.member_promotion_id, mp.promotion_id, mp.status, mp.saved_at, mp.used_at,
              p.code, p.name, p.description, p.discount_type, p.discount_value,
              p.is_active, p.start_date, p.end_date, p.usage_limit_per_member,
              p.is_collectible, p.stackable,
              (SELECT COUNT(*)::int FROM booking_promotions bp
               WHERE bp.member_id = mp.member_id AND bp.promotion_id = mp.promotion_id) AS used_count
       FROM member_promotions mp
       JOIN promotions p ON p.id = mp.promotion_id
       WHERE mp.member_id = $1
       ORDER BY mp.saved_at DESC`,
      [user.id]
    );
    const data = result.rows.map((row) => {
      const catalogExpired =
        !row.is_active ||
        (row.end_date != null && new Date(row.end_date) < now);
      const usedCount = Number(row.used_count);
      const limit =
        row.usage_limit_per_member == null
          ? null
          : Number(row.usage_limit_per_member);
      const remaining = limit == null ? null : Math.max(0, limit - usedCount);
      const status = catalogExpired ? 'expired' : row.status;
      return {
        ...row,
        status,
        used_count: usedCount,
        remaining,
      };
    });
    res.json({ success: true, data });
  } catch (error) {
    console.error('Get my promotions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getPromotionRedemptions = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const id = Number(req.params.id);
    const wallet = await pool.query(
      `SELECT status, COUNT(*)::int AS n
       FROM member_promotions
       WHERE promotion_id = $1
       GROUP BY status`,
      [id]
    );
    const counts = { saved: 0, used: 0, expired: 0 };
    for (const row of wallet.rows as Array<{ status: keyof typeof counts; n: number }>) {
      if (row.status in counts) {
        counts[row.status] = Number(row.n);
      }
    }
    const ledger = await pool.query(
      `SELECT bp.booking_promotion_id, bp.promotion_id, bp.member_id,
              bp.room_booking_id, bp.boat_booking_id, bp.discount_amount, bp.created_at,
              m.email, m.first_name, m.last_name,
              CASE WHEN bp.room_booking_id IS NOT NULL THEN 'room' ELSE 'kayak' END AS booking_type,
              COALESCE(rb.status, bb.status) AS booking_status
       FROM booking_promotions bp
       JOIN members m ON m.member_id = bp.member_id
       LEFT JOIN room_bookings rb ON rb.room_booking_id = bp.room_booking_id
       LEFT JOIN boat_bookings bb ON bb.boat_booking_id = bp.boat_booking_id
       WHERE bp.promotion_id = $1
       ORDER BY bp.created_at DESC`,
      [id]
    );
    res.json({
      success: true,
      data: {
        wallet: counts,
        redemptions: ledger.rows,
      },
    });
  } catch (error) {
    console.error('Get promotion redemptions error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const createPromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      code, name, description, discount_type, discount_value,
      min_nights, min_price, max_discount, start_date, end_date,
      usage_limit, is_active, room_type_id, room_count, boat_ticket_count,
      usage_limit_per_member, is_collectible, stackable,
    } = req.body;

    const existing = await pool.query('SELECT id FROM promotions WHERE UPPER(code) = UPPER($1)', [code]);
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, message: 'โค้ดโปรโมชั่นนี้มีในระบบแล้ว' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO promotions (code, name, description, discount_type, discount_value,
                               min_nights, min_price, max_discount, start_date, end_date,
                               usage_limit, is_active, room_type_id, room_count, boat_ticket_count,
                               usage_limit_per_member, is_collectible, stackable)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING *`,
      [
        code.toUpperCase().trim(), name, description || null,
        discount_type, discount_value,
        min_nights || null, min_price || null, max_discount || null,
        start_date || null, end_date || null,
        usage_limit || null, is_active !== false,
        room_type_id || null, room_count || 1, boat_ticket_count || 0,
        usage_limit_per_member || null,
        is_collectible === true,
        stackable === true,
      ]
    );

    res.status(201).json({ success: true, message: 'สร้างโปรโมชั่นสำเร็จ', data: result.rows[0] });
  } catch (error) {
    console.error('Create promotion error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updatePromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      code, name, description, discount_type, discount_value,
      min_nights, min_price, max_discount, start_date, end_date,
      usage_limit, is_active, room_type_id, room_count, boat_ticket_count,
      usage_limit_per_member, is_collectible, stackable,
    } = req.body;

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
           usage_limit_per_member = $16,
           is_collectible = COALESCE($17, is_collectible),
           stackable = COALESCE($18, stackable),
           updated_at = NOW()
       WHERE id = $19
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
        usage_limit_per_member ?? null,
        is_collectible === undefined ? null : is_collectible === true,
        stackable === undefined ? null : stackable === true,
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

export const deletePromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const checkUsage = await pool.query('SELECT usage_count FROM promotions WHERE id = $1', [id]);
    if (checkUsage.rows.length === 0) {
      res.status(404).json({ success: false, message: 'ไม่พบข้อมูลโปรโมชั่น' });
      return;
    }

    if (checkUsage.rows[0].usage_count > 0) {
      res.status(400).json({
        success: false,
        message: 'ไม่สามารถลบได้ เนื่องจากแพ็คเกจ/โปรโมชั่นนี้เคยถูกใช้งานแล้ว',
      });
      return;
    }

    await pool.query('DELETE FROM promotions WHERE id = $1', [id]);
    res.json({ success: true, message: 'ลบแพ็คเกจสำเร็จ' });
  } catch (error) {
    console.error('Delete promotion error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

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
