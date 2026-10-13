'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, Home, Sailboat, TrendingUp, Users, Search, CalendarDays, CheckCircle2, Clock, XCircle } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { notify } from '@/lib/admin-notify';
import { PageHeader, Panel, StatCard, StatusBadge, CustomDatePicker, CustomSelect } from '@/components/admin/ui';
import { toISODate } from '@/lib/date';
type Value = string | number;
interface Summary { total_count: number; approved_count: number; pending_count: number; paid_count: number; cancelled_count: number; rejected_count: number; revenue: Value; awaiting_approval_amount: Value; }
interface PackageRow { id: number; name: string; code: string; booking_count: number; revenue: Value; peak_dates: string; }
interface InventoryRow { date: string; type_name: string; total: number; booked: number; available: number; start_time?: string; end_time?: string; }
interface ChartRow { day: string; revenue: Value; }
interface Report { room_summary?: Summary; kayak_summary?: Summary; total_members?: number; packages?: PackageRow[]; room_inventory?: InventoryRow[]; boat_inventory?: InventoryRow[]; room_chart?: ChartRow[]; kayak_chart?: ChartRow[]; start: string; end: string; }
const money = (v: Value | undefined): string => '฿' + Number(v ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thaiDate = (date: string): string => new Date(date + 'T00:00:00+07:00').toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' });

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

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
          <span className="font-semibold text-forest-700">{stats?.approved_count || 0} รายการ</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-charcoal-500">
            <Clock size={15} className="text-bamboo-500" /> รอดำเนินการ
          </span>
          <span className="font-semibold text-bamboo-600">{(stats?.pending_count || 0) + (stats?.paid_count || 0)} รายการ</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-charcoal-500">
            <XCircle size={15} className="text-rose-500" /> ยกเลิก / ปฏิเสธ
          </span>
          <span className="font-semibold text-rose-600">{(stats?.cancelled_count || 0) + (stats?.rejected_count || 0)} รายการ</span>
        </div>
      </div>
    </Panel>
  );
}

function ReportTable({ title, headers, rows }: { title: string; headers: string[]; rows: Value[][] }): React.ReactElement {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(rows.length / 25));
  const current = Math.min(page, pages);
  return <Panel title={title}>
    {!rows.length ? <p className="text-sm text-charcoal-500 py-5">ไม่มีข้อมูลในช่วงที่เลือก</p> : <>
      <div className="overflow-x-auto rounded-xl border border-cream-200">
        <table className="w-full text-sm whitespace-nowrap"><thead className="bg-cream-100 text-forest-800"><tr>{headers.map(h => <th key={h} className="p-3 text-left font-semibold">{h}</th>)}</tr></thead>
        <tbody>{rows.slice((current - 1) * 25, current * 25).map((row, i) => <tr key={i} className="border-t border-cream-200 hover:bg-cream-50">{row.map((cell, j) => <td key={j} className="p-3 text-charcoal-700">{cell}</td>)}</tr>)}</tbody></table>
      </div>
      <div className="flex flex-wrap justify-between items-center gap-3 mt-3 text-xs text-charcoal-500"><span>{rows.length.toLocaleString()} รายการ · หน้า {current}/{pages}</span>
      <div className="flex gap-2"><button type="button" className="btn-secondary disabled:opacity-40" disabled={current === 1} onClick={() => setPage(current - 1)}>ก่อนหน้า</button><button type="button" className="btn-secondary disabled:opacity-40" disabled={current === pages} onClick={() => setPage(current + 1)}>ถัดไป</button></div></div>
    </>}
  </Panel>;
}

export default function StatsPage(): React.ReactElement | null {
  const { ready, user } = useAuthGuard({ allowedRoles: ['admin', 'room_staff', 'boat_staff'] });
  const [period, setPeriod] = useState<'day' | 'month'>('month');
  const [date, setDate] = useState(toISODate(new Date()));
  const [month, setMonth] = useState(toISODate(new Date()).slice(0, 7));
  const [result, setResult] = useState<{ key: string; report: Report | null } | null>(null);
  const [reload, setReload] = useState(0);
  const requestId = useRef(0);
  const role = user?.role;
  const requestKey = `${role}:${period}:${period === 'day' ? date : month}:${reload}`;
  const report = result?.key === requestKey ? result.report : null;
  const loading = ready && result?.key !== requestKey;
  const showRoom = role === 'admin' || role === 'room_staff';
  const showBoat = role === 'admin' || role === 'boat_staff';
  useEffect(() => {
    if (!ready) return;
    const id = ++requestId.current;
    const params = period === 'day' ? { period, date } : { period, year: month.slice(0, 4), month: month.slice(5) };
    api.get<{ data: Report }>('/settings/stats', { params }).then(res => {
      if (id === requestId.current) setResult({ key: requestKey, report: res.data.data });
    }).catch((error: unknown) => {
      if (id === requestId.current) {
        setResult({ key: requestKey, report: null });
        notify.error(getApiErrorMessage(error, 'ไม่สามารถโหลดรายงานได้'));
      }
    });
    return () => { if (requestId.current === id) requestId.current = id + 1; };
  }, [ready, requestKey, period, date, month]);
  if (!ready) return null;
  const summaryRows = (s: Summary | undefined): Value[][] => s ? [
    ['การจองทั้งหมด', s.total_count], ['รอชำระเงิน', s.pending_count], ['รอตรวจสลิป', s.paid_count],
    ['อนุมัติ / ใช้บริการแล้ว', s.approved_count], ['ยกเลิก', s.cancelled_count], ['ปฏิเสธ', s.rejected_count],
    ['รายรับที่อนุมัติแล้ว', money(s.revenue)], ['ยอดรอตรวจสลิป', money(s.awaiting_approval_amount)],
  ] : [];
  const packages: Value[][] = (report?.packages ?? []).map(p => [p.name, p.code, p.booking_count, money(p.revenue), (p.peak_dates ?? '').split(', ').filter(Boolean).map(thaiDate).join(', ') || '-']);
  const roomInventory: Value[][] = (report?.room_inventory ?? []).map(r => [thaiDate(r.date), r.type_name, r.total, r.booked, r.available]);
  const boatInventory: Value[][] = (report?.boat_inventory ?? []).map(r => [thaiDate(r.date), (r.start_time?.slice(0, 5) ?? '') + '–' + (r.end_time?.slice(0, 5) ?? ''), r.type_name, r.total, r.booked, r.available]);
  const packageHeaders = ['ชื่อแพ็คเกจ / โปรโมชั่น', 'โค้ด', 'จำนวนการจอง', 'รายรับห้องพัก', 'วันที่มีการจองมากที่สุด'];
  const inventoryHeaders = ['วันที่', 'ประเภท', 'ทั้งหมด', 'จองแล้ว', 'คงเหลือ'];
  const boatHeaders = ['วันที่', 'รอบเวลา', 'ประเภท', 'ทั้งหมด', 'จองแล้ว', 'คงเหลือ'];
  const dailyRevenue = new Map<string, number>();
  for (const row of [...(showRoom ? report?.room_chart ?? [] : []), ...(showBoat ? report?.kayak_chart ?? [] : [])]) dailyRevenue.set(row.day, (dailyRevenue.get(row.day) ?? 0) + Number(row.revenue));
  const dailyRows: Value[][] = [...dailyRevenue.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, amount]) => [thaiDate(day), money(amount)]);
  const exportCsv = (): void => {
    if (!report || loading) return;
    const rows: Value[][] = [['รายงานสวนวลัยรุกขเวช'], ['ช่วงรายงาน', report.start, report.end]];
    if (showRoom) rows.push([], ['สรุปห้องพัก'], ...summaryRows(report.room_summary), [], packageHeaders, ...packages, [], ['จำนวนห้องพัก'], inventoryHeaders, ...roomInventory);
    if (showBoat) rows.push([], ['สรุปเรือ'], ...summaryRows(report.kayak_summary), [], ['จำนวนเรือตามรอบ'], boatHeaders, ...boatInventory);
    rows.push([], ['รายรับรายวัน'], ['วันที่', 'รายรับ'], ...dailyRows);
    const cell = (value: Value): string => {
      const raw = String(value); const safe = /^[\s]*[=+@-]/.test(raw) ? "'" + raw : raw;
      return '"' + safe.replace(/"/g, '""') + '"';
    };
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'walai-report-' + report.start + '-' + report.end + '.csv';
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const periodBtn = (id: 'day' | 'month', label: string): React.ReactElement => <button type="button" aria-pressed={period === id} onClick={() => setPeriod(id)} className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${period === id ? 'bg-forest-800 text-cream-100' : 'text-charcoal-500 hover:bg-charcoal-50'}`}>{label}</button>;
  const years = [...new Set([2024, 2025, 2026, 2027, new Date().getFullYear(), Number(month.slice(0, 4))])].sort();
  const roomChart = showRoom ? report?.room_chart ?? [] : [];
  const kayakChart = showBoat ? report?.kayak_chart ?? [] : [];
  const allDays = [...dailyRevenue.keys()].sort();
  const maxRevenue = Math.max(1, ...dailyRevenue.values());
  return <div className="space-y-6 pb-12 min-w-0">
    <PageHeader title="รายงานสถิติ" actions={<button type="button" disabled={!report || loading} onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl bg-forest-800 px-4 py-2.5 text-xs font-semibold text-cream-100 transition-colors hover:bg-forest-900 disabled:opacity-40"><Download size={15} /> ส่งออก CSV</button>} />
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
              <CustomDatePicker
                mobileCentered
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
                  value={month.slice(5)}
                  onChange={(val: string) => setMonth(month.slice(0, 4) + '-' + val)}
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
                  value={month.slice(0, 4)}
                  onChange={(val: string) => setMonth(val + month.slice(4))}
                  options={years.map((y) => ({
                    value: String(y),
                    label: String(y + 543),
                  }))}
                />
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => setReload(v => v + 1)}
            disabled={loading}
            className="flex h-[34px] items-center gap-1.5 rounded-xl bg-forest-800 px-5 py-2 text-xs font-semibold text-cream-100 transition-colors hover:bg-forest-900 disabled:opacity-60"
          >
            <Search size={14} /> ค้นหา
          </button>
        </div>
      </Panel>

    {loading ? <p role="status" className="text-charcoal-500 py-6">กำลังโหลดรายงาน…</p> : report && <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="รายได้รวม" hint={role === 'admin' ? 'รวมห้องพักและเรือ' : showRoom ? 'เฉพาะห้องพัก' : 'เฉพาะเรือ'} value={money((showRoom ? Number(report.room_summary?.revenue ?? 0) : 0) + (showBoat ? Number(report.kayak_summary?.revenue ?? 0) : 0))} icon={<TrendingUp />} tone="forest" />
        {showRoom && <StatCard label="จองห้องพัก (อนุมัติ)" value={(report.room_summary?.approved_count ?? 0) + ' รายการ'} hint={`รอ ${(report.room_summary?.pending_count ?? 0) + (report.room_summary?.paid_count ?? 0)} | ยกเลิก ${(report.room_summary?.cancelled_count ?? 0) + (report.room_summary?.rejected_count ?? 0)}`} icon={<CalendarDays />} tone="forest" />}
        {showBoat && <StatCard label="จองเรือ (อนุมัติ)" value={(report.kayak_summary?.approved_count ?? 0) + ' รายการ'} hint={`รอ ${(report.kayak_summary?.pending_count ?? 0) + (report.kayak_summary?.paid_count ?? 0)} | ยกเลิก ${(report.kayak_summary?.cancelled_count ?? 0) + (report.kayak_summary?.rejected_count ?? 0)}`} icon={<Sailboat />} tone="lagoon" />}
        {role === 'admin' && <StatCard label="สมาชิกทั้งหมด" value={(report.total_members ?? 0) + ' คน'} hint="ผู้ใช้งานลงทะเบียนในระบบ" icon={<Users />} tone="bamboo" />}
      </div>
      <div className={'grid gap-4 ' + (showRoom && showBoat ? 'md:grid-cols-2' : '')}>
        {showRoom && <SideBreakdown title="ห้องพัก" icon={<Home size={18} />} tone="forest" stats={report.room_summary} />}
        {showBoat && <SideBreakdown title="เรือ" icon={<Sailboat size={18} />} tone="lagoon" stats={report.kayak_summary} />}
      </div>
            {/* Monthly Bar Chart */}
            {period === 'month' && allDays.length > 0 && (
              <Panel
                className="min-w-0"
                title={`กราฟรายได้รายวัน (เดือน ${MONTHS[Number(month.slice(5)) - 1]} ${Number(month.slice(0, 4)) + 543})`}
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
                <div className="overflow-x-auto pt-4">
                  <div className="flex h-48 min-w-max items-end gap-1.5 border-b border-charcoal-100 pb-6">
                    {allDays.map((day) => {
                      const dayStr = String(day);
                      const r = roomChart.find((x: ChartRow) => String(x.day) === dayStr);
                      const k = kayakChart.find((x: ChartRow) => String(x.day) === dayStr);
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
      <details className="space-y-5"><summary className="cursor-pointer rounded-xl border border-cream-200 bg-white px-4 py-3 text-sm font-semibold text-forest-800">รายละเอียดรายรับ โปรโมชั่น และจำนวนคงเหลือ</summary>
      <p className="text-xs text-charcoal-500">ยอดจองและรายรับนับตามวันที่สร้างการจอง รายรับรวมเฉพาะรายการอนุมัติหรือใช้บริการแล้ว รายรับห้องพักแยกค่าเรือเสริมไปนับในรายรับเรือเพื่อไม่ให้นับซ้ำ จำนวนคงเหลือแสดงตามวันใช้บริการและข้อจำกัดรอบเรือ</p>
      <div className={'grid gap-4 ' + (showRoom && showBoat ? 'md:grid-cols-2' : '')}>
        {showRoom && <ReportTable title="สรุปการจองและชำระเงินห้องพัก" headers={['รายการ', 'ผลรวม']} rows={summaryRows(report.room_summary)} />}
        {showBoat && <ReportTable title="สรุปการจองและชำระเงินเรือ" headers={['รายการ', 'ผลรวม']} rows={summaryRows(report.kayak_summary)} />}
      </div>
      <ReportTable title="รายรับรายวัน" headers={['วันที่สร้างการจอง', 'รายรับที่อนุมัติแล้ว']} rows={dailyRows} />
      {showRoom && <>
        <ReportTable title="การใช้แพ็คเกจและโปรโมชั่นห้องพัก" headers={packageHeaders} rows={packages} />
        <p className="text-xs text-charcoal-500">จำนวนการจองไม่รวมรายการยกเลิกหรือปฏิเสธ รายรับคิดจากห้องที่ใช้โปรโมชั่น หากหลายโค้ดใช้กับยอดรวมทั้งรายการจะแบ่งรายรับเท่ากันระหว่างโค้ด และไม่รวมค่าเรือเสริม</p>
        <ReportTable title="จำนวนห้องพักตามวันและประเภท" headers={inventoryHeaders} rows={roomInventory} />
      </>}
      {showBoat && <ReportTable title="จำนวนเรือตามวัน ประเภท และรอบเวลา" headers={boatHeaders} rows={boatInventory} />}
      </details>
    </>}
  </div>;
}
