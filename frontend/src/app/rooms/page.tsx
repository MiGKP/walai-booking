"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Users,
  Calendar,
  Moon,
  AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatar";
import toast from "react-hot-toast";
import BookingCalendar, {
  DateRange,
  DayStatus,
} from "@/components/booking/BookingCalendar";
import { fetchRoomCalendar, toRoomDayStatus } from "@/lib/booking-calendar";
import {
  MonthCursor,
  addDaysISO,
  formatThaiDate,
  monthCursorFromISO,
  monthRangeISO,
  nightsBetween,
  todayISO,
} from "@/lib/date";

interface RoomType {
  id: number;
  room_name: string;
  type_name: string;
  description: string;
  capacity: number;
  price_per_night: number;
  main_image: string;
  available_count: number;
}

// เส้นระลอกน้ำใต้ header — โมทีฟเดียวกับ Navbar/Footer เพื่อให้ทุกหน้าดูเป็นชุดเดียวกัน
const WAVE_BOTTOM = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='8' viewBox='0 0 44 8'%3E%3Cpath d='M0 4 Q11 0 22 4 T44 4' fill='none' stroke='%23BFD3C4' stroke-width='1.2'/%3E%3C/svg%3E\")",
  backgroundRepeat: "repeat-x",
  backgroundPosition: "bottom",
  backgroundSize: "44px 8px",
} as const;

export default function RoomsPage(): React.ReactElement {
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

  const nights = range ? nightsBetween(range.start, range.end) : 0;

  useEffect(() => {
    let cancelled = false;
    const { start, end } = monthRangeISO(cursor);
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
      .get("/rooms", {
        params: { check_in: selected.start, check_out: selected.end },
      })
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

  const availableRooms = useMemo(
    () => rooms.filter((room) => Number(room.available_count) > 0),
    [rooms],
  );
  const fullRooms = useMemo(
    () => rooms.filter((room) => Number(room.available_count) <= 0),
    [rooms],
  );

  const rangeLabel = range
    ? `${formatThaiDate(range.start)} – ${formatThaiDate(range.end)}`
    : "ยังไม่เลือกวันที่";

  return (
    <div className="min-h-screen bg-cream-100 pt-10">
      {/* Header Section */}
      <header
        className="bg-gradient-to-b from-stone-100/50 to-cream-100"
        style={WAVE_BOTTOM}
      >
        <div className="container mx-auto px-4 py-6 lg:py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Title Block */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold tracking-widest uppercase text-forest-700">
                ที่พักริมน้ำ
              </span>
              <h1 className="font-display text-2xl font-medium tracking-tight text-forest-900 sm:text-3xl">
                ค้นหาห้องพักว่าง
              </h1>
            </div>

            {/* Subtitle / Tagline */}
            <p className="text-xs sm:text-sm text-charcoal-400">
              ระบุวันเช็คอิน-เช็คเอาต์ เพื่อตรวจสอบห้องพักและราคาทันที
            </p>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <div className="container mx-auto px-4 py-5 lg:py-6">
        <div className="grid gap-8 lg:grid-cols-[340px_1fr] lg:gap-12">
          {/* Sticky Sidebar (Booking Calendar) */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="card overflow-hidden rounded-2xl border border-stone-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md sm:p-6">
              <div className="mb-4 flex items-center gap-2 text-forest-900">
                <Calendar className="h-5 w-5 text-bamboo-600" />
                <h3 className="font-display text-lg font-medium">
                  เลือกวันเข้าพัก
                </h3>
              </div>

              <BookingCalendar
                mode="range"
                value={range}
                onSelect={setRange}
                cursor={cursor}
                onCursorChange={setCursor}
                dayStatus={dayStatus}
                loading={calendarLoading}
                minISO={today}
              />

              {/* Summary Info */}
              <div className="mt-6 space-y-3.5 border-t border-stone-100 pt-5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-charcoal-400">ช่วงที่เลือก</span>
                  <span className="font-medium text-forest-900">
                    {rangeLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-charcoal-400">จำนวนคืน</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-forest-900">
                    <Moon className="h-3.5 w-3.5 text-bamboo-500" />
                    {nights > 0 ? `${nights} คืน` : "—"}
                  </span>
                </div>

                <div className="rounded-xl bg-stone-50 p-3 text-xs leading-relaxed text-charcoal-500">
                  {nights === 0 && (
                    <p className="pt-1 text-xs text-charcoal-400">
                      กดเลือกวันเช็คอิน และเช็คเอาต์ในปฏิทิน
                    </p>
                  )}
                </div>
              </div>
            </div>
          </aside>

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
                  ลองเปลี่ยนช่วงวันเดินทางในปฏิทิน
                  แล้วระบบจะค้นหาให้ใหม่อัตโนมัติ
                </p>
              </div>
            ) : (
              <>
                {/* Result Header */}
                <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3 border-b border-stone-200/80 pb-4">
                  <h2 className="font-display text-2xl text-forest-900">
                    พบห้องว่าง{" "}
                    <span className="font-bold text-bamboo-600">
                      {availableRooms.length}
                    </span>{" "}
                    ประเภท
                  </h2>
                  {searchedRange && (
                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-charcoal-500">
                      {formatThaiDate(searchedRange.start)} –{" "}
                      {formatThaiDate(searchedRange.end)} (
                      {nightsBetween(searchedRange.start, searchedRange.end)}{" "}
                      คืน)
                    </span>
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
                    const totalPrice =
                      Number(room.price_per_night) * searchNights;

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
                              {isAvailable
                                ? `ว่าง ${availableCount} ห้อง`
                                : "เต็มในช่วงนี้"}
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
                                {room.type_name && (
                                  <span className="mt-0.5 inline-block text-xs font-medium text-charcoal-400">
                                    {room.type_name}
                                  </span>
                                )}
                              </div>

                              {/* Price Display */}
                              <div className="text-right">
                                <span className="font-display text-2xl font-semibold tracking-tight text-forest-900 tabular-nums">
                                  ฿
                                  {Number(
                                    room.price_per_night,
                                  ).toLocaleString()}
                                </span>
                                <span className="block text-[11px] font-medium text-charcoal-400 uppercase tracking-wider">
                                  / คืน
                                </span>
                              </div>
                            </div>

                            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-charcoal-500">
                              {room.description}
                            </p>
                          </div>

                          {/* Footer Details */}
                          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-stone-100 pt-4">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-charcoal-500 bg-stone-100/80 px-3 py-1.5 rounded-lg">
                              <Users className="h-4 w-4 text-stone-500" />
                              <span>รองรับได้สูงสุด {room.capacity} ท่าน</span>
                            </div>

                            {isAvailable && searchedRange ? (
                              <div className="flex items-center gap-4">
                                {searchNights > 0 && (
                                  <div className="text-right">
                                    <span className="block text-xs text-charcoal-400">
                                      ราคารวม ({searchNights} คืน)
                                    </span>
                                    <span className="text-sm font-semibold text-forest-900">
                                      ฿{totalPrice.toLocaleString()}
                                    </span>
                                  </div>
                                )}
                                <Link
                                  href={`/rooms/${room.id}?check_in=${searchedRange.start}&check_out=${searchedRange.end}`}
                                  className="inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-2.5 text-sm font-medium text-cream-100 transition-all duration-200 hover:bg-forest-800 hover:shadow-md active:scale-95"
                                >
                                  ดูรายละเอียด
                                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                </Link>
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
        </div>
      </div>
    </div>
  );
}