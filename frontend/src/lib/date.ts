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

// แปลง Date เป็นสตริง YYYY-MM-DD ตามเขตเวลาประเทศไทย
export const toISODate = (date: Date = new Date()): string => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BANGKOK_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

// แปลงสตริงวันที่ ISO ให้เป็นอ็อบเจกต์ Date
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

// แปลงอ็อบเจกต์ Date เป็นสตริง YYYY-MM-DD ตามค่าปีเดือนวันของปฏิทินโดยตรง
export const toCalendarISODate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// คืนค่าวันที่ปัจจุบันของไทยในรูปแบบ YYYY-MM-DD
export const todayISO = (): string => toISODate(new Date());

// บวกหรือลบจำนวนวันจากสตริงวันที่ YYYY-MM-DD
export const addDaysISO = (iso: string, days: number): string => {
  const date = fromISODate(iso);
  date.setDate(date.getDate() + days);
  return toCalendarISODate(date);
};

// คำนวณจำนวนคืนระหว่างวันเช็คอินและเช็คเอาต์
export const nightsBetween = (checkInISO?: string | null, checkOutISO?: string | null): number => {
  if (!checkInISO || !checkOutISO) return 0;
  const inDate = fromISODate(checkInISO);
  const outDate = fromISODate(checkOutISO);
  if (isNaN(inDate.getTime()) || isNaN(outDate.getTime())) return 0;
  const diff = outDate.getTime() - inDate.getTime();
  const res = Math.round(diff / 86400000);
  return isNaN(res) || res < 0 ? 0 : res;
};

// สร้างรายการวันที่ของทุกคืนที่เข้าพักระหว่างวันเช็คอินถึงก่อนวันเช็คเอาต์
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

// แปลงสตริงวันที่ ISO เป็นตัวชี้เดือนและปีของปฏิทิน
export const monthCursorFromISO = (iso: string): MonthCursor => {
  const date = fromISODate(iso);
  return { year: date.getFullYear(), month: date.getMonth() };
};

// เลื่อนตัวชี้เดือนของปฏิทินไปข้างหน้าหรือย้อนหลังตามจำนวนเดือน
export const shiftMonth = (cursor: MonthCursor, delta: number): MonthCursor => {
  const date = new Date(cursor.year, cursor.month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
};

// คืนค่าวันแรกและวันสุดท้ายของเดือนในรูปแบบ YYYY-MM-DD
export const monthRangeISO = (cursor: MonthCursor): { start: string; end: string } => ({
  start: toCalendarISODate(new Date(cursor.year, cursor.month, 1)),
  end: toCalendarISODate(new Date(cursor.year, cursor.month + 1, 0)),
});

// คืนค่าช่วงวันแรกและวันสุดท้ายครอบคลุมหลายเดือนต่อเนื่องกัน
export const multiMonthRangeISO = (cursor: MonthCursor, monthCount: number): { start: string; end: string } => {
  const count = Math.max(1, Math.floor(monthCount));
  const start = monthRangeISO(cursor).start;
  const end = monthRangeISO(shiftMonth(cursor, count - 1)).end;
  return { start, end };
};

// สร้างตารางวันที่ของเดือนแบบ 7 คอลัมน์สำหรับแสดงผลปฏิทิน
export const buildMonthGrid = (cursor: MonthCursor): (string | null)[] => {
  const firstDay = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();

  const cells: (string | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toCalendarISODate(new Date(cursor.year, cursor.month, day)));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
};

// แปลงตัวชี้เดือนเป็นชื่อเดือนภาษาไทยพร้อมปี พ.ศ.
export const formatMonthLabel = (cursor: MonthCursor): string => `${THAI_MONTHS[cursor.month]} ${cursor.year + 543}`;

// จัดรูปแบบวันที่เป็นภาษาไทยตามเขตเวลาประเทศไทย
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

// จัดรูปแบบวันที่เป็นภาษาไทยแบบย่อปี พ.ศ. 2 หลัก
export const formatThaiDateShort = (isoOrDate?: string | Date | null): string => {
  return formatThaiDate(isoOrDate, '2-digit');
};

// จัดรูปแบบวันที่เป็นภาษาไทยแบบชื่อเดือนเต็ม
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

// จัดรูปแบบเวลาเป็นภาษาไทยตามเขตเวลาประเทศไทย
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

// จัดรูปแบบทั้งวันที่และเวลาเป็นภาษาไทยตามเขตเวลาประเทศไทย
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

// จัดรูปแบบช่วงเวลาเริ่มต้นถึงสิ้นสุด
export const formatTimeRange = (startTime: string, endTime: string): string => {
  const start = (startTime ?? '').slice(0, 5);
  const end = (endTime ?? '').slice(0, 5);
  return `${start} – ${end} น.`;
};

// แปลงวันที่หรือสตริงเวลาเป็น UTC ISO string
export const toUTCISOString = (dateOrISO?: Date | string | null): string => {
  if (!dateOrISO) return new Date().toISOString();
  const d = typeof dateOrISO === 'string' ? new Date(dateOrISO) : dateOrISO;
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

// รวมวันที่และเวลาตามเวลาไทยแล้วแปลงเป็น UTC ISO string
export const thaiDateAndTimeToUTC = (dateStr: string, timeStr = '00:00'): string => {
  if (!dateStr) return new Date().toISOString();
  const normalizedTime = timeStr.length === 5 ? `${timeStr}:00` : timeStr;
  const isoWithOffset = `${dateStr}T${normalizedTime}+07:00`;
  const date = new Date(isoWithOffset);
  return isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};
