const STORAGE_KEY = 'walai_post_login_redirect';

// สร้าง URL ไปยังหน้าเข้าสู่ระบบพร้อมแนบพารามิเตอร์หน้าปลายทางเดิม
export function buildLoginRedirectUrl(pathname: string, searchParamsString: string): string {
  const suffix = searchParamsString ? `?${searchParamsString}` : '';
  return `/auth/login?redirect=${encodeURIComponent(`${pathname}${suffix}`)}`;
}

// ตรวจสอบว่า path เป็นเส้นทางภายในเว็บไซต์ที่ปลอดภัยสำหรับ redirect
export function isSafeInternalPath(path: string): boolean {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return false;
  if (/[\u0000-\u001f]/.test(path)) return false;
  return !path.startsWith('/auth');
}

// ล้างค่าเส้นทาง redirect ค้างไว้ใน sessionStorage
export function setPostLoginRedirect(_path: string): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(STORAGE_KEY);
  }
}

// ล้างและคืนค่าเส้นทางหลังเข้าสู่ระบบ
export function consumePostLoginRedirect(): string | null {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem(STORAGE_KEY);
  }
  return null;
}
