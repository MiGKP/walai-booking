'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Calendar,
  Baby,
  Search,
  Plus,
  Minus,
  Map,
  LayoutGrid,
} from 'lucide-react';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/avatar';
import { maskReviewerName } from '@/lib/format';
import toast from 'react-hot-toast';
import Link from 'next/link';
import BookingCalendar, { DateRange, DayStatus } from '@/components/booking/BookingCalendar';
import { roomDateSelection, roomDateSelectionLabel } from '@/lib/room-date-selection';
import BookingSummaryCard from '@/components/booking/BookingSummaryCard';
import ChildAgeSelect from '@/components/booking/ChildAgeSelect';
import RaftLayoutMap from '@/components/booking/RaftLayoutMap';
import { fetchRoomCalendar, toRoomDayStatus } from '@/lib/booking-calendar';
import {
  MonthCursor,
  formatThaiDate,
  monthCursorFromISO,
  multiMonthRangeISO,
  nightsBetween,
  todayISO,
} from '@/lib/date';

import { resolveCheckoutDetails, roomPromotionLabel, type CheckoutPromotion } from '@/lib/booking-checkout';
import { RoomCartItem, minimumRoomsForGuests, roomOccupancy } from '@/lib/room-cart';
import { useRoomCart, setRoomCart } from '@/lib/room-cart-store';
import { useCartSync } from '@/hooks/useCartSync';
import { useGuestAgePolicy } from '@/hooks/useInfantAgePolicy';

type RoomAmenity = string | { id: number; name: string };

interface PhysicalRoom {
  room_id: number;
  room_number: string;
  status: string;
  is_available: boolean;
}

interface Promotion extends CheckoutPromotion {
  stackable?: boolean;
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
  rating: number | null;
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


function Stepper({ value, min = 0, max = 99, editable = true, onChange, ariaLabel }: { value: number; min?: number; max?: number; editable?: boolean; onChange: (next: number) => void; ariaLabel: string; }): React.ReactElement {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = (raw: string): void => {
    const parsed = parseInt(raw, 10);
    const safe = isNaN(parsed) ? min : Math.min(max, Math.max(min, parsed));
    setDraft(String(safe));
    onChange(safe);
  };
  const btn = "grid h-7 w-7 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-forest-800 transition-colors hover:border-forest-300 hover:bg-forest-50 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-forest-300 disabled:border-stone-100 disabled:text-stone-300 disabled:hover:bg-white";
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`ลด${ariaLabel}`} className={btn}><Minus size={13} /></button>
      {editable ? (
        <input type="text" inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ""))} onBlur={(e) => commit(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} onFocus={(e) => e.currentTarget.select()} aria-label={ariaLabel} className="h-7 w-9 rounded-md border border-transparent bg-transparent text-center text-sm font-bold tabular-nums text-forest-900 transition-colors hover:border-stone-200 focus:border-forest-400 focus:bg-[#FFFFFF] focus:outline-hidden" />
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

interface ResortInfo {
  checkin_time_from?: string | null;
  checkin_time_to?: string | null;
  checkout_time?: string | null;
  important_info?: string | null;
  kids_policy?: string | null;
  parking_info?: string | null;
}

export default function RoomDetailPage(): React.ReactElement {
  const routeParams = useParams<{ id: string }>();
  const id = routeParams.id;
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const today = todayISO();

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const loadedRoomId = useRef<string | null>(null);
  const [allRoomTypes, setAllRoomTypes] = useState<any[]>([]);
  const [resortInfo, setResortInfo] = useState<ResortInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const { start: checkIn, end: checkOut } = roomDateSelection(new URLSearchParams(searchParams.toString())) ?? { start: '', end: '' };
  const range = useMemo(() => ({ start: checkIn, end: checkOut }), [checkIn, checkOut]);

  const [cursor, setCursor] = useState<MonthCursor>(() => monthCursorFromISO(checkIn || today));
  const [dayStatus, setDayStatus] = useState<Record<string, DayStatus>>({});
  const [calendarLoading, setCalendarLoading] = useState(true);

  const galleryScrollRef = useRef<HTMLDivElement>(null);
  const promoScrollRef = useRef<HTMLDivElement>(null);
  const reviewScrollRef = useRef<HTMLDivElement>(null);

  const scrollReviews = (direction: 'left' | 'right') => {
    if (!reviewScrollRef.current) return;
    const container = reviewScrollRef.current;
    const cardWidth = container.clientWidth >= 640 ? (container.clientWidth - 16) / 2 + 16 : container.clientWidth * 0.88 + 16;
    container.scrollBy({ left: direction === 'left' ? -cardWidth : cardWidth, behavior: 'smooth' });
  };
  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [expandedPromoId, setExpandedPromoId] = useState<number | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [selectedRatingFilter, setSelectedRatingFilter] = useState<number | null>(null);

  const filteredReviews = useMemo(() => {
    if (selectedRatingFilter === null) return reviews;
    return reviews.filter((r) => r.rating != null && Math.round(r.rating) === selectedRatingFilter);
  }, [reviews, selectedRatingFilter]);

  const [reviewScrollProgress, setReviewScrollProgress] = useState(0);
  const [reviewThumbWidth, setReviewThumbWidth] = useState(35);
  const [canScrollReviews, setCanScrollReviews] = useState(false);

  const updateReviewScrollState = useCallback(() => {
    const el = reviewScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    if (maxScroll > 2) {
      setCanScrollReviews(true);
      const ratio = clientWidth / scrollWidth;
      const thumbW = Math.max(18, Math.min(60, ratio * 100));
      setReviewThumbWidth(thumbW);
      const progress = Math.min(1, Math.max(0, scrollLeft / maxScroll));
      setReviewScrollProgress(progress);
    } else {
      setCanScrollReviews(false);
      setReviewScrollProgress(0);
      setReviewThumbWidth(100);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(updateReviewScrollState, 60);
    window.addEventListener('resize', updateReviewScrollState);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateReviewScrollState);
    };
  }, [updateReviewScrollState, filteredReviews, loading]);

  const handleSlidebarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = reviewScrollRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const maxScroll = el.scrollWidth - el.clientWidth;
    el.scrollTo({ left: ratio * maxScroll, behavior: 'smooth' });
  };

  const scrollPromos = (direction: 'left' | 'right') => {
    if (!promoScrollRef.current) return;
    const amount = 320;
    promoScrollRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  const nights = nightsBetween(range.start, range.end);
  const policy = useGuestAgePolicy();
  const infantAge = policy.infantAge;
  const [childAgeError, setChildAgeError] = useState(false);
  const cart = useRoomCart();
  const guestDetails = resolveCheckoutDetails(new URLSearchParams(searchParams.toString()), cart);
  const adultsCount = guestDetails.adults;
  const childrenCount = guestDetails.children;

  const childAges: Array<number | null> = useMemo(() => {
    const saved = resolveCheckoutDetails(new URLSearchParams(searchParams.toString()), cart);
    return Array.from({ length: saved.children }, (_, index) => {
      const age = saved.childAges[index];
      return Number.isInteger(age) && age >= 0 && age <= policy.childMaxAge ? age : null;
    });
  }, [searchParams, policy.childMaxAge, cart]);

  const handleChildAgeChange = (index: number, age: number) => {
    const nextChildAges = [...childAges];
    nextChildAges[index] = age;
    if (nextChildAges.every((a) => a !== null)) {
      setChildAgeError(false);
    }
    const serialized = nextChildAges.map((a) => (a === null ? '' : String(a))).join(',');
    const params = new URLSearchParams(searchParams.toString());
    params.set('child_ages', serialized);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };


  const guestInput = { adults: adultsCount, children: childrenCount, childAges, infantAge };
  const totalGuests = roomOccupancy({ ...guestInput, capacity: 0, roomCount: 0 }).occupyingGuests;
  const minimumRooms = room ? minimumRoomsForGuests(guestInput, Number(room.capacity)) : 1;
  const [openPanel, setOpenPanel] = useState<"guests" | "calendar" | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setOpenPanel(null); };
    if (openPanel) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openPanel]);

  const handleRangeSelect = (next: DateRange | null): void => {
    if (!next?.end) {
      const params = new URLSearchParams(searchParams.toString());
      if (next?.start) params.set('check_in', next.start);
      else params.delete('check_in');
      params.delete('check_out');
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      return;
    }
    if (next && nightsBetween(next.start, next.end) > 0) {
      if (cart && cart.items.length > 0 && (cart.check_in !== next.start || cart.check_out !== next.end)) {
        setRoomCart(null);
        toast('เปลี่ยนวันที่แล้ว กรุณาเลือกห้องพักใหม่สำหรับวันที่ต้องการ');
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set("check_in", next.start);
      params.set("check_out", next.end);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
      setOpenPanel(null);
    }
  };

  const handleGuestsChange = (next: { adults: number; children: number; }): void => {
    if (next.children === 0) {
      setChildAgeError(false);
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set("adults", String(next.adults));
    params.set("children", String(next.children));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleConfirmGuests = () => {
    const children = childrenCount;
    if (children > 0 && childAges.some((age) => age === null)) {
      setChildAgeError(true);
      toast.error("กรุณาระบุอายุของเด็กให้ครบทุกท่าน เพื่อค้นหาห้องพักที่เหมาะสม");
      return;
    }
    setChildAgeError(false);
    setOpenPanel(null);
  };
  // รีเซ็ตสถานะ "ดูเพิ่มเติม" ของโปรโมชั่นเวลาสลับไปดูห้องอื่น
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
    adults: adultsCount,
    children: childrenCount,
    childAges: childAges.filter((age): age is number => age !== null),
  });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    // Keep the calendar mounted while the guest is choosing check-out.
    if (loadedRoomId.current !== id || range.end) setLoading(true);
    api.get(`/rooms/${id}`, { params: range.start && range.end ? { check_in: range.start, check_out: range.end } : {} })
      .then(res => {
        if (!cancelled) {
          loadedRoomId.current = id;
          setRoom(res.data?.data ?? null);
        }
      })
      .catch(() => { if (!cancelled) toast.error('ไม่พบห้องพัก'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, range.start, range.end]);

  useEffect(() => {
    if (!id) return;
    api.get('/rooms').then((res) => setAllRoomTypes(Array.isArray(res.data?.data) ? res.data.data : [])).catch(() => undefined);
    api.get('/settings/resort?id=4').then((res) => setResortInfo(res.data?.data ?? null)).catch(() => undefined);
    api.get(`/reviews/room-type/${id}`).then((res) => {
      setReviews(Array.isArray(res.data?.data) ? res.data.data : []);
      setAvgRating(res.data?.avg_rating ?? null);
    }).catch(() => undefined);
  }, [id]);

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

  // ผังห้องทั้งหมดในแพรีสอร์ต (แสดงเด่นเฉพาะห้องประเภทนี้, ห้องประเภทอื่นแสดงจางๆ)
  const allResortRaftRooms = useMemo(() => {
    if (!allRoomTypes.length) {
      return sortedPhysicalRooms.map((r) => ({
        room_id: r.room_id,
        room_number: r.room_number,
        status: r.status,
        is_available: r.is_available,
        is_current_type: true,
        room_name: room?.room_name,
        room_type_id: room?.id,
      }));
    }

    const roomDict: Record<string, {
      room_id: number;
      room_number: string;
      status: string;
      is_available: boolean;
      is_current_type: boolean;
      room_name: string;
      room_type_id: number;
    }> = {};

    for (const rt of allRoomTypes) {
      const isCurrent = rt.id === Number(id);
      const roomsList = Array.isArray(rt.rooms) ? rt.rooms : [];
      for (const r of roomsList) {
        roomDict[r.room_number] = {
          room_id: r.room_id,
          room_number: r.room_number,
          status: r.status || 'available',
          is_available: isCurrent
            ? (sortedPhysicalRooms.find((sp) => sp.room_id === r.room_id)?.is_available ?? true)
            : false,
          is_current_type: isCurrent,
          room_name: rt.room_name || '',
          room_type_id: rt.id,
        };
      }
    }

    return Object.values(roomDict).sort((a, b) =>
      a.room_number.localeCompare(b.room_number, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [allRoomTypes, sortedPhysicalRooms, room, id]);

  const galleryImages = useMemo<string[]>(() => {
    if (!room) return [];
    return [room.main_image, ...(Array.isArray(room.images) ? room.images.filter((img) => img !== room.main_image) : [])].filter((img): img is string => Boolean(img));
  }, [room]);


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

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string>('overview');

  // ค่อยๆ ดัน Navbar ขึ้นเมื่อแท็บนี้เลื่อนขึ้นมาแทน และค่อยๆ เลื่อน Navbar ลงมาเมื่อแท็บนี้เลื่อนลง
  useEffect(() => {
    if (loading) return;
    let wasStuck: boolean | null = null;
    const updateNavbarPush = () => {
      const el = sentinelRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const NAVBAR_HEIGHT = 64;

      let translateY = 0;
      if (top <= 0) {
        translateY = -NAVBAR_HEIGHT;
      } else if (top < NAVBAR_HEIGHT) {
        translateY = Math.round(top - NAVBAR_HEIGHT);
      } else {
        translateY = 0;
      }

      document.documentElement.style.setProperty('--navbar-translate-y', `${translateY}px`);
      const isStuck = top <= 0;
      if (isStuck !== wasStuck) {
        wasStuck = isStuck;
        window.dispatchEvent(new CustomEvent('room-subnav-sticky', { detail: { isStuck } }));
      }
    };

    window.addEventListener('scroll', updateNavbarPush, { passive: true });
    window.addEventListener('resize', updateNavbarPush, { passive: true });
    updateNavbarPush();

    return () => {
      window.removeEventListener('scroll', updateNavbarPush);
      window.removeEventListener('resize', updateNavbarPush);
      document.documentElement.style.removeProperty('--navbar-translate-y');
      window.dispatchEvent(new CustomEvent('room-subnav-sticky', { detail: { isStuck: false } }));
    };
  }, [loading, id]);

  useEffect(() => {
    if (loading) return;

    const navSections = [
      'overview',
      'amenities',
      'room-picker',
      'promotions',
      'reviews',
      'policies',
    ];

    const onScroll = () => {
      // ลบ #hash ออกจาก URL เมื่อเลื่อนออกจาก section นั้น ๆ
      const syncHashWithSection = (activeId: string) => {
        if (typeof window === 'undefined' || !window.location.hash) return;
        const currentHash = window.location.hash.replace('#', '');
        // ถ้า hash ปัจจุบันไม่ตรงกับ section ที่กำลังดูอยู่ ให้ลบ hash ออกจาก URL ทันที
        if (currentHash !== activeId) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      };

      if (typeof window !== 'undefined' && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 60) {
        const lastSection = navSections[navSections.length - 1];
        setActiveSection(lastSection);
        syncHashWithSection(lastSection);
        return;
      }

      const threshold = 120;
      let current = '';

      for (const id of [...navSections].reverse()) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= threshold && rect.bottom > threshold) {
            current = id;
            break;
          }
        }
      }

      const activeTarget = current || (window.scrollY < 200 ? 'overview' : '');
      if (activeTarget) {
        setActiveSection(activeTarget);
        syncHashWithSection(activeTarget);
      }
    };

    const rafId = requestAnimationFrame(() => {
      if (window.location.hash) {
        const hashId = window.location.hash.replace('#', '');
        if (navSections.includes(hashId)) {
          setActiveSection(hashId);
          return;
        }
      }
      onScroll();
    });

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    window.addEventListener('hashchange', onScroll, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('hashchange', onScroll);
    };
  }, [loading, id]);

  const handleToggleRoom = (roomId: number) => {
    if (!room?.rooms) return;
    const physicalRooms = room.rooms;
    const physicalRoom = physicalRooms.find(r => r.room_id === roomId);
    if (!physicalRoom) return;

    const items = cart?.items ?? [];
    const isSelecting = !selectedRoomIds.includes(roomId);
    if (isSelecting && (!range.start || !range.end || range.end <= range.start)) {
      setOpenPanel('calendar');
      toast.error(range.start ? 'กรุณาเลือกวันเช็คเอาต์ก่อนเลือกห้องพัก' : 'กรุณาเลือกวันเช็คอินและเช็คเอาต์ก่อนเลือกห้องพัก');
      return;
    }

    if (isSelecting && items.length > 0 && cart) {
      if (cart.check_in !== range.start || cart.check_out !== range.end) {
        toast.error('ไม่สามารถเลือกห้องพักคนละวันในรายการเดียวกันได้ กรุณาเปลี่ยนวันที่ให้ตรงกับตะกร้า หรือล้างรายการทั้งหมดก่อน', { duration: 5000 });
        return;
      }
    }

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

    if (!isSelecting && cart) {
      setRoomCart({ ...cart, items: nextItems });
    } else {
      commitCart(nextItems);
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
            className="group absolute left-3 top-3 z-10 inline-flex items-center gap-2.5 rounded-full bg-white/90 py-1.5 pl-1.5 pr-4 text-sm font-bold text-forest-800 shadow-md backdrop-blur-xs transition-all duration-200 hover:-translate-x-0.5 hover:bg-white"
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
              className="flex h-[220px] snap-x snap-mandatory overflow-x-auto scroll-smooth sm:h-[300px] md:h-[360px] [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden"
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
              className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-forest-800 shadow-md backdrop-blur-xs transition-colors hover:bg-white"
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
                  className="absolute left-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-forest-800 shadow-md backdrop-blur-xs transition-opacity hover:bg-white disabled:pointer-events-none disabled:opacity-0"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => scrollToImage(activeImage + 1)}
                  disabled={activeImage === galleryImages.length - 1}
                  className="absolute right-3 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-forest-800 shadow-md backdrop-blur-xs transition-opacity hover:bg-white disabled:pointer-events-none disabled:opacity-0"
                >
                  <ChevronRight size={18} />
                </button>
                <span className="absolute bottom-3 right-3 rounded-full bg-forest-950/60 px-2.5 py-1 text-xs font-bold text-white backdrop-blur-xs">{activeImage + 1} / {galleryImages.length}</span>
              </>
            )}
          </div>
          {galleryImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden">
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
          <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white/40 text-center backdrop-blur-xs"><ImageIcon className="mb-3 h-7 w-7 text-stone-300" /><h3 className={SECTION_TITLE}>ยังไม่มีรูปห้องพักนี้</h3></div>
        )}
      </div>

      
      {/* จุดตรวจสอบการเกาะขอบบนของแท็บเมนู */}
      <div ref={sentinelRef} className="h-0 w-full pointer-events-none" aria-hidden="true" />

      {/* Sticky Navigation Bar (แทนที่ Navbar เมื่อเลื่อนหน้าจอลง) */}
      <div className="sticky top-0 z-40 border-b border-stone-200/80 bg-white/95 backdrop-blur-md shadow-xs transition-all duration-200">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex h-14 sm:h-16 items-center justify-between">
            <nav className="flex items-center gap-4 sm:gap-6 overflow-x-auto text-xs sm:text-sm font-semibold text-stone-600 [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden py-1 sm:py-0">
              <a
                href="#overview"
                onClick={() => setActiveSection('overview')}
                className={`relative whitespace-nowrap py-3 sm:py-4 transition-colors ${
                  activeSection === 'overview'
                    ? 'text-forest-950 font-bold'
                    : 'text-stone-500 hover:text-forest-700'
                }`}
              >
                ข้อมูลห้องพัก
                {activeSection === 'overview' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-forest-800 rounded-full" />
                )}
              </a>
              {room.amenities && room.amenities.length > 0 && (
                <a
                  href="#amenities"
                  onClick={() => setActiveSection('amenities')}
                  className={`relative whitespace-nowrap py-3 sm:py-4 transition-colors ${
                    activeSection === 'amenities'
                      ? 'text-forest-950 font-bold'
                      : 'text-stone-500 hover:text-forest-700'
                  }`}
                >
                  สิ่งอำนวยความสะดวก
                  {activeSection === 'amenities' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-forest-800 rounded-full" />
                  )}
                </a>
              )}
              {room.available_promotions && room.available_promotions.length > 0 && (
                <a
                  href="#promotions"
                  onClick={() => setActiveSection('promotions')}
                  className={`relative whitespace-nowrap py-3 sm:py-4 transition-colors ${
                    activeSection === 'promotions'
                      ? 'text-forest-950 font-bold'
                      : 'text-stone-500 hover:text-forest-700'
                  }`}
                >
                  โปรโมชั่น
                  {activeSection === 'promotions' && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-forest-800 rounded-full" />
                  )}
                </a>
              )}
              <a
                href="#reviews"
                onClick={() => setActiveSection('reviews')}
                className={`relative whitespace-nowrap py-3 sm:py-4 transition-colors ${
                  activeSection === 'reviews'
                    ? 'text-forest-950 font-bold'
                    : 'text-stone-500 hover:text-forest-700'
                }`}
              >
                รีวิว
                {activeSection === 'reviews' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-forest-800 rounded-full" />
                )}
              </a>
              <a
                href="#policies"
                onClick={() => setActiveSection('policies')}
                className={`relative whitespace-nowrap py-3 sm:py-4 transition-colors ${
                  activeSection === 'policies'
                    ? 'text-forest-950 font-bold'
                    : 'text-stone-500 hover:text-forest-700'
                }`}
              >
                นโยบาย
                {activeSection === 'policies' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-forest-800 rounded-full" />
                )}
              </a>
            </nav>
            <div className="flex shrink-0 items-center gap-3 pl-3 sm:pl-4">
              <span className="hidden md:inline-flex items-baseline gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">เริ่มต้น</span>
                <span className="font-sans text-xl font-extrabold text-forest-900">
                  ฿{Number(room.price_per_night).toLocaleString()}
                </span>
                <span className="text-xs text-stone-400">/ คืน</span>
              </span>
              <a
                href="#room-picker"
                onClick={() => setActiveSection('room-picker')}
                className={`rounded-full px-4 sm:px-5 py-2 text-xs sm:text-[13px] font-bold shadow-xs transition-all active:scale-95 ${
                  activeSection === 'room-picker'
                    ? 'bg-forest-900 text-white ring-2 ring-forest-500/50 shadow-sm'
                    : 'bg-forest-800 text-white hover:bg-forest-900'
                }`}
              >
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
                      <span>พักได้ {room.capacity} ท่าน</span>
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
                      nights <= 0 || availableCount > 0
                        ? 'bg-forest-50/80 text-forest-700 border border-forest-200/60' 
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {nights <= 0 ? 'เลือกวันเพื่อดูห้องว่าง' : availableCount > 0 ? (
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



            {/* Room Selection Grid */}
            <section id="room-picker" className={`${CARD} scroll-mt-24 p-5 sm:p-6`}>
              {/* Dates & Guests Search Bar (อยู่กับที่ ไม่เลื่อนตาม) */}
              <div className="mb-8 w-full shadow-xs rounded-3xl" ref={pickerRef}>
                <div className="flex w-full flex-col divide-y divide-stone-100 rounded-3xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(18,60,48,0.02),0_8px_24px_-8px_rgba(18,60,48,0.1)] transition-all duration-500 lg:flex-row lg:divide-x lg:divide-y-0 lg:rounded-full">
                  
                  <div className="relative flex-[1.4]">
                    <button type="button" onClick={() => setOpenPanel((v) => (v === "calendar" ? null : "calendar"))} className={`flex h-full w-full items-center gap-3 px-5 py-3 text-left transition-colors duration-200 lg:rounded-l-full outline-none focus:outline-none ${openPanel === "calendar" ? "bg-forest-50/50" : "hover:bg-forest-50/30"}`}>
                      <Calendar size={16} className="shrink-0 text-forest-700" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold uppercase tracking-wider text-charcoal-400">เข้าพัก – เช็คเอาต์</span>
                        <span className="block truncate text-sm font-semibold text-forest-900">{roomDateSelectionLabel(range)}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        {nights > 0 && <span className="rounded-full bg-forest-100 px-2 py-0.5 text-[11px] font-bold text-forest-800">{nights} คืน</span>}
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
                            {range && nights > 0 ? (
                              <p className="text-xs text-forest-700 mt-0.5 font-medium">
                                {formatThaiDate(range.start)} – {formatThaiDate(range.end)} ({nights} คืน)
                              </p>
                            ) : range?.start ? (
                              <p className="text-xs text-forest-700 mt-0.5 font-medium">
                                {formatThaiDate(range.start)} – เลือกวันเช็คเอาต์
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
                            value={range.start ? range : null}
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
                          {nights > 0 && (
                            <span className="text-xs font-semibold text-forest-800">
                              เข้าพัก {nights} คืน
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {(Number(room.capacity) > 2 || adultsCount > 2 || childrenCount > 0) ? (
                  <div className="relative flex-1">
                    <button type="button" onClick={() => setOpenPanel((v) => (v === "guests" ? null : "guests"))} className={`flex h-full w-full items-center gap-3 px-5 py-3 text-left transition-colors duration-200 lg:rounded-r-full ${openPanel === "guests" ? "bg-forest-50/40" : "hover:bg-forest-50/30"}`}>
                      <Users size={16} className="shrink-0 text-forest-700" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold uppercase tracking-wider text-charcoal-400">ผู้เข้าพัก</span>
                        <span className="block truncate text-sm font-semibold text-forest-900">ผู้ใหญ่ {adultsCount} • เด็ก {childrenCount}</span>
                      </span>
                      <ChevronDown size={12} className="shrink-0 text-charcoal-300 transition-transform duration-300" style={{ transform: openPanel === "guests" ? "rotate(180deg)" : "rotate(0deg)" }} />
                    </button>
                    {openPanel === "guests" && (
                      <div
                        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-forest-950/45 backdrop-blur-xs lg:static lg:bg-transparent lg:p-0 lg:block lg:backdrop-blur-none"
                        onClick={() => setOpenPanel(null)}
                      >
                        <div
                          className="w-full sm:max-w-[400px] bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-4 shadow-2xl max-h-[85vh] overflow-y-auto lg:overflow-visible lg:max-h-none lg:absolute lg:right-0 lg:top-full lg:mt-2 lg:w-[340px] lg:rounded-2xl lg:p-3 lg:border lg:border-stone-200 lg:shadow-xl"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-100 lg:hidden">
                            <h3 className="font-display text-base font-bold text-forest-900">ระบุจำนวนผู้เข้าพัก</h3>
                            <button type="button" onClick={() => setOpenPanel(null)} aria-label="ปิด" className="p-1 rounded-full text-charcoal-400 hover:text-charcoal-600">
                              <X size={20} />
                            </button>
                          </div>

                          <GuestRow label="ผู้ใหญ่" hint={policy.adultHint} value={adultsCount} min={1} onChange={(v) => handleGuestsChange({ adults: v, children: childrenCount })} />
                          <GuestRow label="เด็ก" hint={policy.childHint} value={childrenCount} min={0} onChange={(v) => handleGuestsChange({ adults: adultsCount, children: v })} />
                          {childrenCount > 0 && (
                            <div
                              className={`mx-2 my-2 rounded-xl border p-3 space-y-2 transition-all ${
                                childAgeError && childAges.some((a) => a === null)
                                  ? "border-rose-300 bg-rose-50/40"
                                  : "border-forest-100 bg-forest-50/50"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <Baby
                                    size={13}
                                    className={
                                      childAgeError && childAges.some((a) => a === null)
                                        ? "text-rose-700 shrink-0"
                                        : "text-forest-700 shrink-0"
                                    }
                                  />
                                  <p
                                    className={`text-xs font-bold uppercase tracking-wide ${
                                      childAgeError && childAges.some((a) => a === null)
                                        ? "text-rose-800"
                                        : "text-forest-800"
                                    }`}
                                  >
                                    อายุของเด็กแต่ละคน ณ วันเข้าพัก
                                  </p>
                                </div>
                                <span className="text-[11px] font-semibold text-rose-600">
                                  * จำเป็น
                                </span>
                              </div>

                              {childAgeError && childAges.some((a) => a === null) && (
                                <div className="flex items-center gap-1.5 text-xs text-rose-600 bg-white/90 border border-rose-200 rounded-lg px-2.5 py-1.5 font-medium animate-in fade-in duration-150">
                                  <AlertCircle size={13} className="shrink-0 text-rose-500" />
                                  <span>กรุณาระบุอายุของเด็กให้ครบทุกท่าน</span>
                                </div>
                              )}

                              <div className="space-y-1.5">
                                {childAges.map((age, index) => (
                                  <ChildAgeSelect
                                    key={index}
                                    index={index}
                                    value={age}
                                    maxAge={policy.childMaxAge}
                                    hasError={childAgeError && age === null}
                                    onChange={(val) => handleChildAgeChange(index, val)}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="border-t border-stone-100 p-2 mt-2">
                            <button
                              type="button"
                              onClick={handleConfirmGuests}
                              className="w-full rounded-xl bg-forest-900 py-2.5 text-sm font-bold text-white transition-colors hover:bg-forest-800 active:scale-[0.99] cursor-pointer"
                            >
                              ตกลง
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  ) : (
                    <div className="flex flex-1 items-center gap-3 px-5 py-3">
                      <Users size={16} className="shrink-0 text-forest-700" />
                      <div>
                        <p className="text-sm font-semibold text-forest-900">พักได้ {room.capacity} ท่านต่อห้อง</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <SectionHeading
                icon={<BedDouble size={16} />}
                title="เลือกหมายเลขห้องพักที่ต้องการ"
                action={
                  <span className="rounded-full bg-forest-50 px-2.5 py-1 text-xs font-bold text-forest-700">
                    {nights > 0 ? `ว่าง ${availableCount} จาก ${sortedPhysicalRooms.length} ห้อง` : 'เลือกวันเช็คอินและเช็คเอาต์ก่อนเลือกห้อง'}
                  </span>
                }
              />

              {/* Capacity guidance note (Agoda style) */}
              {room && minimumRooms > 1 && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200/90 bg-amber-50/80 p-3 text-xs text-amber-900">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-amber-700 shrink-0" />
                    <span>
                      ผู้เข้าพัก <strong>{totalGuests} ท่าน</strong> (พักได้ <strong>{room.capacity} ท่าน/ห้อง</strong>) — ต้องเลือกอย่างน้อย <strong>{minimumRooms} ห้อง</strong>
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                    เลือกแล้ว {selectedRoomIds.length}/{minimumRooms} ห้อง
                  </span>
                </div>
              )}

              <div className="mt-4">
                <RaftLayoutMap
                  rooms={allResortRaftRooms}
                  currentRoomTypeName={room.room_name}
                  selectedRoomIds={selectedRoomIds}
                  onToggleRoom={handleToggleRoom}
                />
              </div>
            </section>

            {/* Special Offers (Advertisement) */}
            {room.available_promotions && room.available_promotions.length > 0 && (
              <div id="promotions" className="mt-4 scroll-mt-24 rounded-2xl bg-stone-50/50 border border-stone-100 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="grid h-6 w-6 place-items-center rounded-md bg-forest-100/60 text-forest-700">
                      <Tag size={13} />
                    </div>
                    <h4 className="text-xs font-bold text-stone-700 uppercase tracking-wide">มีโปรโมชั่นพิเศษสำหรับห้องนี้</h4>
                    <span className="rounded-full bg-forest-50 px-2 py-0.5 text-[11px] font-bold text-forest-700 border border-forest-200/50">
                      {room.available_promotions.length}
                    </span>
                  </div>

                  {/* Left / Right Scroll Buttons */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => scrollPromos('left')}
                      aria-label="เลื่อนโปรโมชั่นไปทางซ้าย"
                      className="grid h-7 w-7 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-2xs transition-colors hover:border-forest-300 hover:bg-forest-50 hover:text-forest-800 active:scale-95"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => scrollPromos('right')}
                      aria-label="เลื่อนโปรโมชั่นไปทางขวา"
                      className="grid h-7 w-7 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-2xs transition-colors hover:border-forest-300 hover:bg-forest-50 hover:text-forest-800 active:scale-95"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>

                {/* Horizontal Scroll Container */}
                <div
                  ref={promoScrollRef}
                  className="flex items-start gap-3 overflow-x-auto scroll-smooth pb-2 pt-1 snap-x snap-mandatory [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden"
                >
                  {room.available_promotions.map((promo) => {
                    const discountText = roomPromotionLabel(promo);
                    const isExpanded = expandedPromoId === promo.id;
                    
                    return (
                      <div
                        key={promo.id}
                        className="w-[280px] sm:w-[320px] shrink-0 snap-start bg-white rounded-xl border border-stone-200/90 shadow-2xs hover:border-forest-200 hover:shadow-xs transition-all flex flex-col"
                      >
                        <button
                          type="button"
                          aria-expanded={isExpanded}
                          aria-controls={`room-promo-${promo.id}`}
                          className="flex w-full items-start justify-between gap-3 p-3.5 text-left hover:bg-stone-50/50 rounded-xl transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest-700"
                          onClick={() => setExpandedPromoId(isExpanded ? null : promo.id)}
                        >
                          <div className="min-w-0 flex-1 space-y-1">
                            <span className="block text-sm font-bold text-forest-900 truncate" title={promo.name}>
                              {promo.name}
                            </span>
                            <span className="inline-block text-xs font-semibold text-bamboo-800 bg-bamboo-50 px-2 py-0.5 rounded border border-bamboo-200/60">
                              {discountText}
                            </span>
                          </div>
                          <span className="mt-0.5 flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-forest-700">
                            รายละเอียด <ChevronDown size={12} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                          </span>
                        </button>

                        {isExpanded && (
                          <div id={`room-promo-${promo.id}`} className="border-t border-stone-100">
                            <div className="p-3 bg-stone-50/50 text-[11px] text-stone-600 rounded-b-xl">
                              <p className="mb-2 text-stone-700 font-medium whitespace-normal leading-relaxed">
                                {promo.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                              </p>
                              <ul className="space-y-1 text-stone-500">
                                <li className="flex items-center gap-1.5">
                                  <span className="text-stone-400 font-medium">โค้ด:</span>
                                  <span className="font-bold text-forest-800 bg-white px-1.5 py-0.5 rounded border border-stone-200">
                                    {promo.code}
                                  </span>
                                </li>
                                {Number(promo.min_nights) > 0 && (
                                  <li className="flex gap-1.5"><span className="text-stone-300">•</span> ขั้นต่ำ {promo.min_nights} คืน</li>
                                )}
                                {promo.discount_type === 'percent' && promo.max_discount && (
                                  <li className="flex gap-1.5"><span className="text-stone-300">•</span> ลดสูงสุด ฿{Number(promo.max_discount).toLocaleString()}</li>
                                )}
                                {Number(promo.room_count) > 1 && <li className="flex gap-1.5"><span className="text-stone-300">•</span> ต้องจองอย่างน้อย {promo.room_count} ห้องประเภทนี้</li>}
                                {Number(promo.min_price) > 0 && <li className="flex gap-1.5"><span className="text-stone-300">•</span> ยอดค่าห้องขั้นต่ำ ฿{Number(promo.min_price).toLocaleString()}</li>}
                                {promo.is_collectible && <li className="flex gap-1.5"><span className="text-stone-300">•</span> ต้องเก็บคูปองที่ <Link href="/promotions" className="underline text-forest-700 font-semibold">หน้าโปรโมชั่น</Link> ก่อนใช้</li>}
                                {Number(promo.boat_ticket_count) > 0 && <li className="flex gap-1.5"><span className="text-stone-300">•</span> 1 สิทธิ์ = เรือ 1 ลำ 1 รอบ ใช้ได้เฉพาะวันระหว่างเช็คอินและเช็คเอาต์</li>}
                              </ul>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-stone-400 font-medium">
                  <span>* รายการนี้แสดงโปรโมชั่นของห้อง หน้าสรุปจะแสดงเหตุผลและเลือกส่วนลดสูงสุดที่ใช้ได้ให้</span>
                  <span className="hidden sm:inline text-stone-400">เลื่อนซ้าย-ขวาเพื่อดูทั้งหมด</span>
                </div>
              </div>
            )}

            {/* Reviews */}
            <section id="reviews" className={`${CARD} p-5 sm:p-7 scroll-mt-24`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-stone-100 pb-4">
                <div>
                  <SectionHeading icon={<Star size={16} />} title="รีวิวห้องพัก" />
                  <p className="mt-1 text-xs text-stone-500">
                    ความคิดเห็นและความพึงพอใจจากผู้เข้าพัก
                  </p>
                </div>
                
                <div className="flex items-center gap-3 self-start sm:self-auto">
                  {avgRating !== null && (
                    <div className="flex items-center gap-2 rounded-xl bg-forest-50/80 border border-forest-100/80 px-3 py-1.5 shadow-2xs">
                      <span className="font-sans text-2xl font-extrabold text-forest-950 leading-none">
                        {avgRating.toFixed(1)}
                      </span>
                      <Stars value={avgRating} size={13} />
                    </div>
                  )}

                  {/* Navigation Arrows for Review Slider */}
                  {filteredReviews.length > 2 && (
                    <div className="flex items-center gap-1.5 pl-2 border-l border-stone-200">
                      <button
                        type="button"
                        onClick={() => scrollReviews('left')}
                        disabled={!canScrollReviews || reviewScrollProgress <= 0.02}
                        aria-label="รีวิวก่อนหน้า"
                        className="grid h-8 w-8 place-items-center rounded-full border border-stone-200 bg-white text-forest-800 shadow-2xs transition-colors hover:border-forest-300 hover:bg-forest-50 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => scrollReviews('right')}
                        disabled={!canScrollReviews || reviewScrollProgress >= 0.98}
                        aria-label="รีวิวถัดไป"
                        className="grid h-8 w-8 place-items-center rounded-full border border-stone-200 bg-white text-forest-800 shadow-2xs transition-colors hover:border-forest-300 hover:bg-forest-50 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Rating Filter Pills */}
              {reviews.length > 0 && (
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-stone-500 mr-1">กรองรีวิว:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedRatingFilter(null)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                      selectedRatingFilter === null
                        ? 'bg-forest-900 text-white shadow-2xs'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
                    }`}
                  >
                    ทั้งหมด ({reviews.length})
                  </button>
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviews.filter((r) => r.rating != null && Math.round(r.rating) === star).length;
                    const isSelected = selectedRatingFilter === star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setSelectedRatingFilter(isSelected ? null : star)}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-all ${
                          isSelected
                            ? 'bg-forest-900 text-white shadow-2xs'
                            : count === 0
                            ? 'bg-stone-100/70 text-stone-400 hover:bg-stone-200/60 hover:text-stone-600'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
                        }`}
                      >
                        <Star size={11} className={isSelected ? 'fill-amber-300 text-amber-300' : count === 0 ? 'fill-stone-300 text-stone-300' : 'fill-amber-400 text-amber-500'} />
                        <span>{star} ดาว ({count})</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Reviews Horizontal Slidebar */}
              {reviews.length === 0 ? (
                <div className="mt-8 flex flex-col items-center justify-center py-10 text-center">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-forest-50 text-forest-600 mb-3">
                    <Sparkles size={22} />
                  </div>
                  <h3 className="font-sans text-base font-semibold text-forest-900">ยังไม่มีรีวิวสำหรับห้องพักประเภทนี้</h3>
                  <p className="mt-1 max-w-sm text-xs text-stone-500">
                    ร่วมเป็นคนแรกที่ได้สัมผัสบรรยากาศแพริมน้ำและแบ่งปันความประทับใจ
                  </p>
                </div>
              ) : filteredReviews.length === 0 ? (
                <div className="mt-8 py-10 text-center">
                  <p className="text-sm text-stone-500">ยังไม่มีรีวิวระดับ {selectedRatingFilter} ดาว</p>
                  <button
                    type="button"
                    onClick={() => setSelectedRatingFilter(null)}
                    className="mt-2 text-xs font-semibold text-forest-800 underline hover:text-forest-900 cursor-pointer"
                  >
                    ดูรีวิวทั้งหมด ({reviews.length})
                  </button>
                </div>
              ) : (
                <div className="mt-4">
                  <div
                    ref={reviewScrollRef}
                    onScroll={updateReviewScrollState}
                    className="grid grid-rows-2 grid-flow-col auto-cols-[88%] sm:auto-cols-[calc(50%-7px)] gap-3.5 overflow-x-auto scroll-smooth pb-2 pt-1 snap-x snap-mandatory [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden"
                  >
                    {filteredReviews.map((review) => {
                      const initial = review.first_name?.[0]?.toUpperCase() || 'U';
                      return (
                        <div
                          key={review.review_id}
                          className="w-full shrink-0 snap-start flex flex-col justify-between rounded-2xl border border-stone-200/80 bg-gradient-to-b from-stone-50/50 to-white p-4 shadow-2xs hover:border-forest-300 hover:shadow-xs transition-all h-[135px] sm:h-[145px]"
                        >
                          <div>
                            {/* Card Header: Avatar, Name, Rating */}
                            <div className="flex items-start justify-between gap-2.5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest-100 text-xs font-bold text-forest-900 border border-forest-200/60 shadow-2xs">
                                  {initial}
                                </span>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <p className="truncate text-sm font-bold text-forest-950">
                                      {maskReviewerName(review.first_name, review.last_name)}
                                    </p>
                                    <span className="inline-flex items-center gap-0.5 rounded-full bg-forest-50 px-1.5 py-0.5 text-[10px] font-semibold text-forest-750 border border-forest-200/50">
                                      <CheckCircle2 size={10} className="text-forest-600" />
                                      เข้าพักจริง
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-stone-400 mt-0.5">
                                    {formatThaiDate(review.review_date)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-1 rounded-lg bg-amber-50/80 border border-amber-200/60 px-2 py-1">
                                <Star size={11} className="fill-amber-400 text-amber-500" />
                                <span className="font-sans text-xs font-bold text-amber-900">
                                  {review.rating == null ? '—' : Number(review.rating).toFixed(1)}
                                </span>
                              </div>
                            </div>

                            {/* Comment */}
                            {review.comment && (
                              <p className="mt-2 text-xs sm:text-[13px] leading-relaxed text-charcoal-700 italic font-normal line-clamp-2 sm:line-clamp-3">
                                &ldquo;{review.comment}&rdquo;
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Reviews Slidebar */}
                  {filteredReviews.length > 2 && (
                    <div className="mt-3.5 flex items-center justify-center">
                      <div
                        role="progressbar"
                        aria-valuenow={Math.round(reviewScrollProgress * 100)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="แถบเลื่อนดูรีวิว"
                        onClick={handleSlidebarClick}
                        className="group relative h-2.5 w-36 sm:w-52 rounded-full bg-stone-200 hover:bg-stone-300/80 cursor-pointer p-0.5 transition-colors shadow-inner"
                      >
                        <div
                          className="h-full rounded-full bg-forest-800 shadow-2xs transition-[margin-left] duration-100 ease-out group-hover:bg-forest-900"
                          style={{
                            width: `${reviewThumbWidth}%`,
                            marginLeft: `${reviewScrollProgress * (100 - reviewThumbWidth)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Policies & Useful Info (Dynamic from Database) */}
            <section id="policies" className={`${CARD} p-5 sm:p-6 bg-stone-50/50 border-none scroll-mt-24`}>
              <SectionHeading icon={<AlertCircle size={16} />} title="ข้อมูลที่เป็นประโยชน์และนโยบาย" />
              
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-charcoal-600">
                
                {/* Check-in / Check-out */}
                <div className="bg-white p-5 rounded-xl border border-stone-100 shadow-xs">
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
                <div className="bg-white p-5 rounded-xl border border-stone-100 shadow-xs">
                  <p className="font-bold text-forest-900 mb-3 flex items-center gap-2"><AlertCircle size={16} className="text-forest-600" />ข้อมูลสำคัญที่พัก</p>
                  <ul className="list-disc list-outside ml-4 space-y-1.5 text-stone-500">
                    {(resortInfo?.important_info || 'รวมอาหารเช้าสำหรับทุกการจอง\nไม่อนุญาตให้นำสัตว์เลี้ยงเข้าพัก\nระมัดระวังเด็กเล็ก เนื่องจากห้องพักตั้งอยู่บนน้ำ').split('\n').map((line: string, i: number) => (
                      <li key={i}>{line.trim()}</li>
                    ))}
                  </ul>
                </div>

                {/* Kids & Extra Beds */}
                <div className="bg-white p-5 rounded-xl border border-stone-100 shadow-xs">
                  <p className="font-bold text-forest-900 mb-3 flex items-center gap-2"><Users size={16} className="text-forest-600" />นโยบายเด็กและเตียงเสริม</p>
                  <ul className="list-disc list-outside ml-4 space-y-1.5 text-stone-500">
                    {policy.bookingPolicyText.split('\n').map((line: string, i: number) => {
                      const [title, ...rest] = line.split(':');
                      if (rest.length === 0) return <li key={i}>{line.trim()}</li>;
                      return (
                        <li key={i}><span className="font-medium text-stone-700">{title.trim()}:</span> {rest.join(':').trim()}</li>
                      );
                    })}
                  </ul>
                </div>

                {/* Getting there & Parking */}
                <div className="bg-white p-5 rounded-xl border border-stone-100 shadow-xs">
                  <p className="font-bold text-forest-900 mb-3 flex items-center gap-2"><Car size={16} className="text-forest-600" />การเดินทางและที่จอดรถ</p>
                  <p className="text-stone-500 leading-relaxed whitespace-pre-line">
                    {resortInfo?.parking_info || 'มีลานจอดรถส่วนตัวให้บริการฟรีในบริเวณสวนวลัยรุกขเวช (ไม่ต้องจองล่วงหน้า) แขกผู้เข้าพักสามารถขับรถมาจอดและเดินไปยังห้องพักได้โดยตรง'}
                  </p>
                </div>

              </div>
            </section>
          </div>

          {/* ---- ฝั่งขวา: การ์ดสรุปการจอง ---- */}
          <aside className="lg:col-span-4">
            <div className="mb-8 lg:sticky lg:top-[96px]">
              <BookingSummaryCard  />
            </div>
          </aside>
        </div>
      </div>
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-forest-950/95 backdrop-blur-xs" onClick={() => setLightboxOpen(false)}>
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
