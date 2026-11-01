// ตรวจสอบและแปลงค่ารหัส (ID) ให้เป็นจำนวนเต็มบวก
export function parsePositiveInt(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}
