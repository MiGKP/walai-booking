"use client";

import { RefreshCw, Search, RotateCcw } from 'lucide-react';
import { toISODate } from '@/lib/date';
import type { BookingListFilter, BookingListSort } from '@/lib/admin-booking-list';

interface BookingListToolbarProps {
  service: 'room' | 'boat';
  filter: BookingListFilter;
  search: string;
  type: string;
  types: string[];
  dateFrom: string;
  dateTo: string;
  sort: BookingListSort;
  limit: number;
  loading: boolean;
  updatedAt: number | null;
  active: boolean;
  onSearch: (value: string) => void;
  onQuery: (values: Record<string, string | number | null>) => void;
  onReset: () => void;
  onRefresh: () => void;
}

const inputClass = 'w-full min-w-0 rounded-xl border border-cream-300 bg-cream-50 px-3 py-2 text-sm text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30';

export default function BookingListToolbar(p: BookingListToolbarProps): React.ReactElement {
  const room = p.service === 'room';
  const serviceLabel = room ? 'ห้องพัก' : 'เรือ';
  const setDates = (from: string, to: string): void => { p.onQuery({ dateFrom: from, dateTo: to, page: 1 }); };
  const applyRange = (range: 'today' | 'week' | 'month'): void => {
    const start = new Date();
    const end = new Date(start);
    if (range === 'week') {
      start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
      end.setTime(start.getTime()); end.setDate(start.getDate() + 6);
    } else if (range === 'month') {
      start.setDate(1); end.setMonth(end.getMonth() + 1, 0);
    }
    setDates(toISODate(start), toISODate(end));
  };

  return (
    <section aria-label={`ตัวกรองการจอง${serviceLabel}`} className="space-y-4 rounded-2xl border border-cream-200 bg-white p-4 sm:p-5 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold text-forest-900">ค้นหาและกรองรายการ</h2>
        <div className="flex flex-wrap items-center gap-3 text-xs text-charcoal-500">
          <span aria-live="polite">อัปเดตอัตโนมัติทุก 15 วินาที{p.updatedAt ? ` · ล่าสุด ${new Date(p.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}</span>
          <button type="button" onClick={p.onRefresh} disabled={p.loading} className="flex items-center gap-1.5 rounded-lg border border-cream-300 px-3 py-2 hover:bg-forest-50 disabled:opacity-50">
            <RefreshCw size={14} className={p.loading ? 'animate-spin' : ''} /> รีเฟรชข้อมูล
          </button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1 text-xs font-medium text-charcoal-600 sm:col-span-2">
          <span>ค้นหาเลขจอง ชื่อลูกค้า เบอร์โทร หรือ{room ? 'เลขห้อง' : 'ประเภทเรือ'}</span>
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3 top-3 text-charcoal-400" />
            <input aria-label="ค้นหาการจอง" type="search" value={p.search} onChange={e => p.onSearch(e.target.value)} placeholder={room ? 'เช่น 125, ชื่อลูกค้า หรือ W5' : 'เช่น 67, ชื่อลูกค้า หรือคายัค'} className={`${inputClass} pl-9`} />
          </div>
        </label>
        <label className="space-y-1 text-xs font-medium text-charcoal-600">
          <span>สถานะการจอง</span>
          <select aria-label="สถานะการจอง" value={p.filter} onChange={e => p.onQuery({ filter: e.target.value, page: 1 })} className={inputClass}>
            <option value="all">ทุกสถานะ</option><option value="has_slip">รอตรวจสอบสลิป</option><option value="pending">ยังไม่ชำระเงิน</option><option value="approved">อนุมัติแล้ว</option><option value="checked_out">{room ? 'เช็คเอาต์แล้ว' : 'คืนเรือแล้ว'}</option><option value="cancelled">ยกเลิกแล้ว</option><option value="rejected">ถูกปฏิเสธ</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-charcoal-600">
          <span>ประเภท{serviceLabel}</span>
          <select aria-label={`ประเภท${serviceLabel}`} value={p.type} onChange={e => p.onQuery({ [room ? 'roomType' : 'boatType']: e.target.value, page: 1 })} className={inputClass}>
            <option value="all">ทุกประเภท</option>{p.types.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-charcoal-600">
          <span>{room ? 'วันเช็คอิน ตั้งแต่' : 'วันใช้บริการ ตั้งแต่'}</span>
          <input aria-label="วันที่เริ่มต้น" type="date" max={p.dateTo || undefined} value={p.dateFrom} onChange={e => setDates(e.target.value, p.dateTo)} className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-medium text-charcoal-600">
          <span>ถึงวันที่</span>
          <input aria-label="วันที่สิ้นสุด" type="date" min={p.dateFrom || undefined} value={p.dateTo} onChange={e => setDates(p.dateFrom, e.target.value)} className={inputClass} />
        </label>
        <label className="space-y-1 text-xs font-medium text-charcoal-600">
          <span>เรียงรายการ</span>
          <select aria-label="เรียงรายการ" value={p.sort} onChange={e => p.onQuery({ sort: e.target.value, page: 1 })} className={inputClass}>
            <option value="newest">จองล่าสุดก่อน</option><option value="oldest">จองเก่าก่อน</option><option value="service_asc">{room ? 'วันเช็คอิน (ก่อน → หลัง)' : 'วันและรอบ (ก่อน → หลัง)'}</option><option value="price_desc">ยอดรวมมากที่สุดก่อน</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-charcoal-600">
          <span>รายการต่อหน้า</span>
          <select aria-label="รายการต่อหน้า" value={p.limit} onChange={e => p.onQuery({ limit: e.target.value, page: 1 })} className={inputClass}>
            {[10, 25, 50].map(limit => <option key={limit} value={limit}>{limit} รายการ</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cream-100 pt-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-charcoal-500">ช่วงวันด่วน:</span>
          {([['today', 'วันนี้'], ['week', 'สัปดาห์นี้'], ['month', 'เดือนนี้']] as const).map(([range, label]) => <button key={range} type="button" onClick={() => applyRange(range)} className="rounded-lg bg-cream-100 px-3 py-2 font-medium text-forest-800 hover:bg-forest-50">{label}</button>)}
        </div>
        {p.active && <button type="button" onClick={p.onReset} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-charcoal-600 hover:bg-cream-100"><RotateCcw size={13} />รีเซ็ตตัวกรอง</button>}
      </div>
    </section>
  );
}
