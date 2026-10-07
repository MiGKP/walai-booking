import { canUseWalletPromotion } from './promotions';

interface CheckoutCart {
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  child_ages?: number[];
  items?: unknown[];
}

export interface CheckoutPromotion {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number | string;
  min_nights?: number | null;
  min_price?: number | string | null;
  max_discount?: number | string | null;
  applies_to?: string | null;
  is_collectible?: boolean;
  wallet_status?: 'saved' | 'used' | 'expired' | null;
  wallet_remaining?: number | null;
  room_type_id?: number | null;
  room_count?: number | null;
  usage_limit_per_member?: number | null;
  member_usage_count?: number;
  boat_ticket_count?: number | null;
  boat_addon_mode?: 'free' | 'paid' | null;
  boat_addon_price?: number | string | null;
}

export interface CheckoutDetails {
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  childAges: number[];
}

export function resolveCheckoutDetails(params: URLSearchParams, cart: CheckoutCart | null): CheckoutDetails {
  const ages = params.get('child_ages');
  return {
    checkIn: params.get('check_in') || cart?.check_in || '',
    checkOut: params.get('check_out') || cart?.check_out || '',
    adults: Number(params.get('adults') ?? cart?.adults ?? 1),
    children: Number(params.get('children') ?? cart?.children ?? 0),
    childAges: ages === null ? cart?.child_ages ?? [] : ages === '' ? []
      : ages.split(',').map(age => age.trim() === '' ? NaN : Number(age)),
  };
}

export function eligibleRoomPromotion(promo: CheckoutPromotion, basePrice: number, nights: number, typeId?: number, roomCount?: number): boolean {
  return roomPromotionReasons(promo, basePrice, nights, typeId, roomCount).length === 0;
}

export function roomPromotionReasons(promo: CheckoutPromotion, basePrice: number, nights: number, typeId?: number, roomCount?: number): string[] {
  const reasons: string[] = [];
  if (promo.applies_to === 'kayak') reasons.push('ใช้ได้กับการจองเรือเท่านั้น');
  if (promo.min_nights != null && nights < Number(promo.min_nights)) reasons.push(`ต้องพักอย่างน้อย ${promo.min_nights} คืน`);
  if (promo.min_price != null && basePrice < Number(promo.min_price)) reasons.push(`ยอดค่าห้องขั้นต่ำ ฿${Number(promo.min_price).toLocaleString()}`);
  if (promo.room_type_id != null && typeId !== promo.room_type_id) reasons.push('ใช้ได้กับห้องประเภทอื่น');
  if (promo.room_count != null && roomCount != null && roomCount < promo.room_count) reasons.push(`ต้องจองอย่างน้อย ${promo.room_count} ห้อง`);
  if (promo.usage_limit_per_member != null && (promo.member_usage_count ?? 0) >= promo.usage_limit_per_member) reasons.push('ใช้ครบจำนวนครั้งต่อสมาชิกแล้ว');
  else if (promo.is_collectible && !canUseWalletPromotion(promo.wallet_status, promo.wallet_remaining)) reasons.push('ต้องเก็บคูปองที่หน้าโปรโมชั่นก่อน');
  return reasons;
}

export function roomPromotionLabel(promo: CheckoutPromotion): string {
  const benefits: string[] = [];
  if (Number(promo.discount_value) > 0) benefits.push(promo.discount_type === 'percent' ? `ลด ${Number(promo.discount_value)}%` : `ลด ฿${Number(promo.discount_value).toLocaleString()}`);
  if (Number(promo.boat_ticket_count) > 0) benefits.push(promo.boat_addon_mode === 'paid'
    ? `สิทธิ์จองเรือ ${promo.boat_ticket_count} สิทธิ์/ห้อง ฿${Number(promo.boat_addon_price ?? 0).toLocaleString()}/สิทธิ์`
    : `เรือฟรี ${promo.boat_ticket_count} สิทธิ์/ห้อง`);
  return benefits.join(' · ') || 'ดูเงื่อนไขโปรโมชั่น';
}

export function roomPromotionDiscount(promo: CheckoutPromotion, basePrice: number): number {
  let discount = promo.discount_type === 'percent' ? basePrice * Number(promo.discount_value) / 100 : Number(promo.discount_value);
  if (promo.discount_type === 'percent' && promo.max_discount != null) discount = Math.min(discount, Number(promo.max_discount));
  return Math.max(0, Math.min(basePrice, Math.round(discount)));
}

export function chooseRoomPromotions(
  groups: Array<{typeId: number; totalBasePrice: number; rooms?: unknown[]}>,
  promos: CheckoutPromotion[],
  nights: number,
): Record<number, number | null> {
  const result: Record<number, number | null> = Object.fromEntries(groups.map(group => [group.typeId, null]));
  const used = new Set<number>();
  const choices = groups.flatMap(group => promos
    .filter(promo => eligibleRoomPromotion(promo, group.totalBasePrice, nights, group.typeId, group.rooms?.length))
    .map(promo => ({typeId: group.typeId, promoId: promo.id, discount: roomPromotionDiscount(promo, group.totalBasePrice)})))
    .sort((a, b) => b.discount - a.discount || a.typeId - b.typeId || a.promoId - b.promoId);
  for (const choice of choices) {
    if (choice.discount <= 0 || used.has(choice.promoId) || result[choice.typeId] !== null) continue;
    result[choice.typeId] = choice.promoId;
    used.add(choice.promoId);
  }
  return result;
}
