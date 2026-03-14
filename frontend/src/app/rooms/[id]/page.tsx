'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Users, Check, ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, X, Images, Star } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

type RoomAmenity = string | { id: number; name: string };

export default function RoomDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [booking, setBooking] = useState({
    check_in_date: searchParams.get('check_in') || today,
    check_out_date: searchParams.get('check_out') || tomorrow,
    guests: 1,
    special_requests: '',
  });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  const nights =
    booking.check_in_date && booking.check_out_date
      ? Math.max(0, (new Date(booking.check_out_date).getTime() - new Date(booking.check_in_date).getTime()) / 86400000)
      : 0;

  useEffect(() => {
    api.get(`/rooms/${id}`).then((res) => setRoom(res.data.data)).catch(() => toast.error('ไม่พบห้องพัก')).finally(() => setLoading(false));
    api.get(`/reviews/room-type/${id}`).then((res) => {
      setReviews(res.data.data || []);
      setAvgRating(res.data.avg_rating);
    }).catch(() => {});
  }, [id]);

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) { toast.error('กรุณาเข้าสู่ระบบก่อน'); router.push('/auth/login'); return; }
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

  const allImages: string[] = [room.main_image, ...(Array.isArray(room.images) ? room.images.filter((img: string) => img !== room.main_image) : [])].filter(Boolean);
  const lbTotal = allImages.length;
  const lbIdx = lightboxIndex ?? 0;

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
              {/* Main image */}
              <div className="h-72 bg-gray-200 flex items-center justify-center relative cursor-pointer group" onClick={() => room.main_image && setLightboxIndex(0)}>
                {room.main_image ? (
                  <>
                    <img src={`http://localhost:5000${room.main_image}`} alt={room.room_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Images size={32} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </>
                ) : (
                  <div className="text-gray-400 text-center">
                    <div className="text-6xl mb-2">🌊</div>
                    <p className="text-xl font-semibold opacity-80">ห้องลอยน้ำ</p>
                  </div>
                )}
              </div>
              {/* Gallery thumbnails */}
              {room.images && room.images.length > 0 && (
                <div className="flex gap-2 p-3 overflow-x-auto bg-gray-50 border-t border-gray-100">
                  {[room.main_image, ...room.images.filter((img: string) => img !== room.main_image)].filter(Boolean).map((img: string, idx: number) => (
                    <button key={idx} onClick={() => setLightboxIndex(idx)}
                      className={`flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition-all ${lightboxIndex === idx ? 'border-teal-500' : 'border-transparent hover:border-teal-300'}`}>
                      <img src={`http://localhost:5000${img}`} alt={`รูปที่ ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
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
            {/* Reviews */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">รีวิวจากผู้เข้าพัก</h2>
                {avgRating !== null && (
                  <div className="flex items-center gap-1.5 bg-yellow-50 px-3 py-1.5 rounded-full">
                    <Star size={16} className="text-yellow-400 fill-yellow-400" />
                    <span className="font-bold text-yellow-700 text-sm">{avgRating}</span>
                    <span className="text-yellow-600 text-xs">({reviews.length} รีวิว)</span>
                  </div>
                )}
              </div>
              {reviews.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-6">ยังไม่มีรีวิว — เป็นคนแรกที่รีวิวห้องนี้!</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto pr-1">
                  {reviews.map((rv: any) => (
                    <div key={rv.review_id} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold flex-shrink-0">
                          {rv.first_name?.[0] || 'U'}
                        </div>
                        <span className="text-sm font-medium text-gray-800">{rv.first_name} {rv.last_name}</span>
                        <span className="text-xs text-gray-400 ml-auto">
                          {new Date(rv.review_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                      <div className="flex gap-0.5 mb-1.5 ml-9">
                        {[1,2,3,4,5].map(s => (
                          <Star key={s} size={13} className={s <= rv.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} />
                        ))}
                      </div>
                      {rv.comment && <p className="text-sm text-gray-600 leading-relaxed ml-9">{rv.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
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

      {/* Lightbox Modal */}
      {lightboxIndex !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setLightboxIndex(null)}>
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/20 rounded-full transition-colors z-10" onClick={() => setLightboxIndex(null)}>
            <X size={28} />
          </button>
          {lbTotal > 1 && (
            <>
              <button className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/20 rounded-full transition-colors z-10"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lbIdx - 1 + lbTotal) % lbTotal); }}>
                <ChevronLeft size={32} />
              </button>
              <button className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/20 rounded-full transition-colors z-10"
                onClick={(e) => { e.stopPropagation(); setLightboxIndex((lbIdx + 1) % lbTotal); }}>
                <ChevronRight size={32} />
              </button>
            </>
          )}
          <img
            src={`http://localhost:5000${allImages[lbIdx]}`}
            alt={`รูปที่ ${lbIdx + 1}`}
            className="max-h-[85vh] max-w-[85vw] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {lbTotal > 1 && (
            <div className="absolute bottom-6 flex gap-2">
              {allImages.map((_, i) => (
                <button key={i} onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  className={`w-2 h-2 rounded-full transition-all ${i === lbIdx ? 'bg-white scale-125' : 'bg-white/40'}`} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
