export interface BoatCheckinWindow {
  opensAt: string;
  closesAt: string;
}

export function boatCheckinWindow(date: string, start: string, end: string, advanceMinutes: number): BoatCheckinWindow | null {
  const begins = new Date(`${date}T${start}+07:00`).getTime();
  const ends = new Date(`${date}T${end}+07:00`).getTime();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(begins) || !Number.isFinite(ends)
    || ends <= begins || !Number.isInteger(advanceMinutes) || advanceMinutes < 0 || advanceMinutes > 1440) return null;
  return { opensAt: new Date(begins - advanceMinutes * 60_000).toISOString(), closesAt: new Date(ends).toISOString() };
}

export function boatCheckinError(window: BoatCheckinWindow | null, now: Date): string | null {
  if (!window || !Number.isFinite(now.getTime())) return 'วันที่หรือรอบเวลาเช็คอินไม่ถูกต้อง';
  if (now.getTime() < new Date(window.opensAt).getTime()) return 'ยังไม่ถึงเวลาเปิดเช็คอินของรอบเรือที่จอง';
  if (now.getTime() >= new Date(window.closesAt).getTime()) return 'รอบเรือที่จองสิ้นสุดแล้ว ไม่สามารถเช็คอินได้';
  return null;
}
