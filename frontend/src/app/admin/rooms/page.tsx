'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, PlusCircle } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export default function RoomManagementPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [roomTypeForm, setRoomTypeForm] = useState({ room_name: '', type_name: '', description: '', capacity: 2, price: 0, room_image: '', amenity_id: '', quantity: 1 });
  const [singleRoomForm, setSingleRoomForm] = useState({ room_type_id: '', room_number: '' });
  const [amenityForm, setAmenityForm] = useState({ name: '', icon: '' });
  const [amenities, setAmenities] = useState<any[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !['admin', 'room_staff'].includes(user?.role || '')) { router.push('/'); return; }
    fetchRooms();
    fetchAmenities();
  }, [isAuthenticated, user]);

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const rt = await api.get('/rooms');
      setRoomTypes(rt.data?.data || []);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลห้องพักได้');
    } finally {
      setLoading(false);
    }
  };

  const fetchAmenities = async () => {
    // Note: Assuming there will be an endpoint to fetch amenities
    // This is a placeholder, you might need to create this endpoint in the backend
    // try {
    //   const res = await api.get('/rooms/amenities');
    //   setAmenities(res.data?.data || []);
    // } catch {
    //   console.error('Failed to fetch amenities');
    // }
  };

  const handleCreateRoomType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/rooms/type', roomTypeForm);
      toast.success('สร้างประเภทห้องพักสำเร็จ');
      setRoomTypeForm({ room_name: '', type_name: '', description: '', capacity: 2, price: 0, room_image: '', amenity_id: '', quantity: 1 });
      fetchRooms();
    } catch {
      toast.error('สร้างประเภทห้องพักไม่สำเร็จ');
    }
  };

  const handleCreateSingleRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/rooms/single', singleRoomForm);
      toast.success('สร้างห้องพักย่อยสำเร็จ');
      setSingleRoomForm({ room_type_id: '', room_number: '' });
      fetchRooms();
    } catch {
      toast.error('สร้างห้องพักย่อยไม่สำเร็จ');
    }
  };

  const handleCreateAmenity = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/rooms/amenity', amenityForm);
      toast.success('เพิ่มสิ่งอำนวยความสะดวกสำเร็จ');
      setAmenityForm({ name: '', icon: '' });
    } catch {
      toast.error('เพิ่มสิ่งอำนวยความสะดวกไม่สำเร็จ');
    }
  };

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push(user?.role === 'admin' ? '/admin' : '/dashboard')} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ArrowLeft className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">จัดการห้องพัก</h1>
            <p className="text-gray-500 mt-1">เพิ่มประเภทห้อง ห้องพักย่อย และสิ่งอำนวยความสะดวก</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Create Room Type Form */}
            <div className="card p-6 lg:col-span-1 h-fit">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Home size={20} className="text-teal-600" />
                เพิ่มประเภทห้องพัก
              </h2>
              <form onSubmit={handleCreateRoomType} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อห้อง</label>
                  <input type="text" required className="input-field" value={roomTypeForm.room_name} onChange={(e) => setRoomTypeForm({ ...roomTypeForm, room_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทห้อง (เช่น วิลล่า, เต็นท์)</label>
                  <input type="text" className="input-field" value={roomTypeForm.type_name} onChange={(e) => setRoomTypeForm({ ...roomTypeForm, type_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                  <textarea className="input-field" rows={3} value={roomTypeForm.description} onChange={(e) => setRoomTypeForm({ ...roomTypeForm, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ผู้เข้าพัก (คน)</label>
                    <input type="number" required min="1" className="input-field" value={roomTypeForm.capacity} onChange={(e) => setRoomTypeForm({ ...roomTypeForm, capacity: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ราคา/คืน</label>
                    <input type="number" required min="0" className="input-field" value={roomTypeForm.price} onChange={(e) => setRoomTypeForm({ ...roomTypeForm, price: Number(e.target.value) })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนห้องที่จะสร้าง</label>
                    <input type="number" required min="1" className="input-field" value={roomTypeForm.quantity} onChange={(e) => setRoomTypeForm({ ...roomTypeForm, quantity: Number(e.target.value) })} />
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full mt-2 bg-teal-600 hover:bg-teal-700">สร้างประเภทห้อง</button>
              </form>
            </div>
            
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Create Single Room Form */}
                <div className="card p-6 h-fit">
                  <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <PlusCircle size={20} className="text-blue-600" />
                    เพิ่มห้องพัก (รายห้อง)
                  </h2>
                  <form onSubmit={handleCreateSingleRoom} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทห้องพัก</label>
                      <select required className="input-field" value={singleRoomForm.room_type_id} onChange={(e) => setSingleRoomForm({ ...singleRoomForm, room_type_id: e.target.value })}>
                        <option value="">เลือกประเภทห้อง...</option>
                        {roomTypes.map((rt: any) => (
                          <option key={rt.id} value={rt.id}>{rt.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">หมายเลขห้องพัก (เช่น A101)</label>
                      <input type="text" required className="input-field" value={singleRoomForm.room_number} onChange={(e) => setSingleRoomForm({ ...singleRoomForm, room_number: e.target.value })} />
                    </div>
                    <button type="submit" className="btn-primary w-full mt-2 bg-blue-600 hover:bg-blue-700">เพิ่มห้องพัก</button>
                  </form>
                </div>

                {/* Create Amenity Form */}
                <div className="card p-6 h-fit">
                  <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <PlusCircle size={20} className="text-indigo-600" />
                    เพิ่มสิ่งอำนวยความสะดวก
                  </h2>
                  <form onSubmit={handleCreateAmenity} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสิ่งอำนวยความสะดวก (เช่น Wi-Fi)</label>
                      <input type="text" required className="input-field" value={amenityForm.name} onChange={(e) => setAmenityForm({ ...amenityForm, name: e.target.value })} />
                    </div>
                    <button type="submit" className="btn-primary w-full mt-2 bg-indigo-600 hover:bg-indigo-700">เพิ่มสิ่งอำนวยความสะดวก</button>
                  </form>
                </div>
              </div>

              {/* Room Types Table */}
              <div className="card overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700">
                  รายการประเภทห้องพักทั้งหมด
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-white border-b border-gray-100">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">ประเภทห้อง</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">ผู้เข้าพัก</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">ราคา</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">ห้องว่าง</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">สถานะ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                      {loading ? (
                         <tr><td colSpan={5} className="p-4 text-center text-gray-500">กำลังโหลด...</td></tr>
                      ) : roomTypes.length === 0 ? (
                         <tr><td colSpan={5} className="p-4 text-center text-gray-500">ยังไม่มีข้อมูล</td></tr>
                      ) : (
                        roomTypes.map((rt: any) => (
                          <tr key={rt.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-gray-900">{rt.room_name} {rt.type_name ? `(${rt.type_name})` : ''}</td>
                            <td className="px-4 py-3 text-gray-600">{rt.capacity} คน</td>
                            <td className="px-4 py-3 text-teal-600 font-semibold">฿{Number(rt.price_per_night).toLocaleString()}</td>
                            <td className="px-4 py-3">{rt.available_count} ห้อง</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${rt.status ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{rt.status ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
