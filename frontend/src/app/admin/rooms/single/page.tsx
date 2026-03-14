'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Trash2, PlusCircle, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function SingleRoomsPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ allowedRoles: ['admin'] });
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [singleRooms, setSingleRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ room_type_id: '', room_number: '' });
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

  useEffect(() => {
    if (!ready) return;
    fetchData();
  }, [ready]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rtRes, srRes] = await Promise.all([
        api.get('/rooms'),
        api.get('/rooms/single/all')
      ]);
      setRoomTypes(rtRes.data?.data || []);
      setSingleRooms(srRes.data?.data || []);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/rooms/single', form);
      toast.success('สร้างห้องพักย่อยสำเร็จ');
      setForm({ room_type_id: '', room_number: '' });
      fetchData();
    } catch {
      toast.error('สร้างห้องพักย่อยไม่สำเร็จ');
    }
  };

  const handleDelete = async (id: number, roomNumber: string) => {
    if (!confirm(`ต้องการลบห้อง "${roomNumber}" ใช่หรือไม่?`)) return;
    try {
      await api.delete(`/rooms/single/${id}`);
      toast.success('ลบห้องพักสำเร็จ');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ');
    }
  };

  const openEditModal = (sr: any) => {
    setEditingRoom({ id: sr.room_id, room_number: sr.room_number, status: sr.status });
    setShowEditModal(true);
  };

  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;
    try {
      await api.put(`/rooms/single/${editingRoom.id}`, { room_number: editingRoom.room_number, status: editingRoom.status });
      toast.success('แก้ไขห้องพักสำเร็จ');
      setShowEditModal(false);
      setEditingRoom(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'แก้ไขไม่สำเร็จ');
    }
  };

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/admin')} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ArrowLeft className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">จัดการห้องพัก (รายห้อง)</h1>
            <p className="text-gray-500 mt-1">เพิ่มและแก้ไขหมายเลขห้องพัก</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 bg-white p-2 rounded-xl shadow-sm w-fit border border-gray-100">
          <Link href="/admin/rooms/types" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">ประเภทห้องพัก</Link>
          <Link href="/admin/rooms/single" className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-50 text-blue-700">จัดการรายห้อง</Link>
          <Link href="/admin/rooms/amenities" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">สิ่งอำนวยความสะดวก</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Form */}
          <div className="card p-6 lg:col-span-1 h-fit">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <PlusCircle size={20} className="text-blue-600" />
              เพิ่มห้องพักย่อย
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทห้องพัก</label>
                <select required className="input-field" value={form.room_type_id} onChange={(e) => setForm({ ...form, room_type_id: e.target.value })}>
                  <option value="">เลือกประเภทห้อง...</option>
                  {roomTypes.map((rt: any) => (
                    <option key={rt.id} value={rt.id}>{rt.type_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หมายเลขห้องพัก (เช่น A101)</label>
                <input type="text" required className="input-field" value={form.room_number} onChange={(e) => setForm({ ...form, room_number: e.target.value })} />
              </div>
              <button type="submit" className="btn-primary w-full mt-2 bg-blue-600 hover:bg-blue-700">บันทึกข้อมูล</button>
            </form>
          </div>
          
          {/* Table */}
          <div className="lg:col-span-2">
            <div className="card overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700">
                รายการห้องพักย่อยทั้งหมด
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">หมายเลขห้อง</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">ประเภทห้อง</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">สถานะ</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {loading ? (
                       <tr><td colSpan={4} className="p-4 text-center text-gray-500">กำลังโหลด...</td></tr>
                    ) : singleRooms.length === 0 ? (
                       <tr><td colSpan={4} className="p-4 text-center text-gray-500">ยังไม่มีข้อมูล</td></tr>
                    ) : (
                      singleRooms.map((sr: any) => (
                        <tr key={sr.room_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{sr.room_number}</td>
                          <td className="px-4 py-3 text-gray-600">{sr.type_name}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                              sr.status === 'available' ? 'bg-green-100 text-green-700' : 
                              sr.status === 'occupied' ? 'bg-blue-100 text-blue-700' :
                              sr.status === 'maintenance' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {sr.status === 'available' ? 'ว่าง' : 
                               sr.status === 'occupied' ? 'มีผู้เข้าพัก' :
                               sr.status === 'maintenance' ? 'ปิดปรับปรุง' : sr.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openEditModal(sr)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไข">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => handleDelete(sr.room_id, sr.room_number)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="ลบ">
                                <Trash2 size={16} />
                              </button>
                            </div>
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

      {/* Edit Single Room Modal */}
      {showEditModal && editingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">แก้ไขห้องพัก</h3>
              <button onClick={() => { setShowEditModal(false); setEditingRoom(null); }} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleUpdateRoom} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หมายเลขห้อง</label>
                <input type="text" required className="input-field" value={editingRoom.room_number} onChange={(e) => setEditingRoom({ ...editingRoom, room_number: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                <select className="input-field" value={editingRoom.status} onChange={(e) => setEditingRoom({ ...editingRoom, status: e.target.value })}>
                  <option value="available">ว่าง</option>
                  <option value="occupied">มีผู้เข้าพัก</option>
                  <option value="maintenance">ปิดปรับปรุง</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowEditModal(false); setEditingRoom(null); }} className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">ยกเลิก</button>
                <button type="submit" className="flex-1 btn-primary bg-blue-600 hover:bg-blue-700">บันทึก</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
