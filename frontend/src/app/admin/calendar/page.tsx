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
  ArrowLeft,
  CalendarDays,
} from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { resolveMediaUrl } from '@/lib/avatar';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { notify } from "@/lib/admin-notify";
import { Modal, CustomSelect } from '@/components/admin/ui';
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
type StatusTabType = 'all' | 'checkins' | 'checkouts' | 'boats';

interface DaySummary {
  dateStr: string;
  checkins: any[];
  checkouts: any[];
  boats: any[];
  roomsCount: number;
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
  const changeMonth = (newMonth: number) => setCurrentDate(new Date(year, newMonth, 1));
  const changeYear = (newYear: number) => setCurrentDate(new Date(newYear, month, 1));

  // ---------------- Process Daily Breakdowns (No พักต่อเนื่อง) ----------------
  const dailyDataMap = useMemo(() => {
    const map: Record<string, DaySummary> = {};

    const getOrCreate = (dateStr: string): DaySummary => {
      if (!map[dateStr]) {
        map[dateStr] = {
          dateStr,
          checkins: [],
          checkouts: [],
          boats: [],
          roomsCount: 0
        };
      }
      return map[dateStr];
    };

    // 1. Process Rooms (Check-ins and Check-outs only)
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
        totalPrice: Number(b.total_price || 0),
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
        specialRequest: b.special_request,
        totalPrice: Number(b.total_price || 0),
        paymentSlip: b.payment_slip,
        status: b.status,
        raw: b
      };

      const boatDay = getOrCreate(dateStr);
      boatDay.boats.push(baseInfo);
    });

    // Compute rooms count per day
    Object.values(map).forEach((d) => {
      d.roomsCount = d.checkins.length + d.checkouts.length;
    });

    return map;
  }, [roomBookings, kayakBookings]);

  // สรุปสถิติประจำเดือนที่เลือก & วันนี้
  const stats = useMemo(() => {
    const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const todayStr = formatDateToYYYYMMDD(new Date());

    let checkinsMonth = 0;
    let checkoutsMonth = 0;
    let boatsMonth = 0;
    let todayRooms = 0;
    let todayBoats = 0;

    Object.entries(dailyDataMap).forEach(([dateStr, dayData]) => {
      if (dateStr.startsWith(currentMonthPrefix)) {
        checkinsMonth += dayData.checkins.length;
        checkoutsMonth += dayData.checkouts.length;
        boatsMonth += dayData.boats.length;
      }
      if (dateStr === todayStr) {
        todayRooms = dayData.checkins.length + dayData.checkouts.length;
        todayBoats = dayData.boats.length;
      }
    });

    return {
      checkinsMonth,
      checkoutsMonth,
      boatsMonth,
      totalMonth: checkinsMonth + checkoutsMonth + boatsMonth,
      todayTotal: todayRooms + todayBoats,
      todayRooms,
      todayBoats
    };
  }, [dailyDataMap, year, month]);

  const thaiMonthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  // Helper เพื่อเปิด Modal วัน และเลือก Tab ทันที
  const handleOpenDayModal = (dayData: DaySummary, initialTab: StatusTabType) => {
    setSelectedDayData(dayData);
    setActiveModalTab(initialTab);
    setSelectedEvent(null);
  };

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-16 max-w-[1600px] mx-auto">
      {/* Top Header Card (Match Checkin Page Style) */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative z-10">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="w-10 h-10 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-800/15">
              <CalendarIcon size={20} className="stroke-[2.2]" />
            </span>
            <div>
              <h1 className="font-display text-2xl lg:text-3xl font-bold text-forest-900 tracking-tight">
                ปฏิทินการจอง
              </h1>
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
                <span>เรือ</span>
              </button>
            </div>

            {/* Jump to Today Button (No Icon) */}
            <button
              onClick={goToToday}
              className="px-3.5 py-2 bg-white hover:bg-forest-50/50 hover:border-forest-200 text-charcoal-700 rounded-2xl border border-charcoal-200/80 shadow-xs transition-all text-xs font-semibold active:scale-95"
              title="ไปยังเดือนปัจจุบัน"
            >
              วันนี้
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

      {/* 4 Stat Overview Cards (Monthly Summary with Icons) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Check-ins this Month */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-forest-700 uppercase tracking-wider">เช็คอินเดือนนี้</p>
            <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
              {stats.checkinsMonth}
              <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">ห้อง</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-forest-50 text-forest-800 border border-forest-100 flex items-center justify-center shrink-0">
            <LogIn size={20} className="stroke-[2.2]" />
          </div>
        </div>

        {/* Card 2: Check-outs this Month */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider">เช็คเอาต์เดือนนี้</p>
            <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
              {stats.checkoutsMonth}
              <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">ห้อง</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-800 border border-amber-100 flex items-center justify-center shrink-0">
            <LogOut size={20} className="stroke-[2.2]" />
          </div>
        </div>

        {/* Card 3: Kayaks this Month */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-lagoon-700 uppercase tracking-wider">กิจกรรมเรือเดือนนี้</p>
            <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
              {stats.boatsMonth}
              <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">รอบ</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-lagoon-50 text-lagoon-800 border border-lagoon-100 flex items-center justify-center shrink-0">
            <Ship size={20} className="stroke-[2.2]" />
          </div>
        </div>

        {/* Card 4: Total Activities this Month */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold text-charcoal-600 uppercase tracking-wider">กิจกรรมทั้งหมดเดือนนี้</p>
            <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
              {stats.totalMonth}
              <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">รายการ</span>
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-cream-100 text-charcoal-700 border border-cream-200 flex items-center justify-center shrink-0">
            <CalendarDays size={20} className="stroke-[2.2]" />
          </div>
        </div>
      </div>

      {/* Main Calendar Panel */}
      <div className="bg-white rounded-3xl shadow-panel border border-cream-200/80 overflow-hidden">
        {/* Calendar Month & Navigation Header */}
        <div className="p-4 sm:p-5 border-b border-cream-200/80 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-display text-xl sm:text-2xl font-bold text-forest-900 tracking-tight">
              {thaiMonthNames[month]} {year + 543}
            </h2>
            <span className="hidden sm:inline-block text-xs font-medium text-charcoal-500 bg-cream-100/90 px-3 py-1 rounded-full border border-cream-300/60">
              เข้าพัก {stats.checkinsMonth} • ออก {stats.checkoutsMonth} • เรือ {stats.boatsMonth}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Quick Month & Year Select Dropdowns */}
            <div className="flex items-center gap-1.5 bg-cream-50/80 p-1 rounded-2xl border border-cream-200 shadow-2xs">
              {/* Month Selector */}
              <CustomSelect
                width="w-28 sm:w-32"
                value={month}
                onChange={(val) => changeMonth(Number(val))}
                options={thaiMonthNames.map((name, idx) => ({
                  value: idx,
                  label: name,
                }))}
                buttonClassName="w-full flex items-center justify-between gap-1.5 px-3 py-1.5 bg-white hover:bg-cream-50/80 border border-cream-200/90 hover:border-forest-300 rounded-xl text-xs font-semibold text-forest-900 transition-all focus:outline-none focus:ring-2 focus:ring-forest-800/20 shadow-2xs"
              />

              {/* Year Selector */}
              <CustomSelect
                width="w-24 sm:w-28"
                value={year}
                onChange={(val) => changeYear(Number(val))}
                options={Array.from({ length: 9 }, (_, idx) => {
                  const y = new Date().getFullYear() - 3 + idx;
                  return {
                    value: y,
                    label: String(y + 543),
                  };
                })}
                buttonClassName="w-full flex items-center justify-between gap-1.5 px-3 py-1.5 bg-white hover:bg-cream-50/80 border border-cream-200/90 hover:border-forest-300 rounded-xl text-xs font-semibold text-forest-900 transition-all focus:outline-none focus:ring-2 focus:ring-forest-800/20 shadow-2xs"
              />
            </div>

            {/* Prev / Next Month Buttons */}
            <div className="flex items-center gap-1">
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
            <div key={`empty-${i}`} className="min-h-[110px] sm:min-h-[125px] bg-cream-50/30 p-2" />
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
              boats: [],
              roomsCount: 0
            };

            const showRooms = (filterType === 'all' || filterType === 'rooms') && dayData.roomsCount > 0;
            const showBoats = (filterType === 'all' || filterType === 'kayaks') && dayData.boats.length > 0;
            const hasActivity = showRooms || showBoats;

            const defaultInitialTab: StatusTabType = 
              dayData.checkins.length > 0 ? 'checkins' :
              dayData.checkouts.length > 0 ? 'checkouts' :
              dayData.boats.length > 0 ? 'boats' : 'all';

            return (
              <div
                key={dayNum}
                onClick={() => {
                  if (hasActivity) {
                    handleOpenDayModal(dayData, defaultInitialTab);
                  }
                }}
                className={`min-h-[110px] sm:min-h-[125px] p-2 transition-all flex flex-col justify-start relative group ${
                  hasActivity ? 'cursor-pointer' : ''
                } ${
                  isToday 
                    ? 'bg-forest-50/30 ring-1 ring-inset ring-forest-600/30' 
                    : 'bg-white hover:bg-cream-50/60'
                }`}
              >
                {/* Day Header Inside Cell */}
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`text-xs font-bold w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center rounded-full transition-all ${
                      isToday 
                        ? 'bg-forest-800 text-white shadow-xs shadow-forest-800/20' 
                        : 'text-charcoal-700 group-hover:text-forest-900'
                    }`}
                  >
                    {dayNum}
                  </span>

                  {hasActivity && (
                    <span className="text-[10px] text-forest-700/80 font-medium group-hover:text-forest-900 group-hover:underline">
                      ดูรายชื่อ
                    </span>
                  )}
                </div>

                {/* Clean 2-Line Summary on Calendar */}
                <div className="space-y-1.5">
                  {/* Rooms Summary Line */}
                  {showRooms && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDayModal(dayData, dayData.checkins.length > 0 ? 'checkins' : 'checkouts');
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl text-xs font-medium bg-forest-50/90 text-forest-900 border border-forest-200/90 flex items-center justify-between shadow-2xs hover:bg-forest-100 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <Home size={12} className="text-forest-700 shrink-0" />
                        <span>ห้องพัก</span>
                      </div>
                      <span className="font-bold font-mono text-[11px] bg-forest-200/60 px-1.5 py-0.2 rounded-md">
                        {dayData.roomsCount} ห้อง
                      </span>
                    </div>
                  )}

                  {/* Boats Summary Line */}
                  {showBoats && (
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDayModal(dayData, 'boats');
                      }}
                      className="w-full px-2.5 py-1.5 rounded-xl text-xs font-medium bg-lagoon-50/90 text-lagoon-900 border border-lagoon-200/90 flex items-center justify-between shadow-2xs hover:bg-lagoon-100 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        <Sailboat size={12} className="text-lagoon-700 shrink-0" />
                        <span>เรือพาย</span>
                      </div>
                      <span className="font-bold font-mono text-[11px] bg-lagoon-200/60 px-1.5 py-0.2 rounded-md">
                        {dayData.boats.length} รอบ
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. Modal สรุปรายการจองรายวัน (Daily Breakdown with 4 Tabs) */}
      {/* ---------------------------------------------------- */}
      <Modal 
        open={!!selectedDayData && !selectedEvent}
        title={`สรุปรายการจองประจำวัน — ${selectedDayData ? formatThaiDateLong(selectedDayData.dateStr) : ''}`}
        onClose={() => setSelectedDayData(null)}
        widthClass="max-w-2xl"
        overflowClass="overflow-hidden"
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
          <div className="h-[460px] flex flex-col text-xs text-charcoal-600">
            {/* 4 Interactive Filter Tabs (ทั้งหมด / เช็คอินเข้า / เช็คเอาต์ออก / คิวเรือพาย) */}
            <div className="bg-cream-100/90 p-1 rounded-2xl flex items-center gap-1 border border-cream-200/90 shadow-2xs shrink-0 mb-3">
              {/* Tab 0: All */}
              <button
                type="button"
                onClick={() => setActiveModalTab('all')}
                className={`flex-1 py-2 px-2 sm:px-3 rounded-xl text-xs font-semibold transition-all text-center flex items-center justify-center gap-1.5 active:scale-95 ${
                  activeModalTab === 'all'
                    ? 'bg-white text-forest-900 shadow-xs border border-cream-300/80'
                    : 'text-charcoal-600 hover:text-forest-900 hover:bg-white/40'
                }`}
              >
                <span>ทั้งหมด</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                  activeModalTab === 'all' ? 'bg-forest-100/90 text-forest-800' : 'bg-cream-200/70 text-charcoal-500'
                }`}>
                  {selectedDayData.checkins.length + selectedDayData.checkouts.length + selectedDayData.boats.length}
                </span>
              </button>

              {/* Tab 1: Check-ins */}
              <button
                type="button"
                onClick={() => setActiveModalTab('checkins')}
                className={`flex-1 py-2 px-2 sm:px-3 rounded-xl text-xs font-semibold transition-all text-center flex items-center justify-center gap-1.5 active:scale-95 ${
                  activeModalTab === 'checkins'
                    ? 'bg-white text-forest-900 shadow-xs border border-cream-300/80'
                    : 'text-charcoal-600 hover:text-forest-900 hover:bg-white/40'
                }`}
              >
                <span>เช็คอินเข้า</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                  activeModalTab === 'checkins' ? 'bg-forest-100/90 text-forest-800' : 'bg-cream-200/70 text-charcoal-500'
                }`}>
                  {selectedDayData.checkins.length}
                </span>
              </button>

              {/* Tab 2: Check-outs */}
              <button
                type="button"
                onClick={() => setActiveModalTab('checkouts')}
                className={`flex-1 py-2 px-2 sm:px-3 rounded-xl text-xs font-semibold transition-all text-center flex items-center justify-center gap-1.5 active:scale-95 ${
                  activeModalTab === 'checkouts'
                    ? 'bg-white text-forest-900 shadow-xs border border-cream-300/80'
                    : 'text-charcoal-600 hover:text-forest-900 hover:bg-white/40'
                }`}
              >
                <span>เช็คเอาต์ออก</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                  activeModalTab === 'checkouts' ? 'bg-amber-100/80 text-amber-800' : 'bg-cream-200/70 text-charcoal-500'
                }`}>
                  {selectedDayData.checkouts.length}
                </span>
              </button>

              {/* Tab 3: Boats */}
              <button
                type="button"
                onClick={() => setActiveModalTab('boats')}
                className={`flex-1 py-2 px-2 sm:px-3 rounded-xl text-xs font-semibold transition-all text-center flex items-center justify-center gap-1.5 active:scale-95 ${
                  activeModalTab === 'boats'
                    ? 'bg-white text-forest-900 shadow-xs border border-cream-300/80'
                    : 'text-charcoal-600 hover:text-forest-900 hover:bg-white/40'
                }`}
              >
                <span>คิวเรือพาย</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                  activeModalTab === 'boats' ? 'bg-lagoon-100/80 text-lagoon-800' : 'bg-cream-200/70 text-charcoal-500'
                }`}>
                  {selectedDayData.boats.length}
                </span>
              </button>
            </div>

            {/* Tab Content Area (Single Smooth Minimal Scrollbar, Fixed Height) */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
              {/* ---------------- Section 1: Check-ins ---------------- */}
              {(activeModalTab === 'all' || activeModalTab === 'checkins') && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-forest-900 font-bold text-xs pt-1 px-1">
                    <span>แขกเช็คอินเข้าพักวันนี้ ({selectedDayData.checkins.length} ห้อง)</span>
                  </div>
                  {selectedDayData.checkins.length === 0 ? (
                    <div className="p-6 text-center bg-cream-50/60 rounded-2xl border border-cream-200/60 text-charcoal-400 italic">
                      ไม่มีรายการเช็คอินเข้าใหม่ในวันนี้
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedDayData.checkins.map((item, idx) => (
                        <div
                          key={`in-${idx}`}
                          className="bg-white border border-cream-200/90 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-cream-300 transition-all"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-forest-950 text-xs">{item.roomTitle}</span>
                              <span className="text-[11px] text-charcoal-400 font-mono">• ID #{item.bookingId}</span>
                              <span className="px-2 py-0.5 rounded-full bg-forest-50 text-forest-700 border border-forest-100 text-[10px] font-medium">
                                เช็คอินเข้า
                              </span>
                            </div>
                            <div className="text-[11px] text-charcoal-600 flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-charcoal-800">{item.customerName}</span>
                              <span className="text-charcoal-400 font-mono">{item.customerPhone}</span>
                              <span className="text-forest-700 font-medium">({item.totalNights} คืน)</span>
                            </div>
                            {item.specialRequest && (
                              <div className="text-[10.5px] text-charcoal-600 bg-cream-100/70 px-2 py-0.5 rounded-lg inline-block border border-cream-200/60">
                                คำขอ: {item.specialRequest}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => setSelectedEvent({ ...item, raw: item.raw })}
                              className="px-3 py-1.5 bg-white hover:bg-cream-50 text-charcoal-700 border border-charcoal-200/80 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
                            >
                              <Eye size={12} className="text-charcoal-500" />
                              <span>ดูข้อมูล</span>
                            </button>

                            <Link
                              href={`/admin/checkin?search=${encodeURIComponent(item.customerName || item.roomTitle)}`}
                              className="px-3 py-1.5 bg-forest-50 hover:bg-forest-100 text-forest-800 border border-forest-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
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
                  <div className="flex items-center gap-2 text-forest-900 font-bold text-xs pt-1 px-1">
                    <span>แขกเช็คเอาต์คืนห้องวันนี้ ({selectedDayData.checkouts.length} ห้อง)</span>
                  </div>
                  {selectedDayData.checkouts.length === 0 ? (
                    <div className="p-6 text-center bg-cream-50/60 rounded-2xl border border-cream-200/60 text-charcoal-400 italic">
                      ไม่มีรายการเช็คเอาต์คืนห้องในวันนี้
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedDayData.checkouts.map((item, idx) => (
                        <div
                          key={`out-${idx}`}
                          className="bg-white border border-cream-200/90 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-cream-300 transition-all"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-forest-950 text-xs">{item.roomTitle}</span>
                              <span className="text-[11px] text-charcoal-400 font-mono">• ID #{item.bookingId}</span>
                              <span className="px-2 py-0.5 rounded-full bg-cream-100 text-charcoal-700 border border-cream-300/80 text-[10px] font-medium">
                                เช็คเอาต์
                              </span>
                            </div>
                            <div className="text-[11px] text-charcoal-600 flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-charcoal-800">{item.customerName}</span>
                              <span className="text-charcoal-400 font-mono">{item.customerPhone}</span>
                              <span className="text-charcoal-500">(สิ้นสุดการพัก {item.totalNights} คืน)</span>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => setSelectedEvent({ ...item, raw: item.raw })}
                              className="px-3 py-1.5 bg-white hover:bg-cream-50 text-charcoal-700 border border-charcoal-200/80 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
                            >
                              <Eye size={12} className="text-charcoal-500" />
                              <span>ดูข้อมูล</span>
                            </button>

                            <Link
                              href={`/admin/checkin?search=${encodeURIComponent(item.customerName || item.roomTitle)}`}
                              className="px-3 py-1.5 bg-forest-50 hover:bg-forest-100 text-forest-800 border border-forest-200 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
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

              {/* ---------------- Section 3: Boats (View-only) ---------------- */}
              {(activeModalTab === 'all' || activeModalTab === 'boats') && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-forest-900 font-bold text-xs pt-1 px-1">
                    <span>คิวเรือพาย / ซับบอร์ดวันนี้ ({selectedDayData.boats.length} รายการ — ดูข้อมูล)</span>
                  </div>
                  {selectedDayData.boats.length === 0 ? (
                    <div className="p-6 text-center bg-cream-50/60 rounded-2xl border border-cream-200/60 text-charcoal-400 italic">
                      ไม่มีคิวจองเรือพายในวันนี้
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedDayData.boats.map((item, idx) => (
                        <div
                          key={`boat-${idx}`}
                          className="bg-white border border-cream-200/90 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-cream-300 transition-all"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-forest-950 text-xs">{item.boatTitle}</span>
                              <span className="text-[11px] text-lagoon-800 font-medium bg-lagoon-50 px-2 py-0.5 rounded-md border border-lagoon-100">
                                {item.timeFormatted}
                              </span>
                            </div>
                            <div className="text-[11px] text-charcoal-600 flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-charcoal-800">{item.customerName}</span>
                              <span className="text-charcoal-400 font-mono">{item.customerPhone}</span>
                              <span className="text-charcoal-500">({item.boatCount} ลำ • {item.numPassengers} ท่าน)</span>
                            </div>
                          </div>

                          {/* View Details Only for Boats */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={() => setSelectedEvent({ ...item, raw: item.raw })}
                              className="px-3.5 py-1.5 bg-white hover:bg-cream-50 text-charcoal-700 border border-charcoal-200/80 rounded-xl text-xs font-semibold flex items-center gap-1 transition-all active:scale-95 shadow-2xs"
                            >
                              <Eye size={12} className="text-charcoal-500" />
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
