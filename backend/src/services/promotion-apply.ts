// ข้อผิดพลาดเฉพาะสำหรับการตรวจสอบและคำนวณส่วนลดโปรโมชั่น
export class PromoApplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromoApplyError';
  }
}

export type PromoAppliesTo = 'room' | 'kayak' | 'both';
export type BookingPromoScope = 'room' | 'kayak';

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
  applies_to: PromoAppliesTo;
  room_type_id?: number | null;
  room_type_ids?: number[];
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
  scope?: BookingPromoScope;
  roomTypeIds?: number[];
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

// แปลงค่าเป็นจำนวนเต็มบวกหรือคืนค่า null หากไม่ถูกต้อง
function toPositiveInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

// แปลงค่าขอบเขตการใช้โปรโมชั่นให้เป็นชนิดข้อมูลที่ถูกต้อง
export function parseAppliesTo(value: unknown): PromoAppliesTo {
  if (value === 'room' || value === 'kayak' || value === 'both') return value;
  return 'both';
}

// แปลงค่าประเภทการจอง (room หรือ kayak) จากข้อมูลขาเข้า
export function parseBookingScope(value: unknown): BookingPromoScope | undefined {
  if (value === 'room' || value === 'kayak') return value;
  return undefined;
}

// ตรวจสอบว่าโปรโมชั่นสามารถใช้กับประเภทการจองที่ระบุได้หรือไม่
export function promoAllowsScope(
  appliesTo: PromoAppliesTo,
  scope: BookingPromoScope | undefined
): boolean {
  if (scope == null) return true;
  return appliesTo === 'both' || appliesTo === scope;
}

// คืนข้อความแจ้งข้อผิดพลาดเมื่อใช้คูปองผิดประเภทการจอง
export function promoScopeError(appliesTo: PromoAppliesTo): string {
  if (appliesTo === 'room') return 'คูปองนี้ใช้กับห้องพักเท่านั้น';
  if (appliesTo === 'kayak') return 'คูปองนี้ใช้กับเรือคายัคเท่านั้น';
  return 'คูปองนี้ใช้กับรายการนี้ไม่ได้';
}

// ดึงรหัสโปรโมชั่นทั้งหมดจาก request body
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

// แปลงเวลาเป็นวันที่ตามเวลาประเทศไทย (YYYY-MM-DD)
function bangkokDayKey(d: Date): string {
  return new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// แปลงค่าวันที่จากฐานข้อมูลเป็นรูปแบบ YYYY-MM-DD
function dateColumnDayKey(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const dd = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

// ตรวจสอบว่าโปรโมชั่นเปิดใช้งานอยู่ในช่วงวันที่กำหนดและยังมีสิทธิ์คงเหลือ
export function isPromoInWindow(promo: CatalogPromo, now: Date): boolean {
  if (!promo.is_active) return false;
  const today = bangkokDayKey(now);
  if (promo.start_date != null && dateColumnDayKey(promo.start_date) > today) return false;
  if (promo.end_date != null && dateColumnDayKey(promo.end_date) < today) return false;
  if (promo.usage_limit != null && promo.usage_count >= promo.usage_limit) return false;
  return true;
}

// คืนรหัสโปรโมชั่นสำหรับเก็บที่หัวบิลเมื่อใช้คูปองเพียงใบเดียว
export function headerPromotionId(ids: number[]): number | null {
  if (ids.length === 1) return ids[0];
  return null;
}

// ตรวจสอบว่าสถานะเดิมของบิลควรได้รับโควตาโปรโมชั่นคืนเมื่อยกเลิกหรือไม่
export function shouldRestoreQuota(previousStatus: string): boolean {
  return previousStatus === 'pending' || previousStatus === 'paid';
}

// คำนวณสถานะของคูปองในกระเป๋าหลังใช้งานตามจำนวนสิทธิ์ต่อสมาชิก
export function walletStatusAfterUse(
  limit: number | null,
  usedAfter: number
): 'saved' | 'used' {
  if (limit == null) return 'saved';
  return usedAfter >= limit ? 'used' : 'saved';
}

// คำนวณยอดส่วนลดและราคาคงเหลือของโปรโมชั่น 1 รายการ
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

// ตรวจสอบเงื่อนไขและคำนวณส่วนลดรวมสำหรับรายการโปรโมชั่นทั้งหมดที่เลือกใช้
export function applyPromotionList(
  promosInOrder: CatalogPromo[],
  ctx: ApplyContext
): ApplyResult {
  const ids = promosInOrder.map((p) => p.id);
  if (new Set(ids).size !== ids.length) {
    throw new PromoApplyError('ไม่สามารถใช้คูปองซ้ำในบิลเดียวกันได้');
  }
  if (promosInOrder.length > 1) {
    const allStackable = promosInOrder.every((p) => p.stackable);
    if (!allStackable) {
      throw new PromoApplyError('คูปองส่วนลดนี้ใช้ร่วมกับโปรโมชั่นอื่นไม่ได้');
    }
  }

  let remaining = ctx.basePrice;
  const lines: ApplyLine[] = [];

  const sortedPromos = [...promosInOrder].sort((a, b) => {
    if (a.discount_type !== b.discount_type) {
      return a.discount_type === 'fixed' ? -1 : 1;
    }
    return a.id - b.id;
  });

  for (const row of sortedPromos) {
    if (row.usage_limit != null && row.usage_count >= row.usage_limit) {
      throw new PromoApplyError('โปรโมชั่นนี้ถูกใช้ครบจำนวนแล้ว');
    }
    if (!row.is_active) {
      throw new PromoApplyError('โปรโมชั่นนี้ปิดใช้งานแล้ว');
    }
    if (row.start_date != null && dateColumnDayKey(row.start_date) > bangkokDayKey(ctx.now)) {
      throw new PromoApplyError('โปรโมชั่นยังไม่เริ่มใช้งาน');
    }
    if (!isPromoInWindow(row, ctx.now)) {
      throw new PromoApplyError('โปรโมชั่นหมดอายุแล้ว');
    }
    if (!promoAllowsScope(row.applies_to, ctx.scope)) {
      throw new PromoApplyError(promoScopeError(row.applies_to));
    }
    const allowedRoomTypeIds = (row.room_type_ids && row.room_type_ids.length > 0)
      ? row.room_type_ids
      : (row.room_type_id != null ? [Number(row.room_type_id)] : []);

    if (ctx.scope === 'room' && allowedRoomTypeIds.length > 0) {
      if (!ctx.roomTypeIds?.length || ctx.roomTypeIds.some((id) => !allowedRoomTypeIds.includes(Number(id)))) {
        throw new PromoApplyError('โปรโมชั่นนี้ใช้กับประเภทห้องที่กำหนดเท่านั้น');
      }
    }
    const wallet = ctx.walletsByPromoId[row.id];
    if (row.is_collectible) {
      if (wallet == null || wallet.status === 'expired') {
        throw new PromoApplyError('ต้องเก็บคูปองนี้ก่อนใช้');
      }
    }
    const used = ctx.memberUsedCountByPromoId[row.id] ?? 0;
    if (
      row.usage_limit_per_member != null &&
      used >= row.usage_limit_per_member
    ) {
      throw new PromoApplyError('ใช้คูปองนี้ครบจำนวนครั้งแล้ว');
    }
    const { discountAmount, nextTotal } = singleDiscount(
      ctx.skipMinPrice ? { ...row, min_price: null } : row,
      remaining,
      ctx.nights
    );
    remaining = nextTotal;
    lines.push({
      promotion_id: row.id,
      member_promotion_id: wallet?.member_promotion_id ?? null,
      discount_amount: discountAmount,
    });
  }

  return {
    totalPrice: remaining,
    lines,
    headerPromotionId: headerPromotionId(ids),
  };
}
