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
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';

type FilterType = 'all' | 'rooms' | 'kayaks';

export default function AdminCalendarPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ allowedRoles: ['admin', 'staff'] });

  const [currentDate, setCurrentDate] = useState(new Date());
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [roomBookings, setRoomBookings] = useState<any[]>([]);
  const [kayakBookings, setKayakBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // State สำหรับ Modal รายละเอียดการจอง
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);

  useEffect(() => {
    if (!ready) return;
    fetchBookings();
  }, [ready]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const [rb, kb] = await Promise.all([
        api.get('/bookings'),
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
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon...

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  // รวมและ Normalize Event ให้อยู่ในโครงสร้างเดียวกัน
  const events = useMemo(() => {
    const list: any[] = [];

    if (filterType === 'all' || filterType === 'rooms') {
      roomBookings.forEach((b) => {
        if (b.status === 'cancelled' || b.status === 'rejected') return;
        list.push({
          id: `room-${b.id}`,
          type: 'room',
          title: `🏠 ${b.room_type_name || b.room_number || 'ห้องพัก'} - ${b.customer_name || 'ลูกค้า'}`,
          dateStr: b.check_in ? new Date(b.check_in).toISOString().split('T')[0] : '',
          raw: b,
        });
      });
    }

    if (filterType === 'all' || filterType === 'kayaks') {
      kayakBookings.forEach((b) => {
        if (b.status === 'cancelled' || b.status === 'rejected') return;
        list.push({
          id: `kayak-${b.id}`,
          type: 'kayak',
          title: `🚣 เรือคายัค - ${b.customer_name || 'ลูกค้า'} (${b.start_time || ''})`,
          dateStr: b.booking_date ? new Date(b.booking_date).toISOString().split('T')[0] : '',
          raw: b,
        });
      });
    }

    return list;
  }, [roomBookings, kayakBookings, filterType]);

  // สร้างแมปข้อมูลประจำวัน YYYY-MM-DD -> Events[]
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
            ปฏิทินการจองรวม
          </h1>
          <p className="text-charcoal-400 mt-1 text-xs md:text-sm">
            แสดงผังคิวการจองห้องพักและเรือคายัคแบบ Real-Time
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
              <Sailboat size={14} /> เฉพาะเรือคายัค
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
          {/* Empty cells before month starts */}
          {Array.from({ length: firstDayOfMonth }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[110px] bg-stone-50/40 p-2" />
          ))}

          {/* Month Days */}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const dateObj = new Date(year, month, dayNum);
            // Format YYYY-MM-DD แบบปลอดภัย
            const formattedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            
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
                    <span className="text-[10px] text-charcoal-400 font-semibold">
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

      {/* Modal รายละเอียดเมื่อกดที่คิวจอง */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4 animate-in fade-in zoom-in duration-150">
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
                  <p className="text-xs text-charcoal-400">ID: {selectedEvent.raw.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-1 rounded-lg text-charcoal-400 hover:bg-stone-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs text-charcoal-600">
              <div className="flex items-center gap-2">
                <User size={15} className="text-charcoal-400 shrink-0" />
                <span className="font-semibold text-charcoal-800">ผู้จอง:</span>
                <span>{selectedEvent.raw.customer_name || 'ไม่ระบุชื่อ'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={15} className="text-charcoal-400 shrink-0" />
                <span className="font-semibold text-charcoal-800">เบอร์โทร:</span>
                <span>{selectedEvent.raw.customer_phone || '-'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-charcoal-400 shrink-0" />
                <span className="font-semibold text-charcoal-800">วันที่:</span>
                <span>{selectedEvent.dateStr}</span>
              </div>
              <div className="flex items-center gap-2">
                {selectedEvent.raw.status === 'approved' ? (
                  <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle size={15} className="text-amber-600 shrink-0" />
                )}
                <span className="font-semibold text-charcoal-800">สถานะ:</span>
                <span className={`font-bold ${selectedEvent.raw.status === 'approved' ? 'text-emerald-700' : 'text-amber-600'}`}>
                  {selectedEvent.raw.status}
                </span>
              </div>
              <div className="pt-2 border-t border-stone-100 flex justify-between items-center text-sm">
                <span className="font-bold text-charcoal-700">ราคารวม:</span>
                <span className="font-bold text-forest-800 text-base">฿{Number(selectedEvent.raw.total_price || 0).toLocaleString()}</span>
              </div>
            </div>

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
    </div>
  );
}