// ปิดบังข้อความชื่อหรือนามสกุลโดยแสดงเฉพาะตัวอักษรแรกและแทนที่เหลือด้วยดอกจัน
function maskNamePart(part: string): string {
  const trimmed = part.trim();
  if (trimmed.length <= 1) return trimmed;
  return trimmed[0] + '*'.repeat(trimmed.length - 1);
}

// ปิดบังชื่อและนามสกุลของผู้รีวิวก่อนแสดงผลต่อสาธารณะ
export function maskReviewerName(firstName?: string | null, lastName?: string | null): string {
  const first = maskNamePart(firstName || '');
  const last = maskNamePart(lastName || '');
  const masked = `${first} ${last}`.trim();
  return masked || 'แขกผู้เข้าพัก';
}
