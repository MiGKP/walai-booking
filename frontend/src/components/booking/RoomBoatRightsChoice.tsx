'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api, { getApiErrorMessage } from '@/lib/api';
import { formatThaiDate, todayISO } from '@/lib/date';
import BoatAddonSection from './BoatAddonSection';
import RoomBoatTicketSummary from './RoomBoatTicketSummary';
import type { BoatTicketSummary } from '@/lib/room-boat-addon';

interface EntitledBooking {
  id: number;
  status: string;
  check_in_date: string;
  check_out_date: string;
  boat_ticket_summary?: BoatTicketSummary;
}
interface BookingDetail {
  status: string;
  boat_ticket_summary?: BoatTicketSummary;
  rooms: Array<{ booking_room_id: number; room_name: string; room_number: string; status?: string }>;
}

function bookingDateLabel(value: string): string {
  const date = value?.slice(0, 10);
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? formatThaiDate(date) : 'ไม่ระบุวันที่';
}

export function canReserveRoomRights(booking: EntitledBooking): boolean {
  const summary = booking.boat_ticket_summary;
  return !!summary && ['pending', 'paid', 'approved'].includes(booking.status)
    && summary.remaining_tickets > 0 && (summary.bookable_tickets ?? summary.remaining_tickets) > 0
    && !!summary.valid_from && !!summary.valid_to && summary.valid_from <= summary.valid_to
    && summary.valid_to >= todayISO()
    && (summary.free_tickets > 0 || booking.status === 'pending');
}

export default function RoomBoatRightsChoice({ memberId, enabled, onChange }: {
  memberId?: number; enabled: boolean; onChange: (enabled: boolean) => void;
}): React.ReactElement | null {
  const [bookings, setBookings] = useState<EntitledBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<BookingDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!memberId) { onChange(false); return; }
    let active = true;
    setLoading(true);
    setError(null);
    setDetail(null);
    setSelectedId(null);
    api.get('/bookings/my').then(({ data }) => {
      if (active) setBookings(data.data ?? []);
    }).catch((err: unknown) => {
      if (active) setError(getApiErrorMessage(err, 'โหลดสิทธิ์เรือไม่สำเร็จ'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [memberId]);

  useEffect(() => {
    if (!enabled || !selectedId || !memberId) return;
    let active = true;
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    api.get(`/bookings/${selectedId}`).then(({ data }) => {
      if (active) setDetail(data.data);
    }).catch((err: unknown) => {
      if (active) setDetailError(getApiErrorMessage(err, 'โหลดห้องต้นทางไม่สำเร็จ'));
    }).finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [enabled, selectedId, memberId]);

  const refresh = async (): Promise<void> => {
    if (!selectedId) return;
    try {
      const [list, booking] = await Promise.all([api.get('/bookings/my'), api.get(`/bookings/${selectedId}`)]);
      setBookings(list.data.data ?? []);
      setDetail(booking.data.data);
    } catch (err: unknown) {
      setDetailError(getApiErrorMessage(err, 'จองสำเร็จแล้ว แต่โหลดสิทธิ์ล่าสุดไม่สำเร็จ กรุณารีเฟรชก่อนจองเพิ่ม'));
    }
  };
  if (!memberId) return null;
  const entitled = bookings.filter(booking => Number(booking.boat_ticket_summary?.total_tickets) > 0);
  if (!loading && !error && entitled.length === 0) return null;
  const selected = bookings.find(booking => booking.id === selectedId);
  return (
    <section className="mb-6 rounded-2xl border border-forest-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-forest-900">สิทธิ์เรือจากการจองห้องพัก</h2>
      {loading ? <p className="mt-2 text-sm text-charcoal-600">กำลังตรวจสิทธิ์ของคุณ...</p> : error ? <p role="alert" className="mt-2 text-sm text-red-600">{error} <button type="button" onClick={() => window.location.reload()} className="underline">ลองใหม่</button></p> : <>
        <label className="mt-3 flex cursor-pointer items-start gap-3 text-sm font-semibold text-forest-800">
          <input type="checkbox" checked={enabled} onChange={event => onChange(event.target.checked)} className="mt-0.5 h-5 w-5 accent-forest-800" />
          ใช้สิทธิ์เรือจากการจองห้องพัก
        </label>
        <p className="mt-2 text-sm leading-relaxed text-charcoal-600">เลือกการจองห้องต้นทางและรอบเรือเพื่อใช้สิทธิ์ แทนการจองเรือแบบชำระแยก · 1 สิทธิ์ = เรือ 1 ลำ 1 รอบ</p>
        {enabled && <div className="mt-4 space-y-4">
          <label className="block text-sm font-semibold text-forest-900">เลือกการจองห้องต้นทาง
            <select value={selectedId ?? ''} onChange={event => setSelectedId(event.target.value ? Number(event.target.value) : null)} className="input-field mt-2 w-full">
              <option value="">กรุณาเลือกการจองห้องพัก</option>
              {entitled.map(booking => <option key={booking.id} value={booking.id}>#{booking.id} · {bookingDateLabel(booking.check_in_date)} – {bookingDateLabel(booking.check_out_date)} · คงเหลือ {booking.boat_ticket_summary?.remaining_tickets} สิทธิ์{canReserveRoomRights(booking) ? '' : ' · ยังใช้ไม่ได้หรือสิ้นสุดแล้ว'}</option>)}
            </select>
          </label>
          {detailLoading ? <p className="text-sm text-charcoal-600">กำลังโหลดสิทธิ์ของแต่ละห้อง...</p> : detailError ? <p role="alert" className="text-sm text-red-600">{detailError}</p> : detail && selected ? <>
            <RoomBoatTicketSummary summary={detail.boat_ticket_summary} bookingStatus={detail.status} />
            {!canReserveRoomRights({ ...selected, status: detail.status, boat_ticket_summary: detail.boat_ticket_summary }) && <div className="rounded-xl bg-cream-100 p-4 text-sm text-forest-900">
              <p className="font-semibold">การจองนี้ยังเลือกวันและรอบเรือไม่ได้</p>
              <p className="mt-1">ดูเงื่อนไขสิทธิ์ด้านบน หรือเลือกการจองห้องพักรายการอื่น</p>
              <Link href="/dashboard" className="mt-3 inline-block font-semibold underline">ดูการจองของฉัน</Link>
            </div>}
            {canReserveRoomRights({ ...selected, status: detail.status, boat_ticket_summary: detail.boat_ticket_summary }) && detail.rooms.filter(room => !['checked_out', 'cancelled', 'rejected'].includes(room.status ?? '')).map(room => <section key={room.booking_room_id} className="rounded-xl border border-stone-200 p-4">
              <h3 className="mb-3 text-sm font-semibold text-forest-900">การจองห้อง #{selectedId} · {room.room_name} · ห้อง {room.room_number}</h3>
              <BoatAddonSection bookingRoomId={room.booking_room_id} roomBookingStatus={detail.status} allowBooking={canReserveRoomRights({ ...selected, status: detail.status, boat_ticket_summary: detail.boat_ticket_summary })} onChanged={refresh} />
            </section>)}
            {detail.status === 'pending' && <Link href={`/payment?booking_type=room&booking_id=${selectedId}`} className="inline-block text-sm font-semibold text-forest-800 underline">ไปชำระค่าห้องพักและค่าเรือที่เลือกเพิ่ม</Link>}
          </> : null}
          <button type="button" onClick={() => onChange(false)} className="text-sm font-semibold text-forest-800 underline">กลับไปจองเรือแบบชำระแยก</button>
        </div>}
      </>}
    </section>
  );
}
