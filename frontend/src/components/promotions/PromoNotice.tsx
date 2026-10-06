'use client';

import { useCallback, useEffect, useState } from 'react';

export type PromoNoticeTone = 'success' | 'error';

export interface PromoNoticeState {
  tone: PromoNoticeTone;
  message: string;
}

// แจ้งผลการทำงานเรื่องโปรโมชั่นในหน้าเดียวกัน (ไม่ใช้ toast) แล้วซ่อนเองหลังเวลาที่กำหนด
export function usePromoNotice(durationMs = 10_000): {
  notice: PromoNoticeState | null;
  showNotice: (tone: PromoNoticeTone, message: string) => void;
} {
  const [notice, setNotice] = useState<PromoNoticeState | null>(null);

  useEffect(() => {
    if (notice == null) return;
    const timer = setTimeout(() => setNotice(null), durationMs);
    return () => clearTimeout(timer);
  }, [notice, durationMs]);

  const showNotice = useCallback((tone: PromoNoticeTone, message: string): void => {
    setNotice({ tone, message });
  }, []);

  return { notice, showNotice };
}

export function PromoNotice({ notice }: { notice: PromoNoticeState | null }): React.ReactElement | null {
  if (notice == null) return null;
  const tone =
    notice.tone === 'success'
      ? 'border-forest-200 bg-forest-50 text-forest-800'
      : 'border-rose-200 bg-rose-50 text-rose-700';
  return (
    <div role="status" className={`mb-3 rounded-xl border px-4 py-2.5 text-sm font-semibold ${tone}`}>
      {notice.message}
    </div>
  );
}
