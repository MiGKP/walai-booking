// ตรวจการเปลี่ยนสถานะ booking (ห้องพักและเรือ) ให้ตรงกับกฎของธุรกิจ
// คืนข้อความ error ภาษาไทยเมื่อไม่อนุญาต หรือ null เมื่อเปลี่ยนได้

const TERMINAL_STATUSES: readonly string[] = ['cancelled', 'rejected', 'checked_out'];

export function assertStatusTransition(from: string, to: string): string | null {
  if (TERMINAL_STATUSES.includes(from)) {
    return `ไม่สามารถเปลี่ยนสถานะจาก ${from} ได้`;
  }
  if (to === 'approved' && from !== 'pending' && from !== 'paid') {
    return `ไม่สามารถอนุมัติการจองที่มีสถานะ ${from} ได้`;
  }
  // หมายเหตุ: การย้อนจาก approved ไปเป็น pending/rejected ยังต้องอนุญาต (เช่น staff ปฏิเสธ/คืนเงินบัตรเสริม
  // หรือยกเลิกการจองที่อนุมัติไปแล้วโดยพลาด) — ผู้เรียกแต่ละโดเมน (room/kayak) ต้องเช็คเองว่ามีส่วนที่
  // เช็คอิน/เช็คเอาท์ไปแล้วหรือยัง ก่อนอนุญาตให้ย้อนสถานะ (ดู activeOrDone ใน booking.controller.ts
  // และการเช็ค checkin_at ใน kayak.controller.ts)
  if (to === 'checked_out' && from !== 'approved') {
    return `ไม่สามารถเช็คเอาท์การจองที่มีสถานะ ${from} ได้`;
  }
  return null;
}
