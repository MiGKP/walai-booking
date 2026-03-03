'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Waves, Users, Star, Filter, Maximize } from 'lucide-react';
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
  const [rooms, setRooms] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    fetchRooms();
  }, [filterType]);

  const fetchRooms = async () => {
    try {
      const params: any = {};
      if (filterType === 'family') params.capacity = 4;
      if (filterType === 'standard') params.max_price = 2000;
      
      const res = await api.get('/rooms', { params });
      setRooms(res.data.data);
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
          <p className="text-teal-100 text-lg">เลือกห้องพักที่เหมาะสำหรับคุณ</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-10">
        {/* Filter */}
        <div className="flex items-center gap-3 mb-8 flex-wrap">
          <div className="flex items-center gap-2 text-gray-600 font-medium">
            <Filter size={18} />
            <span>กรอง:</span>
          </div>
          {[
            { id: '', label: 'ทั้งหมด' },
            { id: 'standard', label: 'ราคาประหยัด' },
            { id: 'family', label: 'ครอบครัว' }
          ].map((type) => (
            <button
              key={type.id}
              onClick={() => setFilterType(type.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                filterType === type.id
                  ? 'bg-teal-600 text-white shadow-md'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-teal-400'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

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
        ) : rooms.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <Waves size={48} className="mx-auto mb-4 text-gray-300" />
            <p className="text-lg">ไม่พบห้องพักที่ว่าง</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {rooms.map((room) => (
              <div key={room.id} className="card hover:shadow-xl transition-all duration-300 group flex flex-col">
                <div className="h-56 bg-gray-200 relative overflow-hidden flex items-center justify-center">
                  {room.main_image ? (
                    <img src={`http://localhost:5000${room.main_image}`} alt={room.room_name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  ) : (
                    <Waves size={80} className="text-white/30" />
                  )}
                  <div className="absolute top-3 right-3">
                    <span className={`${room.available_count > 0 ? 'bg-white/90 text-teal-700' : 'bg-red-50 text-red-600'} text-xs font-bold px-3 py-1 rounded-full`}>
                      {room.available_count > 0 ? `ว่าง ${room.available_count} ห้อง` : 'เต็ม'}
                    </span>
                  </div>
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{room.room_name} {room.type_name ? `(${room.type_name})` : ''}</h3>
                  <p className="text-gray-500 text-sm mb-4 line-clamp-2">{room.description}</p>
                  <div className="flex items-center gap-4 text-sm text-gray-500 mb-6">
                    <span className="flex items-center gap-1"><Users size={15} /> {room.capacity} คน</span>
                  </div>
                  
                  <div className="mt-auto flex items-end justify-between pt-4 border-t border-gray-100">
                    <div>
                      <span className="text-2xl font-bold text-teal-600">฿{Number(room.price_per_night).toLocaleString()}</span>
                      <span className="text-gray-500 text-sm">/คืน</span>
                    </div>
                    <Link href={`/rooms/${room.id}`} className="btn-primary text-sm py-2 px-4">ดูรายละเอียด</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
