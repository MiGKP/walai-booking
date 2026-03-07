'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Users, Check, ArrowLeft, CalendarDays, Maximize } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import Link from 'next/link';

type RoomAmenity = string | { id: number; name: string };

export default function RoomDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState({ check_in_date: '', check_out_date: '', guests: 1, special_requests: '' });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [nights, setNights] = useState(0);

  useEffect(() => {
    api.get(`/rooms/${id}`).then((res) => setRoom(res.data.data)).catch(() => toast.error('ไม่พบห้องพัก')).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (booking.check_in_date && booking.check_out_date) {
      const diff = (new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) / (1000 * 60 * 60 * 24);
      setNights(diff > 0 ? diff : 0);
    }
  }, [booking.check_in_date, booking.check_out_date]);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) { toast.error('กรุณาเข้าสู่ระบบก่อน'); router.push('/auth/login'); return; }
    if (nights <= 0) { toast.error('กรุณาเลือกวันที่ถูกต้อง'); return; }
    setBookingLoading(true);
    try {
      const res = await api.post('/bookings/room', { room_type_id: id, ...booking });
      const bookingId = res.data.data.room_booking_id;
      toast.success('จองห้องพักสำเร็จ!');
      router.push(`/payment?booking_type=room&booking_id=${bookingId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'จองห้องพักไม่สำเร็จ (ห้องอาจเต็ม)');
    } finally {
      setBookingLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  if (loading) return (
    <div className="min-h-screen pt-16 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent" />
    </div>
  );

  if (!room) return (
    <div className="min-h-screen pt-16 flex items-center justify-center text-center">
      <div><p className="text-xl text-gray-500 mb-4">ไม่พบห้องพัก</p><Link href="/rooms" className="btn-primary">กลับไปหน้าห้องพัก</Link></div>
    </div>
  );

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <Link href="/rooms" className="inline-flex items-center gap-2 text-gray-500 hover:text-teal-600 mb-6 transition-colors">
          <ArrowLeft size={18} /> กลับไปหน้าห้องพัก
        </Link>
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Room Info */}
          <div className="lg:col-span-2 space-y-6">
            <div className="card overflow-hidden">
              <div className="h-72 bg-gray-200 flex items-center justify-center relative">
                {room.main_image ? (
                  <img src={`http://localhost:5000${room.main_image}`} alt={room.room_name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-gray-400 text-center">
                    <div className="text-6xl mb-2">🌊</div>
                    <p className="text-xl font-semibold opacity-80">ห้องลอยน้ำ</p>
                  </div>
                )}
              </div>
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <h1 className="text-2xl font-bold text-gray-900">{room.room_name} {room.type_name ? `(${room.type_name})` : ''}</h1>
                </div>
                <p className="text-gray-600 leading-relaxed mb-5">{room.description}</p>
                <div className="flex items-center gap-6 text-gray-600 border-t pt-4">
                  <span className="flex items-center gap-2"><Users size={18} /> รองรับ {room.capacity} คน</span>
                </div>
              </div>
            </div>
            {/* Amenities */}
            {room.amenities && room.amenities.length > 0 && (
              <div className="card p-6">
                <h2 className="text-lg font-bold text-gray-900 mb-4">สิ่งอำนวยความสะดวก</h2>
                <div className="grid grid-cols-2 gap-3">
                  {room.amenities.map((a: RoomAmenity, i: number) => {
                    const amenityName = typeof a === 'string' ? a : a?.name;

                    if (!amenityName) {
                      return null;
                    }

                    return (
                    <div key={typeof a === 'string' ? `${a}-${i}` : a.id} className="flex items-center gap-2 text-gray-700">
                      <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                        <Check size={14} className="text-teal-600" />
                      </div>
                      {amenityName}
                    </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Booking Form */}
          <div className="lg:col-span-1">
            <div className="card p-6 sticky top-24">
              <div className="mb-5">
                <span className="text-3xl font-bold text-teal-600">฿{Number(room.price_per_night).toLocaleString()}</span>
                <span className="text-gray-500">/คืน</span>
              </div>
              <form onSubmit={handleBooking} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">วันเช็คอิน</label>
                  <div className="relative">
                    <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="date" required min={today} className="input-field pl-10" value={booking.check_in_date}
                      onChange={(e) => setBooking({ ...booking, check_in_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">วันเช็คเอาต์</label>
                  <div className="relative">
                    <CalendarDays size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="date" required min={booking.check_in_date || today} className="input-field pl-10" value={booking.check_out_date}
                      onChange={(e) => setBooking({ ...booking, check_out_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">จำนวนผู้เข้าพัก</label>
                  <select className="input-field" value={booking.guests} onChange={(e) => setBooking({ ...booking, guests: Number(e.target.value) })}>
                    {Array.from({ length: room.capacity }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>{n} คน</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">คำขอพิเศษ (ถ้ามี)</label>
                  <textarea className="input-field resize-none" rows={3} placeholder="เช่น ต้องการเตียงเสริม..." value={booking.special_requests}
                    onChange={(e) => setBooking({ ...booking, special_requests: e.target.value })} />
                </div>
                {nights > 0 && (
                  <div className="bg-teal-50 rounded-xl p-4 space-y-1">
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>฿{Number(room.price_per_night).toLocaleString()} × {nights} คืน</span>
                      <span>฿{(room.price_per_night * nights).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-teal-200">
                      <span>ราคารวม</span>
                      <span className="text-teal-600">฿{(room.price_per_night * nights).toLocaleString()}</span>
                    </div>
                  </div>
                )}
                <button type="submit" disabled={bookingLoading || nights <= 0} className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed">
                  {bookingLoading ? 'กำลังจอง...' : 'จองห้องพัก'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
