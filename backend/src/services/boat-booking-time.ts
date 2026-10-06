import type { Pool } from 'pg';
import { bangkokToday } from '../utils/bangkok-date';

interface QueryClient { query: Pool['query']; }

function timeSeconds(value: string): number | null {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, hours, minutes, seconds = '0'] = match;
  if (Number(hours) > 23 || Number(minutes) > 59 || Number(seconds) > 59) return null;
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

// Both ordinary bookings and room addons must obey the same server policy.
export async function validateBoatBookingTime(
  client: QueryClient, date: string, start: string, end: string, now: Date = new Date(),
): Promise<string | null> {
  const startSeconds = timeSeconds(start);
  const endSeconds = timeSeconds(end);
  const begins = new Date(`${date}T${start.length === 5 ? `${start}:00` : start}+07:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(begins.getTime()) ||
      bangkokToday(begins) !== date || startSeconds === null || endSeconds === null || endSeconds <= startSeconds) {
    return 'วันที่หรือรอบเวลาไม่ถูกต้อง';
  }
  const hours = await client.query(
    `SELECT is_open, open_time::text, close_time::text FROM boat_operating_hours
     WHERE day_of_week = EXTRACT(DOW FROM $1::date)::int`, [date],
  );
  const day = hours.rows[0];
  if (day) {
    if (!day.is_open) return 'วันที่เลือกปิดให้บริการเรือ';
    const opens = timeSeconds(String(day.open_time));
    const closes = timeSeconds(String(day.close_time));
    if (opens === null || closes === null || startSeconds < opens || endSeconds > closes) {
      return 'รอบเวลาที่เลือกอยู่นอกเวลาทำการ';
    }
  }
  const settings = await client.query('SELECT boat_advance_booking_minutes FROM resort_info WHERE id = 5');
  const rawAdvance = settings.rows[0]?.boat_advance_booking_minutes;
  const advance = rawAdvance == null ? 60 : Number(rawAdvance);
  if (!Number.isInteger(advance) || advance < 0 || advance > 10080) {
    throw new Error('Invalid boat advance booking setting');
  }
  if (begins.getTime() <= now.getTime() || begins.getTime() - now.getTime() < advance * 60_000) {
    return `ต้องจองเรือล่วงหน้าอย่างน้อย ${advance} นาที`;
  }
  return null;
}
