/** สร้าง URL ไปหน้า login พร้อม redirect กลับมาที่หน้า/พารามิเตอร์เดิมหลังล็อกอินสำเร็จ */
export function buildLoginRedirectUrl(pathname: string, searchParamsString: string): string {
  const suffix = searchParamsString ? `?${searchParamsString}` : '';
  return `/auth/login?redirect=${encodeURIComponent(`${pathname}${suffix}`)}`;
}
