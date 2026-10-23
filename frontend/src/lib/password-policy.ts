const COMMON_PASSWORDS = new Set([
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password1',
  'password123',
  'qwerty123',
  'qwertyuiop',
  'abcdefgh',
  'iloveyou',
  'admin123',
  'letmein123',
]);

export const PASSWORD_HINT = 'อย่างน้อย 8 ตัวอักษร (ตัวอักษร ตัวเลข และอักขระพิเศษ)';

export interface PasswordStrengthResult {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  barColor: string;
  textColor: string;
}

// ประเมินระดับความปลอดภัยของรหัสผ่านและคืนค่าสีพร้อมข้อความแสดงผล
export function getPasswordStrength(password: string): PasswordStrengthResult {
  const charCount = Array.from(password).length;
  if (charCount === 0) {
    return {
      level: 0,
      label: '',
      barColor: 'bg-stone-200',
      textColor: 'text-stone-500',
    };
  }

  const error = getNewPasswordError(password);
  if (error) {
    return {
      level: 1,
      label: charCount < 8 ? 'อ่อน (ต้องมีอย่างน้อย 8 ตัวอักษร)' : 'อ่อน (รหัสผ่านเดาง่ายเกินไป)',
      barColor: 'bg-rose-500',
      textColor: 'text-rose-600',
    };
  }

  const trimmed = password.trim();
  const isSequentialDigits =
    /^\d+$/.test(trimmed) &&
    ('01234567890123456789'.includes(trimmed) || '98765432109876543210'.includes(trimmed));
  if (isSequentialDigits) {
    return {
      level: 1,
      label: 'อ่อน (ตัวเลขเรียงกันเดาง่าย)',
      barColor: 'bg-rose-500',
      textColor: 'text-rose-600',
    };
  }

  const hasLetter = /[a-zA-Zก-ฮ]/u.test(password);
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9ก-๙\s]/u.test(password);
  const isLong = charCount >= 12;

  const varietyScore =
    (hasLetter ? 1 : 0) +
    (hasNumber ? 1 : 0) +
    (hasSpecial ? 1 : 0) +
    (hasMixedCase || isLong ? 1 : 0);

  if (varietyScore <= 1) {
    return {
      level: 2,
      label: 'ปานกลาง (แนะนำให้ผสมตัวอักษรและตัวเลข)',
      barColor: 'bg-amber-500',
      textColor: 'text-amber-600',
    };
  }

  if (varietyScore === 2) {
    return {
      level: 3,
      label: 'ดี',
      barColor: 'bg-emerald-500',
      textColor: 'text-emerald-700',
    };
  }

  return {
    level: 4,
    label: 'ปลอดภัยมาก',
    barColor: 'bg-forest-700',
    textColor: 'text-forest-800',
  };
}

// ตรวจสอบความถูกต้องของรหัสผ่านใหม่ตามนโยบายความปลอดภัย
export function getNewPasswordError(value: unknown): string | null {
  if (typeof value !== 'string') return 'กรุณากรอกรหัสผ่านเป็นข้อความ';
  if (Array.from(value).length < 8) return 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร';
  if (new TextEncoder().encode(value).length > 72) return 'รหัสผ่านยาวเกินกำหนด';
  if (!value.trim() || /^([\s\S])\1+$/u.test(value) || COMMON_PASSWORDS.has(value.trim().toLowerCase())) {
    return 'รหัสผ่านเดาง่ายเกินไป กรุณาใช้ข้อความที่ยาวขึ้นและไม่ซ้ำกับรหัสผ่านทั่วไป';
  }
  return null;
}
