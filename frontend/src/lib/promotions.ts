import { formatThaiDate, toISODate } from '@/lib/date';

export type PromoDiscountType = 'percent' | 'fixed';
export type WalletStatus = 'saved' | 'used' | 'expired';

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
  start_date: string | null;
  end_date: string | null;
  is_collectible: boolean;
  stackable: boolean;
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
  start_date: string | null;
  end_date: string | null;
}

export function toIsoDay(value: string | null): string {
  if (!value) return '';
  if (value.includes('T')) {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return toISODate(parsed);
  }
  return value.slice(0, 10);
}

export function formatPromoDiscount(
  type: PromoDiscountType,
  value: number | string
): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '';
  if (type === 'percent') return `${amount}%`;
  return `฿${amount.toLocaleString('th-TH')}`;
}

export function formatPromoWindow(
  startDate: string | null,
  endDate: string | null
): string {
  const start = toIsoDay(startDate);
  const end = toIsoDay(endDate);
  if (start && end) return `${formatThaiDate(start)} – ${formatThaiDate(end)}`;
  if (end) return `ถึง ${formatThaiDate(end)}`;
  if (start) return `ตั้งแต่ ${formatThaiDate(start)}`;
  return 'ใช้ได้ตามเงื่อนไข';
}

export function walletStatusLabel(status: WalletStatus): string {
  if (status === 'used') return 'ใช้แล้ว';
  if (status === 'expired') return 'หมดอายุ';
  return 'พร้อมใช้';
}
