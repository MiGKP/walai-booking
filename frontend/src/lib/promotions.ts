import { formatThaiDate, toISODate } from '@/lib/date';

export type PromoDiscountType = 'percent' | 'fixed';
export type WalletStatus = 'saved' | 'used' | 'expired';
export type PromoAppliesTo = 'room' | 'kayak' | 'both';
export type BookingPromoScope = 'room' | 'kayak';

export interface CatalogPromo {
  id: number;
  code: string;
  name: string;
  description: string | null;
  discount_type: PromoDiscountType;
  discount_value: number | string;
  min_nights: number | null;
  min_price: number | null;
  max_discount: number | null;
  boat_ticket_count?: number | null;
  boat_addon_mode?: "free" | "paid" | null;
  boat_addon_price?: number | null;
  start_date: string | null;
  end_date: string | null;
  is_collectible: boolean;
  stackable: boolean;
  applies_to?: PromoAppliesTo | string | null;
  wallet_status: WalletStatus | null;
}

export interface WalletPromo {
  promotion_id: number;
  code: string;
  name: string;
  description: string | null;
  discount_type: PromoDiscountType;
  discount_value: number | string;
  status: WalletStatus;
  remaining: number | null;
  stackable: boolean;
  applies_to?: PromoAppliesTo | string | null;
  start_date: string | null;
  end_date: string | null;
  min_nights?: number | null;
  max_discount?: number | null;
  boat_ticket_count?: number | null;
  boat_addon_mode?: "free" | "paid" | null;
  boat_addon_price?: number | null;
}

export function toIsoDay(value: string | null): string {
  if (!value) return '';
  if (value.includes('T')) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return toISODate(parsed);
  }
  return value;
}

export function formatPromoDiscount(
  type: CatalogPromo['discount_type'],
  value: number | string
): string {
  const num = Number(value);
  if (type === 'percent') {
    return `${num}%`;
  }
  return `฿${num.toLocaleString()}`;
}

export function formatPromoWindow(start: string | null, end: string | null): string {
  if (!start && !end) return 'ไม่มีวันหมดอายุ';
  const startStr = start ? formatThaiDate(toIsoDay(start)) : '';
  const endStr = end ? formatThaiDate(toIsoDay(end)) : '';
  if (start && end) return `${startStr} - ${endStr}`;
  if (start) return `ตั้งแต่ ${startStr}`;
  return `ถึง ${endStr}`;
}

export function bookingPromoHref(scope: BookingPromoScope, code: string): string {
  if (scope === 'kayak') {
    return `/kayaks?promo_code=${encodeURIComponent(code)}`;
  }
  return `/rooms?promo_code=${encodeURIComponent(code)}`;
}

export function parseAppliesTo(val?: string | null): PromoAppliesTo {
  if (val === 'room') return 'room';
  if (val === 'kayak') return 'kayak';
  return 'both';
}

export function promoAllowsScope(
  appliesTo: PromoAppliesTo,
  scope: BookingPromoScope
): boolean {
  return appliesTo === 'both' || appliesTo === scope;
}

export function appliesToLabel(appliesTo: PromoAppliesTo): string {
  if (appliesTo === 'room') return 'ห้องพักเท่านั้น';
  if (appliesTo === 'kayak') return 'เรือเท่านั้น';
  return 'ห้องพักและเรือ';
}

export function walletStatusLabel(status: WalletStatus): string {
  if (status === 'saved') return 'พร้อมใช้งาน';
  if (status === 'used') return 'ใช้แล้ว';
  return 'หมดอายุ';
}

// วันปัจจุบันตามเวลาไทย (YYYY-MM-DD) ให้ตรงกับที่ backend ใช้ตัดสินวันหมดอายุ
export function bangkokTodayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

// หมดอายุเมื่อผ่านวันสิ้นสุดตามเวลาไทยแล้ว (วันสิ้นสุดยังใช้ได้ทั้งวัน)
export function isPromoExpired(endDate: string | null | undefined): boolean {
  if (!endDate) return false;
  return toIsoDay(endDate) < bangkokTodayIso();
}

// จำนวนวันที่เหลือก่อนหมดอายุ (0 = วันนี้เป็นวันสุดท้าย) หรือ null ถ้าไม่มีวันหมดอายุ
export function promoDaysLeft(endDate: string | null | undefined): number | null {
  if (!endDate) return null;
  const end = new Date(`${toIsoDay(endDate)}T00:00:00+07:00`).getTime();
  const today = new Date(`${bangkokTodayIso()}T00:00:00+07:00`).getTime();
  return Math.round((end - today) / 86_400_000);
}

export const STACKING_NOTE =
  'ใช้หลายโค้ดพร้อมกันในการจองเดียวได้ เฉพาะเมื่อทุกโค้ดเปิดตัวเลือก "ใช้ร่วมโค้ดอื่นได้" เท่านั้น';
