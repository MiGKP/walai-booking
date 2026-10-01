'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  BedDouble,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ImageIcon,
  Maximize2,
  Sparkles,
  Star,
  Tag,
  Users,
  X,
  CheckCircle2,
  Car,
} from 'lucide-react';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/avatar';
import { maskReviewerName } from '@/lib/format';
import toast from 'react-hot-toast';
import Link from 'next/link';
import BookingCalendar, { DateRange, DayStatus } from '@/components/booking/BookingCalendar';
import BookingSummaryCard from '@/components/booking/BookingSummaryCard';
import { fetchRoomCalendar, toRoomDayStatus } from '@/lib/booking-calendar';
import {
  MonthCursor,
  addDaysISO,
  formatThaiDate,
  monthCursorFromISO,
  multiMonthRangeISO,
  nightsBetween,
  todayISO,
} from '@/lib/date';

import { RoomCartItem } from '@/lib/room-cart';
import { useRoomCart } from '@/lib/room-cart-store';
import { useCartSync } from '@/hooks/useCartSync';

type RoomAmenity = string | { id: number; name: string };

interface PhysicalRoom {
  room_id: number;
  room_number: string;
  status: string;
  is_available: boolean;
}

interface Promotion {
  id: number;
  name: string;
  code: string;
  description?: string | null;
  discount_value: number;
  discount_type?: 'percent' | 'fixed';
  min_nights?: number;
  max_discount?: number;
}

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
  rooms: PhysicalRoom[] | null;
  available_promotions?: Promotion[] | null;
}

interface Review {
  review_id: number;
  first_name: string | null;
  last_name: string | null;
  rating: number;
  comment: string | null;
  review_date: string;
}

const CARD = 'rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(18,60,48,0.02),0_8px_24px_-8px_rgba(18,60,48,0.08)] transition-shadow duration-300 hover:shadow-[0_1px_2px_rgba(18,60,48,0.02),0_12px_28px_-8px_rgba(18,60,48,0.14)]';
const SECTION_TITLE = 'font-sans text-lg font-semibold leading-tight text-forest-900';

function SectionHeading({ icon, title, action }: { icon: React.ReactNode; title: string; action?: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-700">{icon}</span>
        <h2 className={SECTION_TITLE}>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function ratingLabel(score: number): string {
  if (score >= 4.5) return 'ยอดเยี่ยม';
  if (score >= 4) return 'ดีมาก';
  if (score >= 3.5) return 'ดี';
  if (score >= 3) return 'พอใช้';
  return 'ปานกลาง';
}

function Stars({ value, size = 12 }: { value: number; size?: number }): React.ReactElement {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star key={star} size={size} className={star <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-stone-200'} />
      ))}
    </div>
  );
}

export default function RoomDetailPage(): React.ReactElement {
  const routeParams = useParams<{ id: string }>();
  const id = routeParams.id;
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const today = todayISO();

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const checkIn = searchParams.get('check_in') || addDaysISO(today, 1);
  const checkOut = searchParams.get('check_out') || addDaysISO(checkIn, 1);
  const range = useMemo(() => ({ start: checkIn, end: checkOut }), [checkIn, checkOut]);

  const [cursor, setCursor] = useState<MonthCursor>(() => monthCursorFromISO(checkIn));
  const [dayStatus, setDayStatus] = useState<Record<string, DayStatus>>({});
  const [calendarLoading, setCalendarLoading] = useState(true);

  const galleryScrollRef = useRef<HTMLDivElement>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [expandedPromoId, setExpandedPromoId] = useState<number | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  const nights = nightsBetween(range.start, range.end);

  const cart = useRoomCart();

  // รีเซ็ตสถานะ "ดูเพิ่มเติม" ของโปรโมชั่นเวลาสลับไปดูห้องอื่น (Next.js reuse component instance ตัวเดิม)
  useEffect(() => {
    setExpandedPromoId(null);
  }, [id]);

  const selectedRoomIds = useMemo(() => {
    if (!room) return [];
    return (cart?.items ?? [])
      .filter((item) => item.room_type_id === room.id && item.room_id)
      .map((item) => item.room_id as number);
  }, [cart, room]);

  const { commit: commitCart } = useCartSync({
    checkIn: range.start,
    checkOut: range.end,
    adults: parseInt(searchParams.get('adults') || '1', 10),
    children: parseInt(searchParams.get('children') || '0', 10),
  });

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/rooms/${id}`, { params: { check_in: range.start, check_out: range.end } }).then((res) => setRoom(res.data?.data ?? null)).catch(() => toast.error('ไม่พบห้องพัก')).finally(() => setLoading(false));
    api.get(`/reviews/room-type/${id}`).then((res) => {
      setReviews(Array.isArray(res.data?.data) ? res.data.data : []);
      setAvgRating(res.data?.avg_rating ?? null);
    }).catch(() => undefined);
  }, [id, range.start, range.end]);

  // นำ Auto-scroll ไปยัง #room-picker ออก เพื่อให้ผู้ใช้ได้เห็นรูปภาพและรายละเอียดห้องก่อน

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const { start, end } = multiMonthRangeISO(cursor, 2);
    setCalendarLoading(true);
    fetchRoomCalendar({ start, end, roomTypeId: Number(id) }).then((days) => {
      if (cancelled) return;
      setDayStatus((prev) => ({ ...prev, ...toRoomDayStatus(days) }));
    }).catch(() => {
      if (!cancelled) toast.error('ไม่สามารถโหลดปฏิทินห้องว่างได้');
    }).finally(() => {
      if (!cancelled) setCalendarLoading(false);
    });
    return () => { cancelled = true; };
  }, [cursor, id]);

  const sortedPhysicalRooms = useMemo(() => {
    return [...(room?.rooms || [])].sort((a, b) =>
      a.room_number.localeCompare(b.room_number, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [room]);

  const galleryImages = useMemo<string[]>(() => {
    if (!room) return [];
    return [room.main_image, ...(Array.isArray(room.images) ? room.images.filter((img) => img !== room.main_image) : [])].filter((img): img is string => Boolean(img));
  }, [room]);

  const selectedPromoCodes = (searchParams.get('promo_code') || '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean);
  const handleSelectPromo = (code: string): void => {
    const params = new URLSearchParams(searchParams.toString());
    let nextCodes: string[];
    if (selectedPromoCodes.includes(code)) {
      nextCodes = selectedPromoCodes.filter((c) => c !== code);
    } else {
      nextCodes = [...selectedPromoCodes, code];
      
    }
    if (nextCodes.length > 0) params.set('promo_code', nextCodes.join(','));
    else params.delete('promo_code');
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const scrollToImage = (index: number): void => {
    const el = galleryScrollRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(galleryImages.length - 1, index));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: 'smooth' });
  };

  // sync ตัวเลขรูป/จุดบอกตำแหน่งตามการเลื่อน (ลาก/สไวป์) ของผู้ใช้ ไม่ใช่แค่ตอนกดปุ่ม
  useEffect(() => {
    const el = galleryScrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.clientWidth === 0) return;
      setActiveImage(Math.round(el.scrollLeft / el.clientWidth));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [galleryImages.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowLeft') scrollToImage(activeImage - 1);
      if (e.key === 'ArrowRight') scrollToImage(activeImage + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightboxOpen, activeImage, galleryImages.length]);

  const handleToggleRoom = (roomId: number) => {
    if (!room?.rooms) return;
    const physicalRooms = room.rooms;
    const physicalRoom = physicalRooms.find(r => r.room_id === roomId);
    if (!physicalRoom) return;

    const items = cart?.items ?? [];
    const isSelecting = !selectedRoomIds.includes(roomId);

    const nextItems: RoomCartItem[] = isSelecting
      ? [
          ...items,
          {
            room_type_id: room.id,
            room_id: physicalRoom.room_id,
            room_number: physicalRoom.room_number,
            room_name: room.room_name,
            type_name: room.type_name,
            capacity: room.capacity,
            price_per_night: room.price_per_night,
            available_count: physicalRooms.filter(r => r.is_available).length,
            quantity: 1,
          },
        ]
      : items.filter((item) => item.room_id !== roomId);

    commitCart(nextItems);
    // เตือนว่ายังกลับไปเลือกห้องพักประเภทอื่นเพิ่มในบิลเดียวกันได้ เพราะตะกร้าคงอยู่ข้ามหน้า
    if (isSelecting) {
      toast.success(`เพิ่มห้อง ${physicalRoom.room_number} ลงตะกร้าแล้ว — ต้องการห้องพักประเภทอื่นเพิ่ม กด "ห้องพักทั้งหมด" ด้านบนได้เลย`, { duration: 4500 });
    }
  };

  if (loading) return <div className="min-h-screen bg-cream-100 pb-20 pt-24"><div className="container mx-auto max-w-6xl px-4"><div className="mb-6 h-9 w-40 animate-pulse rounded-full bg-white" /><div className="mb-6 space-y-3"><div className="h-5 w-48 animate-pulse rounded-full bg-white" /><div className="h-9 w-2/3 animate-pulse rounded-xl bg-white" /></div><div className="grid gap-8 lg:grid-cols-[1fr_360px]"><div className="space-y-6"><div className="h-[300px] animate-pulse rounded-2xl bg-white sm:h-[420px]" /><div className="h-56 animate-pulse rounded-2xl bg-white" /><div className="h-72 animate-pulse rounded-2xl bg-white" /></div><div className="h-[540px] animate-pulse rounded-2xl bg-white" /></div></div></div>;
  if (!room) return <div className="grid min-h-screen place-items-center bg-cream-100 px-4 pt-20 text-center"><div className={`${CARD} max-w-sm px-6 py-10`}><AlertCircle className="mx-auto mb-4 h-8 w-8 text-stone-300" /><h2 className="font-sans text-xl font-semibold text-forest-900">ไม่พบห้องพักนี้</h2><p className="mt-1.5 text-sm leading-relaxed text-charcoal-400">ห้องพักอาจถูกปิดปรับปรุง หรือถูกนำออกจากระบบแล้ว ลองกลับไปเลือกจากรายการห้องพักทั้งหมด</p><Link href={`/rooms?${searchParams.toString()}`} className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-forest-900 py-3 text-sm font-bold text-white shadow-md transition-all hover:bg-forest-800 active:scale-[0.98]"><ArrowLeft size={15} />ดูห้องพักทั้งหมด</Link></div></div>;

  const availableCount = sortedPhysicalRooms.length > 0 ? sortedPhysicalRooms.filter((r) => r.is_available).length : 1;

  return (
    <div className="min-h-screen bg-cream-100 pb-28 pt-20 lg:pb-20">
      {/* ===== Gallery Section ===== */}
      <div className="mx-auto max-w-7xl px-4 pt-4">
        <div className="relative">
          <Link
            href={`/rooms?${searchParams.toString()}`}
            className="group absolute left-3 top-3 z-10 inline-flex items-center gap-2.5 rounded-full bg-white/90 py-1.5 pl-1.5 pr-4 text-sm font-bold text-forest-800 shadow-md backdrop-blur-sm transition-all duration-200 hover:-translate-x-0.5 hover:bg-white"
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-700 transition-colors group-hover:bg-forest-100">
              <ArrowLeft size={14} />
            </span>
            ห้องพักทั้งหมด
          </Link>
        </div>
        {galleryImages.length > 0 ? (
          <div className="space-y-2">
          <div className="relative overflow-hidden rounded-xl border border-stone-200/80 bg-stone-50">
            <div
              ref={galleryScrollRef}
              className="flex h-[220px] snap-x snap-mandatory overflow-x-auto scroll-smooth sm:h-[300px] md:h-[360px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {galleryImages.map((img, index) => (
                <div key={img} className="h-full w-full flex-none snap-center">
                  <img src={resolveMediaUrl(img)} alt={`${room.room_name} รูปที่ ${index + 1}`} className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-forest-800 shadow-md backdrop-blur-sm transition-colors hover:bg-white"
            >
              <Maximize2 size={13} />
              ดูภาพขยาย
            </button>
            {galleryImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => scrollToImage(activeImage - 1)}
                  disabled={activeImage === 0}
                  className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-forest-800 shadow-md backdrop-blur-sm transition-opacity hover:bg-white disabled:pointer-events-none disabled:opacity-0"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToImage(activeImage + 1)}
                  disabled={activeImage === galleryImages.length - 1}
                  className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-forest-800 shadow-md backdrop-blur-sm transition-opacity hover:bg-white disabled:pointer-events-none disabled:opacity-0"
                >
                  <ChevronRight size={18} />
                </button>
                <span className="absolute bottom-3 right-3 rounded-full bg-forest-950/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-sm">{activeImage + 1} / {galleryImages.length}</span>
              </>
            )}
          </div>
          {galleryImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {galleryImages.map((img, index) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => scrollToImage(index)}
                  className={`h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition-all sm:h-16 sm:w-24 ${index === activeImage ? 'border-forest-700' : 'border-transparent opacity-60 hover:opacity-100'}`}
                >
                  <img src={resolveMediaUrl(img)} alt={`${room.room_name} ภาพย่อ ${index + 1}`} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
          </div>
        ) : (
          <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white/40 text-center backdrop-blur-sm"><ImageIcon className="mb-3 h-7 w-7 text-stone-300" /><h3 className={SECTION_TITLE}>ยังไม่มีรูปห้องพักนี้</h3></div>
        )}
      </div>

      
      {/* Sticky Navigation Bar */}
      <div className="sticky top-0 z-40 hidden border-b border-stone-200 bg-white/90 backdrop-blur-md shadow-sm sm:block">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-16 items-center justify-between">
            <nav className="flex items-center gap-6 overflow-x-auto text-sm font-bold text-stone-600 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <a href="#overview" className="whitespace-nowrap py-4 hover:text-forest-700">ข้อมูลห้องพัก</a>
              {room.amenities && room.amenities.length > 0 && <a href="#amenities" className="whitespace-nowrap py-4 hover:text-forest-700">สิ่งอำนวยความสะดวก</a>}
              {room.available_promotions && room.available_promotions.length > 0 && <a href="#promotions" className="whitespace-nowrap py-4 hover:text-forest-700">โปรโมชั่น</a>}
              <a href="#room-picker" className="whitespace-nowrap py-4 hover:text-forest-700">เลือกห้องพัก</a>
              <a href="#reviews" className="whitespace-nowrap py-4 hover:text-forest-700">รีวิว</a>
              <a href="#policies" className="whitespace-nowrap py-4 hover:text-forest-700">นโยบาย</a>
            </nav>
            <div className="flex shrink-0 items-center gap-4 pl-4">
               <span className="hidden lg:inline-flex items-baseline gap-1">
                 <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">เริ่มต้น</span>
                 <span className="font-sans text-xl font-extrabold text-forest-900">฿{Number(room.price_per_night).toLocaleString()}</span>
               </span>
               <a href="#room-picker" className="rounded-full bg-forest-800 px-5 py-2 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-forest-900 active:scale-95">
                 ดูห้องว่าง
               </a>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Main Content Area ===== */}
      <div className="mx-auto mt-8 max-w-7xl px-4">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* ---- ฝั่งซ้าย: รายละเอียดห้อง ---- */}
          <div className="space-y-6 lg:col-span-8">
            {/* Header Details */}
            <section id="overview" className={`${CARD} p-5 sm:p-7 scroll-mt-24`}>
              <div className="flex flex-col-reverse gap-6 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 flex-1 flex-col">
                  {/* Title & Ratings */}
                  <h1 className="font-sans text-3xl font-bold tracking-tight text-forest-950 sm:text-[34px] lg:text-[40px] leading-[1.1]">{room.room_name}</h1>
                  
                  <div className="mt-4 flex flex-wrap items-center gap-y-2 gap-x-4 text-[15px] text-stone-600">
                    {avgRating !== null && (
                      <div className="flex items-center gap-2 border-r border-stone-200 pr-4">
                        <div className="flex items-center gap-1">
                          <Star size={18} className="fill-amber-400 text-amber-500" />
                          <span className="font-bold text-stone-900">{avgRating.toFixed(1)}</span>
                        </div>
                        <span className="text-stone-500 underline decoration-stone-300 underline-offset-4 hover:text-stone-700 cursor-pointer">{reviews.length} รีวิว</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 font-medium text-stone-700">
                      <Users size={18} className="text-stone-400" />
                      <span>พักได้สูงสุด {room.capacity} ท่าน</span>
                    </div>
                  </div>

                  {/* Description */}
                  {room.description && (
                    <p className="mt-5 text-sm leading-[1.8] text-stone-500 max-w-2xl">
                      {room.description}
                    </p>
                  )}
                </div>

                {/* Price & Availability (Desktop Right / Mobile Top) */}
                <div className="flex shrink-0 flex-col items-start sm:items-end sm:pl-6 sm:border-l sm:border-stone-100">
                  <span className="mb-1 text-[12px] font-bold uppercase tracking-widest text-stone-400">ราคาเริ่มต้น</span>
                  <div className="flex items-baseline gap-1">
                    <span className="font-sans text-3xl font-extrabold text-forest-900">฿{Number(room.price_per_night).toLocaleString()}</span>
                    <span className="text-sm font-medium text-stone-500">/ คืน</span>
                  </div>
                  
                  {/* Availability Badge */}
                  <div className="mt-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-bold ${
                      availableCount > 0 
                        ? 'bg-forest-50/80 text-forest-700 border border-forest-200/60' 
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {availableCount > 0 ? (
                        <>
                          <CheckCircle2 size={16} className="text-forest-600" />
                          มีห้องว่าง ({availableCount} ห้อง)
                        </>
                      ) : (
                        <>
                          <AlertCircle size={16} className="text-red-600" />
                          เต็มแล้ว
                        </>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Amenities */}
            {room.amenities && room.amenities.length > 0 && (
              <section id="amenities" className={`${CARD} p-5 sm:p-6 scroll-mt-24`}>
                <SectionHeading icon={<Sparkles size={16} />} title="สิ่งอำนวยความสะดวก" />
                <ul className="mt-4 columns-2 gap-x-8 text-sm text-charcoal-600">
                  {room.amenities.map((amenity, index) => (
                    <li key={index} className="mb-2.5 flex items-start gap-2 break-inside-avoid">
                      <Check size={14} className="mt-0.5 shrink-0 text-forest-500" />
                      <span>{typeof amenity === 'string' ? amenity : amenity.name}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Special Offers */}
            {room.available_promotions && room.available_promotions.length > 0 && (
              <section id="promotions" className={`${CARD} p-5 sm:p-6 scroll-mt-24`}>
                <SectionHeading icon={<Tag size={16} />} title="โปรโมชั่นพิเศษ" />
                <div className="mt-5 grid grid-cols-1 items-start gap-4 sm:grid-cols-2">
                  {room.available_promotions.map((promo) => {
                    const isSelected = selectedPromoCodes.includes(promo.code);
                    const isExpanded = expandedPromoId === promo.id;
                    const discountText = promo.discount_type === 'percent' ? `ลด ${promo.discount_value}%` : `ลด ฿${Number(promo.discount_value).toLocaleString()}`;
                    return (
                      <div
                        key={promo.id}
                        className={`relative flex flex-col rounded-xl border transition-all duration-300 ${
                          isSelected 
                            ? 'border-forest-600 bg-forest-50/40 shadow-sm' 
                            : 'border-stone-200 bg-white hover:border-stone-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex flex-col p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex flex-1 flex-col">
                              <div className="flex items-center gap-2">
                                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${isSelected ? 'bg-forest-600 text-white' : 'bg-stone-100 text-stone-500'}`}>
                                  <Tag size={12} />
                                </span>
                                <h4 className={`font-bold ${isSelected ? 'text-forest-900' : 'text-charcoal-700'}`}>{promo.name}</h4>
                              </div>
                              <div className="ml-8 mt-1">
                                <span className={`text-lg font-extrabold ${isSelected ? 'text-forest-700' : 'text-forest-600'}`}>
                                  {discountText}
                                </span>
                                {promo.min_nights && (
                                  <span className="ml-1 text-[11px] font-medium text-stone-500">
                                    (ขั้นต่ำ {promo.min_nights} คืน)
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            <button
                              type="button"
                              onClick={() => handleSelectPromo(promo.code)}
                              className={`shrink-0 rounded-full px-4 py-1.5 text-[11px] font-bold transition-all ${
                                isSelected 
                                  ? 'bg-forest-600 text-white shadow-sm hover:bg-forest-700' 
                                  : 'bg-white border border-stone-200 text-charcoal-600 hover:bg-stone-50 hover:border-stone-300'
                              }`}
                            >
                              {isSelected ? 'เลือกใช้แล้ว' : 'เลือกใช้'}
                            </button>
                          </div>
                          
                          <div className="ml-8 mt-3 flex items-center gap-2">
                             <div className="rounded border border-dashed border-stone-300 bg-stone-50 px-2 py-0.5 text-[11px] font-mono font-bold tracking-wide text-stone-600">
                               {promo.code}
                             </div>
                             <button
                               type="button"
                               onClick={() => setExpandedPromoId(isExpanded ? null : promo.id)}
                               className="ml-auto text-[11px] font-medium text-stone-400 hover:text-stone-600 flex items-center gap-0.5 transition-colors"
                             >
                               รายละเอียด <ChevronDown size={12} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                             </button>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? 'max-h-40 border-t border-dashed border-stone-200' : 'max-h-0'}`}>
                          <div className="p-4 pt-3 text-[12px] text-stone-600">
                            <p className="mb-2 text-stone-700">{promo.description || 'ไม่มีรายละเอียดเพิ่มเติมสำหรับโปรโมชั่นนี้'}</p>
                            <ul className="space-y-1">
                              {promo.discount_type === 'percent' && promo.max_discount && (
                                <li className="flex gap-2"><span className="text-stone-400">•</span> ลดสูงสุด ฿{Number(promo.max_discount).toLocaleString()}</li>
                              )}
                              {promo.stackable && (
                                <li className="flex gap-2"><span className="text-stone-400">•</span> สามารถใช้ร่วมกับโปรโมชั่นอื่นได้</li>
                              )}
                            </ul>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Room Selection Grid */}
            <section id="room-picker" className={`${CARD} scroll-mt-24 p-5 sm:p-6`}>
              <SectionHeading
                icon={<BedDouble size={16} />}
                title="เลือกหมายเลขห้องพักที่ต้องการ"
                action={<span className="rounded-full bg-forest-50 px-2.5 py-0.5 text-xs font-bold text-forest-700">ว่าง {availableCount} จาก {sortedPhysicalRooms.length} ห้อง</span>}
              />
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {sortedPhysicalRooms.map((physical) => {
                  const isSelected = selectedRoomIds.includes(physical.room_id);
                  return (
                    <div key={physical.room_id} className={`group relative flex flex-col justify-between gap-1 rounded-2xl border p-4 text-left transition-all duration-300 ${isSelected ? 'border-forest-900 bg-forest-50/40 shadow-sm' : physical.is_available ? 'border-stone-200 bg-white hover:border-forest-300 hover:shadow-md' : 'border-stone-100 bg-stone-50/50 opacity-60'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-base font-bold text-forest-900">ห้อง {physical.room_number}</span>
                        {isSelected && <CheckCircle2 size={16} className="text-forest-700" />}
                      </div>
                      <span className="mb-2 text-xs text-charcoal-500">{physical.is_available ? `ความจุ ${room.capacity} ท่าน` : 'ถูกจองแล้ว'}</span>
                      
                      {physical.is_available ? (
                        <button
                          type="button"
                          onClick={() => handleToggleRoom(physical.room_id)}
                          className={`mt-auto w-full rounded-xl py-2 text-xs font-bold transition-all ${isSelected ? 'bg-forest-900 text-white shadow-md hover:bg-forest-800' : 'bg-forest-50 text-forest-800 hover:bg-forest-100'}`}
                        >
                          {isSelected ? 'เลือกแล้ว' : 'เพิ่มลงตะกร้า'}
                        </button>
                      ) : (
                         <div className="mt-auto w-full rounded-xl bg-stone-100 py-2 text-center text-xs font-bold text-stone-400">
                           ไม่ว่าง
                         </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Reviews */}
            <section id="reviews" className={`${CARD} p-5 sm:p-6 scroll-mt-24`}>
              <SectionHeading icon={<Star size={16} />} title="รีวิวจากผู้เข้าพัก" />
              <div className="mt-4 flex flex-col gap-6 sm:flex-row">
                <div className="flex shrink-0 flex-col items-center justify-center gap-1.5 sm:w-32 sm:border-r sm:border-stone-100">
                  <span className="font-sans text-5xl font-extrabold leading-none text-forest-900">{avgRating !== null ? avgRating.toFixed(1) : '-'}</span>
                  <Stars value={avgRating ?? 0} size={13} />
                  <span className="text-xs text-stone-500">จาก {reviews.length} รีวิว</span>
                </div>
                <ul className="flex-1 space-y-3">
                  {reviews.map((review) => (
                    <li key={review.review_id} className="rounded-xl bg-stone-50/60 p-4">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest-900 text-sm font-bold text-cream-50">{review.first_name?.[0]?.toUpperCase() || 'U'}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-forest-900">{maskReviewerName(review.first_name, review.last_name)}</p>
                          <div className="mt-1 flex items-center gap-2"><Stars value={review.rating} size={11} /><span className="text-xs text-charcoal-400">{new Date(review.review_date).toLocaleDateString('th-TH')}</span></div>
                        </div>
                      </div>
                      {review.comment && <p className="mt-2.5 pl-12 text-sm leading-relaxed text-charcoal-500">{review.comment}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Policies & Useful Info (Dynamic from Database) */}
            <section id="policies" className={`${CARD} p-5 sm:p-6 bg-stone-50/50 border-none scroll-mt-24`}>
              <SectionHeading icon={<AlertCircle size={16} />} title="ข้อมูลที่เป็นประโยชน์และนโยบาย" />
              
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-charcoal-600">
                
                {/* Check-in / Check-out */}
                <div className="bg-white p-5 rounded-xl border border-stone-100 shadow-sm">
                  <p className="font-bold text-forest-900 mb-3 flex items-center gap-2"><Clock size={16} className="text-forest-600" />เวลาเช็คอิน / เช็คเอาต์</p>
                  <ul className="space-y-1.5">
                    <li className="flex justify-between">
                      <span className="text-stone-500">เวลาเช็คอิน:</span> 
                      <span className="font-medium text-stone-800">
                        {resortInfo?.checkin_time_from || '14:00'} - {resortInfo?.checkin_time_to || '23:00'} น.
                      </span>
                    </li>
                    <li className="flex justify-between">
                      <span className="text-stone-500">เวลาเช็คเอาต์:</span> 
                      <span className="font-medium text-stone-800">ก่อน {resortInfo?.checkout_time || '12:00'} น.</span>
                    </li>
                  </ul>
                </div>

                {/* Important Details */}
                <div className="bg-white p-5 rounded-xl border border-stone-100 shadow-sm">
                  <p className="font-bold text-forest-900 mb-3 flex items-center gap-2"><AlertCircle size={16} className="text-forest-600" />ข้อมูลสำคัญที่พัก</p>
                  <ul className="list-disc list-outside ml-4 space-y-1.5 text-stone-500">
                    {(resortInfo?.important_info || 'รวมอาหารเช้าสำหรับทุกการจอง\nไม่อนุญาตให้นำสัตว์เลี้ยงเข้าพัก\nระมัดระวังเด็กเล็ก เนื่องจากที่พักอยู่บนแพ').split('\n').map((line: string, i: number) => (
                      <li key={i}>{line.trim()}</li>
                    ))}
                  </ul>
                </div>

                {/* Kids & Extra Beds */}
                <div className="bg-white p-5 rounded-xl border border-stone-100 shadow-sm">
                  <p className="font-bold text-forest-900 mb-3 flex items-center gap-2"><Users size={16} className="text-forest-600" />นโยบายเด็กและเตียงเสริม</p>
                  <ul className="list-disc list-outside ml-4 space-y-1.5 text-stone-500">
                    {(resortInfo?.kids_policy || 'เด็ก 0-5 ปี: เข้าพักฟรี (ใช้เตียงที่มีอยู่)\nเด็ก 6-11 ปี: คิดราคาเด็ก / เตียงเสริม\n12 ปีขึ้นไป: คิดราคาผู้ใหญ่').split('\n').map((line: string, i: number) => {
                      const [title, ...rest] = line.split(':');
                      if (rest.length === 0) return <li key={i}>{line.trim()}</li>;
                      return (
                        <li key={i}><span className="font-medium text-stone-700">{title.trim()}:</span> {rest.join(':').trim()}</li>
                      );
                    })}
                  </ul>
                </div>

                {/* Getting there & Parking */}
                <div className="bg-white p-5 rounded-xl border border-stone-100 shadow-sm">
                  <p className="font-bold text-forest-900 mb-3 flex items-center gap-2"><Car size={16} className="text-forest-600" />การเดินทางและที่จอดรถ</p>
                  <p className="text-stone-500 leading-relaxed whitespace-pre-line">
                    {resortInfo?.parking_info || 'มีลานจอดรถส่วนตัวให้บริการฟรีในบริเวณสวนวลัยรุกขเวช (ไม่ต้องจองล่วงหน้า) แขกผู้เข้าพักสามารถขับรถมาจอดและเดินไปยังจุดลงแพหรือท่าเทียบเรือได้โดยตรง'}
                  </p>
                </div>

              </div>
            </section>
          </div>

          {/* ---- ฝั่งขวา: การ์ดสรุปการจอง ---- */}
          <aside className="lg:col-span-4">
            <div className="mb-8 lg:sticky lg:top-8">
              <BookingSummaryCard currentRoomType={room} />
            </div>
          </aside>
        </div>
      </div>
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-950/95 backdrop-blur-sm" onClick={() => setLightboxOpen(false)}>
          <div className="absolute inset-x-4 top-4 flex items-center justify-between">
            <span className="rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-cream-100">{activeImage + 1} / {galleryImages.length}</span>
            <button type="button" onClick={() => setLightboxOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-cream-100"><X size={18} /></button>
          </div>
          {galleryImages.length > 1 && (
            <>
              <button type="button" onClick={(e) => { e.stopPropagation(); scrollToImage(activeImage - 1); }} disabled={activeImage === 0} className="absolute left-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-cream-100 disabled:opacity-30"><ChevronLeft size={20} /></button>
              <button type="button" onClick={(e) => { e.stopPropagation(); scrollToImage(activeImage + 1); }} disabled={activeImage === galleryImages.length - 1} className="absolute right-4 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-cream-100 disabled:opacity-30"><ChevronRight size={20} /></button>
            </>
          )}
          <img src={resolveMediaUrl(galleryImages[activeImage])} alt="" className="max-h-[85vh] max-w-[92vw] rounded-2xl object-contain" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
