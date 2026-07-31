'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, 
  BarChart3, 
  TrendingUp, 
  Sailboat, 
  Users, 
  CalendarDays, 
  Download,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  Home,
  ChevronDown,
  Calendar
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const YEARS = [2024, 2025, 2026, 2027];

// 🌟 Component Custom Dropdown สวยเรียบหรู
function CustomSelect({ 
  options, 
  value, 
  onChange, 
  placeholder = 'เลือก...',
  width = 'w-32'
}: { 
  options: { value: string | number; label: string }[]; 
  value: string | number; 
  onChange: (val: any) => void;
  placeholder?: string;
  width?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  // ปิด Dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative ${width}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-xs font-semibold text-charcoal-700 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-800/20 shadow-2xs"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown 
          size={14} 
          className={`text-charcoal-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-800' : ''}`} 
        />
      </button>

      {/* Floating Menu List */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full bg-white border border-stone-200/90 rounded-xl shadow-lg z-50 overflow-hidden py-1 max-h-56 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 text-xs font-medium transition-colors flex items-center justify-between ${
                  isSelected
                    ? 'bg-emerald-50 text-emerald-900 font-bold'
                    : 'text-charcoal-600 hover:bg-stone-100/80 hover:text-charcoal-900'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-700" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StatsPage() {
  const { ready, user } = useAuthGuard({ allowedRoles: ['admin', 'room_staff', 'boat_staff'] });
  const [period, setPeriod] = useState<'day' | 'month'>('month');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const backPath = user?.role === 'admin' 
    ? '/admin' 
    : user?.role === 'room_staff' 
    ? '/staff/rooms/dashboard' 
    : '/staff/boats/dashboard';

  useEffect(() => {
    if (!ready) return;
    fetchStats();
  }, [ready, period, date, month, year]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params: any = { period };
      if (period === 'day') params.date = date;
      else { params.month = month; params.year = year; }
      const res = await api.get('/settings/stats', { params });
      setData(res.data?.data);
    } catch { 
      toast.error('ไม่สามารถโหลดข้อมูลสถิติได้'); 
    } finally { 
      setLoading(false); 
    }
  };

  const roomStats = data?.room_summary || {};
  const kayakStats = data?.kayak_summary || {};
  const roomRevenue = Number(roomStats.revenue || 0);
  const kayakRevenue = Number(kayakStats.revenue || 0);
  const totalRevenue = roomRevenue + kayakRevenue;

  // Chart calculation
  const roomChart: any[] = data?.room_chart || [];
  const kayakChart: any[] = data?.kayak_chart || [];
  const allDays = Array.from(new Set([...roomChart.map((r: any) => String(r.day)), ...kayakChart.map((r: any) => String(r.day))])).sort();
  const maxRevenue = Math.max(...allDays.map(day => {
    const r = roomChart.find((r: any) => String(r.day) === day);
    const k = kayakChart.find((k: any) => String(k.day) === day);
    return Number(r?.revenue || 0) + Number(k?.revenue || 0);
  }), 1);

  // Export CSV Function
  const handleExportCSV = () => {
    if (!data) {
      toast.error('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const rows = [
      ['รายงานสถิติ สวนวลัยรุกขเวช'],
      ['ช่วงเวลา', period === 'day' ? `วันที่ ${date}` : `เดือน ${MONTHS[Number(month) - 1]} ${Number(year) + 543}`],
      [],
      ['รายการสถิติ', 'สรุปข้อมูล'],
      ['รายได้รวมทั้งหมด (บาท)', totalRevenue],
      ['รายได้ห้องพัก (บาท)', roomRevenue],
      ['จำนวนจองห้องพัก (อนุมัติ)', roomStats.approved_count || 0],
      ['จำนวนจองห้องพัก (รอดำเนินการ)', roomStats.pending_count || 0],
      ['จำนวนจองห้องพัก (ยกเลิก)', roomStats.cancelled_count || 0],
      ['รายได้เรือคายัค (บาท)', kayakRevenue],
      ['จำนวนจองเรือ (อนุมัติ)', kayakStats.approved_count || 0],
      ['จำนวนจองเรือ (รอดำเนินการ)', kayakStats.pending_count || 0],
      ['จำนวนจองเรือ (ยกเลิก)', kayakStats.cancelled_count || 0],
      ['จำนวนสมาชิกทั้งหมด', data.total_members || 0],
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `stats_report_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('ดาวน์โหลดรายงานเรียบร้อยแล้ว');
  };

  if (!ready) return null;

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/80">
        <div className="flex items-center gap-3">
          {/* <Link 
            href={backPath} 
            className="p-2.5 rounded-xl bg-white border border-stone-200/80 text-charcoal-500 hover:text-forest-800 hover:bg-stone-50 transition-all shadow-2xs"
          >
            <ArrowLeft size={18} />
          </Link> */}
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-forest-800 tracking-tight">
              รายงานสถิติ
            </h1>
            <p className="text-charcoal-400 mt-0.5 text-xs md:text-sm">
              ภาพรวมรายได้ สถิติการจอง และการดำเนินงานของสวนวลัยรุกขเวช
            </p>
          </div>
        </div>

        {data && (
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-forest-800 hover:bg-forest-900 text-white font-semibold text-xs rounded-xl transition-all shadow-sm shrink-0"
          >
            <Download size={16} />
            ส่งออก CSV
          </button>
        )}
      </div>

      {/* Filter Panel Card */}
      <div className="p-5 bg-white rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-bold text-charcoal-400 uppercase tracking-wider mb-2">
              ช่วงเวลา
            </label>
            <div className="bg-stone-100 p-1 rounded-xl flex items-center gap-1 border border-stone-200/60">
              <button
                type="button"
                onClick={() => setPeriod('day')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  period === 'day'
                    ? 'bg-white text-forest-800 shadow-2xs'
                    : 'text-charcoal-400 hover:text-charcoal-600'
                }`}
              >
                รายวัน
              </button>
              <button
                type="button"
                onClick={() => setPeriod('month')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  period === 'month'
                    ? 'bg-white text-forest-800 shadow-2xs'
                    : 'text-charcoal-400 hover:text-charcoal-600'
                }`}
              >
                รายเดือน
              </button>
            </div>
          </div>

          {period === 'day' ? (
            <div>
              <label className="block text-xs font-bold text-charcoal-400 uppercase tracking-wider mb-2">
                เลือกวันที่
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-forest-800 shadow-2xs"
                />
              </div>
            </div>
          ) : (
            <>
              {/* Custom Month Dropdown */}
              <div>
                <label className="block text-xs font-bold text-charcoal-400 uppercase tracking-wider mb-2">
                  เดือน
                </label>
                <CustomSelect
                  width="w-28"
                  value={month}
                  onChange={(val) => setMonth(val)}
                  options={MONTHS.map((m, i) => ({
                    value: String(i + 1).padStart(2, '0'),
                    label: m,
                  }))}
                />
              </div>

              {/* Custom Year Dropdown */}
              <div>
                <label className="block text-xs font-bold text-charcoal-400 uppercase tracking-wider mb-2">
                  ปี (พ.ศ.)
                </label>
                <CustomSelect
                  width="w-28"
                  value={year}
                  onChange={(val) => setYear(val)}
                  options={YEARS.map((y) => ({
                    value: String(y),
                    label: String(y + 543),
                  }))}
                />
              </div>
            </>
          )}

          <button
            onClick={fetchStats}
            disabled={loading}
            className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs rounded-xl transition-all shadow-2xs flex items-center gap-1.5 h-[34px]"
          >
            <Search size={14} />
            ค้นหา
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 animate-pulse bg-stone-200/60 rounded-2xl" />
          ))}
        </div>
      ) : (
        data && (
          <>
            {/* Top 4 Key Performance Indicators */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              <div className="p-4 rounded-2xl border border-stone-200/80 bg-white shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100/70 flex items-center justify-center text-emerald-800">
                    <TrendingUp size={18} />
                  </div>
                  <span className="text-xs font-semibold text-charcoal-500">รายได้รวม</span>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-emerald-800 tabular-nums">
                    ฿{totalRevenue.toLocaleString()}
                  </p>
                  <p className="text-[11px] text-charcoal-400 mt-1 font-medium">รวมห้องพักและเรือคายัค</p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-stone-200/80 bg-white shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-forest-800/10 flex items-center justify-center text-forest-800">
                    <CalendarDays size={18} />
                  </div>
                  <span className="text-xs font-semibold text-charcoal-500">จองห้องพัก (อนุมัติ)</span>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-forest-800 tabular-nums">
                    {roomStats.approved_count || 0} รายการ
                  </p>
                  <p className="text-[11px] text-charcoal-400 mt-1 font-medium">
                    รอ {roomStats.pending_count || 0} | ยกเลิก {roomStats.cancelled_count || 0}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-stone-200/80 bg-white shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-lagoon-50 flex items-center justify-center text-lagoon-700">
                    <Sailboat size={18} />
                  </div>
                  <span className="text-xs font-semibold text-charcoal-500">จองเรือ (อนุมัติ)</span>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-lagoon-700 tabular-nums">
                    {kayakStats.approved_count || 0} รายการ
                  </p>
                  <p className="text-[11px] text-charcoal-400 mt-1 font-medium">
                    รอ {kayakStats.pending_count || 0} | ยกเลิก {kayakStats.cancelled_count || 0}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl border border-stone-200/80 bg-white shadow-2xs flex flex-col justify-between">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <Users size={18} />
                  </div>
                  <span className="text-xs font-semibold text-charcoal-500">สมาชิกทั้งหมด</span>
                </div>
                <div>
                  <p className="font-display text-2xl font-bold text-indigo-700 tabular-nums">
                    {data.total_members || 0} คน
                  </p>
                  <p className="text-[11px] text-charcoal-400 mt-1 font-medium">ผู้ใช้งานลงทะเบียนในระบบ</p>
                </div>
              </div>
            </div>

            {/* Revenue Breakdown */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-5 bg-white rounded-2xl border border-stone-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-forest-800/10 text-forest-800 rounded-lg">
                      <Home size={18} />
                    </div>
                    <h3 className="font-bold text-forest-800 text-sm">ห้องพัก</h3>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md">
                    รวม ฿{roomRevenue.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-stone-100 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-charcoal-500 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" /> อนุมัติแล้ว
                    </span>
                    <span className="font-bold text-emerald-700">{roomStats.approved_count || 0} รายการ</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-charcoal-500 flex items-center gap-1.5">
                      <Clock size={14} className="text-amber-500" /> รอดำเนินการ
                    </span>
                    <span className="font-bold text-amber-600">{roomStats.pending_count || 0} รายการ</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-charcoal-500 flex items-center gap-1.5">
                      <XCircle size={14} className="text-rose-500" /> ยกเลิก / ปฏิเสธ
                    </span>
                    <span className="font-bold text-rose-600">{roomStats.cancelled_count || 0} รายการ</span>
                  </div>
                </div>
              </div>

              <div className="p-5 bg-white rounded-2xl border border-stone-200/80 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-lagoon-50 text-lagoon-700 rounded-lg">
                      <Sailboat size={18} />
                    </div>
                    <h3 className="font-bold text-forest-800 text-sm">เรือคายัค</h3>
                  </div>
                  <span className="text-xs font-bold text-lagoon-700 bg-lagoon-50 px-2.5 py-1 rounded-md">
                    รวม ฿{kayakRevenue.toLocaleString()}
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-stone-100 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-charcoal-500 flex items-center gap-1.5">
                      <CheckCircle2 size={14} className="text-emerald-600" /> อนุมัติแล้ว
                    </span>
                    <span className="font-bold text-emerald-700">{kayakStats.approved_count || 0} รายการ</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-charcoal-500 flex items-center gap-1.5">
                      <Clock size={14} className="text-amber-500" /> รอดำเนินการ
                    </span>
                    <span className="font-bold text-amber-600">{kayakStats.pending_count || 0} รายการ</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-charcoal-500 flex items-center gap-1.5">
                      <XCircle size={14} className="text-rose-500" /> ยกเลิก / ปฏิเสธ
                    </span>
                    <span className="font-bold text-rose-600">{kayakStats.cancelled_count || 0} รายการ</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Monthly Bar Chart Visualizer */}
            {period === 'month' && allDays.length > 0 && (
              <div className="p-5 bg-white rounded-2xl border border-stone-200/80 shadow-2xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-forest-800 text-sm flex items-center gap-2">
                    <BarChart3 size={18} className="text-emerald-700" /> 
                    กราฟรายได้รายวัน (เดือน {MONTHS[Number(month) - 1]} {Number(year) + 543})
                  </h3>
                  <div className="flex items-center gap-4 text-xs font-medium text-charcoal-500">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-forest-800 inline-block" /> ห้องพัก
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-xs bg-lagoon-500 inline-block" /> เรือคายัค
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto pt-4">
                  <div className="flex items-end gap-1.5 min-w-max h-48 pb-6 border-b border-stone-100">
                    {allDays.map((day) => {
                      const dayStr = String(day);
                      const r = roomChart.find((x: any) => String(x.day) === dayStr);
                      const k = kayakChart.find((x: any) => String(x.day) === dayStr);
                      const rv = Number(r?.revenue || 0);
                      const kv = Number(k?.revenue || 0);
                      const total = rv + kv;
                      const barH = Math.round((total / maxRevenue) * 130);
                      const rH = total > 0 ? Math.round((rv / total) * barH) : 0;
                      const kH = barH - rH;
                      const dayNum = dayStr.slice(-2).replace(/^0/, '');

                      return (
                        <div key={dayStr} className="flex flex-col items-center gap-1 w-7 group relative">
                          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-forest-900 text-white text-[10px] font-semibold rounded-lg px-2 py-1 opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-20 shadow-md">
                            วันที่ {dayNum}: ฿{total.toLocaleString()}
                          </div>

                          <div className="flex flex-col-reverse w-4 rounded-t-xs overflow-hidden bg-stone-100">
                            {kH > 0 && <div className="bg-lagoon-500 w-full transition-all" style={{ height: kH }} />}
                            {rH > 0 && <div className="bg-forest-800 w-full transition-all" style={{ height: rH }} />}
                          </div>

                          <span className="text-[10px] font-medium text-charcoal-400 group-hover:text-forest-800">
                            {dayNum}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}