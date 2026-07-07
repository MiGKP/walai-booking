'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Anchor, CreditCard, CheckCircle, PlusCircle, Home, Sailboat, TrendingUp, BarChart3, MessageSquare, Building2, Phone, Clock, UserCheck, Tag } from 'lucide-react';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/avatar';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';

const statusLabel: Record<string, string> = { pending: 'รอดำเนินการ', paid: 'รอตรวจสอบชำระเงิน', approved: 'ยืนยันแล้ว', cancelled: 'ยกเลิก', rejected: 'ถูกปฏิเสธ' };
const statusClass: Record<string, string> = { pending: 'bg-orange-100 text-orange-700', paid: 'bg-blue-100 text-blue-700', approved: 'bg-green-100 text-green-700', cancelled: 'bg-gray-100 text-gray-700', rejected: 'bg-red-100 text-red-700' };

export default function AdminPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ allowedRoles: ['admin'] });
  const [tab, setTab] = useState<'bookings' | 'kayaks'>('bookings');
  const [roomBookings, setRoomBookings] = useState<any[]>([]);
  const [kayakBookings, setKayakBookings] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    fetchAll();
  }, [ready]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [rb, kb, st] = await Promise.all([
        api.get('/bookings'),
        api.get('/kayaks/bookings/all').catch(() => ({ data: { data: [] } })),
        api.get('/auth/staff').catch(() => ({ data: { data: [] } })),
      ]);
      setRoomBookings(rb.data?.data || []);
      setKayakBookings(kb.data?.data || []);
      setStaffList(st.data?.data || []);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const totalRoomRevenue = roomBookings.filter((b: any) => b.status === 'approved').reduce((sum: number, b: any) => sum + Number(b.total_price || 0), 0);
  const totalKayakRevenue = kayakBookings.filter((b: any) => b.status === 'approved').reduce((sum: number, b: any) => sum + Number(b.total_price || 0), 0);
  const pendingSlip = roomBookings.filter((b: any) => b.status === 'paid').length;
  const approvedRoom = roomBookings.filter((b: any) => b.status === 'approved').length;
  const approvedKayak = kayakBookings.filter((b: any) => b.status === 'approved').length;

  const stats = [
    { label: 'รายได้จากห้องพัก', value: `฿${totalRoomRevenue.toLocaleString()}`, icon: <TrendingUp size={24} />, color: 'text-teal-600 bg-teal-50', sub: `${approvedRoom} การจอง` },
    { label: 'รายได้จากเรือคายัค', value: `฿${totalKayakRevenue.toLocaleString()}`, icon: <Anchor size={24} />, color: 'text-cyan-600 bg-cyan-50', sub: `${approvedKayak} การจอง` },
    { label: 'รอตรวจสอบสลิป', value: pendingSlip, icon: <CreditCard size={24} />, color: 'text-orange-600 bg-orange-50', sub: 'รายการยังไม่ยืนยัน' },
    { label: 'พนักงานระบบ', value: staffList.length, icon: <Users size={24} />, color: 'text-indigo-600 bg-indigo-50', sub: 'ทุกบทบาท' },
  ];

  const managementMenus = [
    { label: 'จัดการพนักงาน', icon: <Users size={32} />, desc: 'เพิ่ม ลบ แก้ไข ข้อมูลพนักงาน', path: '/admin/staff', color: 'bg-indigo-100 text-indigo-700', hover: 'hover:bg-indigo-50 hover:border-indigo-200' },
    { label: 'จัดการประเภทห้องพัก', icon: <Home size={32} />, desc: 'เพิ่มประเภทห้องพัก', path: '/admin/rooms/types', color: 'bg-teal-100 text-teal-700', hover: 'hover:bg-teal-50 hover:border-teal-200' },
    { label: 'จัดการสิ่งอำนวยความสะดวก', icon: <CheckCircle size={32} />, desc: 'เพิ่มสิ่งอำนวยความสะดวกในห้องพัก', path: '/admin/rooms/amenities', color: 'bg-green-100 text-green-700', hover: 'hover:bg-green-50 hover:border-green-200' },
    { label: 'จัดการหมายเลขห้องพัก', icon: <PlusCircle size={32} />, desc: 'เพิ่มหมายเลขห้องพักรายห้อง', path: '/admin/rooms/single', color: 'bg-blue-100 text-blue-700', hover: 'hover:bg-blue-50 hover:border-blue-200' },
    { label: 'จัดการประเภทเรือ', icon: <Anchor size={32} />, desc: 'เพิ่มประเภทเรือและคายัค', path: '/admin/boats/types', color: 'bg-cyan-100 text-cyan-700', hover: 'hover:bg-cyan-50 hover:border-cyan-200' },
    { label: 'จัดการรอบเวลาเรือ', icon: <Sailboat size={32} />, desc: 'เพิ่มรอบเวลาสำหรับเรือ', path: '/admin/boats/rounds', color: 'bg-sky-100 text-sky-700', hover: 'hover:bg-sky-50 hover:border-sky-200' },
    { label: 'จัดการโปรโมชั่น', icon: <Tag size={32} />, desc: 'สร้างโค้ดส่วนลดสำหรับการจองห้องพัก', path: '/admin/promotions', color: 'bg-purple-100 text-purple-700', hover: 'hover:bg-purple-50 hover:border-purple-200' },
    { label: 'ดูรีวิวจากผู้เข้าพัก', icon: <MessageSquare size={32} />, desc: 'รีวิวทั้งหมด พร้อม filter และสถิติ', path: '/admin/reviews', color: 'bg-yellow-100 text-yellow-700', hover: 'hover:bg-yellow-50 hover:border-yellow-200' },
    { label: 'จัดการสมาชิก', icon: <UserCheck size={32} />, desc: 'ค้นหา toggle สถานะบัญชีสมาชิก', path: '/admin/members', color: 'bg-violet-100 text-violet-700', hover: 'hover:bg-violet-50 hover:border-violet-200' },
    { label: 'ข้อมูลสวนวลัยรุกขเวช', icon: <Building2 size={32} />, desc: 'แก้ไขข้อมูลสวน บัญชีธนาคาร เงื่อนไขการจอง', path: '/admin/site-info', color: 'bg-orange-100 text-orange-700', hover: 'hover:bg-orange-50 hover:border-orange-200' },
    { label: 'ข้อมูลติดต่อ', icon: <Phone size={32} />, desc: 'แก้ไขเบอร์โทร Line Facebook ที่อยู่', path: '/admin/contact', color: 'bg-pink-100 text-pink-700', hover: 'hover:bg-pink-50 hover:border-pink-200' },
    { label: 'เวลาทำการเรือ', icon: <Clock size={32} />, desc: 'ตั้งเวลาเปิด-ปิดบริการเรือแต่ละวัน', path: '/admin/boat-hours', color: 'bg-sky-100 text-sky-700', hover: 'hover:bg-sky-50 hover:border-sky-200' },
    { label: 'รายงานสถิติ', icon: <BarChart3 size={32} />, desc: 'รายได้และจำนวนการจองรายวัน/เดือน', path: '/admin/stats', color: 'bg-rose-100 text-rose-700', hover: 'hover:bg-rose-50 hover:border-rose-200' },
  ];

  const [slipModal, setSlipModal] = useState<{ open: boolean; url: string; name: string }>({ open: false, url: '', name: '' });

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">แผงควบคุม Admin</h1>
            <p className="text-gray-500 mt-1">ภาพรวมธุรกิจและการจัดการระบบ</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">รายได้รวม (ที่อนุมัติแล้ว)</p>
            <p className="text-2xl font-bold text-teal-600">฿{(totalRoomRevenue + totalKayakRevenue).toLocaleString()}</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s, i) => (
            <div key={i} className="card p-5 flex items-center gap-4 border border-transparent hover:border-gray-200 transition-colors">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${s.color}`}>{s.icon}</div>
              <div className="min-w-0">
                <p className="text-xl font-bold text-gray-900">{s.value}</p>
                <p className="text-xs text-gray-500 leading-tight">{s.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Revenue Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card p-5 bg-gradient-to-br from-teal-50 to-teal-100 border border-teal-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-teal-700">การจองห้องพักทั้งหมด</p>
              <button onClick={() => router.push('/admin/rooms/dashboard')} className="text-xs font-semibold text-teal-700 hover:text-teal-900 underline">
                ไปที่แดชบอร์ด →
              </button>
            </div>
            <p className="text-2xl font-bold text-teal-800">{roomBookings.length}</p>
            <div className="mt-2 flex gap-3 text-xs">
              <span className="text-green-700 bg-green-100 px-2 py-0.5 rounded-full">ยืนยัน {approvedRoom}</span>
              <span className="text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">รอสลิป {pendingSlip}</span>
              <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">รอจ่าย {roomBookings.filter((b:any)=>b.status==='pending').length}</span>
            </div>
          </div>
          <div className="card p-5 bg-gradient-to-br from-cyan-50 to-cyan-100 border border-cyan-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-cyan-700">การจองเรือคายัคทั้งหมด</p>
              <button onClick={() => router.push('/admin/boats/dashboard')} className="text-xs font-semibold text-cyan-700 hover:text-cyan-900 underline">
                ไปที่แดชบอร์ด →
              </button>
            </div>
            <p className="text-2xl font-bold text-cyan-800">{kayakBookings.length}</p>
            <div className="mt-2 flex gap-3 text-xs">
              <span className="text-green-700 bg-green-100 px-2 py-0.5 rounded-full">ยืนยัน {approvedKayak}</span>
              <span className="text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">รอดำเนินการ {kayakBookings.filter((b:any)=>b.status==='pending').length}</span>
            </div>
          </div>
          <div className="card p-5 bg-gradient-to-br from-indigo-50 to-indigo-100 border border-indigo-200">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-indigo-700">สัดส่วนรายได้</p>
              <TrendingUp size={18} className="text-indigo-600" />
            </div>
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>ห้องพัก</span>
                  <span>฿{totalRoomRevenue.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: totalRoomRevenue + totalKayakRevenue > 0 ? `${Math.round(totalRoomRevenue/(totalRoomRevenue+totalKayakRevenue)*100)}%` : '0%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>เรือคายัค</span>
                  <span>฿{totalKayakRevenue.toLocaleString()}</span>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-500 rounded-full transition-all" style={{ width: totalRoomRevenue + totalKayakRevenue > 0 ? `${Math.round(totalKayakRevenue/(totalRoomRevenue+totalKayakRevenue)*100)}%` : '0%' }} />
                </div>
              </div>
            </div>
          </div>
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
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-lg font-bold text-gray-900">รายการจองทั้งหมด และพนักงานผู้ยืนยันสลิป</h2>
          <div className="flex gap-2">
            <button onClick={() => router.push('/admin/rooms/dashboard')} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 transition-colors">
              🏠 แดชบอร์ดจัดการการจองห้องพัก
            </button>
            <button onClick={() => router.push('/admin/boats/dashboard')} className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border border-cyan-200 transition-colors">
              🛶 แดชบอร์ดจัดการการจองเรือ
            </button>
          </div>
        </div>

        <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-xl w-fit overflow-x-auto">
          {(['bookings', 'kayaks'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
              {t === 'bookings' ? `รายการจองห้องพัก (${roomBookings.length})` : `รายการจองเรือ (${kayakBookings.length})`}
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
                      <tr>{['#', 'ลูกค้า', 'ห้อง', 'เช็คอิน', 'เช็คเอาต์', 'ราคา', 'สถานะ', 'ผู้ยืนยันสลิป', 'สลิป'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {roomBookings.length === 0 ? (
                        <tr><td colSpan={9} className="p-8 text-center text-gray-400">ไม่มีรายการจอง</td></tr>
                      ) : (
                        roomBookings.map((b: any) => (
                          <tr key={b.id || b.room_booking_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-400">#{b.id || b.room_booking_id}</td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{b.user_name || '-'}</p>
                              <p className="text-xs text-gray-400">{b.user_email || ''}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{b.room_name || b.type_name || '-'}</td>
                            <td className="px-4 py-3 text-gray-600">{b.check_in_date || b.check_in ? new Date(b.check_in_date || b.check_in).toLocaleDateString('th-TH') : '-'}</td>
                            <td className="px-4 py-3 text-gray-600">{b.check_out_date || b.check_out ? new Date(b.check_out_date || b.check_out).toLocaleDateString('th-TH') : '-'}</td>
                            <td className="px-4 py-3 font-semibold text-teal-600">฿{Number(b.total_price || 0).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusClass[b.status] || 'bg-gray-100 text-gray-600'}`}>
                                {statusLabel[b.status] || b.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {b.approved_by_name ? (
                                <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 inline-block">
                                  👤 {b.approved_by_name}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-300">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {b.payment_slip ? (
                                <button
                                  onClick={() => setSlipModal({ open: true, url: resolveMediaUrl(b.payment_slip), name: b.user_name || 'slip' })}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-100 transition-colors inline-block"
                                >
                                  ดูสลิป
                                </button>
                              ) : (
                                <span className="text-xs text-gray-300">ไม่มี</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
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
                      <tr>{['#', 'ลูกค้า', 'เรือ', 'วันที่', 'เวลา', 'ราคา', 'สถานะ', 'ผู้ยืนยันสลิป', 'สลิป'].map((h) => (
                        <th key={h} className="text-left px-4 py-3 font-semibold text-gray-600">{h}</th>
                      ))}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {kayakBookings.length === 0 ? (
                        <tr><td colSpan={9} className="p-8 text-center text-gray-400">ไม่มีรายการจอง</td></tr>
                      ) : (
                        kayakBookings.map((b: any) => (
                          <tr key={b.boat_booking_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-400">#{b.boat_booking_id}</td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{b.user_name || '-'}</p>
                              <p className="text-xs text-gray-400">{b.user_email || ''}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-700">{b.kayak_name || '-'}</td>
                            <td className="px-4 py-3 text-gray-600">{b.booking_date ? new Date(b.booking_date).toLocaleDateString('th-TH') : '-'}</td>
                            <td className="px-4 py-3 text-gray-600">{b.start_time ? `${b.start_time.slice(0,5)} - ${b.end_time?.slice(0,5)}` : '-'}</td>
                            <td className="px-4 py-3 font-semibold text-teal-600">฿{Number(b.total_price || 0).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusClass[b.status] || 'bg-gray-100 text-gray-600'}`}>
                                {statusLabel[b.status] || b.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {b.approved_by_name ? (
                                <span className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100 inline-block">
                                  👤 {b.approved_by_name}
                                </span>
                              ) : (
                                <span className="text-xs text-gray-300">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {b.payment_slip ? (
                                <button
                                  onClick={() => setSlipModal({ open: true, url: resolveMediaUrl(b.payment_slip), name: b.user_name || 'slip' })}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-100 transition-colors inline-block"
                                >
                                  ดูสลิป
                                </button>
                              ) : (
                                <span className="text-xs text-gray-300">ไม่มี</span>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Slip Modal */}
      {slipModal.open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSlipModal({ open: false, url: '', name: '' })}>
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">สลิปการชำระเงิน — {slipModal.name}</h3>
              <button onClick={() => setSlipModal({ open: false, url: '', name: '' })} className="p-1 hover:bg-gray-100 rounded-full text-gray-500 font-bold px-2">
                ✕
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
