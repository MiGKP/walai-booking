'use client';

import { useState, useEffect, useRef } from 'react';
import {
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
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { notify } from '@/lib/admin-notify';
import { PageHeader, StatCard, Panel, Skeleton, StatusBadge } from '@/components/admin/ui';

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const YEARS = [2024, 2025, 2026, 2027];

// Component Custom Dropdown
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
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2 bg-cream-100 hover:bg-cream-200 rounded-xl text-xs font-semibold text-charcoal-700 transition-all focus:outline-none focus:ring-2 focus:ring-forest-800/20"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown
          size={14}
          className={`text-charcoal-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-forest-800' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full bg-white rounded-xl shadow-lg ring-1 ring-charcoal-100 z-50 overflow-hidden py-1 max-h-56 overflow-y-auto">
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
                    ? 'bg-forest-50 text-forest-800 font-bold'
                    : 'text-charcoal-600 hover:bg-cream-100'
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-forest-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SideSummary {
  revenue?: number | string;
  approved_count?: number;
  pending_count?: number;
  cancelled_count?: number;
}

function SideBreakdown({
  title,
  icon,
  tone,
  stats,
}: {
  title: string;
  icon: React.ReactNode;
  tone: 'forest' | 'lagoon';
  stats: SideSummary;
}): React.ReactElement {
  const revenue = Number(stats.revenue || 0);
  return (
    <Panel
      title={title}
      actions={
        <StatusBadge tone={tone === 'forest' ? 'success' : 'info'}>
          รวม ฿{revenue.toLocaleString()}
        </StatusBadge>
      }
    >
      <div className="mb-3 flex items-center gap-2 text-charcoal-400">{icon}</div>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-charcoal-500">
            <CheckCircle2 size={15} className="text-forest-600" /> อนุมัติแล้ว
          </span>
          <span className="font-semibold text-forest-700">{stats.approved_count || 0} รายการ</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-charcoal-500">
            <Clock size={15} className="text-bamboo-500" /> รอดำเนินการ
          </span>
          <span className="font-semibold text-bamboo-600">{stats.pending_count || 0} รายการ</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-charcoal-500">
            <XCircle size={15} className="text-rose-500" /> ยกเลิก / ปฏิเสธ
          </span>
          <span className="font-semibold text-rose-600">{stats.cancelled_count || 0} รายการ</span>
        </div>
      </div>
    </Panel>
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

  // พนักงานเห็นเฉพาะสถิติฝั่งของตัวเอง, แอดมินเห็นทั้งหมด
  const isAdmin = user?.role === 'admin';
  const showRoom = isAdmin || user?.role === 'room_staff';
  const showBoat = isAdmin || user?.role === 'boat_staff';

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
      notify.error('ไม่สามารถโหลดข้อมูลสถิติได้');
    } finally {
      setLoading(false);
    }
  };

  const roomStats = data?.room_summary || {};
  const kayakStats = data?.kayak_summary || {};
  const roomRevenue = showRoom ? Number(roomStats.revenue || 0) : 0;
  const kayakRevenue = showBoat ? Number(kayakStats.revenue || 0) : 0;
  const totalRevenue = roomRevenue + kayakRevenue;

  // Chart calculation
  const roomChart: any[] = showRoom ? data?.room_chart || [] : [];
  const kayakChart: any[] = showBoat ? data?.kayak_chart || [] : [];
  const allDays = Array.from(new Set([...roomChart.map((r: any) => String(r.day)), ...kayakChart.map((r: any) => String(r.day))])).sort();
  const maxRevenue = Math.max(...allDays.map(day => {
    const r = roomChart.find((r: any) => String(r.day) === day);
    const k = kayakChart.find((k: any) => String(k.day) === day);
    return Number(r?.revenue || 0) + Number(k?.revenue || 0);
  }), 1);

  // Export CSV Function
  const handleExportCSV = () => {
    if (!data) {
      notify.error('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const rows: (string | number)[][] = [
      ['รายงานสถิติ สวนวลัยรุกขเวช'],
      ['ช่วงเวลา', period === 'day' ? `วันที่ ${date}` : `เดือน ${MONTHS[Number(month) - 1]} ${Number(year) + 543}`],
      [],
      ['รายการสถิติ', 'สรุปข้อมูล'],
      ['รายได้รวมทั้งหมด (บาท)', totalRevenue],
    ];
    if (showRoom) {
      rows.push(
        ['รายได้ห้องพัก (บาท)', roomRevenue],
        ['จำนวนจองห้องพัก (อนุมัติ)', roomStats.approved_count || 0],
        ['จำนวนจองห้องพัก (รอดำเนินการ)', roomStats.pending_count || 0],
        ['จำนวนจองห้องพัก (ยกเลิก)', roomStats.cancelled_count || 0],
      );
    }
    if (showBoat) {
      rows.push(
        ['รายได้เรือ (บาท)', kayakRevenue],
        ['จำนวนจองเรือ (อนุมัติ)', kayakStats.approved_count || 0],
        ['จำนวนจองเรือ (รอดำเนินการ)', kayakStats.pending_count || 0],
        ['จำนวนจองเรือ (ยกเลิก)', kayakStats.cancelled_count || 0],
      );
    }
    if (isAdmin) rows.push(['จำนวนสมาชิกทั้งหมด', data.total_members || 0]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map((e) => e.join(',')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `stats_report_${period}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    notify.success('ดาวน์โหลดรายงานเรียบร้อยแล้ว');
  };

  if (!ready) return null;

  const periodBtn = (id: 'day' | 'month', label: string) => (
    <button
      type="button"
      onClick={() => setPeriod(id)}
      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        period === id ? 'bg-forest-800 text-cream-100' : 'text-charcoal-500 hover:bg-charcoal-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="รายงานสถิติ"
        description={
          isAdmin
            ? 'ภาพรวมรายได้ สถิติการจอง และการดำเนินงานของสวนวลัยรุกขเวช'
            : showRoom
            ? 'สถิติการจองและรายได้ของห้องพัก'
            : 'สถิติการจองและรายได้ของเรือ'
        }
        actions={
          data && (
            <button
              type="button"
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 rounded-xl bg-forest-800 px-4 py-2.5 text-xs font-semibold text-cream-100 transition-colors hover:bg-forest-900"
            >
              <Download size={15} /> ส่งออก CSV
            </button>
          )
        }
      />

      {/* Filter */}
      <Panel>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-2 block text-xs font-medium text-charcoal-400">ช่วงเวลา</label>
            <div className="flex items-center gap-1 rounded-xl bg-cream-100 p-1">
              {periodBtn('day', 'รายวัน')}
              {periodBtn('month', 'รายเดือน')}
            </div>
          </div>

          {period === 'day' ? (
            <div>
              <label className="mb-2 block text-xs font-medium text-charcoal-400">เลือกวันที่</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-xl bg-cream-100 px-3.5 py-2 text-xs font-semibold text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-forest-800/20"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-xs font-medium text-charcoal-400">เดือน</label>
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
              <div>
                <label className="mb-2 block text-xs font-medium text-charcoal-400">ปี (พ.ศ.)</label>
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
            type="button"
            onClick={fetchStats}
            disabled={loading}
            className="flex h-[34px] items-center gap-1.5 rounded-xl bg-forest-800 px-5 py-2 text-xs font-semibold text-cream-100 transition-colors hover:bg-forest-900 disabled:opacity-60"
          >
            <Search size={14} /> ค้นหา
          </button>
        </div>
      </Panel>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        data && (
          <>
            {/* KPI */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatCard
                label="รายได้รวม"
                value={`฿${totalRevenue.toLocaleString()}`}
                hint={isAdmin ? 'รวมห้องพักและเรือ' : showRoom ? 'เฉพาะห้องพัก' : 'เฉพาะเรือ'}
                icon={<TrendingUp />}
                tone="forest"
              />
              {showRoom && (
                <StatCard
                  label="จองห้องพัก (อนุมัติ)"
                  value={`${roomStats.approved_count || 0} รายการ`}
                  hint={`รอ ${roomStats.pending_count || 0} | ยกเลิก ${roomStats.cancelled_count || 0}`}
                  icon={<CalendarDays />}
                  tone="forest"
                />
              )}
              {showBoat && (
                <StatCard
                  label="จองเรือ (อนุมัติ)"
                  value={`${kayakStats.approved_count || 0} รายการ`}
                  hint={`รอ ${kayakStats.pending_count || 0} | ยกเลิก ${kayakStats.cancelled_count || 0}`}
                  icon={<Sailboat />}
                  tone="lagoon"
                />
              )}
              {isAdmin && (
                <StatCard
                  label="สมาชิกทั้งหมด"
                  value={`${data.total_members || 0} คน`}
                  hint="ผู้ใช้งานลงทะเบียนในระบบ"
                  icon={<Users />}
                  tone="bamboo"
                />
              )}
            </div>

            {/* Breakdown */}
            <div className={`grid gap-4 ${showRoom && showBoat ? 'md:grid-cols-2' : ''}`}>
              {showRoom && (
                <SideBreakdown title="ห้องพัก" icon={<Home size={18} />} tone="forest" stats={roomStats} />
              )}
              {showBoat && (
                <SideBreakdown title="เรือ" icon={<Sailboat size={18} />} tone="lagoon" stats={kayakStats} />
              )}
            </div>

            {/* Monthly Bar Chart */}
            {period === 'month' && allDays.length > 0 && (
              <Panel
                title={`กราฟรายได้รายวัน (เดือน ${MONTHS[Number(month) - 1]} ${Number(year) + 543})`}
                actions={
                  <div className="flex items-center gap-4 text-xs font-medium text-charcoal-500">
                    {showRoom && (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 rounded-sm bg-forest-800" /> ห้องพัก
                      </span>
                    )}
                    {showBoat && (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 rounded-sm bg-lagoon-500" /> เรือ
                      </span>
                    )}
                  </div>
                }
              >
                <div className="overflow-x-auto pt-4">
                  <div className="flex h-48 min-w-max items-end gap-1.5 border-b border-charcoal-100 pb-6">
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
                        <div key={dayStr} className="group relative flex w-7 flex-col items-center gap-1">
                          <div className="pointer-events-none absolute bottom-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-lg bg-forest-900 px-2 py-1 text-xs font-semibold text-white opacity-0 shadow-md transition-all group-hover:opacity-100">
                            วันที่ {dayNum}: ฿{total.toLocaleString()}
                          </div>

                          <div className="flex w-4 flex-col-reverse overflow-hidden rounded-t-sm bg-charcoal-50">
                            {kH > 0 && <div className="w-full bg-lagoon-500 transition-all" style={{ height: kH }} />}
                            {rH > 0 && <div className="w-full bg-forest-800 transition-all" style={{ height: rH }} />}
                          </div>

                          <span className="text-xs font-medium text-charcoal-400 group-hover:text-forest-800">
                            {dayNum}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Panel>
            )}
          </>
        )
      )}
    </div>
  );
}
