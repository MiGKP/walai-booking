'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import {
  formatPromoDiscount,
  formatPromoWindow,
  type CatalogPromo,
  type WalletStatus,
} from '@/lib/promotions';

interface PromoVoucherProps {
  code: string;
  name: string;
  description: string | null;
  discountType: CatalogPromo['discount_type'];
  discountValue: number | string;
  startDate: string | null;
  endDate: string | null;
  stackable: boolean;
  muted?: boolean;
  badge?: string;
  footer: ReactNode;
}

export function PromoVoucher({
  code,
  name,
  description,
  discountType,
  discountValue,
  startDate,
  endDate,
  stackable,
  muted = false,
  badge,
  footer,
}: PromoVoucherProps): React.ReactElement {
  return (
    <article
      className={`relative flex overflow-hidden rounded-[22px] border bg-cream-100 ${
        muted ? 'border-stone-200 opacity-70' : 'border-stone-200'
      }`}
    >
      <div className="flex w-[7.5rem] shrink-0 flex-col items-center justify-center bg-forest-800 px-3 py-5 text-center text-cream-100 sm:w-36">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-bamboo-300">
          ส่วนลด
        </p>
        <p className="mt-1 font-display text-2xl font-semibold leading-none sm:text-3xl">
          {formatPromoDiscount(discountType, discountValue)}
        </p>
      </div>
      <div
        className="relative w-4 shrink-0 bg-cream-100"
        aria-hidden="true"
      >
        <span className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-[#FDFBF7]" />
        <span className="absolute -left-2 bottom-0 h-4 w-4 rounded-full bg-[#FDFBF7]" />
        <span className="absolute left-1/2 top-5 bottom-5 w-px -translate-x-1/2 border-l border-dashed border-stone-300" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-sm font-semibold tracking-wide text-forest-800">
              {code}
            </p>
            <h2 className="mt-0.5 font-display text-lg text-charcoal">{name}</h2>
            {description ? (
              <p className="mt-1 line-clamp-2 text-sm leading-6 text-charcoal-500">
                {description}
              </p>
            ) : null}
          </div>
          {badge ? (
            <span className="shrink-0 rounded-full bg-forest-50 px-2.5 py-1 text-[11px] font-semibold text-forest-800">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-charcoal-400">
          {formatPromoWindow(startDate, endDate)}
          {stackable ? ' · ใช้ร่วมโค้ดอื่นได้' : ''}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-2">{footer}</div>
      </div>
    </article>
  );
}

interface CollectButtonProps {
  loading: boolean;
  status: WalletStatus | null;
  isCollectible: boolean;
  isCustomer: boolean;
  isAuthenticated: boolean;
  onCollect: () => void;
  onLogin: () => void;
}

export function PromoCollectAction({
  loading,
  status,
  isCollectible,
  isCustomer,
  isAuthenticated,
  onCollect,
  onLogin,
}: CollectButtonProps): React.ReactElement {
  if (!isCollectible) {
    return (
      <>
        <Link href="/rooms" className="btn-primary px-4 py-2 text-sm">
          ใช้ตอนจองห้อง
        </Link>
        <Link href="/kayaks" className="btn-secondary px-4 py-2 text-sm">
          ใช้ตอนจองเรือ
        </Link>
      </>
    );
  }

  if (status === 'saved') {
    return (
      <>
        <span className="text-sm font-semibold text-forest-800">เก็บแล้ว</span>
        <Link href="/rooms" className="btn-primary px-4 py-2 text-sm">
          ไปจองห้อง
        </Link>
      </>
    );
  }

  if (status === 'used') {
    return <span className="text-sm font-semibold text-charcoal-400">ใช้ครบแล้ว</span>;
  }

  if (status === 'expired') {
    return <span className="text-sm font-semibold text-charcoal-400">หมดอายุ</span>;
  }

  if (!isAuthenticated) {
    return (
      <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={onLogin}>
        เข้าสู่ระบบเพื่อเก็บ
      </button>
    );
  }

  if (!isCustomer) {
    return (
      <span className="text-sm text-charcoal-400">เก็บได้เฉพาะบัญชีลูกค้า</span>
    );
  }

  return (
    <button
      type="button"
      className="btn-primary px-4 py-2 text-sm disabled:opacity-60"
      onClick={onCollect}
      disabled={loading}
    >
      {loading ? <Loader2 size={16} className="inline animate-spin" /> : 'เก็บคูปอง'}
    </button>
  );
}
