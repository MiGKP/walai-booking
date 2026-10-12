'use client';
import { useEffect, useRef, useState } from 'react';
import { Download, Home, Sailboat, TrendingUp, Users } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { notify } from '@/lib/admin-notify';
import { PageHeader, Panel, StatCard } from '@/components/admin/ui';
import { toISODate } from '@/lib/date';
type Value = string | number;
interface Summary { total_count: number; approved_count: number; pending_count: number; paid_count: number; cancelled_count: number; rejected_count: number; revenue: Value; awaiting_approval_amount: Value; }
interface PackageRow { id: number; name: string; code: string; booking_count: number; revenue: Value; peak_dates: string; }
interface InventoryRow { date: string; type_name: string; total: number; booked: number; available: number; start_time?: string; end_time?: string; }
interface ChartRow { day: string; revenue: Value; }
interface Report { room_summary?: Summary; kayak_summary?: Summary; total_members?: number; packages?: PackageRow[]; room_inventory?: InventoryRow[]; boat_inventory?: InventoryRow[]; room_chart?: ChartRow[]; kayak_chart?: ChartRow[]; start: string; end: string; }
const money = (v: Value | undefined): string => '฿' + Number(v ?? 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const thaiDate = (date: string): string => new Date(date + 'T00:00:00+07:00').toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: 'numeric' });

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
  return <div className="space-y-5 pb-10 min-w-0">
    <PageHeader title="รายงานสถิติ" actions={<button type="button" disabled={!report || loading} onClick={exportCsv} className="btn-primary flex items-center gap-2 disabled:opacity-40"><Download size={16} />ส่งออก CSV</button>} />
    <Panel><div className="flex flex-wrap items-end gap-4">
      <label className="text-sm text-charcoal-600">ช่วงเวลา<select aria-label="ช่วงรายงาน" className="input-field block mt-1" value={period} onChange={e => setPeriod(e.target.value as 'day' | 'month')}><option value="day">รายวัน</option><option value="month">รายเดือน</option></select></label>
      <label className="text-sm text-charcoal-600">{period === 'day' ? 'วันที่' : 'เดือน'}<input aria-label="วันที่หรือเดือนรายงาน" className="input-field block mt-1" type={period === 'day' ? 'date' : 'month'} value={period === 'day' ? date : month} onChange={e => { if (e.target.value) { if (period === 'day') setDate(e.target.value); else setMonth(e.target.value); } }} /></label>
      <button type="button" className="btn-secondary" disabled={loading} onClick={() => setReload(v => v + 1)}>รีเฟรชรายงาน</button>
    </div><p className="mt-3 text-xs text-charcoal-500">ยอดจองและรายรับนับตามวันที่สร้างการจอง รายรับรวมเฉพาะรายการอนุมัติหรือใช้บริการแล้ว รายรับห้องพักแยกค่าเรือเสริมไปนับในรายรับเรือเพื่อไม่ให้นับซ้ำ จำนวนคงเหลือแสดงตามวันใช้บริการและข้อจำกัดรอบเรือ</p></Panel>
    {loading ? <p role="status" className="text-charcoal-500 py-6">กำลังโหลดรายงาน…</p> : report && <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="รายรับที่อนุมัติแล้ว" value={money(Number(report.room_summary?.revenue ?? 0) + Number(report.kayak_summary?.revenue ?? 0))} icon={<TrendingUp />} tone="forest" />
        {showRoom && <StatCard label="การจองห้องพัก" value={(report.room_summary?.total_count ?? 0) + ' รายการ'} icon={<Home />} tone="forest" />}
        {showBoat && <StatCard label="การจองเรือ" value={(report.kayak_summary?.total_count ?? 0) + ' รายการ'} icon={<Sailboat />} tone="lagoon" />}
        {role === 'admin' && <StatCard label="สมาชิกทั้งหมด" value={(report.total_members ?? 0) + ' คน'} icon={<Users />} tone="bamboo" />}
      </div>
      <div className={'grid gap-4 ' + (showRoom && showBoat ? 'xl:grid-cols-2' : '')}>
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
    </>}
  </div>;
}
