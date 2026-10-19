"use client";

import { useState } from 'react';
import { RefreshCw, Search, RotateCcw, BedDouble, Ship, CalendarDays, SlidersHorizontal } from 'lucide-react';
import { CustomDatePicker, CustomSelect } from '@/components/admin/ui';
import { toISODate } from '@/lib/date';
import type { BookingListFilter, BookingListSort } from '@/lib/admin-booking-list';

interface BookingListToolbarProps {
  service: 'room' | 'boat';
  compact?: boolean;
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
  const [showAdvanced, setShowAdvanced] = useState(false);
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

  if (p.compact) {
    const statusLabels: Record<BookingListFilter, string> = {
      all: 'ทั้งหมด', has_slip: 'รอตรวจสอบสลิป', pending: 'ยังไม่ชำระเงิน',
      approved: 'อนุมัติแล้ว', checked_out: room ? 'เช็คเอาต์แล้ว' : 'คืนเรือแล้ว', cancelled: 'ยกเลิกแล้ว', rejected: 'ถูกปฏิเสธ',
    };
    const compactInput = 'min-w-0 rounded-xl border border-cream-200 bg-cream-50/50 px-3 py-2 text-xs text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-500/30';
    return (
      <section aria-label={`ตัวกรองการจอง${serviceLabel}`} className="rounded-3xl border border-cream-200 bg-white p-5 shadow-panel sm:p-6 print:hidden">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-xs">
          <h2 className="flex items-center gap-2 text-charcoal-600">ตัวกรอง: <span className="rounded-full border border-cream-200 bg-cream-50 px-3 py-1 font-semibold text-forest-900">{statusLabels[p.filter]}</span></h2>
          <div className="flex flex-wrap items-center gap-3">
          {p.active && <button type="button" onClick={p.onReset} className="flex items-center gap-1.5 rounded-lg py-1 font-medium text-charcoal-600 hover:text-forest-800"><RotateCcw size={13} />รีเซ็ตตัวกรอง</button>}
          <button type="button" aria-expanded={showAdvanced} onClick={() => setShowAdvanced(value => !value)} className="flex items-center gap-1.5 rounded-lg py-2 font-medium text-charcoal-500 hover:text-forest-800"><SlidersHorizontal size={13} />ตัวกรองเพิ่มเติม</button>
          <button type="button" onClick={p.onRefresh} disabled={p.loading}
            title={p.updatedAt ? `อัปเดตล่าสุด ${new Date(p.updatedAt).toLocaleTimeString('th-TH')}` : undefined}
            className="flex items-center gap-1.5 rounded-full border border-cream-300 px-3 py-2 text-charcoal-600 hover:bg-forest-50 disabled:opacity-50">
            <RefreshCw size={14} className={p.loading ? 'animate-spin' : ''} /> รีเฟรชข้อมูล
          </button>
          </div>
        </div>
        <div className="grid min-w-0 items-center gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(160px,1.6fr)_minmax(150px,1fr)_minmax(320px,1.15fr)_auto]">
          <label className="relative block min-w-0">
            <span className="sr-only">ค้นหาเลขจอง ชื่อลูกค้า เบอร์โทร หรือ{room ? 'เลขห้อง' : 'ประเภทเรือ'}</span>
            <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-charcoal-400" />
            <input aria-label="ค้นหาการจอง" type="search" value={p.search} onChange={e => p.onSearch(e.target.value)} placeholder={room ? 'ค้นหาชื่อ, เบอร์โทร, ห้อง, ID...' : 'ค้นหาชื่อ, เบอร์โทร, ประเภทเรือ, ID...'} className={`${compactInput} w-full rounded-full pl-9`} />
          </label>
          <div role="group" aria-label={`ประเภท${serviceLabel}`} className="flex min-w-0 items-center gap-2 rounded-2xl border border-cream-200 px-3 py-1 text-xs text-charcoal-600">
            {room ? <BedDouble size={14} className="shrink-0 text-forest-700" /> : <Ship size={14} className="shrink-0 text-forest-700" />}<span className="shrink-0">ประเภท:</span>
            <CustomSelect value={p.type} onChange={(value: string) => p.onQuery({ [room ? 'roomType' : 'boatType']: value, page: 1 })}
              options={[{ value: 'all', label: 'ทั้งหมดทุกประเภท' }, ...p.types.map(type => ({ value: type, label: type }))]}
              buttonClassName="flex w-full min-w-0 items-center justify-between gap-2 rounded-xl bg-cream-50/50 px-3 py-2 text-xs font-semibold text-charcoal-800" />
          </div>
          <div className="flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-cream-200 px-3 py-2 text-xs text-charcoal-600 sm:flex-row sm:items-center sm:py-1">
            <span className="flex shrink-0 items-center gap-2"><CalendarDays size={14} className="text-forest-700" />วันที่:</span>
            <div role="group" aria-label="วันที่เริ่มต้น" className="min-w-0 flex-1"><CustomDatePicker mobileCentered value={p.dateFrom} max={p.dateTo || undefined} onChange={value => setDates(value, p.dateTo)} placeholder="เริ่ม" className="relative w-full" buttonClassName={compactInput + ' flex w-full items-center justify-between gap-1 px-2'} /></div>
            <span className="hidden sm:inline">–</span>
            <div role="group" aria-label="วันที่สิ้นสุด" className="min-w-0 flex-1"><CustomDatePicker mobileCentered align="right" value={p.dateTo} min={p.dateFrom || undefined} onChange={value => setDates(p.dateFrom, value)} placeholder="สิ้นสุด" className="relative w-full" buttonClassName={compactInput + ' flex w-full items-center justify-between gap-1 px-2'} /></div>
          </div>
          <div className="flex items-center justify-end gap-1 text-xs">
            {([['today', 'วันนี้'], ['week', 'สัปดาห์นี้'], ['month', 'เดือนนี้']] as const).map(([range, label]) => <button key={range} type="button" onClick={() => applyRange(range)} className="whitespace-nowrap rounded-full bg-cream-50 px-2.5 py-2 font-medium text-charcoal-600 hover:bg-forest-50">{label}</button>)}
          </div>
        </div>
        {showAdvanced && <div className="mt-3 text-xs text-charcoal-500">
          <div className="mt-3 grid gap-3 border-t border-cream-100 pt-3 sm:grid-cols-3">
            <label className="space-y-1"><span>สถานะการจอง</span>
              <select aria-label="สถานะการจอง" value={p.filter} onChange={e => p.onQuery({ filter: e.target.value, page: 1 })} className={inputClass}>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-1"><span>เรียงรายการ</span>
              <select aria-label="เรียงรายการ" value={p.sort} onChange={e => p.onQuery({ sort: e.target.value, page: 1 })} className={inputClass}>
                <option value="newest">จองล่าสุดก่อน</option><option value="oldest">จองเก่าก่อน</option><option value="service_asc">{room ? 'วันเช็คอิน (ก่อน → หลัง)' : 'วันและรอบ (ก่อน → หลัง)'}</option><option value="price_desc">ยอดรวมมากที่สุดก่อน</option>
              </select>
            </label>
            <label className="space-y-1"><span>รายการต่อหน้า</span>
              <select aria-label="รายการต่อหน้า" value={p.limit} onChange={e => p.onQuery({ limit: e.target.value, page: 1 })} className={inputClass}>
                {[10, 25, 50].map(limit => <option key={limit} value={limit}>{limit} รายการ</option>)}
              </select>
            </label>
          </div>
          <p className="mt-3" aria-live="polite">อัปเดตอัตโนมัติทุก 15 วินาที{p.updatedAt ? ` · ล่าสุด ${new Date(p.updatedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}</p>
        </div>}
      </section>
    );
  }

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
