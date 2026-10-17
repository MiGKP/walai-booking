const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'password123',
  'qwerty123', 'qwertyuiop', 'abcdefgh', 'iloveyou', 'admin123', 'letmein123',
]);

export const PASSWORD_HINT = 'อย่างน้อย 8 ตัวอักษร แนะนำใช้วลีที่ยาวและจำได้ หลีกเลี่ยงรหัสเดาง่าย (สูงสุด 72 ไบต์)';

export function getNewPasswordError(value: unknown): string | null {
  if (typeof value !== 'string') return 'กรุณากรอกรหัสผ่านเป็นข้อความ';
  if (Array.from(value).length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
  if (new TextEncoder().encode(value).length > 72) return 'รหัสผ่านยาวเกินกำหนด (สูงสุด 72 ไบต์ โดยภาษาไทยใช้หลายไบต์ต่อตัว)';
  if (!value.trim() || /^([\s\S])\1+$/u.test(value) || COMMON_PASSWORDS.has(value.trim().toLowerCase())) {
    return 'รหัสผ่านเดาง่ายเกินไป กรุณาใช้ข้อความที่ยาวขึ้นและไม่ซ้ำกับรหัสผ่านทั่วไป';
  }
  return null;
}
