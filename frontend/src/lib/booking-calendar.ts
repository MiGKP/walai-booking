import api from '@/lib/api';
import type { DayStatus } from '@/components/booking/BookingCalendar';

/**
 * เหลือถึงจำนวนนี้ถือว่า "เหลือน้อย" — แต่ต้องมีของถูกจองไปแล้วจริงด้วย
 * ไม่งั้นรีสอร์ทที่มีห้องรวมน้อย (เช่น 2 ห้อง) จะถูกมาร์กว่าเหลือน้อยทุกวัน
 */
const LOW_STOCK_THRESHOLD = 2;

export interface RoomCalendarDay {
  date: string;
  available_count: number;
  total_rooms: number;
  is_full: boolean;
}

export interface KayakCalendarDay {
  date: string;
  rounds_total: number;
  rounds_available: number;
  is_full: boolean;
}

export interface KayakRound {
  boat_round_id: number;
  start_time: string;
  end_time: string;
  total: number;
  booked: number;
  remaining: number;
  total_slots: number | null;
  pool_booked: number;
  available: boolean;
}

export const fetchRoomCalendar = async (params: {
  start: string;
  end: string;
  roomTypeId?: number;
}): Promise<RoomCalendarDay[]> => {
  const res = await api.get('/rooms/calendar', {
    params: {
      start: params.start,
      end: params.end,
      ...(params.roomTypeId ? { room_type_id: params.roomTypeId } : {}),
    },
  });
  const days: unknown = res.data?.data?.days;
  return Array.isArray(days) ? (days as RoomCalendarDay[]) : [];
};

export const fetchKayakCalendar = async (params: {
  kayakId: number;
  start: string;
  end: string;
}): Promise<KayakCalendarDay[]> => {
  const res = await api.get('/kayaks/calendar', {
    params: { kayak_id: params.kayakId, start: params.start, end: params.end },
  });
  const days: unknown = res.data?.data?.days;
  return Array.isArray(days) ? (days as KayakCalendarDay[]) : [];
};

export const fetchKayakRounds = async (params: {
  kayakId: number;
  bookingDate: string;
}): Promise<KayakRound[]> => {
  const res = await api.get('/kayaks/rounds-availability', {
    params: { kayak_id: params.kayakId, booking_date: params.bookingDate },
  });
  const rounds: unknown = res.data?.data?.rounds;
  return Array.isArray(rounds) ? (rounds as KayakRound[]) : [];
};

export const toRoomDayStatus = (days: RoomCalendarDay[]): Record<string, DayStatus> => {
  const status: Record<string, DayStatus> = {};
  days.forEach((day) => {
    if (day.is_full) {
      status[day.date] = { tone: 'full', hint: 'ไม่มีห้องว่าง' };
    } else if (day.available_count <= LOW_STOCK_THRESHOLD && day.available_count < day.total_rooms) {
      status[day.date] = { tone: 'low', hint: `เหลือ ${day.available_count} ห้อง` };
    } else {
      status[day.date] = { tone: 'open', hint: `ว่าง ${day.available_count} ห้อง` };
    }
  });
  return status;
};

export const toKayakDayStatus = (days: KayakCalendarDay[]): Record<string, DayStatus> => {
  const status: Record<string, DayStatus> = {};
  days.forEach((day) => {
    if (day.is_full) {
      status[day.date] = { tone: 'full', hint: day.rounds_total === 0 ? 'ไม่มีรอบให้บริการ' : 'เต็มทุกรอบ' };
    } else if (day.rounds_available <= 1 && day.rounds_available < day.rounds_total) {
      status[day.date] = { tone: 'low', hint: `เหลือ ${day.rounds_available} รอบ` };
    } else {
      status[day.date] = { tone: 'open', hint: `ว่าง ${day.rounds_available} รอบ` };
    }
  });
  return status;
};
