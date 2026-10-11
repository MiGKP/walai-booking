'use client';

import React, { useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Minus, Trash2 } from 'lucide-react';
import { useRoomCart } from '@/lib/room-cart-store';
import { useCartSync } from '@/hooks/useCartSync';
import { RoomCartItem } from '@/lib/room-cart';
import { formatThaiDate } from '@/lib/date';
import { resolveCheckoutDetails } from '@/lib/booking-checkout';

export default function BookingSummaryCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cart = useRoomCart();
  const cardRef = useRef<HTMLDivElement>(null);

  const { checkIn, checkOut, adults, children, childAges } = resolveCheckoutDetails(new URLSearchParams(searchParams.toString()), cart);

  const { commit: commitCart, clearAll: clearCartEverywhere } = useCartSync({ 
    checkIn, 
    checkOut, 
    adults, 
    children,
    childAges,
  });

  // Filter out any generic items just in case (roomId === null), though the UI should only add specific rooms now.
  const cartItems = (cart?.items ?? []).filter(item => item.room_id !== null);
  const hasDateMismatch = !!(cart && cart.items.length > 0 && checkIn && checkOut && (cart.check_in !== checkIn || cart.check_out !== checkOut));

  const groupedItems = cartItems.reduce((acc, item) => {
    if (!acc[item.room_type_id]) {
      acc[item.room_type_id] = {
        typeId: item.room_type_id,
        typeName: item.type_name || item.room_name.replace(/\s*\(ห้อง.*\)/, '').trim(),
        pricePerNight: item.price_per_night,
        rooms: []
      };
    }
    acc[item.room_type_id].rooms.push(item);
    return acc;
  }, {} as Record<number, { typeId: number; typeName: string; pricePerNight: number; rooms: RoomCartItem[] }>);

  const groups = Object.values(groupedItems);

  const handleRemoveType = (typeId: number) => {
    const nextItems = cart?.items.filter(item => item.room_type_id !== typeId) ?? [];
    commitCart(nextItems);
  };

  const handleRemoveRoom = (typeId: number, roomId: number | null) => {
    if (!roomId) return;
    const nextItems = cart?.items.filter(item => !(item.room_type_id === typeId && item.room_id === roomId)) ?? [];
    commitCart(nextItems);
  };

  const handleConfirmBooking = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('check_in', checkIn);
    params.set('check_out', checkOut);
    params.set('adults', String(adults));
    params.set('children', String(children));
    if (childAges.length > 0) params.set('child_ages', childAges.join(','));
    router.push(`/booking/details?${params.toString()}`);
  };

  if (cartItems.length === 0) {
    return (
      <div ref={cardRef} className="rounded-3xl border border-stone-200/80 bg-white/95 backdrop-blur-xl shadow-xl shadow-stone-200/40 flex flex-col">
        <div className="flex items-center justify-between border-b border-stone-100/80 px-6 py-5 bg-stone-50/40 rounded-t-3xl shrink-0">
          <h3 className="font-display text-lg font-semibold text-forest-900 tracking-tight">รายการห้องพัก</h3>
        </div>
        <div className="p-8 text-center text-sm font-medium text-stone-400">
          ยังไม่ได้เลือกห้องพัก
        </div>
      </div>
    );
  }

  return (
    <>
    <div ref={cardRef} className="rounded-3xl border border-stone-200/80 bg-white/95 backdrop-blur-xl shadow-xl shadow-stone-200/40 flex flex-col max-h-[calc(100vh-2rem)]">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-stone-100/80 px-6 py-5 bg-stone-50/40 rounded-t-3xl shrink-0">
        <div>
          <h3 className="font-display text-lg font-semibold text-forest-900 tracking-tight">รายการห้องพัก</h3>
          <p className="text-[11px] font-medium text-stone-500 mt-0.5">{cartItems.length} ห้องที่เลือก <span className="mx-1">•</span> {cart?.check_in && cart?.check_out ? `${formatThaiDate(cart.check_in)} - ${formatThaiDate(cart.check_out)}` : ''}</p>
        </div>
        <button type="button" onClick={clearCartEverywhere} className="text-[11px] font-bold uppercase tracking-wider text-stone-400 transition-colors hover:text-red-600 underline underline-offset-2">
          ล้างทั้งหมด
        </button>
      </div>

      <div className="space-y-4 px-6 py-6 overflow-y-auto custom-scrollbar">
        {groups.map(group => (
          <div key={group.typeId} className="rounded-2xl border border-stone-200/80 bg-white shadow-xs overflow-hidden flex flex-col max-h-[220px]">
            <div className="flex items-center justify-between bg-stone-50 px-4 py-3 border-b border-stone-100 shrink-0">
              <span className="font-bold text-sm text-forest-900">{group.typeName}</span>
              <button onClick={() => handleRemoveType(group.typeId)} className="text-stone-400 hover:text-red-500 transition-colors">
                <Trash2 size={16} />
              </button>
            </div>
            <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {group.rooms.map(room => (
                <div key={room.room_id} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-stone-50 transition-colors">
                  <span className="text-sm font-semibold text-forest-800">ห้อง {room.room_number}</span>
                  <button onClick={() => handleRemoveRoom(group.typeId, room.room_id ?? null)} className="grid h-7 w-7 place-items-center rounded-full bg-stone-100 text-stone-500 hover:bg-red-100 hover:text-red-600 transition-colors shrink-0">
                    <Minus size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div className="border-t border-stone-100 bg-stone-50/50 p-6 rounded-b-3xl shrink-0">
        {hasDateMismatch && (
          <div className="mb-3 rounded-xl bg-red-50 p-3 text-[11px] text-red-600 border border-red-100 font-medium leading-relaxed">
            <span className="font-bold text-red-700">ไม่สามารถจองคนละวันพร้อมกันได้!</span><br/>
            คุณเลือกวันในช่องค้นหา ({formatThaiDate(checkIn)} - {formatThaiDate(checkOut)}) ไม่ตรงกับรายการในตะกร้า ({formatThaiDate(cart.check_in)} - {formatThaiDate(cart.check_out)})
          </div>
        )}
        <button 
          onClick={handleConfirmBooking} 
          disabled={hasDateMismatch}
          className="relative w-full overflow-hidden rounded-xl bg-forest-900 py-4 text-sm font-bold text-white shadow-lg shadow-forest-900/20 transition-all hover:bg-forest-800 hover:shadow-xl hover:shadow-forest-900/30 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none"
        >
          จองรายการนี้
        </button>
      </div>
    </div>

    {/* MOBILE STICKY BAR */}
    <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col border-t border-stone-200/80 bg-white/95 shadow-[0_-8px_30px_rgba(18,60,48,0.12)] backdrop-blur-xl lg:hidden">
      {hasDateMismatch && (
        <div className="bg-red-50 px-5 py-2 text-[10px] text-red-600 border-b border-red-100 font-medium">
          <span className="font-bold">วันที่จองไม่ตรงกัน!</span> เปลี่ยนให้ตรงกับตะกร้า ({formatThaiDate(cart.check_in)}) ก่อน
        </div>
      )}
      <div className="flex items-center justify-between gap-3 px-5 py-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">ห้องพักที่เลือก</p>
          <p className="truncate text-lg font-extrabold tracking-tight text-forest-900">{cartItems.length} ห้อง</p>
        </div>
        <button
          type="button"
          onClick={handleConfirmBooking}
          disabled={hasDateMismatch}
          className="shrink-0 rounded-xl bg-forest-900 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-forest-900/20 transition-all hover:bg-forest-800 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
        >
          จองรายการนี้
        </button>
      </div>
    </div>
    </>
  );
}
