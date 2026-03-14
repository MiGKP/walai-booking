'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Waves, Users, CalendarDays, Search } from 'lucide-react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface RoomType {
  id: number;
  room_name: string;
  type_name: string;
  description: string;
  capacity: number;
  price_per_night: number;
  main_image: string;
  available_count: number;
}

export default function RoomsPage() {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const nights =
    checkIn && checkOut
      ? Math.max(0, (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000)
      : 0;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nights <= 0) { toast.error('กรุณาเลือกวันที่ถูกต้อง (check-out ต้องหลัง check-in)'); return; }
    setLoading(true);
    try {
      const res = await api.get('/rooms', { params: { check_in: checkIn, check_out: checkOut } });
      setRooms(res.data.data || []);
      setSearched(true);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลห้องพักได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-700 to-cyan-600 text-white py-16">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-4xl font-bold mb-3">ห้องพักลอยน้ำ</h1>
          <p className="text-teal-100 text-lg">ระบุวันที่ต้องการเพื่อตรวจสอบห้องว่าง</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-10">
          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                <CalendarDays size={14} className="inline mr-1" />
                วันเช็คอิน
              </label>
              <input
                type="date"
                required
                min={today}
                className="input-field"
                value={checkIn}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  if (checkOut && e.target.value >= checkOut) {
                    const next = new Date(new Date(e.target.value).getTime() + 86400000).toISOString().split('T')[0];
                    setCheckOut(next);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                <CalendarDays size={14} className="inline mr-1" />
                วันเช็คเอาต์
              </label>
              <input
                type="date"
                required
                min={checkIn || today}
                className="input-field"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
              />
            </div>
            <div>
              {nights > 0 && (
                <p className="text-sm text-teal-600 font-medium mb-2">{nights} คืน</p>
              )}
              <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                <Search size={16} />
                ค้นหาห้องว่าง
              </button>
            </div>
          </div>
        </form>

        {/* Results */}
        {loading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card animate-pulse">
                <div className="h-56 bg-gray-200" />
                <div className="p-6 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-2/3" />
                  <div className="h-4 bg-gray-200 rounded w-full" />
                  <div className="h-4 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !searched ? (
          <div className="text-center py-20 text-gray-400">
            <CalendarDays size={56} className="mx-auto mb-4 text-gray-200" />
            <p className="text-lg font-medium text-gray-500">เลือกวันที่แล้วกด "ค้นหาห้องว่าง"</p>
            <p className="text-sm mt-1">ระบบจะแสดงห้องพักพร้อมสถานะตามช่วงวันที่คุณเลือก</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Waves size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">ไม่พบข้อมูลห้องพัก</p>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-6">
              แสดงผลสำหรับ <span className="font-semibold text-gray-700">{checkIn}</span> ถึง <span className="font-semibold text-gray-700">{checkOut}</span>
              {' '}({nights} คืน)
            </p>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map((room) => {
                const isAvailable = Number(room.available_count) > 0;
                return (
                  <div key={room.id} className={`card hover:shadow-xl transition-all duration-300 group flex flex-col ${!isAvailable ? 'opacity-75' : ''}`}>
                    <div className="h-56 bg-gray-200 relative overflow-hidden flex items-center justify-center">
                      {room.main_image ? (
                        <img src={`http://localhost:5000${room.main_image}`} alt={room.room_name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      ) : (
                        <Waves size={80} className="text-gray-300" />
                      )}
                      {!isAvailable && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <span className="bg-red-600 text-white text-sm font-bold px-4 py-2 rounded-full">เต็มแล้ว</span>
                        </div>
                      )}
                      {isAvailable && (
                        <div className="absolute top-3 right-3">
                          <span className="bg-white/90 text-teal-700 text-xs font-bold px-3 py-1 rounded-full">
                            ว่าง {room.available_count} ห้อง
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-6 flex flex-col flex-1">
                      <h3 className="text-xl font-bold text-gray-900 mb-2">
                        {room.room_name} {room.type_name ? `(${room.type_name})` : ''}
                      </h3>
                      <p className="text-gray-500 text-sm mb-4 line-clamp-2">{room.description}</p>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
                        <span className="flex items-center gap-1"><Users size={15} /> {room.capacity} คน</span>
                      </div>
                      <div className="mt-auto flex items-end justify-between pt-4 border-t border-gray-100">
                        <div>
                          <span className="text-2xl font-bold text-teal-600">฿{Number(room.price_per_night).toLocaleString()}</span>
                          <span className="text-gray-500 text-sm">/คืน</span>
                        </div>
                        {isAvailable ? (
                          <Link
                            href={`/rooms/${room.id}?check_in=${checkIn}&check_out=${checkOut}`}
                            className="btn-primary text-sm py-2 px-4"
                          >
                            จองเลย
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-400 font-medium">ไม่ว่างช่วงนี้</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
