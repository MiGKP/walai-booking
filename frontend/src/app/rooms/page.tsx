"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Users,
  Calendar,
  Moon,
  AlertCircle,
  Plus,
  Minus,
  ChevronDown,
  X,
  Star,
  Wind,
  Tv,
  BedDouble,
  Sailboat,
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatar";
import toast from "react-hot-toast";
import BookingCalendar, {
  DateRange,
  DayStatus,
} from "@/components/booking/BookingCalendar";
import RoomCartPanel from "@/components/booking/RoomCartPanel";
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
import {
  RoomCartState,
  clearRoomCart,
  loadRoomCart,
  saveRoomCart,
  upsertCartItem,
} from "@/lib/room-cart";

interface RoomType {
  id: number;
  room_name: string;
  type_name: string;
  description: string;
  capacity: number;
  price_per_night: number;
  main_image: string;
  available_count: number;
  // ฟิลด์ตามขอบเขตงานที่ยังรอ backend ส่งมาจริง — เป็น optional ทั้งหมด
  // เพื่อไม่ให้พังถ้า API ยังไม่มี และไม่แสดง UI ส่วนนี้จนกว่าจะมีข้อมูลจริง
  package_price?: number;
  air_conditioner?: boolean;
  bed_size?: string;
  bed_count?: number;
  has_tv?: boolean;
  avg_rating?: number;
  review_count?: number;
}

function GuestStepper({
  label,
  value,
  min = 0,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (next: number) => void;
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-charcoal-600">{label}</span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`ลด${label}`}
          className="grid h-7 w-7 place-items-center rounded-full border border-stone-200 text-forest-800 hover:bg-forest-50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <Minus size={14} />
        </button>
        <span className="w-5 text-center text-sm font-semibold text-forest-900 tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          aria-label={`เพิ่ม${label}`}
          className="grid h-7 w-7 place-items-center rounded-full border border-stone-200 text-forest-800 hover:bg-forest-50 transition-colors"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

export default function RoomsPage(): React.ReactElement {
  const router = useRouter();
  const today = todayISO();

  const [range, setRange] = useState<DateRange | null>({
    start: today,
    end: addDaysISO(today, 1),
  });
  const [cursor, setCursor] = useState<MonthCursor>(() =>
    monthCursorFromISO(today),
  );
  const [dayStatus, setDayStatus] = useState<Record<string, DayStatus>>({});
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchedRange, setSearchedRange] = useState<DateRange | null>(null);
  const [cart, setCart] = useState<RoomCartState | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [openPanel, setOpenPanel] = useState<
    "type" | "guests" | "calendar" | null
  >(null);
  const [guests, setGuests] = useState<{ adults: number; children: number }>({
    adults: 1,
    children: 0,
  });
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [usePackage, setUsePackage] = useState<Record<number, boolean>>({});

  const pickerRef = useRef<HTMLDivElement>(null);

  const nights = range ? nightsBetween(range.start, range.end) : 0;
  const hasCartItems = Boolean(cart && cart.items.length > 0);

  useEffect(() => {
    const existing = loadRoomCart();
    if (existing) {
      setCart(existing);
      setGuests({ adults: existing.adults, children: existing.children });
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const checkIn = params.get("check_in");
    const checkOut = params.get("check_out");
    if (checkIn && checkOut && nightsBetween(checkIn, checkOut) > 0) {
      setRange({ start: checkIn, end: checkOut });
      setCursor(monthCursorFromISO(checkIn));
    }
  }, []);

  useEffect(() => {
    if (cart) saveRoomCart(cart);
  }, [cart]);

  // ปิด popover ที่เปิดอยู่เมื่อคลิกนอกแถบค้นหา
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpenPanel(null);
      }
    };
    if (openPanel) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openPanel]);

  const handleRangeSelect = (next: DateRange | null): void => {
    if (
      cart &&
      cart.items.length > 0 &&
      next &&
      (next.start !== cart.check_in || next.end !== cart.check_out)
    ) {
      const ok = window.confirm(
        "เปลี่ยนวันที่จะล้างรายการห้องในตะกร้า ต้องการดำเนินการต่อหรือไม่?",
      );
      if (!ok) return;
      clearRoomCart();
      setCart(null);
    }
    setRange(next);
  };

  const handleGuestsChange = (next: { adults: number; children: number }): void => {
    setGuests(next);
    setCart((prev) =>
      prev ? { ...prev, adults: next.adults, children: next.children } : prev,
    );
  };

  const ensureCart = (selected: DateRange): RoomCartState => {
    if (cart && cart.check_in === selected.start && cart.check_out === selected.end) {
      return cart;
    }
    return {
      check_in: selected.start,
      check_out: selected.end,
      adults: cart?.adults ?? guests.adults,
      children: cart?.children ?? guests.children,
      items: [],
    };
  };

  const getQuantity = (roomId: number): number => quantities[roomId] ?? 1;

  const setQuantity = (roomId: number, value: number, max: number): void => {
    const ceiling = Math.max(max, 1);
    const clamped = Math.min(Math.max(value, 1), ceiling);
    setQuantities((prev) => ({ ...prev, [roomId]: clamped }));
  };

  const handleAddToCart = (room: RoomType): void => {
    if (!searchedRange) {
      toast.error("กรุณาเลือกวันเข้าพักก่อน");
      return;
    }
    const wantsPackage = Boolean(usePackage[room.id] && room.package_price);
    const unitPrice =
      wantsPackage && room.package_price ? room.package_price : Number(room.price_per_night);

    const base = ensureCart(searchedRange);
    const next = upsertCartItem(base, {
      room_type_id: room.id,
      room_name: room.room_name,
      type_name: room.type_name,
      capacity: room.capacity,
      price_per_night: unitPrice,
      available_count: Number(room.available_count),
      quantity: getQuantity(room.id),
    });
    setCart(next);
    toast.success(`เพิ่ม ${room.room_name} แล้ว`);
  };

  const handleCheckout = async (options?: { promotion_id?: number }): Promise<void> => {
    if (!cart || cart.items.length === 0) return;
    setCheckoutLoading(true);
    try {
      const res = await api.post("/bookings/room", {
        check_in_date: cart.check_in,
        check_out_date: cart.check_out,
        adults: cart.adults,
        children: cart.children,
        items: cart.items.map((item) => ({
          room_type_id: item.room_type_id,
          quantity: item.quantity,
        })),
        ...(options?.promotion_id ? { promotion_id: options.promotion_id } : {}),
      });
      clearRoomCart();
      setCart(null);
      toast.success("จองห้องพักสำเร็จ!");
      router.push(`/payment?booking_type=room&booking_id=${res.data.data.room_booking_id}`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "จองห้องพักไม่สำเร็จ"));
    } finally {
      setCheckoutLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const { start, end } = multiMonthRangeISO(cursor, 2);
    setCalendarLoading(true);

    fetchRoomCalendar({ start, end })
      .then((days) => {
        if (cancelled) return;
        setDayStatus((prev) => ({ ...prev, ...toRoomDayStatus(days) }));
      })
      .catch(() => {
        if (!cancelled) toast.error("ไม่สามารถโหลดปฏิทินห้องว่างได้");
      })
      .finally(() => {
        if (!cancelled) setCalendarLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cursor]);

  // ค้นหาอัตโนมัติทุกครั้งที่เลือกช่วงวันครบ ไม่ต้องกดปุ่มค้นหาซ้ำ
  useEffect(() => {
    if (!range || nightsBetween(range.start, range.end) <= 0) return;

    let cancelled = false;
    const selected = range;
    setLoading(true);

    api
      .get("/rooms", { params: { check_in: selected.start, check_out: selected.end } })
      .then((res) => {
        if (cancelled) return;
        setRooms(Array.isArray(res.data?.data) ? res.data.data : []);
        setSearchedRange(selected);
      })
      .catch(() => {
        if (!cancelled) toast.error("ไม่สามารถโหลดข้อมูลห้องพักได้");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  const roomTypeOptions = useMemo(
    () => Array.from(new Set(rooms.map((room) => room.type_name).filter(Boolean))),
    [rooms],
  );

  const roomsByType = useMemo(
    () => (typeFilter === "all" ? rooms : rooms.filter((room) => room.type_name === typeFilter)),
    [rooms, typeFilter],
  );

  const availableRooms = useMemo(
    () => roomsByType.filter((room) => Number(room.available_count) > 0),
    [roomsByType],
  );
  const fullRooms = useMemo(
    () => roomsByType.filter((room) => Number(room.available_count) <= 0),
    [roomsByType],
  );

  const rangeLabel = range
    ? `${formatThaiDate(range.start)} – ${formatThaiDate(range.end)}`
    : "เลือกวันเข้าพัก";

  const totalGuests = guests.adults + guests.children;

  return (
    <div className="min-h-screen bg-cream-100 pt-10">
      {/* Header Section — โซนตัวกรอง แยกจากผลลัพธ์ด้วยเส้นขอบบางๆ */}
      <header className="border-b border-stone-200/70 bg-gradient-to-b from-stone-100/50 to-cream-100">
        <div className="container mx-auto px-4 py-6 lg:py-8">
          {/* แถบเดียวยาวต่อกัน: หัวข้อ + ประเภทห้องพัก + จำนวนคน + ปฏิทิน */}
          <div className="w-full" ref={pickerRef}>
            <div className="flex w-full flex-col divide-y divide-stone-100 rounded-3xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(28,45,34,0.04),0_16px_36px_-18px_rgba(28,45,34,0.16)] transition-shadow duration-300 hover:shadow-[0_1px_2px_rgba(28,45,34,0.04),0_20px_44px_-16px_rgba(28,45,34,0.22)] lg:flex-row lg:divide-x lg:divide-y-0 lg:rounded-full">
              {/* หัวข้อ */}
              <div className="flex shrink-0 items-center gap-3 px-6 py-4 lg:rounded-l-full lg:py-3">
                <div className="space-y-0.5">
                  <h1 className="font-display text-xl font-medium tracking-tight text-forest-900 sm:text-2xl">
                    ค้นหาห้องพักว่าง
                  </h1>
                  <p className="hidden text-xs text-charcoal-400 sm:block">
                    เลือกประเภทห้อง จำนวนผู้เข้าพัก และวันที่
                  </p>
                </div>
              </div>

              {/* ช่องที่ 1: ประเภทห้องพัก */}
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setOpenPanel((v) => (v === "type" ? null : "type"))}
                  aria-expanded={openPanel === "type"}
                  className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors duration-200 ${
                    openPanel === "type" ? "bg-forest-50/70" : "hover:bg-forest-50/50"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-50 text-forest-700 ring-1 ring-inset ring-forest-100">
                    <BedDouble size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium text-charcoal-400">
                      ประเภทห้องพัก
                    </span>
                    <span className="block truncate text-sm font-semibold text-forest-900">
                      {typeFilter === "all" ? "ทุกประเภท" : typeFilter}
                    </span>
                  </span>
                  <ChevronDown
                    size={14}
                    className="shrink-0 text-charcoal-400 transition-transform duration-200"
                    style={{ transform: openPanel === "type" ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>

                {/* Panel: ประเภทห้องพัก */}
                {openPanel === "type" && (
                  <div className="animate-dropdown absolute left-0 top-full z-40 mt-3 w-[92vw] max-w-[380px] rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_20px_50px_-18px_rgba(28,45,34,0.28)] sm:p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-display text-base font-medium text-forest-900">
                        ประเภทห้องพัก
                      </h3>
                      <button
                        type="button"
                        onClick={() => setOpenPanel(null)}
                        aria-label="ปิด"
                        className="rounded-full p-1.5 text-charcoal-400 transition-colors hover:bg-stone-100 hover:text-charcoal-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setTypeFilter("all");
                          setOpenPanel(null);
                        }}
                        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                          typeFilter === "all"
                            ? "bg-forest-900 text-cream-100"
                            : "border border-stone-200 bg-stone-50 text-charcoal-600 hover:border-forest-200 hover:bg-forest-50"
                        }`}
                      >
                        ทุกประเภทห้อง
                      </button>
                      {roomTypeOptions.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => {
                            setTypeFilter(type);
                            setOpenPanel(null);
                          }}
                          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                            typeFilter === type
                              ? "bg-forest-900 text-cream-100"
                              : "border border-stone-200 bg-stone-50 text-charcoal-600 hover:border-forest-200 hover:bg-forest-50"
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                      {roomTypeOptions.length === 0 && (
                        <p className="text-sm text-charcoal-400">
                          เลือกวันเข้าพักก่อนเพื่อดูประเภทห้องที่ว่าง
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* ช่องที่ 2: จำนวนคนเข้าพัก */}
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setOpenPanel((v) => (v === "guests" ? null : "guests"))}
                  aria-expanded={openPanel === "guests"}
                  className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors duration-200 ${
                    openPanel === "guests" ? "bg-forest-50/70" : "hover:bg-forest-50/50"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-50 text-forest-700 ring-1 ring-inset ring-forest-100">
                    <Users size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium text-charcoal-400">
                      จำนวนคนเข้าพัก
                    </span>
                    <span className="block truncate text-sm font-semibold text-forest-900">
                      {totalGuests} ท่าน
                    </span>
                  </span>
                  <ChevronDown
                    size={14}
                    className="shrink-0 text-charcoal-400 transition-transform duration-200"
                    style={{ transform: openPanel === "guests" ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>

                {/* Panel: จำนวนคนเข้าพัก */}
                {openPanel === "guests" && (
                  <div className="animate-dropdown absolute left-1/2 top-full z-40 mt-3 w-[92vw] max-w-[380px] -translate-x-1/2 rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_20px_50px_-18px_rgba(28,45,34,0.28)] sm:p-6 lg:left-0 lg:translate-x-0">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-display text-base font-medium text-forest-900">
                        จำนวนคนเข้าพัก
                      </h3>
                      <button
                        type="button"
                        onClick={() => setOpenPanel(null)}
                        aria-label="ปิด"
                        className="rounded-full p-1.5 text-charcoal-400 transition-colors hover:bg-stone-100 hover:text-charcoal-600"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="divide-y divide-stone-100">
                      <GuestStepper
                        label="ผู้ใหญ่"
                        value={guests.adults}
                        min={1}
                        onChange={(v) => handleGuestsChange({ ...guests, adults: v })}
                      />
                      <GuestStepper
                        label="เด็ก"
                        value={guests.children}
                        min={0}
                        onChange={(v) => handleGuestsChange({ ...guests, children: v })}
                      />
                    </div>
                    <div className="mt-4 flex justify-end border-t border-stone-100 pt-4">
                      <button
                        type="button"
                        onClick={() => setOpenPanel(null)}
                        className="rounded-full bg-forest-900 px-5 py-2 text-sm font-medium text-cream-100 transition-colors hover:bg-forest-800"
                      >
                        เสร็จสิ้น
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* ช่องที่ 3: ปฏิทิน */}
              <div className="relative flex-1">
                <button
                  type="button"
                  onClick={() => setOpenPanel((v) => (v === "calendar" ? null : "calendar"))}
                  aria-expanded={openPanel === "calendar"}
                  className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors duration-200 lg:rounded-r-full ${
                    openPanel === "calendar" ? "bg-forest-50/70" : "hover:bg-forest-50/50"
                  }`}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-forest-50 text-forest-700 ring-1 ring-inset ring-forest-100">
                    <Calendar size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium text-charcoal-400">
                      วันเข้าพัก – วันออก
                    </span>
                    <span className="block truncate text-sm font-semibold text-forest-900">
                      {rangeLabel}
                      {nights > 0 && (
                        <span className="ml-1 font-normal text-charcoal-400">({nights} คืน)</span>
                      )}
                    </span>
                  </span>
                  <ChevronDown
                    size={14}
                    className="shrink-0 text-charcoal-400 transition-transform duration-200"
                    style={{ transform: openPanel === "calendar" ? "rotate(180deg)" : "rotate(0deg)" }}
                  />
                </button>

                {/* Panel: ปฏิทิน */}
                {openPanel === "calendar" && (
                  <div className="animate-dropdown absolute right-0 top-full z-40 mt-3 w-[92vw] max-w-[640px] rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_20px_50px_-18px_rgba(28,45,34,0.28)] sm:p-6">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-display text-base font-medium text-forest-900">
                        เลือกวันเข้าพัก
                      </h3>
                      <button
                        type="button"
                        onClick={() => setOpenPanel(null)}
                        aria-label="ปิด"
                        className="rounded-full p-1.5 text-charcoal-400 transition-colors hover:bg-stone-100 hover:text-charcoal-600"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <BookingCalendar
                      mode="range"
                      value={range}
                      onSelect={handleRangeSelect}
                      cursor={cursor}
                      onCursorChange={setCursor}
                      dayStatus={dayStatus}
                      loading={calendarLoading}
                      minISO={today}
                    />

                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-stone-100 pt-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-charcoal-500">
                        <Moon className="h-3.5 w-3.5 text-bamboo-500" />
                        {nights > 0 ? `รวม ${nights} คืน` : "ยังไม่ได้เลือกช่วงวัน"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setOpenPanel(null)}
                        className="rounded-full bg-forest-900 px-5 py-2 text-sm font-medium text-cream-100 transition-colors hover:bg-forest-800"
                      >
                        เสร็จสิ้น
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="container mx-auto px-4 py-6 lg:py-8">
        <div
          className={`grid gap-8 ${
            hasCartItems ? "lg:grid-cols-[1fr_360px] lg:gap-10" : ""
          }`}
        >
          {/* Rooms List Section */}
          <section aria-live="polite">
            {loading ? (
              /* Skeleton Loader */
              <div className="space-y-6">
                {[0, 1, 2].map((index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-5 overflow-hidden rounded-2xl border border-stone-200/60 bg-white p-5 shadow-sm animate-pulse sm:flex-row"
                  >
                    <div className="h-48 w-full shrink-0 rounded-xl bg-stone-200/80 sm:h-44 sm:w-60" />
                    <div className="flex flex-1 flex-col justify-between space-y-3 py-1">
                      <div className="space-y-2">
                        <div className="h-6 w-1/3 rounded-lg bg-stone-200/80" />
                        <div className="h-4 w-2/3 rounded-lg bg-stone-200/60" />
                        <div className="h-4 w-full rounded-lg bg-stone-200/60" />
                      </div>
                      <div className="flex justify-between pt-4">
                        <div className="h-5 w-24 rounded-lg bg-stone-200/80" />
                        <div className="h-8 w-28 rounded-lg bg-stone-200/80" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : rooms.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/50 px-6 py-20 text-center backdrop-blur-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-forest-50 text-forest-700">
                  <AlertCircle className="h-6 w-6" />
                </div>
                <p className="mt-4 font-display text-xl font-medium text-forest-900">
                  ยังไม่พบห้องพักที่ว่าง
                </p>
                <p className="mt-1 text-sm text-charcoal-400">
                  ลองเปลี่ยนช่วงวันเดินทางในปฏิทิน แล้วระบบจะค้นหาให้ใหม่อัตโนมัติ
                </p>
              </div>
            ) : (
              <>
                {/* Result Header — บอกผลลัพธ์และตัวกรองที่ใช้อยู่ให้ชัดเจน */}
                <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-stone-200/80 pb-4">
                  <div>
                    <h2 className="font-display text-xl font-medium text-forest-900 sm:text-2xl">
                      พบห้องว่าง <span className="font-bold text-bamboo-600">{availableRooms.length}</span> ประเภท
                    </h2>
                    {searchedRange && (
                      <p className="mt-1 text-sm text-charcoal-400">
                        {formatThaiDate(searchedRange.start)} – {formatThaiDate(searchedRange.end)}
                        {" · "}
                        {nightsBetween(searchedRange.start, searchedRange.end)} คืน
                        {" · "}
                        {totalGuests} ท่าน
                      </p>
                    )}
                  </div>
                  {typeFilter !== "all" && (
                    <button
                      type="button"
                      onClick={() => setTypeFilter("all")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-charcoal-600 transition-colors hover:bg-stone-50"
                    >
                      {typeFilter}
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Rooms Grid */}
                <div className="space-y-6">
                  {[...availableRooms, ...fullRooms].map((room) => {
                    const availableCount = Number(room.available_count);
                    const isAvailable = availableCount > 0;
                    const searchNights = searchedRange
                      ? nightsBetween(searchedRange.start, searchedRange.end)
                      : nights;
                    const quantity = getQuantity(room.id);
                    const wantsPackage = Boolean(usePackage[room.id] && room.package_price);
                    const unitPrice =
                      wantsPackage && room.package_price ? room.package_price : Number(room.price_per_night);
                    const totalPrice = unitPrice * searchNights * quantity;

                    const hasSpecs =
                      room.air_conditioner !== undefined ||
                      room.has_tv !== undefined ||
                      room.bed_size !== undefined ||
                      room.bed_count !== undefined;

                    return (
                      <article
                        key={room.id}
                        className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-300 sm:flex-row ${
                          isAvailable
                            ? "border-stone-200/80 hover:-translate-y-1 hover:border-bamboo-300 hover:shadow-xl hover:shadow-stone-200/50"
                            : "border-stone-200/50 bg-stone-50/50 opacity-60"
                        }`}
                      >
                        {/* Image Container */}
                        <div className="relative h-56 shrink-0 overflow-hidden bg-stone-100 sm:h-auto sm:w-64">
                          {room.main_image ? (
                            <Image
                              src={resolveMediaUrl(room.main_image)}
                              alt={room.room_name}
                              fill
                              sizes="(max-width: 640px) 100vw, 256px"
                              className="object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center bg-forest-50 font-display text-sm font-medium text-forest-700">
                              ที่พักริมน้ำ
                            </div>
                          )}

                          {/* Availability Badge Overlay */}
                          <div className="absolute top-3 left-3">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur-md shadow-sm ${
                                isAvailable
                                  ? "bg-forest-700/90 text-cream-100"
                                  : "bg-stone-800/80 text-stone-200"
                              }`}
                            >
                              {isAvailable ? `ว่าง ${availableCount} ห้อง` : "เต็มในช่วงนี้"}
                            </span>
                          </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex flex-1 flex-col justify-between p-6">
                          <div>
                            <div className="flex items-start justify-between gap-4">
                              <div>
                                <h3 className="font-display text-xl font-medium text-forest-900 transition-colors group-hover:text-bamboo-600">
                                  {room.room_name}
                                </h3>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                  {room.type_name && (
                                    <span className="text-xs font-medium text-charcoal-400">
                                      {room.type_name}
                                    </span>
                                  )}
                                  {typeof room.avg_rating === "number" && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                      <Star size={11} className="fill-amber-400 text-amber-400" />
                                      {room.avg_rating.toFixed(1)}
                                      {typeof room.review_count === "number" && (
                                        <span className="font-normal text-amber-600">
                                          ({room.review_count})
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Price Display */}
                              <div className="shrink-0 text-right">
                                <span className="font-display text-2xl font-semibold tracking-tight text-forest-900 tabular-nums">
                                  ฿{unitPrice.toLocaleString()}
                                </span>
                                <span className="block text-[11px] font-medium text-charcoal-400">ต่อคืน</span>
                              </div>
                            </div>

                            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-charcoal-500">
                              {room.description}
                            </p>

                            {/* Specs — แสดงเฉพาะฟิลด์ที่ API ส่งมาจริง */}
                            {hasSpecs && (
                              <div className="mt-3 flex flex-wrap gap-3 text-xs text-charcoal-500">
                                {room.air_conditioner && (
                                  <span className="inline-flex items-center gap-1">
                                    <Wind size={13} className="text-forest-700" /> แอร์
                                  </span>
                                )}
                                {room.has_tv && (
                                  <span className="inline-flex items-center gap-1">
                                    <Tv size={13} className="text-forest-700" /> ทีวี
                                  </span>
                                )}
                                {(room.bed_size || room.bed_count) && (
                                  <span className="inline-flex items-center gap-1">
                                    <BedDouble size={13} className="text-forest-700" />
                                    {room.bed_count ? `${room.bed_count} เตียง ` : ""}
                                    {room.bed_size ?? ""}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Package toggle — แสดงเฉพาะห้องที่มีราคาแพ็คเกจจริง */}
                            {room.package_price && (
                              <div className="mt-3 inline-flex rounded-full border border-stone-200 p-0.5 text-xs">
                                <button
                                  type="button"
                                  onClick={() => setUsePackage((prev) => ({ ...prev, [room.id]: false }))}
                                  className={`rounded-full px-3 py-1 font-medium transition-colors ${
                                    !wantsPackage
                                      ? "bg-forest-800 text-cream-100"
                                      : "text-charcoal-500 hover:bg-stone-50"
                                  }`}
                                >
                                  ราคาปกติ
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setUsePackage((prev) => ({ ...prev, [room.id]: true }))}
                                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium transition-colors ${
                                    wantsPackage
                                      ? "bg-forest-800 text-cream-100"
                                      : "text-charcoal-500 hover:bg-stone-50"
                                  }`}
                                >
                                  <Sailboat size={12} />
                                  แพ็คเกจ + บัตรพายเรือ
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Footer Details — จัดกลุ่ม "ข้อมูล" กับ "การกระทำ" แยกกันชัดเจน และให้ปุ่มหลัก (เพิ่มลงตะกร้า) เด่นกว่าปุ่มรอง */}
                          <div className="mt-6 flex flex-col gap-4 border-t border-stone-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-charcoal-500 bg-stone-100/80 px-3 py-1.5 rounded-lg w-fit">
                              <Users className="h-4 w-4 text-stone-500" />
                              <span>รองรับได้สูงสุด {room.capacity} ท่าน</span>
                            </div>

                            {isAvailable && searchedRange ? (
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                <div className="flex items-center justify-between gap-3 sm:justify-start">
                                  {/* จำนวนห้องพัก */}
                                  <div className="flex items-center gap-2 rounded-xl border border-stone-200 px-2 py-1">
                                    <button
                                      type="button"
                                      onClick={() => setQuantity(room.id, quantity - 1, availableCount)}
                                      disabled={quantity <= 1}
                                      aria-label="ลดจำนวนห้อง"
                                      className="grid h-6 w-6 place-items-center rounded-full text-forest-800 hover:bg-forest-50 disabled:opacity-30"
                                    >
                                      <Minus size={12} />
                                    </button>
                                    <span className="w-4 text-center text-sm font-semibold text-forest-900 tabular-nums">
                                      {quantity}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setQuantity(room.id, quantity + 1, availableCount)}
                                      disabled={quantity >= availableCount}
                                      aria-label="เพิ่มจำนวนห้อง"
                                      className="grid h-6 w-6 place-items-center rounded-full text-forest-800 hover:bg-forest-50 disabled:opacity-30"
                                    >
                                      <Plus size={12} />
                                    </button>
                                  </div>

                                  {searchNights > 0 && (
                                    <div className="text-right sm:hidden">
                                      <span className="block text-xs text-charcoal-400">
                                        {searchNights} คืน × {quantity} ห้อง
                                      </span>
                                      <span className="text-sm font-semibold text-forest-900">
                                        ฿{totalPrice.toLocaleString()}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {searchNights > 0 && (
                                  <div className="hidden text-right sm:block">
                                    <span className="block text-xs text-charcoal-400">
                                      ({searchNights} คืน × {quantity} ห้อง)
                                    </span>
                                    <span className="text-sm font-semibold text-forest-900">
                                      ฿{totalPrice.toLocaleString()}
                                    </span>
                                  </div>
                                )}

                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/rooms/${room.id}?check_in=${searchedRange.start}&check_out=${searchedRange.end}`}
                                    className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 px-3.5 py-2.5 text-sm font-medium text-forest-800 transition-colors hover:bg-forest-50"
                                  >
                                    ดูรายละเอียด
                                  </Link>
                                  <button
                                    type="button"
                                    onClick={() => handleAddToCart(room)}
                                    className="inline-flex items-center gap-1.5 rounded-xl bg-forest-900 px-4 py-2.5 text-sm font-medium text-cream-100 transition-all duration-200 hover:bg-forest-800 hover:shadow-md active:scale-95"
                                  >
                                    <Plus className="h-4 w-4" />
                                    เพิ่มลงตะกร้า
                                  </button>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          {/* Cart Sidebar — โผล่มาเฉพาะตอนมีของในตะกร้า */}
          {hasCartItems && cart && (
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <RoomCartPanel
                cart={cart}
                onChange={setCart}
                onClear={() => {
                  clearRoomCart();
                  setCart(null);
                }}
                onCheckout={handleCheckout}
                checkoutLoading={checkoutLoading}
              />
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}