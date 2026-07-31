'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Users } from 'lucide-react';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/avatar';
import toast from 'react-hot-toast';
import BookingCalendar, { DateRange, DayStatus } from '@/components/booking/BookingCalendar';
import { fetchRoomCalendar, toRoomDayStatus } from '@/lib/booking-calendar';
import {
  MonthCursor,
  addDaysISO,
  formatThaiDate,
  monthCursorFromISO,
  monthRangeISO,
  nightsBetween,
  todayISO,
} from '@/lib/date';

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

export default function RoomsPage(): React.ReactElement {
  const today = todayISO();

  const [range, setRange] = useState<DateRange | null>({ start: today, end: addDaysISO(today, 1) });
  const [cursor, setCursor] = useState<MonthCursor>(() => monthCursorFromISO(today));
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
        if (!cancelled) toast.error('ไม่สามารถโหลดปฏิทินห้องว่างได้');
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
      .get('/rooms', { params: { check_in: selected.start, check_out: selected.end } })
      .then((res) => {
        if (cancelled) return;
        setRooms(Array.isArray(res.data?.data) ? res.data.data : []);
        setSearchedRange(selected);
      })
      .catch(() => {
        if (!cancelled) toast.error('ไม่สามารถโหลดข้อมูลห้องพักได้');
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
    [rooms]
  );
  const fullRooms = useMemo(
    () => rooms.filter((room) => Number(room.available_count) <= 0),
    [rooms]
  );

  const rangeLabel = range
    ? `${formatThaiDate(range.start)} – ${formatThaiDate(range.end)}`
    : 'ยังไม่เลือกวันที่';

  return (
    <div className="min-h-screen bg-cream-200 pt-16">
      <header className="border-b border-stone-200 bg-cream-100">
        <div className="container mx-auto px-4 py-14 lg:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-lagoon-600">
            ที่พักริมน้ำ
          </p>
          <h1 className="mt-3 max-w-2xl text-balance font-display text-4xl leading-tight text-forest-900 lg:text-5xl">
            เลือกคืนที่อยากพัก แล้วดูห้องที่ว่างจริง
          </h1>
          <div className="mt-6 h-px w-24 bg-bamboo-400" />
          <p className="mt-6 max-w-xl text-charcoal-500">
            ปฏิทินแสดงสถานะห้องว่างรายคืน คืนที่ขีดฆ่าคือเต็มแล้ว จุดสีส้มคือเหลือไม่กี่ห้อง
          </p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-12">
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="card p-5 sm:p-6">
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

              <div className="mt-5 space-y-3 border-t border-stone-200 pt-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-charcoal-400">ช่วงที่เลือก</span>
                  <span className="text-right text-sm font-medium text-forest-900">{rangeLabel}</span>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm text-charcoal-400">จำนวนคืน</span>
                  <span className="text-sm font-medium text-forest-900">
                    {nights > 0 ? `${nights} คืน` : '—'}
                  </span>
                </div>
                <p className="pt-1 text-xs leading-relaxed text-charcoal-400">
                  {nights > 0
                    ? 'ผลการค้นหาอัปเดตตามช่วงวันที่เลือกทันที'
                    : 'กดวันเช็คอิน แล้วกดวันเช็คเอาต์เพื่อดูห้องว่าง'}
                </p>
              </div>
            </div>
          </aside>

          <section aria-live="polite">
            {loading ? (
              <div className="space-y-5">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="card flex animate-pulse gap-5 p-5">
                    <div className="h-28 w-40 shrink-0 rounded-xl bg-stone-200" />
                    <div className="flex-1 space-y-3 py-2">
                      <div className="h-5 w-2/5 rounded bg-stone-200" />
                      <div className="h-4 w-4/5 rounded bg-stone-200" />
                      <div className="h-4 w-1/4 rounded bg-stone-200" />
                    </div>
                  </div>
                ))}
              </div>
            ) : rooms.length === 0 ? (
              <div className="card px-6 py-20 text-center">
                <p className="font-display text-xl text-forest-900">ยังไม่พบห้องพัก</p>
                <p className="mt-2 text-sm text-charcoal-400">
                  ลองเลือกช่วงวันอื่นแล้วกดค้นหาอีกครั้ง
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-200 pb-3">
                  <h2 className="font-display text-xl text-forest-900">
                    ห้องว่าง {availableRooms.length} ประเภท
                  </h2>
                  {searchedRange && (
                    <p className="text-sm text-charcoal-400">
                      {formatThaiDate(searchedRange.start)} – {formatThaiDate(searchedRange.end)} ·{' '}
                      {nightsBetween(searchedRange.start, searchedRange.end)} คืน
                    </p>
                  )}
                </div>

                <div className="space-y-4">
                  {[...availableRooms, ...fullRooms].map((room) => {
                    const availableCount = Number(room.available_count);
                    const isAvailable = availableCount > 0;
                    const searchNights = searchedRange
                      ? nightsBetween(searchedRange.start, searchedRange.end)
                      : nights;
                    const totalPrice = Number(room.price_per_night) * searchNights;

                    return (
                      <article
                        key={room.id}
                        className={`card overflow-hidden transition-colors sm:flex ${
                          isAvailable ? 'hover:border-lagoon-300' : 'opacity-60'
                        }`}
                      >
                        <div className="relative h-48 shrink-0 bg-stone-200 sm:h-auto sm:w-56">
                          {room.main_image ? (
                            <img
                              src={resolveMediaUrl(room.main_image)}
                              alt={room.room_name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center bg-lagoon-50 font-display text-sm text-lagoon-600">
                              ห้องลอยน้ำ
                            </div>
                          )}
                        </div>

                        <div className="flex flex-1 flex-col p-5 sm:p-6">
                          <div className="flex items-start justify-between gap-4">
                            <h3 className="font-display text-lg text-forest-900">
                              {room.room_name}
                              {room.type_name ? (
                                <span className="ml-2 text-sm font-normal text-charcoal-400">
                                  {room.type_name}
                                </span>
                              ) : null}
                            </h3>
                            <p className="shrink-0 text-right">
                              <span className="font-display text-xl text-forest-900 tabular-nums">
                                ฿{Number(room.price_per_night).toLocaleString()}
                              </span>
                              <span className="block text-xs text-charcoal-400">ต่อคืน</span>
                            </p>
                          </div>

                          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-charcoal-500">
                            {room.description}
                          </p>

                          <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                            <div className="flex items-center gap-4 text-sm text-charcoal-400">
                              <span className="flex items-center gap-1.5">
                                <Users size={15} /> {room.capacity} คน
                              </span>
                              <span
                                className={
                                  isAvailable ? 'text-lagoon-700' : 'text-charcoal-400'
                                }
                              >
                                {isAvailable ? `ว่าง ${availableCount} ห้อง` : 'เต็มในช่วงนี้'}
                              </span>
                            </div>

                            {isAvailable && searchedRange ? (
                              <div className="flex items-center gap-4">
                                {searchNights > 0 && (
                                  <span className="text-sm text-charcoal-400">
                                    รวม ฿{totalPrice.toLocaleString()}
                                  </span>
                                )}
                                <Link
                                  href={`/rooms/${room.id}?check_in=${searchedRange.start}&check_out=${searchedRange.end}`}
                                  className="group inline-flex items-center gap-1.5 text-sm font-semibold text-forest-800 hover:text-forest-600"
                                >
                                  ดูรายละเอียด
                                  <ArrowRight
                                    size={15}
                                    className="transition-transform group-hover:translate-x-0.5"
                                  />
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
