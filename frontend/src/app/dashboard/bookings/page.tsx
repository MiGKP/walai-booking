'use client';

import { useState, useEffect } from 'react';
import { CalendarDays, Anchor, XCircle, CreditCard, Timer, Star } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import DashboardTabs from '@/components/dashboard/DashboardTabs';
import toast from 'react-hot-toast';
import Link from 'next/link';

function DeadlineCell({ createdAt, dueDays }: { createdAt: string; dueDays: number }) {
  const deadlineMs = new Date(createdAt).getTime() + dueDays * 24 * 60 * 60 * 1000;
  const deadline = new Date(deadlineMs);
  const isExpired = Date.now() > deadlineMs;
  if (isExpired) return <span className="text-xs text-red-500 font-medium">หมดเวลาแล้ว</span>;
  return (
    <span className="flex items-center gap-1 text-xs text-teal-600">
      <Timer size={13} /> ชำระภายใน {deadline.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
    </span>
  );
}

const statusLabel: Record<string, string> = { pending: 'รอดำเนินการ', paid: 'รอตรวจสอบชำระเงิน', approved: 'ยืนยันแล้ว', cancelled: 'ยกเลิก', rejected: 'ถูกปฏิเสธ', checked_out: 'เช็คเอาต์แล้ว' };
const statusClass: Record<string, string> = { pending: 'bg-orange-100 text-orange-700', paid: 'bg-blue-100 text-blue-700', approved: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-700', rejected: 'bg-red-100 text-red-700', checked_out: 'bg-teal-100 text-teal-700' };

export default function BookingsPage() {
  const { ready, user } = useAuthGuard();
  const [tab, setTab] = useState<'room' | 'kayak'>('room');
  const [roomBookings, setRoomBookings] = useState<any[]>([]);
  const [kayakBookings, setKayakBookings] = useState<any[]>([]);
  const [paymentDueDays, setPaymentDueDays] = useState<number>(3);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    fetchBookings();
  }, [ready]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const [roomRes, kayakRes] = await Promise.all([
        api.get('/bookings/room/my'),
        api.get('/kayaks/bookings/my').catch(() => ({ data: { data: [] } })),
      ]);
      setRoomBookings(roomRes.data?.data || []);
      setKayakBookings(kayakRes.data?.data || []);
      const dueDays = Number(roomRes.data?.payment_due_days);
      if (dueDays > 0) setPaymentDueDays(dueDays);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลการจองได้');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (type: 'room' | 'kayak', id: number) => {
    if (!confirm('ต้องการยกเลิกการจองนี้?')) return;
    try {
      if (type === 'room') await api.put(`/bookings/${id}/cancel`);
      else await api.put(`/kayaks/bookings/${id}/cancel`);
      toast.success('ยกเลิกการจองสำเร็จ');
      fetchBookings();
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'ยกเลิกไม่สำเร็จ'));
    }
  };


  const bookings = tab === 'room' ? roomBookings : kayakBookings;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">การจองของฉัน</h1>
          <p className="text-gray-500 mt-1">ประวัติและสถานะการจองทั้งหมด</p>
          {user && (
            <p className="text-sm text-gray-600 mt-2">
              ผู้ใช้: {user.first_name || ''} {user.last_name || ''}
            </p>
          )}
        </div>

        <DashboardTabs />

        {/* Booking Type Tabs */}
        <div className="flex gap-4 border-b border-gray-200 mb-6">
          <button
            onClick={() => setTab('room')}
            className={`pb-3 px-1 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${tab === 'room' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <CalendarDays size={16} /> ห้องพัก ({roomBookings.length})
          </button>
          <button
            onClick={() => setTab('kayak')}
            className={`pb-3 px-1 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors ${tab === 'kayak' ? 'border-teal-600 text-teal-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            <Anchor size={16} /> เรือ ({kayakBookings.length})
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => <div key={i} className="card h-32 animate-pulse bg-gray-100" />)}
          </div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-20">
            {tab === 'room' ? <CalendarDays size={48} className="mx-auto mb-4 text-gray-200" /> : <Anchor size={48} className="mx-auto mb-4 text-gray-200" />}
            <p className="text-gray-400 text-lg mb-4">ยังไม่มีการจอง</p>
            <Link href={tab === 'room' ? '/rooms' : '/kayaks'} className="btn-primary">
              {tab === 'room' ? 'จองห้องพัก' : 'จองเรือ'}
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((b: any) => (
              <div key={b.id || b.room_booking_id || b.boat_booking_id} className="card p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <h3 className="font-bold text-gray-900 truncate">
                        {tab === 'room' ? b.room_name : b.kayak_name}
                      </h3>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusClass[b.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabel[b.status] || b.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500 space-y-1">
                      {tab === 'room' ? (
                        <>
                          <p>เช็คอิน: {new Date(b.check_in_date || b.check_in).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          <p>เช็คเอาต์: {new Date(b.check_out_date || b.check_out).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          <p>ผู้เข้าพัก: {b.guests || b.guest_count} คน{b.adults != null ? ` (ผู้ใหญ่ ${b.adults}, เด็ก ${b.children ?? 0})` : ''}</p>
                          {Array.isArray(b.rooms) && b.rooms.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-gray-600">
                              {b.rooms.map((line: { booking_room_id: number; room_name: string; room_number: string; status: string }) => (
                                <li key={line.booking_room_id}>
                                  {line.room_name} · ห้อง {line.room_number}
                                  {line.status === 'checked_out' ? ' (เช็คเอาต์แล้ว)' : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      ) : (
                        <>
                          <p>วันที่: {new Date(b.booking_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          <p>เวลา: {b.start_time?.slice(0,5)} - {b.end_time?.slice(0,5)} น.</p>
                          <p>ผู้โดยสาร: {b.num_passengers} คน</p>
                          {Array.isArray(b.boats) && b.boats.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-gray-600">
                              {b.boats.map((line: { booking_boat_id: number; type_name?: string; num_passengers?: number; boat_count?: number }) => (
                                <li key={line.booking_boat_id}>
                                  {line.type_name || 'เรือ'} · {line.num_passengers ?? 0} คน · {line.boat_count ?? 0} ลำ
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-teal-600">฿{Number(b.total_price).toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">#{b.id || b.room_booking_id || b.boat_booking_id}</p>
                  </div>
                </div>
                {tab === 'room' && b.status === 'approved' && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <Link
                      href="/reviews"
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-yellow-600 hover:text-yellow-700 bg-yellow-50 hover:bg-yellow-100 px-4 py-2 rounded-xl transition-colors"
                    >
                      <Star size={14} className="fill-yellow-400 text-yellow-400" /> เขียนรีวิวการพักนี้
                    </Link>
                  </div>
                )}
                {b.status === 'pending' && (() => {
                  const bid = b.id || b.room_booking_id || b.boat_booking_id;
                  const createdAt = b.created_at;
                  const deadlineMs = new Date(createdAt).getTime() + paymentDueDays * 24 * 60 * 60 * 1000;
                  const isExpired = Date.now() > deadlineMs;
                  return (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      {/* Deadline */}
                      <div className="flex items-center justify-between bg-orange-50 rounded-xl px-4 py-2.5">
                        <span className="text-xs text-orange-700 font-medium">⏳ ชำระเงินภายใน</span>
                        <DeadlineCell createdAt={createdAt} dueDays={paymentDueDays} />
                      </div>
                      {/* Action Buttons */}
                      {!isExpired && (
                        <div className="flex gap-3">
                          <Link
                            href={`/payment?booking_type=${tab}&booking_id=${bid}`}
                            className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                          >
                            <CreditCard size={15} /> ชำระเงิน
                          </Link>
                          <button
                            onClick={() => handleCancel(tab, bid)}
                            className="flex items-center justify-center gap-2 border border-red-300 text-red-500 hover:bg-red-50 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
                          >
                            <XCircle size={15} /> ยกเลิก
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
