'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Anchor, Users, ArrowRight } from 'lucide-react';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/avatar';
import toast from 'react-hot-toast';

interface BoatType {
  id: number;
  name: string;
  description: string;
  type: string;
  capacity: number;
  price_per_hour: number;
  image?: string;
  is_available: boolean;
}

interface BoatRound {
  boat_round_id: number;
  start_time: string;
  end_time: string;
}

const typeLabels: Record<string, string> = { single: 'เดี่ยว', double: 'คู่', tandem: 'ครอบครัว' };
const typeColors: Record<string, string> = { single: 'from-cyan-400 to-cyan-600', double: 'from-teal-400 to-teal-600', tandem: 'from-blue-400 to-blue-600' };

export default function KayaksPage() {
  const router = useRouter();
  const [boats, setBoats] = useState<BoatType[]>([]);
  const [rounds, setRounds] = useState<BoatRound[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBoat, setSelectedBoat] = useState<BoatType | null>(null);
  const [booking, setBooking] = useState({ booking_date: '', boat_round_id: '', num_passengers: 1 });
  const [bookingLoading, setBookingLoading] = useState(false);
  const [availability, setAvailability] = useState<{ remaining: number; total: number; booked: number; available: boolean; total_slots: number | null; pool_booked: number } | null>(null);
  const [availLoading, setAvailLoading] = useState(false);

  useEffect(() => {
    fetchBoats();
  }, []);

  useEffect(() => {
    if (selectedBoat) {
      fetchRounds(selectedBoat.id);
    } else {
      fetchRounds();
    }
    setAvailability(null);
  }, [selectedBoat]);

  useEffect(() => {
    if (selectedBoat && booking.booking_date && booking.boat_round_id) {
      fetchAvailability();
    } else {
      setAvailability(null);
    }
  }, [booking.booking_date, booking.boat_round_id]);

  const fetchBoats = async () => {
    try {
      const res = await api.get('/kayaks');
      setBoats(res.data.data);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลเรือได้');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailability = async () => {
    if (!selectedBoat || !booking.booking_date || !booking.boat_round_id) return;
    setAvailLoading(true);
    try {
      const res = await api.get('/kayaks/availability', {
        params: { kayak_id: selectedBoat.id, booking_date: booking.booking_date, boat_round_id: booking.boat_round_id },
      });
      setAvailability(res.data.data);
    } catch {
      setAvailability(null);
    } finally {
      setAvailLoading(false);
    }
  };

  const fetchRounds = async (boatId?: number) => {
    try {
      const url = boatId ? `/kayaks/schedule?kayak_id=${boatId}` : '/kayaks/schedule';
      const res = await api.get(url);
      setRounds(res.data.data);
    } catch {
      // ignore silently if rounds fail
    }
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) { toast.error('กรุณาเข้าสู่ระบบก่อน'); router.push('/auth/login'); return; }
    if (!selectedBoat) return;
    if (!booking.boat_round_id) { toast.error('กรุณาเลือกรอบเวลา'); return; }
    
    setBookingLoading(true);
    try {
      const res = await api.post('/kayaks/bookings', { 
        kayak_id: selectedBoat.id, 
        booking_date: booking.booking_date,
        boat_round_id: booking.boat_round_id,
        num_passengers: booking.num_passengers
      });
      toast.success('จองเรือสำเร็จ!');
      router.push(`/payment?booking_type=kayak&booking_id=${res.data.data.boat_booking_id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'จองเรือไม่สำเร็จ (อาจเต็มในรอบนี้)');
    } finally {
      setBookingLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="bg-gradient-to-r from-cyan-700 to-teal-600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-3">เรือและกิจกรรมทางน้ำ</h1>
          <p className="text-cyan-100 text-lg">สำรวจธรรมชาติด้วยเรือสุดสนุก</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Boat List */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-gray-900 mb-6">เลือกประเภทเรือ</h2>
            {loading ? (
              <div className="grid md:grid-cols-2 gap-5">
                {[1, 2, 3].map((i) => <div key={i} className="card animate-pulse h-64 bg-gray-200" />)}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-5">
                {boats.map((boat) => (
                  <div
                    key={boat.id}
                    onClick={() => {
                      const newBoat = selectedBoat?.id === boat.id ? null : boat;
                      setSelectedBoat(newBoat);
                      // Reset booking when switching boats
                      if (newBoat?.id !== selectedBoat?.id) {
                        setBooking({ booking_date: '', boat_round_id: '', num_passengers: 1 });
                      }
                    }}
                    className={`card cursor-pointer transition-all duration-300 hover:shadow-lg ${selectedBoat?.id === boat.id ? 'ring-2 ring-teal-500 shadow-lg' : ''}`}
                  >
                    <div className={`h-44 bg-gray-200 flex items-center justify-center relative overflow-hidden`}>
                      {boat.image ? (
                        <img src={resolveMediaUrl(boat.image)} alt={boat.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className={`w-full h-full bg-gradient-to-br ${typeColors[boat.type] || 'from-teal-400 to-teal-600'} flex items-center justify-center`}>
                          <Anchor size={60} className="text-white/50" />
                        </div>
                      )}
                      
                      {selectedBoat?.id === boat.id && (
                        <div className="absolute top-3 right-3 bg-white text-teal-600 rounded-full p-1 shadow-md">
                          <ArrowRight size={16} />
                        </div>
                      )}
                      <span className="absolute top-3 left-3 bg-white/90 text-gray-700 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                        {typeLabels[boat.type] || 'เรือ'}
                      </span>
                      {!boat.is_available && (
                        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center">
                          <span className="bg-red-500 text-white font-bold px-4 py-1.5 rounded-full shadow-md">หมดชั่วคราว</span>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="font-bold text-gray-900 mb-1">{boat.name}</h3>
                      <p className="text-sm text-gray-500 mb-3 line-clamp-2">{boat.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1 text-sm text-gray-500"><Users size={15} /> {boat.capacity} คน</span>
                        <div>
                          <span className="text-lg font-bold text-teal-600">฿{Number(boat.price_per_hour).toLocaleString()}</span>
                          <span className="text-gray-400 text-xs">/รอบ</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Booking Form */}
          <div className="lg:col-span-1">
            <div className="card p-6 sticky top-24">
              <h2 className="text-lg font-bold text-gray-900 mb-5">จองเรือ</h2>
              {!selectedBoat ? (
                <div className="text-center py-8 text-gray-400">
                  <Anchor size={40} className="mx-auto mb-3 text-gray-200" />
                  <p className="text-sm">กรุณาเลือกเรือก่อน</p>
                </div>
              ) : (
                <form onSubmit={handleBooking} className="space-y-4">
                  <div className="bg-teal-50 rounded-xl p-3 text-sm text-teal-700 font-medium border border-teal-100">
                    เรือที่เลือก: {selectedBoat.name}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">วันที่</label>
                    <input type="date" required min={today} className="input-field" value={booking.booking_date}
                      onChange={(e) => setBooking({ ...booking, booking_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">เลือกรอบเวลา</label>
                    <select 
                      required 
                      className="input-field" 
                      value={booking.boat_round_id}
                      onChange={(e) => setBooking({ ...booking, boat_round_id: e.target.value })}
                    >
                      <option value="" disabled>เลือกรอบเวลา</option>
                      {rounds.map(r => (
                        <option key={r.boat_round_id} value={r.boat_round_id}>
                          {r.start_time.slice(0, 5)} - {r.end_time.slice(0, 5)} น.
                        </option>
                      ))}
                    </select>
                    {booking.boat_round_id && booking.booking_date && (
                      <div className="mt-2">
                        {availLoading ? (
                          <p className="text-xs text-gray-400">กำลังตรวจสอบ...</p>
                        ) : availability ? (
                          <div className={`flex flex-col gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg ${
                            availability.remaining === 0 ? 'bg-red-50 text-red-600' :
                            availability.remaining <= 2 ? 'bg-orange-50 text-orange-600' :
                            'bg-green-50 text-green-700'
                          }`}>
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                availability.remaining === 0 ? 'bg-red-500' :
                                availability.remaining <= 2 ? 'bg-orange-500' :
                                'bg-green-500'
                              }`} />
                              {availability.remaining === 0
                                ? 'เรือเต็มแล้วในวันนี้'
                                : `เหลือ ${availability.remaining} ลำ (ประเภทนี้จองแล้ว ${availability.booked}/${availability.total} ลำ)`
                              }
                            </div>
                            {availability.total_slots !== null && (
                              <div className="flex items-center gap-1.5 text-gray-500 font-normal">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                                ท่าเรือรวม: ใช้ไป {availability.pool_booked}/{availability.total_slots} ลำ (ทุกประเภท)
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">จำนวนผู้โดยสาร (สูงสุด {selectedBoat.capacity} คน)</label>
                    <input 
                      type="number" 
                      required 
                      min="1" 
                      max={selectedBoat.capacity} 
                      className="input-field" 
                      value={booking.num_passengers}
                      onChange={(e) => setBooking({ ...booking, num_passengers: Number(e.target.value) })} 
                    />
                  </div>
                  
                  <div className="bg-gray-50 rounded-xl p-4 space-y-1 mt-4">
                    <div className="flex justify-between font-bold text-gray-900">
                      <span>ราคารวม</span>
                      <span className="text-teal-600">฿{Number(selectedBoat.price_per_hour).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <button type="submit" disabled={bookingLoading} className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed">
                    {bookingLoading ? 'กำลังจอง...' : 'ยืนยันการจองเรือ'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
