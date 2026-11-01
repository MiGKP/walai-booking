'use client';

import React, { useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ChevronUp, Minus, Trash2, X } from 'lucide-react';
import { useRoomCart, setRoomCart } from '@/lib/room-cart-store';
import { useCartSync } from '@/hooks/useCartSync';
import { useGuestAgePolicy } from '@/hooks/useInfantAgePolicy';
import { RoomCartItem, roomOccupancy } from '@/lib/room-cart';
import { formatThaiDate, nightsBetween } from '@/lib/date';
import { resolveCheckoutDetails } from '@/lib/booking-checkout';

// แสดงการ์ดสรุปรายการห้องพักที่เลือกพร้อมตรวจสอบความจุและปุ่มดำเนินการจองต่อ
export default function BookingSummaryCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cart = useRoomCart();
  const cardRef = useRef<HTMLDivElement>(null);
  const policy = useGuestAgePolicy();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { checkIn, checkOut, adults, children, childAges } = resolveCheckoutDetails(
    new URLSearchParams(searchParams.toString()),
    cart
  );

  const { clearAll: clearCartEverywhere } = useCartSync({
    checkIn,
    checkOut,
    adults,
    children,
    childAges,
  });

  const cartItems = (cart?.items ?? []).filter((item) => item.room_id !== null);
  const hasDateMismatch = !!(
    cart &&
    cart.items.length > 0 &&
    checkIn &&
    checkOut &&
    (cart.check_in !== checkIn || cart.check_out !== checkOut)
  );
  const hasIncompleteDates = !checkIn || !checkOut || checkOut <= checkIn;

  const totalCapacity = cartItems.reduce((sum, item) => sum + Number(item.capacity || 0), 0);
  const occupancy = roomOccupancy({
    adults,
    children,
    childAges,
    infantAge: policy.infantAge,
    capacity: totalCapacity,
    roomCount: cartItems.length,
  });
  const totalGuests = occupancy.occupyingGuests;
  const isCapacityInsufficient = cartItems.length > 0 && !occupancy.fits;
  const missingCapacity = occupancy.missingCapacity;

  const nights = nightsBetween(checkIn, checkOut);
  const totalBasePerNight = cartItems.reduce((sum, item) => sum + (Number(item.price_per_night) || 0), 0);
  const estimatedTotal = nights > 0 ? totalBasePerNight * nights : totalBasePerNight;

  const groupedItems = cartItems.reduce(
    (acc, item) => {
      if (!acc[item.room_type_id]) {
        acc[item.room_type_id] = {
          typeId: item.room_type_id,
          typeName: item.type_name || item.room_name.replace(/\s*\(ห้อง.*\)/, '').trim(),
          pricePerNight: item.price_per_night,
          rooms: [],
        };
      }
      acc[item.room_type_id].rooms.push(item);
      return acc;
    },
    {} as Record<number, { typeId: number; typeName: string; pricePerNight: number; rooms: RoomCartItem[] }>
  );

  const groups = Object.values(groupedItems);

  // ลบห้องพักทั้งหมดในประเภทห้องที่เลือกออกจากตะกร้า
  const handleRemoveType = (typeId: number) => {
    const nextItems = cart?.items.filter((item) => item.room_type_id !== typeId) ?? [];
    if (cart) setRoomCart(nextItems.length ? { ...cart, items: nextItems } : null);
  };

  // ลบห้องพักรายห้องที่ระบุออกจากตะกร้า
  const handleRemoveRoom = (typeId: number, roomId: number | null) => {
    if (!roomId) return;
    const nextItems = cart?.items.filter((item) => !(item.room_type_id === typeId && item.room_id === roomId)) ?? [];
    if (cart) setRoomCart(nextItems.length ? { ...cart, items: nextItems } : null);
  };

  // นำทางไปยังหน้ากรอกรายละเอียดการจองพร้อมส่งค่าวันเข้าพักและจำนวนผู้เข้าพัก
  const handleConfirmBooking = () => {
    if (hasIncompleteDates || hasDateMismatch || isCapacityInsufficient) return;
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
      <div ref={cardRef} className="hidden lg:flex rounded-3xl border border-stone-200/80 bg-white/95 backdrop-blur-xl shadow-xl shadow-stone-200/40 flex-col max-h-[calc(100vh-2rem)]">
        <div className="flex items-center justify-between border-b border-stone-100/80 px-6 py-5 bg-stone-50/40 rounded-t-3xl shrink-0">
          <div>
            <h3 className="font-display text-lg font-semibold text-forest-900 tracking-tight">รายการห้องพัก</h3>
            <p className="text-[11px] font-medium text-stone-500 mt-0.5">
              {cartItems.length} ห้องที่เลือก <span className="mx-1">•</span>{' '}
              {cart?.check_in && cart?.check_out ? `${formatThaiDate(cart.check_in)} - ${formatThaiDate(cart.check_out)}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={clearCartEverywhere}
            className="text-[11px] font-bold uppercase tracking-wider text-stone-400 transition-colors hover:text-red-600 underline underline-offset-2"
          >
            ล้างทั้งหมด
          </button>
        </div>

        <div className="space-y-4 px-6 py-6 overflow-y-auto custom-scrollbar">
          {groups.map((group) => (
            <div key={group.typeId} className="rounded-2xl border border-stone-200/80 bg-white shadow-xs overflow-hidden flex flex-col max-h-[220px]">
              <div className="flex items-center justify-between bg-stone-50 px-4 py-3 border-b border-stone-100 shrink-0">
                <span className="font-bold text-sm text-forest-900">{group.typeName}</span>
                <button onClick={() => handleRemoveType(group.typeId)} className="text-stone-400 hover:text-red-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {group.rooms.map((room) => (
                  <div key={room.room_id} className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-stone-50 transition-colors">
                    <span className="text-sm font-semibold text-forest-800">ห้อง {room.room_number}</span>
                    <button
                      onClick={() => handleRemoveRoom(group.typeId, room.room_id ?? null)}
                      className="grid h-7 w-7 place-items-center rounded-full bg-stone-100 text-stone-500 hover:bg-red-100 hover:text-red-600 transition-colors shrink-0"
                    >
                      <Minus size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-stone-100 bg-stone-50/50 p-6 rounded-b-3xl shrink-0">
          {hasDateMismatch && (
            <div className="mb-3 rounded-xl bg-red-50 p-3 text-[11px] text-red-600 border border-red-100 font-medium leading-relaxed">
              <span className="font-bold text-red-700">ไม่สามารถจองคนละวันพร้อมกันได้!</span>
              <br />
              คุณเลือกวันในช่องค้นหา ({formatThaiDate(checkIn)} - {formatThaiDate(checkOut)}) ไม่ตรงกับรายการในตะกร้า ({formatThaiDate(cart.check_in)} - {formatThaiDate(cart.check_out)})
            </div>
          )}

          {isCapacityInsufficient && !hasDateMismatch && (
            <div className="mb-3 rounded-xl bg-amber-50 p-3 text-[11px] text-amber-900 border border-amber-200 font-medium leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold text-amber-950 mb-1">
                <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                <span>ห้องพักไม่เพียงพอสำหรับ {totalGuests} ท่าน</span>
              </div>
              ห้องที่เลือก ({cartItems.length} ห้อง) มีความจุหลัก {totalCapacity} ท่าน และรับเด็ก 6–11 ปีเพิ่มได้ไม่เกิน 1 คนต่อห้อง กรุณาเลือกห้องพักเพิ่มให้รองรับอีก {missingCapacity} ท่าน
            </div>
          )}

          {occupancy.fits && totalGuests > totalCapacity && (
            <p className="mb-3 text-xs leading-relaxed text-forest-800">
              เด็ก 6–11 ปีพักเพิ่มได้ 1 คนต่อห้อง ใช้เตียงเดิมได้ หรือเลือกเตียงเสริมในหน้าถัดไปและชำระหน้าเคาน์เตอร์
            </p>
          )}

          <button
            onClick={handleConfirmBooking}
            disabled={hasIncompleteDates || hasDateMismatch || isCapacityInsufficient}
            className="relative w-full overflow-hidden rounded-xl bg-forest-900 py-4 text-sm font-bold text-white shadow-lg shadow-forest-900/20 transition-all hover:bg-forest-800 hover:shadow-xl hover:shadow-forest-900/30 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none cursor-pointer disabled:cursor-not-allowed"
          >
            {hasIncompleteDates ? 'กรุณาเลือกวันเช็คอินและเช็คเอาต์ให้ครบ' : isCapacityInsufficient ? `กรุณาเลือกห้องเพิ่ม (ขาดอีก ${missingCapacity} ท่าน)` : 'จองรายการนี้'}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-xs transition-opacity lg:hidden"
        />
      )}

      {mobileOpen && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-3xl border-t border-stone-200 bg-white shadow-2xl max-h-[82vh] lg:hidden animate-in slide-in-from-bottom duration-200">
          <div className="pt-3 pb-1 cursor-pointer flex justify-center" onClick={() => setMobileOpen(false)}>
            <div className="h-1.5 w-12 rounded-full bg-stone-300" />
          </div>
          <div className="flex items-center justify-between border-b border-stone-100 px-5 py-3 shrink-0">
            <div>
              <h3 className="font-display text-base font-bold text-forest-900">รายการห้องพักที่เลือก</h3>
              <p className="text-xs text-stone-500 mt-0.5">
                {cartItems.length} ห้อง <span className="mx-1">•</span>{' '}
                {cart?.check_in && cart?.check_out ? `${formatThaiDate(cart.check_in)} - ${formatThaiDate(cart.check_out)}${nights > 0 ? ` (${nights} คืน)` : ''}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={clearCartEverywhere}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 underline"
              >
                ล้างทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="ปิด"
                className="grid h-8 w-8 place-items-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="space-y-3 px-5 py-4 overflow-y-auto flex-1">
            {groups.map((group) => (
              <div key={group.typeId} className="rounded-2xl border border-stone-200/80 bg-stone-50/50 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2.5 bg-stone-100/70 border-b border-stone-200/60">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs sm:text-sm text-forest-900">{group.typeName}</span>
                    <span className="text-xs font-semibold text-stone-500 font-sans">฿{group.pricePerNight.toLocaleString()}/คืน</span>
                  </div>
                  <button onClick={() => handleRemoveType(group.typeId)} className="text-stone-400 hover:text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="p-2 space-y-1">
                  {group.rooms.map((room) => (
                    <div key={room.room_id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-stone-100">
                      <span className="text-sm font-semibold text-forest-800">ห้อง {room.room_number}</span>
                      <button
                        onClick={() => handleRemoveRoom(group.typeId, room.room_id ?? null)}
                        className="grid h-7 w-7 place-items-center rounded-full bg-stone-100 text-stone-500 hover:bg-red-100 hover:text-red-600 transition-colors shrink-0"
                      >
                        <Minus size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {(hasDateMismatch || isCapacityInsufficient) && (
            <div className="px-5 pb-2 shrink-0">
              {hasDateMismatch && (
                <div className="rounded-xl bg-red-50 p-2.5 text-xs text-red-600 border border-red-100 font-medium">
                  <span className="font-bold">วันที่จองไม่ตรงกัน:</span> ปรับวันที่ให้ตรงกับที่เลือก
                </div>
              )}
              {isCapacityInsufficient && !hasDateMismatch && (
                <div className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900 border border-amber-200 font-medium flex items-center gap-1.5">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                  <span>ห้องพักยังขาดอีก {missingCapacity} ท่าน กรุณาเลือกเพิ่ม</span>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-stone-100 bg-white px-5 py-3.5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
            <div className="flex items-center justify-between mb-3 text-sm">
              <span className="text-stone-500 font-medium">ราคารวมโดยประมาณ{nights > 0 ? ` (${nights} คืน)` : ''}:</span>
              <span className="font-sans font-black text-lg text-forest-900">฿{estimatedTotal.toLocaleString()}</span>
            </div>
            <button
              type="button"
              onClick={handleConfirmBooking}
              disabled={hasIncompleteDates || hasDateMismatch || isCapacityInsufficient}
              className="w-full rounded-xl bg-forest-900 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-forest-800 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
            >
              {hasIncompleteDates ? 'กรุณาเลือกวันเข้าพัก' : isCapacityInsufficient ? `เลือกห้องเพิ่ม (ขาดอีก ${missingCapacity} ท่าน)` : 'จองรายการนี้'}
            </button>
          </div>
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col border-t border-stone-200/80 bg-white/95 shadow-[0_-10px_35px_rgba(18,60,48,0.12)] backdrop-blur-xl lg:hidden">
        {hasDateMismatch && (
          <div className="bg-red-50 px-5 py-2 text-[11px] text-red-600 border-b border-red-100 font-medium flex items-center gap-1.5">
            <AlertTriangle size={13} className="shrink-0 text-red-500" />
            <span>วันที่เลือกไม่ตรงกับในรายการ ({formatThaiDate(cart.check_in)})</span>
          </div>
        )}
        {isCapacityInsufficient && !hasDateMismatch && (
          <div className="bg-amber-50 px-5 py-2 text-[11px] text-amber-900 border-b border-amber-200 font-medium flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-amber-600 shrink-0" />
              <span>ขาดที่พักอีก {missingCapacity} ท่าน</span>
            </span>
            <span className="text-[11px] font-bold text-amber-950">เลือกห้องเพิ่ม</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-3 px-5 py-3" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="flex flex-col items-start text-left min-w-0 pr-1 group cursor-pointer focus:outline-hidden"
            aria-label={mobileOpen ? 'ปิดรายละเอียดห้องพักที่เลือก' : 'เปิดดูรายละเอียดห้องพักที่เลือก'}
          >
            <div className="flex items-baseline gap-1.5 leading-tight">
              <span className="font-sans text-xl font-extrabold tracking-tight text-forest-900">
                ฿{estimatedTotal.toLocaleString()}
              </span>
              <span className="text-xs font-normal text-stone-500">
                {nights > 0 ? `/ ${nights} คืน` : '/ คืน'}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs text-stone-600 font-medium">
                {cartItems.length} ห้อง
              </span>
              <span className="inline-flex items-center gap-0.5 text-xs font-bold text-forest-800 underline underline-offset-2">
                {mobileOpen ? 'ย่อเก็บ' : 'ดูห้องที่เลือก'}
                <ChevronUp size={13} className={`transition-transform duration-200 shrink-0 ${mobileOpen ? 'rotate-180' : ''}`} />
              </span>
            </div>
          </button>
          <button
            type="button"
            onClick={handleConfirmBooking}
            disabled={hasIncompleteDates || hasDateMismatch || isCapacityInsufficient}
            className="shrink-0 rounded-2xl bg-forest-900 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-forest-900/20 transition-all hover:bg-forest-800 active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            {hasIncompleteDates ? 'เลือกวันเข้าพัก' : isCapacityInsufficient ? 'เลือกห้องเพิ่ม' : 'จองรายการนี้'}
          </button>
        </div>
      </div>
    </>
  );
}
