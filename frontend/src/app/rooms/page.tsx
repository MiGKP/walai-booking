"use client";

import { resolveCheckoutDetails, eligibleRoomPromotion, roomPromotionDiscount, roomPromotionLabel, type CheckoutPromotion } from '@/lib/booking-checkout';
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useAuth } from '@/hooks/useAuth';
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Users,
  Calendar,
  AlertCircle,
  ChevronDown,
  X,
  Star,
  Wind,
  BedDouble,
  Sailboat,
  Tag,
  CheckCircle2,
  Search, Loader2,
} from "lucide-react";
import { useGuestAgePolicy } from "@/hooks/useInfantAgePolicy";
import api, { getApiErrorMessage } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatar";
import toast from "react-hot-toast";
import { PromoNotice, usePromoNotice } from "@/components/promotions/PromoNotice";
import BookingCalendar, {
  DateRange,
  DayStatus,
} from "@/components/booking/BookingCalendar";
import { roomDateSelectionLabel } from '@/lib/room-date-selection';
import BookingSummaryCard from "@/components/booking/BookingSummaryCard";
import { useRoomCart, setRoomCart } from "@/lib/room-cart-store";
import { minimumRoomsForGuests, roomOccupancy } from "@/lib/room-cart";
import { fetchRoomCalendar, toRoomDayStatus } from "@/lib/booking-calendar";
import {
  MonthCursor,
  formatThaiDate,
  monthCursorFromISO,
  multiMonthRangeISO,
  nightsBetween,
  todayISO,
} from "@/lib/date";


interface Promotion extends CheckoutPromotion {}

interface PhysicalRoom {
  room_id: number;
  room_number: string;
}

interface RoomType {
  id: number;
  room_name: string;
  type_name: string;
  description: string;
  capacity: number;
  price_per_night: number;
  main_image: string;
  available_count: number;
  package_price?: number;
  air_conditioner?: boolean;
  bed_size?: string;
  bed_count?: number;
  has_tv?: boolean;
  avg_rating?: number;
  review_count?: number;
  today_bookings: number;
  available_promotions?: Promotion[];
  rooms?: PhysicalRoom[] | null;
}

export default function RoomsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-800"></div>
      </div>
    }>
      <RoomsPageContent />
    </Suspense>
  );
}

function RoomsPageContent(): React.ReactElement {
  const { user } = useAuth();
  const router = useRouter();
  const cart = useRoomCart();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = todayISO();

  const checkIn = searchParams.get('check_in') || '';
  const checkOut = searchParams.get('check_out') || '';
  const { adults, children } = resolveCheckoutDetails(new URLSearchParams(searchParams.toString()), cart);

  const range = useMemo<DateRange | null>(() => checkIn ? { start: checkIn, end: checkOut } : null, [checkIn, checkOut]);
  const [draftRange, setDraftRange] = useState<DateRange | null>(range);
  const [cursor, setCursor] = useState<MonthCursor>(() => monthCursorFromISO(checkIn || today));
  const [dayStatus, setDayStatus] = useState<Record<string, DayStatus>>({});
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchedRange, setSearchedRange] = useState<DateRange | null>(range?.end ? range : null);
  const [openPanel, setOpenPanel] = useState<"type" | "calendar" | null>(null);
  const guests = useMemo(() => ({ adults, children }), [adults, children]);
  const [typeFilter, setTypeFilter] = useState("all");
  const selectedPromoCodes = (searchParams.get("promo_code") || "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  
  const [collectedPromos, setCollectedPromos] = useState<Set<number>>(new Set());
  const [collectingId, setCollectingId] = useState<number | null>(null);
  const { notice: promoNotice, showNotice: showPromoNotice } = usePromoNotice();

  const pickerRef = useRef<HTMLDivElement>(null);
  const activeRange = draftRange !== undefined && draftRange !== null ? draftRange : range;
  const nights = range ? nightsBetween(range.start, range.end) : 0;
  const activeNights = activeRange?.start && activeRange?.end ? nightsBetween(activeRange.start, activeRange.end) : 0;
  const policy = useGuestAgePolicy();

  useEffect(() => {
    setDraftRange(range);
  }, [range]);

  const childAges: Array<number | null> = useMemo(() => {
    const saved = resolveCheckoutDetails(new URLSearchParams(searchParams.toString()), cart);
    return Array.from({ length: saved.children }, (_, index) => {
      const age = saved.childAges[index];
      return Number.isInteger(age) && age >= 0 && age <= policy.childMaxAge ? age : null;
    });
  }, [searchParams, policy.childMaxAge, cart]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpenPanel(null); };
    if (openPanel) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openPanel]);

  const handleRangeSelect = (next: DateRange | null): void => {
    if (typeof setDraftRange === 'function') {
      setDraftRange(next);
    }
    const params = new URLSearchParams(searchParams.toString());
    if (!next?.end) {
      if (next?.start) params.set('check_in', next.start);
      else params.delete('check_in');
      params.delete('check_out');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return;
    }
  };

  const handleCollectPromo = async (promoId: number): Promise<void> => {
    if (!user) {
      showPromoNotice('error', 'กรุณาเข้าสู่ระบบก่อนเก็บโปรโมชั่น');
      router.push('/auth/login');
      return;
    }
    setCollectingId(promoId);
    try {
      await api.post(`/promotions/${promoId}/collect`);
      setCollectedPromos((prev) => new Set(prev).add(promoId));
      showPromoNotice('success', 'เก็บโปรโมชั่นสำเร็จ อย่าลืมกดใช้ในหน้าชำระเงินนะ');
    } catch (err: unknown) {
      const msg = getApiErrorMessage(err, 'ไม่สามารถเก็บโปรโมชั่นได้');
      if (msg.includes('เก็บโปรโมชั่นนี้ไปแล้ว') || msg.includes('already collected') || msg.includes('ซ้ำ')) {
         setCollectedPromos((prev) => new Set(prev).add(promoId));
         showPromoNotice('success', 'คุณมีโปรโมชั่นนี้ในกระเป๋าแล้วครับ');
      } else {
         showPromoNotice('error', msg || 'ไม่สามารถเก็บโปรโมชั่นได้');
      }
    } finally {
      setCollectingId(null);
    }
  };

  const handleClearFilters = () => {
    setTypeFilter("all");
    setDraftRange(null);
    const t = todayISO();
    setCursor(monthCursorFromISO(t));
    const params = new URLSearchParams();
    if (selectedPromoCodes.length > 0) {
      params.set("promo_code", selectedPromoCodes.join(","));
    }
    if (cart && cart.items.length > 0) {
      setRoomCart(null);
        toast('เปลี่ยนวันที่แล้ว กรุณาเลือกห้องพักใหม่สำหรับวันที่ต้องการ');
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleSearchSubmit = () => {
    const targetRange = draftRange !== undefined && draftRange !== null ? draftRange : range;
    if (!targetRange?.end || nightsBetween(targetRange.start, targetRange.end) <= 0) {
      setOpenPanel('calendar');
      toast.error(targetRange?.start ? 'กรุณาเลือกวันเช็คเอาต์' : 'กรุณาเลือกวันเช็คอินและเช็คเอาต์');
      return;
    }
    if (cart && cart.items.length > 0 && (cart.check_in !== targetRange.start || cart.check_out !== targetRange.end)) {
      setRoomCart(null);
      toast('เปลี่ยนวันที่แล้ว กรุณาเลือกห้องพักใหม่สำหรับวันที่ต้องการ');
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("check_in", targetRange.start);
    params.set("check_out", targetRange.end);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
    setOpenPanel(null);
  };

  // การกดจองที่พักจากหน้ารายการจะพาไปเลือกเลขห้องที่หน้ารายละเอียดแทน (ดู Link "จองที่พัก" ด้านล่าง)
  // เพื่อให้ลูกค้าเลือกห้องเจาะจงเองเสมอ แทนที่จะให้ระบบสุ่ม/auto-assign ห้องแรกที่ว่างให้แบบเดิม

  useEffect(() => {
    let cancelled = false;
    const { start, end } = multiMonthRangeISO(cursor, 2);
    setCalendarLoading(true);
    fetchRoomCalendar({ start, end }).then((days) => {
      if (cancelled) return;
      setDayStatus((prev) => ({ ...prev, ...toRoomDayStatus(days) }));
    }).catch(() => {
      if (!cancelled) toast.error("ไม่สามารถโหลดปฏิทินห้องว่างได้");
    }).finally(() => {
      if (!cancelled) setCalendarLoading(false);
    });
    return () => { cancelled = true; };
  }, [cursor]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.get("/rooms", { params: range?.end ? { check_in: range.start, check_out: range.end } : {} }).then((res) => {
      if (cancelled) return;
      setRooms(Array.isArray(res.data?.data) ? res.data.data : []);
      setSearchedRange(range?.end ? range : null);
    }).catch(() => {
      if (!cancelled) toast.error("ไม่สามารถโหลดข้อมูลห้องพักได้");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [range]);

  const roomTypeOptions = useMemo(() => Array.from(new Set(rooms.map((room) => room.type_name).filter(Boolean))), [rooms]);
  const roomsByType = useMemo(() => typeFilter === "all" ? rooms : rooms.filter((room) => room.type_name === typeFilter), [rooms, typeFilter]);
  const infantAge = policy.infantAge;
  const guestInput = useMemo(() => ({ adults: guests.adults, children: guests.children, childAges, infantAge }), [guests.adults, guests.children, childAges, infantAge]);
  const totalGuests = roomOccupancy({ ...guestInput, capacity: 0, roomCount: 0 }).occupyingGuests;
  const availableRooms = useMemo(() => roomsByType.filter((room) => Number(room.available_count) >= minimumRoomsForGuests(guestInput, Number(room.capacity))), [roomsByType, guestInput]);
  const fullRooms = useMemo(() => roomsByType.filter((room) => Number(room.available_count) < minimumRoomsForGuests(guestInput, Number(room.capacity))), [roomsByType, guestInput]);

  return (
    <div className="min-h-screen bg-cream-100 pb-20 pt-4">
      <header className="sticky top-0 sm:top-16 z-40 -mt-4 mb-12 pb-4 pt-4 transition-all pointer-events-none">
        <div className="container mx-auto px-4">
          <div className="mx-auto w-full max-w-5xl pointer-events-auto" ref={pickerRef}>
            <div className="flex w-full flex-col divide-y divide-stone-100 rounded-3xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(18,60,48,0.02),0_8px_24px_-8px_rgba(18,60,48,0.1)] transition-all duration-500 hover:shadow-[0_1px_2px_rgba(18,60,48,0.02),0_12px_32px_-8px_rgba(18,60,48,0.15)] lg:flex-row lg:divide-x lg:divide-y-0 lg:rounded-full">
              <div className="relative flex-1">
                <button type="button" onClick={() => setOpenPanel((v) => (v === "type" ? null : "type"))} className={`flex h-full w-full items-center gap-3 px-6 py-3 text-left transition-colors duration-200 lg:rounded-l-full outline-none focus:outline-none ${openPanel === "type" ? "bg-forest-50/50" : "hover:bg-forest-50/30"}`}>
                  <BedDouble size={16} className="shrink-0 text-forest-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold uppercase tracking-wider text-charcoal-400">ประเภทที่พัก</span>
                    <span className="block truncate text-sm font-semibold text-forest-900">{typeFilter === "all" ? "ทุกประเภท" : typeFilter}</span>
                  </span>
                  <ChevronDown size={12} className="shrink-0 text-charcoal-300 transition-transform duration-300" style={{ transform: openPanel === "type" ? "rotate(180deg)" : "rotate(0deg)" }} />
                </button>
                {openPanel === "type" && (
                  <div className="animate-dropdown absolute left-0 top-full z-40 mt-2 w-full min-w-[220px] rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
                    <button type="button" onClick={() => { setTypeFilter("all"); setOpenPanel(null); }} className={`w-full rounded-xl px-4 py-2 text-left text-sm font-medium transition-colors ${typeFilter === "all" ? "bg-forest-800 text-white" : "text-charcoal-600 hover:bg-forest-50"}`}>ทุกประเภท</button>
                    {roomTypeOptions.map((type) => (
                      <button key={type} type="button" onClick={() => { setTypeFilter(type); setOpenPanel(null); }} className={`w-full rounded-xl px-4 py-2 text-left text-sm font-medium transition-colors ${typeFilter === type ? "bg-forest-800 text-white" : "text-charcoal-600 hover:bg-forest-50"}`}>{type}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative flex-[1.4]">
                <button type="button" onClick={() => setOpenPanel((v) => (v === "calendar" ? null : "calendar"))} className={`flex h-full w-full items-center gap-3 px-6 py-3 text-left transition-colors duration-200 outline-none focus:outline-none ${openPanel === "calendar" ? "bg-forest-50/50" : "hover:bg-forest-50/30"}`}>
                  <Calendar size={16} className="shrink-0 text-forest-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold uppercase tracking-wider text-charcoal-400">วันเข้าพัก – วันออก</span>
                    <span className="block truncate text-sm font-semibold text-forest-900">{roomDateSelectionLabel(activeRange)}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {activeNights > 0 && <span className="rounded-full bg-forest-100 px-2 py-0.5 text-xs font-bold text-forest-800">{activeNights} คืน</span>}
                    <ChevronDown size={12} className="shrink-0 text-charcoal-300 transition-transform duration-300" style={{ transform: openPanel === "calendar" ? "rotate(180deg)" : "rotate(0deg)" }} />
                  </div>
                </button>
                {openPanel === "calendar" && (
                  <div
                    className="animate-dropdown absolute left-0 top-full z-40 mt-3 w-full sm:w-[620px] md:w-[640px] max-w-[calc(100vw-2rem)] rounded-3xl border border-stone-200 bg-white p-4 sm:p-6 shadow-[0_20px_50px_rgba(18,60,48,0.18)] flex flex-col"
                  >
                    <div className="mb-3 flex items-center justify-between pb-3 border-b border-stone-100 shrink-0">
                      <div>
                        <h3 className="font-display text-base sm:text-lg font-bold text-forest-900">เลือกช่วงวันเข้าพัก</h3>
                        {activeRange && activeNights > 0 ? (
                          <p className="text-xs text-forest-700 mt-0.5 font-medium">
                            {formatThaiDate(activeRange.start)} – {formatThaiDate(activeRange.end)} ({activeNights} คืน)
                          </p>
                        ) : activeRange?.start ? (
                          <p className="text-xs text-forest-700 mt-0.5 font-medium">
                            {formatThaiDate(activeRange.start)} – เลือกวันเช็คเอาต์
                          </p>
                        ) : (
                          <p className="text-xs text-charcoal-400 mt-0.5">
                            เลือกวันเช็คอินและวันเช็คเอาท์
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setOpenPanel(null)}
                        aria-label="ปิดปฏิทิน"
                        className="p-2 rounded-full text-charcoal-400 hover:text-charcoal-600 hover:bg-stone-100 transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="py-1 overflow-y-auto max-h-[75vh] sm:max-h-none sm:overflow-visible pr-1 sm:pr-0">
                      <BookingCalendar
                        mode="range"
                        value={activeRange?.start ? activeRange : null}
                        onSelect={handleRangeSelect}
                        cursor={cursor}
                        onCursorChange={setCursor}
                        dayStatus={dayStatus}
                        loading={calendarLoading}
                        minISO={today}
                        visibleMonths={2}
                      />
                    </div>

                    <div className="pt-3 mt-2 border-t border-stone-100 flex items-center justify-between shrink-0">
                      <button
                        type="button"
                        onClick={() => handleRangeSelect(null)}
                        className="text-xs text-charcoal-500 hover:text-rose-700 underline font-medium transition-colors py-1"
                      >
                        ล้างวันที่เลือก
                      </button>
                      {activeNights > 0 && (
                        <span className="text-xs font-semibold text-forest-800">
                          เข้าพัก {activeNights} คืน
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center p-2 lg:p-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="w-full lg:w-auto inline-flex items-center justify-center gap-2 rounded-2xl lg:rounded-full bg-forest-800 hover:bg-forest-900 active:scale-95 text-cream-100 px-6 py-3 text-sm font-bold shadow-md shadow-forest-900/15 transition-all duration-200"
                >
                  <Search size={16} className="text-bamboo-400 shrink-0" />
                  <span className="tracking-wide">ค้นหาห้องว่าง</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div id="rooms-list" className="container mx-auto max-w-7xl px-4 lg:py-2">
        <div className="flex flex-col gap-8 lg:flex-row">
          <section className="min-w-0 flex-1">
            <PromoNotice notice={promoNotice} />
            {loading && rooms.length === 0 ? (
              <div className="grid gap-6">{[0, 1].map((index) => <div key={index} className="h-64 w-full animate-pulse rounded-2xl border border-stone-100 bg-white" />)}</div>
            ) : roomsByType.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-stone-300 bg-white/40 px-6 py-20 text-center backdrop-blur-xs">
                <AlertCircle className="mb-4 h-8 w-8 text-stone-300" />
                <h3 className="font-display text-lg font-medium text-forest-900">ไม่พบที่พักในช่วงนี้</h3>
                <p className="mt-1 text-sm text-charcoal-400">ลองเปลี่ยนช่วงวันที่ หรือเลือกประเภทที่พักอื่น</p>
                <button type="button" onClick={handleClearFilters} className="mt-6 rounded-xl border border-stone-200 bg-white px-6 py-2.5 text-sm font-bold text-forest-800 shadow-xs transition-colors hover:bg-stone-50">ล้างการค้นหา</button>
              </div>
            ) : (
              <div className={`grid gap-8 transition-opacity duration-300 ${loading ? 'pointer-events-none opacity-50' : 'opacity-100'}`}>
                {[...availableRooms, ...fullRooms].map((room, idx) => {
                  const availableCount = Number(room.available_count);
                  const minimumRooms = minimumRoomsForGuests(guestInput, Number(room.capacity));
                  const isCapacityEnough = availableCount >= minimumRooms;
                  const isAvailable = nights <= 0 || (availableCount > 0 && isCapacityEnough);
                  const unitPrice = Number(room.price_per_night);
                  const activePromotion = room.available_promotions?.find((p) => selectedPromoCodes.includes(p.code));
                  const discount = activePromotion
                    ? activePromotion.discount_type === "percent"
                      ? Math.min(
                          Math.round((unitPrice * Number(activePromotion.discount_value)) / 100),
                          activePromotion.max_discount != null ? Number(activePromotion.max_discount) : Infinity,
                          unitPrice
                        )
                      : Math.min(Number(activePromotion.discount_value), unitPrice)
                    : 0;
                  const searchedNights = searchedRange ? nightsBetween(searchedRange.start, searchedRange.end) : 1;
                  const basePrice = unitPrice * Math.max(1, searchedNights);
                  const bestPromo = room.available_promotions?.filter(p => eligibleRoomPromotion(p, basePrice, searchedNights, room.id, 1)).reduce<Promotion | null>((best, p) => {
                    return roomPromotionDiscount(p, basePrice) > (best ? roomPromotionDiscount(best, basePrice) : 0) ? p : best;
                  }, null);
                  const potentialDiscount = bestPromo ? roomPromotionDiscount(bestPromo, basePrice) / Math.max(1, searchedNights) : 0;
                  const finalPrice = unitPrice - discount;

                  return (
                    <article key={room.id} style={{ animationDelay: `${idx * 100}ms` }} className={`animate-reveal-up group relative flex flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-300 md:flex-row ${isAvailable ? "border-stone-200/80 hover:border-forest-300 hover:shadow-md" : "border-stone-100 bg-stone-50/50 opacity-60"}`}>
                      <div className="relative h-52 w-full shrink-0 overflow-hidden sm:h-56 md:h-auto md:w-64 lg:w-72 xl:w-80">
                        {room.main_image ? <Image src={resolveMediaUrl(room.main_image)} alt={room.room_name} fill sizes="(max-width: 768px) 100vw, 320px" className="object-cover transition-transform duration-1000 group-hover:scale-105" priority={idx < 2} /> : <div className="h-full w-full bg-stone-50" />}
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col justify-between p-5 lg:p-6">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${isAvailable ? "bg-forest-50 text-forest-700" : "bg-stone-200 text-stone-600"}`}>
                              {nights <= 0 ? 'เลือกวันเพื่อดูห้องว่าง' : isAvailable ? `ว่าง ${availableCount} ห้อง` : !isCapacityEnough ? "ความจุไม่พอ" : "เต็ม"}
                            </span>
                            {isAvailable && minimumRooms > 1 && (
                              <span className="rounded-full px-2.5 py-0.5 text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200/80">
                                แนะนำจอง {minimumRooms} ห้อง (สำหรับ {totalGuests} ท่าน)
                              </span>
                            )}
                            {typeof room.avg_rating !== "undefined" && <div className="flex items-center gap-1.5 rounded-full bg-amber-50/70 px-2 py-0.5 text-xs font-bold text-amber-600"><Star size={11} className="fill-amber-400 text-amber-400" /><span>{Number(room.avg_rating).toFixed(1)}</span><span className="font-medium text-stone-500">({room.review_count ?? 0} รีวิว)</span></div>}
                          </div>
                          <div><h3 className="font-sans text-xl font-semibold leading-tight text-forest-900">{room.room_name}</h3><p className="mt-1 line-clamp-2 text-sm leading-relaxed text-charcoal-400">{room.description}</p></div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-4 border-t border-stone-100 pt-3">
                          <div className="flex items-center gap-1.5 text-sm text-charcoal-500"><Users size={14} className="text-forest-400" /><span>พักได้ {room.capacity} ท่าน</span></div>
                          {room.air_conditioner && <div className="flex items-center gap-1.5 text-sm text-charcoal-500"><Wind size={14} className="text-forest-400" /><span>เครื่องปรับอากาศ</span></div>}
                          {room.bed_size && <div className="flex items-center gap-1.5 text-sm text-charcoal-500"><BedDouble size={14} className="text-forest-400" /><span>{room.bed_size}</span></div>}
                        </div>
                        {room.available_promotions && room.available_promotions.length > 0 && (
                          <Link href={`/rooms/${room.id}?${searchParams.toString()}#promotions`} className="mt-4 inline-flex max-w-full items-center gap-2 rounded-lg bg-bamboo-50 px-3 py-2 text-sm font-semibold text-bamboo-800 hover:bg-bamboo-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest-700">
                            <Tag size={16} className="shrink-0" />
                            <span>ดูโปรโมชั่นทั้งหมด {room.available_promotions.length} รายการ</span>
                            <ChevronDown size={16} className="shrink-0 -rotate-90" />
                          </Link>
                        )}
                      </div>
                      <div className="flex w-full shrink-0 flex-col justify-between border-t border-stone-100 bg-stone-50/40 p-5 md:w-64 md:border-l md:border-t-0 lg:w-72 lg:p-6">
                        <div className="mb-4 flex flex-col items-start gap-1.5 md:items-end">
                          {isAvailable && searchedRange && availableCount <= 2 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700 shadow-xs whitespace-nowrap">
                              <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
                              เหลือเพียง {availableCount} ห้องสุดท้ายสำหรับวันหยุดนี้
                            </span>
                          )}
                          {room.today_bookings > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 shadow-xs whitespace-nowrap">
                              <Star size={11} className="fill-amber-400 text-amber-500" />ฮิต! จองไปแล้ว {room.today_bookings} ครั้งวันนี้
                            </span>
                          )}
                        </div>
                        <div className="mb-6 flex flex-col items-start gap-1 md:items-end">
                          <span className="text-xs font-bold uppercase tracking-wider text-charcoal-400">ราคาต่อคืน</span>
                          {potentialDiscount > 0 ? <div className="flex w-full flex-col items-start md:items-end"><div className="flex items-baseline gap-1.5"><span className="text-[13px] font-medium text-stone-400 line-through">฿{unitPrice.toLocaleString()}</span><span className="font-sans text-[26px] font-extrabold leading-none text-forest-900">฿{(unitPrice - potentialDiscount).toLocaleString()}</span></div><span className="mt-1 rounded bg-bamboo-50 border border-bamboo-200 px-2 py-0.5 text-[11px] font-bold text-bamboo-700 shadow-xs text-left md:text-right">ประหยัด ฿{potentialDiscount.toLocaleString()} เมื่อใช้โปรโมชั่น · เฉลี่ยต่อคืน</span></div> : <span className="font-sans text-[26px] font-extrabold leading-none text-forest-900">฿{unitPrice.toLocaleString()}</span>}
                        </div>
                        <div className="mt-auto w-full">
                          <Link href={`/rooms/${room.id}?${searchParams.toString()}`} className="block w-full rounded-xl bg-bamboo-600 py-3.5 text-center text-[14px] font-bold text-white shadow-md transition-all hover:bg-bamboo-700 hover:shadow-lg active:scale-[0.98]">
                            เช็คห้องว่าง
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          
          {/* Booking Summary: Desktop Sidebar & Mobile Sticky Bar */}
          {cart && cart.items && cart.items.length > 0 && (
            <>
              <aside className="hidden xl:block xl:w-[360px] shrink-0">
                <div className="sticky top-[160px]">
                  <BookingSummaryCard />
                </div>
              </aside>
              {/* Mobile sticky bar only: hide desktop card on mobile, show mobile bar */}
              <div className="xl:hidden [&>div:first-child]:hidden">
                <BookingSummaryCard />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
