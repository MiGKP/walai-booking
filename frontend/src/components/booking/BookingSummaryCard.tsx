'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Calendar, Plus, Minus, X, CheckCircle2, CreditCard, Trash2, AlertTriangle, Baby, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatThaiDate, nightsBetween, todayISO, addDaysISO, monthCursorFromISO, MonthCursor } from '@/lib/date';
import { RoomCartItem } from '@/lib/room-cart';
import { useRoomCart } from '@/lib/room-cart-store';
import { useCartSync } from '@/hooks/useCartSync';
import { useAuth } from '@/hooks/useAuth';
import { buildLoginRedirectUrl } from '@/lib/auth-redirect';
import api, { getApiErrorMessage } from '@/lib/api';
import BookingCalendar from '@/components/booking/BookingCalendar';
import PromotionDrawer from '@/components/booking/PromotionDrawer';

interface PhysicalRoom {
  room_id: number;
  room_number: string;
}

interface Promotion {
  id: number;
  name: string;
  code: string;
  discount_value: number;
  discount_type?: 'percent' | 'fixed';
  min_nights?: number;
  max_discount?: number;
  stackable?: boolean;
}

interface RoomType {
  id: number;
  room_name: string;
  type_name?: string | null;
  capacity: number;
  price_per_night: number;
  available_count?: number;
  rooms?: PhysicalRoom[] | null;
  available_promotions?: Promotion[] | null;
}

interface BookingSummaryCardProps {
  currentRoomType?: RoomType | null;
}

export default function BookingSummaryCard({ currentRoomType }: BookingSummaryCardProps) {
  const { user } = useAuth();
  const isAdminOrStaff = user?.role === "admin" || user?.role === "room_staff";
  const [isPromoDrawerOpen, setIsPromoDrawerOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const defaultCheckIn = isAdminOrStaff ? todayISO() : addDaysISO(todayISO(), 1);
  const checkIn = searchParams.get('check_in') || defaultCheckIn;
  const checkOut = searchParams.get('check_out') || addDaysISO(checkIn, 1);
  const adults = parseInt(searchParams.get('adults') || '1', 10);
  const children = parseInt(searchParams.get('children') || '0', 10);
  // อายุเด็กแต่ละคน ณ วันเข้าพัก (0-17 ปี) — เก็บเป็น comma-separated ใน URL คู่กับ children เพื่อให้ state คงอยู่ตามหน้าเหมือนตัวอื่นๆ
  // ช่องที่ยังไม่เลือกอายุแทนด้วยสตริงว่าง (เช่น "5,,10") เพื่อบังคับให้ลูกค้าเลือกครบก่อนยืนยันการจองได้
  const childAges: Array<number | null> = useMemo(() => {
    const raw = (searchParams.get('child_ages') || '').split(',').map((s) => {
      const n = parseInt(s, 10);
      return Number.isInteger(n) && n >= 0 && n <= 17 ? n : null;
    });
    // กันเคส URL ไม่ตรงกับจำนวนเด็กปัจจุบัน (เช่น ผู้ใช้แก้ URL เอง หรือ query ยังไม่ sync) เติม/ตัดให้ยาวเท่ากับ children เสมอ
    const normalized = raw.length && (searchParams.get('child_ages') ?? '') !== '' ? raw : [];
    if (normalized.length === children) return normalized;
    if (normalized.length > children) return normalized.slice(0, children);
    return [...normalized, ...Array(children - normalized.length).fill(null)];
  }, [searchParams, children]);

  const allChildAgesSet = childAges.every((age) => age !== null);
  // รองรับใช้หลายโค้ดพร้อมกัน (คั่นด้วย comma ใน URL) — 1 ประเภทห้องในตะกร้าใช้ได้ 1 โค้ด
  const promoCodes = useMemo(
    () => (searchParams.get('promo_code') || '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean),
    [searchParams]
  );

  const [promoInput, setPromoInput] = useState('');
  const [specialRequest, setSpecialRequest] = useState('');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [roomsData, setRoomsData] = useState<RoomType[]>([]);
  const [cursor, setCursor] = useState<MonthCursor>(() => monthCursorFromISO(checkIn));

  // ตะกร้าห้องพัก: อ่าน/เขียนผ่าน LocalStorage เท่านั้น (ไม่ผูกกับ URL) เพื่อไม่ให้ query string
  // แสดง room_ids ที่อ่านยาก และให้ทุกหน้าที่ subscribe เห็นข้อมูลตรงกันทันที
  const cart = useRoomCart();
  const { commit: commitCart, clearAll: clearCartEverywhere } = useCartSync({ checkIn, checkOut, adults, children });
  const { isAuthenticated } = useAuth();
  const [isBooking, setIsBooking] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showLoginNotice, setShowLoginNotice] = useState(false);

  const [isWideEnoughForTwoMonths, setIsWideEnoughForTwoMonths] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(min-width: 860px)');
    const update = () => setIsWideEnoughForTwoMonths(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  const dateFieldRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const nights = nightsBetween(checkIn, checkOut);

  // FETCH ROOM DATA (ใช้รีเฟรชราคา/ความจุล่าสุด — ไม่ใช่แหล่งความจริงของรายการที่เลือกอีกต่อไป)
  useEffect(() => {
    api.get('/rooms', { params: { check_in: checkIn, check_out: checkOut } })
      .then(res => setRoomsData(res.data?.data || []))
      .catch(err => console.error('Failed to fetch rooms:', err));
  }, [checkIn, checkOut]);

  // COMBINE DATA POOL
  const allRooms = useMemo(() => {
    const pool = [...roomsData];
    if (currentRoomType) {
      const idx = pool.findIndex(r => String(r.id) === String(currentRoomType.id));
      if (idx >= 0) {
        pool[idx] = { ...pool[idx], ...currentRoomType };
      } else {
        pool.push(currentRoomType);
      }
    }
    return pool;
  }, [roomsData, currentRoomType]);

  // รายการห้องที่เลือก: มาจากตะกร้า (LocalStorage) โดยตรงเสมอ — ไม่มีการ resolve จาก URL อีกต่อไป
  // จึงไม่มีสถานะ "ไม่พบข้อมูล/กำลังโหลด" กระพริบระหว่าง fetch ราคาล่าสุด (ใช้ snapshot ที่บันทึกไว้ตอนเพิ่มเป็นค่าเริ่มต้นเสมอ)
  const cartItems = useMemo(() => {
    const items = cart?.items ?? [];
    return items.map((item) => {
      const live = allRooms.find((r) => r.id === item.room_type_id);
      const physicalRoomNumber =
        item.room_number ||
        (item.room_id ? live?.rooms?.find((r) => r.room_id === item.room_id)?.room_number ?? null : null);

      const baseName = live?.room_name || item.room_name;
      const displayName =
        physicalRoomNumber && !baseName.includes(`(ห้อง ${physicalRoomNumber})`)
          ? `${baseName} (ห้อง ${physicalRoomNumber})`
          : baseName;

      // เช็คว่าห้อง/จำนวนที่เคยเลือกไว้ยังว่างอยู่ไหมสำหรับช่วงวันที่ปัจจุบัน (กรณีผู้ใช้เปลี่ยนวันหลังเลือกห้องแล้ว)
      let unavailable = false;
      if (live) {
        if (item.room_id) {
          if (Array.isArray(live.rooms) && !live.rooms.some((r) => r.room_id === item.room_id)) {
            unavailable = true;
          }
        } else if (live.available_count != null && Number(live.available_count) < item.quantity) {
          unavailable = true;
        }
      }

      return {
        rawToken: `${item.room_type_id}:${item.room_id || 0}`,
        typeId: item.room_type_id,
        roomId: item.room_id || 0,
        name: displayName,
        price: live?.price_per_night ?? item.price_per_night,
        capacity: live?.capacity ?? item.capacity,
        qty: item.quantity,
        typeName: live?.type_name ?? item.type_name,
        roomNumber: physicalRoomNumber,
        unavailable,
        availableCount: live?.available_count ?? item.available_count,
      };
    });
  }, [cart, allRooms]);

  const hasUnavailableItems = cartItems.some((item) => item.unavailable);

  // ความจุรวมของห้องที่เลือกไว้ (แต่ละห้องรับได้ตาม capacity ของประเภทห้องนั้น ไม่ว่าจะเป็นผู้ใหญ่หรือเด็ก)
  const totalCapacity = cartItems.reduce((sum, item) => sum + item.capacity * item.qty, 0);
  const totalGuests = adults + children;
  // จำนวนเด็กที่ถูกนับรวมในความจุ (อายุ 6 ปีขึ้นไป) — เด็ก 0-5 ขวบเข้าพักฟรี ไม่นับรวมความจุ (สอดคล้องกับ backend)
  const countableChildren = childAges.filter((age) => age !== null && age > 5).length;
  const totalCapacityGuests = adults + countableChildren;
  const overCapacity = cartItems.length > 0 && totalCapacityGuests > totalCapacity;

  // แจ้งเตือนทันทีเมื่อ re-validate แล้วพบว่ามีห้องไม่ว่างแล้ว (เช่น หลังเปลี่ยนวันที่) ไม่ใช่แค่ทำสีแดงรอให้สังเกตเอง
  const wasUnavailableRef = useRef(false);
  useEffect(() => {
    if (hasUnavailableItems && !wasUnavailableRef.current) {
      toast.error('มีห้องที่เลือกไว้ไม่ว่างแล้วสำหรับวันที่นี้ กรุณาตรวจสอบรายการห้องพัก');
    }
    wasUnavailableRef.current = hasUnavailableItems;
  }, [hasUnavailableItems]);

  const handleRemoveUnavailable = () => {
    const items = cart?.items ?? [];
    const nextItems = items.filter((item) => {
      const match = cartItems.find((c) => c.typeId === item.room_type_id && c.roomId === (item.room_id || 0));
      return !match?.unavailable;
    });
    commitCart(nextItems);
    toast.success('ลบห้องที่ไม่ว่างแล้วออกจากตะกร้าแล้ว');
  };

  const updateUrl = (updates: Record<string, string | number | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === '') {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleClearAll = () => {
    setShowClearConfirm(true);
  };

  const confirmClearAll = () => {
    setPromoInput('');
    updateUrl({ promo_code: null });
    clearCartEverywhere();
    setShowClearConfirm(false);
  };

  const handleGuestChange = (type: 'adults' | 'children', delta: number) => {
    const val = type === 'adults' ? adults : children;
    const next = Math.max(type === 'adults' ? 1 : 0, val + delta);
    if (type === 'adults') {
      if (delta > 0 && totalCapacity > 0 && next + countableChildren > totalCapacity) {
        toast.error(`ผู้เข้าพักรวมได้ไม่เกิน ${totalCapacity} คน ตามความจุห้องที่เลือกไว้`);
        return;
      }
      updateUrl({ adults: next });
      return;
    }
    // เพิ่ม/ลดจำนวนเด็กแล้วปรับ array อายุให้ยาวเท่ากันเสมอ (เพิ่มใหม่ = ยังไม่เลือกอายุ ต้องเลือกก่อนจองได้, ลด = ตัดคนสุดท้ายออก)
    const nextChildAges: Array<number | null> = delta > 0 ? [...childAges, null] : childAges.slice(0, -1);
    const serialized = nextChildAges.map((a) => (a === null ? '' : String(a))).join(',');
    updateUrl({ children: next, child_ages: serialized || null });
  };

  const handleChildAgeChange = (index: number, age: number) => {
    const nextChildAges = childAges.map((a, i) => (i === index ? age : a));
    const nextCountable = nextChildAges.filter((a): a is number => a !== null && a >= 2).length;
    if (totalCapacity > 0 && adults + nextCountable > totalCapacity) {
      toast.error(`ผู้เข้าพักรวมได้ไม่เกิน ${totalCapacity} คน ตามความจุห้องที่เลือกไว้ (เด็กอายุต่ำกว่า 2 ขวบไม่นับความจุ)`);
      return;
    }
    updateUrl({ child_ages: nextChildAges.join(',') });
  };

  const handleRoomQtyChange = (typeId: number, roomId: number, delta: number) => {
    const items = cart?.items ?? [];
    let blocked = false;
    const nextItems: RoomCartItem[] = items
      .map((item) => {
        const matches = item.room_type_id === typeId && (item.room_id || 0) === roomId;
        if (!matches) return item;
        if (delta > 0 && item.quantity >= item.available_count) {
          blocked = true;
          return item;
        }
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      })
      .filter((item) => item.quantity > 0);

    if (blocked) {
      toast.error('ห้องว่างครบจำนวนที่มีแล้ว');
      return;
    }
    commitCart(nextItems);
  };

  const handleAddCurrentRoom = () => {
    if (!currentRoomType) return;

    const items = cart?.items ?? [];
    const existingIndex = items.findIndex((i) => i.room_type_id === currentRoomType.id && !i.room_id);
    const totalForType = items
      .filter((i) => i.room_type_id === currentRoomType.id)
      .reduce((sum, i) => sum + i.quantity, 0);

    if (currentRoomType.available_count != null && totalForType >= currentRoomType.available_count) {
      toast.error(`${currentRoomType.room_name} ว่างครบจำนวนที่มีแล้ว (${currentRoomType.available_count} ห้อง)`);
      return;
    }

    const nextItems: RoomCartItem[] =
      existingIndex >= 0
        ? items.map((i, idx) => (idx === existingIndex ? { ...i, quantity: i.quantity + 1 } : i))
        : [
            ...items,
            {
              room_type_id: currentRoomType.id,
              room_id: null,
              room_number: null,
              room_name: currentRoomType.room_name,
              type_name: currentRoomType.type_name || null,
              capacity: currentRoomType.capacity,
              price_per_night: currentRoomType.price_per_night,
              quantity: 1,
              available_count: currentRoomType.available_count ?? 99,
            },
          ];

    commitCart(nextItems);
  };

  const handleConfirmBooking = async () => {
    if (cartItems.length === 0 || isBooking) return;

    if (!isAuthenticated) {
      setShowLoginNotice(true);
      return;
    }

    if (hasUnavailableItems) {
      toast.error('มีห้องบางรายการไม่ว่างแล้วสำหรับวันที่เลือก กรุณาลบออกหรือเปลี่ยนวันที่');
      return;
    }

    if (overCapacity) {
      toast.error(`ผู้เข้าพักรวม ${totalCapacityGuests} คน เกินความจุห้องที่เลือก (${totalCapacity} คน) กรุณาเพิ่มห้องหรือลดจำนวนผู้เข้าพัก`);
      return;
    }

    if (!allChildAgesSet) {
      toast.error('กรุณาเลือกอายุของเด็กแต่ละคนให้ครบก่อนยืนยันการจอง');
      return;
    }

    // ห้องที่ลูกค้าเลือกเลขห้องเจาะจงไว้ (roomId ไม่ใช่ 0) ส่งเป็นรายการแยกพร้อม room_id เพื่อให้ backend
    // จองห้องนั้นจริง — ส่วนที่ไม่ได้เลือกเลขห้องเจาะจงค่อยรวมจำนวนตามประเภทห้องแล้วให้ backend เลือกห้องว่างให้เอง
    // แต่ละประเภทห้องแนบโปรโมชั่นของตัวเองไปด้วย (ถ้ามีโค้ดที่ใช้ได้กับประเภทนั้น)
    const promotionByType = new Map<number, number>();
    promoAssignments.forEach((a) => {
      if (a.valid && a.typeId != null && a.promotion) promotionByType.set(a.typeId, a.promotion.id);
    });

    const genericQuantityByType = new Map<number, number>();
    const specificItems: Array<{ room_type_id: number; quantity: number; room_id: number; promotion_id?: number }> = [];
    cartItems.forEach((item) => {
      if (item.roomId) {
        specificItems.push({
          room_type_id: item.typeId,
          quantity: item.qty,
          room_id: item.roomId,
          promotion_id: promotionByType.get(item.typeId) ?? undefined,
        });
      } else {
        genericQuantityByType.set(item.typeId, (genericQuantityByType.get(item.typeId) || 0) + item.qty);
      }
    });
    const genericItems = Array.from(genericQuantityByType.entries()).map(([room_type_id, quantity]) => ({
      room_type_id,
      quantity,
      promotion_id: promotionByType.get(room_type_id) ?? undefined,
    }));

    setIsBooking(true);
    try {
      const res = await api.post('/bookings/room', {
        check_in_date: checkIn,
        check_out_date: checkOut,
        adults,
        children,
        child_ages: childAges,
        special_requests: specialRequest.trim() || undefined,
        items: [...specificItems, ...genericItems],
      });

      const bookingId = res.data?.data?.room_booking_id;
      if (!bookingId) throw new Error('ไม่ได้รับหมายเลขการจองจากระบบ');

      setSpecialRequest('');
      clearCartEverywhere();
      router.push(`/payment?booking_type=room&booking_id=${bookingId}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'ไม่สามารถสร้างการจองได้ กรุณาลองใหม่อีกครั้ง'));
    } finally {
      setIsBooking(false);
    }
  };

  const subtotal = cartItems.reduce((acc, item) => acc + (item.price * item.qty * nights), 0);

  // จับคู่แต่ละโค้ดกับ "ประเภทห้อง" ที่ยังไม่ถูกโค้ดอื่นจับจองในตะกร้า (1 ประเภทห้อง : 1 โค้ด)
  // แล้วคิดส่วนลดแยกตามยอดรวมเฉพาะประเภทห้องนั้นๆ ไม่ใช่ยอดรวมทั้งบิล
  const promoAssignments = useMemo(() => {
    const claimedTypes = new Set<number>();
    return promoCodes.map((code) => {
      let matched: { typeId: number; promotion: Promotion } | null = null;
      for (const item of cartItems) {
        if (claimedTypes.has(item.typeId)) continue;
        const live = allRooms.find((r) => r.id === item.typeId);
        const promo = live?.available_promotions?.find((p) => p.code === code);
        if (promo) {
          matched = { typeId: item.typeId, promotion: promo };
          break;
        }
      }

      if (!matched) {
        const matchesSomeType = cartItems.some((item) => {
          const live = allRooms.find((r) => r.id === item.typeId);
          return live?.available_promotions?.some((p) => p.code === code);
        });
        return {
          code,
          promotion: null as Promotion | null,
          typeId: null as number | null,
          typeLabel: '',
          discount: 0,
          valid: false,
          reason: matchesSomeType ? 'ประเภทห้องนี้มีโค้ดอื่นใช้อยู่แล้ว' : 'ใช้ไม่ได้กับห้องที่เลือกไว้',
        };
      }

      claimedTypes.add(matched.typeId);
      const typeItem = cartItems.find((i) => i.typeId === matched!.typeId);
      const typeSubtotal = cartItems
        .filter((i) => i.typeId === matched!.typeId)
        .reduce((sum, i) => sum + i.price * i.qty * nights, 0);
      const promo = matched.promotion;

      if (promo.min_nights && nights < promo.min_nights) {
        return {
          code,
          promotion: promo,
          typeId: matched.typeId,
          typeLabel: typeItem?.typeName || typeItem?.name || '',
          discount: 0,
          valid: false,
          reason: `ต้องพักขั้นต่ำ ${promo.min_nights} คืน`,
        };
      }

      const discount = promo.discount_type === 'percent'
        ? Math.min(
            Math.round((typeSubtotal * Number(promo.discount_value)) / 100),
            promo.max_discount != null ? Number(promo.max_discount) : Infinity,
            typeSubtotal
          )
        : Math.min(Number(promo.discount_value), typeSubtotal);

      return {
        code,
        promotion: promo,
        typeId: matched.typeId,
        typeLabel: typeItem?.typeName || typeItem?.name || '',
        discount,
        valid: true,
        reason: undefined as string | undefined,
      };
    });
  }, [promoCodes, cartItems, allRooms, nights]);

  const totalDiscount = promoAssignments.filter((a) => a.valid).reduce((sum, a) => sum + a.discount, 0);
  const total = Math.max(0, subtotal - totalDiscount);

  const addPromoCode = (rawCode: string) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return;
    if (promoCodes.includes(code)) {
      toast.error('ใช้โค้ดนี้ไปแล้ว');
      return;
    }
    if (promoCodes.length >= 3) {
      toast.error('ใช้โค้ดได้สูงสุด 3 โค้ดเท่านั้น');
      return;
    }

    // Check stackability
    // Get the promotion object for the new code
    let newPromo: Promotion | undefined;
    for (const r of allRooms) {
      const found = r.available_promotions?.find(p => p.code === code);
      if (found) {
        newPromo = found;
        break;
      }
    }

    if (!newPromo) {
      toast.error('โค้ดไม่ถูกต้องหรือหมดอายุ');
      return;
    }

    if (promoCodes.length > 0) {
      // If we already have codes, they ALL must be stackable, including the new one
      if (!newPromo.stackable) {
        toast.error('โค้ดนี้ไม่สามารถใช้ร่วมกับโค้ดอื่นได้');
        return;
      }

      // Check existing codes
      for (const existingCode of promoCodes) {
        let p: Promotion | undefined;
        for (const r of allRooms) {
          const found = r.available_promotions?.find(x => x.code === existingCode);
          if (found) { p = found; break; }
        }
        if (p && !p.stackable) {
          toast.error(`โค้ด ${existingCode} ที่ใช้อยู่ ไม่สามารถใช้ร่วมกับโค้ดอื่นได้ กรุณาลบออกก่อน`);
          return;
        }
      }
    }

    updateUrl({ promo_code: [...promoCodes, code].join(',') });
    setPromoInput('');
  };

  const removePromoCode = (code: string) => {
    const next = promoCodes.filter((c) => c !== code);
    updateUrl({ promo_code: next.length > 0 ? next.join(',') : null });
  };

  const isCurrentRoomInCart = currentRoomType && cartItems.some(i => i.typeId === currentRoomType.id);

  return (
    <>
    <div ref={cardRef} className="rounded-3xl border border-stone-200/80 bg-white/95 backdrop-blur-xl shadow-xl shadow-stone-200/40 flex flex-col max-h-[calc(100vh-2rem)]">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-stone-100/80 px-6 py-5 bg-stone-50/40 rounded-t-3xl shrink-0">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest-900 text-white shadow-sm">
            <CreditCard size={18} />
          </span>
          <div>
            <h3 className="font-display text-lg font-semibold text-forest-900 tracking-tight">รายละเอียดและการชำระเงิน</h3>
          </div>
        </div>
        {cartItems.length > 0 && (
          <button type="button" onClick={handleClearAll} className="text-[11px] font-bold uppercase tracking-wider text-stone-400 transition-colors hover:text-red-600 underline underline-offset-2">
            ล้างตะกร้า
          </button>
        )}
      </div>

      <div className="space-y-6 px-6 py-6 overflow-y-auto custom-scrollbar">
        {/* RESERVATION TICKET (Dates + Guests) */}
        <div className="rounded-2xl border border-stone-100 bg-stone-50/50 p-1">
          <div className="flex flex-col rounded-xl bg-white p-4 shadow-sm ring-1 ring-stone-950/5">
            <div className="flex items-start justify-between pb-4 border-b border-stone-100 border-dashed">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">เข้าพัก – เช็คเอาต์</span>
                <span className="text-sm font-semibold text-forest-900">{formatThaiDate(checkIn)} – {formatThaiDate(checkOut)}</span>
              </div>
              <span className="flex shrink-0 items-center justify-center rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-forest-700 ring-1 ring-emerald-500/20">
                {nights} คืน
              </span>
            </div>
            
            <div className="flex items-start gap-6 pt-4">
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">ผู้ใหญ่</span>
                <span className="text-sm font-semibold text-forest-900">{adults} ท่าน</span>
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400">เด็ก</span>
                <span className="text-sm font-semibold text-forest-900">{children > 0 ? `${children} ท่าน` : '-'}</span>
              </div>
            </div>
            
            {children > 0 && (
              <div className="mt-4 rounded-lg bg-stone-50 px-3 py-2.5 ring-1 ring-stone-200/50">
                <p className="text-[11px] text-stone-600 leading-relaxed">
                  <span className="font-semibold text-stone-800">อายุเด็ก:</span>{' '}
                  {childAges.map((a, i) => (a !== null ? `${a} ปี` : '(ยังไม่ระบุ)')).join(' · ')}
                </p>
                {!allChildAgesSet && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-amber-600">
                    <AlertTriangle size={12} className="shrink-0" /> กรุณาระบุอายุเด็กที่ช่องค้นหา
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {overCapacity && (
          <p className="flex items-center gap-1.5 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-600 ring-1 ring-red-500/20">
            <AlertTriangle size={14} className="shrink-0" /> ผู้เข้าพัก {totalCapacityGuests} คน เกินความจุห้อง ({totalCapacity} คน)
          </p>
        )}

        {/* ROOM LIST */}
        <div>
          <div className="mb-3 flex items-center justify-between">
             <span className="text-xs font-bold uppercase tracking-wider text-forest-900">ห้องพักที่เลือก</span>
             <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-500">{cartItems.length} รายการ</span>
          </div>

          <div className="space-y-2.5">
            {cartItems.length > 0 ? cartItems.map(item => (
              <div key={item.rawToken} className={`relative overflow-hidden rounded-xl p-3.5 ring-1 ${item.unavailable ? 'bg-red-50 ring-red-200' : 'bg-white ring-stone-200/80 shadow-sm'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-sm font-bold ${item.unavailable ? 'text-red-700' : 'text-forest-900'}`}>{item.name}</p>
                    <p className={`mt-0.5 text-[11px] ${item.unavailable ? 'text-red-500' : 'text-stone-500'}`}>฿{item.price.toLocaleString()} / คืน · จุ {item.capacity} ท่าน</p>
                  </div>
                  {item.roomId ? (
                    <button onClick={() => handleRoomQtyChange(item.typeId, item.roomId, -1)} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-red-500 transition-colors hover:border-red-300 hover:bg-red-50">
                      <Trash2 size={13} />
                    </button>
                  ) : (
                    <div className="flex items-center gap-2.5">
                      <button onClick={() => handleRoomQtyChange(item.typeId, item.roomId, -1)} className="grid h-7 w-7 place-items-center rounded-full border border-stone-200 bg-white text-forest-900 transition-colors hover:border-forest-900 hover:bg-forest-50 disabled:opacity-30"><Minus size={13} /></button>
                      <span className="w-5 text-center text-sm font-bold text-forest-900">{item.qty}</span>
                      <button onClick={() => handleRoomQtyChange(item.typeId, item.roomId, 1)} disabled={item.unavailable} className="grid h-7 w-7 place-items-center rounded-full border border-stone-200 bg-white text-forest-900 transition-colors hover:border-forest-900 hover:bg-forest-50 disabled:opacity-30"><Plus size={13} /></button>
                    </div>
                  )}
                </div>
                {item.unavailable && (
                  <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-red-600"><AlertTriangle size={12}/> ไม่ว่างแล้ว กรุณาลบออก</p>
                )}
              </div>
            )) : (
              <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/50 py-8 text-center text-[13px] font-medium text-stone-400">ยังไม่ได้เลือกห้องพัก</div>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <div className="border-t border-stone-100 bg-stone-50/50 p-6 rounded-b-3xl shrink-0">
        <div className="space-y-2.5 mb-5">
          <div className="flex justify-between text-sm text-stone-500">
            <span>ราคาห้องพัก × {nights} คืน</span>
            <span className="font-medium">฿{subtotal.toLocaleString()}</span>
          </div>
          <div className="my-3 border-b border-stone-200 border-dashed"></div>
          <div className="flex items-end justify-between">
            <span className="text-sm font-bold text-forest-900">ยอดชำระสุทธิ</span>
            <span className="text-[26px] font-extrabold tracking-tight text-forest-900 leading-none">฿{subtotal.toLocaleString()}</span>
          </div>
        </div>

        {hasUnavailableItems && (
          <div className="mb-4 flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-sm">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-red-600"><AlertTriangle size={14} className="shrink-0" />กรุณาลบห้องที่ไม่ว่างออก</p>
            <button type="button" onClick={handleRemoveUnavailable} className="self-start text-[11px] font-bold text-red-700 underline hover:text-red-900">
              ลบออกทั้งหมด
            </button>
          </div>
        )}
        
        <div className="mb-4 flex items-start gap-2.5 rounded-xl bg-stone-100/70 p-3 text-[11px] leading-relaxed text-stone-500 ring-1 ring-stone-200/50">
          <Clock size={14} className="mt-0.5 shrink-0 text-stone-400" />
          <p>
            <span className="font-bold text-stone-600">นโยบาย:</span> เช็คอิน 14:00 - 23:00 น. | เช็คเอาต์ ก่อน 12:00 น.
          </p>
        </div>
        
        <button 
          onClick={handleConfirmBooking} 
          disabled={cartItems.length === 0 || isBooking || hasUnavailableItems || overCapacity || !allChildAgesSet} 
          className="relative w-full overflow-hidden rounded-xl bg-forest-900 py-4 text-sm font-bold text-white shadow-lg shadow-forest-900/20 transition-all hover:bg-forest-800 hover:shadow-xl hover:shadow-forest-900/30 active:scale-[0.98] disabled:bg-stone-300 disabled:shadow-none"
        >
          {isBooking ? 'กำลังสร้างการจอง...' : 'ยืนยันการจอง'}
        </button>

        {showLoginNotice && !isAuthenticated && cartItems.length > 0 && (
          <div className="mt-3 flex flex-col items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center shadow-sm">
            <p className="text-[11px] font-semibold text-amber-700">ต้องเข้าสู่ระบบก่อนจึงจะยืนยันการจองได้</p>
            <button
              type="button"
              onClick={() => router.push(buildLoginRedirectUrl(pathname, searchParams.toString()))}
              className="w-full rounded-lg bg-amber-500 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-amber-600"
            >
              เข้าสู่ระบบ
            </button>
          </div>
        )}
      </div>
    </div>

    {/* MOBILE STICKY PRICE BAR */}
    {cartItems.length > 0 && (
      <div
        className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-stone-200/80 bg-white/95 px-5 py-4 shadow-[0_-8px_30px_rgba(18,60,48,0.12)] backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-stone-400">ยอดชำระสุทธิ</p>
          <p className="truncate text-xl font-extrabold tracking-tight text-forest-900">฿{subtotal.toLocaleString()}</p>
        </div>
        <button
          type="button"
          onClick={() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="shrink-0 rounded-xl bg-forest-900 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-forest-900/20 transition-all hover:bg-forest-800 active:scale-95"
        >
          ดูสรุปการจอง
        </button>
      </div>
    )}

    {/* CONFIRM DIALOG: ล้างตะกร้า */}
    {showClearConfirm && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-forest-950/40 p-4 backdrop-blur-sm" onClick={() => setShowClearConfirm(false)}>
        <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-500 ring-4 ring-red-50/50">
            <Trash2 size={22} />
          </div>
          <h3 className="font-display text-center text-lg font-bold text-forest-900">ล้างรายการจองทั้งหมด?</h3>
          <p className="mt-2 text-center text-[13px] leading-relaxed text-stone-500">
            ห้องพักที่เลือกไว้จะถูกลบออก และไม่สามารถกู้คืนได้
          </p>
          <div className="mt-6 flex gap-3">
            <button type="button" onClick={() => setShowClearConfirm(false)} className="flex-1 rounded-xl border border-stone-200 py-3 text-sm font-bold text-stone-600 transition-colors hover:bg-stone-50">
              ยกเลิก
            </button>
            <button type="button" onClick={confirmClearAll} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white shadow-sm shadow-red-600/20 transition-all hover:bg-red-700">
              ล้างทั้งหมด
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
