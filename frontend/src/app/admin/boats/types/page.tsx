'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Anchor, LayoutDashboard, Clock } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function BoatTypesPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ allowedRoles: ['admin'] });
  const [boatTypes, setBoatTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '', capacity: 1, price_per_hour: 0, quantity: 1 });

  useEffect(() => {
    if (!ready) return;
    fetchBoatTypes();
  }, [ready]);

  const fetchBoatTypes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/kayaks');
      setBoatTypes(res.data?.data || []);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลประเภทเรือได้');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/kayaks', form);
      toast.success('สร้างประเภทเรือสำเร็จ');
      setForm({ name: '', description: '', capacity: 1, price_per_hour: 0, quantity: 1 });
      fetchBoatTypes();
    } catch {
      toast.error('สร้างประเภทเรือไม่สำเร็จ');
    }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">จัดการเรือและคายัค</h1>
          <p className="text-gray-500 mt-1">เพิ่มและจัดการประเภทเรือ</p>
        </div>

        {/* Sub Navigation */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <Link href="/staff/boats/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">
            <LayoutDashboard size={15} /> แดชบอร์ด
          </Link>
          <Link href="/admin/boats/types" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-cyan-600 text-white shadow-sm">
            <Anchor size={15} /> ประเภทเรือ
          </Link>
          <Link href="/admin/boats/rounds" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">
            <Clock size={15} /> รอบเวลาเรือ
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="card p-6 lg:col-span-1 h-fit">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Anchor size={20} className="text-cyan-600" /> เพิ่มประเภทเรือ
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อประเภทเรือ</label>
                <input type="text" required className="input-field" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                <textarea className="input-field" rows={2} value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ที่นั่ง</label>
                  <input type="number" required min="1" className="input-field px-2" value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ราคา/รอบ</label>
                  <input type="number" required min="0" className="input-field px-2" value={form.price_per_hour}
                    onChange={(e) => setForm({ ...form, price_per_hour: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">จำนวนลำ</label>
                  <input type="number" required min="1" className="input-field px-2" value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full bg-cyan-600 hover:bg-cyan-700">สร้างประเภทเรือ</button>
            </form>
          </div>

          {/* Table */}
          <div className="card overflow-hidden lg:col-span-2">
            <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700">รายการประเภทเรือทั้งหมด</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">ชื่อ</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">ที่นั่ง</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">ราคา/รอบ</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">จำนวนลำ</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {loading ? (
                    <tr><td colSpan={5} className="p-4 text-center text-gray-400">กำลังโหลด...</td></tr>
                  ) : boatTypes.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-gray-400">ยังไม่มีข้อมูล</td></tr>
                  ) : boatTypes.map((bt: any) => (
                    <tr key={bt.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-gray-900">{bt.name}</td>
                      <td className="px-4 py-3 text-gray-600">{bt.capacity} ที่นั่ง</td>
                      <td className="px-4 py-3 text-cyan-600 font-semibold">฿{Number(bt.price_per_hour).toLocaleString()}</td>
                      <td className="px-4 py-3">{bt.quantity} ลำ</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">เปิดใช้งาน</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
