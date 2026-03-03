'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, Anchor, XCircle, CreditCard, Timer } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

const PAYMENT_DEADLINE_MINUTES = 15;

function useCountdown(createdAt: string, onExpire: () => void) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const expiredRef = useRef(false);

  useEffect(() => {
    expiredRef.current = false;
    const createdMs = new Date(createdAt).getTime();
    const deadlineMs = createdMs + PAYMENT_DEADLINE_MINUTES * 60 * 1000;

    const tick = () => {
      const diff = Math.floor((deadlineMs - Date.now()) / 1000);
      if (diff <= 0) {
        setSecondsLeft(0);
        if (!expiredRef.current) {
          expiredRef.current = true;
          onExpire();
        }
        return;
      }
      setSecondsLeft(diff);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const secs = String(secondsLeft % 60).padStart(2, '0');
  return { display: `${mins}:${secs}`, isExpired: secondsLeft === 0 };
}

function CountdownCell({ createdAt, bookingId, onExpired }: { createdAt: string; bookingId: number; onExpired: (id: number) => void }) {
  const handleExpire = useCallback(() => onExpired(bookingId), [bookingId]);
  const { display, isExpired } = useCountdown(createdAt, handleExpire);
  if (isExpired) return <span className="text-xs text-red-500 font-medium">หมดเวลา</span>;
  const mins = Number(display.split(':')[0]);
  const color = mins <= 5 ? 'text-red-600' : mins <= 10 ? 'text-orange-500' : 'text-teal-600';
  return (
    <span className={`flex items-center gap-1 text-sm font-bold ${color}`}>
      <Timer size={14} />{display}
    </span>
  );
}

const statusLabel: Record<string, string> = { pending: 'รอดำเนินการ', paid: 'รอตรวจสอบชำระเงิน', approved: 'ยืนยันแล้ว', cancelled: 'ยกเลิก', rejected: 'ถูกปฏิเสธ' };
const statusClass: Record<string, string> = { pending: 'bg-orange-100 text-orange-700', paid: 'bg-blue-100 text-blue-700', approved: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-700', rejected: 'bg-red-100 text-red-700' };

export default function BookingsPage() {
  const router = useRouter();
  const { ready } = useAuthGuard();
  const [tab, setTab] = useState<'room' | 'kayak'>('room');
  const [roomBookings, setRoomBookings] = useState<any[]>([]);
  const [kayakBookings, setKayakBookings] = useState<any[]>([]);
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
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'ยกเลิกไม่สำเร็จ');
    }
  };

  const handleExpiredBooking = useCallback(async (id: number) => {
    try {
      await api.put(`/bookings/${id}/cancel`);
      toast.error('การจองถูกยกเลิกอัตโนมัติเนื่องจากหมดเวลาชำระเงิน');
      fetchBookings();
    } catch {
      fetchBookings();
    }
  }, []);

  const bookings = tab === 'room' ? roomBookings : kayakBookings;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">การจองของฉัน</h1>
          <p className="text-gray-500 mt-1">ประวัติและสถานะการจองทั้งหมด</p>
        </div>

        {/* Nav Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          <Link href="/dashboard" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900">โปรไฟล์</Link>
          <Link href="/dashboard/bookings" className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-900 shadow-sm">การจองของฉัน</Link>
        </div>

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
                          <p>ผู้เข้าพัก: {b.guests || b.guest_count} คน</p>
                        </>
                      ) : (
                        <>
                          <p>วันที่: {new Date(b.booking_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                          <p>เวลา: {b.start_time?.slice(0,5)} - {b.end_time?.slice(0,5)} น.</p>
                          <p>ผู้โดยสาร: {b.num_passengers} คน</p>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-teal-600">฿{Number(b.total_price).toLocaleString()}</p>
                    <p className="text-xs text-gray-400 mt-1">#{b.id || b.room_booking_id || b.boat_booking_id}</p>
                  </div>
                </div>
                {b.status === 'pending' && (() => {
                  const bid = b.id || b.room_booking_id || b.boat_booking_id;
                  const createdAt = b.created_at;
                  const deadlineMs = new Date(createdAt).getTime() + PAYMENT_DEADLINE_MINUTES * 60 * 1000;
                  const isExpired = Date.now() > deadlineMs;
                  return (
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                      {/* Countdown */}
                      <div className="flex items-center justify-between bg-orange-50 rounded-xl px-4 py-2.5">
                        <span className="text-xs text-orange-700 font-medium">⏳ ชำระเงินภายใน</span>
                        {!isExpired ? (
                          <CountdownCell createdAt={createdAt} bookingId={bid} onExpired={handleExpiredBooking} />
                        ) : (
                          <span className="text-xs text-red-500 font-medium">หมดเวลาแล้ว</span>
                        )}
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
