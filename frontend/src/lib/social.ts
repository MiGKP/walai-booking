export interface FacebookLink {
  href: string;
  label: string;
}

/**
 * ค่า facebook ที่แอดมินกรอกมีได้หลายแบบ (URL เต็ม, โดเมนเปล่า, หรือชื่อเพจ/handle)
 * จึงต้อง normalize ให้เป็นลิงก์ที่กดได้ พร้อมข้อความสั้นที่อ่านรู้เรื่องสำหรับแสดงผล
 */
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

  const label = looksLikeUrl || looksLikeDomain
    ? href
        .replace(/^https?:\/\//i, '')
        .replace(/^www\./i, '')
        .replace(/\/+$/, '')
    : raw;

  return { href, label };
};
