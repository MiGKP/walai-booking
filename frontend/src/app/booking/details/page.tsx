'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, User, Clock, AlertCircle, ShieldCheck, ChevronDown, ChevronRight, Tag } from 'lucide-react';
import { useRoomCart, setRoomCart } from '@/lib/room-cart-store';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useAuth } from '@/hooks/useAuth';
import api, { getApiErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';
import { formatThaiDate, nightsBetween } from '@/lib/date';
import { chooseRoomPromotions, eligibleRoomPromotion, resolveCheckoutDetails, roomPromotionDiscount, roomPromotionReasons, roomPromotionLabel } from '@/lib/booking-checkout';
import type { CheckoutPromotion } from '@/lib/booking-checkout';
import type { RoomCartItem } from '@/lib/room-cart';

type Promotion = CheckoutPromotion;

import { Suspense } from 'react';

export default function BookingDetailsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-stone-50 flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-forest-800"></div></div>}>
      <BookingDetailsContent />
    </Suspense>
  );
}

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
  const [lowerFloor, setLowerFloor] = useState(false);
  const [withKids, setWithKids] = useState(false);
  const [otherRequest, setOtherRequest] = useState('');

  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedPromos, setSelectedPromos] = useState<Record<number, number | null>>({}); // typeId -> promoId
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { checkIn, checkOut, adults, children: childrenCount, childAges } = resolveCheckoutDetails(new URLSearchParams(searchParams.toString()), cart);
  const childAgesStr = childAges.join(',');
  const nights = nightsBetween(checkIn, checkOut);

  const cartItems = cart?.items.filter(item => item.room_id !== null) ?? [];

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  useEffect(() => {
    // Fetch active promos
    api.get('/promotions/active').then(res => {
      const activePromos = res.data?.data || [];
      setPromotions(activePromos);
    }).catch(err => console.error(err));
  }, []);

  // Group by room_type_id
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

  // Auto-select best promo initially when promotions load
  useEffect(() => {
    if (promotions.length === 0 || groups.length === 0) return;
    
    // Only auto-select if we haven't set them yet
    if (Object.keys(selectedPromos).length > 0) return;

    setSelectedPromos(chooseRoomPromotions(groups, promotions, nights));
  }, [promotions, groups, nights]);

  if (!ready) return <div className="min-h-screen bg-stone-50 flex items-center justify-center">กำลังโหลด...</div>;

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 px-4 pt-24 pb-12 flex items-center justify-center">
         <div className="text-center bg-white p-12 rounded-3xl shadow-sm border border-stone-100 max-w-md">
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

  const handleSelectPromo = (typeId: number, promoId: number | null): void => {
    if (promoId !== null && Object.entries(selectedPromos).some(([key, value]) => Number(key) !== typeId && value === promoId)) {
      toast.error('โค้ดนี้ใช้ได้กับประเภทห้องเดียว กรุณาเลือกโค้ดอื่น');
      return;
    }
    setSelectedPromos(prev => ({ ...prev, [typeId]: promoId }));
  };

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

  const handleSubmit = async (): Promise<void> => {
    if (!checkIn || !checkOut || !Number.isFinite(nights) || nights < 1 || (cart && (cart.check_in !== checkIn || cart.check_out !== checkOut))) {
      toast.error('กรุณาเลือกวันที่เข้าพักและออกให้ตรงกับรายการในตะกร้า');
      return;
    }
    if (childAges.length !== childrenCount || childAges.some(age => !Number.isInteger(age) || age < 0 || age > 17)) {
      toast.error('กรุณาระบุอายุของเด็กแต่ละคนให้ครบ');
      return;
    }
    for (const group of groups) {
      const promoId = selectedPromos[group.typeId];
      const promo = promotions.find(item => item.id === promoId);
      if (promoId && (!promo || !eligibleRoomPromotion(promo, group.totalBasePrice, nights, group.typeId, group.rooms.length))) {
        toast.error('โปรโมชั่นที่เลือกไม่ตรงกับเงื่อนไข กรุณาเลือกใหม่หรือไม่ใช้โปรโมชั่น');
        return;
      }
    }
    if (!firstName || !lastName || !email || !phone) {
      toast.error('กรุณากรอกข้อมูลผู้ติดต่อให้ครบถ้วน');
      return;
    }
    
    setIsSubmitting(true);
    
    // Construct special request string
    const requests = [];
    if (extraBed) requests.push("ขอเตียงเสริม");
    if (lowerFloor) requests.push("ขอห้องพักชั้นล่าง");
    if (withKids) requests.push("เดินทางพร้อมเด็กเล็ก / ผู้สูงอายุ");
    if (otherRequest.trim()) requests.push(otherRequest.trim());
    
    const specialReqStr = `[Arrival: ${arrivalTime}] ` + (requests.length > 0 ? requests.join(', ') : 'ไม่มีคำขอพิเศษ');

    // Prepare items array
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
        items: payloadItems,
        guest_name: `${firstName} ${lastName}`,
        guest_phone: phone,
        guest_email: email
      });
      
      setRoomCart(null);
      const bId = res.data?.data?.room_booking_id || res.data?.data?.id || res.data?.data?.booking_id || res.data?.room_booking_id || res.data?.id;
      if (!bId) {
        toast.error("ไม่สามารถระบุรหัสการจองได้ (Booking ID is undefined)");
        setIsSubmitting(false);
        return;
      }
      const grantedTickets = Number(res.data?.data?.boat_ticket_summary?.total_tickets ?? res.data?.data?.boat_tickets_granted ?? 0);
      toast.success(grantedTickets > 0 ? `จองห้องพักสำเร็จ ได้รับสิทธิ์เรือ ${grantedTickets} สิทธิ์จากโปรโมชั่น` : 'จองห้องพักสำเร็จ');
      router.push(`/payment?booking_type=room&booking_id=${bId}`);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'เกิดข้อผิดพลาดในการสร้างการจอง'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50/50 pb-28 pt-24">
      <div className="mx-auto max-w-6xl px-4">
        <button onClick={() => router.back()} className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-stone-500 hover:text-stone-800 transition-colors">
          <ArrowLeft size={16} /> กลับไปแก้ไข
        </button>
        
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          
          {/* LEFT: FORM */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            <h1 className="text-3xl font-extrabold text-forest-900 tracking-tight">รายละเอียดการจอง</h1>
            
            {/* Contact Info */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-sm">
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
            
            {/* Arrival Time */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-sm">
              <h2 className="text-lg font-bold text-forest-900 mb-2 flex items-center gap-2">
                <Clock className="text-forest-600" size={20} /> เวลาที่ท่านจะเดินทางมาถึง
              </h2>
              <p className="text-sm text-stone-500 mb-6">ห้องพักพร้อมให้เช็คอินตั้งแต่เวลา 14:00 น. เป็นต้นไป หากต้องการเช็คอินหลัง 18:00 น. กรุณาแจ้งให้เราทราบ</p>
              
              <div className="max-w-xs space-y-1.5">
                <label className="text-xs font-bold text-stone-500 uppercase tracking-wider">ระบุเวลาโดยประมาณ</label>
                <div className="relative">
                  <select value={arrivalTime} onChange={e => setArrivalTime(e.target.value)} className="w-full appearance-none rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-medium text-forest-900 focus:border-forest-500 focus:ring-forest-500">
                    <option value="14:00">14:00 น. - 15:00 น.</option>
                    <option value="15:00">15:00 น. - 16:00 น.</option>
                    <option value="16:00">16:00 น. - 17:00 น.</option>
                    <option value="17:00">17:00 น. - 18:00 น.</option>
                    <option value="18:00">18:00 น. - 19:00 น.</option>
                    <option value="19:00">หลัง 19:00 น.</option>
                  </select>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" size={16} />
                </div>
              </div>
            </section>
            
            {/* Additional Requests */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200/80 shadow-sm">
              <h2 className="text-lg font-bold text-forest-900 mb-2 flex items-center gap-2">
                <AlertCircle className="text-forest-600" size={20} /> ตัวเลือกอื่นๆ สำหรับเพิ่มเติมในการจอง
              </h2>
              <p className="text-sm text-stone-500 mb-5">โปรดทราบว่าคำขอพิเศษขึ้นอยู่กับความพร้อมให้บริการ และอาจมีค่าใช้จ่ายเพิ่มเติม</p>
              
              <div className="space-y-3 mb-6">
                <label className="flex items-center gap-3 p-3 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors">
                  <input type="checkbox" checked={extraBed} onChange={e => setExtraBed(e.target.checked)} className="w-5 h-5 text-forest-700 rounded border-stone-300 focus:ring-forest-500" />
                  <span className="text-sm font-medium text-stone-800">ขอเตียงเสริม (อาจมีค่าใช้จ่ายเพิ่มเติม แจ้งชำระที่หน้าเคาน์เตอร์)</span>
                </label>
                <label className="flex items-center gap-3 p-3 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors">
                  <input type="checkbox" checked={lowerFloor} onChange={e => setLowerFloor(e.target.checked)} className="w-5 h-5 text-forest-700 rounded border-stone-300 focus:ring-forest-500" />
                  <span className="text-sm font-medium text-stone-800">ขอห้องพักชั้นล่าง (หากมีห้องว่าง)</span>
                </label>
                <label className="flex items-center gap-3 p-3 border border-stone-200 rounded-xl cursor-pointer hover:bg-stone-50 transition-colors">
                  <input type="checkbox" checked={withKids} onChange={e => setWithKids(e.target.checked)} className="w-5 h-5 text-forest-700 rounded border-stone-300 focus:ring-forest-500" />
                  <span className="text-sm font-medium text-stone-800">เดินทางพร้อมเด็กเล็ก / ผู้สูงอายุ</span>
                </label>
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
            
            {/* Policies */}
            <section className="bg-stone-100 rounded-3xl p-6 sm:p-8 text-sm text-stone-600">
              <h3 className="font-bold text-stone-900 mb-3 flex items-center gap-2">
                <ShieldCheck size={18} className="text-forest-600" /> แจ้งสิทธิต่างๆ ที่ควรทราบ
              </h3>
              <ul className="space-y-2 pl-6 list-disc marker:text-stone-400">
                <li>คุณสามารถยกเลิกการจองได้ฟรีก่อนถึงวันเข้าพักอย่างน้อย 7 วัน</li>
                <li>เวลาเช็คอิน 14:00 น. และเวลาเช็คเอาต์ ก่อน 12:00 น.</li>
                <li>ไม่อนุญาตให้นำสัตว์เลี้ยงเข้าพักเว้นแต่มีการตกลงล่วงหน้า</li>
                <li>โปรโมชั่นและส่วนลดไม่สามารถแลกเปลี่ยนเป็นเงินสดได้</li>
              </ul>
            </section>
            
          </div>
          
          {/* RIGHT: SUMMARY CARD */}
          <div className="lg:col-span-5 xl:col-span-4">
            <div className="bg-white rounded-3xl border border-stone-200/80 shadow-xl shadow-stone-200/40 overflow-hidden lg:sticky lg:top-[96px]">
              
              {/* Header */}
              <div className="bg-stone-50/50 border-b border-stone-100 p-5 sm:p-6">
                <h2 className="text-lg font-extrabold text-forest-900">สรุปรายละเอียดการจอง</h2>
              </div>
              
              <div className="p-5 sm:p-6 space-y-6">
                
                {/* Dates strictly read-only */}
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
                
                {/* Rooms & Promos */}
                <div className="space-y-4">
                  <h3 className="text-[11px] font-bold text-stone-400 uppercase tracking-wider">ห้องพักที่เลือก</h3>
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
                      
                      {/* Promotion Selector per Type */}
                      {promotions.length > 0 && (
                        <div className="bg-stone-50 rounded-xl p-3 border border-stone-100">
                          <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1.5 block">
                            โปรโมชั่นสำหรับประเภทนี้
                          </label>
                          <select 
                            value={selectedPromos[group.typeId] || ''} 
                            onChange={e => handleSelectPromo(group.typeId, e.target.value ? Number(e.target.value) : null)}
                            className="w-full text-xs font-bold text-forest-800 bg-white border border-stone-200 rounded-lg p-2 focus:ring-forest-500 focus:border-forest-500 truncate"
                          >
                            <option value="">ไม่ใช้โปรโมชั่น</option>
                            {promotions.map(p => {
                              if (p.applies_to === 'kayak' || (p.room_type_id != null && p.room_type_id !== group.typeId)) return null;
                              const reasons = roomPromotionReasons(p, group.totalBasePrice, nights, group.typeId, group.rooms.length);
                              return (
                                <option key={p.id} value={p.id} disabled={reasons.length > 0 || Object.entries(selectedPromos).some(([key, value]) => Number(key) !== group.typeId && value === p.id)}>
                                  {p.name} ({roomPromotionLabel(p)}){reasons.length > 0 ? ` — ${reasons.join(' / ')}` : ''}
                                </option>
                              );
                            })}
                          </select>
                          <p className="mt-2 text-xs text-charcoal-600">เลือกได้ 1 โปรโมชั่นต่อประเภทห้อง ระบบเลือกส่วนลดสูงสุดที่ใช้ได้ให้ก่อน คุณเปลี่ยนได้</p>
                          {promotions.filter(p => p.applies_to !== 'kayak' && (p.room_type_id == null || p.room_type_id === group.typeId)).map(p => {
                            const reasons = roomPromotionReasons(p, group.totalBasePrice, nights, group.typeId, group.rooms.length);
                            return reasons.length > 0 ? <p key={p.id} className="mt-2 text-xs leading-relaxed text-charcoal-600"><strong>{p.name}:</strong> {reasons.join(' · ')}{p.is_collectible && !p.wallet_status && <a href="/promotions" target="_blank" rel="noopener noreferrer" className="ml-1 underline text-forest-700">ไปเก็บคูปอง</a>}</p> : null;
                          })}
                          {selectedPromo && Number(selectedPromo.boat_ticket_count) > 0 && <div className="mt-2 space-y-1 text-xs leading-relaxed text-charcoal-600">
                            <p className="font-semibold text-forest-800">{`โปรโมชั่นนี้ให้สิทธิ์เรือ ${Number(selectedPromo.boat_ticket_count) * group.rooms.length} สิทธิ์ (${selectedPromo.boat_ticket_count} สิทธิ์/ห้อง)`}</p>
                            <p>{selectedPromo.boat_addon_mode === 'paid' ? `มีค่าใช้จ่าย ฿${Number(selectedPromo.boat_addon_price ?? 0).toLocaleString()} ต่อเรือ 1 ลำ 1 รอบ คิดเมื่อจองและรวมในยอดค่าห้องพัก ต้องเลือกก่อนชำระค่าห้อง` : 'สิทธิ์เรือฟรี ไม่มีค่าเรือเพิ่ม'}</p>
                            <p>1 สิทธิ์ = เรือ 1 ลำ 1 รอบ · จำนวนผู้โดยสารขึ้นอยู่กับความจุของประเภทเรือที่เลือก</p>
                            <p>ใช้ได้ {formatThaiDate(checkIn)} – {formatThaiDate(checkOut)} รวมวันเช็คอินและวันเช็คเอาต์ ตามรอบเรือที่เปิดให้จอง</p>
                            <p>หลังจองห้องพักแล้ว เลือกห้องและจองรอบเรือได้จากหน้าชำระเงินหรือการจองของฉัน</p>
                          </div>}
                          {discount > 0 && (
                            <p className="text-xs font-bold text-forest-600 mt-2 flex items-center gap-1 text-right justify-end">
                              <Tag size={12} /> ส่วนลด ฿{discount.toLocaleString()}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )})}
                </div>
              </div>
              
              {/* Footer Total */}
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
                    <span className="font-bold">ยอดชำระสุทธิ</span>
                    <span className="text-2xl font-extrabold tracking-tight">฿{netTotal.toLocaleString()}</span>
                  </div>
                </div>
                
                <button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting}
                  className="w-full bg-white text-forest-900 rounded-xl py-4 font-bold text-sm hover:bg-forest-50 transition-colors shadow-lg active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? 'กำลังดำเนินการ...' : 'ดำเนินการชำระเงิน'} <ChevronRight size={16} />
                </button>
              </div>
              
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
