'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Anchor, CheckCircle, XCircle, Clock, Eye, X, BarChart3, Phone, Timer, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

// map ชื่อสถานะที่ใช้แสดงบน UI ของฝั่งเรือ เพื่อให้เจ้าหน้าที่อ่านความหมายของแต่ละสถานะได้ตรงกัน
const statusLabel: Record<string, string> = {
  pending: 'รอดำเนินการ',
  paid: 'รอตรวจสอบสลิป',
  approved: 'ยืนยันแล้ว',
  cancelled: 'ยกเลิก',
  rejected: 'ถูกปฏิเสธ',
  checked_out: 'เช็คเอาต์แล้ว',
};
const statusClass: Record<string, string> = {
  pending: 'bg-orange-100 text-orange-700',
  paid: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
  rejected: 'bg-red-100 text-red-700',
  checked_out: 'bg-teal-100 text-teal-700',
};

// หน้าแดชบอร์ดของ boat staff สำหรับตรวจสอบสลิป ดูรายการจอง และอนุมัติหรือปฏิเสธการจองเรือ
export default function BoatStaffDashboard() {
  const router = useRouter();
  const { ready, user } = useAuthGuard({ allowedRoles: ['admin', 'boat_staff'] });
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'has_slip' | 'pending' | 'approved' | 'checked_out'>('has_slip');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [slipModal, setSlipModal] = useState<{ open: boolean; url: string; name: string }>({ open: false, url: '', name: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filter, dateFrom, dateTo]);

  useEffect(() => {
    if (!ready) return;
    fetchBookings();
  }, [ready]);

  // โหลดรายการจองเรือทั้งหมดจาก backend เพื่อให้พนักงานเรือจัดการรายการที่ต้องตรวจสอบได้
  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/kayaks/bookings/all');
      setBookings(res.data?.data || []);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลการจองได้');
    } finally {
      setLoading(false);
    }
  };

  // อัปเดตสถานะการจองเรือหลังจากเจ้าหน้าที่ตรวจสอบสลิปหรือพิจารณารายการแล้ว
  const handleStatus = async (id: number, status: 'approved' | 'rejected') => {
    const label = status === 'approved' ? 'ยืนยัน' : 'ปฏิเสธ';
    if (!confirm(`ต้องการ${label}การจองนี้?`)) return;
    try {
      await api.put(`/kayaks/bookings/${id}/status`, { status });
      toast.success(`${label}การจองสำเร็จ`);
      fetchBookings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || `${label}ไม่สำเร็จ`);
    }
  };

  const handleCheckout = async (id: number) => {
    if (!confirm('ยืนยันเช็คเอาต์?')) return;
    try {
      await api.put(`/kayaks/bookings/${id}/checkout`);
      toast.success('เช็คเอาต์สำเร็จ');
      fetchBookings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เช็คเอาต์ไม่สำเร็จ');
    }
  };

  const filtered = (() => {
    let list = bookings;
    if (filter === 'has_slip') list = list.filter(b => b.payment_slip && b.status !== 'approved' && b.status !== 'rejected' && b.status !== 'checked_out' && b.status !== 'cancelled');
    else if (filter === 'pending') list = list.filter(b => !b.payment_slip && b.status === 'pending');
    else if (filter === 'approved') list = list.filter(b => b.status === 'approved');
    else if (filter === 'checked_out') list = list.filter(b => b.status === 'checked_out');
    if (dateFrom) list = list.filter(b => b.booking_date && new Date(b.booking_date) >= new Date(dateFrom));
    if (dateTo) list = list.filter(b => b.booking_date && new Date(b.booking_date) <= new Date(dateTo));
    return list;
  })();

  const counts = {
    has_slip: bookings.filter(b => b.payment_slip && b.status !== 'approved' && b.status !== 'rejected' && b.status !== 'checked_out' && b.status !== 'cancelled').length,
    pending: bookings.filter(b => !b.payment_slip && b.status === 'pending').length,
    approved: bookings.filter(b => b.status === 'approved').length,
    checked_out: bookings.filter(b => b.status === 'checked_out').length,
  };

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginatedBookings = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!ready) return null;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/staff/boats/dashboard" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <Anchor size={20} className="text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">แดชบอร์ดพนักงานเรือ</h1>
              <p className="text-gray-500 mt-0.5">จัดการและยืนยันการจองเรือและคายัค</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin/boat-hours" className="flex items-center gap-1.5 text-xs bg-sky-50 text-sky-700 hover:bg-sky-100 px-3 py-1.5 rounded-xl border border-sky-200 transition-colors">
              <Clock size={13} /> เวลาทำการ
            </Link>
            <Link href="/admin/contact" className="flex items-center gap-1.5 text-xs bg-pink-50 text-pink-700 hover:bg-pink-100 px-3 py-1.5 rounded-xl border border-pink-200 transition-colors">
              <Phone size={13} /> ติดต่อ
            </Link>
            <Link href="/admin/stats" className="flex items-center gap-1.5 text-xs bg-rose-50 text-rose-700 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 transition-colors">
              <BarChart3 size={13} /> สถิติ
            </Link>
            <span className="text-sm text-gray-500 bg-white px-3 py-1.5 rounded-full border border-gray-200">
              {user?.role === 'admin' ? 'ผู้ดูแลระบบ' : 'พนักงานเรือ'}
            </span>
          </div>
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

        {/* Date Range Filter */}
        <div className="flex gap-3 mb-4 items-center flex-wrap">
          <span className="text-sm text-gray-500">ช่วงวันจอง:</span>
          <input type="date" className="input-field text-sm py-1.5" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          <span className="text-sm text-gray-400">–</span>
          <input type="date" className="input-field text-sm py-1.5" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-red-500 hover:text-red-700 underline">ล้าง</button>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {([
            ['all', 'ทั้งหมด', bookings.length],
            ['has_slip', 'รอตรวจสอบสลิป', counts.has_slip],
            ['pending', 'รอดำเนินการ (ยังไม่จ่าย)', counts.pending],
            ['approved', 'ยืนยันแล้ว (รอ check-out)', counts.approved],
            ['checked_out', 'เช็คเอาต์แล้ว', counts.checked_out],
          ] as const).map(([val, label, count]) => (
            <button
              key={val}
              onClick={() => setFilter(val as any)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filter === val ? 'bg-cyan-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
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
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">ประเภทเรือ</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">วันที่จอง</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">รอบ</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">ราคา</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">สถานะ</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">สลิป</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">การดำเนินการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {loading ? (
                  <tr><td colSpan={9} className="p-8 text-center text-gray-400">กำลังโหลด...</td></tr>
                ) : paginatedBookings.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-gray-400">ไม่มีรายการ</td></tr>
                ) : (
                  paginatedBookings.map((b: any) => (
                    <tr key={b.boat_booking_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs">#{b.boat_booking_id}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{b.user_name || '-'}</p>
                        <p className="text-xs text-gray-400">{b.user_email || ''}</p>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800">{b.kayak_name || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {b.booking_date ? new Date(b.booking_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '-'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {b.start_time && b.end_time ? `${b.start_time?.slice(0,5)} - ${b.end_time?.slice(0,5)}` : '-'}
                      </td>
                      <td className="px-4 py-3 font-semibold text-cyan-600">฿{Number(b.total_price || 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusClass[b.status] || 'bg-gray-100 text-gray-600'}`}>
                            {statusLabel[b.status] || b.status}
                          </span>
                          {b.approved_by_name && (b.status === 'approved' || b.status === 'rejected' || b.status === 'checked_out') && (
                            <span className="text-[10px] text-gray-400 whitespace-nowrap">
                              โดย: {b.approved_by_name}
                            </span>
                          )}
                        </div>
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
                        {b.status === 'approved' ? (
                          <button
                            onClick={() => handleCheckout(b.boat_booking_id)}
                            className="flex items-center gap-1 text-xs bg-teal-50 hover:bg-teal-100 text-teal-700 font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                          >
                            ✅ Check-out
                          </button>
                        ) : b.status === 'checked_out' ? (
                          <span className="text-xs text-teal-600 font-medium bg-teal-50 px-2.5 py-1.5 rounded-lg inline-block">เช็คเอาต์แล้ว</span>
                        ) : b.status === 'rejected' ? (
                          <span className="text-xs text-red-500 font-medium bg-red-50 px-2.5 py-1.5 rounded-lg inline-block">ปฏิเสธแล้ว</span>
                        ) : b.status === 'cancelled' ? (
                          <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2.5 py-1.5 rounded-lg inline-block">ยกเลิกแล้ว</span>
                        ) : b.payment_slip ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleStatus(b.boat_booking_id, 'approved')}
                              className="flex items-center gap-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              <CheckCircle size={13} /> ยืนยัน
                            </button>
                            <button
                              onClick={() => handleStatus(b.boat_booking_id, 'rejected')}
                              className="flex items-center gap-1 text-xs bg-red-50 hover:bg-red-100 text-red-600 font-medium px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              <XCircle size={13} /> ปฏิเสธ
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">รอดำเนินการ</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-100">
              <span className="text-sm text-gray-500">
                แสดง {(currentPage - 1) * itemsPerPage + 1} ถึง {Math.min(currentPage * itemsPerPage, filtered.length)} จาก {filtered.length} รายการ
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50 transition-colors"
                >
                  <ChevronLeft size={18} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === page ? 'bg-cyan-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-50 hover:bg-gray-50 transition-colors"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          )}
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
