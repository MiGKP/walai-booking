'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Loader2, Info, RotateCcw, Sailboat, Tag, CalendarClock, Moon, CheckCircle2 } from 'lucide-react';
import {
  formatPromoDiscount,
  formatPromoWindow,
  bookingPromoHref,
  parseAppliesTo,
  promoAllowsScope,
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
  boatAddonMode,
  footer,
}: PromoVoucherProps): React.ReactElement {
  const [flipped, setFlipped] = useState(false);

  const appliesLabel =
    parseAppliesTo(appliesTo) === 'both'
      ? 'ใช้ได้กับห้องพักและเรือคายัค'
      : `ใช้เฉพาะ ${appliesToLabel(parseAppliesTo(appliesTo))}`;

  return (
    <div className="relative w-full perspective-[1500px] h-[190px] sm:h-[180px] group mb-4">
      <div 
        className={`relative w-full h-full duration-700 [transform-style:preserve-3d] transition-transform ${flipped ? '[transform:rotateY(180deg)]' : ''}`}
      >
        
        {/* ================= FRONT CARD ================= */}
        <article
          className={`absolute inset-0 [backface-visibility:hidden] flex overflow-hidden rounded-[22px] border shadow-sm ${
            muted ? 'border-stone-200 opacity-70 bg-cream-50' : 'border-bamboo-200 bg-cream-100 shadow-bamboo-100/50'
          }`}
        >
          {/* Left Stub */}
          <div className="flex w-[6.5rem] sm:w-[8.5rem] shrink-0 flex-col items-center justify-center bg-forest-800 px-3 py-5 text-center text-cream-100">
            <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.15em] text-bamboo-300">
              ส่วนลด
            </p>
            <p className="mt-1 font-display text-2xl sm:text-4xl font-semibold leading-none text-white drop-shadow-sm">
              {formatPromoDiscount(discountType, discountValue)}
            </p>
            {boatTicketCount && boatTicketCount > 0 && (
               <div className="mt-3 flex items-center gap-1 bg-forest-900/50 rounded-full px-2 py-0.5 border border-forest-600/30">
                 <Sailboat size={10} className="text-bamboo-300" />
                 <span className="text-[10px] text-bamboo-300 font-medium">ฟรี x{boatTicketCount}</span>
               </div>
            )}
          </div>
          
          {/* Tear Line */}
          <div className={`relative w-4 shrink-0 ${muted ? 'bg-cream-50' : 'bg-cream-100'}`} aria-hidden="true">
            <span className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-[#FDFBF7]" />
            <span className="absolute -left-2 bottom-0 h-4 w-4 rounded-full bg-[#FDFBF7]" />
            <span className="absolute left-1/2 top-5 bottom-5 w-px -translate-x-1/2 border-l border-dashed border-stone-300" />
          </div>
          
          {/* Right Body */}
          <div className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-mono text-sm sm:text-base font-bold tracking-wide text-forest-800 bg-forest-50 px-2 py-0.5 rounded-md inline-block">
                    {code}
                  </p>
                  {badge && (
                    <span className="shrink-0 rounded-full bg-bamboo-100 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-bamboo-800 border border-bamboo-200">
                      {badge}
                    </span>
                  )}
                </div>
                <h2 className="mt-1.5 font-display text-base sm:text-lg text-charcoal font-medium leading-tight truncate">{name}</h2>
              </div>
              <button 
                type="button" 
                onClick={() => setFlipped(true)} 
                className="p-1.5 sm:p-2 text-stone-400 hover:text-forest-600 hover:bg-forest-50/50 rounded-full transition-colors shrink-0" 
                title="ดูเงื่อนไขเพิ่มเติม"
              >
                <Info size={18} />
              </button>
            </div>
            
            <p className="text-xs text-charcoal-400 mt-1 line-clamp-1">
              {formatPromoWindow(startDate, endDate)}
            </p>
            
            <div className="mt-auto pt-2 flex flex-wrap items-center gap-2">
              {footer}
            </div>
          </div>
        </article>

        {/* ================= BACK CARD ================= */}
        <article
          className={`absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col p-4 sm:p-5 rounded-[22px] border shadow-inner ${
            muted ? 'bg-stone-50 border-stone-200' : 'bg-stone-50 border-stone-200'
          }`}
        >
          <div className="flex justify-between items-start mb-2 border-b border-stone-200 pb-2">
            <h3 className="font-display font-semibold text-forest-800 flex items-center gap-2">
              <Tag size={16} className="text-bamboo-600" />
              เงื่อนไขการใช้งานโค้ด {code}
            </h3>
            <button 
              type="button" 
              onClick={() => setFlipped(false)} 
              className="p-1 text-stone-400 hover:text-forest-600 rounded-full transition-colors shrink-0"
              title="กลับไปด้านหน้า"
            >
              <RotateCcw size={16} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto text-xs sm:text-sm text-stone-600 space-y-2 pr-2 custom-scrollbar">
            {description && <p className="text-charcoal-600">{description}</p>}
            
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-2">
               <li className="flex items-start gap-1.5">
                 <span className="text-forest-600 mt-0.5">•</span> 
                 <span>{appliesLabel}</span>
               </li>
               <li className="flex items-start gap-1.5">
                 <span className="text-forest-600 mt-0.5">•</span> 
                 <span>{stackable ? 'ใช้ร่วมกับโค้ดอื่นได้' : 'ไม่สามารถใช้ร่วมกับโค้ดอื่นได้'}</span>
               </li>
               {minNights && minNights > 0 && (
                 <li className="flex items-start gap-1.5">
                   <Moon size={14} className="text-forest-500 shrink-0 mt-0.5" /> 
                   <span>เข้าพักขั้นต่ำ {minNights} คืน</span>
                 </li>
               )}
               {maxDiscount && maxDiscount > 0 && (
                 <li className="flex items-start gap-1.5">
                   <span className="text-forest-600 mt-0.5">•</span> 
                   <span>ลดสูงสุด ฿{maxDiscount.toLocaleString()}</span>
                 </li>
               )}
               {boatTicketCount && boatTicketCount > 0 && (
                 <li className="flex items-start gap-1.5 col-span-1 sm:col-span-2 bg-bamboo-50 px-2 py-1 rounded-md border border-bamboo-100 text-bamboo-800 mt-1">
                   <Sailboat size={14} className="text-bamboo-600 shrink-0 mt-0.5" /> 
                   <span>รับฟรี! ตั๋วพายเรือคายัค {boatTicketCount} ใบ</span>
                 </li>
               )}
            </ul>
          </div>
        </article>

      </div>
    </div>
  );
}

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

interface PromoBookingLinksProps {
  code: string;
  appliesTo?: PromoAppliesTo | string | null;
  roomLabel: string;
  kayakLabel: string;
}

export function PromoBookingLinks({
  code,
  appliesTo,
  roomLabel,
  kayakLabel,
}: PromoBookingLinksProps): React.ReactElement {
  const parsed = parseAppliesTo(appliesTo);
  const showRoom = promoAllowsScope(parsed, 'room');
  const showKayak = promoAllowsScope(parsed, 'kayak');
  return (
    <>
      {showRoom ? (
        <Link href={bookingPromoHref('room', code)} className="btn-primary px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm shadow-sm hover:shadow-md transition-all">
          {roomLabel}
        </Link>
      ) : null}
      {showKayak ? (
        <Link
          href={bookingPromoHref('kayak', code)}
          className={`${showRoom ? 'btn-secondary bg-white' : 'btn-primary'} px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm shadow-sm hover:shadow-md transition-all`}
        >
          {kayakLabel}
        </Link>
      ) : null}
    </>
  );
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
      <PromoBookingLinks
        code={code}
        appliesTo={appliesTo}
        roomLabel="จองห้องพัก"
        kayakLabel="จองเรือคายัค"
      />
    );
  }

  if (status === 'saved') {
    return (
      <>
        <span className="text-xs sm:text-sm font-semibold text-forest-700 bg-forest-50 px-2 py-1 rounded-md border border-forest-100 flex items-center gap-1">
          <CheckCircle2 size={14} /> เก็บแล้ว
        </span>
        <PromoBookingLinks
          code={code}
          appliesTo={appliesTo}
          roomLabel="ใช้จองห้องพัก"
          kayakLabel="ใช้จองเรือ"
        />
      </>
    );
  }

  if (status === 'used') {
    return <span className="text-xs sm:text-sm font-semibold text-stone-400 bg-stone-100 px-3 py-1.5 rounded-md border border-stone-200">ใช้สิทธิ์ไปแล้ว</span>;
  }

  if (status === 'expired') {
    return <span className="text-xs sm:text-sm font-semibold text-stone-400 bg-stone-100 px-3 py-1.5 rounded-md border border-stone-200">หมดอายุแล้ว</span>;
  }

  if (!isAuthenticated) {
    return (
      <button type="button" className="btn-primary px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm shadow-sm" onClick={onLogin}>
        เข้าสู่ระบบเพื่อเก็บ
      </button>
    );
  }

  if (!isCustomer) {
    return (
      <span className="text-xs sm:text-sm text-stone-400">เฉพาะลูกค้าระบบสมาชิก</span>
    );
  }

  return (
    <button
      type="button"
      className="btn-primary px-4 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm shadow-sm hover:shadow-md transition-all font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
      onClick={onCollect}
      disabled={loading}
    >
      {loading ? <Loader2 size={16} className="inline animate-spin" /> : 'เก็บคูปอง'}
    </button>
  );
}


