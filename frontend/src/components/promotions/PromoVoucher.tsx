'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Loader2, Sailboat, Moon, Layers, CheckCircle2, RotateCcw, Tag, Info } from 'lucide-react';
import {
  formatPromoDiscount,
  formatPromoWindow,
  bookingPromoHref,
  parseAppliesTo,
  appliesToLabel,
  type CatalogPromo,
  type PromoAppliesTo,
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
  appliesTo?: PromoAppliesTo | string | null;
  muted?: boolean;
  badge?: string;
  minNights?: number | null;
  maxDiscount?: number | null;
  boatTicketCount?: number | null;
  boatAddonMode?: 'free' | 'paid' | null;
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
  appliesTo,
  muted = false,
  badge,
  minNights,
  maxDiscount,
  boatTicketCount,
  footer,
}: PromoVoucherProps): React.ReactElement {
  const [flipped, setFlipped] = useState(false);

  const scope = parseAppliesTo(appliesTo);
  const scopeLabel = scope === 'both' ? 'ห้องพัก + เรือ' : appliesToLabel(scope);
  const discountText = formatPromoDiscount(discountType, discountValue);
  const windowText = formatPromoWindow(startDate, endDate);

  return (
    <div
      className={`relative transition-opacity ${muted ? 'opacity-60' : ''}`}
      style={{ perspective: '1200px', minHeight: '160px' }}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          minHeight: '160px',
        }}
      >
        {/* ──── FRONT ──── */}
        <div
          className="absolute inset-0 w-full overflow-hidden rounded-2xl border border-forest-100/60 bg-gradient-to-br from-white to-forest-50/30 shadow-sm hover:shadow-md hover:border-forest-200 transition-all"
          style={{ backfaceVisibility: 'hidden', minHeight: '160px' }}
        >
          <div className="flex h-full">
            {/* Left: discount slab */}
            <div
              className={`flex w-24 shrink-0 flex-col items-center justify-center px-2 py-4 text-center sm:w-28 ${
                discountType === 'percent' ? 'bg-forest-800' : 'bg-lagoon-800'
              }`}
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/70">ส่วนลด</p>
              <p
                className="mt-0.5 font-display font-bold leading-none text-white drop-shadow-sm"
                style={{ fontSize: discountText.length > 5 ? '1.3rem' : '1.8rem' }}
              >
                {discountText}
              </p>
              {boatTicketCount && boatTicketCount > 0 ? (
                <div className="mt-2 flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 backdrop-blur-sm shadow-sm">
                  <Sailboat size={9} className="text-white/90" />
                  <span className="text-[9px] font-medium text-white">ฟรี ×{boatTicketCount}</span>
                </div>
              ) : null}
            </div>

            {/* Perforation */}
            <div className="relative w-3 shrink-0" aria-hidden>
              <span className="absolute -left-1.5 top-0 h-3 w-3 rounded-full bg-cream-100 shadow-inner" />
              <span className="absolute -left-1.5 bottom-0 h-3 w-3 rounded-full bg-cream-100 shadow-inner" />
              <span className="absolute bottom-3 left-1/2 top-3 w-px -translate-x-1/2 border-l border-dashed border-forest-200/50" />
            </div>

            {/* Right body */}
            <div className="flex min-w-0 flex-1 flex-col justify-between p-3 sm:p-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded bg-forest-50 px-1.5 py-0.5 font-mono text-xs font-bold tracking-wider text-forest-700">
                        {code}
                      </span>
                      {badge ? (
                        <span className="rounded-full border border-bamboo-200 bg-bamboo-100 px-2 py-0.5 text-[10px] font-semibold text-bamboo-800">
                          {badge}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 font-display text-sm font-semibold leading-snug text-charcoal sm:text-base">
                      {name}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setFlipped(true)}
                    title="ดูเงื่อนไข"
                    className="shrink-0 rounded-lg p-1.5 text-stone-300 hover:bg-forest-50 hover:text-forest-600 transition-colors"
                  >
                    <Info size={16} />
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-charcoal-400">
                  <span className="flex items-center gap-1"><Tag size={10} />{scopeLabel}</span>
                  <span className="text-stone-300">·</span>
                  <span>{windowText}</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {footer}
              </div>
            </div>
          </div>
        </div>

        {/* ──── BACK ──── */}
        <div
          className="absolute inset-0 w-full overflow-hidden rounded-2xl border border-forest-100 bg-forest-800 shadow-md"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            minHeight: '160px',
          }}
        >
          <div className="flex h-full flex-col justify-between p-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-cream-200/70">เงื่อนไขการใช้</p>
                <button
                  type="button"
                  onClick={() => setFlipped(false)}
                  className="rounded-full p-1 text-cream-200/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <RotateCcw size={14} />
                </button>
              </div>

              {description ? (
                <p className="mb-3 text-sm leading-relaxed text-cream-100/90">{description}</p>
              ) : null}

              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-xs text-cream-100/80">
                  <Tag size={12} className="shrink-0 text-bamboo-300" />
                  <span>ใช้ได้กับ {scopeLabel}</span>
                </li>
                {minNights && minNights > 0 ? (
                  <li className="flex items-center gap-2 text-xs text-cream-100/80">
                    <Moon size={12} className="shrink-0 text-bamboo-300" />
                    <span>เข้าพักขั้นต่ำ {minNights} คืน</span>
                  </li>
                ) : null}
                {maxDiscount && maxDiscount > 0 ? (
                  <li className="flex items-center gap-2 text-xs text-cream-100/80">
                    <span className="shrink-0 font-semibold text-bamboo-300">฿</span>
                    <span>ส่วนลดสูงสุด ฿{maxDiscount.toLocaleString()}</span>
                  </li>
                ) : null}
                {boatTicketCount && boatTicketCount > 0 ? (
                  <li className="flex items-center gap-2 text-xs font-semibold text-bamboo-200">
                    <Sailboat size={12} className="shrink-0 text-bamboo-300" />
                    <span>แถมตั๋วเรือคายัคฟรี {boatTicketCount} ใบ</span>
                  </li>
                ) : null}
                <li className="flex items-center gap-2 text-xs text-cream-100/70">
                  <Layers size={12} className="shrink-0 text-bamboo-300" />
                  <span>{stackable ? 'ใช้ซ้อนกับโค้ดอื่นได้' : 'ไม่สามารถใช้ซ้อนกับโค้ดอื่น'}</span>
                </li>
              </ul>
            </div>

            <p className="mt-3 text-right text-[10px] text-cream-100/40">{windowText}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Booking links: only show kayak if applies_to is explicitly 'kayak' ───
interface PromoBookingLinksProps {
  code: string;
  appliesTo?: PromoAppliesTo | string | null;
  roomLabel: string;
  kayakLabel: string;
}

export function PromoBookingLinks({ code, appliesTo, roomLabel, kayakLabel }: PromoBookingLinksProps): React.ReactElement {
  const scope = parseAppliesTo(appliesTo);
  const showRoom = scope === 'room' || scope === 'both';
  const showKayak = scope === 'kayak'; // strict: only if explicitly kayak
  return (
    <>
      {showRoom ? (
        <Link href={bookingPromoHref('room', code)} className="btn-primary px-3 py-1.5 text-xs">
          {roomLabel}
        </Link>
      ) : null}
      {showKayak ? (
        <Link href={bookingPromoHref('kayak', code)} className="btn-secondary bg-white px-3 py-1.5 text-xs">
          {kayakLabel}
        </Link>
      ) : null}
    </>
  );
}

// ─── Collect / CTA ───
interface CollectButtonProps {
  code: string;
  loading: boolean;
  status: WalletStatus | null;
  isCollectible: boolean;
  isCustomer: boolean;
  isAuthenticated: boolean;
  appliesTo?: PromoAppliesTo | string | null;
  onCollect: () => void;
  onLogin: () => void;
}

export function PromoCollectAction({
  code,
  loading,
  status,
  isCollectible,
  isCustomer,
  isAuthenticated,
  appliesTo,
  onCollect,
  onLogin,
}: CollectButtonProps): React.ReactElement {
  if (!isCollectible) {
    return (
      <PromoBookingLinks code={code} appliesTo={appliesTo} roomLabel="จองห้องพัก" kayakLabel="จองเรือ" />
    );
  }

  if (status === 'saved') {
    return (
      <>
        <span className="flex items-center gap-1 rounded-lg border border-forest-100 bg-forest-50 px-2.5 py-1.5 text-xs font-semibold text-forest-700">
          <CheckCircle2 size={13} /> เก็บแล้ว
        </span>
        <PromoBookingLinks code={code} appliesTo={appliesTo} roomLabel="จองห้องพัก" kayakLabel="จองเรือ" />
      </>
    );
  }

  if (status === 'used') {
    return <span className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-400">ใช้สิทธิ์แล้ว</span>;
  }

  if (status === 'expired') {
    return <span className="rounded-lg bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-400">หมดอายุ</span>;
  }

  if (!isAuthenticated) {
    return (
      <button type="button" className="btn-primary px-4 py-1.5 text-xs" onClick={onLogin}>
        เข้าสู่ระบบเพื่อเก็บ
      </button>
    );
  }

  if (!isCustomer) {
    return <span className="text-xs text-stone-400">เฉพาะลูกค้าสมาชิก</span>;
  }

  return (
    <button
      type="button"
      className="btn-primary px-5 py-1.5 text-xs font-semibold disabled:opacity-60"
      onClick={onCollect}
      disabled={loading}
    >
      {loading ? <Loader2 size={14} className="inline animate-spin" /> : 'เก็บคูปอง'}
    </button>
  );
}
