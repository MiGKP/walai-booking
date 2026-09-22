'use client';

import { useState, useEffect } from 'react';
import { CalendarDays, Anchor, XCircle, CreditCard, Timer, Star, LayoutGrid, Clock3, ChevronDown, RefreshCw, CheckCircle2, Tag, MessageSquareWarning, AlertTriangle, LogIn, LogOut, Wallet, Users } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { toastConfirm } from '@/lib/toastConfirm';
import Link from 'next/link';

type BookingType = 'room' | 'kayak';
type TabKey = 'all' | BookingType;

function DeadlineCell({ createdAt, dueDays }: { createdAt: string; dueDays: number }) {
  const deadlineMs = new Date(createdAt).getTime() + dueDays * 24 * 60 * 60 * 1000;
  const deadline = new Date(deadlineMs);
  const isExpired = Date.now() > deadlineMs;
  if (isExpired) return <span className="text-[11px] font-semibold text-red-500">หมดเวลาแล้ว</span>;
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-forest-700">
      <Timer size={13} /> ชำระภายใน {deadline.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
    </span>
  );
}

const statusLabel: Record<string, string> = { pending: 'รอดำเนินการ', paid: 'รอตรวจสอบชำระเงิน', approved: 'ยืนยันแล้ว', cancelled: 'ยกเลิก', rejected: 'ถูกปฏิเสธ', checked_out: 'เช็คเอาต์แล้ว' };
const statusClass: Record<string, string> = { pending: 'bg-orange-50 text-orange-700', paid: 'bg-blue-50 text-blue-700', approved: 'bg-forest-50 text-forest-700', cancelled: 'bg-stone-100 text-stone-500', rejected: 'bg-red-50 text-red-600', checked_out: 'bg-bamboo-50 text-bamboo-600' };
const paymentStatusLabel: Record<string, string> = { pending: 'ยังไม่ชำระ', paid: 'ชำระแล้ว' };

// payment_status ค้างเป็น 'paid' ตลอดหลังส่งสลิป ไม่ถูกอัปเดตเมื่อเจ้าหน้าที่ปฏิเสธ/ยกเลิกภายหลัง
// ถ้าโชว์คู่กับป้ายสถานะ "ถูกปฏิเสธ"/"ยกเลิก" จะดูขัดแย้งกันเอง จึงซ่อนไว้เมื่อ booking จบสถานะแล้วแบบนี้
const isPaymentStatusStale = (status: string): boolean => status === 'rejected' || status === 'cancelled';

function bookingId(b: any): number {
  return b.id || b.room_booking_id || b.boat_booking_id;
}

// แถวรายละเอียด label + value ใช้จัด grid ให้อ่านง่าย
function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-forest-500">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-charcoal-300">{label}</p>
        <p className="truncate text-[12.5px] font-semibold text-charcoal-700">{value}</p>
      </div>
    </div>
  );
}

// รายการ "การจองของฉัน" (ห้องพัก/เรือ) แบบ self-contained — แสดงคู่กับโปรไฟล์ในหน้า /dashboard
// stickyTabs: ใช้เมื่อ panel นี้อยู่ในกล่องที่ overflow-y-auto ของตัวเอง (เช่นหน้า /dashboard) เพื่อให้แถบ filter ทั้งหมด/ห้องพัก/เรือ ค้างอยู่ด้านบนเวลาเลื่อนรายการ
export default function MyBookingsPanel({ ready, stickyTabs = false }: { ready: boolean; stickyTabs?: boolean }) {
  const [tab, setTab] = useState<TabKey>('all');
  const [roomBookings, setRoomBookings] = useState<any[]>([]);
  const [kayakBookings, setKayakBookings] = useState<any[]>([]);
  const [paymentDueDays, setPaymentDueDays] = useState<number>(3);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  // ต่อ booking หนึ่งบิลอาจมีหลายประเภทห้อง แต่ละประเภทรีวิวแยกกันได้ — เก็บเป็น room_booking_id -> เซตของประเภทห้องที่รีวิวแล้ว
  const [reviewedTypesByBooking, setReviewedTypesByBooking] = useState<Map<number, Set<string>>>(new Map());

  const toggleExpanded = (key: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (!ready) return;
    fetchBookings();
  }, [ready]);

  const fetchBookings = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [roomRes, kayakRes, reviewsRes] = await Promise.all([
        api.get('/bookings/room/my'),
        api.get('/kayaks/bookings/my').catch(() => ({ data: { data: [] } })),
        api.get('/reviews/my').catch(() => ({ data: { data: [] } })),
      ]);
      setRoomBookings(roomRes.data?.data || []);
      setKayakBookings(kayakRes.data?.data || []);
      const typesByBooking = new Map<number, Set<string>>();
      (reviewsRes.data?.data || []).forEach((r: any) => {
        const typeKey = r.type_name || r.room_name;
        if (!typesByBooking.has(r.room_booking_id)) typesByBooking.set(r.room_booking_id, new Set());
        typesByBooking.get(r.room_booking_id)!.add(typeKey);
      });
      setReviewedTypesByBooking(typesByBooking);
      const dueDays = Number(roomRes.data?.payment_due_days);
      if (dueDays > 0) setPaymentDueDays(dueDays);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลการจองได้');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCancel = (type: BookingType, id: number) => {
    toastConfirm({
      title: 'ต้องการยกเลิกการจองนี้ใช่หรือไม่?',
      confirmText: 'ยกเลิกการจอง',
      onConfirm: async () => {
        try {
          if (type === 'room') await api.put(`/bookings/${id}/cancel`);
          else await api.put(`/kayaks/bookings/${id}/cancel`);
          toast.success('ยกเลิกการจองสำเร็จ');
          fetchBookings();
        } catch (err: any) {
          toast.error(err.response?.data?.message || 'ยกเลิกไม่สำเร็จ');
        }
      }
    });
  };

  // เรียงลำดับจากการจองล่าสุด (ใหม่ไปเก่า) ตามความต้องการของผู้ใช้งาน
  const combined = [...roomBookings.map((b) => ({ ...b, __type: 'room' as BookingType })), ...kayakBookings.map((b) => ({ ...b, __type: 'kayak' as BookingType }))]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const sortedRooms = [...roomBookings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const sortedKayaks = [...kayakBookings].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const bookings: any[] = tab === 'all' ? combined : tab === 'room' ? sortedRooms : sortedKayaks;

  const renderBookingCard = (b: any, type: BookingType) => {
    const bid = bookingId(b);
    const key = `${type}-${bid}`;
    const isExpanded = expandedIds.has(key);
    const briefDate =
      type === 'room'
        ? `${new Date(b.check_in_date || b.check_in).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(b.check_out_date || b.check_out).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : `${new Date(b.booking_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} · ${b.start_time?.slice(0, 5)} - ${b.end_time?.slice(0, 5)} น.`;

    return (
      <div key={key} className="rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(18,60,48,0.02)]">
        {/* หัวข้อสังเขป — กดเพื่อดูรายละเอียดเพิ่มเติม */}
        <button
          type="button"
          onClick={() => toggleExpanded(key)}
          aria-label={isExpanded ? 'ซ่อนรายละเอียดการจอง' : 'ดูรายละเอียดการจอง'}
          aria-expanded={isExpanded}
          className="flex w-full items-start justify-between gap-4 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              {tab === 'all' && (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-700">
                  {type === 'room' ? <CalendarDays size={12} /> : <Anchor size={12} />}
                </span>
              )}
              <h3 className="truncate text-[14px] font-bold text-forest-900">
                {type === 'room' ? b.room_name : b.kayak_name}
              </h3>
              <span className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold ${statusClass[b.status] || 'bg-stone-100 text-charcoal-500'}`}>
                {statusLabel[b.status] || b.status}
              </span>
            </div>
            <p className="text-[12px] text-charcoal-400">{briefDate}</p>
          </div>
          <div className="flex shrink-0 items-start gap-2">
            <div className="text-right">
              <p className="font-sans text-[16px] font-extrabold text-forest-900">฿{Number(b.total_price).toLocaleString()}</p>
              <p className="mt-1 text-[11px] text-charcoal-400">#{bid}</p>
            </div>
            <ChevronDown size={16} className={`mt-1 shrink-0 text-charcoal-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {isExpanded && (
          <div className="mt-3 space-y-3 border-t border-stone-100 pt-3">
            {/* ข้อมูลสังเขปแบบ grid อ่านง่าย */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              {type === 'room' ? (
                <>
                  <DetailRow
                    icon={<LogIn size={13} />}
                    label="เช็คอิน"
                    value={new Date(b.check_in_date || b.check_in).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                  />
                  <DetailRow
                    icon={<LogOut size={13} />}
                    label="เช็คเอาต์"
                    value={new Date(b.check_out_date || b.check_out).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                  />
                  <DetailRow
                    icon={<Users size={13} />}
                    label="ผู้เข้าพัก"
                    value={`${b.guests || b.guest_count} คน${b.adults != null ? ` (ผู้ใหญ่ ${b.adults}, เด็ก ${b.children ?? 0})` : ''}`}
                  />
                  {b.payment_status && !isPaymentStatusStale(b.status) && (
                    <DetailRow icon={<Wallet size={13} />} label="สถานะชำระเงิน" value={paymentStatusLabel[b.payment_status] || b.payment_status} />
                  )}
                  {b.payment_date && (
                    <DetailRow
                      icon={<CreditCard size={13} />}
                      label="ชำระเมื่อ"
                      value={new Date(b.payment_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    />
                  )}
                  {b.checkin_at && (
                    <DetailRow
                      icon={<LogIn size={13} />}
                      label="เช็คอินจริง"
                      value={new Date(b.checkin_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    />
                  )}
                  {b.checkout_at && (
                    <DetailRow
                      icon={<LogOut size={13} />}
                      label="เช็คเอาต์จริง"
                      value={new Date(b.checkout_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    />
                  )}
                </>
              ) : (
                <>
                  <DetailRow
                    icon={<CalendarDays size={13} />}
                    label="วันที่"
                    value={new Date(b.booking_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                  />
                  <DetailRow icon={<Clock3 size={13} />} label="เวลา" value={`${b.start_time?.slice(0, 5)} - ${b.end_time?.slice(0, 5)} น.`} />
                  <DetailRow icon={<Users size={13} />} label="ผู้โดยสาร" value={`${b.num_passengers} คน`} />
                  {b.payment_status && !isPaymentStatusStale(b.status) && (
                    <DetailRow icon={<Wallet size={13} />} label="สถานะชำระเงิน" value={paymentStatusLabel[b.payment_status] || b.payment_status} />
                  )}
                  {b.payment_date && (
                    <DetailRow
                      icon={<CreditCard size={13} />}
                      label="ชำระเมื่อ"
                      value={new Date(b.payment_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    />
                  )}
                </>
              )}
            </div>

            {/* รายการห้อง/เรือ */}
            {type === 'room' && Array.isArray(b.rooms) && b.rooms.length > 0 && (
              <ul className="space-y-1 text-[11.5px] text-charcoal-500">
                {b.rooms.map((line: { booking_room_id: number; room_name: string; room_number: string; status: string }) => (
                  <li key={line.booking_room_id}>
                    {line.room_name} · ห้อง {line.room_number}
                    {line.status === 'checked_out' ? ' (เช็คเอาต์แล้ว)' : ''}
                  </li>
                ))}
              </ul>
            )}
            {type === 'kayak' && Array.isArray(b.boats) && b.boats.length > 0 && (
              <ul className="space-y-1 text-[11.5px] text-charcoal-500">
                {b.boats.map((line: { booking_boat_id: number; type_name?: string; num_passengers?: number; boat_count?: number }) => (
                  <li key={line.booking_boat_id}>
                    {line.type_name || 'เรือ'} · {line.num_passengers ?? 0} คน · {line.boat_count ?? 0} ลำ
                  </li>
                ))}
              </ul>
            )}

            {/* โปรโมชั่นที่ใช้ */}
            {type === 'room' && Array.isArray(b.promotions) && b.promotions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {b.promotions.map((promo: { name?: string; code?: string; discount_amount: number }, i: number) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 rounded-full bg-bamboo-50 px-3 py-1 text-[11.5px] font-bold text-bamboo-700"
                  >
                    <Tag size={12} /> {promo.name || promo.code} · -฿{Number(promo.discount_amount).toLocaleString()}
                  </span>
                ))}
              </div>
            )}

            {/* คำขอพิเศษ */}
            {type === 'room' && b.special_request && (
              <div className="flex items-start gap-2 rounded-xl bg-stone-50 p-2.5 text-[11.5px] text-charcoal-600">
                <MessageSquareWarning size={14} className="mt-0.5 shrink-0 text-charcoal-400" />
                <p><span className="font-semibold">คำขอพิเศษ:</span> {b.special_request}</p>
              </div>
            )}

            {/* เหตุผลที่ถูกปฏิเสธ */}
            {b.status === 'rejected' && b.reject_reason && (
              <div className="flex items-start gap-2 rounded-xl bg-red-50 p-2.5 text-[11.5px] text-red-700">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
                <p><span className="font-semibold">เหตุผลที่ถูกปฏิเสธ:</span> {b.reject_reason}</p>
              </div>
            )}

            {type === 'room' && b.status === 'approved' && (() => {
              // จองหลายประเภทห้องในบิลเดียวได้ ต้องรีวิวครบทุกประเภทถึงจะถือว่า "รีวิวแล้ว"
              const distinctTypes = new Set(
                (Array.isArray(b.rooms) ? b.rooms : []).map((line: { type_name?: string; room_name: string }) => line.type_name || line.room_name)
              );
              const reviewedTypes = reviewedTypesByBooking.get(bid) ?? new Set<string>();
              const allTypesReviewed = distinctTypes.size > 0 && [...distinctTypes].every((t) => reviewedTypes.has(t as string));
              return (
              <div>
                {allTypesReviewed ? (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-forest-50 px-4 py-2 text-[12.5px] font-bold text-forest-700">
                    <CheckCircle2 size={14} /> รีวิวการพักนี้แล้ว
                  </span>
                ) : (
                  <Link
                    href="/reviews"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-4 py-2 text-[12.5px] font-bold text-amber-600 transition-colors hover:bg-amber-100"
                  >
                    <Star size={14} className="fill-amber-400 text-amber-400" /> เขียนรีวิวการพักนี้
                  </Link>
                )}
              </div>
              );
            })()}
          </div>
        )}

        {b.status === 'pending' && (() => {
          const createdAt = b.created_at;
          const deadlineMs = new Date(createdAt).getTime() + paymentDueDays * 24 * 60 * 60 * 1000;
          const isExpired = Date.now() > deadlineMs;
          return (
            <div className="mt-4 space-y-3 border-t border-stone-100 pt-4">
              {/* Deadline */}
              <div className="flex items-center justify-between rounded-xl bg-orange-50 px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-[11px] font-bold text-orange-700"><Clock3 size={13} /> ชำระเงินภายใน</span>
                <DeadlineCell createdAt={createdAt} dueDays={paymentDueDays} />
              </div>
              {/* Action Buttons */}
              {!isExpired && (
                <div className="flex gap-3">
                  <Link
                    href={`/payment?booking_type=${type}&booking_id=${bid}`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-forest-900 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-forest-800"
                  >
                    <CreditCard size={15} /> ชำระเงิน
                  </Link>
                  <button
                    onClick={() => handleCancel(type, bid)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-[12.5px] font-bold text-red-600 transition-colors hover:bg-red-50"
                  >
                    <XCircle size={15} /> ยกเลิก
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  };

  return (
    <div>
      {/* Booking Type Tabs */}
      <div className={`mb-5 flex items-center justify-between gap-4 border-b border-stone-100 bg-white ${stickyTabs ? 'sticky top-0 z-10' : ''}`}>
        <div className="flex gap-4">
          <button
            onClick={() => setTab('all')}
            className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-[13px] font-bold transition-colors ${tab === 'all' ? 'border-forest-800 text-forest-900' : 'border-transparent text-charcoal-400 hover:text-charcoal-600'}`}
          >
            <LayoutGrid size={15} /> ทั้งหมด ({combined.length})
          </button>
          <button
            onClick={() => setTab('room')}
            className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-[13px] font-bold transition-colors ${tab === 'room' ? 'border-forest-800 text-forest-900' : 'border-transparent text-charcoal-400 hover:text-charcoal-600'}`}
          >
            <CalendarDays size={15} /> ห้องพัก ({roomBookings.length})
          </button>
          <button
            onClick={() => setTab('kayak')}
            className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-[13px] font-bold transition-colors ${tab === 'kayak' ? 'border-forest-800 text-forest-900' : 'border-transparent text-charcoal-400 hover:text-charcoal-600'}`}
          >
            <Anchor size={15} /> เรือ ({kayakBookings.length})
          </button>
        </div>
        <button
          type="button"
          onClick={() => fetchBookings(true)}
          disabled={loading || refreshing}
          aria-label="รีเฟรชรายการจอง"
          title="รีเฟรชรายการจอง"
          className="mb-3 shrink-0 rounded-full p-1.5 text-charcoal-400 transition-colors hover:bg-stone-50 hover:text-forest-800 disabled:opacity-50"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-stone-100" />)}
        </div>
      ) : bookings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-200 py-16 text-center">
          {tab === 'kayak' ? <Anchor size={40} className="mx-auto mb-3 text-stone-300" /> : <CalendarDays size={40} className="mx-auto mb-3 text-stone-300" />}
          <p className="mb-4 text-[13px] text-charcoal-400">ยังไม่มีการจอง</p>
          <Link href={tab === 'kayak' ? '/kayaks' : '/rooms'} className="btn-primary">
            {tab === 'kayak' ? 'จองเรือ' : 'จองห้องพัก'}
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {tab === 'all' ? combined.map((b) => renderBookingCard(b, b.__type)) : bookings.map((b) => renderBookingCard(b, tab as BookingType))}
        </div>
      )}
    </div>
  );
}
