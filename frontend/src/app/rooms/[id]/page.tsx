'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Info,
  Sparkles,
  Star,
  Users,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/avatar';
import toast from 'react-hot-toast';
import Link from 'next/link';
import BookingCalendar, { DateRange, DayStatus } from '@/components/booking/BookingCalendar';
import { fetchRoomCalendar, toRoomDayStatus } from '@/lib/booking-calendar';
import {
  MonthCursor,
  addDaysISO,
  formatThaiDate,
  monthCursorFromISO,
  multiMonthRangeISO,
  nightsBetween,
  nightsInRange,
  todayISO,
} from '@/lib/date';

type RoomAmenity = string | { id: number; name: string };

interface RoomDetail {
  id: number;
  room_name: string;
  type_name: string | null;
  description: string;
  capacity: number;
  price_per_night: number;
  main_image: string | null;
  images: string[] | null;
  amenities: RoomAmenity[] | null;
}

interface Review {
  review_id: number;
  first_name: string | null;
  last_name: string | null;
  rating: number;
  comment: string | null;
  review_date: string;
}

export default function RoomDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const today = todayISO();

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const initialRange: DateRange = {
    start: searchParams.get('check_in') || today,
    end: searchParams.get('check_out') || addDaysISO(today, 1),
  };

  const [range, setRange] = useState<DateRange | null>(initialRange);
  const [cursor, setCursor] = useState<MonthCursor>(() => monthCursorFromISO(initialRange.start));
  const [dayStatus, setDayStatus] = useState<Record<string, DayStatus>>({});
  const [calendarLoading, setCalendarLoading] = useState(true);

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  const nights = range ? nightsBetween(range.start, range.end) : 0;

  useEffect(() => {
    api
      .get(`/rooms/${id}`)
      .then((res) => setRoom(res.data?.data ?? null))
      .catch(() => toast.error('ไม่พบห้องพัก'))
      .finally(() => setLoading(false));

    api
      .get(`/reviews/room-type/${id}`)
      .then((res) => {
        setReviews(Array.isArray(res.data?.data) ? res.data.data : []);
        setAvgRating(res.data?.avg_rating ?? null);
      })
      .catch(() => undefined);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const { start, end } = multiMonthRangeISO(cursor, 2);
    setCalendarLoading(true);

    fetchRoomCalendar({ start, end, roomTypeId: Number(id) })
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
  }, [cursor, id]);

  const blockedNights = useMemo<string[]>(() => {
    if (!range || nights <= 0) return [];
    return nightsInRange(range.start, range.end).filter(
      (night) => dayStatus[night]?.tone === 'full'
    );
  }, [range, nights, dayStatus]);

  const basePrice = room ? Number(room.price_per_night) * nights : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100/50 pt-20">
        <div className="container mx-auto px-4 py-8">
          <div className="h-6 w-32 animate-pulse rounded-lg bg-stone-200" />
          <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_minmax(420px,560px)]">
            <div className="space-y-6">
              <div className="h-10 w-2/3 animate-pulse rounded-xl bg-stone-200" />
              <div className="h-96 animate-pulse rounded-3xl bg-stone-200" />
            </div>
            <div className="h-[500px] animate-pulse rounded-3xl bg-stone-200" />
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="grid min-h-screen place-items-center bg-cream-100/50 pt-16 text-center">
        <div className="max-w-md rounded-3xl bg-white p-8 shadow-xl shadow-stone-200/50 border border-stone-100">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500 mb-4">
            <Info size={24} />
          </div>
          <h2 className="font-display text-2xl font-semibold text-forest-900">ไม่พบห้องพัก</h2>
          <p className="mt-2 text-sm text-charcoal-400">ห้องพักที่คุณกำลังมองหาอาจถูกลบหรือไม่มีอยู่ในระบบ</p>
          <Link href="/rooms" className="btn-primary mt-6 inline-flex items-center gap-2">
            <ArrowLeft size={16} /> กลับไปหน้าห้องพักทั้งหมด
          </Link>
        </div>
      </div>
    );
  }

  const galleryImages: string[] = [
    room.main_image,
    ...(Array.isArray(room.images) ? room.images.filter((img) => img !== room.main_image) : []),
  ].filter((img): img is string => Boolean(img));
  const lightboxTotal = galleryImages.length;
  const lightboxCurrent = lightboxIndex ?? 0;

  return (
    <div className="min-h-screen bg-cream-100/40 pb-16 pt-20">
      <div className="container mx-auto px-4 max-w-7xl">
        {/* Navigation Back */}
        <Link
          href="/rooms"
          className="group mb-6 inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 text-sm font-medium text-charcoal-600 shadow-sm backdrop-blur-md transition-all hover:bg-white hover:text-forest-900 hover:shadow"
        >
          <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
          กลับไปหน้าห้องพักทั้งหมด
        </Link>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(420px,560px)] lg:gap-10">
          {/* Main Info Side */}
          <div className="space-y-8">
            {/* Title Header */}
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-lagoon-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-lagoon-700">
                <Sparkles size={12} />
                {room.type_name || 'ห้องพักแนะนำ'}
              </span>
              <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-forest-900 sm:text-4xl lg:text-4xl">
                {room.room_name}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-charcoal-600">
                <span className="flex items-center gap-1.5 rounded-md bg-stone-100/80 px-2.5 py-1 text-xs font-medium">
                  <Users size={14} className="text-forest-700" /> รองรับสูงสุด {room.capacity} ท่าน
                </span>
                {avgRating !== null && (
                  <span className="flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
                    <Star size={14} className="fill-amber-400 text-amber-400" />
                    {avgRating.toFixed(1)} <span className="text-amber-600 font-normal">({reviews.length} รีวิว)</span>
                  </span>
                )}
              </div>
            </div>

            {/* Photo Gallery Grid */}
            {galleryImages.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-4 sm:grid-rows-2 h-[380px] sm:h-[440px] rounded-3xl overflow-hidden shadow-md">
                <button
                  type="button"
                  onClick={() => setLightboxIndex(0)}
                  className="group relative h-full w-full overflow-hidden bg-stone-200 sm:col-span-3 sm:row-span-2 cursor-pointer"
                >
                  <img
                    src={resolveMediaUrl(galleryImages[0])}
                    alt={room.room_name}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
                {galleryImages.slice(1, 3).map((img, index) => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => setLightboxIndex(index + 1)}
                    className="group relative hidden h-full w-full overflow-hidden bg-stone-200 sm:block cursor-pointer"
                  >
                    <img
                      src={resolveMediaUrl(img)}
                      alt={`${room.room_name} รูปที่ ${index + 2}`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {index === 1 && galleryImages.length > 3 && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-forest-900/60 backdrop-blur-[2px] text-white transition-all group-hover:bg-forest-900/70">
                        <span className="font-display text-xl font-bold">+{galleryImages.length - 3}</span>
                        <span className="text-xs font-medium">ดูรูปทั้งหมด</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex h-64 w-full flex-col items-center justify-center rounded-3xl bg-stone-100 border-2 border-dashed border-stone-200 text-stone-400">
                <p className="font-display text-base">ยังไม่มีรูปภาพสำหรับห้องพักนี้</p>
              </div>
            )}

            {/* About Section */}
            <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-stone-100">
              <h2 className="font-display text-xl font-bold text-forest-900">เกี่ยวกับห้องพักนี้</h2>
              <p className="mt-3 leading-relaxed text-charcoal-600 whitespace-pre-line">{room.description}</p>
            </div>

            {/* Amenities Section */}
            {room.amenities && room.amenities.length > 0 && (
              <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-stone-100">
                <h2 className="font-display text-xl font-bold text-forest-900">สิ่งอำนวยความสะดวก</h2>
                <ul className="mt-5 grid gap-4 sm:grid-cols-2">
                  {room.amenities.map((amenity, index) => {
                    const amenityName = typeof amenity === 'string' ? amenity : amenity?.name;
                    if (!amenityName) return null;
                    return (
                      <li
                        key={typeof amenity === 'string' ? `${amenity}-${index}` : amenity.id}
                        className="flex items-center gap-3 rounded-xl bg-cream-50 p-3 text-sm text-charcoal-700 font-medium"
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-lagoon-100 text-lagoon-700">
                          <Check size={16} />
                        </div>
                        {amenityName}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Reviews Section */}
            <div className="rounded-3xl bg-white p-6 sm:p-8 shadow-sm border border-stone-100">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl font-bold text-forest-900">รีวิวจากผู้เข้าพัก</h2>
                {avgRating !== null && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-900">
                    <Star size={15} className="fill-amber-400 text-amber-400" />
                    {avgRating.toFixed(1)} / 5.0
                  </span>
                )}
              </div>

              {reviews.length === 0 ? (
                <div className="mt-6 rounded-2xl bg-stone-50 p-6 text-center text-sm text-charcoal-400">
                  ยังไม่มีรีวิวสำหรับห้องนี้ — มาร่วมเป็นคนแรกที่เข้าพักและแบ่งปันประสบการณ์!
                </div>
              ) : (
                <ul className="mt-6 space-y-4 divide-y divide-stone-100">
                  {reviews.map((review) => (
                    <li key={review.review_id} className="pt-4 first:pt-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-forest-800 font-semibold text-white shadow-sm text-sm">
                            {review.first_name?.[0] || 'U'}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-charcoal-800">
                              {review.first_name} {review.last_name}
                            </p>
                            <p className="text-[11px] text-charcoal-400">
                              {new Date(review.review_date).toLocaleDateString('th-TH', {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-0.5 rounded-full bg-stone-50 px-2 py-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={13}
                              className={
                                star <= review.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-stone-200'
                              }
                            />
                          ))}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="ml-12 mt-2 text-sm leading-relaxed text-charcoal-600 bg-stone-50/60 p-3 rounded-2xl">
                          {review.comment}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Detail sidebar — book only from /rooms list */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-3xl bg-white p-6 shadow-xl shadow-stone-200/50 border border-stone-100/80 backdrop-blur-md">
              <div className="flex items-baseline justify-between border-b border-stone-100 pb-4">
                <div>
                  <span className="text-xs text-charcoal-400 font-medium">ราคาเริ่มต้น</span>
                  <p className="flex items-baseline gap-1">
                    <span className="font-display text-3xl font-bold text-forest-900 tabular-nums">
                      ฿{Number(room.price_per_night).toLocaleString()}
                    </span>
                    <span className="text-xs text-charcoal-400">/ คืน</span>
                  </p>
                </div>
                <span className="flex items-center gap-1 text-xs text-charcoal-400">
                  <Users size={14} /> สูงสุด {room.capacity} คน
                </span>
              </div>

              <div className="mt-5">
                <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-charcoal-500">
                  <CalendarIcon size={14} className="text-forest-800" /> ดูวันว่างของห้องนี้
                </label>
                <div className="rounded-2xl border border-stone-200 bg-stone-50/50 p-2">
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
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-cream-50/80 p-3 text-xs border border-cream-200/60">
                <div>
                  <span className="text-charcoal-400 block font-medium">เช็คอิน</span>
                  <span className="font-semibold text-forest-900 mt-0.5 block text-xs">
                    {range ? formatThaiDate(range.start) : '—'}
                  </span>
                </div>
                <div className="border-l border-cream-200/80 pl-3">
                  <span className="text-charcoal-400 block font-medium">เช็คเอาต์</span>
                  <span className="font-semibold text-forest-900 mt-0.5 block text-xs">
                    {range && nights > 0 ? formatThaiDate(range.end) : '—'}
                  </span>
                </div>
              </div>

              {blockedNights.length > 0 && (
                <div className="mt-4 flex gap-2 rounded-2xl bg-red-50 p-3.5 text-xs text-red-700 border border-red-100">
                  <Info size={16} className="shrink-0 text-red-500" />
                  <p className="leading-relaxed">
                    มีคืนที่ห้องเต็มแล้ว ({blockedNights.map(formatThaiDate).join(', ')})
                  </p>
                </div>
              )}

              {nights > 0 && blockedNights.length === 0 && (
                <p className="mt-4 text-sm text-charcoal-500">
                  ประมาณ ฿{basePrice.toLocaleString()} สำหรับ {nights} คืน
                </p>
              )}

              <Link
                href={
                  range && nights > 0
                    ? `/rooms?check_in=${range.start}&check_out=${range.end}`
                    : '/rooms'
                }
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-forest-900 py-3.5 font-semibold text-white shadow-lg shadow-forest-900/20 transition-all hover:bg-forest-800"
              >
                ไปจองที่หน้ารายการห้อง
              </Link>
              <p className="mt-3 text-center text-[11px] text-charcoal-400">
                เลือกประเภทและจำนวนห้องได้ที่หน้ารายการ — หน้านี้สำหรับดูรายละเอียดเท่านั้น
              </p>
            </div>
          </aside>
        </div>
      </div>

      {/* Lightbox Modal */}
      {lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md transition-all"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            className="absolute right-5 top-5 z-10 rounded-full bg-white/10 p-2.5 text-white backdrop-blur-md transition-all hover:bg-white/20"
            onClick={() => setLightboxIndex(null)}
          >
            <X size={22} />
          </button>
          {lightboxTotal > 1 && (
            <>
              <button
                type="button"
                className="absolute left-5 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition-all hover:bg-white/20"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightboxIndex((lightboxCurrent - 1 + lightboxTotal) % lightboxTotal);
                }}
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                className="absolute right-5 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white backdrop-blur-md transition-all hover:bg-white/20"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightboxIndex((lightboxCurrent + 1) % lightboxTotal);
                }}
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}
          <div className="relative max-h-[85vh] max-w-[90vw]">
            <img
              src={resolveMediaUrl(galleryImages[lightboxCurrent])}
              alt={`${room.room_name} รูปที่ ${lightboxCurrent + 1}`}
              className="max-h-[85vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            />
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white backdrop-blur-md">
              {lightboxCurrent + 1} / {lightboxTotal}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}