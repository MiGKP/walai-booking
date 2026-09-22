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
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatar";
import toast from "react-hot-toast";
import BookingCalendar, {
  DateRange,
  DayStatus,
} from "@/components/booking/BookingCalendar";
import BookingSummaryCard from "@/components/booking/BookingSummaryCard";
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
        <input type="text" inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))} onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} onFocus={(e) => e.currentTarget.select()} aria-label={ariaLabel} className="h-7 w-9 rounded-md border border-transparent bg-transparent text-center text-[13px] font-bold tabular-nums text-forest-900 transition-colors hover:border-stone-200 focus:border-forest-400 focus:bg-[#FFFFFF] focus:outline-none" />
      ) : (
        <span className="w-9 text-center text-[13px] font-bold tabular-nums text-forest-900">{value}</span>
      )}
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`เพิ่ม${ariaLabel}`} className={btn}><Plus size={13} /></button>
    </div>
  );
}

function GuestRow({ label, hint, value, min, max = 20, onChange }: { label: string; hint: string; value: number; min: number; max?: number; onChange: (next: number) => void; }): React.ReactElement {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-charcoal-700">{label}</p>
        <p className="text-[10.5px] text-stone-400">{hint}</p>
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const today = todayISO();

  const checkIn = searchParams.get("check_in") || today;
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

  const pickerRef = useRef<HTMLDivElement>(null);
  const nights = range ? nightsBetween(range.start, range.end) : 0;

  useEffect(() => {
    const adults = parseInt(searchParams.get("adults") || "1", 10);
    const children = parseInt(searchParams.get("children") || "0", 10);
    setGuests({ adults, children });
  }, [searchParams]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpenPanel(null); };
    if (openPanel) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openPanel]);

  const handleRangeSelect = (next: DateRange | null): void => {
    setRange(next);
    if (next && nightsBetween(next.start, next.end) > 0) {
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

  const handleSelectPromo = (code: string): void => {
    const params = new URLSearchParams(searchParams.toString());
    let nextCodes: string[];
    if (selectedPromoCodes.includes(code)) {
      nextCodes = selectedPromoCodes.filter((c) => c !== code);
    } else {
      nextCodes = [...selectedPromoCodes, code];
      toast.success(`ใช้โค้ดส่วนลด ${code} แล้ว`);
    }
    if (nextCodes.length > 0) params.set("promo_code", nextCodes.join(","));
    else params.delete("promo_code");
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
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
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
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
  const totalGuests = guests.adults + guests.children;
  const availableRooms = useMemo(() => roomsByType.filter((room) => Number(room.available_count) > 0 && Number(room.capacity) >= totalGuests), [roomsByType, totalGuests]);
  const fullRooms = useMemo(() => roomsByType.filter((room) => Number(room.available_count) <= 0 || Number(room.capacity) < totalGuests), [roomsByType, totalGuests]);

  return (
    <div className="min-h-screen bg-cream-100 pb-20 pt-4">
      <header className="relative z-30 mb-8 mt-16 sm:mt-20">
        <div className="container mx-auto px-4">
          <div className="mx-auto w-full max-w-4xl" ref={pickerRef}>
            <div className="flex w-full flex-col divide-y divide-stone-100 rounded-3xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(18,60,48,0.02),0_8px_24px_-8px_rgba(18,60,48,0.1)] transition-all duration-500 hover:shadow-[0_1px_2px_rgba(18,60,48,0.02),0_12px_32px_-8px_rgba(18,60,48,0.15)] lg:flex-row lg:divide-x lg:divide-y-0 lg:rounded-full">
              <div className="relative flex-1">
                <button type="button" onClick={() => setOpenPanel((v) => (v === "type" ? null : "type"))} className={`flex h-full w-full items-center gap-3 px-6 py-3 text-left transition-colors duration-200 lg:rounded-l-full ${openPanel === "type" ? "bg-forest-50/40" : "hover:bg-forest-50/30"}`}>
                  <BedDouble size={16} className="shrink-0 text-forest-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-charcoal-400">ประเภทที่พัก</span>
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
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-charcoal-400">ผู้เข้าพัก</span>
                    <span className="block truncate text-sm font-semibold text-forest-900">{guests.adults + guests.children} ท่าน</span>
                  </span>
                  <ChevronDown size={12} className="shrink-0 text-charcoal-300 transition-transform duration-300" style={{ transform: openPanel === "guests" ? "rotate(180deg)" : "rotate(0deg)" }} />
                </button>
                {openPanel === "guests" && (
                  <div className="animate-dropdown absolute left-1/2 top-full z-40 mt-2 w-[320px] -translate-x-1/2 rounded-2xl border border-stone-200 bg-white p-2 shadow-xl lg:left-0 lg:translate-x-0">
                    <GuestRow label="ผู้ใหญ่" hint="อายุ 12 ปีขึ้นไป" value={guests.adults} min={1} onChange={(v) => handleGuestsChange({ ...guests, adults: v })} />
                    <GuestRow label="เด็ก" hint="อายุ 0–11 ปี" value={guests.children} min={0} onChange={(v) => handleGuestsChange({ ...guests, children: v })} />
                    <div className="px-3 py-2 bg-stone-50 rounded-xl mt-1 mb-2">
                      <p className="text-[10px] text-charcoal-400 leading-relaxed">
                        <span className="font-bold text-forest-700">นโยบายเด็ก:</span> 0-5 ปี เข้าพักฟรีไม่มีค่าใช้จ่าย, 6-11 ปี คิดราคาเด็ก (เตียงเสริม), 12 ปีขึ้นไป คิดราคาผู้ใหญ่
                      </p>
                    </div>
                    <div className="border-t border-stone-100 p-2">
                      <button
                        type="button"
                        onClick={() => setOpenPanel(null)}
                        className="w-full rounded-xl bg-forest-900 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-forest-800"
                      >
                        ตกลง
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="relative flex-[1.4]">
                <button type="button" onClick={() => setOpenPanel((v) => (v === "calendar" ? null : "calendar"))} className={`flex h-full w-full items-center gap-3 px-6 py-3 text-left transition-colors duration-200 lg:rounded-r-full ${openPanel === "calendar" ? "bg-forest-50/40" : "hover:bg-forest-50/30"}`}>
                  <Calendar size={16} className="shrink-0 text-forest-700" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-bold uppercase tracking-wider text-charcoal-400">วันเข้าพัก – วันออก</span>
                    <span className="block truncate text-sm font-semibold text-forest-900">{range ? `${formatThaiDate(range.start)} – ${formatThaiDate(range.end)}` : "เลือกวันเข้าพัก"}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {nights > 0 && <span className="rounded-full bg-forest-100 px-2 py-0.5 text-[9px] font-bold text-forest-800">{nights} คืน</span>}
                    <ChevronDown size={12} className="shrink-0 text-charcoal-300 transition-transform duration-300" style={{ transform: openPanel === "calendar" ? "rotate(180deg)" : "rotate(0deg)" }} />
                  </div>
                </button>
                {openPanel === "calendar" && (
                  <div className="animate-dropdown absolute right-0 top-full z-40 mt-2 w-[min(600px,calc(100vw-2rem))] rounded-3xl border border-stone-200 bg-white p-5 shadow-2xl">
                    <div className="mb-4 flex items-center justify-between px-2">
                      <h3 className="font-display text-base font-medium text-forest-900">เลือกช่วงวันเข้าพัก</h3>
                      <button type="button" onClick={() => setOpenPanel(null)} className="text-charcoal-300 hover:text-charcoal-500"><X size={18} /></button>
                    </div>
                    <BookingCalendar mode="range" value={range} onSelect={handleRangeSelect} cursor={cursor} onCursorChange={setCursor} dayStatus={dayStatus} loading={calendarLoading} minISO={today} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 lg:py-2">
        <div className="flex flex-col gap-8 lg:flex-row">
          <section className="flex-1">
            {loading && rooms.length === 0 ? (
              <div className="grid gap-6">{[0, 1].map((index) => <div key={index} className="h-64 w-full animate-pulse rounded-2xl border border-stone-100 bg-white" />)}</div>
            ) : roomsByType.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-stone-300 bg-white/40 px-6 py-20 text-center backdrop-blur-sm">
                <AlertCircle className="mb-4 h-8 w-8 text-stone-300" />
                <h3 className="font-display text-lg font-medium text-forest-900">ไม่พบที่พักในช่วงนี้</h3>
                <p className="mt-1 text-sm text-charcoal-400">ลองเปลี่ยนช่วงวันที่ หรือเลือกประเภทที่พักอื่น</p>
                <button type="button" onClick={handleClearFilters} className="mt-6 rounded-xl border border-stone-200 bg-white px-6 py-2.5 text-[13px] font-bold text-forest-800 shadow-sm transition-colors hover:bg-stone-50">ล้างการค้นหา</button>
              </div>
            ) : (
              <div className={`grid gap-8 transition-opacity duration-300 ${loading ? 'pointer-events-none opacity-50' : 'opacity-100'}`}>
                {[...availableRooms, ...fullRooms].map((room, idx) => {
                  const availableCount = Number(room.available_count);
                  const isCapacityEnough = Number(room.capacity) >= totalGuests;
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
                  const finalPrice = unitPrice - discount;

                  return (
                    <article key={room.id} style={{ animationDelay: `${idx * 100}ms` }} className={`animate-reveal-up group relative grid grid-cols-1 overflow-hidden rounded-2xl border bg-white transition-all duration-300 lg:grid-cols-[320px_1fr_280px] ${isAvailable ? "border-stone-200/80 hover:border-forest-300 hover:shadow-md" : "border-stone-100 bg-stone-50/50 opacity-60"}`}>
                      <div className="relative h-48 w-full overflow-hidden lg:h-full">
                        {room.main_image ? <Image src={resolveMediaUrl(room.main_image)} alt={room.room_name} fill sizes="(max-width: 1024px) 100vw, 320px" className="object-cover transition-transform duration-1000 group-hover:scale-105" priority={idx < 2} /> : <div className="h-full w-full bg-stone-50" />}
                      </div>
                      <div className="flex flex-col justify-between border-b border-stone-100 p-5 lg:border-b-0 lg:border-r lg:border-stone-100 lg:p-6">
                        <div className="space-y-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded bg-bamboo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-bamboo-600">{room.type_name}</span>
                            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${isAvailable ? "bg-forest-50 text-forest-700" : "bg-stone-200 text-stone-600"}`}>
                              {isAvailable ? `ว่าง ${availableCount} ห้อง` : !isCapacityEnough ? "ความจุไม่พอ" : "เต็ม"}
                            </span>
                            {typeof room.avg_rating !== "undefined" && <div className="flex items-center gap-1.5 rounded-full bg-amber-50/70 px-2 py-0.5 text-[11px] font-bold text-amber-600"><Star size={11} className="fill-amber-400 text-amber-400" /><span>{Number(room.avg_rating).toFixed(1)}</span><span className="font-medium text-stone-500">({room.review_count ?? 0} รีวิว)</span></div>}
                          </div>
                          <div><h3 className="font-sans text-[20px] font-semibold leading-tight text-forest-900">{room.room_name}</h3><p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-charcoal-400">{room.description}</p></div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-4 border-t border-stone-100 pt-3">
                          <div className="flex items-center gap-1.5 text-[13px] text-charcoal-500"><Users size={14} className="text-forest-400" /><span>ความจุ {room.capacity} ท่าน</span></div>
                          {room.air_conditioner && <div className="flex items-center gap-1.5 text-[13px] text-charcoal-500"><Wind size={14} className="text-forest-400" /><span>เครื่องปรับอากาศ</span></div>}
                          {room.bed_size && <div className="flex items-center gap-1.5 text-[13px] text-charcoal-500"><BedDouble size={14} className="text-forest-400" /><span>{room.bed_size}</span></div>}
                        </div>
                        {room.available_promotions && room.available_promotions.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {room.available_promotions.map((promo) => (
                              <button
                                key={promo.id}
                                type="button"
                                onClick={() => handleSelectPromo(promo.code)}
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors ${selectedPromoCodes.includes(promo.code) ? "border-emerald-600 bg-emerald-600 text-white" : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400"}`}
                              >
                                <Tag size={11} />
                                {promo.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col justify-between bg-stone-50/40 p-5 lg:bg-white lg:p-6">
                        <div className="mb-4 lg:text-right">{room.today_bookings > 0 ? <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700"><span className="h-1.5 w-1.5 rounded-full bg-orange-500" />ยอดจองวันนี้ {room.today_bookings} ครั้ง</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-stone-500">ยังไม่มีการจองวันนี้</span>}</div>
                        <div className="mb-6 flex flex-col items-start gap-1 lg:items-end">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-charcoal-400">ราคาต่อคืน</span>
                          {discount > 0 ? <div className="flex w-full flex-col items-start lg:items-end"><div className="flex items-baseline gap-1.5"><span className="text-sm font-medium text-stone-400 line-through">฿{unitPrice.toLocaleString()}</span><span className="font-sans text-[26px] font-extrabold leading-none text-forest-900">฿{finalPrice.toLocaleString()}</span></div><span className="mt-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">ประหยัด ฿{discount.toLocaleString()}</span></div> : <span className="font-sans text-[26px] font-extrabold leading-none text-forest-900">฿{unitPrice.toLocaleString()}</span>}
                        </div>
                        <div className="flex flex-row gap-2.5 lg:w-full lg:flex-col">
                          <Link href={`/rooms/${room.id}?${searchParams.toString()}`} className="flex-1 rounded-xl border border-stone-200 bg-white py-3 text-center text-[13px] font-bold text-forest-800 shadow-sm transition-colors hover:bg-stone-50 lg:w-full">ดูรายละเอียด</Link>
                          {isAvailable && searchedRange && <Link href={`/rooms/${room.id}?${searchParams.toString()}#room-picker`} className="flex-1 rounded-xl bg-forest-900 py-3 text-center text-[13px] font-bold text-white shadow-md transition-all hover:bg-forest-800 hover:shadow-lg active:scale-[0.98] lg:w-full">จองที่พัก</Link>}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
          <aside className="lg:w-[360px]"><div className="lg:sticky lg:top-24"><BookingSummaryCard /></div></aside>
        </div>
      </div>
    </div>
  );
}