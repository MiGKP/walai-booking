'use client';

import { useEffect, useRef, useState } from 'react';
import { ShoppingBag, Trash2, Minus, Plus, Tag, CheckCircle2, X, Loader2, Calendar } from 'lucide-react';
import {
  RoomCartState,
  cartCapacitySum,
  cartEstimatedTotal,
  cartGuestTotal,
  cartRoomCount,
  setCartItemQuantity,
} from '@/lib/room-cart';
import { formatThaiDate, nightsBetween } from '@/lib/date';
import api, { getApiErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import PromoPriceBreakdown from '@/components/booking/PromoPriceBreakdown';
import BookingCalendar, { DateRange, DayStatus } from '@/components/booking/BookingCalendar';
import { MonthCursor } from '@/lib/date';

interface AppliedPromo {
  id: number;
  name: string;
  code: string;
  discount_amount: number;
  final_price: number;
}

interface RoomCartPanelProps {
  cart: RoomCartState;
  onChange: (next: RoomCartState) => void;
  onClear: () => void;
  onCheckout: (options?: { promotion_id?: number }) => void;
  checkoutLoading?: boolean;
  autoAppliedPromoCode?: string | null;
  // Calendar props for inline editing
  range: DateRange | null;
  onRangeSelect: (range: DateRange | null) => void;
  cursor: MonthCursor;
  onCursorChange: (cursor: MonthCursor) => void;
  dayStatus: Record<string, DayStatus>;
  calendarLoading: boolean;
}

export default function RoomCartPanel({
  cart,
  onChange,
  onClear,
  onCheckout,
  checkoutLoading = false,
  autoAppliedPromoCode = null,
  range,
  onRangeSelect,
  cursor,
  onCursorChange,
  dayStatus,
  calendarLoading,
}: RoomCartPanelProps): React.ReactElement {
  const nights = nightsBetween(cart.check_in, cart.check_out);
  const capacity = cartCapacitySum(cart);
  const guests = cartGuestTotal(cart);
  const baseTotal = cartEstimatedTotal(cart);
  const roomCount = cartRoomCount(cart);
  const overCapacity = guests > capacity;
  const empty = cart.items.length === 0;

  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [showCalendar, setShowCalendar] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Sync with autoAppliedPromoCode from Room Cards
  useEffect(() => {
    if (autoAppliedPromoCode) {
      setPromoCode(autoAppliedPromoCode);
      const triggerApply = async () => {
        if (baseTotal <= 0 || nights <= 0) return;
        setPromoLoading(true);
        try {
          const res = await api.post('/promotions/validate', {
            code: autoAppliedPromoCode.trim(),
            price: baseTotal,
            nights,
          });
          const data = res.data.data as AppliedPromo;
          setAppliedPromo(data);
        } catch (error) {
          setAppliedPromo(null);
        } finally {
          setPromoLoading(false);
        }
      };
      void triggerApply();
    } else {
      setPromoCode('');
      setAppliedPromo(null);
    }
  }, [autoAppliedPromoCode, baseTotal, nights]);

  useEffect(() => {
    if (!autoAppliedPromoCode) {
      setAppliedPromo(null);
      setPromoCode('');
    }
  }, [cart.check_in, cart.check_out]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target as Node)) {
        setShowCalendar(false);
      }
    };
    if (showCalendar) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCalendar]);

  const handleApplyPromo = async (): Promise<void> => {
    if (!promoCode.trim() || baseTotal <= 0 || nights <= 0) return;
    setPromoLoading(true);
    try {
      const res = await api.post('/promotions/validate', {
        code: promoCode.trim(),
        price: baseTotal,
        nights,
      });
      const data = res.data.data as AppliedPromo;
      setAppliedPromo(data);
      toast.success(`ใช้โค้ด "${data.code}" สำเร็จ`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'โค้ดส่วนลดไม่ถูกต้องหรือหมดอายุ'));
    } finally {
      setPromoLoading(false);
    }
  };

  const updateGuests = (adults: number, children: number) => {
    onChange({
      ...cart,
      adults: Math.max(1, adults),
      children: Math.max(0, children),
    });
  };

  return (
    <aside className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-sans text-[18px] font-semibold text-forest-900 flex items-center gap-2">
          <ShoppingBag size={20} className="text-forest-700" />
          การจองของคุณ
        </h2>
        {!empty && (
          <button
            type="button"
            onClick={onClear}
            className="text-[12px] font-medium text-charcoal-400 hover:text-red-500 transition-colors"
          >
            ล้างทั้งหมด
          </button>
        )}
      </div>

      <div className="relative mb-6">
        <button
          onClick={() => setShowCalendar(!showCalendar)}
          className="w-full text-left group transition-all"
        >
          <div className="flex items-center gap-3 rounded-xl border border-stone-100 bg-stone-50/50 p-3 group-hover:border-forest-200 group-hover:bg-forest-50/30">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-forest-700 shadow-sm">
              <Calendar size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-sans text-[14px] font-semibold text-forest-900 truncate">
                {formatThaiDate(cart.check_in)} – {formatThaiDate(cart.check_out)}
              </p>
              <p className="text-[11px] font-medium text-charcoal-400 uppercase tracking-tight">
                เข้าพัก {nights} คืน
              </p>
            </div>
          </div>
        </button>

        {showCalendar && (
          <div 
            ref={calendarRef}
            className="absolute left-0 top-full z-50 mt-2 w-full min-w-[320px] lg:-left-20 lg:w-[450px] rounded-2xl border border-stone-200 bg-white p-4 shadow-2xl animate-dropdown"
          >
            <BookingCalendar
              mode="range"
              value={range}
              onSelect={(r) => {
                onRangeSelect(r);
                if (r && nightsBetween(r.start, r.end) > 0) {
                  setShowCalendar(false);
                }
              }}
              cursor={cursor}
              onCursorChange={onCursorChange}
              dayStatus={dayStatus}
              loading={calendarLoading}
              minISO={cart.check_in < cart.check_in ? cart.check_in : undefined} // today logic handled in page
            />
          </div>
        )}
      </div>

      {/* Side-by-side Guest Steppers */}
      <div className="mb-6 rounded-xl border border-stone-100 bg-stone-50/50 p-3">
        <div className="flex items-center divide-x divide-stone-200">
          {/* Adults */}
          <div className="flex-1 px-1">
            <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-charcoal-400">ผู้ใหญ่</p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => updateGuests(cart.adults - 1, cart.children)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white text-forest-800 hover:bg-forest-50 disabled:opacity-30 transition-colors shadow-sm"
                disabled={cart.adults <= 1}
              >
                <Minus size={12} />
              </button>
              <span className="w-4 text-center text-[14px] font-bold text-forest-900 tabular-nums">{cart.adults}</span>
              <button
                type="button"
                onClick={() => updateGuests(cart.adults + 1, cart.children)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white text-forest-800 hover:bg-forest-50 transition-colors shadow-sm"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
          {/* Children */}
          <div className="flex-1 px-1">
            <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-wider text-charcoal-400">เด็ก</p>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => updateGuests(cart.adults, cart.children - 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white text-forest-800 hover:bg-forest-50 disabled:opacity-30 transition-colors shadow-sm"
                disabled={cart.children <= 0}
              >
                <Minus size={12} />
              </button>
              <span className="w-4 text-center text-[14px] font-bold text-forest-900 tabular-nums">{cart.children}</span>
              <button
                type="button"
                onClick={() => updateGuests(cart.adults, cart.children + 1)}
                className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white text-forest-800 hover:bg-forest-50 transition-colors shadow-sm"
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>
        {overCapacity && (
          <p className="mt-2 text-center text-[10px] font-bold text-red-500 uppercase tracking-tight animate-pulse">
            เกินความจุรวม ({capacity} ท่าน)
          </p>
        )}
      </div>

      {empty ? (
        <div className="py-10 text-center flex flex-col items-center gap-2">
          <ShoppingBag size={32} className="text-stone-200" />
          <p className="text-[13px] font-medium text-charcoal-400 tracking-tight">ยังไม่มีห้องในรายการ</p>
        </div>
      ) : (
        <div className="mb-6 space-y-2">
          {cart.items.map((item) => (
            <div
              key={item.room_type_id}
              className="group relative rounded-xl border border-stone-100 p-3 transition-all hover:border-forest-200 hover:shadow-sm bg-white"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-forest-900">{item.room_name}</p>
                  <p className="text-[11px] font-semibold text-charcoal-400">
                    ฿{item.price_per_night.toLocaleString()} / คืน
                  </p>
                </div>
                <div className="flex items-center gap-2 bg-stone-50 rounded-lg p-1 border border-stone-100">
                  <button
                    type="button"
                    onClick={() => onChange(setCartItemQuantity(cart, item.room_type_id, item.quantity - 1))}
                    className="flex h-6 w-6 items-center justify-center rounded bg-white border border-stone-200 text-charcoal-400 hover:text-forest-800 shadow-xs"
                  >
                    <Minus size={10} />
                  </button>
                  <span className="w-4 text-center text-[12px] font-bold text-forest-900 tabular-nums">{item.quantity}</span>
                  <button
                    type="button"
                    disabled={item.quantity >= item.available_count}
                    onClick={() => onChange(setCartItemQuantity(cart, item.room_type_id, item.quantity + 1))}
                    className="flex h-6 w-6 items-center justify-center rounded bg-white border border-stone-200 text-charcoal-400 hover:text-forest-800 disabled:opacity-20 shadow-xs"
                  >
                    <Plus size={10} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!empty && nights > 0 && (
        <div className="mb-6 space-y-4 border-t border-stone-100 pt-6">
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-charcoal-500">
              <Tag size={13} className="text-forest-600" />
              โค้ดส่วนลด
            </label>
            {appliedPromo ? (
              <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2.5 border border-emerald-100 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <CheckCircle2 size={12} />
                  </div>
                  <div>
                    <p className="text-[12px] font-bold text-emerald-900">{appliedPromo.name}</p>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">{appliedPromo.code}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAppliedPromo(null);
                    setPromoCode('');
                  }}
                  className="text-emerald-400 hover:text-emerald-600 transition-colors p-1"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  className="w-full rounded-xl border border-stone-200 bg-stone-50/30 px-3 py-2 text-[13px] font-medium placeholder:text-stone-300 focus:border-forest-500 focus:outline-none transition-all"
                  placeholder="กรอกโค้ด"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                />
                <button
                  type="button"
                  onClick={handleApplyPromo}
                  disabled={promoLoading || !promoCode.trim()}
                  className="rounded-xl bg-forest-900 px-4 text-[12px] font-bold text-white transition-all hover:bg-forest-800 disabled:opacity-30 shadow-md active:scale-95"
                >
                  {promoLoading ? <Loader2 size={14} className="animate-spin" /> : 'ใช้'}
                </button>
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-stone-50 pt-4">
            <PromoPriceBreakdown basePrice={baseTotal} promo={appliedPromo} />
          </div>
        </div>
      )}

      <button
        type="button"
        disabled={empty || overCapacity || checkoutLoading}
        onClick={() => onCheckout(appliedPromo ? { promotion_id: appliedPromo.id } : undefined)}
        className="w-full rounded-xl bg-forest-900 py-4 text-[14px] font-bold text-white transition-all hover:bg-forest-800 disabled:opacity-40 active:scale-[0.98] shadow-lg shadow-forest-900/20 uppercase tracking-wide"
      >
        {checkoutLoading ? 'กำลังดำเนินการ...' : 'ยืนยันการจอง'}
      </button>
    </aside>
  );
}
