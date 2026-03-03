'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Anchor, Clock } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';

export default function BoatManagementPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [boatTypes, setBoatTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [boatTypeForm, setBoatTypeForm] = useState({ name: '', description: '', capacity: 1, price_per_hour: 0, quantity: 1 });
  const [boatRoundForm, setBoatRoundForm] = useState({ boat_type_id: '', start_time: '', end_time: '' });

  useEffect(() => {
    if (!isAuthenticated || !['admin', 'boat_staff'].includes(user?.role || '')) { router.push('/'); return; }
    fetchBoats();
  }, [isAuthenticated, user]);

  const fetchBoats = async () => {
    setLoading(true);
    try {
      const bt = await api.get('/kayaks');
      setBoatTypes(bt.data?.data || []);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลเรือได้');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBoatType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/kayaks', boatTypeForm);
      toast.success('สร้างประเภทเรือสำเร็จ');
      setBoatTypeForm({ name: '', description: '', capacity: 1, price_per_hour: 0, quantity: 1 });
      fetchBoats();
    } catch {
      toast.error('สร้างประเภทเรือไม่สำเร็จ');
    }
  };

  const handleCreateBoatRound = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/kayaks/rounds', boatRoundForm);
      toast.success('สร้างรอบเรือสำเร็จ');
      setBoatRoundForm({ ...boatRoundForm, start_time: '', end_time: '' });
    } catch {
      toast.error('สร้างรอบเรือไม่สำเร็จ');
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
            <h1 className="text-2xl font-bold text-gray-900">จัดการเรือและคายัค</h1>
            <p className="text-gray-500 mt-1">เพิ่มประเภทเรือและจัดการรอบเวลา</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="card p-6 lg:col-span-1 h-fit">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Anchor size={20} className="text-cyan-600" />
                เพิ่มประเภทเรือ
              </h2>
              <form onSubmit={handleCreateBoatType} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อประเภทเรือ</label>
                  <input type="text" required className="input-field" value={boatTypeForm.name} onChange={(e) => setBoatTypeForm({ ...boatTypeForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                  <textarea className="input-field" rows={2} value={boatTypeForm.description} onChange={(e) => setBoatTypeForm({ ...boatTypeForm, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ที่นั่ง</label>
                    <input type="number" required min="1" className="input-field px-2" value={boatTypeForm.capacity} onChange={(e) => setBoatTypeForm({ ...boatTypeForm, capacity: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ราคา/ชม.</label>
                    <input type="number" required min="0" className="input-field px-2" value={boatTypeForm.price_per_hour} onChange={(e) => setBoatTypeForm({ ...boatTypeForm, price_per_hour: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">จำนวนลำ</label>
                    <input type="number" required min="1" className="input-field px-2" value={boatTypeForm.quantity} onChange={(e) => setBoatTypeForm({ ...boatTypeForm, quantity: Number(e.target.value) })} />
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full mt-2 bg-cyan-600 hover:bg-cyan-700">สร้างประเภทเรือ</button>
              </form>
            </div>
            
            <div className="card p-6 lg:col-span-1 h-fit">
              <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Clock size={20} className="text-blue-600" />
                เพิ่มรอบเวลาเรือ
              </h2>
              <form onSubmit={handleCreateBoatRound} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทเรือ</label>
                  <select required className="input-field" value={boatRoundForm.boat_type_id} onChange={(e) => setBoatRoundForm({ ...boatRoundForm, boat_type_id: e.target.value })}>
                    <option value="">เลือกประเภทเรือ...</option>
                    {boatTypes.map((bt: any) => (
                      <option key={bt.id} value={bt.id}>{bt.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">เวลาเริ่ม</label>
                    <input type="time" required className="input-field" value={boatRoundForm.start_time} onChange={(e) => setBoatRoundForm({ ...boatRoundForm, start_time: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">เวลาสิ้นสุด</label>
                    <input type="time" required className="input-field" value={boatRoundForm.end_time} onChange={(e) => setBoatRoundForm({ ...boatRoundForm, end_time: e.target.value })} />
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full mt-2 bg-blue-600 hover:bg-blue-700">เพิ่มรอบเวลา</button>
              </form>
            </div>

            <div className="card overflow-hidden lg:col-span-3">
              <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700">
                รายการประเภทเรือทั้งหมด
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">ประเภทเรือ</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">ที่นั่ง</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">ราคา/ชม.</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">จำนวนลำ</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">สถานะ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {loading ? (
                       <tr><td colSpan={5} className="p-4 text-center text-gray-500">กำลังโหลด...</td></tr>
                    ) : boatTypes.length === 0 ? (
                       <tr><td colSpan={5} className="p-4 text-center text-gray-500">ยังไม่มีข้อมูล</td></tr>
                    ) : (
                      boatTypes.map((bt: any) => (
                        <tr key={bt.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{bt.name}</td>
                          <td className="px-4 py-3 text-gray-600">{bt.capacity} ที่นั่ง</td>
                          <td className="px-4 py-3 text-teal-600 font-semibold">฿{Number(bt.price_per_hour).toLocaleString()}</td>
                          <td className="px-4 py-3">{bt.quantity} ลำ</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700`}>เปิดใช้งาน</span>
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
  );
}
