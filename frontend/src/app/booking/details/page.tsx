'use client';

import React, { Suspense, useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, User, Clock, AlertCircle, ShieldCheck, ChevronDown, ChevronRight, Tag, Users, X, Ticket, Check, Sparkles, Sailboat } from 'lucide-react';
import { useRoomCart, setRoomCart } from '@/lib/room-cart-store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useAuth } from '@/hooks/useAuth';
import api, { getApiErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import { PromoNotice, usePromoNotice } from '@/components/promotions/PromoNotice';
import { formatThaiDate, nightsBetween, addDaysISO } from '@/lib/date';
import { eligibleRoomPromotion, resolveCheckoutDetails, roomPromotionDiscount, roomPromotionReasons, roomPromotionLabel, selectedChildExtraBeds } from '@/lib/booking-checkout';
import type { CheckoutPromotion } from '@/lib/booking-checkout';
import { roomOccupancy, type RoomCartItem } from '@/lib/room-cart';
import { useGuestAgePolicy } from '@/hooks/useInfantAgePolicy';
import BookingGuests, { type BookingGuestSelection } from '@/components/booking/BookingGuests';

type Promotion = CheckoutPromotion;

// สร้างป้ายชื่อห้องพักสำหรับแสดงตัวเลือกเตียงเสริม
function extraBedRoomLabel(room: RoomCartItem): string {
  const typeName = room.type_name || room.room_name;
  return room.room_number ? `ห้อง ${room.room_number} (${typeName})` : typeName;
}

const ARRIVAL_TIME_OPTIONS = [
  { value: "14:00", label: "14:00 น. - 15:00 น." },
  { value: "15:00", label: "15:00 น. - 16:00 น." },
  { value: "16:00", label: "16:00 น. - 17:00 น." },
  { value: "17:00", label: "17:00 น. - 18:00 น." },
  { value: "18:00", label: "18:00 น. - 19:00 น." },
  { value: "19:00", label: "หลัง 19:00 น." },
];

// เมนูดรอปดาวน์แบบกำหนดเองสำหรับเลือกเวลาเข้าพัก
function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "เลือก...",
  className = "",
  size = "md",
}: {
  options: { value: string | number; label: string; disabled?: boolean }[];
  value: string | number;
  onChange: (val: any) => void;
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(
    (opt) => String(opt.value) === String(value),
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isSmall = size === "sm";

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        className={`w-full flex items-center justify-between gap-2 border border-stone-200 rounded-xl transition-all focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs ${
          isSmall
            ? "px-3 py-2 bg-white text-xs font-bold text-forest-800"
            : "px-4 py-3 bg-stone-50 hover:bg-stone-100/70 text-sm font-medium text-forest-900"
        }`}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={isSmall ? 14 : 16}
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-forest-800" : "text-stone-400"
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full bg-white border border-stone-200 rounded-xl shadow-lg z-50 overflow-hidden py-1 max-h-56 overflow-y-auto animate-in fade-in duration-150">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onClick={(e) => {
                  e.preventDefault();
                  if (!opt.disabled) {
                    onChange(opt.value);
                    setIsOpen(false);
                  }
                }}
                className={`w-full text-left transition-colors flex items-center justify-between ${
                  isSmall ? "px-3 py-2 text-xs font-medium" : "px-4 py-2.5 text-sm font-medium"
                } ${
                  isSelected
                    ? "bg-forest-50 text-forest-900 font-bold"
                    : opt.disabled
                    ? "text-stone-300 cursor-not-allowed bg-stone-50/40"
                    : "text-charcoal-700 hover:bg-cream-50 hover:text-charcoal-900"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-forest-800 shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// หน้ารายละเอียดการจองห้องพักพร้อม Suspense boundary
export default function BookingDetailsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-800"></div></div>}>
      <BookingDetailsContent />
    </Suspense>
  );
}

// เนื้อหาหลักสำหรับกรอกข้อมูลผู้เข้าพัก เลือกโปรโมชั่น และยืนยันการจองห้องพัก
function BookingDetailsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const cart = useRoomCart();
  const { ready } = useAuthGuard();
  const { user } = useAuth();
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  
  const [arrivalTime, setArrivalTime] = useState('14:00');
  
  const [extraBed, setExtraBed] = useState(false);
  const [extraBedRoomIds, setExtraBedRoomIds] = useState<number[]>([]);
  const [childBedRoomIds, setChildBedRoomIds] = useState<Record<number, number>>({});
  const [lowerFloor, setLowerFloor] = useState(false);
  const [withKids, setWithKids] = useState(false);
  const [otherRequest, setOtherRequest] = useState('');

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedPromos, setSelectedPromos] = useState<Record<number, number | null>>({});
  const { notice: promoNotice, showNotice: showPromoNotice } = usePromoNotice();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [childBeds, setChildBeds] = useState<Record<number, number>>({});
  const [guestSelection, setGuestSelection] = useState<BookingGuestSelection | null>(null);
  const [showGuestErrors, setShowGuestErrors] = useState(false);
  const [activePromoDrawerTypeId, setActivePromoDrawerTypeId] = useState<number | null>(null);
  const [manualCodeInput, setManualCodeInput] = useState('');
  const policy = useGuestAgePolicy();

  useEffect(() => {
    if (activePromoDrawerTypeId === null) return;
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Element | null;
      if (target && !target.closest('[data-promo-dropdown]')) {
        setActivePromoDrawerTypeId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activePromoDrawerTypeId]);

  const initialDetails = resolveCheckoutDetails(new URLSearchParams(searchParams.toString()), cart);
  const { checkIn, checkOut } = initialDetails;
  const guests = guestSelection ?? {
    adults: initialDetails.adults,
    childAges: Array.from({ length: initialDetails.children }, (_, index) => {
      const age = initialDetails.childAges[index];
      return Number.isInteger(age) && age >= 0 && age <= policy.childMaxAge ? age : null;
    }),
  };
  const adults = guests.adults;
  const childrenCount = guests.childAges.length;
  const childAges = guests.childAges.map(age => age ?? NaN);
  const childAgesStr = guests.childAges.map(age => age ?? '').join(',');
  const nights = nightsBetween(checkIn, checkOut);
  const eligibleChildBeds = childAges.flatMap((age, index) => Number.isInteger(age) && age >= policy.infantAge && age <= policy.childMaxAge ? [{ index, age }] : []);
  const selectedBeds = selectedChildExtraBeds(childAges, childBeds, policy.infantAge, policy.childMaxAge);
  const chargeableKidsCount = selectedBeds.length;
  const hasOnsiteCharges = extraBed || chargeableKidsCount > 0;

  const cartItems = cart?.items.filter((item): item is RoomCartItem & { room_id: number } => typeof item.room_id === 'number') ?? [];
  const selectedExtraBedRooms = extraBed
    ? cartItems.filter(room => cartItems.length === 1 || extraBedRoomIds.includes(room.room_id))
    : [];
  const selectedBedsWithRooms = selectedBeds.map(bed => ({
    ...bed,
    room: cartItems.find(room => room.room_id === childBedRoomIds[bed.index])
      ?? (cartItems.length === 1 ? cartItems[0] : undefined),
  }));
  const childBedDescription = selectedBedsWithRooms.map(bed =>
    `คนที่ ${bed.index + 1} อายุ ${bed.age} ปี${bed.room ? ` — ${extraBedRoomLabel(bed.room)}` : ' — ยังไม่ได้เลือกห้อง'}`
  ).join('; ');

  const totalCapacity = cartItems.reduce((sum, item) => sum + Number(item.capacity || 0), 0);
  const occupancy = roomOccupancy({ adults, children: childrenCount, childAges, infantAge: policy.infantAge, capacity: totalCapacity, roomCount: cartItems.length });
  const totalGuests = occupancy.occupyingGuests;
  const hasIncompleteGuestAges = guests.childAges.some(age => age === null);
  const isCapacityInsufficient = cartItems.length > 0 && !hasIncompleteGuestAges && !occupancy.fits;
  const missingCapacity = occupancy.missingCapacity;

  // อัปเดตจำนวนผู้เข้าพักและอายุเด็กพร้อมซิงก์กับ URL และตะกร้า
  const handleGuestSelection = (next: BookingGuestSelection): void => {
    setGuestSelection(next);
    setShowGuestErrors(false);
    if (JSON.stringify(next.childAges) !== JSON.stringify(guests.childAges)) {
      setChildBeds({});
      setChildBedRoomIds({});
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('adults', String(next.adults));
    params.set('children', String(next.childAges.length));
    params.set('child_ages', next.childAges.map(age => age ?? '').join(','));
    router.replace(`/booking/details?${params.toString()}`, { scroll: false });
    if (cart && next.childAges.every((age): age is number => age !== null)) {
      setRoomCart({ ...cart, adults: next.adults, children: next.childAges.length, child_ages: next.childAges });
    }
  };

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    api.get('/promotions/active').then(res => {
      const activePromos = res.data?.data || [];
      setPromotions(activePromos);
    }).catch(err => console.error(err));
  }, []);

  const groups = useMemo(() => {
    const acc: Record<number, { typeId: number, typeName: string, pricePerNight: number, rooms: RoomCartItem[], totalBasePrice: number }> = {};
    cartItems.forEach(item => {
      if (!acc[item.room_type_id]) {
        acc[item.room_type_id] = {
          typeId: item.room_type_id,
          typeName: item.type_name || item.room_name.replace(/\s*\(ห้อง.*\)/, '').trim(),
          pricePerNight: item.price_per_night,
          rooms: [],
          totalBasePrice: 0
        };
      }
      acc[item.room_type_id].rooms.push(item);
      acc[item.room_type_id].totalBasePrice += item.price_per_night * nights;
    });
    return Object.values(acc);
  }, [cartItems, nights]);

  if (!ready) return <div className="min-h-screen bg-stone-50 flex items-center justify-center">กำลังโหลด...</div>;

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 px-4 pt-24 pb-12 flex items-center justify-center">
         <div className="text-center bg-white p-12 rounded-3xl shadow-xs border border-stone-100 max-w-md">
           <AlertCircle className="w-12 h-12 text-stone-300 mx-auto mb-4" />
           <h2 className="text-xl font-bold text-stone-900 mb-2">ไม่พบรายการห้องพัก</h2>
           <p className="text-stone-500 mb-6 text-sm">กรุณากลับไปเลือกห้องพักที่คุณต้องการจองใหม่อีกครั้ง</p>
           <button onClick={() => router.push('/rooms')} className="bg-forest-900 text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-forest-800 transition-colors">
             ดูห้องพักทั้งหมด
           </button>
         </div>
      </div>
    );
  }

  // เลือกหรือยกเลิกโปรโมชั่นสำหรับประเภทห้องพักที่ระบุ
  const handleSelectPromo = (typeId: number, promoId: number | null): void => {
    if (promoId !== null && Object.entries(selectedPromos).some(([key, value]) => Number(key) !== typeId && value === promoId)) {
      showPromoNotice('error', 'โปรโมชั่นนี้ใช้ได้กับประเภทห้องเดียว กรุณาเลือกโปรโมชั่นอื่น');
      return;
    }
    setSelectedPromos(prev => ({ ...prev, [typeId]: promoId }));
  };

  // คำนวณยอดส่วนลดของโปรโมชั่นสำหรับประเภทห้องพัก
  const calculateDiscount = (typeId: number, basePrice: number): number => {
    const promoId = selectedPromos[typeId];
    if (!promoId) return 0;
    const promo = promotions.find(p => p.id === promoId);
    if (!promo) return 0;
    
    return roomPromotionDiscount(promo, basePrice);
  };

  const grandTotalBase = groups.reduce((sum, g) => sum + g.totalBasePrice, 0);
  const totalDiscount = groups.reduce((sum, g) => sum + calculateDiscount(g.typeId, g.totalBasePrice), 0);
  const netTotal = grandTotalBase - totalDiscount;

  // ตรวจสอบความครบถ้วนของข้อมูลและส่งคำขอสร้างการจองห้องพักไปยังระบบ
  const handleSubmit = async (): Promise<void> => {
    if (!checkIn || !checkOut || !Number.isFinite(nights) || nights < 1 || (cart && (cart.check_in !== checkIn || cart.check_out !== checkOut))) {
      toast.error('กรุณาเลือกวันที่เข้าพักและออกให้ตรงกับรายการในตะกร้า');
      return;
    }
    if (childAges.length !== childrenCount || childAges.some(age => !Number.isInteger(age) || age < 0 || age > policy.childMaxAge)) {
      setShowGuestErrors(true);
      document.getElementById('booking-guests-heading')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast.error(`กรุณาระบุอายุเด็กให้ครบ (${policy.childHint.replace('อายุ ', '')}) ${policy.adultHint}ให้เลือกเป็นผู้ใหญ่`);
      return;
    }
    if (isCapacityInsufficient) {
      toast.error(`ยังขาดที่พักสำหรับ ${missingCapacity} ท่าน กรุณากลับไปเลือกห้องพักเพิ่ม (เด็ก 6–11 ปีพักเพิ่มได้ไม่เกิน 1 คนต่อห้อง)`);
      return;
    }
    for (const group of groups) {
      const promoId = selectedPromos[group.typeId];
      const promo = promotions.find(item => item.id === promoId);
      if (promoId && (!promo || !eligibleRoomPromotion(promo, group.totalBasePrice, nights, group.typeId, group.rooms.length))) {
        showPromoNotice('error', 'โปรโมชั่นที่เลือกไม่ตรงกับเงื่อนไข กรุณาเลือกใหม่หรือไม่ใช้โปรโมชั่น');
        return;
      }
    }
    if (!firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim()) {
      toast.error('กรุณากรอกข้อมูลผู้ติดต่อให้ครบถ้วน');
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast.error('กรุณากรอกอีเมลให้ถูกต้อง');
      return;
    }
    const normalizedPhone = phone.trim().replace(/[\s-]/g, '');
    if (!/^0\d{8,9}$/.test(normalizedPhone)) {
      toast.error('กรุณากรอกเบอร์โทรศัพท์ให้ถูกต้อง (9–10 หลัก)');
      return;
    }
    if (extraBed && selectedExtraBedRooms.length === 0) {
      toast.error('กรุณาเลือกห้องที่ต้องการเตียงเสริมอย่างน้อย 1 ห้อง');
      return;
    }
    if (selectedBedsWithRooms.some(bed => !bed.room)) {
      toast.error('กรุณาเลือกห้องสำหรับเตียงเสริมเด็กที่เลือกให้ครบทุกคน');
      return;
    }
    
    setIsSubmitting(true);
    
    const requests = [];
    if (extraBed) {
      requests.push(`ขอเตียงเสริม: ${selectedExtraBedRooms.map(extraBedRoomLabel).join('; ')} (ชำระหน้าเคาน์เตอร์)`);
    }
    if (chargeableKidsCount > 0) {
      const chargeText = policy.childChargePricePerNight
        ? `ขอเตียงเสริมสำหรับเด็ก ${chargeableKidsCount} คน (${childBedDescription}) ฿${policy.childChargePricePerNight}/คน/คืน รวม ฿${policy.childChargePricePerNight * chargeableKidsCount * nights} (${nights} คืน ชำระหน้าเคาน์เตอร์)`
        : `ขอเตียงเสริมสำหรับเด็ก ${chargeableKidsCount} คน (${childBedDescription}) ชำระหน้าเคาน์เตอร์ตามนโยบายรีสอร์ต`;
      requests.push(chargeText);
    }
    if (otherRequest.trim()) requests.push(otherRequest.trim());
    
    const specialReqStr = requests.join(', ');

    const payloadItems = cartItems.map(item => ({
      room_type_id: item.room_type_id,
      quantity: 1,
      room_id: item.room_id,
      promotion_id: selectedPromos[item.room_type_id] || null
    }));

    try {
      const res = await api.post('/bookings/room', {
        check_in_date: checkIn,
        check_out_date: checkOut,
        adults: adults,
        children: childrenCount,
        child_ages: childAges,
        special_requests: specialReqStr,
        arrival_time: arrivalTime,
        items: payloadItems,
        guest_name: `${firstName.trim()} ${lastName.trim()}`,
        guest_phone: normalizedPhone,
        guest_email: normalizedEmail
      });
      
      setRoomCart(null);
      const bId = res.data?.data?.room_booking_id || res.data?.data?.id || res.data?.data?.booking_id || res.data?.room_booking_id || res.data?.id;
      if (!bId) {
        toast.error("ไม่สามารถระบุรหัสการจองได้ (Booking ID is undefined)");
        setIsSubmitting(false);
        return;
      }
      const grantedTickets = Number(res.data?.data?.boat_ticket_summary?.total_tickets ?? res.data?.data?.boat_tickets_granted ?? 0);
      toast.success(grantedTickets > 0 ? `บันทึกข้อมูลการจองแล้ว ได้รับสิทธิ์เรือ ${grantedTickets} สิทธิ์ กรุณาดำเนินการชำระเงิน` : 'บันทึกข้อมูลการจองแล้ว กรุณาดำเนินการชำระเงิน');
      router.push(`/payment?booking_type=room&booking_id=${bId}`);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'เกิดข้อผิดพลาดในการสร้างการจอง'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50/50 pb-28 pt-24">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6">
          <button onClick={() => router.back()} className="inline-flex items-center gap-2 text-sm font-bold text-forest-800 hover:text-forest-950 transition-colors">
            <ArrowLeft size={16} /> ย้อนกลับไปแก้ไขการเลือกห้องพัก
          </button>
        </div>
        
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            <h1 className="text-3xl font-extrabold text-forest-900 tracking-tight">รายละเอียดการจอง</h1>
            
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs">
              <h2 className="text-lg font-bold text-forest-900 mb-6 flex items-center gap-2">
                <User className="text-forest-600" size={20} /> ข้อมูลผู้เข้าพักหลัก
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">ชื่อ (ภาษาไทย/อังกฤษ) <span className="text-red-500">*</span></label>
                  <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:border-forest-500 focus:ring-forest-500" placeholder="ชื่อ" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">นามสกุล <span className="text-red-500">*</span></label>
                  <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:border-forest-500 focus:ring-forest-500" placeholder="นามสกุล" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">อีเมล <span className="text-red-500">*</span></label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:border-forest-500 focus:ring-forest-500" placeholder="อีเมลสำหรับรับใบยืนยัน" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">เบอร์โทรศัพท์ <span className="text-red-500">*</span></label>
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:border-forest-500 focus:ring-forest-500" placeholder="08X-XXX-XXXX" />
                </div>
              </div>
            </section>
            
            <BookingGuests
              adults={adults}
              childAges={guests.childAges}
              capacities={cartItems.map(item => Number(item.capacity))}
              adultHint={policy.adultHint}
              childMaxAge={policy.childMaxAge}
              showAgeErrors={showGuestErrors}
              onChange={handleGuestSelection}
            />

            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs">
              <h2 className="text-lg font-bold text-forest-900 mb-2 flex items-center gap-2">
                <Clock className="text-forest-600" size={20} /> เวลาที่ท่านจะเดินทางมาถึง
              </h2>
              <p className="text-sm text-stone-500 mb-6">ห้องพักพร้อมให้เช็คอินตั้งแต่เวลา 14:00 น. เป็นต้นไป หากต้องการเช็คอินหลัง 18:00 น. กรุณาแจ้งให้เราทราบ</p>
              
              <div className="max-w-xs space-y-1.5">
                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">ระบุเวลาโดยประมาณ</label>
                <CustomSelect
                  value={arrivalTime}
                  onChange={(val) => setArrivalTime(String(val))}
                  options={ARRIVAL_TIME_OPTIONS}
                />
              </div>
            </section>
            
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-xs">
              <h2 className="text-lg font-bold text-forest-900 mb-2 flex items-center gap-2">
                <AlertCircle className="text-forest-600" size={20} /> ตัวเลือกอื่นๆ สำหรับเพิ่มเติมในการจอง
              </h2>
              <p className="text-sm text-stone-500 mb-5">โปรดทราบว่าคำขอพิเศษขึ้นอยู่กับความพร้อมให้บริการ และอาจมีค่าใช้จ่ายเพิ่มเติม</p>
              
              <div className="space-y-3 mb-6">
                {eligibleChildBeds.length > 0 && <fieldset className="space-y-3">
                  <legend className="mb-2 text-sm font-bold text-forest-900">เตียงเสริมสำหรับเด็ก {policy.infantAge}–{policy.childMaxAge} ปี (เลือกได้รายคน)</legend>
                  <p className="text-xs text-stone-500">เด็ก 6–11 ปีพักเกินความจุหลักได้ไม่เกิน 1 คนต่อห้อง และใช้เตียงเดิมได้ คิดค่าเตียงเสริมเฉพาะคนที่ติ๊ก และชำระหน้าเคาน์เตอร์ อายุ 12 ปีขึ้นไปนับเป็นผู้ใหญ่ตามความจุหลัก</p>
                  {eligibleChildBeds.map(({ index, age }) => <div key={`${index}-${age}`} className="rounded-2xl border border-stone-200 p-3.5">
                    <label className="flex cursor-pointer items-start gap-3">
                    <input type="checkbox" checked={childBeds[index] === age} onChange={event => setChildBeds(current => {
                      const next = { ...current };
                      if (event.target.checked) next[index] = age;
                      else delete next[index];
                      return next;
                    })} className="mt-0.5 h-5 w-5 shrink-0 accent-forest-800" />
                    <span className="min-w-0 text-sm font-semibold text-forest-900">เตียงเสริมสำหรับเด็กคนที่ {index + 1} (อายุ {age} ปี)
                      <span className="mt-1 block text-xs font-normal text-stone-500">{policy.childChargePricePerNight != null ? `${policy.childChargePricePerNight.toLocaleString()} บาท/คืน · ${(policy.childChargePricePerNight * nights).toLocaleString()} บาทสำหรับ ${nights} คืน` : 'ค่าบริการตามนโยบายรีสอร์ต'} · ชำระหน้าเคาน์เตอร์</span>
                    </span>
                    </label>
                    {childBeds[index] === age && <div className="mt-3 space-y-1.5 pl-8">
                      <label htmlFor={`child-bed-room-${index}`} className="block text-xs font-bold text-forest-900">ห้องสำหรับเตียงเสริมเด็กคนที่ {index + 1}</label>
                      <select
                        id={`child-bed-room-${index}`}
                        value={selectedBedsWithRooms.find(bed => bed.index === index)?.room?.room_id ?? ''}
                        onChange={event => {
                          const roomId = Number(event.target.value);
                          setChildBedRoomIds(current => ({ ...current, [index]: roomId }));
                        }}
                        className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm text-forest-900 focus:border-forest-500 focus:ring-forest-500"
                      >
                        <option value="" disabled>เลือกห้องที่จะวางเตียงเสริม</option>
                        {cartItems.map(room => <option key={room.room_id} value={room.room_id}>{extraBedRoomLabel(room)}</option>)}
                      </select>
                    </div>}
                  </div>)}
                </fieldset>}
                <label className={`flex items-start gap-3 p-3.5 border rounded-2xl cursor-pointer transition-all ${extraBed ? 'border-forest-700 bg-forest-50/40 shadow-xs' : 'border-stone-200 hover:bg-stone-50'}`}>
                  <input type="checkbox" checked={extraBed} onChange={e => {
                    setExtraBed(e.target.checked);
                    if (!e.target.checked) setExtraBedRoomIds([]);
                  }} className="mt-0.5 w-5 h-5 text-forest-700 rounded border-stone-300 focus:ring-forest-500 cursor-pointer" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-stone-900">{eligibleChildBeds.length > 0 ? 'ขอเตียงเสริมอื่น ๆ (นอกเหนือจากเตียงเด็กที่เลือก)' : 'ขอเตียงเสริม'}</span>
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">{policy.childChargePricePerNight ? `+฿${policy.childChargePricePerNight.toLocaleString()}/คืน ชำระหน้าเคาน์เตอร์` : 'ชำระหน้าเคาน์เตอร์'}</span>
                    </div>
                  </div>
                </label>
                {extraBed && <fieldset className="space-y-2 rounded-2xl border border-forest-200 bg-forest-50/30 p-4">
                  <legend className="px-1 text-sm font-bold text-forest-900">เลือกห้องที่ต้องการเตียงเสริม</legend>
                  <p className="text-xs text-stone-500">เลือกได้มากกว่า 1 ห้อง คำขอขึ้นอยู่กับความพร้อมให้บริการ และชำระหน้าเคาน์เตอร์</p>
                  {cartItems.map(room => <label key={room.room_id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 bg-white p-3">
                    <input
                      type="checkbox"
                      checked={selectedExtraBedRooms.some(selected => selected.room_id === room.room_id)}
                      disabled={cartItems.length === 1}
                      onChange={event => {
                        const checked = event.target.checked;
                        setExtraBedRoomIds(current => checked
                          ? [...current.filter(id => id !== room.room_id), room.room_id]
                          : current.filter(id => id !== room.room_id));
                      }}
                      className="h-5 w-5 shrink-0 accent-forest-800"
                    />
                    <span className="min-w-0 text-sm font-medium text-forest-900">{extraBedRoomLabel(room)}</span>
                  </label>)}
                  {selectedExtraBedRooms.length === 0 && <p className="text-xs text-amber-800">กรุณาเลือกอย่างน้อย 1 ห้อง</p>}
                </fieldset>}
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">คำขอพิเศษอื่นๆ (ถ้ามี)</label>
                <textarea 
                  value={otherRequest} 
                  onChange={e => setOtherRequest(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm focus:border-forest-500 focus:ring-forest-500 resize-none" 
                  placeholder="พิมพ์คำขอพิเศษของคุณที่นี่..." 
                />
              </div>
            </section>
            
            <section className="bg-stone-100/80 rounded-2xl p-4 sm:p-6 text-sm text-stone-600 border border-stone-200/60">
              <details className="group">
                <summary className="cursor-pointer font-bold text-stone-900 flex items-center justify-between list-none select-none">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-forest-600" />
                    <span>แจ้งสิทธิต่างๆ ที่ควรทราบ</span>
                  </div>
                  <span className="text-xs font-semibold text-forest-700 underline group-open:hidden">ดูข้อกำหนด</span>
                  <span className="text-xs font-semibold text-stone-400 hidden group-open:inline">ย่อเก็บ</span>
                </summary>
                <ul className="space-y-2 pl-6 list-disc marker:text-stone-400 mt-3 pt-3 border-t border-stone-200/60 text-xs sm:text-sm">
                  <li>คุณสามารถยกเลิกการจองได้ฟรีก่อนถึงวันเข้าพักอย่างน้อย 7 วัน</li>
                  <li>เวลาเช็คอิน 14:00 น. และเวลาเช็คเอาต์ ก่อน 12:00 น.</li>
                  <li>ไม่อนุญาตให้นำสัตว์เลี้ยงเข้าพักเว้นแต่มีการตกลงล่วงหน้า</li>
                  <li>โปรโมชั่นและส่วนลดไม่สามารถแลกเปลี่ยนเป็นเงินสดได้</li>
                  <li>
                    <span className="font-medium text-stone-700">นโยบายเด็กและเตียงเสริม:</span>{' '}
                    {policy.infantAge > 0 ? `เด็ก 0–${policy.infantAge - 1} ปี พักฟรีโดยใช้เตียงเดิม · ` : ''}เด็ก {policy.infantAge}–{policy.childMaxAge} ปี สามารถใช้เตียงเดิมหรือเลือกเตียงเสริมได้ (ชำระหน้าเคาน์เตอร์) · อายุ 12 ปีขึ้นไปคิดราคาเท่าผู้ใหญ่
                  </li>
                </ul>
              </details>
            </section>
          </div>
          
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="bg-white rounded-3xl border border-stone-200/80 shadow-xl shadow-stone-200/40 overflow-hidden lg:sticky lg:top-[96px]">
              <div className="bg-stone-50/50 border-b border-stone-100 p-5 sm:p-6">
                <h2 className="text-lg font-extrabold text-forest-900">สรุปรายละเอียดการจอง</h2>
              </div>
              
              <div className="p-5 sm:p-6 space-y-6">
                <div className="flex items-center gap-4 pb-5 border-b border-stone-100">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">เช็คอิน</p>
                    <p className="font-bold text-forest-900 mt-0.5">{formatThaiDate(checkIn)}</p>
                    <p className="text-xs text-stone-500">ตั้งแต่ 14:00 น.</p>
                  </div>
                  <div className="h-10 border-l border-stone-200"></div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">เช็คเอาต์</p>
                    <p className="font-bold text-forest-900 mt-0.5">{formatThaiDate(checkOut)}</p>
                    <p className="text-xs text-stone-500">ก่อน 12:00 น.</p>
                  </div>
                </div>
                
                <div className="pb-5 border-b border-stone-100">
                   <p className="font-medium text-stone-700 text-sm flex flex-wrap gap-1">
                     <span>ผู้เข้าพัก:</span>
                     <span className="font-bold text-forest-900">
                       {adults} ผู้ใหญ่ 
                       {childrenCount > 0 ? `, ${childrenCount} เด็ก` : ''}
                       {childrenCount > 0 && childAgesStr && (
                         <span className="text-stone-500 font-medium text-xs ml-1">
                           (อายุ: {childAgesStr.split(',').map(a => a ? `${a} ปี` : '?').join(', ')})
                         </span>
                       )}
                     </span>
                   </p>
                   <p className="text-xs text-stone-500 mt-1">จำนวนคืน: <span className="font-bold text-forest-900">{nights} คืน</span></p>
                </div>
                
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">ห้องพักที่เลือก</h3>
                  <PromoNotice notice={promoNotice} />
                  {groups.map(group => {
                    const discount = calculateDiscount(group.typeId, group.totalBasePrice);
                    const selectedPromo = promotions.find(p => p.id === selectedPromos[group.typeId]);
                    return (
                    <div key={group.typeId} className="space-y-3 pb-4 border-b border-stone-100/80 last:border-0 last:pb-0">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-bold text-sm text-forest-900">{group.typeName}</p>
                          <div className="flex items-center gap-2 flex-wrap justify-end">
                            {discount > 0 && (
                              <span className="text-xs text-stone-400 line-through">฿{group.totalBasePrice.toLocaleString()}</span>
                            )}
                            <span className="font-bold text-sm text-forest-900 whitespace-nowrap">฿{(group.totalBasePrice - discount).toLocaleString()}</span>
                          </div>
                        </div>
                        <p className="text-xs text-stone-500 mt-0.5">
                          {group.rooms.length} ห้อง (ห้อง {group.rooms.map(r => r.room_number).join(', ')})
                        </p>
                      </div>
                      
                      {promotions.length > 0 && (() => {
                        const availablePromos = promotions
                          .filter(p => p.applies_to !== 'kayak' && (p.room_type_id == null || p.room_type_id === group.typeId))
                          .filter(p => roomPromotionReasons(p, group.totalBasePrice, nights, group.typeId, group.rooms.length).length === 0);

                        const ineligiblePromos = promotions
                          .filter(p => p.applies_to !== 'kayak' && (p.room_type_id == null || p.room_type_id === group.typeId))
                          .map(p => ({
                            promo: p,
                            reasons: roomPromotionReasons(p, group.totalBasePrice, nights, group.typeId, group.rooms.length)
                          }))
                          .filter(item => item.reasons.length > 0);

                        const isOpen = activePromoDrawerTypeId === group.typeId || (activePromoDrawerTypeId as unknown) === true;

                        return (
                          <div className="space-y-2 relative" data-promo-dropdown>
                            <div className={`rounded-xl border transition-all ${
                              isOpen
                                ? 'border-forest-600 bg-forest-50/30 ring-1 ring-forest-600/30'
                                : selectedPromo
                                ? 'border-forest-200 bg-forest-50/20'
                                : 'border-stone-200 bg-stone-50/70 hover:border-stone-300 hover:bg-stone-50'
                            }`}>
                              <button
                                type="button"
                                onClick={() => setActivePromoDrawerTypeId(isOpen ? null : group.typeId)}
                                className="w-full flex items-center justify-between gap-2.5 p-3 text-left cursor-pointer focus:outline-hidden"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                    selectedPromo ? 'bg-forest-800 text-white' : 'bg-stone-200 text-stone-600'
                                  }`}>
                                    <Tag size={13} />
                                  </div>
                                  <div className="min-w-0">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">โปรโมชั่นส่วนลด</span>
                                    {selectedPromo ? (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs font-bold text-forest-900 truncate">{selectedPromo.name}</span>
                                        {discount > 0 && (
                                          <span className="text-[10px] font-bold text-forest-700 bg-forest-100 px-1.5 py-0.2 rounded">
                                            -฿{discount.toLocaleString()}
                                          </span>
                                        )}
                                      </div>
                                    ) : (
                                      <span className="text-xs text-stone-600 font-medium">เลือกโปรโมชั่น</span>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-center gap-1 text-xs font-semibold text-stone-500 shrink-0">
                                  <span className="text-forest-800 font-bold hidden sm:inline">
                                    {selectedPromo ? 'เปลี่ยน' : 'เลือก'}
                                  </span>
                                  <ChevronDown
                                    size={15}
                                    className={`transition-transform duration-200 text-stone-400 ${isOpen ? 'rotate-180 text-forest-800' : ''}`}
                                  />
                                </div>
                              </button>
                            </div>

                            {selectedPromo && Number(selectedPromo.boat_ticket_count) > 0 && (
                              <div className="sm:hidden space-y-1 text-xs leading-relaxed text-charcoal-600 bg-forest-50/50 p-2.5 rounded-xl border border-forest-100">
                                <p className="font-semibold text-forest-800">{`โปรโมชั่นนี้ให้สิทธิ์เรือ ${Number(selectedPromo.boat_ticket_count) * group.rooms.length} สิทธิ์ (${selectedPromo.boat_ticket_count} สิทธิ์/ห้อง)`}</p>
                                <p>{selectedPromo.boat_addon_mode === 'paid' ? `มีค่าใช้จ่าย ฿${Number(selectedPromo.boat_addon_price ?? 0).toLocaleString()} ต่อเรือ 1 ลำ 1 รอบ คิดเมื่อจองและรวมในยอดค่าห้องพัก ต้องเลือกก่อนชำระค่าห้อง` : 'สิทธิ์เรือฟรี ไม่มีค่าเรือเพิ่ม'}</p>
                                <p>1 สิทธิ์ = เรือ 1 ลำ 1 รอบ · จำนวนผู้โดยสารขึ้นอยู่กับความจุของประเภทเรือที่เลือก</p>
                                {(() => {
                                  const boatValidFrom = checkIn && checkOut && nightsBetween(checkIn, checkOut) > 1 ? addDaysISO(checkIn, 1) : null;
                                  const boatValidTo = checkIn && checkOut && nightsBetween(checkIn, checkOut) > 1 ? addDaysISO(checkOut, -1) : null;
                                  return boatValidFrom && boatValidTo ? (
                                    <p>ใช้ได้ {formatThaiDate(boatValidFrom)}{boatValidFrom !== boatValidTo ? ' – ' + formatThaiDate(boatValidTo) : ''} (เฉพาะวันระหว่างเข้าพัก ไม่รวมวันเช็คอินและวันเช็คเอาต์) ตามรอบเรือที่เปิดให้จอง</p>
                                  ) : (
                                    <p>(เฉพาะวันระหว่างเข้าพัก ไม่รวมวันเช็คอินและวันเช็คเอาต์ ตามรอบเรือที่เปิดให้จอง)</p>
                                  );
                                })()}
                                <p>หลังจองห้องพักแล้ว เลือกห้องและจองรอบเรือได้จากหน้าชำระเงินหรือการจองของฉัน</p>
                              </div>
                            )}

                            {discount > 0 && (
                              <p className="text-xs font-bold text-forest-600 flex items-center gap-1 text-right justify-end">
                                <Tag size={12} /> ส่วนลด ฿{discount.toLocaleString()}
                              </p>
                            )}

                            {isOpen && (
                              <>
                                <div className="sm:hidden fixed inset-0 z-50 flex flex-col justify-end">
                                  <div
                                    onClick={() => setActivePromoDrawerTypeId(null)}
                                    className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs transition-opacity duration-200"
                                  />

                                  <div className="relative z-10 w-full max-h-[85vh] flex flex-col rounded-t-[28px] bg-cream-50 shadow-2xl border-t border-stone-200/80 animate-in slide-in-from-bottom duration-200 overflow-hidden">
                                    <div className="pt-3 pb-1 flex justify-center cursor-pointer" onClick={() => setActivePromoDrawerTypeId(null)}>
                                      <div className="h-1.5 w-12 rounded-full bg-stone-300" />
                                    </div>

                                    <div className="flex items-center justify-between border-b border-stone-100 bg-white px-5 py-3.5 shrink-0">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-forest-900 text-cream-100 flex items-center justify-center shadow-xs shrink-0">
                                          <Ticket size={18} className="text-bamboo-300" />
                                        </div>
                                        <div>
                                          <h3 className="font-pridi text-base font-bold text-forest-950 leading-tight">โปรโมชั่นรีสอร์ต</h3>
                                          <p className="text-[11px] text-stone-500">สำหรับห้อง: <span className="font-semibold text-stone-700">{group.typeName}</span></p>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setActivePromoDrawerTypeId(null)}
                                        aria-label="ปิด"
                                        className="grid h-7 w-7 place-items-center rounded-full bg-stone-100 text-stone-500 hover:bg-stone-200 hover:text-stone-800 transition-colors cursor-pointer"
                                      >
                                        <X size={15} />
                                      </button>
                                    </div>

                                    <div className="p-3 bg-stone-50/80 border-b border-stone-100 shrink-0">
                                      <div className="flex gap-2">
                                        <div className="relative flex-1">
                                          <Tag size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                                          <input
                                            type="text"
                                            value={manualCodeInput}
                                            onChange={e => setManualCodeInput(e.target.value.toUpperCase())}
                                            placeholder="กรอกชื่อโปรโมชั่น เช่น ROOMBOAT"
                                            className="w-full rounded-xl border border-stone-200 bg-white pl-9 pr-3 py-2 text-xs font-bold text-forest-900 placeholder:text-stone-400 placeholder:font-normal focus:border-forest-600 focus:ring-1 focus:ring-forest-600 uppercase tracking-wider shadow-xs"
                                          />
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const code = manualCodeInput.trim();
                                            if (!code) return;
                                            const found = promotions.find(p => p.code?.toUpperCase() === code);
                                            if (found) {
                                              const reasons = roomPromotionReasons(found, group.totalBasePrice, nights, group.typeId, group.rooms.length);
                                              if (reasons.length > 0) {
                                                toast.error(`ไม่สามารถใช้โปรโมชั่นนี้ได้: ${reasons.join(', ')}`);
                                              } else {
                                                handleSelectPromo(group.typeId, found.id);
                                                toast.success(`ใช้โปรโมชั่น ${found.name} สำเร็จ!`);
                                                setManualCodeInput('');
                                              }
                                            } else {
                                              toast.error('ไม่พบโปรโมชั่นนี้ หรือข้อมูลไม่ถูกต้อง');
                                            }
                                          }}
                                          className="rounded-xl bg-forest-900 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-forest-800 transition-all active:scale-95 cursor-pointer shrink-0"
                                        >
                                          ใช้โปรโมชั่น
                                        </button>
                                      </div>
                                    </div>

                                    <div className="p-4 space-y-3 overflow-y-auto flex-1 custom-scrollbar bg-stone-50/40">
                                      <div className="space-y-2.5">
                                        <div className="flex items-center justify-between px-1">
                                          <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                                            โปรโมชั่นที่สามารถใช้ได้
                                          </p>
                                          <span className="text-[11px] font-semibold text-forest-800 bg-forest-100/70 px-2 py-0.5 rounded-full">
                                            {availablePromos.length} รายการ
                                          </span>
                                        </div>

                                        {availablePromos.length === 0 ? (
                                          <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-5 text-center text-xs text-stone-400">
                                            ยังไม่มีโปรโมชั่นที่ร่วมรายการสำหรับห้องนี้
                                          </div>
                                        ) : (
                                          availablePromos.map(p => {
                                            const isSelected = selectedPromos[group.typeId] === p.id;
                                            const isUsedElsewhere = Object.entries(selectedPromos).some(([k, v]) => Number(k) !== group.typeId && v === p.id);
                                            const pDiscount = p.discount_type === 'percent'
                                              ? Math.min((group.totalBasePrice * Number(p.discount_value)) / 100, Number(p.max_discount ?? Infinity))
                                              : Number(p.discount_value);

                                            return (
                                              <div
                                                key={p.id}
                                                onClick={() => {
                                                  if (isUsedElsewhere) return;
                                                  handleSelectPromo(group.typeId, isSelected ? null : p.id);
                                                }}
                                                className={`group relative flex items-center justify-between p-3.5 rounded-2xl border transition-all cursor-pointer ${
                                                  isSelected
                                                    ? 'border-forest-700 bg-forest-50/30 ring-2 ring-forest-700/20 shadow-xs'
                                                    : isUsedElsewhere
                                                    ? 'border-stone-200 bg-stone-50 opacity-40 cursor-not-allowed'
                                                    : 'border-stone-200/90 bg-white hover:border-forest-300'
                                                }`}
                                              >
                                                <div className="flex-1 space-y-1 min-w-0 pr-2">
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="font-bold text-xs text-forest-950">
                                                      {p.name}
                                                    </span>
                                                    {p.code && (
                                                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-stone-100 text-stone-600 border border-stone-200">
                                                        {p.code}
                                                      </span>
                                                    )}
                                                  </div>
                                                  <p className="text-[11px] text-stone-500 leading-snug">
                                                    {roomPromotionLabel(p)}
                                                  </p>
                                                  {pDiscount > 0 && (
                                                    <p className="text-[11px] font-extrabold text-forest-700 flex items-center gap-1">
                                                      <Sparkles size={11} className="text-amber-500" />
                                                      ประหยัดทันที ฿{pDiscount.toLocaleString()}
                                                    </p>
                                                  )}
                                                  {isUsedElsewhere && (
                                                    <p className="text-[10px] text-amber-700 font-bold">ใช้กับห้องประเภทอื่นแล้ว</p>
                                                  )}
                                                </div>

                                                <div className="shrink-0 pl-1">
                                                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                                    isSelected
                                                      ? 'border-forest-700 bg-forest-700 text-white shadow-xs'
                                                      : 'border-stone-300 bg-white'
                                                  }`}>
                                                    {isSelected && <Check size={12} strokeWidth={3} />}
                                                  </div>
                                                </div>
                                              </div>
                                            );
                                          })
                                        )}
                                      </div>

                                      {ineligiblePromos.length > 0 && (
                                        <div className="space-y-2 pt-3 border-t border-stone-200/60">
                                          <div className="flex items-center justify-between px-1">
                                            <p className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">
                                              โปรโมชั่นที่ยังไม่เข้าเงื่อนไข ({ineligiblePromos.length})
                                            </p>
                                          </div>
                                          {ineligiblePromos.map(({ promo: p, reasons }) => {
                                            const isUncollected = p.is_collectible && !p.wallet_status;
                                            const displayReasons = isUncollected
                                              ? reasons.filter(r => r !== 'ต้องเก็บคูปองที่หน้าโปรโมชั่นก่อน')
                                              : reasons;

                                            return (
                                              <button
                                                key={p.id}
                                                type="button"
                                                disabled
                                                className="w-full text-left p-3.5 rounded-2xl border border-stone-200/80 bg-white opacity-70 cursor-not-allowed space-y-1 block transition-all"
                                              >
                                                <div className="flex items-center justify-between gap-2">
                                                  <span className="font-bold text-xs text-stone-800 truncate">{p.name}</span>
                                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md shrink-0 ${
                                                    isUncollected
                                                      ? 'bg-amber-50 text-amber-800 border border-amber-200/70'
                                                      : 'bg-stone-100 text-stone-500'
                                                  }`}>
                                                    {isUncollected ? 'ยังไม่เก็บ' : 'ไม่เข้าเกณฑ์'}
                                                  </span>
                                                </div>
                                                {displayReasons.length > 0 && (
                                                  <p className="text-[11px] text-stone-500 leading-snug">{displayReasons.join(' · ')}</p>
                                                )}
                                                {isUncollected && (
                                                  <a
                                                    href="/promotions"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={e => e.stopPropagation()}
                                                    className="inline-block text-[11px] font-bold text-forest-700 hover:text-forest-900 underline mt-0.5"
                                                  >
                                                    ไปเก็บโปรโมชั่น
                                                  </a>
                                                )}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>

                                    <div className="p-4 border-t border-stone-100 bg-white shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => setActivePromoDrawerTypeId(null)}
                                        className="w-full rounded-2xl bg-forest-900 py-3.5 text-sm font-bold text-white shadow-lg shadow-forest-900/20 transition-all hover:bg-forest-800 active:scale-95 flex items-center justify-center cursor-pointer"
                                      >
                                        ตกลง
                                      </button>
                                    </div>
                                  </div>
                                </div>

                                <div className="hidden sm:block static z-30 mt-1.5 max-h-96 rounded-2xl shadow-lg border border-stone-200 bg-white overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                                  <div className="p-2.5 bg-stone-50/80 border-b border-stone-100 flex gap-1.5">
                                    <input
                                      type="text"
                                      value={manualCodeInput}
                                      onChange={e => setManualCodeInput(e.target.value.toUpperCase())}
                                      placeholder="กรอกชื่อโปรโมชั่น..."
                                      className="flex-1 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-bold text-forest-900 placeholder:text-stone-400 placeholder:font-normal focus:border-forest-600 focus:outline-hidden uppercase tracking-wider"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const code = manualCodeInput.trim();
                                        if (!code) return;
                                        const found = promotions.find(p => p.code?.toUpperCase() === code);
                                        if (found) {
                                          const reasons = roomPromotionReasons(found, group.totalBasePrice, nights, group.typeId, group.rooms.length);
                                          if (reasons.length > 0) {
                                            toast.error(`ไม่สามารถใช้โปรโมชั่นนี้ได้: ${reasons.join(', ')}`);
                                          } else {
                                            handleSelectPromo(group.typeId, found.id);
                                            toast.success(`ใช้โปรโมชั่น ${found.name} สำเร็จ!`);
                                            setManualCodeInput('');
                                          }
                                        } else {
                                          toast.error('ไม่พบโปรโมชั่นนี้ หรือข้อมูลไม่ถูกต้อง');
                                        }
                                      }}
                                      className="rounded-lg bg-forest-900 hover:bg-forest-800 text-white px-3.5 py-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer shrink-0"
                                    >
                                      ใช้โปรโมชั่น
                                    </button>
                                  </div>

                                  <div className="p-2.5 space-y-2 overflow-y-auto max-h-64 custom-scrollbar">
                                    {availablePromos.length === 0 ? (
                                      <div className="p-3 text-center text-xs text-stone-400">
                                        ไม่มีโปรโมชั่นที่ร่วมรายการสำหรับห้องนี้
                                      </div>
                                    ) : (
                                      availablePromos.map(p => {
                                        const isSelected = selectedPromos[group.typeId] === p.id;
                                        const isUsedElsewhere = Object.entries(selectedPromos).some(([k, v]) => Number(k) !== group.typeId && v === p.id);
                                        const pDiscount = p.discount_type === 'percent'
                                          ? Math.min((group.totalBasePrice * Number(p.discount_value)) / 100, Number(p.max_discount ?? Infinity))
                                          : Number(p.discount_value);

                                        return (
                                          <div
                                            key={p.id}
                                            onClick={() => {
                                              if (isUsedElsewhere) return;
                                              handleSelectPromo(group.typeId, isSelected ? null : p.id);
                                            }}
                                            className={`w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                                              isSelected
                                                ? 'border-forest-600 bg-forest-50/50 shadow-2xs'
                                                : isUsedElsewhere
                                                ? 'border-stone-200 bg-stone-50/60 opacity-40 cursor-not-allowed'
                                                : 'border-stone-200/90 bg-white hover:border-forest-300 hover:bg-stone-50/50'
                                            }`}
                                          >
                                            <div className="min-w-0 flex-1">
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-bold text-xs text-forest-950">{p.name}</span>
                                                {p.code && (
                                                  <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 border border-stone-200">
                                                    {p.code}
                                                  </span>
                                                )}
                                                {pDiscount > 0 && (
                                                  <span className="text-[10px] font-bold text-forest-700 bg-forest-100 px-1.5 py-0.2 rounded">
                                                    ลด ฿{pDiscount.toLocaleString()}
                                                  </span>
                                                )}
                                              </div>
                                              <p className="text-[11px] text-stone-500 mt-0.5">{roomPromotionLabel(p)}</p>
                                              {isUsedElsewhere && (
                                                <p className="text-[10px] text-amber-700 font-semibold mt-0.5">ใช้กับห้องประเภทอื่นแล้ว</p>
                                              )}
                                            </div>

                                            <div className="shrink-0">
                                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                                                isSelected
                                                  ? 'border-forest-700 bg-forest-700 text-white'
                                                  : 'border-stone-300 bg-white'
                                              }`}>
                                                {isSelected && <Check size={10} strokeWidth={3} />}
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })
                                    )}

                                    {ineligiblePromos.length > 0 && (
                                      <div className="space-y-1.5 pt-2 border-t border-stone-100">
                                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">
                                            โปรโมชั่นที่ยังไม่เข้าเงื่อนไข ({ineligiblePromos.length})
                                          </p>
                                        {ineligiblePromos.map(({ promo: p, reasons }) => {
                                          const isUncollected = p.is_collectible && !p.wallet_status;
                                          const displayReasons = isUncollected
                                            ? reasons.filter(r => r !== 'ต้องเก็บคูปองที่หน้าโปรโมชั่นก่อน')
                                            : reasons;

                                          return (
                                            <button
                                              key={p.id}
                                              type="button"
                                              disabled
                                              className="w-full text-left p-2 rounded-xl border border-stone-200/70 bg-stone-50/60 opacity-50 cursor-not-allowed space-y-0.5 block"
                                            >
                                              <div className="flex items-center justify-between gap-2">
                                                <span className="font-bold text-xs text-stone-600">{p.name}</span>
                                                <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
                                                  isUncollected
                                                    ? 'bg-amber-50 text-amber-800 border border-amber-200/70'
                                                    : 'bg-stone-200/60 text-stone-400'
                                                }`}>
                                                  {isUncollected ? 'ยังไม่เก็บ' : 'ไม่เข้าเกณฑ์'}
                                                </span>
                                              </div>
                                              {displayReasons.length > 0 && (
                                                <p className="text-[11px] text-stone-500">{displayReasons.join(' · ')}</p>
                                              )}
                                              {isUncollected && (
                                                <a
                                                  href="/promotions"
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  onClick={e => e.stopPropagation()}
                                                  className="inline-block text-[11px] font-bold text-forest-700 hover:text-forest-900 underline mt-0.5"
                                                >
                                                  ไปเก็บโปรโมชั่น
                                                </a>
                                              )}
                                            </button>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  )})}
                </div>

                {childrenCount > 0 && (
                  <div className="mt-4 rounded-2xl bg-stone-50 border border-stone-200/80 p-3.5 text-xs text-stone-700 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-forest-900">
                      <Users size={14} className="text-forest-700 shrink-0" />
                      <span>ข้อมูลผู้เข้าพักเด็ก ({childrenCount} คน)</span>
                    </div>
                    <p className="text-[11px] text-stone-600 leading-relaxed">
                      {policy.infantAge > 0 && `เด็กอายุต่ำกว่า ${policy.infantAge} ปี พักฟรีโดยใช้เตียงเดิม · `}
                      เด็กอายุ {policy.infantAge}–{policy.childMaxAge} ปี สามารถใช้เตียงเดิม หรือเลือกขอเตียงเสริมรายคนได้ (ชำระหน้าเคาน์เตอร์)
                    </p>
                  </div>
                )}

                {hasOnsiteCharges && (
                  <div className="mt-5 rounded-2xl border border-amber-200/90 bg-amber-50/70 p-4 text-xs text-amber-950 space-y-2.5">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900 text-sm">
                      <AlertCircle size={16} className="text-amber-750 shrink-0" />
                      <span>ชำระเพิ่มเติม ณ วันเข้าพัก (หน้าเคาน์เตอร์)</span>
                    </div>
                    <p className="text-amber-800 leading-relaxed text-[11px]">
                      ยอดโอนเงินออนไลน์ด้านล่างเป็นเฉพาะค่าห้องพัก สำหรับค่าบริการด้านล่างนี้จะชำระที่เคาน์เตอร์รีสอร์ตเมื่อเช็คอิน
                    </p>
                    <div className="space-y-2 pt-2 border-t border-amber-200/70 font-medium">
                      {chargeableKidsCount > 0 && (
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="font-bold text-amber-950">
                              เตียงเสริมสำหรับเด็กที่เลือก ({chargeableKidsCount} คน)
                            </span>
                            <p className="text-[11px] text-amber-800">
                              {childBedDescription} · ชำระหน้าเคาน์เตอร์
                            </p>
                          </div>
                          {policy.childChargePricePerNight ? (
                            <div className="text-right whitespace-nowrap">
                              <span className="font-bold text-amber-950">
                                ฿{(policy.childChargePricePerNight * chargeableKidsCount * nights).toLocaleString()}
                              </span>
                              <span className="text-[10px] block font-normal text-amber-700">
                                ({nights} คืน)
                              </span>
                            </div>
                          ) : (
                            <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md whitespace-nowrap">
                              ชำระวันเช็คอิน
                            </span>
                          )}
                        </div>
                      )}
                      {extraBed && (
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <span className="font-bold text-amber-950">ขอเตียงเสริม</span>
                            <p className="text-[11px] text-amber-800">{selectedExtraBedRooms.length > 0 ? selectedExtraBedRooms.map(extraBedRoomLabel).join(' · ') : 'ยังไม่ได้เลือกห้อง'} · ชำระค่าบริการเพิ่มเติมตอนเช็คอิน</p>
                          </div>
                          <span className="text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md whitespace-nowrap">
                            ชำระวันเช็คอิน
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="bg-forest-900 text-white p-5 sm:p-6">
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-sm text-forest-200">
                    <span>ราคาห้องพักรวม</span>
                    <span>฿{grandTotalBase.toLocaleString()}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-sm text-forest-300 font-medium">
                      <span>ส่วนลดรวม</span>
                      <span>- ฿{totalDiscount.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t border-forest-700/50 my-2 pt-2 flex justify-between items-end">
                    <div>
                      <span className="font-bold block">ยอดโอนชำระออนไลน์</span>
                      <span className="text-[11px] text-forest-300 font-normal">เฉพาะค่าห้องพัก</span>
                    </div>
                    <span className="text-2xl font-extrabold tracking-tight">฿{netTotal.toLocaleString()}</span>
                  </div>
                  {hasOnsiteCharges && (
                    <p className="text-[11px] text-amber-300/90 pt-1 font-medium">
                      * ไม่รวมค่าบริการเตียงเสริม/เด็ก ชำระที่เคาน์เตอร์วันเช็คอิน
                    </p>
                  )}
                  {isCapacityInsufficient && (
                    <div className="bg-amber-100 text-amber-950 p-3 rounded-xl text-xs font-semibold mt-2">
                      ความจุหลัก {totalCapacity} ท่าน รวมสิทธิ์เด็ก 6–11 ปีเพิ่มได้ไม่เกิน 1 คนต่อห้อง ยังไม่พอสำหรับ {totalGuests} ท่าน กรุณากลับไปเลือกห้องพักเพิ่มให้รองรับอีก {missingCapacity} ท่าน
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting || isCapacityInsufficient}
                  className="w-full bg-white text-forest-900 rounded-xl py-4 font-bold text-sm hover:bg-forest-50 transition-colors shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isCapacityInsufficient ? `กรุณาเลือกห้องเพิ่ม (ขาดอีก ${missingCapacity} ท่าน)` : isSubmitting ? 'กำลังดำเนินการ...' : 'ดำเนินการชำระเงิน'} <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-stone-200/80 bg-white/95 px-5 py-3 shadow-[0_-10px_35px_rgba(18,60,48,0.12)] backdrop-blur-xl lg:hidden" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">ยอดโอนชำระออนไลน์</span>
            <div className="flex items-baseline gap-1.5 leading-none">
              <span className="font-sans text-xl font-extrabold tracking-tight text-forest-900">
                ฿{netTotal.toLocaleString()}
              </span>
              {hasOnsiteCharges && (
                <span className="text-[10px] text-amber-700 font-medium">
                  +ชำระหน้าเคาน์เตอร์
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || isCapacityInsufficient}
            className="shrink-0 rounded-2xl bg-forest-900 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-forest-900/20 transition-all hover:bg-forest-800 active:scale-95 disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1.5"
          >
            {isCapacityInsufficient ? 'เลือกห้องเพิ่ม' : isSubmitting ? 'กำลังดำเนินการ...' : 'ดำเนินการชำระเงิน'}
            {!isCapacityInsufficient && !isSubmitting && <ChevronRight size={15} />}
          </button>
        </div>
      </div>
    </div>
    </div>
  );
}
