import api from '@/lib/api';

export interface BoatTicketSummary {
  total_tickets: number;
  used_tickets: number;
  remaining_tickets: number;
  bookable_tickets?: number;
  free_tickets: number;
  paid_tickets: number;
  valid_from: string | null;
  valid_to: string | null;
}

export interface RoomBoatAddonInfo {
  room_status: string;
  room_line_status?: string;
  balance: number;
  total_tickets?: number;
  used_tickets?: number;
  mode: 'free' | 'paid';
  unit_price: number | string;
  valid_from: string | null;
  valid_to: string | null;
}

export interface RoomBoatAddonRequest {
  boat_type_id: number;
  boat_round_id: number;
  booking_date: string;
  num_passengers: number;
}

export async function createRoomBoatAddon(bookingRoomId: number, request: RoomBoatAddonRequest): Promise<void> {
  await api.post(`/kayaks/room-addon/${bookingRoomId}`, request);
}

export function canBookRoomBoatAddon(info: RoomBoatAddonInfo, today: string): boolean {
  return info.balance > 0
    && ['pending', 'paid', 'approved'].includes(info.room_status)
    && !['checked_out', 'cancelled', 'rejected'].includes(info.room_line_status ?? '')
    && (info.mode === 'free' || info.room_status === 'pending')
    && !!info.valid_from && !!info.valid_to
    && info.valid_from <= info.valid_to && info.valid_to >= today;
}
