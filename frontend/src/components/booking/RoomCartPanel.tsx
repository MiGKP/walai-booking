'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, Trash2, Minus, Plus } from 'lucide-react';
import {
  RoomCartState,
  cartCapacitySum,
  cartEstimatedTotal,
  cartGuestTotal,
  cartRoomCount,
  setCartItemQuantity,
} from '@/lib/room-cart';
import { formatThaiDate, nightsBetween } from '@/lib/date';
import PromoPriceBreakdown from '@/components/booking/PromoPriceBreakdown';
import PromoCodeFields, {
  type PromoPreview,
} from '@/components/booking/PromoCodeFields';

interface RoomCartPanelProps {
  cart: RoomCartState;
  onChange: (next: RoomCartState) => void;
  onClear: () => void;
  onCheckout: (options?: { promotion_ids?: number[] }) => void;
  checkoutLoading?: boolean;
}

export default function RoomCartPanel({
  cart,
  onChange,
  onClear,
  onCheckout,
  checkoutLoading = false,
}: RoomCartPanelProps): React.ReactElement {
  const nights = nightsBetween(cart.check_in, cart.check_out);
  const capacity = cartCapacitySum(cart);
  const guests = cartGuestTotal(cart);
  const baseTotal = cartEstimatedTotal(cart);
  const roomCount = cartRoomCount(cart);
  const overCapacity = guests > capacity;
  const empty = cart.items.length === 0;

  const [promoIds, setPromoIds] = useState<number[]>([]);
  const [promoPreview, setPromoPreview] = useState<PromoPreview | null>(null);

  useEffect(() => {
    setPromoIds([]);
    setPromoPreview(null);
  }, [cart.check_in, cart.check_out, baseTotal]);

  return (
    <aside className="rounded-2xl border border-stone-200 bg-cream-100 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="font-display text-lg font-semibold text-forest-800 flex items-center gap-2">
          <ShoppingBag size={18} aria-hidden="true" />
          การจองของคุณ
        </h2>
        {!empty && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-charcoal-400 hover:text-red-600 inline-flex items-center gap-1"
          >
            <Trash2 size={12} aria-hidden="true" />
            ล้าง
          </button>
        )}
      </div>

      <p className="text-sm text-charcoal-500 mb-3">
        {formatThaiDate(cart.check_in)} – {formatThaiDate(cart.check_out)}
        <span className="text-charcoal-400"> · {nights} คืน</span>
      </p>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <label className="block">
          <span className="mb-1 block text-xs text-charcoal-400">ผู้ใหญ่</span>
          <input
            type="number"
            min={1}
            className="input-field"
            value={cart.adults}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (!Number.isFinite(value)) return;
              onChange({
                ...cart,
                adults: Math.max(1, Math.floor(value)),
              });
            }}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-charcoal-400">เด็ก</span>
          <input
            type="number"
            min={0}
            className="input-field"
            value={cart.children}
            onChange={(event) => {
              const value = Number(event.target.value);
              if (!Number.isFinite(value)) return;
              onChange({
                ...cart,
                children: Math.max(0, Math.floor(value)),
              });
            }}
          />
        </label>
      </div>

      <p className={`text-xs mb-4 ${overCapacity ? 'text-red-600' : 'text-charcoal-400'}`}>
        ผู้เข้าพัก {guests} คน · ความจุรวม {capacity || 0} คน
        {overCapacity ? ' — เกินความจุ ต้องเพิ่มห้อง' : ''}
      </p>

      {empty ? (
        <p className="text-sm text-charcoal-400 py-6 text-center">
          ยังไม่มีห้องในรายการ — กดเพิ่มจากรายการห้อง
        </p>
      ) : (
        <ul className="space-y-3 mb-4">
          {cart.items.map((item) => (
            <li
              key={item.room_type_id}
              className="rounded-xl border border-stone-200 bg-cream-50 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-forest-800">{item.room_name}</p>
                  {item.type_name && (
                    <p className="text-xs text-charcoal-400">{item.type_name}</p>
                  )}
                  <p className="text-xs text-charcoal-400 mt-1">
                    ฿{item.price_per_night.toLocaleString()} / คืน · ความจุ {item.capacity}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="h-7 w-7 rounded-lg border border-stone-200 flex items-center justify-center text-forest-800"
                    onClick={() =>
                      onChange(setCartItemQuantity(cart, item.room_type_id, item.quantity - 1))
                    }
                    aria-label="ลดจำนวน"
                  >
                    <Minus size={12} />
                  </button>
                  <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                  <button
                    type="button"
                    className="h-7 w-7 rounded-lg border border-stone-200 flex items-center justify-center text-forest-800 disabled:opacity-40"
                    disabled={item.quantity >= item.available_count}
                    onClick={() =>
                      onChange(setCartItemQuantity(cart, item.room_type_id, item.quantity + 1))
                    }
                    aria-label="เพิ่มจำนวน"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!empty && nights > 0 ? (
        <div className="mb-4 space-y-3 border-t border-stone-200 pt-3">
          <PromoCodeFields
            basePrice={baseTotal}
            nights={nights}
            scope="room"
            onChange={(ids, next) => {
              setPromoIds(ids);
              setPromoPreview(next);
            }}
          />
          <p className="text-[11px] text-charcoal-400">{roomCount} ห้อง</p>
          <PromoPriceBreakdown
            basePrice={baseTotal}
            promo={
              promoPreview
                ? {
                    name: promoPreview.lines[0]?.name ?? '',
                    code: promoPreview.lines[0]?.code,
                    discount_amount: promoPreview.discount_amount,
                    final_price: promoPreview.final_price,
                  }
                : null
            }
            lines={promoPreview?.lines}
          />
        </div>
      ) : nights > 0 ? (
        <div className="mb-4 space-y-3 border-t border-stone-200 pt-3">
          <PromoCodeFields
            basePrice={0}
            nights={nights}
            scope="room"
            onChange={(ids, next) => {
              setPromoIds(ids);
              setPromoPreview(next);
            }}
          />
        </div>
      ) : null}

      {empty && (
        <div className="border-t border-stone-200 pt-3 mb-4 flex items-center justify-between">
          <span className="text-sm text-charcoal-500">ยังไม่มีรายการ</span>
          <span className="font-display text-lg font-semibold text-forest-800">฿0</span>
        </div>
      )}

      <button
        type="button"
        className="btn-primary w-full disabled:opacity-50"
        disabled={empty || overCapacity || checkoutLoading}
        onClick={() =>
          onCheckout(
            promoIds.length > 0 ? { promotion_ids: promoIds } : undefined
          )
        }
      >
        {checkoutLoading ? 'กำลังจอง…' : 'ยืนยันการจอง'}
      </button>
    </aside>
  );
}
