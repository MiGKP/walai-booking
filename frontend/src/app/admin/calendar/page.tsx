'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  ChevronLeft, 
  ChevronRight, 
  Home, 
  Sailboat, 
  Calendar as CalendarIcon,
  User,
  Phone,
  Clock,
  CheckCircle2,
  Eye,
  Users,
  FileText,
  RefreshCw,
  Sparkles,
  BedDouble,
  Ship,
  LogIn,
  LogOut,
  ArrowUpRight,
  ArrowLeft
} from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/avatar';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { notify } from "@/lib/admin-notify";
import { Modal } from '@/components/admin/ui';
import { 
  formatThaiDateShort, 
  formatThaiDateLong, 
  BANGKOK_TIMEZONE 
} from '@/lib/date';

// ----------------------------------------------------------------------
// ฟังก์ชันจัดการวันที่และ Timezone +7 (เวลาไทย)
// ----------------------------------------------------------------------

const parseDateToYYYYMMDD = (dateInput: any): string => {
  if (!dateInput) return '';
  if (typeof dateInput === 'string') {
    const clean = dateInput.split('T')[0].split(' ')[0].trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  }
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const thaiDate = new Date(d.getTime() + (7 * 60 * 60 * 1000));
  const y = thaiDate.getUTCFullYear();
  const m = String(thaiDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(thaiDate.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatDateToYYYYMMDD = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const statusLabel: Record<string, string> = {
  approved: 'ยืนยันแล้ว',
  checked_in: 'เช็คอินแล้ว',
  checked_out: 'เช็คเอาต์แล้ว',
  completed: 'เสร็จสิ้น',
};

const statusClass: Record<string, string> = {
  approved: 'bg-forest-100/90 text-forest-800 border-forest-200/90',
  checked_in: 'bg-lagoon-100/90 text-lagoon-800 border-lagoon-200/90',
  checked_out: 'bg-cream-200/90 text-charcoal-700 border-cream-300/90',
  completed: 'bg-cream-200/90 text-charcoal-700 border-cream-300/90',
};

type FilterType = 'all' | 'rooms' | 'kayaks';
type StatusTabType = 'all' | 'checkins' | 'checkouts' | 'staying' | 'boats';

interface DaySummary {
  dateStr: string;
  checkins: any[];
  checkouts: any[];
  staying: any[];
  boats: any[];
  totalQueues: number;
}

export default function AdminCalendarPage() {
  const { ready } = useAuthGuard({ allowedRoles: ['admin', 'room_staff', 'boat_staff', 'staff'] });

  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [roomBookings, setRoomBookings] = useState<any[]>([]);
  const [kayakBookings, setKayakBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [selectedDayData, setSelectedDayData] = useState<DaySummary | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<StatusTabType>('checkins');
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [slipModal, setSlipModal] = useState<{ open: boolean; url: string; name: string }>({ open: false, url: '', name: '' });

  useEffect(() => {
    if (!ready) return;
    fetchBookings();
  }, [ready]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const [rb, kb] = await Promise.all([
        api.get('/bookings').catch(() => ({ data: { data: [] } })),
        api.get('/kayaks/bookings/all').catch(() => ({ data: { data: [] } })),
      ]);
      setRoomBookings(rb.data?.data || []);
      setKayakBookings(kb.data?.data || []);
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, 'ไม่สามารถโหลดข้อมูลปฏิทินได้'));
    } finally {
      setLoading(false);
    }
  };

  // ---------------- Calendar Calculation Logic ----------------
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  // ---------------- Process Daily Breakdowns ----------------
  const dailyDataMap = useMemo(() => {
    const map: Record<string, DaySummary> = {};

    const getOrCreate = (dateStr: string): DaySummary => {
      if (!map[dateStr]) {
        map[dateStr] = {
          dateStr,
          checkins: [],
          checkouts: [],
          staying: [],
          boats: [],
          totalQueues: 0
        };
      }
      return map[dateStr];
    };

    // 1. Process Rooms
    roomBookings.forEach((b) => {
      const isApprovedStatus = b.status === 'approved' || b.status === 'checked_in' || b.status === 'checked_out';
      if (!isApprovedStatus || !b.check_in) return;

      const checkInStr = parseDateToYYYYMMDD(b.check_in);
      const checkOutStr = b.check_out ? parseDateToYYYYMMDD(b.check_out) : checkInStr;
      if (!checkInStr) return;

      const bookingId = b.room_booking_id || b.id;
      const customerName = b.user_name || b.guest_name || b.customer_name || 'ลูกค้าทั่วไป';
      const roomTitle = b.room_name || b.type_name || b.room_type_name || `ห้อง #${b.room_id || b.room_number || ''}`;

      const start = new Date(checkInStr);
      const end = new Date(checkOutStr);
      const totalNights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));

      const baseInfo = {
        bookingId,
        type: 'room',
        customerName,
        customerPhone: b.user_phone || b.guest_phone || b.customer_phone || b.phone || '-',
        customerEmail: b.user_email || b.guest_email || b.customer_email || b.email || '-',
        roomTitle,
        guestCount: b.guest_count || b.adults || 2,
        totalNights,
        checkInStr,
        checkOutStr,
        specialRequest: b.special_request,
        totalPrice: b.total_price,
        paymentSlip: b.payment_slip,
        status: b.status,
        raw: b
      };

      // Check-in day
      const checkinDay = getOrCreate(checkInStr);
      checkinDay.checkins.push(baseInfo);

      // Check-out day
      if (checkOutStr && checkOutStr !== checkInStr) {
        const checkoutDay = getOrCreate(checkOutStr);
        checkoutDay.checkouts.push(baseInfo);
      }

      // In-House / Staying days (between check_in + 1 and check_out - 1)
      const curr = new Date(start);
      curr.setDate(curr.getDate() + 1);
      let nightCount = 2;

      while (curr < end) {
        const dateStr = formatDateToYYYYMMDD(curr);
        const stayDay = getOrCreate(dateStr);
        stayDay.staying.push({
          ...baseInfo,
          currentNight: nightCount,
        });

        curr.setDate(curr.getDate() + 1);
        nightCount++;
        if (nightCount > 60) break;
      }
    });

    // 2. Process Boats
    kayakBookings.forEach((b) => {
      const isApprovedStatus = b.status === 'approved' || b.status === 'completed';
      if (!isApprovedStatus || !b.booking_date) return;

      const dateStr = parseDateToYYYYMMDD(b.booking_date);
      if (!dateStr) return;

      const bookingId = b.boat_booking_id || b.kayak_booking_id || b.id;
      const customerName = b.user_name || b.guest_name || b.customer_name || 'ลูกค้าทั่วไป';
      const boatTitle = b.kayak_name || b.boat_name || 'เรือ';
      
      const timeFormatted = b.start_time 
        ? (b.end_time ? `${b.start_time.slice(0, 5)} - ${b.end_time.slice(0, 5)} น.` : `${b.start_time.slice(0, 5)} น.`)
        : '';

      const baseInfo = {
        bookingId,
        type: 'kayak',
        customerName,
        customerPhone: b.user_phone || b.guest_phone || b.customer_phone || b.phone || '-',
        customerEmail: b.user_email || b.guest_email || b.customer_email || b.email || '-',
        boatTitle,
        numPassengers: b.num_passengers || 1,
        boatCount: b.boat_count || 1,
        timeFormatted,
        dateStr,
        totalPrice: b.total_price,
        paymentSlip: b.payment_slip,
        status: b.status,
        raw: b
      };

      const boatDay = getOrCreate(dateStr);
      boatDay.boats.push(baseInfo);
    });

    // Compute total queues per day
    Object.values(map).forEach((d) => {
      d.totalQueues = d.checkins.length + d.staying.length + d.boats.length;
    });

    return map;
  }, [roomBookings, kayakBookings]);

  // สรุปสถิติประจำเดือนที่เลือก & วันนี้
  const stats = useMemo(() => {
    const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const todayStr = formatDateToYYYYMMDD(new Date());

    let checkinMonth = 0;
    let checkoutMonth = 0;
    let stayingMonth = 0;
    let boatsMonth = 0;

    let todayQueues = 0;
    let todayCheckins = 0;
    let todayCheckouts = 0;
    let todayBoats = 0;

    Object.entries(dailyDataMap).forEach(([dateStr, dayData]) => {
      if (dateStr.startsWith(currentMonthPrefix)) {
        checkinMonth += dayData.checkins.length;
        checkoutMonth += dayData.checkouts.length;
        stayingMonth += dayData.staying.length;
        boatsMonth += dayData.boats.length;
      }
      if (dateStr === todayStr) {
        todayCheckins = dayData.checkins.length;
        todayCheckouts = dayData.checkouts.length;
        todayBoats = dayData.boats.length;
        todayQueues = dayData.checkins.length + dayData.staying.length + dayData.boats.length;
      }
    });

    return {
      checkinMonth,
      checkoutMonth,
      stayingMonth,
      boatsMonth,
      todayQueues,
      todayCheckins,
      todayCheckouts,
      todayBoats
    };
  }, [dailyDataMap, year, month]);

  const thaiMonthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  // Helper เพื่อเปิด Modal วัน และเลือก Tab ที่คลิกทันที
  const handleOpenDayModal = (dayData: DaySummary, initialTab: StatusTabType) => {
    setSelectedDayData(dayData);
    setActiveModalTab(initialTab);
  };

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-16 max-w-[1600px] mx-auto">
      {/* Top Header Card (Match Checkin Page Style) */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="w-10 h-10 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-800/15">
                <CalendarIcon size={20} className="stroke-[2.2]" />
              </span>
              <div>
                <h1 className="font-display text-2xl lg:text-3xl font-bold text-forest-900 tracking-tight">
                  ปฏิทินการจอง
                </h1>
                <p className="text-xs sm:text-sm text-charcoal-500 mt-0.5">
                  ภาพรวมคิวการเข้าพัก เช็คอิน เช็คเอาต์ และกิจกรรมเรือพายประจำวัน
                </p>
              </div>
            </div>
          </div>

          {/* Quick Filters & Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Filter Segmented Control */}
            <div className="bg-cream-100/90 p-1 rounded-2xl flex items-center gap-1 border border-cream-300/80 shadow-xs">
              <button
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                  filterType === 'all'
                    ? 'bg-forest-800 text-white shadow-sm shadow-forest-800/20'
                    : 'text-charcoal-600 hover:text-forest-900 hover:bg-cream-200/50'
                }`}
              >
                ทั้งหมด
              </button>
              <button
                onClick={() => setFilterType('rooms')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                  filterType === 'rooms'
                    ? 'bg-forest-800 text-white shadow-sm shadow-forest-800/20'
                    : 'text-charcoal-600 hover:text-forest-900 hover:bg-cream-200/50'
                }`}
              >
                <Home size={13} className={filterType === 'rooms' ? 'text-white' : 'text-forest-700'} />
                <span>ห้องพัก</span>
              </button>
              <button
                onClick={() => setFilterType('kayaks')}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all active:scale-95 ${
                  filterType === 'kayaks'
                    ? 'bg-lagoon-700 text-white shadow-sm shadow-lagoon-700/20'
                    : 'text-charcoal-600 hover:text-lagoon-900 hover:bg-cream-200/50'
                }`}
              >
                <Sailboat size={13} className={filterType === 'kayaks' ? 'text-white' : 'text-lagoon-700'} />
                <span>เรือ / คายัค</span>
              </button>
            </div>

            {/* Jump to Today Button */}
            <button
              onClick={goToToday}
              className="px-3.5 py-2 bg-white hover:bg-forest-50/50 hover:border-forest-200 text-charcoal-700 rounded-2xl border border-charcoal-200/80 shadow-xs transition-all text-xs font-semibold flex items-center gap-1.5 active:scale-95"
              title="ไปยังเดือนปัจจุบัน"
            >
              <Sparkles size={14} className="text-forest-700" />
              <span>วันนี้</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={fetchBookings}
              className="px-3.5 py-2 text-charcoal-700 bg-white hover:bg-forest-50/50 hover:border-forest-200 rounded-2xl border border-charcoal-200/80 shadow-xs transition-all text-xs font-semibold flex items-center gap-1.5 active:scale-95"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-forest-700" : "text-charcoal-500"} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Stat Overview Cards (Clean KPI Summary) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Check-ins this Month */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-forest-700 uppercase tracking-wider">เช็คอินเดือนนี้</p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
                {stats.checkinMonth}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">ห้อง</span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400">เข้าพักใหม่ใน {thaiMonthNames[month]}</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-forest-50 text-forest-800 border border-forest-100 flex items-center justify-center shrink-0">
              <LogIn size={20} className="stroke-[2.2]" />
            </div>
          </div>
        </div>

        {/* Card 2: Check-outs this Month */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">เช็คเอาต์เดือนนี้</p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
                {stats.checkoutMonth}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">ห้อง</span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400">คืนห้องใน {thaiMonthNames[month]}</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-800 border border-amber-100 flex items-center justify-center shrink-0">
              <LogOut size={20} className="stroke-[2.2]" />
            </div>
          </div>
        </div>

        {/* Card 3: Kayaks this Month */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-lagoon-700 uppercase tracking-wider">กิจกรรมเรือเดือนนี้</p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
                {stats.boatsMonth}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">รอบ</span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400">จองเรือพายใน {thaiMonthNames[month]}</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-lagoon-50 text-lagoon-800 border border-lagoon-100 flex items-center justify-center shrink-0">
              <Ship size={20} className="stroke-[2.2]" />
            </div>
          </div>
        </div>

        {/* Card 4: Today's Queues */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-forest-700 uppercase tracking-wider">คิวที่ใช้งานวันนี้</p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
                {stats.todayQueues}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">รายการ</span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400">
                เข้า {stats.todayCheckins} • ออก {stats.todayCheckouts} • เรือ {stats.todayBoats}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-forest-50 text-forest-800 border border-forest-100 flex items-center justify-center shrink-0">
              <Clock size={20} className="stroke-[2.2]" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Calendar Panel */}
      <div className="bg-white rounded-3xl shadow-panel border border-cream-200/80 overflow-hidden">
        {/* Calendar Month & Navigation Header */}
        <div className="p-4 sm:p-5 border-b border-cream-200/80 bg-white flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-forest-900 tracking-tight">
              {thaiMonthNames[month]} {year + 543}
            </h2>
            <span className="hidden sm:inline-block text-xs font-medium text-charcoal-500 bg-cream-100/90 px-3 py-1 rounded-full border border-cream-300/60">
              เข้าพัก {stats.checkinMonth} ห้อง • เรือ {stats.boatsMonth} รอบ
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-cream-100/90 hover:bg-forest-50/60 hover:border-forest-200 text-charcoal-700 border border-cream-300/80 transition-all active:scale-95 shadow-xs flex items-center gap-1 text-xs font-semibold"
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft size={16} className="text-charcoal-600" />
              <span className="hidden md:inline">เดือนก่อน</span>
            </button>
            <button
              onClick={nextMonth}
              className="p-2 sm:px-3 sm:py-2 rounded-2xl bg-cream-100/90 hover:bg-forest-50/60 hover:border-forest-200 text-charcoal-700 border border-cream-300/80 transition-all active:scale-95 shadow-xs flex items-center gap-1 text-xs font-semibold"
              title="เดือนถัดไป"
            >
              <span className="hidden md:inline">เดือนถัดไป</span>
              <ChevronRight size={16} className="text-charcoal-600" />
            </button>
          </div>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-cream-200/80 bg-cream-50/70 text-center py-2.5 sm:py-3 text-xs font-bold">
          <div className="text-rose-600/90">อา.</div>
          <div className="text-charcoal-600">จ.</div>
          <div className="text-charcoal-600">อ.</div>
          <div className="text-charcoal-600">พ.</div>
          <div className="text-charcoal-600">พฤ.</div>
          <div className="text-charcoal-600">ศ.</div>
          <div className="text-forest-800">ส.</div>
        </div>

        {/* Days Cells Grid */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-cream-200/70">
          {/* Empty cells before month start */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[115px] sm:min-h-[135px] bg-cream-50/30 p-2" />
          ))}

          {/* Active days in month */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateObj = new Date(year, month, dayNum);
            const formattedDateStr = formatDateToYYYYMMDD(dateObj);
            
            const isToday = new Date().toDateString() === dateObj.toDateString();
            const dayData = dailyDataMap[formattedDateStr] || {
              dateStr: formattedDateStr,
              checkins: [],
              checkouts: [],
              staying: [],
              boats: [],
              totalQueues: 0
            };

            const showRooms = filterType === 'all' || filterType === 'rooms';
            const showBoats = filterType === 'all' || filterType === 'kayaks';

            const hasAnyActivity = (showRooms && (dayData.checkins.length > 0 || dayData.checkouts.length > 0 || dayData.staying.length > 0)) ||
                                   (showBoats && dayData.boats.length > 0);

            // คำนวณ Tab เริ่มต้นเมื่อคลิกที่พื้นหลังช่องวัน
            const defaultInitialTab: StatusTabType = 
              dayData.checkins.length > 0 ? 'checkins' :
              dayData.checkouts.length > 0 ? 'checkouts' :
              dayData.staying.length > 0 ? 'staying' :
              dayData.boats.length > 0 ? 'boats' : 'all';

            return (
              <div
                key={dayNum}
                onClick={() => {
                  if (hasAnyActivity) {
                    handleOpenDayModal(dayData, defaultInitialTab);
                  }
                }}
                className={`min-h-[115px] sm:min-h-[135px] p-2 transition-all flex flex-col justify-start relative group ${
                  hasAnyActivity ? 'cursor-pointer' : ''
                } ${
                  isToday 
                    ? 'bg-forest-50/30 ring-1 ring-inset ring-forest-600/30' 
                    : 'bg-white hover:bg-cream-50/60'
                }`}
              >
                {/* Day Header Inside Cell */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-xs font-bold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full transition-all ${
                      isToday 
                        ? 'bg-forest-800 text-white shadow-xs shadow-forest-800/20' 
                        : 'text-charcoal-700 group-hover:text-forest-900'
                    }`}
                  >
                    {dayNum}
                  </span>
                  {hasAnyActivity && (
                    <span className="text-[10px] text-forest-700/80 font-medium group-hover:text-forest-900 group-hover:underline">
                      ดูสรุปวัน
                    </span>
                  )}
                </div>

                {/* Daily Categorized Summary Badges (Clicking each badge directly opens that specific status!) */}
                <div className="space-y-1 overflow-y-auto max-h-[90px] sm:max-h-[105px] pr-0.5 scrollbar-thin">
                  {/* Check-ins Badge */}
                  {showRooms && dayData.checkins.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDayModal(dayData, 'checkins');
                      }}
                      className="w-full text-left px-2 py-1 rounded-lg text-[11px] font-semibold transition-all shadow-2xs flex items-center justify-between bg-forest-50/95 text-forest-900 border border-forest-200/90 hover:bg-forest-100 hover:border-forest-300 active:scale-95"
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <LogIn size={12} className="text-forest-700 shrink-0" />
                        <span className="truncate">เช็คอินเข้า</span>
                      </div>
                      <span className="ml-1 px-1.5 py-0.2 rounded-md bg-forest-200/70 text-forest-900 font-bold text-[10px]">
                        {dayData.checkins.length} ห้อง
                      </span>
                    </button>
                  )}

                  {/* Check-outs Badge */}
                  {showRooms && dayData.checkouts.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDayModal(dayData, 'checkouts');
                      }}
                      className="w-full text-left px-2 py-1 rounded-lg text-[11px] font-semibold transition-all shadow-2xs flex items-center justify-between bg-amber-50/95 text-amber-950 border border-amber-200/90 hover:bg-amber-100 hover:border-amber-300 active:scale-95"
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <LogOut size={12} className="text-amber-700 shrink-0" />
                        <span className="truncate">เช็คเอาต์ออก</span>
                      </div>
                      <span className="ml-1 px-1.5 py-0.2 rounded-md bg-amber-200/70 text-amber-950 font-bold text-[10px]">
                        {dayData.checkouts.length} ห้อง
                      </span>
                    </button>
                  )}

                  {/* In-House / Staying Badge */}
                  {showRooms && dayData.staying.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDayModal(dayData, 'staying');
                      }}
                      className="w-full text-left px-2 py-1 rounded-lg text-[11px] font-medium transition-all shadow-2xs flex items-center justify-between bg-cream-100/95 text-charcoal-800 border border-cream-300/80 hover:bg-cream-200 hover:border-cream-400 active:scale-95"
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <Home size={12} className="text-charcoal-600 shrink-0" />
                        <span className="truncate">พักต่อเนื่อง</span>
                      </div>
                      <span className="ml-1 px-1.5 py-0.2 rounded-md bg-cream-200 text-charcoal-800 font-semibold text-[10px]">
                        {dayData.staying.length} ห้อง
                      </span>
                    </button>
                  )}

                  {/* Boats Badge */}
                  {showBoats && dayData.boats.length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDayModal(dayData, 'boats');
                      }}
                      className="w-full text-left px-2 py-1 rounded-lg text-[11px] font-semibold transition-all shadow-2xs flex items-center justify-between bg-lagoon-50/95 text-lagoon-900 border border-lagoon-200/90 hover:bg-lagoon-100 hover:border-lagoon-300 active:scale-95"
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <Sailboat size={12} className="text-lagoon-700 shrink-0" />
                        <span className="truncate">กิจกรรมเรือ</span>
                      </div>
                      <span className="ml-1 px-1.5 py-0.2 rounded-md bg-lagoon-200/70 text-lagoon-900 font-bold text-[10px]">
                        {dayData.boats.length} รอบ
                      </span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. Modal สรุปรายการจองรายวัน (Daily Summary Breakdown with Tabs) */}
      {/* ---------------------------------------------------- */}
      <Modal 
        open={!!selectedDayData && !selectedEvent}
        title={`สรุปรายการจองประจำวัน — ${selectedDayData ? formatThaiDateLong(selectedDayData.dateStr) : ''}`}
        onClose={() => setSelectedDayData(null)}
        footer={
          <div className="w-full flex items-center justify-between gap-2">
            <Link
              href="/admin/checkin"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-forest-50 hover:bg-forest-100 text-forest-800 border border-forest-200/90 font-semibold rounded-2xl text-xs transition-colors active:scale-95 shadow-xs"
            >
              <LogIn size={14} className="text-forest-700" />
              <span>ไปยังหน้าเช็คอิน-เช็คเอาต์</span>
              <ArrowUpRight size={13} className="text-forest-600" />
            </Link>

            <button
              onClick={() => setSelectedDayData(null)}
              className="px-5 py-2.5 bg-cream-100 hover:bg-cream-200 text-charcoal-700 font-semibold rounded-2xl border border-cream-300/80 text-xs transition-colors active:scale-95"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        }
      >
        {selectedDayData && (
          <div className="space-y-4 text-xs text-charcoal-600 mt-2 max-h-[70vh] overflow-y-auto pr-1">
            {/* 4 Interactive Filter Tabs (Click to switch status instantly!) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Tab 1: Check-ins */}
              <button
                type="button"
                onClick={() => setActiveModalTab('checkins')}
                className={`rounded-2xl p-2.5 text-center transition-all border active:scale-95 ${
                  activeModalTab === 'checkins'
                    ? 'bg-forest-800 text-white border-forest-900 shadow-sm shadow-forest-800/20'
                    : 'bg-forest-50/70 hover:bg-forest-100/80 text-forest-950 border-forest-200/80'
                }`}
              >
                <span className={`text-[11px] font-semibold block ${activeModalTab === 'checkins' ? 'text-forest-100' : 'text-forest-800'}`}>
                  📥 เช็คอินเข้า
                </span>
                <span className="font-display text-xl font-bold">
                  {selectedDayData.checkins.length} <span className="text-xs font-normal">ห้อง</span>
                </span>
              </button>

              {/* Tab 2: Check-outs */}
              <button
                type="button"
                onClick={() => setActiveModalTab('checkouts')}
                className={`rounded-2xl p-2.5 text-center transition-all border active:scale-95 ${
                  activeModalTab === 'checkouts'
                    ? 'bg-amber-600 text-white border-amber-700 shadow-sm shadow-amber-600/20'
                    : 'bg-amber-50/70 hover:bg-amber-100/80 text-amber-950 border-amber-200/80'
                }`}
              >
                <span className={`text-[11px] font-semibold block ${activeModalTab === 'checkouts' ? 'text-amber-100' : 'text-amber-800'}`}>
                  📤 เช็คเอาต์ออก
                </span>
                <span className="font-display text-xl font-bold">
                  {selectedDayData.checkouts.length} <span className="text-xs font-normal">ห้อง</span>
                </span>
              </button>

              {/* Tab 3: Staying */}
              <button
                type="button"
                onClick={() => setActiveModalTab('staying')}
                className={`rounded-2xl p-2.5 text-center transition-all border active:scale-95 ${
                  activeModalTab === 'staying'
                    ? 'bg-charcoal-700 text-white border-charcoal-800 shadow-sm shadow-charcoal-700/20'
                    : 'bg-cream-100/80 hover:bg-cream-200/80 text-charcoal-900 border-cream-300/80'
                }`}
              >
                <span className={`text-[11px] font-semibold block ${activeModalTab === 'staying' ? 'text-cream-100' : 'text-charcoal-700'}`}>
                  🏠 พักต่อเนื่อง
                </span>
                <span className="font-display text-xl font-bold">
                  {selectedDayData.staying.length} <span className="text-xs font-normal">ห้อง</span>
                </span>
              </button>

              {/* Tab 4: Boats */}
              <button
                type="button"
                onClick={() => setActiveModalTab('boats')}
                className={`rounded-2xl p-2.5 text-center transition-all border active:scale-95 ${
                  activeModalTab === 'boats'
                    ? 'bg-lagoon-700 text-white border-lagoon-800 shadow-sm shadow-lagoon-700/20'
                    : 'bg-lagoon-50/70 hover:bg-lagoon-100/80 text-lagoon-950 border-lagoon-200/80'
                }`}
              >
                <span className={`text-[11px] font-semibold block ${activeModalTab === 'boats' ? 'text-lagoon-100' : 'text-lagoon-800'}`}>
                  ⛵ คิวเรือพาย
                </span>
                <span className="font-display text-xl font-bold">
                  {selectedDayData.boats.length} <span className="text-xs font-normal">รอบ</span>
                </span>
              </button>
            </div>

            {/* Tab Filter Notice / Show All Option */}
            <div className="flex items-center justify-between text-[11px] text-charcoal-400 pt-1">
              <span>กำลังแสดงเฉพาะ: <strong>
                {activeModalTab === 'checkins' ? '📥 แขกเช็คอินเข้าพัก' :
                 activeModalTab === 'checkouts' ? '📤 แขกเช็คเอาต์คืนห้อง' :
                 activeModalTab === 'staying' ? '🏠 แขกพักต่อเนื่อง' :
                 activeModalTab === 'boats' ? '⛵ คิวเรือพาย / ซับบอร์ด' : 'ทั้งหมด'}
              </strong></span>
              {activeModalTab !== 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveModalTab('all')}
                  className="text-forest-700 hover:text-forest-900 hover:underline font-medium"
                >
                  แสดงทั้งหมด ({selectedDayData.totalQueues + selectedDayData.checkouts.length} รายการ)
                </button>
              )}
            </div>

            {/* ---------------- Section 1: Check-ins ---------------- */}
            {(activeModalTab === 'all' || activeModalTab === 'checkins') && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-forest-900 font-bold text-xs pt-1">
                  <LogIn size={15} className="text-forest-700" />
                  <span>แขกเช็คอินเข้าพักวันนี้ ({selectedDayData.checkins.length} ห้อง)</span>
                </div>
                {selectedDayData.checkins.length === 0 ? (
                  <p className="text-[11px] text-charcoal-400 italic bg-cream-50/50 p-3 rounded-xl border border-cream-200/60 text-center">
                    ไม่มีรายการเช็คอินเข้าใหม่ในวันนี้
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayData.checkins.map((item, idx) => (
                      <div
                        key={`in-${idx}`}
                        className="bg-white border border-forest-200/80 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-forest-300 transition-all"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-forest-950 text-xs">{item.roomTitle}</span>
                            <span className="text-[11px] text-charcoal-500 font-mono">• ID #{item.bookingId}</span>
                            <span className="px-2 py-0.2 rounded-full bg-forest-100 text-forest-800 text-[10px] font-semibold">
                              เช็คอินเข้า
                            </span>
                          </div>
                          <div className="text-[11px] text-charcoal-600 flex items-center gap-2 flex-wrap">
                            <span>👤 {item.customerName}</span>
                            <span>📞 {item.customerPhone}</span>
                            <span className="text-forest-800 font-medium">({item.totalNights} คืน)</span>
                          </div>
                          {item.specialRequest && (
                            <div className="text-[10.5px] text-charcoal-500 bg-cream-50 px-2 py-0.5 rounded-lg inline-block">
                              📝 {item.specialRequest}
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setSelectedEvent({ ...item, raw: item.raw })}
                            className="px-2.5 py-1.5 bg-cream-50 hover:bg-cream-100 text-charcoal-700 border border-cream-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                          >
                            <Eye size={12} className="text-charcoal-500" />
                            <span>ดูข้อมูล</span>
                          </button>

                          <Link
                            href={`/admin/checkin?search=${encodeURIComponent(item.customerName || item.roomTitle)}`}
                            className="px-2.5 py-1.5 bg-forest-800 hover:bg-forest-900 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
                            title="ไปยังหน้าเช็คอินของแขกท่านนี้"
                          >
                            <span>หน้าเช็คอิน</span>
                            <ArrowUpRight size={12} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ---------------- Section 2: Check-outs ---------------- */}
            {(activeModalTab === 'all' || activeModalTab === 'checkouts') && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-amber-950 font-bold text-xs pt-1">
                  <LogOut size={15} className="text-amber-700" />
                  <span>แขกเช็คเอาต์คืนห้องวันนี้ ({selectedDayData.checkouts.length} ห้อง)</span>
                </div>
                {selectedDayData.checkouts.length === 0 ? (
                  <p className="text-[11px] text-charcoal-400 italic bg-cream-50/50 p-3 rounded-xl border border-cream-200/60 text-center">
                    ไม่มีรายการเช็คเอาต์คืนห้องในวันนี้
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayData.checkouts.map((item, idx) => (
                      <div
                        key={`out-${idx}`}
                        className="bg-white border border-amber-200/80 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-amber-300 transition-all"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-amber-950 text-xs">{item.roomTitle}</span>
                            <span className="text-[11px] text-charcoal-500 font-mono">• ID #{item.bookingId}</span>
                            <span className="px-2 py-0.2 rounded-full bg-amber-100 text-amber-900 text-[10px] font-semibold">
                              เช็คเอาต์
                            </span>
                          </div>
                          <div className="text-[11px] text-charcoal-600 flex items-center gap-2 flex-wrap">
                            <span>👤 {item.customerName}</span>
                            <span>📞 {item.customerPhone}</span>
                            <span className="text-amber-800 font-medium">(สิ้นสุดการพัก {item.totalNights} คืน)</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setSelectedEvent({ ...item, raw: item.raw })}
                            className="px-2.5 py-1.5 bg-cream-50 hover:bg-cream-100 text-charcoal-700 border border-cream-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                          >
                            <Eye size={12} className="text-charcoal-500" />
                            <span>ดูข้อมูล</span>
                          </button>

                          <Link
                            href={`/admin/checkin?search=${encodeURIComponent(item.customerName || item.roomTitle)}`}
                            className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
                            title="ไปยังหน้าเช็คอิน-เช็คเอาต์เพื่อตัดยอดคืนห้อง"
                          >
                            <span>หน้าเช็คเอาต์</span>
                            <ArrowUpRight size={12} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ---------------- Section 3: Staying ---------------- */}
            {(activeModalTab === 'all' || activeModalTab === 'staying') && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-charcoal-800 font-bold text-xs pt-1">
                  <Home size={15} className="text-charcoal-600" />
                  <span>แขกพักค้างคืนต่อเนื่อง ({selectedDayData.staying.length} ห้อง)</span>
                </div>
                {selectedDayData.staying.length === 0 ? (
                  <p className="text-[11px] text-charcoal-400 italic bg-cream-50/50 p-3 rounded-xl border border-cream-200/60 text-center">
                    ไม่มีแขกพักค้างคืนต่อเนื่องในวันนี้
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayData.staying.map((item, idx) => (
                      <div
                        key={`stay-${idx}`}
                        className="bg-white border border-cream-200/90 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-cream-400 transition-all"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-charcoal-900 text-xs">{item.roomTitle}</span>
                            <span className="text-[11px] text-forest-800 font-medium bg-forest-50 px-2 py-0.2 rounded-md">
                              คืนที่ {item.currentNight}/{item.totalNights}
                            </span>
                          </div>
                          <div className="text-[11px] text-charcoal-600 flex items-center gap-2 flex-wrap">
                            <span>👤 {item.customerName}</span>
                            <span>📞 {item.customerPhone}</span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setSelectedEvent({ ...item, raw: item.raw })}
                            className="px-2.5 py-1.5 bg-cream-50 hover:bg-cream-100 text-charcoal-700 border border-cream-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                          >
                            <Eye size={12} className="text-charcoal-500" />
                            <span>ดูข้อมูล</span>
                          </button>

                          <Link
                            href={`/admin/checkin?search=${encodeURIComponent(item.customerName || item.roomTitle)}`}
                            className="px-2.5 py-1.5 bg-charcoal-700 hover:bg-charcoal-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
                            title="ไปยังหน้าเช็คอิน"
                          >
                            <span>หน้าเช็คอิน</span>
                            <ArrowUpRight size={12} />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ---------------- Section 4: Boats (View-only) ---------------- */}
            {(activeModalTab === 'all' || activeModalTab === 'boats') && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-lagoon-950 font-bold text-xs pt-1">
                  <Sailboat size={15} className="text-lagoon-700" />
                  <span>คิวเรือพาย / ซับบอร์ดวันนี้ ({selectedDayData.boats.length} รายการ — ดูข้อมูล)</span>
                </div>
                {selectedDayData.boats.length === 0 ? (
                  <p className="text-[11px] text-charcoal-400 italic bg-cream-50/50 p-3 rounded-xl border border-cream-200/60 text-center">
                    ไม่มีคิวจองเรือพายในวันนี้
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedDayData.boats.map((item, idx) => (
                      <div
                        key={`boat-${idx}`}
                        className="bg-white border border-lagoon-200/80 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-lagoon-300 transition-all"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-lagoon-950 text-xs">{item.boatTitle}</span>
                            <span className="text-[11px] text-lagoon-700 font-semibold bg-lagoon-50 px-2 py-0.2 rounded-md">
                              ⏰ {item.timeFormatted}
                            </span>
                          </div>
                          <div className="text-[11px] text-charcoal-600 flex items-center gap-2 flex-wrap">
                            <span>👤 {item.customerName}</span>
                            <span>📞 {item.customerPhone}</span>
                            <span>({item.boatCount} ลำ • {item.numPassengers} ท่าน)</span>
                          </div>
                        </div>

                        {/* View Details Only for Boats */}
                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                          <button
                            type="button"
                            onClick={() => setSelectedEvent({ ...item, raw: item.raw })}
                            className="px-3 py-1.5 bg-lagoon-50 hover:bg-lagoon-100 text-lagoon-800 border border-lagoon-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95"
                          >
                            <Eye size={12} className="text-lagoon-700" />
                            <span>ดูข้อมูลเรือ</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 2. Modal รายละเอียดการจองเดี่ยว (Booking Detail Modal with Back Button) */}
      {/* ---------------------------------------------------- */}
      <Modal 
        open={!!selectedEvent}
        title={selectedEvent?.type === 'room' ? 'รายละเอียดการจองห้องพัก' : 'รายละเอียดการจองเรือพาย'}
        onClose={() => setSelectedEvent(null)}
        footer={
          <div className="w-full flex items-center justify-between gap-2 flex-wrap">
            {/* Prominent Back Button (Takes user back to the Day Summary) */}
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-cream-100 hover:bg-cream-200 text-charcoal-700 font-semibold rounded-2xl border border-cream-300/80 text-xs transition-all active:scale-95"
            >
              <ChevronLeft size={15} className="text-charcoal-600" />
              <span>ย้อนกลับไปหน้าสรุปวัน</span>
            </button>

            {selectedEvent?.type === 'room' && (
              <Link
                href={`/admin/checkin?search=${encodeURIComponent(selectedEvent.customerName || selectedEvent.roomTitle || '')}`}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-forest-800 hover:bg-forest-900 text-white font-semibold rounded-2xl text-xs transition-colors active:scale-95 shadow-xs"
              >
                <LogIn size={14} />
                <span>เปิดจัดการในหน้าเช็คอิน-เช็คเอาต์</span>
                <ArrowUpRight size={13} />
              </Link>
            )}
          </div>
        }
      >
        {selectedEvent && (
          <div className="space-y-3.5 text-xs text-charcoal-600 mt-2">
            {/* Top Back Navigator Link */}
            {selectedDayData && (
              <div className="flex items-center justify-between pb-1 border-b border-cream-200/60">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-forest-800 hover:text-forest-950 hover:underline active:scale-95"
                >
                  <ArrowLeft size={14} />
                  <span>กลับไปหน้ารายการวันที่ {formatThaiDateShort(selectedDayData.dateStr)}</span>
                </button>
                <span className="text-[11px] text-charcoal-400 font-mono">
                  ID #{selectedEvent.bookingId}
                </span>
              </div>
            )}

            {/* Header Tag with ID */}
            <div className="flex items-center justify-between bg-cream-50/70 border border-cream-200/80 rounded-2xl p-3">
              <div className="flex items-center gap-2.5">
                {selectedEvent.type === 'room' ? (
                  <span className="w-9 h-9 rounded-xl bg-forest-800 text-white flex items-center justify-center shadow-xs">
                    <Home size={16} />
                  </span>
                ) : (
                  <span className="w-9 h-9 rounded-xl bg-lagoon-700 text-white flex items-center justify-center shadow-xs">
                    <Sailboat size={16} />
                  </span>
                )}
                <div>
                  <div className="font-semibold text-charcoal-900 text-xs">
                    {selectedEvent.type === 'room' ? 'การจองห้องพัก' : 'การจองกิจกรรมเรือพาย'}
                  </div>
                  <div className="text-[11px] text-charcoal-400 font-mono">
                    ID #{selectedEvent.bookingId}
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${statusClass[selectedEvent.raw.status] || 'bg-forest-100/90 text-forest-800 border-forest-200/90'}`}>
                {statusLabel[selectedEvent.raw.status] || 'ยืนยันแล้ว'}
              </span>
            </div>

            {/* Info Container */}
            <div className="bg-cream-50/50 border border-cream-200/70 rounded-2xl p-4 space-y-3">
              {/* Customer Name */}
              <div className="flex items-start gap-2.5">
                <User size={15} className="text-forest-700 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <span className="text-charcoal-400 text-[11px] block">ชื่อผู้จอง</span>
                  <span className="font-semibold text-charcoal-900 text-xs">{selectedEvent.customerName}</span>
                  {selectedEvent.customerEmail && selectedEvent.customerEmail !== '-' && (
                    <span className="text-[11px] text-charcoal-400 block font-mono mt-0.5">{selectedEvent.customerEmail}</span>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-start gap-2.5">
                <Phone size={15} className="text-forest-700 shrink-0 mt-0.5" />
                <div>
                  <span className="text-charcoal-400 text-[11px] block">เบอร์โทรศัพท์</span>
                  <span className="font-semibold text-charcoal-900 text-xs font-mono">{selectedEvent.customerPhone}</span>
                </div>
              </div>

              {/* Room Specific Info */}
              {selectedEvent.type === 'room' && (
                <>
                  {selectedEvent.roomTitle && (
                    <div className="flex items-start gap-2.5">
                      <BedDouble size={15} className="text-forest-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-charcoal-400 text-[11px] block">ห้องพักที่จัดสรร</span>
                        <span className="font-semibold text-charcoal-900 text-xs">{selectedEvent.roomTitle}</span>
                      </div>
                    </div>
                  )}
                  {selectedEvent.guestCount && (
                    <div className="flex items-start gap-2.5">
                      <Users size={15} className="text-forest-700 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-charcoal-400 text-[11px] block">จำนวนผู้เข้าพัก</span>
                        <span className="font-semibold text-charcoal-900 text-xs">{selectedEvent.guestCount} ท่าน</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-start gap-2.5">
                    <Clock size={15} className="text-forest-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-charcoal-400 text-[11px] block">ช่วงเวลาเข้าพัก</span>
                      <span className="font-semibold text-charcoal-900 text-xs">
                        {selectedEvent.checkInStr ? formatThaiDateShort(selectedEvent.checkInStr) : '-'} 
                        {' ถึง '}
                        {selectedEvent.checkOutStr ? formatThaiDateShort(selectedEvent.checkOutStr) : '-'}
                        <span className="text-forest-800 font-bold ml-1.5">
                          ({selectedEvent.totalNights || 1} คืน)
                        </span>
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Kayak Specific Info */}
              {selectedEvent.type === 'kayak' && (
                <>
                  <div className="flex items-start gap-2.5">
                    <Ship size={15} className="text-lagoon-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-charcoal-400 text-[11px] block">ประเภทเรือ</span>
                      <span className="font-semibold text-charcoal-900 text-xs">{selectedEvent.boatTitle}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <Clock size={15} className="text-lagoon-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-charcoal-400 text-[11px] block">วันที่และรอบเวลา</span>
                      <span className="font-semibold text-charcoal-900 text-xs">
                        {selectedEvent.dateStr ? formatThaiDateShort(selectedEvent.dateStr) : '-'}
                        {selectedEvent.timeFormatted && ` • ${selectedEvent.timeFormatted}`}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Special Request */}
            {selectedEvent.specialRequest && (
              <div className="flex items-start gap-2.5 bg-cream-100/70 p-3 rounded-2xl border border-cream-200/80">
                <FileText size={15} className="text-forest-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-charcoal-800 block mb-0.5">คำขอพิเศษ:</span>
                  <span className="text-charcoal-600 text-xs">{selectedEvent.specialRequest}</span>
                </div>
              </div>
            )}

            {/* Payment Slip Button */}
            {selectedEvent.paymentSlip && (
              <div className="pt-1">
                <button
                  onClick={() => {
                    setSlipModal({
                      open: true,
                      url: resolveMediaUrl(selectedEvent.paymentSlip),
                      name: selectedEvent.customerName
                    });
                  }}
                  className="flex items-center gap-1.5 text-xs text-forest-800 hover:text-forest-900 font-semibold bg-white hover:bg-forest-50/70 px-4 py-2.5 rounded-2xl transition-all border border-forest-200/90 w-full justify-center shadow-xs active:scale-95"
                >
                  <Eye size={14} className="text-forest-700" />
                  <span>ดูหลักฐานการชำระเงิน (สลิปโอนเงิน)</span>
                </button>
              </div>
            )}

            {/* Price Total Card */}
            <div className="p-3.5 bg-cream-100/80 rounded-2xl border border-cream-200/80 flex justify-between items-center text-sm">
              <span className="font-semibold text-charcoal-700 text-xs">ยอดรวมทั้งสิ้น:</span>
              <span className="font-display font-bold text-forest-900 text-base sm:text-lg">
                ฿{Number(selectedEvent.totalPrice || 0).toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------------------------------------------- */}
      {/* 3. Modal ดูสลิปชำระเงิน (Slip View Modal) */}
      {/* ---------------------------------------------------- */}
      <Modal
        open={slipModal.open}
        title={`สลิปการชำระเงิน — ${slipModal.name}`}
        onClose={() => setSlipModal({ open: false, url: '', name: '' })}
      >
        <div className="pt-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={slipModal.url} 
            alt="payment slip" 
            className="w-full rounded-2xl object-contain max-h-[65vh] mx-auto border border-cream-200/80 shadow-panel"
            referrerPolicy="no-referrer"
            crossOrigin="anonymous" 
          />
        </div>
      </Modal>
    </div>
  );
}
