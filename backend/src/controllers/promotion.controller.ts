import { Request, Response } from 'express';
import pool from '../config/database';
import { AuthPayload } from '../types';
import { AuthRequest } from '../middleware/auth.middleware';
import {
  PromoApplyError,
  applyPromotionList,
  isPromoInWindow,
  parseAppliesTo,
  parseBookingScope,
  parsePromotionIds,
} from '../services/promotion-apply';
import { loadApplyContext, loadPromosForApply } from '../services/promotion-ledger';
import { mapDbError } from '../utils/db-errors';
import { parsePositiveInt } from '../utils/ids';

function requireCustomer(req: Request, res: Response): AuthPayload | null {
  const user = (req as AuthRequest).user;
  if (!user || user.role !== 'customer') {
    res.status(403).json({ success: false, message: 'Forbidden' });
    return null;
  }
  return user;
}

export const getActivePromotions = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;
    const memberId = user?.role === 'customer' ? user.id : 0;
    const result = await pool.query(
      `SELECT p.id, p.code, p.name, p.description, p.discount_type, p.discount_value,
              p.min_nights, p.min_price, p.max_discount, p.start_date, p.end_date,
              p.usage_limit, p.usage_count, p.is_active,
              p.usage_limit_per_member, p.is_collectible, p.stackable, p.applies_to, p.boat_ticket_count, p.boat_addon_mode, p.boat_addon_price,
              p.room_type_id, p.room_count,
              (SELECT COUNT(*)::int FROM booking_promotions bp
               WHERE bp.promotion_id=p.id AND bp.member_id=$1) AS member_usage_count,
              mp.status AS wallet_status
       FROM promotions p
       LEFT JOIN member_promotions mp
         ON mp.promotion_id = p.id AND mp.member_id = $1
       WHERE p.is_active = true
         AND (p.start_date IS NULL OR p.start_date <= (now() AT TIME ZONE 'Asia/Bangkok')::date)
         AND (p.end_date IS NULL OR p.end_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date)
         AND (p.usage_limit IS NULL OR p.usage_count < p.usage_limit)
       ORDER BY p.is_collectible DESC, p.created_at DESC`,
      [memberId]
    );
    res.json({ success: true, data: result.rows.map((row) => ({ ...row, wallet_remaining: row.usage_limit_per_member == null ? null : Math.max(0, Number(row.usage_limit_per_member) - Number(row.member_usage_count ?? 0)) })) });
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
              room_type_id, room_count, boat_ticket_count, boat_addon_mode, boat_addon_price,
              usage_limit_per_member, is_collectible, stackable, applies_to
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
           AND (start_date IS NULL OR start_date <= (now() AT TIME ZONE 'Asia/Bangkok')::date)
           AND (end_date IS NULL OR end_date >= (now() AT TIME ZONE 'Asia/Bangkok')::date)
           AND (usage_limit IS NULL OR usage_count < usage_limit)`,
        [code]
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
    if (catalog.some((promo) => !promo.is_active)) {
      res.status(400).json({
        success: false,
        message: 'โปรโมชั่นนี้ปิดใช้งานแล้ว',
      });
      return;
    }
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
      scope: parseBookingScope(body.scope),
      roomTypeIds: Array.isArray(body.room_type_ids) ? body.room_type_ids.map(Number) : body.room_type_id != null ? [Number(body.room_type_id)] : undefined,
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
    const id = parsePositiveInt(req.params.id);
    if (id == null) {
      res.status(400).json({ success: false, message: 'รหัสโปรโมชั่นไม่ถูกต้อง' });
      return;
    }
    // ลบใน statement เดียวพร้อมเงื่อนไข NOT EXISTS (กัน race ระหว่างเช็คการใช้งานกับการลบ)
    const removed = await pool.query(
      `DELETE FROM member_promotions mp
       WHERE mp.member_id = $1 AND mp.promotion_id = $2
         AND NOT EXISTS (
           SELECT 1 FROM booking_promotions bp
           WHERE bp.member_id = mp.member_id AND bp.promotion_id = mp.promotion_id
         )
       RETURNING mp.member_promotion_id`,
      [user.id, id]
    );
    if ((removed.rowCount ?? 0) === 0) {
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
    }
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
    const result = await pool.query(
      `SELECT mp.member_promotion_id, mp.promotion_id, mp.status, mp.saved_at, mp.used_at,
              p.code, p.name, p.description, p.discount_type, p.discount_value,
              p.is_active, p.start_date, p.end_date, p.usage_limit_per_member,
              p.is_collectible, p.stackable, p.applies_to, p.min_nights, p.max_discount, p.boat_ticket_count, p.boat_addon_mode, p.boat_addon_price,
              (p.end_date IS NOT NULL AND p.end_date < (now() AT TIME ZONE 'Asia/Bangkok')::date) AS end_passed,
              (SELECT COUNT(*)::int FROM booking_promotions bp
               WHERE bp.member_id = mp.member_id AND bp.promotion_id = mp.promotion_id) AS used_count
       FROM member_promotions mp
       JOIN promotions p ON p.id = mp.promotion_id
       WHERE mp.member_id = $1
       ORDER BY mp.saved_at DESC`,
      [user.id]
    );
    const data = result.rows.map((row) => {
      const catalogExpired = !row.is_active || row.end_passed === true;
      const usedCount = Number(row.used_count);
      const limit =
        row.usage_limit_per_member == null
          ? null
          : Number(row.usage_limit_per_member);
      const remaining = limit == null ? null : Math.max(0, limit - usedCount);
      const status = catalogExpired || row.status === 'expired' ? 'expired' : (remaining == null || remaining > 0 ? 'saved' : 'used');
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

// บัตรพายเรือฟรีที่ได้จากโปรโมชั่นห้องพัก (promotions.boat_ticket_count) — ใช้ตอนจองเรือ
export const getMyBoatTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireCustomer(req, res);
    if (!user) return;
    const result = await pool.query(
      `SELECT mbt.id, mbt.total_tickets, mbt.used_tickets, mbt.created_at,
              p.code AS promotion_code, p.name AS promotion_name,
              rb.room_booking_id
       FROM member_boat_tickets mbt
       LEFT JOIN promotions p ON p.id = mbt.promotion_id
       LEFT JOIN room_bookings rb ON rb.room_booking_id = mbt.room_booking_id
       WHERE mbt.member_id = $1 AND mbt.total_tickets > mbt.used_tickets
       ORDER BY mbt.created_at ASC`,
      [user.id]
    );
    const grants = result.rows.map((row) => ({
      ...row,
      remaining: Number(row.total_tickets) - Number(row.used_tickets),
    }));
    const totalRemaining = grants.reduce((sum, g) => sum + g.remaining, 0);
    res.json({ success: true, data: { total_remaining: totalRemaining, grants } });
  } catch (error) {
    console.error('Get my boat tickets error:', error);
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

// กติกาความสมเหตุสมผลของโปรโมชั่น ใช้ทั้งตอนสร้างและแก้ไข — คืนข้อความ error หรือ null เมื่อผ่าน
function promoRuleError(rule: {
  start: string | null;
  end: string | null;
  usageLimit: number | null;
  perMember: number | null;
  addonMode: 'free' | 'paid';
  addonPrice: number | null;
}): string | null {
  if (rule.start && rule.end && rule.start > rule.end) {
    return 'วันเริ่มต้องไม่อยู่หลังวันสิ้นสุด';
  }
  if (rule.usageLimit != null && rule.perMember != null && rule.perMember > rule.usageLimit) {
    return 'จำกัดต่อสมาชิกต้องไม่มากกว่าจำกัดจำนวนรวม';
  }
  if (rule.addonMode === 'paid' && !(rule.addonPrice != null && rule.addonPrice > 0)) {
    return 'บัตรเสริมแบบขายต้องระบุราคาต่อครั้งมากกว่า 0 บาท';
  }
  return null;
}

export const createPromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      code, name, description, discount_type, discount_value,
      min_nights, min_price, max_discount, start_date, end_date,
      usage_limit, is_active, room_type_id, room_count, boat_ticket_count,
      usage_limit_per_member, is_collectible, stackable, applies_to,
      boat_addon_mode, boat_addon_price,
    } = req.body;

    if (typeof code !== 'string' || !code.trim()) {
      res.status(400).json({ success: false, message: 'กรุณาระบุรหัสโค้ดโปรโมชั่น' });
      return;
    }
    const discountValue = Number(discount_value);
    if (discount_type !== 'percent' && discount_type !== 'fixed') {
      res.status(400).json({ success: false, message: 'ประเภทส่วนลดต้องเป็น percent หรือ fixed' });
      return;
    }
    if (!(discountValue > 0)) {
      res.status(400).json({ success: false, message: 'ส่วนลดต้องเป็นตัวเลขมากกว่า 0' });
      return;
    }
    if (discount_type === 'percent' && discountValue > 100) {
      res.status(400).json({ success: false, message: 'ส่วนลดเป็นเปอร์เซ็นต์ต้องไม่เกิน 100' });
      return;
    }
    const ruleError = promoRuleError({
      start: start_date ? String(start_date).slice(0, 10) : null,
      end: end_date ? String(end_date).slice(0, 10) : null,
      usageLimit: usage_limit ? Number(usage_limit) : null,
      perMember: usage_limit_per_member ? Number(usage_limit_per_member) : null,
      addonMode: boat_addon_mode === 'paid' ? 'paid' : 'free',
      addonPrice: boat_addon_price != null && boat_addon_price !== '' ? Number(boat_addon_price) : null,
    });
    if (ruleError) {
      res.status(400).json({ success: false, message: ruleError });
      return;
    }
    const existing = await pool.query('SELECT id FROM promotions WHERE UPPER(code) = UPPER($1)', [code]);
    if (existing.rows.length > 0) {
      res.status(409).json({ success: false, message: 'โค้ดโปรโมชั่นนี้มีในระบบแล้ว' });
      return;
    }

    const result = await pool.query(
      `INSERT INTO promotions (code, name, description, discount_type, discount_value,
                               min_nights, min_price, max_discount, start_date, end_date,
                               usage_limit, is_active, room_type_id, room_count, boat_ticket_count,
                               usage_limit_per_member, is_collectible, stackable, applies_to,
                               boat_addon_mode, boat_addon_price)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
       RETURNING *`,
      [
        code.toUpperCase().trim(), name, description || null,
        discount_type, discountValue,
        min_nights || null, min_price || null, max_discount || null,
        start_date || null, end_date || null,
        usage_limit || null, is_active !== false,
        room_type_id || null, room_count || 1, boat_ticket_count || 0,
        usage_limit_per_member || null,
        true, // ทุกโปรต้องเก็บก่อนใช้
        stackable === true,
        parseAppliesTo(applies_to),
        boat_addon_mode === 'paid' ? 'paid' : 'free',
        boat_addon_price || null,
      ]
    );

    res.status(201).json({ success: true, message: 'สร้างโปรโมชั่นสำเร็จ', data: result.rows[0] });
  } catch (error) {
    console.error('Create promotion error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const updatePromotion = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const body = req.body as Record<string, unknown>;

    const currentRes = await pool.query('SELECT * FROM promotions WHERE id = $1', [id]);
    if (currentRes.rows.length === 0) {
      res.status(404).json({ success: false, message: 'Promotion not found' });
      return;
    }
    const current = currentRes.rows[0] as Record<string, unknown>;

    // ฟิลด์ที่ไม่ได้ส่งมาใช้ค่าเดิม (ส่ง null มาเพื่อล้างค่าได้) ไม่เขียนทับฟิลด์อื่นเป็น NULL
    const has = (key: string): boolean => Object.prototype.hasOwnProperty.call(body, key);
    const numOrCurrent = (key: string, fallback: number | null = null): number | null => {
      if (!has(key)) return current[key] == null ? null : Number(current[key]);
      const raw = body[key];
      if (raw === null || raw === undefined || raw === '') return fallback;
      return Number(raw);
    };
    const textOrCurrent = (key: string): string | null => {
      if (!has(key)) return current[key] == null ? null : String(current[key]);
      const raw = body[key];
      return raw === null || raw === undefined || raw === '' ? null : String(raw);
    };
    const boolOrCurrent = (key: string): boolean => {
      if (!has(key)) return current[key] === true;
      return body[key] === true || body[key] === 'true';
    };

    const code = has('code') && typeof body.code === 'string' && body.code.trim()
      ? body.code.toUpperCase().trim()
      : String(current.code);
    const name = has('name') && body.name ? String(body.name) : String(current.name);
    const discountType = has('discount_type') ? String(body.discount_type) : String(current.discount_type);
    const discountValue = numOrCurrent('discount_value') ?? 0;
    if (!['percent', 'fixed'].includes(discountType)) {
      res.status(400).json({ success: false, message: 'discount_type must be percent or fixed' });
      return;
    }
    if (!(discountValue > 0)) {
      res.status(400).json({ success: false, message: 'discount_value must be a positive number' });
      return;
    }
    if (discountType === 'percent' && discountValue > 100) {
      res.status(400).json({ success: false, message: 'ส่วนลดเป็นเปอร์เซ็นต์ต้องไม่เกิน 100' });
      return;
    }
    const ruleError = promoRuleError({
      start: textOrCurrent('start_date')?.slice(0, 10) ?? null,
      end: textOrCurrent('end_date')?.slice(0, 10) ?? null,
      usageLimit: numOrCurrent('usage_limit'),
      perMember: numOrCurrent('usage_limit_per_member'),
      addonMode: (has('boat_addon_mode') ? body.boat_addon_mode : current.boat_addon_mode) === 'paid' ? 'paid' : 'free',
      addonPrice: numOrCurrent('boat_addon_price'),
    });
    if (ruleError) {
      res.status(400).json({ success: false, message: ruleError });
      return;
    }

    if (has('code') && typeof body.code === 'string') {
      const existing = await pool.query(
        'SELECT id FROM promotions WHERE UPPER(code) = UPPER($1) AND id != $2',
        [code, id]
      );
      if (existing.rows.length > 0) {
        res.status(409).json({ success: false, message: 'โค้ดโปรโมชั่นนี้มีในระบบแล้ว' });
        return;
      }
    }

    const appliesTo = parseAppliesTo(has('applies_to') ? body.applies_to : current.applies_to);
    const boatAddonMode = (has('boat_addon_mode') ? body.boat_addon_mode : current.boat_addon_mode) === 'paid' ? 'paid' : 'free';

    const result = await pool.query(
      `UPDATE promotions SET
         code = $1, name = $2, description = $3, discount_type = $4, discount_value = $5,
         min_nights = $6, min_price = $7, max_discount = $8, start_date = $9, end_date = $10,
         usage_limit = $11, is_active = $12, room_type_id = $13, room_count = $14,
         boat_ticket_count = $15, usage_limit_per_member = $16, is_collectible = $17,
         stackable = $18, applies_to = $19, boat_addon_mode = $20, boat_addon_price = $21,
         updated_at = NOW()
       WHERE id = $22
       RETURNING *`,
      [
        code,
        name,
        textOrCurrent('description'),
        discountType,
        discountValue,
        numOrCurrent('min_nights'),
        numOrCurrent('min_price'),
        numOrCurrent('max_discount'),
        has('start_date') ? (body.start_date || null) : current.start_date,
        has('end_date') ? (body.end_date || null) : current.end_date,
        numOrCurrent('usage_limit'),
        has('is_active') ? (body.is_active === true || body.is_active === 'true') : current.is_active,
        numOrCurrent('room_type_id'),
        numOrCurrent('room_count', 1),
        numOrCurrent('boat_ticket_count', 0),
        numOrCurrent('usage_limit_per_member'),
        true, // ทุกโปรต้องเก็บก่อนใช้
        boolOrCurrent('stackable'),
        appliesTo,
        boatAddonMode,
        numOrCurrent('boat_addon_price'),
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
    const id = parsePositiveInt(req.params.id);
    if (id == null) {
      res.status(400).json({ success: false, message: 'รหัสโปรโมชั่นไม่ถูกต้อง' });
      return;
    }

    // ลบเฉพาะเมื่อยังไม่เคยถูกใช้ ใน statement เดียว (กัน race และกัน FK 23503 จาก booking ledger)
    const deleted = await pool.query(
      `DELETE FROM promotions
       WHERE id = $1 AND usage_count = 0
         AND NOT EXISTS (SELECT 1 FROM booking_promotions bp WHERE bp.promotion_id = $1)
         AND NOT EXISTS (SELECT 1 FROM booking_room_promotions brp WHERE brp.promotion_id = $1)
       RETURNING id`,
      [id]
    );
    if ((deleted.rowCount ?? 0) > 0) {
      res.json({ success: true, message: 'ลบแพ็คเกจสำเร็จ' });
      return;
    }

    const exists = await pool.query('SELECT usage_count FROM promotions WHERE id = $1', [id]);
    if (exists.rows.length === 0) {
      res.status(404).json({ success: false, message: 'ไม่พบข้อมูลโปรโมชั่น' });
      return;
    }
    res.status(400).json({
      success: false,
      message: 'ไม่สามารถลบได้ เนื่องจากแพ็คเกจ/โปรโมชั่นนี้เคยถูกใช้งานแล้ว',
    });
  } catch (error) {
    console.error('Delete promotion error:', error);
    const mapped = mapDbError(error);
    if (mapped) {
      res.status(mapped.status).json({ success: false, message: mapped.message });
      return;
    }
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

// การตั้งค่าการรับอีเมลแจ้งเตือนโปรโมชั่นของลูกค้า
export const getPromoEmailPreference = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireCustomer(req, res);
    if (!user) return;
    const result = await pool.query(
      'SELECT promo_email_opt_out FROM members WHERE member_id = $1',
      [user.id]
    );
    if (result.rows.length === 0) {
      res.status(404).json({ success: false, message: 'ไม่พบข้อมูลสมาชิก' });
      return;
    }
    res.json({ success: true, data: { opt_out: result.rows[0].promo_email_opt_out === true } });
  } catch (error) {
    console.error('Get promo email preference error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const setPromoEmailPreference = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = requireCustomer(req, res);
    if (!user) return;
    const optOut = req.body.opt_out === true || req.body.opt_out === 'true';
    await pool.query(
      'UPDATE members SET promo_email_opt_out = $1, updated_at = NOW() WHERE member_id = $2',
      [optOut, user.id]
    );
    res.json({
      success: true,
      message: optOut ? 'ปิดการรับอีเมลแจ้งเตือนโปรโมชั่นแล้ว' : 'เปิดการรับอีเมลแจ้งเตือนโปรโมชั่นแล้ว',
      data: { opt_out: optOut },
    });
  } catch (error) {
    console.error('Set promo email preference error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};
