'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ChevronLeft, 
  ChevronRight, 
  Home, 
  Sailboat, 
  Calendar as CalendarIcon,
  X,
  User,
  Phone,
  Clock,
  CheckCircle2,
  Eye,
  Users,
  FileText
} from 'lucide-react';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/avatar';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';

// ----------------------------------------------------------------------
// ฟังก์ชันแก้เรื่อง Timezone +7 (เวลาไทย) อย่างเด็ดขาด
// ----------------------------------------------------------------------

// Helper: แปลงวันที่จาก DB ให้เป็น Date Object ในเวลาไทย (+7 Hours)
const parseLocalDate = (dateInput: any) => {
  if (!dateInput) return new Date();
  
  // แปลง input เป็น Date Object
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return new Date();

  // ถ้าเป็น ISO String หรือมี Timezone ติดมา ให้บวก offset ของไทย (+7 ชม.) ป้องกัน UTC ถอยหลัง
  // วิธีนี้จะแปลงเวลา UTC 17:00 วันที่ 2 ให้กลายเป็น 00:00 วันที่ 3 สิงหาคม อย่างถูกต้อง
  const thaiDate = new Date(d.getTime() + (7 * 60 * 60 * 1000));
  
  // ล้างค่าเวลาให้เหลือ 00:00:00 ของวันนั้นๆ
  return new Date(thaiDate.getUTCFullYear(), thaiDate.getUTCMonth(), thaiDate.getUTCDate());
};

// Helper: Format Date เป็น YYYY-MM-DD โดยไม่อิง ISO UTC
const formatDateToYYYYMMDD = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// map ชื่อสถานะที่ใช้แสดงบน UI
const statusLabel: Record<string, string> = {
  approved: 'ยืนยันแล้ว',
  checked_in: 'เช็คอินแล้ว',
  checked_out: 'เช็คเอาต์แล้ว',
  completed: 'เสร็จสิ้น',
};

const statusClass: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  checked_in: 'bg-blue-100 text-blue-700 border-blue-200',
  checked_out: 'bg-teal-100 text-teal-700 border-teal-200',
  completed: 'bg-teal-100 text-teal-700 border-teal-200',
};

type FilterType = 'all' | 'rooms' | 'kayaks';

export default function AdminCalendarPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ allowedRoles: ['admin', 'room_staff', 'boat_staff', 'staff'] });

  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [roomBookings, setRoomBookings] = useState<any[]>([]);
  const [kayakBookings, setKayakBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
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
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลปฏิทินได้');
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

  // รวมและ Normalize Event
  const events = useMemo(() => {
    const list: any[] = [];

    // 1. กรองคิวห้องพัก
    if (filterType === 'all' || filterType === 'rooms') {
      roomBookings.forEach((b) => {
        const isApprovedStatus = ['approved', 'checked_in', 'checked_out'].includes(b.status);
        if (!isApprovedStatus || !b.check_in) return;

        const bookingId = b.room_booking_id || b.id;
        const customerName = b.user_name || b.customer_name || 'ลูกค้าทั่วไป';
        const roomTitle = b.room_name || b.type_name || b.room_type_name || `ห้อง #${b.room_id || b.room_number || ''}`;

        // แปลงวันที่โดยปรับ Timezone +7 ชดเชย UTC
        const start = parseLocalDate(b.check_in);
        const end = b.check_out ? parseLocalDate(b.check_out) : new Date(start);

        // คำนวณจำนวนคืน
        const totalNights = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));

        // วน Loop รายวัน
        const curr = new Date(start);
        let nightCount = 1;

        while (curr < end || (totalNights === 1 && nightCount === 1)) {
          const dateStr = formatDateToYYYYMMDD(curr);
          
          let nightLabel = '';
          if (totalNights > 1) {
            nightLabel = ` (คืนที่ ${nightCount}/${totalNights})`;
          }

          list.push({
            id: `room-${bookingId}-${dateStr}`,
            bookingId: bookingId,
            type: 'room',
            title: `🏠 ${roomTitle} - ${customerName}${nightLabel}`,
            dateStr: dateStr,
            raw: {
              ...b,
              customer_name: customerName,
              customer_phone: b.user_phone || b.customer_phone || b.phone || '-',
              customer_email: b.user_email || b.email || '-',
              room_title: roomTitle,
              current_night: nightCount,
              total_nights: totalNights
            },
          });

          // ขยับไปวันถัดไป
          curr.setDate(curr.getDate() + 1);
          nightCount++;

          if (nightCount > 31) break;
        }
      });
    }

    // 2. กรองคิวเรือ / คายัค
    if (filterType === 'all' || filterType === 'kayaks') {
      kayakBookings.forEach((b) => {
        const isApprovedStatus = ['approved', 'checked_out', 'completed'].includes(b.status);
        if (!isApprovedStatus || !b.booking_date) return;

        const bookingId = b.boat_booking_id || b.kayak_booking_id || b.id;
        const customerName = b.user_name || b.customer_name || 'ลูกค้าทั่วไป';
        const boatTitle = b.kayak_name || b.boat_name || 'เรือคายัค';
        
        const timeFormatted = b.start_time 
          ? (b.end_time ? `(${b.start_time.slice(0, 5)} - ${b.end_time.slice(0, 5)})` : `(${b.start_time.slice(0, 5)})`)
          : '';

        const dateStr = formatDateToYYYYMMDD(parseLocalDate(b.booking_date));

        list.push({
          id: `kayak-${bookingId}`,
          bookingId: bookingId,
          type: 'kayak',
          title: `🚣 ${boatTitle} - ${customerName} ${timeFormatted}`,
          dateStr: dateStr,
          raw: {
            ...b,
            boat_title: boatTitle,
            customer_name: customerName,
            customer_phone: b.user_phone || b.customer_phone || b.phone || '-',
            customer_email: b.user_email || b.email || '-',
            time_formatted: timeFormatted
          },
        });
      });
    }

    return list;
  }, [roomBookings, kayakBookings, filterType]);

  // แมปข้อมูลประจำวัน YYYY-MM-DD -> Events[]
  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    events.forEach((ev) => {
      if (!ev.dateStr) return;
      if (!map[ev.dateStr]) map[ev.dateStr] = [];
      map[ev.dateStr].push(ev);
    });
    return map;
  }, [events]);

  const thaiMonthNames = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  return (
    <div className="space-y-6 font-sans pb-10">
      {/* Header Bar */}
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-stone-200/80">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-forest-800 tracking-tight flex items-center gap-2">
            <CalendarIcon size={28} className="text-forest-800" />
            ปฏิทินการจองที่สำเร็จแล้ว
          </h1>
          <p className="text-charcoal-400 mt-1 text-xs md:text-sm">
            แสดงรายการจองห้องพักและเรือคายัคตามช่วงวันที่เข้าพักจริง
          </p>
        </div>

        {/* Filters + Today Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-stone-100 p-1 rounded-xl flex items-center gap-1 border border-stone-200/60">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterType === 'all' ? 'bg-white text-forest-800 shadow-sm' : 'text-charcoal-400'
              }`}
            >
              ทั้งหมด
            </button>
            <button
              onClick={() => setFilterType('rooms')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                filterType === 'rooms' ? 'bg-forest-800 text-white shadow-sm' : 'text-charcoal-400'
              }`}
            >
              <Home size={14} /> เฉพาะห้องพัก
            </button>
            <button
              onClick={() => setFilterType('kayaks')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all ${
                filterType === 'kayaks' ? 'bg-lagoon-600 text-white shadow-sm' : 'text-charcoal-400'
              }`}
            >
              <Sailboat size={14} /> เฉพาะเรือ/คายัค
            </button>
          </div>

          <button
            onClick={goToToday}
            className="px-3 py-2 bg-white border border-stone-200 text-forest-800 font-semibold text-xs rounded-xl shadow-sm hover:bg-stone-50"
          >
            วันนี้
          </button>
        </div>
      </header>

      {/* Calendar Controls */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between">
        <h2 className="font-display text-xl font-bold text-forest-800">
          {thaiMonthNames[month]} {year + 543}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-charcoal-600 transition-all"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={nextMonth}
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-charcoal-600 transition-all"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Grid Calendar */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 border-b border-stone-200 bg-stone-50/80 text-center py-2.5 text-xs font-bold text-charcoal-500">
          <div className="text-rose-600">อา.</div>
          <div>จ.</div>
          <div>อ.</div>
          <div>พ.</div>
          <div>พฤ.</div>
          <div>ศ.</div>
          <div className="text-emerald-700">ส.</div>
        </div>

        {/* Days Cells */}
        <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-stone-200/70">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[110px] bg-stone-50/40 p-2" />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateObj = new Date(year, month, dayNum);
            const formattedDateStr = formatDateToYYYYMMDD(dateObj);
            
            const isToday = new Date().toDateString() === dateObj.toDateString();
            const dayEvents = eventsByDate[formattedDateStr] || [];

            return (
              <div
                key={dayNum}
                className={`min-h-[110px] p-1.5 transition-colors flex flex-col justify-start ${
                  isToday ? 'bg-amber-50/40' : 'bg-white hover:bg-stone-50/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-forest-800 text-white' : 'text-charcoal-600'
                    }`}
                  >
                    {dayNum}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded-full">
                      {dayEvents.length} คิว
                    </span>
                  )}
                </div>

                {/* Event Pills inside Day */}
                <div className="space-y-1 overflow-y-auto max-h-[85px] pr-0.5">
                  {dayEvents.map((ev) => (
                    <button
                      key={ev.id}
                      onClick={() => setSelectedEvent(ev)}
                      className={`w-full text-left px-2 py-1 rounded-md text-[10px] font-medium truncate transition-all shadow-2xs ${
                        ev.type === 'room'
                          ? 'bg-emerald-100/80 text-emerald-900 border border-emerald-200/80 hover:bg-emerald-200'
                          : 'bg-sky-100/80 text-sky-900 border border-sky-200/80 hover:bg-sky-200'
                      }`}
                    >
                      {ev.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal รายละเอียดการจอง */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4 animate-in fade-in zoom-in duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                {selectedEvent.type === 'room' ? (
                  <span className="p-2 rounded-lg bg-emerald-100 text-emerald-800"><Home size={18} /></span>
                ) : (
                  <span className="p-2 rounded-lg bg-sky-100 text-sky-800"><Sailboat size={18} /></span>
                )}
                <div>
                  <h3 className="font-bold text-forest-800 text-base">
                    {selectedEvent.type === 'room' ? 'รายละเอียดจองห้องพัก' : 'รายละเอียดจองเรือคายัค'}
                  </h3>
                  <p className="text-xs text-stone-400">ID: {selectedEvent.bookingId}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded-lg text-stone-400 hover:bg-stone-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3 text-xs text-charcoal-600">
              {/* ชื่อผู้จอง */}
              <div className="flex items-start gap-2">
                <User size={15} className="text-stone-400 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-charcoal-800">ผู้จอง: </span>
                  <span>{selectedEvent.raw.customer_name}</span>
                  {selectedEvent.raw.customer_email !== '-' && (
                    <p className="text-[11px] text-stone-400">{selectedEvent.raw.customer_email}</p>
                  )}
                </div>
              </div>

              {/* เบอร์โทร */}
              <div className="flex items-center gap-2">
                <Phone size={15} className="text-stone-400 shrink-0" />
                <span className="font-semibold text-charcoal-800">เบอร์โทร:</span>
                <span>{selectedEvent.raw.customer_phone}</span>
              </div>

              {/* ข้อมูลห้องพัก */}
              {selectedEvent.type === 'room' && (
                <>
                  {selectedEvent.raw.room_title && (
                    <div className="flex items-center gap-2">
                      <Home size={15} className="text-stone-400 shrink-0" />
                      <span className="font-semibold text-charcoal-800">ห้องพัก:</span>
                      <span>{selectedEvent.raw.room_title}</span>
                    </div>
                  )}
                  {selectedEvent.raw.guest_count && (
                    <div className="flex items-center gap-2">
                      <Users size={15} className="text-stone-400 shrink-0" />
                      <span className="font-semibold text-charcoal-800">จำนวนผู้เข้าพัก:</span>
                      <span>{selectedEvent.raw.guest_count} ท่าน</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-stone-400 shrink-0" />
                    <span className="font-semibold text-charcoal-800">ระยะเวลาพัก:</span>
                    <span className="text-emerald-800 font-bold">
                      {selectedEvent.raw.total_nights || 1} คืน
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-stone-400 shrink-0" />
                    <span className="font-semibold text-charcoal-800">เช็คอิน - เช็คเอาต์:</span>
                    <span>
                      {selectedEvent.raw.check_in ? parseLocalDate(selectedEvent.raw.check_in).toLocaleDateString('th-TH') : '-'} 
                      {' ถึง '}
                      {selectedEvent.raw.check_out ? parseLocalDate(selectedEvent.raw.check_out).toLocaleDateString('th-TH') : '-'}
                    </span>
                  </div>
                </>
              )}

              {/* ข้อมูลเรือคายัค */}
              {selectedEvent.type === 'kayak' && (
                <>
                  <div className="flex items-center gap-2">
                    <Sailboat size={15} className="text-stone-400 shrink-0" />
                    <span className="font-semibold text-charcoal-800">ประเภทเรือ:</span>
                    <span>{selectedEvent.raw.boat_title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-stone-400 shrink-0" />
                    <span className="font-semibold text-charcoal-800">วันที่ / รอบเวลา:</span>
                    <span>
                      {selectedEvent.raw.booking_date ? parseLocalDate(selectedEvent.raw.booking_date).toLocaleDateString('th-TH') : '-'}
                      {selectedEvent.raw.time_formatted && ` ${selectedEvent.raw.time_formatted}`}
                    </span>
                  </div>
                </>
              )}

              {/* คำขอพิเศษ */}
              {selectedEvent.raw.special_request && (
                <div className="flex items-start gap-2 bg-stone-50 p-2 rounded-lg border border-stone-200/60">
                  <FileText size={15} className="text-stone-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-charcoal-800">คำขอพิเศษ: </span>
                    <span className="text-stone-600">{selectedEvent.raw.special_request}</span>
                  </div>
                </div>
              )}

              {/* สถานะการจอง */}
              <div className="flex items-center gap-2">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span className="font-semibold text-charcoal-800">สถานะ:</span>
                <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${statusClass[selectedEvent.raw.status] || 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                  {statusLabel[selectedEvent.raw.status] || 'จองสำเร็จแล้ว'}
                </span>
              </div>

              {/* ปุ่มดูสลิป */}
              {selectedEvent.raw.payment_slip && (
                <div className="pt-1">
                  <button
                    onClick={() => setSlipModal({
                      open: true,
                      url: resolveMediaUrl(selectedEvent.raw.payment_slip),
                      name: selectedEvent.raw.customer_name
                    })}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors border border-blue-200 w-full justify-center"
                  >
                    <Eye size={14} /> ดูหลักฐานการชำระเงิน (สลิป)
                  </button>
                </div>
              )}

              {/* ราคารวม */}
              <div className="pt-3 border-t border-stone-100 flex justify-between items-center text-sm">
                <span className="font-bold text-charcoal-700">ราคารวมทั้งสิ้น:</span>
                <span className="font-bold text-emerald-800 text-base">
                  ฿{Number(selectedEvent.raw.total_price || 0).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-charcoal-700 font-bold rounded-xl text-xs transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ดูสลิปชำระเงิน */}
      {slipModal.open && (
        <div 
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs"
          onClick={() => setSlipModal({ open: false, url: '', name: '' })}
        >
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-stone-100">
              <h3 className="font-bold text-stone-800 text-sm">สลิปการชำระเงิน — {slipModal.name}</h3>
              <button 
                onClick={() => setSlipModal({ open: false, url: '', name: '' })} 
                className="p-1 hover:bg-stone-100 rounded-full transition-colors"
              >
                <X size={18} className="text-stone-500" />
              </button>
            </div>
            <div className="p-4 pt-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img 
                src={slipModal.url} 
                alt="payment slip" 
                className="w-full rounded-xl object-contain max-h-[65vh] mx-auto border border-stone-100 shadow-xs"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous" 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}