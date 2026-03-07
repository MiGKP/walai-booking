'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, Anchor, LayoutDashboard } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function BoatRoundsPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ allowedRoles: ['admin'] });
  const [boatTypes, setBoatTypes] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ boat_type_id: '', start_time: '', end_time: '' });

  useEffect(() => {
    if (!ready) return;
    fetchData();
  }, [ready]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [btRes, rndRes] = await Promise.all([
        api.get('/kayaks'),
        api.get('/kayaks/schedule'),
      ]);
      setBoatTypes(btRes.data?.data || []);
      setRounds(rndRes.data?.data || []);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/kayaks/rounds', form);
      toast.success('สร้างรอบเวลาสำเร็จ');
      setForm({ ...form, start_time: '', end_time: '' });
      fetchData();
    } catch {
      toast.error('สร้างรอบเวลาไม่สำเร็จ');
    }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">จัดการเรือและคายัค</h1>
          <p className="text-gray-500 mt-1">เพิ่มและจัดการรอบเวลาเรือ</p>
        </div>

        {/* Sub Navigation */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <Link href="/staff/boats/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">
            <LayoutDashboard size={15} /> แดชบอร์ด
          </Link>
          <Link href="/admin/boats/types" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">
            <Anchor size={15} /> ประเภทเรือ
          </Link>
          <Link href="/admin/boats/rounds" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-cyan-600 text-white shadow-sm">
            <Clock size={15} /> รอบเวลาเรือ
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="card p-6 lg:col-span-1 h-fit">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock size={20} className="text-blue-600" /> เพิ่มรอบเวลา
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทเรือ</label>
                <select required className="input-field" value={form.boat_type_id}
                  onChange={(e) => setForm({ ...form, boat_type_id: e.target.value })}>
                  <option value="">เลือกประเภทเรือ...</option>
                  {boatTypes.map((bt: any) => (
                    <option key={bt.id} value={bt.id}>{bt.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เวลาเริ่ม</label>
                  <input type="time" required className="input-field" value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เวลาสิ้นสุด</label>
                  <input type="time" required className="input-field" value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full bg-blue-600 hover:bg-blue-700">เพิ่มรอบเวลา</button>
            </form>
          </div>

          {/* Table */}
          <div className="card overflow-hidden lg:col-span-2">
            <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700">รอบเวลาทั้งหมด</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">ประเภทเรือ</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">เวลาเริ่ม</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">เวลาสิ้นสุด</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {loading ? (
                    <tr><td colSpan={5} className="p-4 text-center text-gray-400">กำลังโหลด...</td></tr>
                  ) : rounds.length === 0 ? (
                    <tr><td colSpan={5} className="p-4 text-center text-gray-400">ยังไม่มีรอบเวลา</td></tr>
                  ) : rounds.map((r: any) => (
                    <tr key={r.boat_round_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs">#{r.boat_round_id}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {boatTypes.find(bt => bt.id === r.boat_type_id)?.name || `ID: ${r.boat_type_id}`}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.start_time?.slice(0, 5)}</td>
                      <td className="px-4 py-3 text-gray-600">{r.end_time?.slice(0, 5)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {r.is_active ? 'เปิดใช้งาน' : 'ปิด'}
                        </span>
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
