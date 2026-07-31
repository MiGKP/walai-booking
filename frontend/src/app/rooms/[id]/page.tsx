'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Star,
  Users,
  X,
} from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
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
  monthRangeISO,
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

interface AppliedPromo {
  id: number;
  name: string;
  discount_amount: number;
  final_price: number;
}

export default function RoomDetailPage(): React.ReactElement {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
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

  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [specialRequests, setSpecialRequests] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [promoCode, setPromoCode] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);

  const nights = range ? nightsBetween(range.start, range.end) : 0;
  const guestTotal = adults + children;

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
    const { start, end } = monthRangeISO(cursor);
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

  // เลือกช่วงแล้วอาจคาบคืนที่เต็ม จึงเตือนก่อนกดจองเพื่อไม่ให้ backend ตอบ 409 เปล่า ๆ
  const blockedNights = useMemo<string[]>(() => {
    if (!range || nights <= 0) return [];
    return nightsInRange(range.start, range.end).filter(
      (night) => dayStatus[night]?.tone === 'full'
    );
  }, [range, nights, dayStatus]);

  const basePrice = room ? Number(room.price_per_night) * nights : 0;
  const finalPrice = appliedPromo ? appliedPromo.final_price : basePrice;

  // เปลี่ยนช่วงวันแล้วยอดเดิมใช้ไม่ได้ ต้องกดใช้โค้ดใหม่
  useEffect(() => {
    setAppliedPromo(null);
  }, [range]);

  const handleBooking = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      toast.error('กรุณาเข้าสู่ระบบก่อน');
      router.push('/auth/login');
      return;
    }
    if (!range || nights <= 0) {
      toast.error('กรุณาเลือกวันเช็คอินและเช็คเอาต์');
      return;
    }
    if (!room) {
      toast.error('ไม่พบข้อมูลห้องพัก');
      return;
    }
    if (blockedNights.length > 0) {
      toast.error('ช่วงที่เลือกมีคืนที่เต็มแล้ว กรุณาเลือกช่วงอื่น');
      return;
    }
    if (adults < 1) {
      toast.error('ต้องมีผู้ใหญ่อย่างน้อย 1 คน');
      return;
    }
    if (guestTotal > room.capacity) {
      toast.error(`ผู้เข้าพักรวมต้องไม่เกิน ${room.capacity} คน`);
      return;
    }

    setBookingLoading(true);
    try {
      // backend เก็บแค่ guest_count รวม — แยกผู้ใหญ่/เด็กไว้ในคำขอพิเศษให้แอดมินเห็น
      const guestNote = `ผู้ใหญ่ ${adults} คน, เด็ก ${children} คน`;
      const mergedRequest = specialRequests.trim()
        ? `${guestNote}\n${specialRequests.trim()}`
        : guestNote;

      const res = await api.post('/bookings/room', {
        room_type_id: id,
        check_in_date: range.start,
        check_out_date: range.end,
        guests: guestTotal,
        special_requests: mergedRequest,
        ...(appliedPromo ? { promotion_id: appliedPromo.id } : {}),
      });
      toast.success('จองห้องพักสำเร็จ!');
      router.push(`/payment?booking_type=room&booking_id=${res.data.data.room_booking_id}`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'จองห้องพักไม่สำเร็จ (ห้องอาจเต็ม)'));
    } finally {
      setBookingLoading(false);
    }
  };

  const handleApplyPromo = async (): Promise<void> => {
    if (!promoCode.trim()) return;
    if (!basePrice || nights <= 0) {
      toast.error('กรุณาเลือกวันที่ก่อน');
      return;
    }
    setPromoLoading(true);
    try {
      const res = await api.post('/promotions/validate', {
        code: promoCode,
        price: basePrice,
        nights,
      });
      const data = res.data.data;
      setAppliedPromo({
        id: data.id,
        name: data.name,
        discount_amount: data.discount_amount,
        final_price: data.final_price,
      });
      toast.success(`ใช้โค้ด "${data.code}" สำเร็จ — ลด ฿${data.discount_amount.toLocaleString()}`);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'โค้ดไม่ถูกต้อง'));
    } finally {
      setPromoLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-cream-200 pt-16">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-forest-800 border-t-transparent" />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="grid min-h-screen place-items-center bg-cream-200 pt-16 text-center">
        <div>
          <p className="font-display text-xl text-forest-900">ไม่พบห้องพัก</p>
          <Link href="/rooms" className="btn-primary mt-5 inline-block">
            กลับไปหน้าห้องพัก
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
    <div className="min-h-screen bg-cream-200 pt-16">
      <div className="container mx-auto px-4 py-8 lg:py-12">
        <Link
          href="/rooms"
          className="mb-8 inline-flex items-center gap-2 text-sm text-charcoal-400 transition-colors hover:text-forest-800"
        >
          <ArrowLeft size={16} /> ห้องพักทั้งหมด
        </Link>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:gap-12">
          <div className="space-y-8">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-lagoon-600">
                {room.type_name || 'ห้องพัก'}
              </p>
              <h1 className="mt-2 font-display text-3xl leading-tight text-forest-900 lg:text-4xl">
                {room.room_name}
              </h1>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-charcoal-500">
                <span className="flex items-center gap-1.5">
                  <Users size={15} /> รองรับ {room.capacity} คน
                </span>
                {avgRating !== null && (
                  <span className="flex items-center gap-1.5">
                    <Star size={14} className="fill-bamboo-400 text-bamboo-400" />
                    {avgRating} · {reviews.length} รีวิว
                  </span>
                )}
              </div>
            </div>

            {galleryImages.length > 0 ? (
              <div className="grid gap-2 sm:grid-cols-4 sm:grid-rows-2">
                <button
                  type="button"
                  onClick={() => setLightboxIndex(0)}
                  className="relative h-64 overflow-hidden rounded-2xl bg-stone-200 sm:col-span-3 sm:row-span-2 sm:h-full"
                >
                  <img
                    src={resolveMediaUrl(galleryImages[0])}
                    alt={room.room_name}
                    className="h-full w-full object-cover"
                  />
                </button>
                {galleryImages.slice(1, 3).map((img, index) => (
                  <button
                    key={img}
                    type="button"
                    onClick={() => setLightboxIndex(index + 1)}
                    className="relative hidden h-full min-h-[7rem] overflow-hidden rounded-2xl bg-stone-200 sm:block"
                  >
                    <img
                      src={resolveMediaUrl(img)}
                      alt={`${room.room_name} รูปที่ ${index + 2}`}
                      className="h-full w-full object-cover"
                    />
                    {index === 1 && galleryImages.length > 3 && (
                      <span className="absolute inset-0 grid place-items-center bg-forest-900/55 text-sm font-medium text-cream-100">
                        +{galleryImages.length - 3} รูป
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="grid h-56 place-items-center rounded-2xl bg-lagoon-50 font-display text-lagoon-600">
                ยังไม่มีรูปห้องนี้
              </div>
            )}

            <div className="border-t border-stone-200 pt-8">
              <h2 className="font-display text-lg text-forest-900">เกี่ยวกับห้องนี้</h2>
              <p className="mt-3 leading-relaxed text-charcoal-500">{room.description}</p>
            </div>

            {room.amenities && room.amenities.length > 0 && (
              <div className="border-t border-stone-200 pt-8">
                <h2 className="font-display text-lg text-forest-900">สิ่งอำนวยความสะดวก</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {room.amenities.map((amenity, index) => {
                    const amenityName = typeof amenity === 'string' ? amenity : amenity?.name;
                    if (!amenityName) return null;
                    return (
                      <li
                        key={typeof amenity === 'string' ? `${amenity}-${index}` : amenity.id}
                        className="flex items-center gap-2.5 text-sm text-charcoal-600"
                      >
                        <Check size={15} className="shrink-0 text-lagoon-600" />
                        {amenityName}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="border-t border-stone-200 pt-8">
              <h2 className="font-display text-lg text-forest-900">รีวิวจากผู้เข้าพัก</h2>
              {reviews.length === 0 ? (
                <p className="mt-4 text-sm text-charcoal-400">
                  ยังไม่มีรีวิว — เป็นคนแรกที่รีวิวห้องนี้
                </p>
              ) : (
                <ul className="mt-5 space-y-5">
                  {reviews.map((review) => (
                    <li key={review.review_id} className="border-b border-stone-200 pb-5 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <span className="grid h-7 w-7 place-items-center rounded-full bg-forest-50 text-xs font-semibold text-forest-800">
                          {review.first_name?.[0] || 'U'}
                        </span>
                        <span className="text-sm font-medium text-charcoal-700">
                          {review.first_name} {review.last_name}
                        </span>
                        <span className="ml-auto text-xs text-charcoal-400">
                          {new Date(review.review_date).toLocaleDateString('th-TH', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="ml-[38px] mt-1.5 flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={12}
                            className={
                              star <= review.rating
                                ? 'fill-bamboo-400 text-bamboo-400'
                                : 'text-stone-300'
                            }
                          />
                        ))}
                      </div>
                      {review.comment && (
                        <p className="ml-[38px] mt-2 text-sm leading-relaxed text-charcoal-500">
                          {review.comment}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <form onSubmit={handleBooking} className="card p-5 sm:p-6">
              <p className="flex items-baseline gap-1.5">
                <span className="font-display text-2xl text-forest-900 tabular-nums">
                  ฿{Number(room.price_per_night).toLocaleString()}
                </span>
                <span className="text-sm text-charcoal-400">/ คืน</span>
              </p>

              <div className="mt-5 border-t border-stone-200 pt-5">
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

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-stone-200 pt-5 text-sm">
                <div>
                  <p className="text-xs text-charcoal-400">เช็คอิน</p>
                  <p className="mt-0.5 font-medium text-forest-900">
                    {range ? formatThaiDate(range.start) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-charcoal-400">เช็คเอาต์</p>
                  <p className="mt-0.5 font-medium text-forest-900">
                    {range && nights > 0 ? formatThaiDate(range.end) : '—'}
                  </p>
                </div>
              </div>

              {blockedNights.length > 0 && (
                <p className="mt-4 rounded-xl bg-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-red-700">
                  ช่วงที่เลือกมีคืนที่เต็มแล้ว ({blockedNights.map(formatThaiDate).join(', ')})
                  กรุณาเลือกช่วงอื่น
                </p>
              )}

              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-1.5 text-sm font-medium text-charcoal-600">
                    ผู้เข้าพัก (สูงสุด {room.capacity} คน)
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="adults"
                        className="mb-1.5 block text-xs text-charcoal-400"
                      >
                        ผู้ใหญ่
                      </label>
                      <input
                        id="adults"
                        type="number"
                        required
                        min={1}
                        max={room.capacity}
                        className="input-field"
                        value={adults}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (!Number.isFinite(value)) return;
                          const nextAdults = Math.min(
                            Math.max(Math.floor(value), 1),
                            room.capacity
                          );
                          setAdults(nextAdults);
                          // ตัดเด็กเมื่อรวมเกินความจุ — ไม่ให้ผู้ใหญ่ลดเองแล้วยังเกิน
                          setChildren((prev) =>
                            Math.min(prev, room.capacity - nextAdults)
                          );
                        }}
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="children"
                        className="mb-1.5 block text-xs text-charcoal-400"
                      >
                        เด็ก
                      </label>
                      <input
                        id="children"
                        type="number"
                        required
                        min={0}
                        max={Math.max(room.capacity - adults, 0)}
                        className="input-field"
                        value={children}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (!Number.isFinite(value)) return;
                          setChildren(
                            Math.min(
                              Math.max(Math.floor(value), 0),
                              room.capacity - adults
                            )
                          );
                        }}
                      />
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-charcoal-400">
                    รวม {guestTotal} / {room.capacity} คน
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="special-requests"
                    className="mb-1.5 block text-sm font-medium text-charcoal-600"
                  >
                    คำขอพิเศษ (ถ้ามี)
                  </label>
                  <textarea
                    id="special-requests"
                    rows={2}
                    className="input-field resize-none"
                    placeholder="เช่น ต้องการเตียงเสริม"
                    value={specialRequests}
                    onChange={(event) => setSpecialRequests(event.target.value)}
                  />
                </div>

                {nights > 0 && (
                  <div>
                    <label
                      htmlFor="promo-code"
                      className="mb-1.5 block text-sm font-medium text-charcoal-600"
                    >
                      โค้ดส่วนลด
                    </label>
                    {appliedPromo ? (
                      <div className="flex items-center gap-2.5 rounded-xl bg-forest-50 px-3.5 py-2.5">
                        <CheckCircle size={15} className="shrink-0 text-forest-700" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-forest-800">
                            {appliedPromo.name}
                          </p>
                          <p className="text-xs text-forest-600">
                            ลด ฿{appliedPromo.discount_amount.toLocaleString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-label="ยกเลิกโค้ดส่วนลด"
                          onClick={() => {
                            setAppliedPromo(null);
                            setPromoCode('');
                          }}
                          className="text-forest-400 transition-colors hover:text-red-600"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <input
                          id="promo-code"
                          className="input-field flex-1 font-mono text-sm uppercase"
                          placeholder="ใส่โค้ด"
                          value={promoCode}
                          onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter') return;
                            event.preventDefault();
                            void handleApplyPromo();
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => void handleApplyPromo()}
                          disabled={promoLoading || !promoCode.trim()}
                          className="shrink-0 rounded-xl border border-bamboo-300 px-4 text-sm font-semibold text-bamboo-700 transition-colors hover:bg-bamboo-50 disabled:opacity-40"
                        >
                          {promoLoading ? '...' : 'ใช้'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {nights > 0 && (
                <dl className="mt-5 space-y-1.5 border-t border-stone-200 pt-5 text-sm">
                  <div className="flex justify-between text-charcoal-500">
                    <dt>
                      ฿{Number(room.price_per_night).toLocaleString()} × {nights} คืน
                    </dt>
                    <dd className="tabular-nums">฿{basePrice.toLocaleString()}</dd>
                  </div>
                  {appliedPromo && (
                    <div className="flex justify-between text-forest-700">
                      <dt>ส่วนลด</dt>
                      <dd className="tabular-nums">
                        -฿{appliedPromo.discount_amount.toLocaleString()}
                      </dd>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-stone-200 pt-2.5 font-semibold text-forest-900">
                    <dt>ราคารวม</dt>
                    <dd className="font-display text-lg tabular-nums">
                      ฿{finalPrice.toLocaleString()}
                    </dd>
                  </div>
                </dl>
              )}

              <button
                type="submit"
                disabled={bookingLoading || nights <= 0 || blockedNights.length > 0}
                className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bookingLoading ? 'กำลังจอง...' : 'จองห้องพัก'}
              </button>
              <p className="mt-3 text-center text-xs text-charcoal-400">
                ยังไม่ตัดเงิน — ชำระเงินในขั้นตอนถัดไป
              </p>
            </form>
          </aside>
        </div>
      </div>

      {lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="แกลเลอรีรูปห้องพัก"
          className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal-900/92"
          onClick={() => setLightboxIndex(null)}
        >
          <button
            type="button"
            aria-label="ปิด"
            className="absolute right-4 top-4 z-10 rounded-full p-2 text-cream-100 transition-colors hover:bg-cream-100/15"
            onClick={() => setLightboxIndex(null)}
          >
            <X size={26} />
          </button>
          {lightboxTotal > 1 && (
            <>
              <button
                type="button"
                aria-label="รูปก่อนหน้า"
                className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-cream-100 transition-colors hover:bg-cream-100/15"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightboxIndex((lightboxCurrent - 1 + lightboxTotal) % lightboxTotal);
                }}
              >
                <ChevronLeft size={30} />
              </button>
              <button
                type="button"
                aria-label="รูปถัดไป"
                className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-2 text-cream-100 transition-colors hover:bg-cream-100/15"
                onClick={(event) => {
                  event.stopPropagation();
                  setLightboxIndex((lightboxCurrent + 1) % lightboxTotal);
                }}
              >
                <ChevronRight size={30} />
              </button>
            </>
          )}
          <img
            src={resolveMediaUrl(galleryImages[lightboxCurrent])}
            alt={`${room.room_name} รูปที่ ${lightboxCurrent + 1}`}
            className="max-h-[85vh] max-w-[88vw] rounded-xl object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
