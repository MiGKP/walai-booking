export const BANGKOK_TIMEZONE = 'Asia/Bangkok';

const THAI_MONTHS: readonly string[] = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
];

const THAI_MONTHS_SHORT: readonly string[] = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
];

export const THAI_WEEKDAYS_SHORT: readonly string[] = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

/**
 * แปลง Date Object เป็นสตริง YYYY-MM-DD ตามเขตเวลาประเทศไทย (Asia/Bangkok, UTC+7) เสมอ
 * เพื่อป้องกันปัญหา Browser Timezone ต่างประเทศเลื่อนวัน
 */
export const toISODate = (date: Date = new Date()): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

export const fromISODate = (iso: string): Date => {
  if (!iso) return new Date();
  const clean = String(iso).split('T')[0].split(' ')[0].trim();
  const [year, month, day] = clean.split('-').map(Number);
  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

/** วันที่ปัจจุบันในประเทศไทย (Asia/Bangkok) รูปแบบ YYYY-MM-DD */
export const todayISO = (): string => toISODate(new Date());

export const addDaysISO = (iso: string, days: number): string => {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
};

export const nightsBetween = (checkInISO?: string | null, checkOutISO?: string | null): number => {
  if (!checkInISO || !checkOutISO) return 0;
  const inDate = fromISODate(checkInISO);
  const outDate = fromISODate(checkOutISO);
  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) return 0;
  const diff = outDate.getTime() - inDate.getTime();
  const res = Math.round(diff / 86400000);
  return isNaN(res) || res < 0 ? 0 : res;
};

/** ทุกคืนที่ถูกใช้จริงในช่วงจอง — คืนสุดท้ายคือวันก่อน check-out */
export const nightsInRange = (checkInISO: string, checkOutISO: string): string[] => {
  const nights: string[] = [];
  const total = nightsBetween(checkInISO, checkOutISO);
  for (let i = 0; i < total; i += 1) {
    nights.push(addDaysISO(checkInISO, i));
  }
  return nights;
};

export interface MonthCursor {
  year: number;
  month: number;
}

export const monthCursorFromISO = (iso: string): MonthCursor => {
  const date = fromISODate(iso);
  return { year: date.getFullYear(), month: date.getMonth() };
};

export const shiftMonth = (cursor: MonthCursor, delta: number): MonthCursor => {
  const date = new Date(cursor.year, cursor.month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
};

export const monthRangeISO = (cursor: MonthCursor): { start: string; end: string } => ({
  start: toISODate(new Date(cursor.year, cursor.month, 1)),
  end: toISODate(new Date(cursor.year, cursor.month + 1, 0)),
});

/** Inclusive range covering `monthCount` months starting at cursor (for dual-month calendars). */
export const multiMonthRangeISO = (
  cursor: MonthCursor,
  monthCount: number
): { start: string; end: string } => {
  const count = Math.max(1, Math.floor(monthCount));
  const start = monthRangeISO(cursor).start;
  const end = monthRangeISO(shiftMonth(cursor, count - 1)).end;
  return { start, end };
};

/** ตารางเดือนแบบ 7 คอลัมน์ อาทิตย์ต้นสัปดาห์ — null คือช่องว่างก่อน/หลังเดือน */
export const buildMonthGrid = (cursor: MonthCursor): (string | null)[] => {
  const firstDay = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();

  const cells: (string | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toISODate(new Date(cursor.year, cursor.month, day)));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
};

export const formatMonthLabel = (cursor: MonthCursor): string =>
  `${THAI_MONTHS[cursor.month]} ${cursor.year + 543}`;

/**
 * แสดงผลวันที่ภาษาไทยตามเขตเวลาประเทศไทย (Asia/Bangkok)
 * เช่น "7 ต.ค. 2569" หรือ "7 ต.ค. 69"
 */
export const formatThaiDate = (
  isoOrDate?: string | Date | null,
  yearFormat: 'numeric' | '2-digit' = 'numeric'
): string => {
  if (!isoOrDate) return '-';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', {
    timeZone: BANGKOK_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: yearFormat,
  });
};

/**
 * แสดงผลวันที่ภาษาไทยแบบสั้น เช่น "7 ต.ค. 69"
 */
export const formatThaiDateShort = (isoOrDate?: string | Date | null): string => {
  return formatThaiDate(isoOrDate, '2-digit');
};

/**
 * แสดงผลวันที่ภาษาไทยแบบเต็ม เช่น "7 ตุลาคม 2569"
 */
export const formatThaiDateLong = (isoOrDate?: string | Date | null): string => {
  if (!isoOrDate) return '-';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('th-TH', {
    timeZone: BANGKOK_TIMEZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
};

/**
 * แสดงผลเวลาตามเขตเวลาประเทศไทย (Asia/Bangkok)
 * เช่น "14:30 น."
 */
export const formatThaiTime = (isoOrDate?: string | Date | null): string => {
  if (!isoOrDate) return '-';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '-';
  return `${d.toLocaleTimeString('th-TH', {
    timeZone: BANGKOK_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  })} น.`;
};

/**
 * แสดงผลวันและเวลาตามเขตเวลาประเทศไทย (Asia/Bangkok)
 * เช่น "7 ต.ค. 69 14:30 น."
 */
export const formatThaiDateTime = (isoOrDate?: string | Date | null): string => {
  if (!isoOrDate) return '-';
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (isNaN(d.getTime())) return '-';
  const dateStr = d.toLocaleDateString('th-TH', {
    timeZone: BANGKOK_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
  const timeStr = d.toLocaleTimeString('th-TH', {
    timeZone: BANGKOK_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateStr} ${timeStr} น.`;
};

export const formatTimeRange = (startTime: string, endTime: string): string => {
  const start = (startTime ?? '').slice(0, 5);
  const end = (endTime ?? '').slice(0, 5);
  return `${start} – ${end} น.`;
};

/**
 * แปลง Date หรือ Date String ท้องถิ่นไทยให้เป็นสากล (UTC ISO String)
 * ใช้เรียกทุกครั้งก่อนส่ง payload ข้อมูลวันเวลาไปยัง Backend API
 * เช่น "2026-10-07T16:00:00.000Z"
 */
export const toUTCISOString = (dateOrISO?: Date | string | null): string => {
  if (!dateOrISO) return new Date().toISOString();
  const d = typeof dateOrISO === 'string' ? new Date(dateOrISO) : dateOrISO;
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

/**
 * รวมวันที่ไทย YYYY-MM-DD และเวลา HH:MM แล้วแปลงเป็นเวลาสากล UTC ISO String
 * เช่น thaiDateAndTimeToUTC("2026-10-07", "14:00") -> "2026-10-07T07:00:00.000Z" (UTC = Thai - 7h)
 */
export const thaiDateAndTimeToUTC = (dateStr: string, timeStr = '00:00'): string => {
  if (!dateStr) return new Date().toISOString();
  // ประกอบ string แบบมี offset +07:00
  const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const isoWithOffset = `${dateStr}T${normalizedTime}+07:00`;
  const date = new Date(isoWithOffset);
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};
