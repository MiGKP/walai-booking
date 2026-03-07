'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, CalendarDays, Anchor, CreditCard, CheckCircle, PlusCircle, Home, Sailboat } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';

const statusLabel: Record<string, string> = { pending: 'รอดำเนินการ', paid: 'รอตรวจสอบชำระเงิน', approved: 'ยืนยันแล้ว', cancelled: 'ยกเลิก', rejected: 'ถูกปฏิเสธ' };
const statusClass: Record<string, string> = { pending: 'bg-orange-100 text-orange-700', paid: 'bg-blue-100 text-blue-700', approved: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-700', rejected: 'bg-red-100 text-red-700' };

export default function AdminPage() {
  const router = useRouter();
  const { ready, user } = useAuthGuard({ allowedRoles: ['admin'] });
  const [tab, setTab] = useState<'bookings' | 'kayaks' | 'payments'>('bookings');
  const [roomBookings, setRoomBookings] = useState<any[]>([]);
  const [kayakBookings, setKayakBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    fetchAll();
  }, [ready]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [rb, kb, pmt, st] = await Promise.all([
        api.get('/bookings'),
        api.get('/kayaks/bookings/all').catch(() => ({ data: { data: [] } })),
        api.get('/payments'),
        api.get('/auth/staff').catch(() => ({ data: { data: [] } })),
      ]);
      setRoomBookings(rb.data?.data || []);
      setKayakBookings(kb.data?.data || []);
      setPayments(pmt.data?.data || []);
      setStaffList(st.data?.data || []);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (type: 'room' | 'kayak', id: number, status: string) => {
    try {
      if (type === 'room') await api.put(`/bookings/${id}/status`, { status });
      // else await api.put(`/kayaks/bookings/${id}/status`, { status }); // if implemented
      toast.success('อัปเดตสถานะสำเร็จ');
      fetchAll();
    } catch {
      toast.error('อัปเดตสถานะไม่สำเร็จ');
    }
  };

  const confirmPayment = async (id: string) => {
    try {
      await api.put(`/payments/${id}/confirm`, { transaction_ref: `TXN-${Date.now()}` });
      toast.success('ยืนยันการชำระเงินสำเร็จ');
      fetchAll();
    } catch {
      toast.error('ยืนยันการชำระเงินไม่สำเร็จ');
    }
  };

  const stats = [
    { label: 'การจองห้องพัก', value: roomBookings.length, icon: <CalendarDays size={24} />, color: 'text-teal-600 bg-teal-50' },
    { label: 'การจองเรือ', value: kayakBookings.length, icon: <Anchor size={24} />, color: 'text-cyan-600 bg-cyan-50' },
    { label: 'รายการชำระเงินทั้งหมด', value: payments.length, icon: <CreditCard size={24} />, color: 'text-blue-600 bg-blue-50' },
    { label: 'พนักงานระบบ', value: staffList.length, icon: <Users size={24} />, color: 'text-indigo-600 bg-indigo-50' },
  ];

  const managementMenus = [
    { label: 'จัดการพนักงาน', icon: <Users size={32} />, desc: 'เพิ่ม ลบ แก้ไข ข้อมูลพนักงาน', path: '/admin/staff', color: 'bg-indigo-100 text-indigo-700', hover: 'hover:bg-indigo-50 hover:border-indigo-200' },
    { label: 'จัดการประเภทห้องพัก', icon: <Home size={32} />, desc: 'เพิ่มประเภทห้องพัก', path: '/admin/rooms/types', color: 'bg-teal-100 text-teal-700', hover: 'hover:bg-teal-50 hover:border-teal-200' },
    { label: 'จัดการสิ่งอำนวยความสะดวก', icon: <CheckCircle size={32} />, desc: 'เพิ่มสิ่งอำนวยความสะดวกในห้องพัก', path: '/admin/rooms/amenities', color: 'bg-green-100 text-green-700', hover: 'hover:bg-green-50 hover:border-green-200' },
    { label: 'จัดการหมายเลขห้องพัก', icon: <PlusCircle size={32} />, desc: 'เพิ่มหมายเลขห้องพักรายห้อง', path: '/admin/rooms/single', color: 'bg-blue-100 text-blue-700', hover: 'hover:bg-blue-50 hover:border-blue-200' },
    { label: 'จัดการประเภทเรือ', icon: <Anchor size={32} />, desc: 'เพิ่มประเภทเรือและคายัค', path: '/admin/boats/types', color: 'bg-cyan-100 text-cyan-700', hover: 'hover:bg-cyan-50 hover:border-cyan-200' },
    { label: 'จัดการรอบเวลาเรือ', icon: <Sailboat size={32} />, desc: 'เพิ่มรอบเวลาสำหรับเรือ', path: '/admin/boats/rounds', color: 'bg-sky-100 text-sky-700', hover: 'hover:bg-sky-50 hover:border-sky-200' },
  ];

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">แผงควบคุม Admin</h1>
          <p className="text-gray-500 mt-1">ภาพรวมระบบและการจัดการ</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s, i) => (
            <div key={i} className="card p-5 flex items-center gap-4 border border-transparent hover:border-gray-200 transition-colors">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Management Quick Links */}
        <div className="mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-4">เมนูจัดการระบบ (สร้างข้อมูล)</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {managementMenus.map((m, i) => (
              <button 
                key={i} 
                onClick={() => router.push(m.path)}
                className={`card p-6 flex items-start gap-4 text-left border border-transparent transition-all ${m.hover}`}
              >
                <div className={`p-4 rounded-2xl ${m.color}`}>
                  {m.icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{m.label}</h3>
                  <p className="text-sm text-gray-500 mt-1">{m.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Tabs for Data Tables */}
        <h2 className="text-lg font-bold text-gray-900 mb-4">รายการจองและชำระเงิน</h2>
        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
          {(['bookings', 'kayaks', 'payments'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              {t === 'bookings' ? 'รายการจองห้องพัก' : t === 'kayaks' ? 'รายการจองเรือ' : 'ตรวจสอบการชำระเงิน'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="card h-20 animate-pulse bg-gray-100" />)}</div>
        ) : (
          <>
            {/* Room Bookings */}
            {tab === 'bookings' && (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>{['#', 'ลูกค้า', 'ห้อง', 'เช็คอิน', 'เช็คเอาต์', 'ราคา', 'สถานะ', 'จัดการ'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {roomBookings.map((b: any) => (
                        <tr key={b.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400">#{b.id}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{b.user_name}</p>
                            <p className="text-xs text-gray-400">{b.user_email}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{b.room_name}</td>
                          <td className="px-4 py-3 text-gray-600">{new Date(b.check_in_date).toLocaleDateString('th-TH')}</td>
                          <td className="px-4 py-3 text-gray-600">{new Date(b.check_out_date).toLocaleDateString('th-TH')}</td>
                          <td className="px-4 py-3 font-semibold text-teal-600">฿{Number(b.total_price).toLocaleString()}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${statusClass[b.status] || 'bg-gray-100 text-gray-600'}`}>{statusLabel[b.status] || b.status}</span></td>
                          <td className="px-4 py-3">
                            {b.status === 'pending' && (
                              <button onClick={() => updateBookingStatus('room', b.id, 'approved')}
                                className="text-xs text-teal-600 hover:text-teal-700 font-medium">ยืนยัน</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Kayak Bookings */}
            {tab === 'kayaks' && (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>{['#', 'ลูกค้า', 'เรือ', 'วันที่', 'เวลา', 'ราคา', 'สถานะ'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {kayakBookings.map((b: any) => (
                        <tr key={b.boat_booking_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400">#{b.boat_booking_id}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{b.user_name}</p>
                            <p className="text-xs text-gray-400">{b.user_email}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{b.kayak_name}</td>
                          <td className="px-4 py-3 text-gray-600">{new Date(b.booking_date).toLocaleDateString('th-TH')}</td>
                          <td className="px-4 py-3 text-gray-600">{b.start_time?.slice(0,5)} - {b.end_time?.slice(0,5)}</td>
                          <td className="px-4 py-3 font-semibold text-teal-600">฿{Number(b.total_price).toLocaleString()}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${statusClass[b.status] || 'bg-gray-100 text-gray-600'}`}>{statusLabel[b.status] || b.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payments */}
            {tab === 'payments' && (
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>{['# ID', 'ลูกค้า', 'ประเภท', 'ยอด', 'สถานะ', 'สลิป', 'จัดการ'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {payments.map((p: any) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-gray-400">{p.id}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{p.user_name}</p>
                            <p className="text-xs text-gray-400">{p.user_email}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-700">{p.booking_type === 'room' ? 'ห้องพัก' : 'เรือ'}</td>
                          <td className="px-4 py-3 font-semibold text-teal-600">฿{Number(p.amount).toLocaleString()}</td>
                          <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-bold ${statusClass[p.status] || 'bg-gray-100 text-gray-600'}`}>{statusLabel[p.status] || p.status}</span></td>
                          <td className="px-4 py-3">
                            {p.slip_image ? (
                              <a href={`http://localhost:5000${p.slip_image}`} target="_blank" rel="noopener noreferrer"
                                className="text-teal-600 hover:text-teal-700 text-xs font-medium">ดูสลิป</a>
                            ) : <span className="text-gray-300 text-xs">-</span>}
                          </td>
                          <td className="px-4 py-3">
                            {p.status === 'pending' && p.slip_image && (
                              <button onClick={() => confirmPayment(p.id)}
                                className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium">
                                <CheckCircle size={14} /> ยืนยันสลิป
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
