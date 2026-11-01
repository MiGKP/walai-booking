export interface FacebookLink {
  href: string;
  label: string;
}

// แปลงค่าชื่อเพจหรือ URL ของ Facebook ให้เป็นลิงก์พร้อมข้อความสำหรับแสดงผล
export const resolveFacebookLink = (value?: string | null): FacebookLink | null => {
  const raw = value?.trim();
  if (!raw) return null;

  const looksLikeUrl = /^https?:\/\//i.test(raw);
  const looksLikeDomain = /(^|\.)(facebook\.com|fb\.com|fb\.me|m\.me)\//i.test(raw);

  const href = looksLikeUrl
    ? raw
    : looksLikeDomain
    ? `https://${raw.replace(/^\/+/, '')}`
    : `https://facebook.com/${raw.replace(/^@/, '')}`;

  const label =
    looksLikeUrl || looksLikeDomain
      ? href
          .replace(/^https?:\/\//i, '')
          .replace(/^www\./i, '')
          .replace(/\/+$/, '')
      : raw;

  return { href, label };
};
