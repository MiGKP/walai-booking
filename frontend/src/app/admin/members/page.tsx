'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Search, Power, PowerOff, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function AdminMembersPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ allowedRoles: ['admin'] });
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  useEffect(() => {
    if (!ready) return;
    fetchMembers();
  }, [ready]);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/auth/members', { params });
      setMembers(res.data?.data || []);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลสมาชิกได้');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: number, current: boolean) => {
    try {
      await api.put(`/auth/members/${id}/status`, { is_active: !current });
      toast.success(current ? 'ปิดการใช้งานสมาชิกแล้ว' : 'เปิดการใช้งานสมาชิกแล้ว');
      fetchMembers();
    } catch {
      toast.error('เปลี่ยนสถานะไม่สำเร็จ');
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchMembers();
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">จัดการสมาชิก</h1>
            <p className="text-gray-500 mt-0.5">ค้นหาและจัดการสถานะบัญชีสมาชิก</p>
          </div>
        </div>

        {/* Search + Filter */}
        <form onSubmit={handleSearch} className="flex gap-3 mb-6 flex-wrap">
          <div className="flex-1 min-w-60 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="input-field pl-9"
              placeholder="ค้นหาด้วยชื่อหรืออีเมล..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input-field w-40"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
          >
            <option value="all">ทุกสถานะ</option>
            <option value="active">ใช้งานอยู่</option>
            <option value="inactive">ถูกปิด</option>
          </select>
          <button type="submit" className="btn-primary px-6">ค้นหา</button>
        </form>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Users size={18} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">สมาชิกทั้งหมด</p>
              <p className="text-xl font-bold text-indigo-600">{members.length}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <Power size={18} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">ใช้งานอยู่</p>
              <p className="text-xl font-bold text-green-600">{members.filter(m => m.is_active !== false).length}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <PowerOff size={18} className="text-red-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">ถูกปิด</p>
              <p className="text-xl font-bold text-red-500">{members.filter(m => m.is_active === false).length}</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">ชื่อ - อีเมล</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">เบอร์โทร</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">จองห้องพัก</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">จองเรือ</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">วันที่สมัคร</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">สถานะ</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {loading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-400">กำลังโหลด...</td></tr>
                ) : members.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-400">ไม่พบสมาชิก</td></tr>
                ) : members.map((m: any) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-400 text-xs">#{m.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{`${m.first_name || ''} ${m.last_name || ''}`.trim() || '-'}</p>
                      <p className="text-xs text-gray-400">{m.email}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.phone || '-'}</td>
                    <td className="px-4 py-3 text-center font-medium text-teal-600">{m.room_booking_count ?? 0}</td>
                    <td className="px-4 py-3 text-center font-medium text-cyan-600">{m.boat_booking_count ?? 0}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {m.created_at ? new Date(m.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${m.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {m.is_active !== false ? 'ใช้งานอยู่' : 'ถูกปิด'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(m.id, m.is_active !== false)}
                        title={m.is_active !== false ? 'ปิดการใช้งาน' : 'เปิดการใช้งาน'}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${m.is_active !== false ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${m.is_active !== false ? 'translate-x-6' : 'translate-x-1'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
