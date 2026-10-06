// วันที่ปัจจุบันตามเวลาประเทศไทย (รูปแบบ YYYY-MM-DD) ใช้เทียบกับวันที่ที่ผู้ใช้เลือก
export function bangkokToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
