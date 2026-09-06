export class PromoApplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromoApplyError';
  }
}

export interface CatalogPromo {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  discount_type: 'percent' | 'fixed';
  usage_limit: number | null;
  usage_count: number;
  discount_value: number;
  min_nights: number | null;
  min_price: number | null;
  max_discount: number | null;
  is_active: boolean;
  start_date: string | Date | null;
  end_date: string | Date | null;
  usage_limit_per_member: number | null;
  is_collectible: boolean;
  stackable: boolean;
}

export interface WalletState {
  member_promotion_id: number;
  status: 'saved' | 'used' | 'expired';
}

export interface ApplyContext {
  memberId: number;
  nights: number | null;
  basePrice: number;
  now: Date;
  memberUsedCountByPromoId: Record<number, number>;
  walletsByPromoId: Record<number, WalletState | undefined>;
  skipMinPrice?: boolean;
}

export interface ApplyLine {
  promotion_id: number;
  member_promotion_id: number | null;
  discount_amount: number;
}

export interface ApplyResult {
  totalPrice: number;
  lines: ApplyLine[];
  headerPromotionId: number | null;
}

function toPositiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

export function parsePromotionIds(body: Record<string, unknown>): number[] {
  if (Array.isArray(body.promotion_ids)) {
    const ids: number[] = [];
    for (const raw of body.promotion_ids) {
      const id = toPositiveInt(raw);
      if (id != null) ids.push(id);
    }
    return ids;
  }
  const one = toPositiveInt(body.promotion_id);
  return one != null ? [one] : [];
}

function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function isPromoInWindow(promo: CatalogPromo, now: Date): boolean {
  if (!promo.is_active) return false;
  const day = startOfDay(now);
  if (promo.start_date != null && new Date(promo.start_date) > day) return false;
  if (promo.end_date != null && new Date(promo.end_date) < day) return false;
  if (promo.usage_limit != null && promo.usage_count >= promo.usage_limit) return false;
  return true;
}

export function headerPromotionId(ids: number[]): number | null {
  if (ids.length === 1) return ids[0];
  return null;
}

export function shouldRestoreQuota(previousStatus: string): boolean {
  return previousStatus === 'pending' || previousStatus === 'paid';
}

export function walletStatusAfterUse(
  limit: number | null,
  usedAfter: number
): 'saved' | 'used' {
  if (limit == null) return 'saved';
  return usedAfter >= limit ? 'used' : 'saved';
}

export function singleDiscount(
  promo: CatalogPromo,
  remaining: number,
  nights: number | null
): { discountAmount: number; nextTotal: number } {
  if (nights != null && promo.min_nights != null && nights < Number(promo.min_nights)) {
    throw new PromoApplyError(`โปรโมชั่นนี้ต้องจองขั้นต่ำ ${promo.min_nights} คืน`);
  }
  if (promo.min_price != null && remaining < Number(promo.min_price)) {
    throw new PromoApplyError(
      `โปรโมชั่นนี้ต้องมียอดขั้นต่ำ ฿${Number(promo.min_price).toLocaleString()}`
    );
  }
  let discountAmount = 0;
  if (promo.discount_type === 'percent') {
    discountAmount = (remaining * Number(promo.discount_value)) / 100;
    if (promo.max_discount != null) {
      discountAmount = Math.min(discountAmount, Number(promo.max_discount));
    }
  } else {
    discountAmount = Math.min(Number(promo.discount_value), remaining);
  }
  discountAmount = Math.round(discountAmount);
  const nextTotal = Math.max(0, remaining - discountAmount);
  return { discountAmount, nextTotal };
}

export function applyPromotionList(
  promosInOrder: CatalogPromo[],
  ctx: ApplyContext
): ApplyResult {
  const ids = promosInOrder.map((p) => p.id);
  if (new Set(ids).size !== ids.length) {
    throw new PromoApplyError('ไม่สามารถใช้โค้ดซ้ำในบิลเดียวกันได้');
  }
  if (promosInOrder.length > 1) {
    const allStackable = promosInOrder.every((p) => p.stackable);
    if (!allStackable) {
      throw new PromoApplyError('โค้ดนี้ใช้ร่วมกับโปรโมชั่นอื่นไม่ได้');
    }
  }

  let remaining = ctx.basePrice;
  const lines: ApplyLine[] = [];

  for (const row of promosInOrder) {
    if (!isPromoInWindow(row, ctx.now)) {
      throw new PromoApplyError('โปรโมชั่นหมดอายุแล้ว');
    }
    if (row.is_collectible) {
      const wallet = ctx.walletsByPromoId[row.id];
      if (wallet == null || wallet.status !== 'saved') {
        throw new PromoApplyError('ต้องเก็บโค้ดนี้ก่อนใช้');
      }
    }
    const used = ctx.memberUsedCountByPromoId[row.id] ?? 0;
    if (
      row.usage_limit_per_member != null &&
      used >= row.usage_limit_per_member
    ) {
      throw new PromoApplyError('ใช้โค้ดนี้ครบจำนวนครั้งแล้ว');
    }
    const { discountAmount, nextTotal } = singleDiscount(
      ctx.skipMinPrice ? { ...row, min_price: null } : row,
      remaining,
      ctx.nights
    );
    remaining = nextTotal;
    const wallet = ctx.walletsByPromoId[row.id];
    lines.push({
      promotion_id: row.id,
      member_promotion_id: row.is_collectible
        ? (wallet?.member_promotion_id ?? null)
        : null,
      discount_amount: discountAmount,
    });
  }

  return {
    totalPrice: remaining,
    lines,
    headerPromotionId: headerPromotionId(ids),
  };
}
