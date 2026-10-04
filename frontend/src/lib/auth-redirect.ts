/** สร้าง URL ไปหน้า login พร้อม redirect กลับมาที่หน้า/พารามิเตอร์เดิมหลังล็อกอินสำเร็จ */
export function buildLoginRedirectUrl(pathname: string, searchParamsString: string): string {
  const suffix = searchParamsString ? `?${searchParamsString}` : '';
  return `/auth/login?redirect=${encodeURIComponent(`${pathname}${suffix}`)}`;
}

const STORAGE_KEY = 'walai_post_login_redirect';

export function isSafeInternalPath(path: string): boolean {
  // ปฏิเสธ "//" และ "/\" เพราะเบราว์เซอร์มองว่าเป็น URL ภายนอก รวมถึงอักขระควบคุม
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return false;
  if (/[\u0000-\u001f]/.test(path)) return false;
  return !path.startsWith('/auth');
}

export function setPostLoginRedirect(path: string): void {
  if (typeof window === 'undefined') return;
  if (!isSafeInternalPath(path)) return;
  sessionStorage.setItem(STORAGE_KEY, path);
}

export function consumePostLoginRedirect(): string | null {
  if (typeof window === 'undefined') return null;
  const path = sessionStorage.getItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);
  if (!path || !isSafeInternalPath(path)) return null;
  return path;
}
