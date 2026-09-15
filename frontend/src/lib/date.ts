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
 * ปฏิทินทั้งหมดทำงานบนสตริง YYYY-MM-DD เป็นหลัก เพื่อไม่ให้ timezone ของเบราว์เซอร์
 * เลื่อนวันไป-มาเวลาแปลงกลับเป็น Date (ปัญหาคลาสสิกของ toISOString กับ local date)
 */
export const toISODate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const fromISODate = (iso: string): Date => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
};

export const todayISO = (): string => toISODate(new Date());

export const addDaysISO = (iso: string, days: number): string => {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
};

export const nightsBetween = (checkInISO: string, checkOutISO: string): number => {
  if (!checkInISO || !checkOutISO) return 0;
  const diff = fromISODate(checkOutISO).getTime() - fromISODate(checkInISO).getTime();
  return Math.max(0, Math.round(diff / 86400000));
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

export const formatThaiDate = (iso: string): string => {
  if (!iso) return '';
  const date = fromISODate(iso);
  return `${date.getDate()} ${THAI_MONTHS_SHORT[date.getMonth()]} ${date.getFullYear() + 543}`;
};

export const formatThaiDateLong = (iso: string): string => {
  if (!iso) return '';
  const date = fromISODate(iso);
  return `${date.getDate()} ${THAI_MONTHS[date.getMonth()]} ${date.getFullYear() + 543}`;
};

export const formatTimeRange = (startTime: string, endTime: string): string => {
  const start = (startTime ?? '').slice(0, 5);
  const end = (endTime ?? '').slice(0, 5);
  return `${start} – ${end}`;
};
