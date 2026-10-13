import { nightsBetween } from './date';

export interface RoomGuestInput {
  adults: number;
  children: number;
  childAges: Array<number | null>;
  infantAge: number;
}

function occupancyCounts(input: RoomGuestInput): { occupyingGuests: number; eligibleChildren: number } {
  let occupyingGuests = input.adults;
  let eligibleChildren = 0;
  for (let index = 0; index < input.children; index += 1) {
    const age = input.childAges[index];
    if (age == null || !Number.isInteger(age) || age < 0 || age >= input.infantAge) {
      occupyingGuests += 1;
      if (age != null && Number.isInteger(age) && age >= Math.max(6, input.infantAge) && age <= 11) {
        eligibleChildren += 1;
      }
    }
  }
  return { occupyingGuests, eligibleChildren };
}

export function roomOccupancy(input: RoomGuestInput & { capacity: number; roomCount: number }): {
  occupyingGuests: number;
  additionalChildren: number;
  missingCapacity: number;
  fits: boolean;
} {
  const { occupyingGuests, eligibleChildren } = occupancyCounts(input);
  const additionalChildren = Math.min(eligibleChildren, Math.max(0, Math.floor(input.roomCount)));
  const missingCapacity = Math.max(0, occupyingGuests - additionalChildren - input.capacity);
  return { occupyingGuests, additionalChildren, missingCapacity, fits: input.adults >= 1 && missingCapacity === 0 };
}

export function minimumRoomsForGuests(input: RoomGuestInput, capacityPerRoom: number): number {
  if (!Number.isFinite(capacityPerRoom) || capacityPerRoom <= 0) return Infinity;
  const { occupyingGuests, eligibleChildren } = occupancyCounts(input);
  return Math.max(1, Math.ceil((occupyingGuests - eligibleChildren) / capacityPerRoom), Math.ceil(occupyingGuests / (capacityPerRoom + 1)));
}

export interface RoomCartItem {
  room_type_id: number;
  room_id?: number | null; // For physical room snapshot
  room_number?: string | null; // For physical room snapshot
  room_name: string;
  type_name: string | null;
  capacity: number;
  price_per_night: number;
  quantity: number;
  available_count: number;
}

export interface RoomCartState {
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  child_ages?: number[];
  items: RoomCartItem[];
}

const STORAGE_KEY = 'walai_room_cart_v1';

export function loadRoomCart(): RoomCartState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoomCartState;
    if (!parsed.check_in || !parsed.check_out || !Array.isArray(parsed.items)) {
      return null;
    }
    return {
      check_in: parsed.check_in,
      check_out: parsed.check_out,
      adults: Math.max(1, Number(parsed.adults) || 1),
      children: Math.max(0, Number(parsed.children) || 0),
      child_ages: Array.isArray(parsed.child_ages) ? parsed.child_ages : [],
      items: parsed.items,
    };
  } catch {
    return null;
  }
}

export function saveRoomCart(state: RoomCartState): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearRoomCart(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function upsertCartItem(
  state: RoomCartState,
  item: Omit<RoomCartItem, 'quantity'> & { quantity?: number }
): RoomCartState {
  const quantity = Math.max(1, item.quantity ?? 1);
  const existingIndex = state.items.findIndex(
    (row) => row.room_type_id === item.room_type_id
  );
  const nextItems = [...state.items];
  if (existingIndex >= 0) {
    const prev = nextItems[existingIndex];
    const nextQty = Math.min(
      prev.available_count,
      prev.quantity + quantity
    );
    nextItems[existingIndex] = { ...prev, quantity: nextQty, available_count: item.available_count };
  } else {
    nextItems.push({
      room_type_id: item.room_type_id,
      room_name: item.room_name,
      type_name: item.type_name,
      capacity: item.capacity,
      price_per_night: item.price_per_night,
      available_count: item.available_count,
      quantity: Math.min(quantity, item.available_count),
    });
  }
  return { ...state, items: nextItems };
}

export function setCartItemQuantity(
  state: RoomCartState,
  roomTypeId: number,
  quantity: number
): RoomCartState {
  if (quantity < 1) {
    return {
      ...state,
      items: state.items.filter((item) => item.room_type_id !== roomTypeId),
    };
  }
  return {
    ...state,
    items: state.items.map((item) =>
      item.room_type_id === roomTypeId
        ? { ...item, quantity: Math.min(quantity, item.available_count) }
        : item
    ),
  };
}

export function cartCapacitySum(state: RoomCartState): number {
  return state.items.reduce(
    (sum, item) => sum + item.capacity * item.quantity,
    0
  );
}

export function cartGuestTotal(state: RoomCartState): number {
  return state.adults + state.children;
}

export function cartOccupyingGuestTotal(state: RoomCartState, infantMaxAgeExclusive: number): number {
  const ages = state.child_ages || [];
  let count = state.adults;
  for (let index = 0; index < state.children; index += 1) {
    const age = ages[index];
    if (!Number.isInteger(age) || age < 0 || age >= infantMaxAgeExclusive) count += 1;
  }
  return count;
}

export function cartEstimatedTotal(state: RoomCartState): number {
  const nights = nightsBetween(state.check_in, state.check_out);
  return state.items.reduce(
    (sum, item) => sum + item.price_per_night * item.quantity * nights,
    0
  );
}

export function cartRoomCount(state: RoomCartState): number {
  return state.items.reduce((sum, item) => sum + item.quantity, 0);
}
