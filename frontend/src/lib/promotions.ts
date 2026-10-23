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
  boat_addon_mode?: 'free' | 'paid' | null;
  boat_addon_price?: number | null;
  start_date: string | null;
  end_date: string | null;
  is_collectible: boolean;
  stackable: boolean;
  applies_to?: PromoAppliesTo | string | null;
  room_type_id?: number | null;
  room_type_ids?: number[] | null;
  wallet_status: WalletStatus | null;
  wallet_remaining?: number | null;
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
  boat_addon_mode?: 'free' | 'paid' | null;
  boat_addon_price?: number | null;
}

export const STACKING_NOTE =
  'ใช้หลายคูปองพร้อมกันในการจองเดียวได้ เฉพาะเมื่อทุกคูปองเปิดตัวเลือก "ใช้ร่วมคูปองอื่นได้" เท่านั้น';

// แปลงสตริงวันที่หรือเวลาให้เป็นวันที่รูปแบบ YYYY-MM-DD
export function toIsoDay(value: string | null): string {
  if (!value) return '';
  if (value.includes('T')) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return toISODate(parsed);
  }
  return value;
}

// จัดรูปแบบข้อความแสดงมูลค่าส่วนลดของโปรโมชั่น
export function formatPromoDiscount(type: CatalogPromo['discount_type'], value: number | string): string {
  const num = Number(value);
  if (type === 'percent') {
    return `${num}%`;
  }
  return `฿${num.toLocaleString()}`;
}

// จัดรูปแบบข้อความแสดงช่วงวันที่สามารถใช้โปรโมชั่นได้
export function formatPromoWindow(start: string | null, end: string | null): string {
  if (!start && !end) return 'ไม่มีวันหมดอายุ';
  const startStr = start ? formatThaiDate(toIsoDay(start)) : '';
  const endStr = end ? formatThaiDate(toIsoDay(end)) : '';
  if (start && end) return `${startStr} - ${endStr}`;
  if (start) return `ตั้งแต่ ${startStr}`;
  return `ถึง ${endStr}`;
}

// สร้างลิงก์ไปยังหน้าจองพร้อมแนบรหัสโปรโมชั่น
export function bookingPromoHref(_scope: BookingPromoScope, code: string): string {
  return `/rooms?promo_code=${encodeURIComponent(code)}`;
}

// แปลงค่าขอบเขตการใช้โปรโมชั่นให้เป็นชนิดข้อมูลมาตรฐาน
export function parseAppliesTo(val?: string | null): PromoAppliesTo {
  if (val === 'room') return 'room';
  if (val === 'kayak') return 'kayak';
  return 'both';
}

// ตรวจสอบว่าโปรโมชั่นรองรับขอบเขตบริการที่เลือกหรือไม่
export function promoAllowsScope(appliesTo: PromoAppliesTo, scope: BookingPromoScope): boolean {
  return appliesTo === 'both' || appliesTo === scope;
}

// คืนค่าข้อความภาษาไทยแสดงขอบเขตบริการที่ใช้โปรโมชั่นได้
export function appliesToLabel(appliesTo: PromoAppliesTo): string {
  if (appliesTo === 'room') return 'ห้องพักเท่านั้น';
  if (appliesTo === 'kayak') return 'เรือเท่านั้น';
  return 'ห้องพักและเรือ';
}

// คืนค่าข้อความภาษาไทยแสดงสถานะของคูปองในกระเป๋า
export function walletStatusLabel(status: WalletStatus): string {
  if (status === 'saved') return 'พร้อมใช้งาน';
  if (status === 'used') return 'ใช้แล้ว';
  return 'หมดอายุ';
}

// คืนค่าวันที่ปัจจุบันตามเวลาไทยในรูปแบบ YYYY-MM-DD
export function bangkokTodayIso(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
}

// ตรวจสอบว่าโปรโมชั่นหมดอายุแล้วหรือยังตามเวลาประเทศไทย
export function isPromoExpired(endDate: string | null | undefined): boolean {
  if (!endDate) return false;
  return toIsoDay(endDate) < bangkokTodayIso();
}

// คำนวณจำนวนวันที่เหลือก่อนโปรโมชั่นหมดอายุ
export function promoDaysLeft(endDate: string | null | undefined): number | null {
  if (!endDate) return null;
  const end = new Date(`${toIsoDay(endDate)}T00:00:00+07:00`).getTime();
  const today = new Date(`${bangkokTodayIso()}T00:00:00+07:00`).getTime();
  return Math.round((end - today) / 86_400_000);
}

// ตรวจสอบว่าคูปองในกระเป๋ายังมีสิทธิ์คงเหลือพร้อมใช้งานหรือไม่
export function canUseWalletPromotion(status: WalletStatus | null | undefined, remaining?: number | null): boolean {
  if (status !== 'saved' && status !== 'used') return false;
  if (remaining === null) return true;
  if (remaining !== undefined) return Number(remaining) > 0;
  return status === 'saved';
}
