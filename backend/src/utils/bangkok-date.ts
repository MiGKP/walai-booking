// คืนค่าวันที่ปัจจุบันตามเวลาประเทศไทยในรูปแบบ YYYY-MM-DD
export function bangkokToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
