import type { DateRange } from '@/components/booking/BookingCalendar';
import { formatThaiDate } from './date';

// ดึงช่วงวันเช็คอินและเช็คเอาต์จาก URL search parameters
export function roomDateSelection(params: URLSearchParams): DateRange | null {
  const start = params.get('check_in') || '';
  if (!start) return null;
  return { start, end: params.get('check_out') || '' };
}

// สร้างข้อความแสดงช่วงวันเช็คอินและเช็คเอาต์ภาษาไทยสำหรับปุ่มค้นหาห้องพัก
export function roomDateSelectionLabel(range: DateRange | null): string {
  if (!range?.start) return 'เลือกวันเช็คอินและเช็คเอาต์';
  return `${formatThaiDate(range.start)} – ${range.end ? formatThaiDate(range.end) : 'เลือกวันเช็คเอาต์'}`;
}
