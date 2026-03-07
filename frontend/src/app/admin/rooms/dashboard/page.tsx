'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, CheckCircle, XCircle, Clock, Eye, X, Home } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

// map ชื่อสถานะที่ใช้แสดงบน UI เพื่อให้เจ้าหน้าที่เข้าใจสถานะการจองได้ง่ายขึ้น
const statusLabel: Record<string, string> = {
  pending: 'รอดำเนินการ',
  paid: 'รอตรวจสอบสลิป',
  approved: 'ยืนยันแล้ว',
  cancelled: 'ยกเลิก',
  rejected: 'ถูกปฏิเสธ',
};
const statusClass: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-700',
  paid: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
  rejected: 'bg-red-100 text-red-700',
};

// หน้าแดชบอร์ดของ room staff สำหรับตรวจสอบสลิป ดูรายการจอง และอนุมัติหรือปฏิเสธการจองห้องพัก
export default function RoomStaffDashboard() {
  const router = useRouter();
  const { ready, user } = useAuthGuard({ allowedRoles: ['admin', 'room_staff'] });
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'has_slip' | 'pending' | 'approved'>('has_slip');
  const [slipModal, setSlipModal] = useState<{ open: boolean; url: string; name: string }>({ open: false, url: '', name: '' });

  useEffect(() => {
    if (!ready) return;
    fetchBookings();
  }, [ready]);

  // โหลดรายการจองห้องทั้งหมดจาก backend เพื่อแสดงในตารางของ staff dashboard
  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings');
      setBookings(res.data?.data || []);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลการจองได้');
    } finally {
      setLoading(false);
    }
  };

  // เปลี่ยนสถานะรายการจองเป็น approved หรือ rejected หลังจากเจ้าหน้าที่ตรวจสอบสลิปแล้ว
  const handleStatus = async (id: number, status: 'approved' | 'rejected') => {
    const label = status === 'approved' ? 'ยืนยัน' : 'ปฏิเสธ';
    if (!confirm(`ต้องการ${label}การจองนี้?`)) return;
    try {
      await api.put(`/bookings/${id}/status`, { status });
      toast.success(`${label}การจองสำเร็จ`);
      fetchBookings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || `${label}ไม่สำเร็จ`);
    }
  };

  const filtered = (() => {
    if (filter === 'all') return bookings;
    if (filter === 'has_slip') return bookings.filter(b => b.payment_slip && b.status !== 'approved' && b.status !== 'rejected');
    if (filter === 'pending') return bookings.filter(b => !b.payment_slip && b.status === 'pending');
    if (filter === 'approved') return bookings.filter(b => b.status === 'approved');
    return bookings;
  })();

  const counts = {
    has_slip: bookings.filter(b => b.payment_slip && b.status !== 'approved' && b.status !== 'rejected').length,
    pending: bookings.filter(b => !b.payment_slip && b.status === 'pending').length,
    approved: bookings.filter(b => b.status === 'approved').length,
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/staff/rooms/dashboard" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <Home size={20} className="text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">แดชบอร์ดพนักงานห้องพัก</h1>
              <p className="text-gray-500 mt-0.5">จัดการและยืนยันการจองห้องพัก</p>
            </div>
          </div>
          <span className="text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200">
            {user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงานห้องพัก'}
          </span>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Eye size={22} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">รอตรวจสอบสลิป</p>
              <p className="text-2xl font-bold text-blue-600">{counts.has_slip}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <Clock size={22} className="text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">รอดำเนินการ</p>
              <p className="text-2xl font-bold text-orange-500">{counts.pending}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <CheckCircle size={22} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">ยืนยันแล้ว</p>
              <p className="text-2xl font-bold text-green-600">{counts.approved}</p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {([
            ['all', 'ทั้งหมด', bookings.length],
            ['has_slip', 'รอตรวจสอบสลิป', counts.has_slip],
            ['pending', 'รอดำเนินการ (ยังไม่จ่าย)', counts.pending],
            ['approved', 'ยืนยันแล้ว', counts.approved],
          ] as const).map(([val, label, count]) => (
            <button
              key={val}
              onClick={() => setFilter(val as any)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === val ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
            >
              {label} ({count})
            </button>
          ))}
        </div>

        {/* Bookings Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">#</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">ลูกค้า</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">ห้อง</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">เช็คอิน - เช็คเอาต์</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">ราคา</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">สถานะ</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">สลิป</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {loading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-400">กำลังโหลด...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-400">ไม่มีรายการ</td></tr>
                ) : (
                  filtered.map((b: any) => (
                    <tr key={b.room_booking_id || b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs">#{b.room_booking_id || b.id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{b.user_name || '-'}</p>
                        <p className="text-xs text-gray-400">{b.user_email || ''}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800">{b.room_name || b.type_name || '-'}</p>
                        <p className="text-xs text-gray-400">ห้อง {b.room_number || b.room_id}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <p>{b.check_in ? new Date(b.check_in).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}</p>
                        <p className="text-xs text-gray-400">{b.check_out ? new Date(b.check_out).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-teal-600">฿{Number(b.total_price || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusClass[b.status] || 'bg-gray-100 text-gray-600'}`}>
                          {statusLabel[b.status] || b.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {b.payment_slip ? (
                          <button
                            onClick={() => setSlipModal({ open: true, url: `http://localhost:5000${b.payment_slip}`, name: b.user_name || 'slip' })}
                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            <Eye size={13} /> ดูสลิป
                          </button>
                        ) : (
                          <span className="text-xs text-gray-300">ยังไม่มี</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {b.payment_slip && b.status !== 'approved' && b.status !== 'rejected' && b.status !== 'cancelled' ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStatus(b.room_booking_id || b.id, 'approved')}
                              className="flex items-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              <CheckCircle size={13} /> ยืนยัน
                            </button>
                            <button
                              onClick={() => handleStatus(b.room_booking_id || b.id, 'rejected')}
                              className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              <XCircle size={13} /> ปฏิเสธ
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">{b.status === 'approved' ? 'ยืนยันแล้ว' : b.status === 'rejected' ? 'ปฏิเสธแล้ว' : '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Slip Modal */}
      {slipModal.open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSlipModal({ open: false, url: '', name: '' })}>
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">สลิปการชำระเงิน — {slipModal.name}</h3>
              <button onClick={() => setSlipModal({ open: false, url: '', name: '' })} className="p-1 hover:bg-gray-100 rounded-full">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slipModal.url} alt="payment slip" className="w-full rounded-xl object-contain max-h-[70vh]"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
