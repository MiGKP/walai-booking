const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'password123',
  'qwerty123', 'qwertyuiop', 'abcdefgh', 'iloveyou', 'admin123', 'letmein123',
]);

// Validate new passwords only. Existing credentials must still be usable at login.
export function getNewPasswordError(value: unknown): string | null {
  if (typeof value !== 'string') return 'กรุณากรอกรหัสผ่านเป็นข้อความ';
  if (Array.from(value).length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
  if (Buffer.byteLength(value, 'utf8') > 72) return 'รหัสผ่านยาวเกินกำหนด (สูงสุด 72 ไบต์ โดยภาษาไทยใช้หลายไบต์ต่อตัว)';
  if (!value.trim() || /^([\s\S])\1+$/u.test(value) || COMMON_PASSWORDS.has(value.trim().toLowerCase())) {
    return 'รหัสผ่านเดาง่ายเกินไป กรุณาใช้ข้อความที่ยาวขึ้นและไม่ซ้ำกับรหัสผ่านทั่วไป';
  }
  return null;
}

export function validateNewPassword(value: unknown): boolean {
  const error = getNewPasswordError(value);
  if (error) throw new Error(error);
  return true;
}
