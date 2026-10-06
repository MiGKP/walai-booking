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
  if (promo.applies_to === 'kayak') return false;
  if (promo.is_collectible && !canUseWalletPromotion(promo.wallet_status, promo.wallet_remaining)) return false;
  if (promo.min_nights != null && nights < Number(promo.min_nights)) return false;
  if (promo.min_price != null && basePrice < Number(promo.min_price)) return false;
  if (promo.room_type_id != null && typeId !== promo.room_type_id) return false;
  if (promo.room_count != null && roomCount != null && roomCount < promo.room_count) return false;
  if (promo.usage_limit_per_member != null && (promo.member_usage_count ?? 0) >= promo.usage_limit_per_member) return false;
  return true;
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
