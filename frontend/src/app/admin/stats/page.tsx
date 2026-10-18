'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  ChevronRight,
  Layers,
  Table,
  FileSpreadsheet,
} from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { toISODate, formatThaiDate } from '@/lib/date';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { notify } from '@/lib/admin-notify';
import {
  PageHeader,
  StatCard,
  Panel,
  Skeleton,
  StatusBadge,
  CustomDatePicker,
  CustomSelect,
} from '@/components/admin/ui';

type Value = string | number;

interface Summary {
  total_count?: number;
  approved_count?: number;
  pending_count?: number;
  paid_count?: number;
  cancelled_count?: number;
  rejected_count?: number;
  revenue?: Value;
  awaiting_approval_amount?: Value;
}

interface PackageRow {
  id: number;
  name: string;
  code: string;
  booking_count: number;
  revenue: Value;
  peak_dates: string;
}

interface InventoryRow {
  date: string;
  type_name: string;
  total: number;
  booked: number;
  available: number;
  start_time?: string;
  end_time?: string;
}

interface ChartRow {
  day: string;
  revenue: Value;
  approved_count?: number;
}

interface Report {
  room_summary?: Summary;
  kayak_summary?: Summary;
  total_members?: number;
  packages?: PackageRow[];
  room_inventory?: InventoryRow[];
  boat_inventory?: InventoryRow[];
  room_chart?: ChartRow[];
  kayak_chart?: ChartRow[];
  start?: string;
  end?: string;
  period?: 'day' | 'month';
}

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const YEARS = [2024, 2025, 2026, 2027];

const formatMoney = (v: Value | undefined | null): string =>
  '฿' + Number(v ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

const thaiDateDisplay = (dateStr: string): string => {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr + 'T00:00:00+07:00').toLocaleDateString('th-TH', {
      timeZone: 'Asia/Bangkok',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
};

function SideBreakdown({
  title,
  icon,
  tone,
  stats,
}: {
  title: string;
  icon: React.ReactNode;
  tone: 'forest' | 'lagoon';
  stats: Summary | undefined;
}): React.ReactElement {
  const revenue = Number(stats?.revenue || 0);
  const pendingCount = (stats?.pending_count || 0) + (stats?.paid_count || 0);
  const cancelledCount = (stats?.cancelled_count || 0) + (stats?.rejected_count || 0);

  return (
    <Panel
      title={title}
      actions={
        <StatusBadge tone={tone === 'forest' ? 'success' : 'info'}>
          รวม {formatMoney(revenue)}
        </StatusBadge>
      }
    >
      <div className="mb-3 flex items-center gap-2 text-charcoal-400">{icon}</div>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-charcoal-600">
            <CheckCircle2 size={15} className="text-forest-600" /> อนุมัติแล้ว
          </span>
          <span className="font-semibold text-forest-700">{stats?.approved_count || 0} รายการ</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-charcoal-600">
            <Clock size={15} className="text-bamboo-600" /> รอดำเนินการ / ตรวจสลิป
          </span>
          <span className="font-semibold text-bamboo-700">{pendingCount} รายการ</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-charcoal-600">
            <XCircle size={15} className="text-rose-500" /> ยกเลิก / ปฏิเสธ
          </span>
          <span className="font-semibold text-rose-600">{cancelledCount} รายการ</span>
        </div>
      </div>
    </Panel>
  );
}

function ReportTable({
  title,
  headers,
  rows,
}: {
  title: string;
  headers: string[];
  rows: Value[][];
}): React.ReactElement {
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  return (
    <div className="rounded-2xl border border-cream-200/90 bg-white p-4 shadow-2xs">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-cream-100 pb-2.5">
        <h4 className="text-xs font-bold text-forest-900">{title}</h4>
        <span className="text-[11px] text-charcoal-400 font-mono">
          {rows.length.toLocaleString()} รายการ
        </span>
      </div>
      {!rows.length ? (
        <p className="py-6 text-center text-xs text-charcoal-400">ไม่มีข้อมูลในช่วงที่เลือก</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-cream-100">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-cream-100/80 text-forest-800">
                <tr>
                  {headers.map((h) => (
                    <th key={h} className="p-2.5 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100 bg-white">
                {rows.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row, i) => (
                  <tr key={i} className="hover:bg-cream-50/70 transition-colors">
                    {row.map((cell, j) => (
                      <td key={j} className="p-2.5 text-charcoal-700">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="mt-3 flex items-center justify-between gap-2 text-xs text-charcoal-500">
              <span>
                หน้า {currentPage} จาก {totalPages}
              </span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  className="rounded-lg border border-cream-300 bg-white px-2.5 py-1 text-xs font-semibold text-charcoal-600 disabled:opacity-40 hover:bg-cream-100 transition-colors"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  ก่อนหน้า
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-cream-300 bg-white px-2.5 py-1 text-xs font-semibold text-charcoal-600 disabled:opacity-40 hover:bg-cream-100 transition-colors"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  ถัดไป
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function StatsPage(): React.ReactElement | null {
  const { ready, user } = useAuthGuard({ allowedRoles: ['admin', 'room_staff', 'boat_staff'] });
  const [period, setPeriod] = useState<'day' | 'month'>('month');
  const [date, setDate] = useState(toISODate(new Date()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const requestId = useRef(0);

  const role = user?.role;
  const isAdmin = role === 'admin';
  const showRoom = isAdmin || role === 'room_staff';
  const showBoat = isAdmin || role === 'boat_staff';

  const fetchStats = useCallback(async (): Promise<void> => {
    if (!ready) return;
    const currentId = ++requestId.current;
    setLoading(true);
    try {
      const params: Record<string, string> = { period };
      if (period === 'day') {
        params.date = date;
      } else {
        params.month = month;
        params.year = year;
      }
      const res = await api.get<{ success: boolean; data: Report }>('/settings/stats', { params });
      if (currentId === requestId.current) {
        setData(res.data?.data || null);
      }
    } catch (error: unknown) {
      if (currentId === requestId.current) {
        notify.error(getApiErrorMessage(error, 'ไม่สามารถโหลดข้อมูลสถิติได้'));
      }
    } finally {
      if (currentId === requestId.current) {
        setLoading(false);
      }
    }
  }, [ready, period, date, month, year]);

  useEffect(() => {
    if (!ready) return;
    void fetchStats();
  }, [ready, fetchStats]);

  const roomStats = data?.room_summary;
  const kayakStats = data?.kayak_summary;
  const roomRevenue = showRoom ? Number(roomStats?.revenue || 0) : 0;
  const kayakRevenue = showBoat ? Number(kayakStats?.revenue || 0) : 0;
  const totalRevenue = roomRevenue + kayakRevenue;

  // Chart data calculation
  const roomChart = useMemo(() => (showRoom ? data?.room_chart || [] : []), [showRoom, data?.room_chart]);
  const kayakChart = useMemo(() => (showBoat ? data?.kayak_chart || [] : []), [showBoat, data?.kayak_chart]);

  const allDays = useMemo(() => {
    const daysSet = new Set<string>();
    roomChart.forEach((r) => r.day && daysSet.add(String(r.day)));
    kayakChart.forEach((k) => k.day && daysSet.add(String(k.day)));
    return Array.from(daysSet).sort();
  }, [roomChart, kayakChart]);

  const maxRevenue = useMemo(() => {
    if (!allDays.length) return 1;
    const totals = allDays.map((day) => {
      const r = roomChart.find((x) => String(x.day) === day);
      const k = kayakChart.find((x) => String(x.day) === day);
      return Number(r?.revenue || 0) + Number(k?.revenue || 0);
    });
    return Math.max(...totals, 1);
  }, [allDays, roomChart, kayakChart]);

  // Export CSV Function (Safe quoting & UTF-8 BOM)
  const handleExportCSV = () => {
    if (!data) {
      notify.error('ไม่มีข้อมูลสำหรับส่งออก');
      return;
    }

    const safeCell = (value: Value | undefined | null): string => {
      const raw = String(value ?? '');
      const safe = /^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw;
      return '"' + safe.replace(/"/g, '""') + '"';
    };

    const rows: Value[][] = [
      ['รายงานสถิติ สวนวลัยรุกขเวช'],
      [
        'ช่วงเวลา',
        period === 'day'
          ? `วันที่ ${thaiDateDisplay(date)}`
          : `เดือน ${MONTHS[Number(month) - 1]} ${Number(year) + 543}`,
      ],
      [],
      ['รายการสถิติหลัก', 'ยอดรวม (บาท) / จำนวน'],
      ['รายได้รวมทั้งหมด', totalRevenue],
    ];

    if (showRoom && roomStats) {
      rows.push(
        [],
        ['=== สรุปห้องพัก ==='],
        ['รายได้ห้องพัก (ที่อนุมัติ/เช็คเอาต์แล้ว)', Number(roomStats.revenue || 0)],
        ['จำนวนการจองที่อนุมัติแล้ว', roomStats.approved_count || 0],
        ['จำนวนการจองรอดำเนินการ/ตรวจสลิป', (roomStats.pending_count || 0) + (roomStats.paid_count || 0)],
        ['จำนวนการจองยกเลิก/ปฏิเสธ', (roomStats.cancelled_count || 0) + (roomStats.rejected_count || 0)],
      );
      if (roomStats.awaiting_approval_amount) {
        rows.push(['ยอดรอตรวจสลิปห้องพัก', Number(roomStats.awaiting_approval_amount || 0)]);
      }
    }

    if (showBoat && kayakStats) {
      rows.push(
        [],
        ['=== สรุปเรือคายัค ==='],
        ['รายได้เรือคายัค (ที่อนุมัติแล้ว)', Number(kayakStats.revenue || 0)],
        ['จำนวนการจองที่อนุมัติแล้ว', kayakStats.approved_count || 0],
        ['จำนวนการจองรอดำเนินการ/ตรวจสลิป', (kayakStats.pending_count || 0) + (kayakStats.paid_count || 0)],
        ['จำนวนการจองยกเลิก/ปฏิเสธ', (kayakStats.cancelled_count || 0) + (kayakStats.rejected_count || 0)],
      );
      if (kayakStats.awaiting_approval_amount) {
        rows.push(['ยอดรอตรวจสลิปเรือ', Number(kayakStats.awaiting_approval_amount || 0)]);
      }
    }

    if (isAdmin && data.total_members !== undefined) {
      rows.push([], ['จำนวนสมาชิกทั้งหมดในระบบ', data.total_members]);
    }

    // Daily breakdown table
    if (allDays.length > 0) {
      rows.push([], ['=== รายรับรายวัน ==='], ['วันที่', 'รายรับห้องพัก (บาท)', 'รายรับเรือ (บาท)', 'ยอดรวม (บาท)']);
      allDays.forEach((day) => {
        const r = Number(roomChart.find((x) => String(x.day) === day)?.revenue || 0);
        const k = Number(kayakChart.find((x) => String(x.day) === day)?.revenue || 0);
        rows.push([thaiDateDisplay(day), r, k, r + k]);
      });
    }

    // Packages & Inventory if available from backend
    if (data.packages && data.packages.length > 0) {
      rows.push([], ['=== สถิติการใช้แพ็คเกจ / โปรโมชั่น ==='], ['ชื่อโปรโมชั่น', 'โค้ด', 'จำนวนการจอง', 'รายรับ']);
      data.packages.forEach((p) => {
        rows.push([p.name, p.code, p.booking_count, Number(p.revenue || 0)]);
      });
    }

    if (data.room_inventory && data.room_inventory.length > 0) {
      rows.push([], ['=== สต็อกห้องพักตามวัน ==='], ['วันที่', 'ประเภทห้อง', 'ทั้งหมด', 'จองแล้ว', 'คงเหลือ']);
      data.room_inventory.forEach((ri) => {
        rows.push([thaiDateDisplay(ri.date), ri.type_name, ri.total, ri.booked, ri.available]);
      });
    }

    if (data.boat_inventory && data.boat_inventory.length > 0) {
      rows.push([], ['=== สต็อกเรือตามรอบเวลา ==='], ['วันที่', 'รอบเวลา', 'ประเภทเรือ', 'ทั้งหมด', 'จองแล้ว', 'คงเหลือ']);
      data.boat_inventory.forEach((bi) => {
        const timeSlot = bi.start_time ? `${bi.start_time.slice(0, 5)} - ${bi.end_time?.slice(0, 5) || ''}` : '-';
        rows.push([thaiDateDisplay(bi.date), timeSlot, bi.type_name, bi.total, bi.booked, bi.available]);
      });
    }

    const csvContent =
      '\uFEFF' +
      rows
        .map((row) => row.map(safeCell).join(','))
        .join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `walai-stats-${period}-${toISODate(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    notify.success('ส่งออกรายงาน CSV เรียบร้อยแล้ว');
  };

  if (!ready) return null;

  const periodBtn = (id: 'day' | 'month', label: string) => (
    <button
      type="button"
      aria-pressed={period === id}
      onClick={() => setPeriod(id)}
      className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
        period === id ? 'bg-forest-800 text-cream-100 shadow-xs' : 'text-charcoal-500 hover:bg-charcoal-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-6 pb-12 min-w-0">
      <PageHeader
        title="รายงานสถิติ"
        actions={
          <button
            type="button"
            disabled={!data || loading}
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 rounded-xl bg-forest-800 px-4 py-2.5 text-xs font-semibold text-cream-100 transition-colors hover:bg-forest-900 disabled:opacity-40 shadow-xs"
          >
            <Download size={15} /> ส่งออก CSV
          </button>
        }
      />

      {/* Filter Bar */}
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
              <CustomDatePicker
                value={date}
                onChange={(val) => {
                  if (val) setDate(val);
                }}
                placeholder="เลือกวันที่"
                allowClear={false}
                showCalendarIcon
                buttonClassName="flex items-center justify-between gap-2.5 rounded-xl bg-cream-100 hover:bg-white px-3.5 py-2 text-xs font-semibold text-charcoal-700 border border-cream-300 hover:border-forest-300 focus:outline-none focus:ring-2 focus:ring-forest-800/20 transition-all shadow-2xs"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-xs font-medium text-charcoal-400">เดือน</label>
                <CustomSelect
                  width="w-28"
                  value={month}
                  onChange={(val) => setMonth(String(val))}
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
                  onChange={(val) => setYear(String(val))}
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
            onClick={() => void fetchStats()}
            disabled={loading}
            className="flex h-[36px] items-center gap-1.5 rounded-xl bg-forest-800 px-5 py-2 text-xs font-semibold text-cream-100 transition-colors hover:bg-forest-900 disabled:opacity-60 shadow-xs"
          >
            <Search size={14} /> ค้นหา
          </button>
        </div>
      </Panel>

      {/* Main Content Area */}
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-44 rounded-2xl" />
            <Skeleton className="h-44 rounded-2xl" />
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      ) : (
        data && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="รายได้รวม"
                value={formatMoney(totalRevenue)}
                hint={isAdmin ? 'รวมห้องพักและเรือ' : showRoom ? 'เฉพาะห้องพัก' : 'เฉพาะเรือ'}
                icon={<TrendingUp />}
                tone="forest"
              />
              {showRoom && (
                <StatCard
                  label="จองห้องพัก (อนุมัติ)"
                  value={`${roomStats?.approved_count || 0} รายการ`}
                  hint={`รอ ${(roomStats?.pending_count || 0) + (roomStats?.paid_count || 0)} | ยกเลิก ${(roomStats?.cancelled_count || 0) + (roomStats?.rejected_count || 0)}`}
                  icon={<CalendarDays />}
                  tone="forest"
                />
              )}
              {showBoat && (
                <StatCard
                  label="จองเรือ (อนุมัติ)"
                  value={`${kayakStats?.approved_count || 0} รายการ`}
                  hint={`รอ ${(kayakStats?.pending_count || 0) + (kayakStats?.paid_count || 0)} | ยกเลิก ${(kayakStats?.cancelled_count || 0) + (kayakStats?.rejected_count || 0)}`}
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

            {/* Side-by-Side Breakdown Cards */}
            <div className={`grid gap-4 ${showRoom && showBoat ? 'md:grid-cols-2' : ''}`}>
              {showRoom && (
                <SideBreakdown title="ห้องพัก" icon={<Home size={18} />} tone="forest" stats={roomStats} />
              )}
              {showBoat && (
                <SideBreakdown title="เรือคายัค" icon={<Sailboat size={18} />} tone="lagoon" stats={kayakStats} />
              )}
            </div>

            {/* Monthly Bar Chart */}
            {period === 'month' && (
              <Panel
                className="min-w-0"
                title={`กราฟรายได้รายวัน (เดือน ${MONTHS[Number(month) - 1]} ${Number(year) + 543})`}
                actions={
                  <div className="flex items-center gap-4 text-xs font-medium text-charcoal-500">
                    {showRoom && (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 rounded-xs bg-forest-800" /> ห้องพัก
                      </span>
                    )}
                    {showBoat && (
                      <span className="flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 rounded-xs bg-lagoon-500" /> เรือ
                      </span>
                    )}
                  </div>
                }
              >
                {allDays.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-cream-100 flex items-center justify-center text-charcoal-400 mb-2">
                      <BarChart3 size={24} />
                    </div>
                    <p className="text-sm font-semibold text-charcoal-600">ไม่มีข้อมูลรายได้ในเดือนนี้</p>
                    <p className="text-xs text-charcoal-400 mt-1">เมื่อมีการจองที่อนุมัติ ข้อมูลกราฟจะแสดงที่นี่</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto pt-4">
                    <div className="flex h-52 min-w-max items-end gap-2 border-b border-cream-200 pb-6 px-2">
                      {allDays.map((day) => {
                        const dayStr = String(day);
                        const r = roomChart.find((x) => String(x.day) === dayStr);
                        const k = kayakChart.find((x) => String(x.day) === dayStr);
                        const rv = Number(r?.revenue || 0);
                        const kv = Number(k?.revenue || 0);
                        const total = rv + kv;
                        const barH = Math.round((total / maxRevenue) * 140);
                        const rH = total > 0 ? Math.round((rv / total) * barH) : 0;
                        const kH = barH - rH;
                        const dayNum = dayStr.slice(-2).replace(/^0/, '');

                        return (
                          <div key={dayStr} className="group relative flex w-8 flex-col items-center gap-1.5">
                            {/* Hover Tooltip */}
                            <div className="pointer-events-none absolute bottom-10 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-xl bg-forest-950/95 px-3 py-2 text-xs font-semibold text-cream-100 opacity-0 shadow-lg transition-all group-hover:opacity-100 border border-forest-800/40">
                              <p className="font-bold border-b border-white/10 pb-1 mb-1">
                                วันที่ {dayNum} {MONTHS[Number(month) - 1]}
                              </p>
                              {showRoom && (
                                <p className="text-[11px] text-cream-200">
                                  ห้องพัก: {formatMoney(rv)}
                                </p>
                              )}
                              {showBoat && (
                                <p className="text-[11px] text-lagoon-200">
                                  เรือ: {formatMoney(kv)}
                                </p>
                              )}
                              <p className="text-xs font-bold text-white mt-1 pt-1 border-t border-white/10">
                                รวม: {formatMoney(total)}
                              </p>
                            </div>

                            {/* Stacked Bar */}
                            <div className="flex w-5 flex-col-reverse overflow-hidden rounded-t-md bg-cream-100/90 shadow-2xs">
                              {kH > 0 && (
                                <div
                                  className="w-full bg-lagoon-500 transition-all hover:brightness-110"
                                  style={{ height: kH }}
                                />
                              )}
                              {rH > 0 && (
                                <div
                                  className="w-full bg-forest-800 transition-all hover:brightness-110"
                                  style={{ height: rH }}
                                />
                              )}
                            </div>

                            <span className="text-[11px] font-semibold text-charcoal-400 group-hover:text-forest-800 transition-colors">
                              {dayNum}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Panel>
            )}

            {/* Detailed Tables & Stock Section */}
            <div className="rounded-3xl border border-cream-200/90 bg-white p-5 shadow-panel">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="flex w-full items-center justify-between text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cream-100 flex items-center justify-center text-forest-800 shadow-2xs group-hover:bg-forest-50 transition-colors">
                    <Table size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-forest-900">
                      รายละเอียดรายรับ โปรโมชั่น และสต็อกคงเหลือ
                    </h3>
                    <p className="text-xs text-charcoal-400 mt-0.5">
                      ดูตารางสรุปการเงิน สถิติโปรโมชั่น และสต็อกห้องพัก/เรือแบบแจกแจง
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-forest-800 bg-cream-100 group-hover:bg-forest-100 px-3 py-1.5 rounded-xl transition-colors">
                  <span>{showDetails ? 'ซ่อนรายละเอียด' : 'ดูรายละเอียด'}</span>
                  <ChevronDown
                    size={16}
                    className={`transition-transform duration-200 ${showDetails ? 'rotate-180' : ''}`}
                  />
                </div>
              </button>

              {showDetails && (
                <div className="mt-5 space-y-4 pt-5 border-t border-cream-200/80">
                  <p className="text-xs text-charcoal-500 bg-cream-50/80 p-3 rounded-xl border border-cream-200/60">
                    ℹ️ ยอดจองและรายรับนับตามวันที่สร้างการจอง รายรับรวมเฉพาะรายการที่อนุมัติหรือใช้บริการแล้ว
                    รายรับห้องพักแยกค่าเรือเสริมไปนับในรายรับเรือเพื่อความถูกต้อง
                  </p>

                  {/* Summary Tables */}
                  <div className={`grid gap-4 ${showRoom && showBoat ? 'md:grid-cols-2' : ''}`}>
                    {showRoom && roomStats && (
                      <ReportTable
                        title="สรุปการจองและชำระเงินห้องพัก"
                        headers={['รายการ', 'ผลรวม']}
                        rows={[
                          ['การจองทั้งหมด', roomStats.total_count ?? '-'],
                          ['รอชำระเงิน', roomStats.pending_count ?? 0],
                          ['รอตรวจสลิป', roomStats.paid_count ?? 0],
                          ['อนุมัติแล้ว', roomStats.approved_count ?? 0],
                          ['ยกเลิก', roomStats.cancelled_count ?? 0],
                          ['ปฏิเสธ', roomStats.rejected_count ?? 0],
                          ['รายรับที่อนุมัติแล้ว', formatMoney(roomStats.revenue)],
                          ['ยอดรอตรวจสลิป', formatMoney(roomStats.awaiting_approval_amount)],
                        ]}
                      />
                    )}

                    {showBoat && kayakStats && (
                      <ReportTable
                        title="สรุปการจองและชำระเงินเรือคายัค"
                        headers={['รายการ', 'ผลรวม']}
                        rows={[
                          ['การจองทั้งหมด', kayakStats.total_count ?? '-'],
                          ['รอชำระเงิน', kayakStats.pending_count ?? 0],
                          ['รอตรวจสลิป', kayakStats.paid_count ?? 0],
                          ['อนุมัติแล้ว', kayakStats.approved_count ?? 0],
                          ['ยกเลิก', kayakStats.cancelled_count ?? 0],
                          ['ปฏิเสธ', kayakStats.rejected_count ?? 0],
                          ['รายรับที่อนุมัติแล้ว', formatMoney(kayakStats.revenue)],
                          ['ยอดรอตรวจสลิป', formatMoney(kayakStats.awaiting_approval_amount)],
                        ]}
                      />
                    )}
                  </div>

                  {/* Daily Revenue Table */}
                  {allDays.length > 0 && (
                    <ReportTable
                      title="รายรับรายวัน (บาท)"
                      headers={['วันที่', 'รายรับห้องพัก', 'รายรับเรือคายัค', 'ยอดรวมรายได้']}
                      rows={allDays.map((day) => {
                        const r = Number(roomChart.find((x) => String(x.day) === day)?.revenue || 0);
                        const k = Number(kayakChart.find((x) => String(x.day) === day)?.revenue || 0);
                        return [thaiDateDisplay(day), formatMoney(r), formatMoney(k), formatMoney(r + k)];
                      })}
                    />
                  )}

                  {/* Packages / Promotions Table */}
                  {showRoom && data.packages && data.packages.length > 0 && (
                    <ReportTable
                      title="การใช้แพ็คเกจและโปรโมชั่นห้องพัก"
                      headers={['ชื่อแพ็คเกจ / โปรโมชั่น', 'โค้ด', 'จำนวนการจอง', 'รายรับห้องพัก', 'วันที่มีการจองมากที่สุด']}
                      rows={data.packages.map((p) => [
                        p.name,
                        p.code,
                        `${p.booking_count} รายการ`,
                        formatMoney(p.revenue),
                        (p.peak_dates ?? '').split(', ').filter(Boolean).map(thaiDateDisplay).join(', ') || '-',
                      ])}
                    />
                  )}

                  {/* Room Inventory Table */}
                  {showRoom && data.room_inventory && data.room_inventory.length > 0 && (
                    <ReportTable
                      title="จำนวนห้องพักตามวันและประเภท"
                      headers={['วันที่', 'ประเภทห้องพัก', 'ทั้งหมด', 'จองแล้ว', 'คงเหลือ']}
                      rows={data.room_inventory.map((r) => [
                        thaiDateDisplay(r.date),
                        r.type_name,
                        r.total,
                        r.booked,
                        r.available,
                      ])}
                    />
                  )}

                  {/* Boat Inventory Table */}
                  {showBoat && data.boat_inventory && data.boat_inventory.length > 0 && (
                    <ReportTable
                      title="จำนวนเรือตามวัน ประเภท และรอบเวลา"
                      headers={['วันที่', 'รอบเวลา', 'ประเภทเรือ', 'ทั้งหมด', 'จองแล้ว', 'คงเหลือ']}
                      rows={data.boat_inventory.map((r) => [
                        thaiDateDisplay(r.date),
                        r.start_time ? `${r.start_time.slice(0, 5)} - ${r.end_time?.slice(0, 5) || ''}` : '-',
                        r.type_name,
                        r.total,
                        r.booked,
                        r.available,
                      ])}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
