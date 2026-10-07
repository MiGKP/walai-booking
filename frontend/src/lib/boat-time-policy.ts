export interface BoatDayHours {
  day_of_week?: number;
  is_open: boolean;
  open_time: string;
  close_time: string;
  advance_booking_minutes?: number;
}

export function isBoatSlotBookable(date: string, start: string, end: string, hours: BoatDayHours | undefined, advanceMinutes: number, nowMs = Date.now()): boolean {
  const startTime = start.length === 5 ? `${start}:00` : start.slice(0, 8);
  const beginsMs = new Date(`${date}T${startTime}+07:00`).getTime();
  if (!Number.isFinite(beginsMs) || beginsMs <= nowMs || beginsMs - nowMs < advanceMinutes * 60_000) return false;
  if (hours && (!hours.is_open || start.slice(0, 5) < hours.open_time.slice(0, 5) || end.slice(0, 5) > hours.close_time.slice(0, 5))) return false;
  return end > start;
}
