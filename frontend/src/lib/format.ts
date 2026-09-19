// ปิดบังชื่อผู้รีวิวก่อนแสดงต่อสาธารณะ (หน้าแรก, หน้ารายละเอียดห้องพัก) — โชว์แค่ตัวอักษรแรกของชื่อ/นามสกุล ที่เหลือแทนด้วย *
function maskNamePart(part: string): string {
  const trimmed = part.trim();
  if (trimmed.length <= 1) return trimmed;
  return trimmed[0] + '*'.repeat(trimmed.length - 1);
}

export function maskReviewerName(firstName?: string | null, lastName?: string | null): string {
  const first = maskNamePart(firstName || '');
  const last = maskNamePart(lastName || '');
  const masked = `${first} ${last}`.trim();
  return masked || 'แขกผู้เข้าพัก';
}
