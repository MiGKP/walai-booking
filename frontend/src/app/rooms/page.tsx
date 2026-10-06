"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Users,
  Calendar,
  AlertCircle,
  Plus,
  Minus,
  ChevronDown,
  X,
  Star,
  Wind,
  BedDouble,
  Sailboat,
  Tag,
  CheckCircle2,
  Search, ShoppingCart, Loader2, Baby,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useInfantAgePolicy } from "@/hooks/useInfantAgePolicy";
import api, { getApiErrorMessage } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatar";
import toast from "react-hot-toast";
import { PromoNotice, usePromoNotice } from "@/components/promotions/PromoNotice";
import BookingCalendar, {
  DateRange,
  DayStatus,
} from "@/components/booking/BookingCalendar";
import BookingSummaryCard from "@/components/booking/BookingSummaryCard";
import { useRoomCart, setRoomCart } from "@/lib/room-cart-store";
import { fetchRoomCalendar, toRoomDayStatus } from "@/lib/booking-calendar";
import {
  MonthCursor,
  addDaysISO,
  formatThaiDate,
  monthCursorFromISO,
  multiMonthRangeISO,
  nightsBetween,
  todayISO,
} from "@/lib/date";


interface Promotion {
  id: number;
  name: string;
  code: string;
  discount_value: number;
  discount_type?: 'percent' | 'fixed';
  min_nights?: number;
  max_discount?: number;
}

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

function Stepper({
  value,
  min = 0,
  max = 99,
  editable = true,
  onChange,
  ariaLabel,
}: {
  value: number;
  min?: number;
  max?: number;
  editable?: boolean;
  onChange: (next: number) => void;
  ariaLabel: string;
}): React.ReactElement {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string): void => {
    const parsed = parseInt(raw, 10);
    const safe = isNaN(parsed) ? min : Math.min(max, Math.max(min, parsed));
    setDraft(String(safe));
    onChange(safe);
  };

  const btn = "grid h-7 w-7 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-forest-800 transition-colors hover:border-forest-300 hover:bg-forest-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-300 disabled:border-stone-100 disabled:text-stone-300 disabled:hover:bg-white";

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`ลด${ariaLabel}`} className={btn}><Minus size={13} /></button>
      {editable ? (
        <input type="text" inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))} onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} onFocus={(e) => e.currentTarget.select()} aria-label={ariaLabel} className="h-7 w-9 rounded-md border border-transparent bg-transparent text-center text-sm font-bold tabular-nums text-forest-900 transition-colors hover:border-stone-200 focus:border-forest-400 focus:bg-[#FFFFFF] focus:outline-none" />
      ) : (
        <span className="w-9 text-center text-sm font-bold tabular-nums text-forest-900">{value}</span>
      )}
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`เพิ่ม${ariaLabel}`} className={btn}><Plus size={13} /></button>
    </div>
  );
}

function GuestRow({ label, hint, value, min, max = 20, onChange }: { label: string; hint: string; value: number; min: number; max?: number; onChange: (next: number) => void; }): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-charcoal-700">{label}</p>
        <p className="text-xs text-stone-400">{hint}</p>
      </div>
      <Stepper value={value} min={min} max={max} ariaLabel={label} onChange={onChange} />
    </div>
  );
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
  const isAdminOrStaff = user?.role === "admin" || user?.role === "room_staff";
  const router = useRouter();
  const cart = useRoomCart();
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = todayISO();

  const defaultCheckIn = isAdminOrStaff ? today : addDaysISO(today, 1);
  const checkIn = searchParams.get("check_in") || defaultCheckIn;
  const checkOut = searchParams.get("check_out") || addDaysISO(checkIn, 1);
  const adults = parseInt(searchParams.get("adults") || "1", 10);
  const children = parseInt(searchParams.get("children") || "0", 10);

  const [range, setRange] = useState<DateRange | null>({ start: checkIn, end: checkOut });
  const [cursor, setCursor] = useState<MonthCursor>(() => monthCursorFromISO(checkIn));
  const [dayStatus, setDayStatus] = useState<Record<string, DayStatus>>({});
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchedRange, setSearchedRange] = useState<DateRange | null>({ start: checkIn, end: checkOut });
  const [openPanel, setOpenPanel] = useState<"type" | "guests" | "calendar" | null>(null);
  const [guests, setGuests] = useState({ adults, children });
  const [typeFilter, setTypeFilter] = useState("all");
  const selectedPromoCodes = (searchParams.get("promo_code") || "").split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
  
  const [expandedPromoId, setExpandedPromoId] = useState<number | null>(null);
  const [collectedPromos, setCollectedPromos] = useState<Set<number>>(new Set());
  const [collectingId, setCollectingId] = useState<number | null>(null);
  const { notice: promoNotice, showNotice: showPromoNotice } = usePromoNotice();

  const pickerRef = useRef<HTMLDivElement>(null);
  const nights = range ? nightsBetween(range.start, range.end) : 0;

  const childAges: Array<number | null> = useMemo(() => {
    const children = parseInt(searchParams.get('children') || '0', 10);
    const raw = (searchParams.get('child_ages') || '').split(',').map((s) => {
      const n = parseInt(s, 10);
      return Number.isInteger(n) && n >= 0 && n <= 17 ? n : null;
    });
    const normalized = raw.length && (searchParams.get('child_ages') ?? '') !== '' ? raw : [];
    if (normalized.length === children) return normalized;
    if (normalized.length > children) return normalized.slice(0, children);
    return [...normalized, ...Array(children - normalized.length).fill(null)];
  }, [searchParams]);

  useEffect(() => {
    const adults = parseInt(searchParams.get("adults") || "1", 10);
    const children = parseInt(searchParams.get("children") || "0", 10);
    setGuests({ adults, children });
  }, [searchParams]);

  const handleChildAgeChange = (index: number, age: number) => {
    const nextChildAges = [...childAges];
    nextChildAges[index] = age;
    const serialized = nextChildAges.map((a) => (a === null ? '' : String(a))).join(',');
    const params = new URLSearchParams(searchParams.toString());
    params.set('child_ages', serialized);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpenPanel(null); };
    if (openPanel) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openPanel]);

  const handleRangeSelect = (next: DateRange | null): void => {
    setRange(next);
    if (next && nightsBetween(next.start, next.end) > 0) {
      if (cart && cart.items.length > 0 && (cart.check_in !== next.start || cart.check_out !== next.end)) {
        setRoomCart(null);
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set("check_in", next.start);
      params.set("check_out", next.end);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
      setOpenPanel(null);
    }
  };

  const handleGuestsChange = (next: { adults: number; children: number; }): void => {
    setGuests(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set("adults", String(next.adults));
    params.set("children", String(next.children));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
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
    setGuests({ adults: 1, children: 0 });
    const t = todayISO();
    const tm = addDaysISO(t, 1);
    setRange({ start: t, end: tm });
    setCursor(monthCursorFromISO(t));
    const params = new URLSearchParams();
    params.set("check_in", t);
    params.set("check_out", tm);
    if (selectedPromoCodes.length > 0) {
      params.set("promo_code", selectedPromoCodes.join(","));
    }
    if (cart && cart.items.length > 0 && (cart.check_in !== t || cart.check_out !== tm)) {
      setRoomCart(null);
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleSearchSubmit = () => {
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
    if (!range || nightsBetween(range.start, range.end) <= 0) return;
    let cancelled = false;
    setLoading(true);
    api.get("/rooms", { params: { check_in: range.start, check_out: range.end } }).then((res) => {
      if (cancelled) return;
      setRooms(Array.isArray(res.data?.data) ? res.data.data : []);
      setSearchedRange(range);
    }).catch(() => {
      if (!cancelled) toast.error("ไม่สามารถโหลดข้อมูลห้องพักได้");
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [range]);

  const roomTypeOptions = useMemo(() => Array.from(new Set(rooms.map((room) => room.type_name).filter(Boolean))), [rooms]);
  const roomsByType = useMemo(() => typeFilter === "all" ? rooms : rooms.filter((room) => room.type_name === typeFilter), [rooms, typeFilter]);
  const infantAge = useInfantAgePolicy();
  const countableChildren = childAges.filter((age) => age !== null && age >= infantAge).length;
  const totalGuests = guests.adults + countableChildren;
  const availableRooms = useMemo(() => roomsByType.filter((room) => Number(room.available_count) > 0 && (Number(room.capacity) * Number(room.available_count)) >= totalGuests), [roomsByType, totalGuests]);
  const fullRooms = useMemo(() => roomsByType.filter((room) => Number(room.available_count) <= 0 || (Number(room.capacity) * Number(room.available_count)) < totalGuests), [roomsByType, totalGuests]);

  return (
    <div className="min-h-screen bg-cream-100 pb-20 pt-4">
      <header className="sticky top-0 sm:top-16 z-40 -mt-4 mb-12 pb-4 pt-4 transition-all pointer-events-none">
        <div className="container mx-auto px-4">
          <div className="mx-auto w-full max-w-5xl pointer-events-auto" ref={pickerRef}>
            <div className="flex w-full flex-col divide-y divide-stone-100 rounded-3xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(18,60,48,0.02),0_8px_24px_-8px_rgba(18,60,48,0.1)] transition-all duration-500 hover:shadow-[0_1px_2px_rgba(18,60,48,0.02),0_12px_32px_-8px_rgba(18,60,48,0.15)] lg:flex-row lg:divide-x lg:divide-y-0 lg:rounded-full">
              <div className="relative flex-1">
                <button type="button" onClick={() => setOpenPanel((v) => (v === "type" ? null : "type"))} className={`flex h-full w-full items-center gap-3 px-6 py-3 text-left transition-colors duration-200 lg:rounded-l-full ${openPanel === "type" ? "bg-forest-50/40" : "hover:bg-forest-50/30"}`}>
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
              <div className="relative flex-1">
                <button type="button" onClick={() => setOpenPanel((v) => (v === "guests" ? null : "guests"))} className={`flex h-full w-full items-center gap-3 px-6 py-3 text-left transition-colors duration-200 ${openPanel === "guests" ? "bg-forest-50/40" : "hover:bg-forest-50/30"}`}>
                  <Users size={16} className="shrink-0 text-forest-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold uppercase tracking-wider text-charcoal-400">ผู้เข้าพัก</span>
                    <span className="block truncate text-sm font-semibold text-forest-900">ผู้ใหญ่ {guests.adults} • เด็ก {guests.children}</span>
                  </span>
                  <ChevronDown size={12} className="shrink-0 text-charcoal-300 transition-transform duration-300" style={{ transform: openPanel === "guests" ? "rotate(180deg)" : "rotate(0deg)" }} />
                </button>
                {openPanel === "guests" && (
                  <div className="animate-dropdown absolute left-1/2 top-full z-40 mt-2 w-[320px] -translate-x-1/2 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl lg:left-0 lg:translate-x-0">
                    <GuestRow label="ผู้ใหญ่" hint="อายุ 12 ปีขึ้นไป" value={guests.adults} min={1} onChange={(v) => handleGuestsChange({ ...guests, adults: v })} />
                    <GuestRow label="เด็ก" hint="อายุ 0–11 ปี" value={guests.children} min={0} onChange={(v) => handleGuestsChange({ ...guests, children: v })} />
                    {guests.children > 0 && (
                      <div className="mx-2 my-2 rounded-xl border border-forest-100 bg-forest-50/50 p-3 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Baby size={13} className="text-forest-700 shrink-0" />
                          <p className="text-xs font-bold uppercase tracking-wide text-forest-800">อายุของเด็กแต่ละคน ณ วันเข้าพัก</p>
                        </div>
                        <div className="space-y-1.5">
                          {childAges.map((age, index) => (
                            <div key={index} className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-1.5 ${age === null ? "border-amber-300" : "border-stone-200"}`}>
                              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-forest-800/10 text-xs font-extrabold text-forest-800">{index + 1}</span>
                              <div className="relative flex-1">
                                <select
                                  value={age ?? ""}
                                  onChange={(e) => handleChildAgeChange(index, parseInt(e.target.value, 10))}
                                  className={`w-full appearance-none bg-transparent py-0.5 pr-5 text-xs font-bold focus:outline-none ${age === null ? "text-amber-600" : "text-forest-800"}`}
                                >
                                  <option value="" disabled>เลือกอายุ</option>
                                  {Array.from({ length: 18 }, (_, a) => a).map((a) => (
                                    <option key={a} value={a}>{a} ปี</option>
                                  ))}
                                </select>
                                <ChevronDown size={11} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 text-stone-400" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="px-3 py-2 bg-stone-50 rounded-xl mt-1 mb-2">
                      <p className="text-xs text-charcoal-400 leading-relaxed">
                        <span className="font-bold text-forest-700">นโยบายเด็ก:</span> {infantAge === 0 ? 'เด็กทุกอายุนับรวมในความจุห้อง' : `เด็กอายุต่ำกว่า ${infantAge} ปี เข้าพักฟรีและไม่นับความจุห้อง`}
                      </p>
                    </div>
                    <div className="border-t border-stone-100 p-2">
                      <button
                        type="button"
                        onClick={() => setOpenPanel(null)}
                        className="w-full rounded-xl bg-forest-900 py-2.5 text-sm font-bold text-white transition-colors hover:bg-forest-800"
                      >
                        ตกลง
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="relative flex-[1.4]">
                <button type="button" onClick={() => setOpenPanel((v) => (v === "calendar" ? null : "calendar"))} className={`flex h-full w-full items-center gap-3 px-6 py-3 text-left transition-colors duration-200 ${openPanel === "calendar" ? "bg-forest-50/40" : "hover:bg-forest-50/30"}`}>
                  <Calendar size={16} className="shrink-0 text-forest-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold uppercase tracking-wider text-charcoal-400">วันเข้าพัก – วันออก</span>
                    <span className="block truncate text-sm font-semibold text-forest-900">{range ? `${formatThaiDate(range.start)} – ${formatThaiDate(range.end)}` : "เลือกวันเข้าพัก"}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {nights > 0 && <span className="rounded-full bg-forest-100 px-2 py-0.5 text-xs font-bold text-forest-800">{nights} คืน</span>}
                    <ChevronDown size={12} className="shrink-0 text-charcoal-300 transition-transform duration-300" style={{ transform: openPanel === "calendar" ? "rotate(180deg)" : "rotate(0deg)" }} />
                  </div>
                </button>
                {openPanel === "calendar" && (
                  <div className="animate-dropdown absolute right-0 top-full z-40 mt-2 w-[min(600px,calc(100vw-2rem))] rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl">
                    <div className="mb-4 flex items-center justify-between px-2">
                      <h3 className="font-display text-base font-medium text-forest-900">เลือกช่วงวันเข้าพัก</h3>
                      <button type="button" onClick={() => setOpenPanel(null)} className="text-charcoal-300 hover:text-charcoal-500"><X size={18} /></button>
                    </div>
                    <BookingCalendar mode="range" value={range} onSelect={handleRangeSelect} cursor={cursor} onCursorChange={setCursor} dayStatus={dayStatus} loading={calendarLoading} minISO={isAdminOrStaff ? today : addDaysISO(today, 1)} />
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

      <div id="rooms-list" className="container mx-auto px-4 lg:py-2">
        <div className="flex flex-col gap-8 lg:flex-row">
          <section className="flex-1">
            <PromoNotice notice={promoNotice} />
            {loading && rooms.length === 0 ? (
              <div className="grid gap-6">{[0, 1].map((index) => <div key={index} className="h-64 w-full animate-pulse rounded-2xl border border-stone-100 bg-white" />)}</div>
            ) : roomsByType.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-stone-300 bg-white/40 px-6 py-20 text-center backdrop-blur-sm">
                <AlertCircle className="mb-4 h-8 w-8 text-stone-300" />
                <h3 className="font-display text-lg font-medium text-forest-900">ไม่พบที่พักในช่วงนี้</h3>
                <p className="mt-1 text-sm text-charcoal-400">ลองเปลี่ยนช่วงวันที่ หรือเลือกประเภทที่พักอื่น</p>
                <button type="button" onClick={handleClearFilters} className="mt-6 rounded-xl border border-stone-200 bg-white px-6 py-2.5 text-sm font-bold text-forest-800 shadow-sm transition-colors hover:bg-stone-50">ล้างการค้นหา</button>
              </div>
            ) : (
              <div className={`grid gap-8 transition-opacity duration-300 ${loading ? 'pointer-events-none opacity-50' : 'opacity-100'}`}>
                {[...availableRooms, ...fullRooms].map((room, idx) => {
                  const availableCount = Number(room.available_count);
                  const isCapacityEnough = (Number(room.capacity) * availableCount) >= totalGuests;
                  const isAvailable = availableCount > 0 && isCapacityEnough;
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
                  const bestPromo = room.available_promotions?.reduce<Promotion | null>((best, p) => {
                    const d = p.discount_type === 'percent' ? (unitPrice * Number(p.discount_value) / 100) : Number(p.discount_value);
                    const bestD = best ? (best.discount_type === 'percent' ? (unitPrice * Number(best.discount_value) / 100) : Number(best.discount_value)) : 0;
                    return d > bestD ? p : best;
                  }, null);
                  const potentialDiscount = bestPromo ? (bestPromo.discount_type === 'percent' ? Math.min(Math.round(unitPrice * Number(bestPromo.discount_value) / 100), bestPromo.max_discount || Infinity, unitPrice) : Math.min(Number(bestPromo.discount_value), unitPrice)) : 0;
                  const finalPrice = unitPrice - discount;

                  return (
                    <article key={room.id} style={{ animationDelay: `${idx * 100}ms` }} className={`animate-reveal-up group relative grid grid-cols-1 overflow-hidden rounded-2xl border bg-white transition-all duration-300 lg:grid-cols-[380px_1fr_300px] ${isAvailable ? "border-stone-200/80 hover:border-forest-300 hover:shadow-md" : "border-stone-100 bg-stone-50/50 opacity-60"}`}>
                      <div className="relative h-48 w-full overflow-hidden lg:h-full">
                        {room.main_image ? <Image src={resolveMediaUrl(room.main_image)} alt={room.room_name} fill sizes="(max-width: 1024px) 100vw, 320px" className="object-cover transition-transform duration-1000 group-hover:scale-105" priority={idx < 2} /> : <div className="h-full w-full bg-stone-50" />}
                      </div>
                      <div className="flex flex-col justify-between border-b border-stone-100 p-5 lg:border-b-0 lg:border-r lg:border-stone-100 lg:p-6">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            
                            <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${isAvailable ? "bg-forest-50 text-forest-700" : "bg-stone-200 text-stone-600"}`}>
                              {isAvailable ? `ว่าง ${availableCount} ห้อง` : !isCapacityEnough ? "ความจุไม่พอ" : "เต็ม"}
                            </span>
                            {typeof room.avg_rating !== "undefined" && <div className="flex items-center gap-1.5 rounded-full bg-amber-50/70 px-2 py-0.5 text-xs font-bold text-amber-600"><Star size={11} className="fill-amber-400 text-amber-400" /><span>{Number(room.avg_rating).toFixed(1)}</span><span className="font-medium text-stone-500">({room.review_count ?? 0} รีวิว)</span></div>}
                          </div>
                          <div><h3 className="font-sans text-xl font-semibold leading-tight text-forest-900">{room.room_name}</h3><p className="mt-1 line-clamp-2 text-sm leading-relaxed text-charcoal-400">{room.description}</p></div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-4 border-t border-stone-100 pt-3">
                          <div className="flex items-center gap-1.5 text-sm text-charcoal-500"><Users size={14} className="text-forest-400" /><span>ความจุ {room.capacity} ท่าน</span></div>
                          {room.air_conditioner && <div className="flex items-center gap-1.5 text-sm text-charcoal-500"><Wind size={14} className="text-forest-400" /><span>เครื่องปรับอากาศ</span></div>}
                          {room.bed_size && <div className="flex items-center gap-1.5 text-sm text-charcoal-500"><BedDouble size={14} className="text-forest-400" /><span>{room.bed_size}</span></div>}
                        </div>
                        {room.available_promotions && room.available_promotions.length > 0 && (
                          <div className="mt-3 flex flex-col gap-2">
                            <div className="flex flex-wrap gap-1.5">
                              {room.available_promotions.map((promo) => (
                                <button
                                  key={promo.id}
                                  onClick={() => setExpandedPromoId(expandedPromoId === promo.id ? null : promo.id)}
                                  type="button"
                                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                                    expandedPromoId === promo.id 
                                      ? 'border-forest-300 bg-forest-50 text-forest-700' 
                                      : 'border-bamboo-200 bg-bamboo-50/50 text-bamboo-700 hover:bg-bamboo-100 hover:border-bamboo-300 active:scale-95'
                                  }`}
                                >
                                  <Tag size={12} className={expandedPromoId === promo.id ? 'text-forest-500' : 'text-bamboo-500'} />
                                  มีโปรโมชั่น {promo.name}
                                </button>
                              ))}
                            </div>
                            
                            {room.available_promotions.map((promo) => (
                              expandedPromoId === promo.id && (
                                <div key={`details-${promo.id}`} className="mt-1 flex flex-wrap items-center justify-between gap-3 animate-in slide-in-from-top-2 fade-in duration-200 rounded-lg border border-stone-200 bg-stone-50 p-2.5 text-[12px] text-stone-600">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-forest-800">
                                      {promo.discount_type === 'percent' ? `ลด ${promo.discount_value}%` : `ลด ฿${Number(promo.discount_value).toLocaleString()}`}
                                    </span>
                                    {promo.min_nights && (
                                      <span className="text-stone-500">
                                        (ขั้นต่ำ {promo.min_nights} คืน)
                                      </span>
                                    )}
                                    <span className="flex items-center gap-1 text-stone-500">
                                      <span className="mx-1 h-3 w-px bg-stone-300"></span>
                                      ใช้โค้ด: <span className="font-bold text-stone-700">{promo.code}</span>
                                    </span>
                                  </div>
                                  <Link
                                    href={`/rooms/${room.id}?${searchParams.toString()}#promotions`}
                                    className="inline-flex shrink-0 items-center gap-1 font-bold text-forest-600 hover:text-forest-700 whitespace-nowrap"
                                  >
                                    ดูห้องพัก <ChevronDown size={14} className="-rotate-90" />
                                  </Link>
                                </div>
                              )
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col justify-between bg-stone-50/40 p-5 lg:bg-white lg:p-6">
                        <div className="mb-4 flex flex-col items-start gap-1.5 lg:items-end">
                          {isAvailable && searchedRange && availableCount <= 2 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700 shadow-sm whitespace-nowrap">
                              <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-orange-500" />
                              เหลือเพียง {availableCount} ห้องสุดท้ายสำหรับวันหยุดนี้
                            </span>
                          )}
                          {room.today_bookings > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700 shadow-sm whitespace-nowrap">
                              <Star size={11} className="fill-amber-400 text-amber-500" />ฮิต! จองไปแล้ว {room.today_bookings} ครั้งวันนี้
                            </span>
                          )}
                        </div>
                        <div className="mb-6 flex flex-col items-start gap-1 lg:items-end">
                          <span className="text-xs font-bold uppercase tracking-wider text-charcoal-400">ราคาต่อคืน</span>
                          {potentialDiscount > 0 ? <div className="flex w-full flex-col items-start lg:items-end"><div className="flex items-baseline gap-1.5"><span className="text-[13px] font-medium text-stone-400 line-through">฿{unitPrice.toLocaleString()}</span><span className="font-sans text-[26px] font-extrabold leading-none text-forest-900">฿{(unitPrice - potentialDiscount).toLocaleString()}</span></div><span className="mt-1 rounded bg-bamboo-50 border border-bamboo-200 px-2 py-0.5 text-[11px] font-bold text-bamboo-700 shadow-sm">ประหยัด ฿{potentialDiscount.toLocaleString()} เมื่อใช้โปรโมชั่น</span></div> : <span className="font-sans text-[26px] font-extrabold leading-none text-forest-900">฿{unitPrice.toLocaleString()}</span>}
                        </div>
                        <div className="flex flex-col mt-auto w-full lg:w-full">
                          <Link href={`/rooms/${room.id}?${searchParams.toString()}`} className="w-full rounded-xl bg-bamboo-600 py-3.5 text-center text-[14px] font-bold text-white shadow-md transition-all hover:bg-bamboo-700 hover:shadow-lg active:scale-[0.98]">
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
          
          {/* Desktop Booking Summary Sidebar */}
          {cart && cart.items && cart.items.length > 0 && (
            <aside className="hidden lg:block lg:w-[380px] shrink-0">
              <div className="sticky top-[160px]">
                <BookingSummaryCard />
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Floating Cart Button (Mobile Only) */}
      {cart && cart.items && cart.items.length > 0 && (
        <button
          onClick={() => setIsCartDrawerOpen(true)}
          className="lg:hidden fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-[#0A2E1F] text-white shadow-2xl transition-transform hover:scale-105 active:scale-95"
        >
          <div className="relative">
            <ShoppingCart size={24} />
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-[#0A2E1F]">
              {cart.items.length}
            </span>
          </div>
        </button>
      )}

      {/* Slide-over Drawer for Cart */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsCartDrawerOpen(false)}
          />
          
          {/* Drawer Panel */}
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl animate-in slide-in-from-right duration-300 overflow-y-auto">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-100 bg-white/80 px-6 py-4 backdrop-blur-md">
              <h2 className="text-lg font-display font-bold text-[#0A2E1F]">ตะกร้าห้องพัก</h2>
              <button
                onClick={() => setIsCartDrawerOpen(false)}
                className="rounded-full p-2 text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <BookingSummaryCard />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
