const TERMINAL_STATUSES: readonly string[] = ['cancelled', 'rejected', 'checked_out'];

// ตรวจสอบความถูกต้องของการเปลี่ยนสถานะการจองตามกฎธุรกิจ
export function assertStatusTransition(from: string, to: string): string | null {
  if (TERMINAL_STATUSES.includes(from)) {
    return `ไม่สามารถเปลี่ยนสถานะจาก ${from} ได้`;
  }
  if (to === 'approved' && from !== 'pending' && from !== 'paid') {
    return `ไม่สามารถอนุมัติการจองที่มีสถานะ ${from} ได้`;
  }
  if (to === 'checked_out' && from !== 'approved') {
    return `ไม่สามารถเช็คเอาท์การจองที่มีสถานะ ${from} ได้`;
  }
  return null;
}
