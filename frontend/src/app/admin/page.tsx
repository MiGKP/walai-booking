'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  Anchor,
  CreditCard,
  CheckCircle,
  PlusCircle,
  Home,
  Sailboat,
  BarChart3,
  MessageSquare,
  Building2,
  Phone,
  Clock,
  UserCheck,
  Tag,
  ArrowRight,
  X,
} from 'lucide-react';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/avatar';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';

const REVENUE_STATUSES = new Set(['approved', 'checked_out']);

const statusLabel: Record<string, string> = {
  pending: 'รอดำเนินการ',
  paid: 'รอตรวจสอบสลิป',
  approved: 'ยืนยันแล้ว',
  cancelled: 'ยกเลิก',
  rejected: 'ถูกปฏิเสธ',
  checked_out: 'เช็คเอาต์แล้ว',
};

const statusClass: Record<string, string> = {
  pending: 'bg-stone-100 text-charcoal-600',
  paid: 'bg-bamboo-50 text-bamboo-700',
  approved: 'bg-forest-50 text-forest-700',
  cancelled: 'bg-stone-100 text-stone-500',
  rejected: 'bg-red-50 text-red-700',
  checked_out: 'bg-lagoon-50 text-lagoon-700',
};

interface MenuItem {
  label: string;
  desc: string;
  path: string;
  icon: React.ReactNode;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

function formatDate(value?: string): string {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('th-TH');
}

function formatMoney(value: number): string {
  return `฿${Number(value || 0).toLocaleString('th-TH')}`;
}

export default function AdminPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ allowedRoles: ['admin'] });
  const [tab, setTab] = useState<'bookings' | 'kayaks'>('bookings');
  const [roomBookings, setRoomBookings] = useState<any[]>([]);
  const [kayakBookings, setKayakBookings] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [slipModal, setSlipModal] = useState<{ open: boolean; url: string; name: string }>({
    open: false,
    url: '',
    name: '',
  });

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

  const totalRoomRevenue = roomBookings
    .filter((b) => REVENUE_STATUSES.has(b.status))
    .reduce((sum, b) => sum + Number(b.total_price || 0), 0);
  const totalKayakRevenue = kayakBookings
    .filter((b) => REVENUE_STATUSES.has(b.status))
    .reduce((sum, b) => sum + Number(b.total_price || 0), 0);
  const totalRevenue = totalRoomRevenue + totalKayakRevenue;
  const pendingSlip =
    roomBookings.filter((b) => b.status === 'paid').length +
    kayakBookings.filter((b) => b.status === 'paid').length;
  const revenueRoomCount = roomBookings.filter((b) => REVENUE_STATUSES.has(b.status)).length;
  const revenueKayakCount = kayakBookings.filter((b) => REVENUE_STATUSES.has(b.status)).length;
  const roomPending = roomBookings.filter((b) => b.status === 'pending').length;
  const kayakPending = kayakBookings.filter((b) => b.status === 'pending').length;
  const roomShare = totalRevenue > 0 ? Math.round((totalRoomRevenue / totalRevenue) * 100) : 0;
  const kayakShare = totalRevenue > 0 ? 100 - roomShare : 0;

  const metrics = [
    {
      label: 'รายได้ห้องพัก',
      value: formatMoney(totalRoomRevenue),
      hint: `${revenueRoomCount} รายการที่ยืนยัน/เช็คเอาต์`,
    },
    {
      label: 'รายได้เรือคายัค',
      value: formatMoney(totalKayakRevenue),
      hint: `${revenueKayakCount} รายการที่ยืนยัน/เช็คเอาต์`,
    },
    {
      label: 'รอตรวจสลิป',
      value: String(pendingSlip),
      hint: 'ต้องยืนยันการชำระเงิน',
    },
    {
      label: 'พนักงาน',
      value: String(staffList.length),
      hint: 'ทุกบทบาทในระบบ',
    },
  ];

  const menuGroups: MenuGroup[] = [
    {
      title: 'ห้องพัก',
      items: [
        { label: 'ประเภทห้องพัก', desc: 'ชื่อ ราคา ความจุ รูป', path: '/admin/rooms/types', icon: <Home size={18} strokeWidth={1.75} /> },
        { label: 'สิ่งอำนวยความสะดวก', desc: 'รายการสิ่งอำนวยความสะดวก', path: '/admin/rooms/amenities', icon: <CheckCircle size={18} strokeWidth={1.75} /> },
        { label: 'หมายเลขห้อง', desc: 'ห้องย่อยตามประเภท', path: '/admin/rooms/single', icon: <PlusCircle size={18} strokeWidth={1.75} /> },
        { label: 'แดชบอร์ดจองห้อง', desc: 'ตรวจสลิป อนุมัติ เช็คเอาต์', path: '/admin/rooms/dashboard', icon: <CreditCard size={18} strokeWidth={1.75} /> },
      ],
    },
    {
      title: 'เรือคายัค',
      items: [
        { label: 'ประเภทเรือ', desc: 'เรือและราคา', path: '/admin/boats/types', icon: <Anchor size={18} strokeWidth={1.75} /> },
        { label: 'รอบเวลา', desc: 'ช่วงเวลาให้บริการ', path: '/admin/boats/rounds', icon: <Sailboat size={18} strokeWidth={1.75} /> },
        { label: 'เวลาทำการ', desc: 'เปิด-ปิดแต่ละวัน', path: '/admin/boat-hours', icon: <Clock size={18} strokeWidth={1.75} /> },
        { label: 'แดชบอร์ดจองเรือ', desc: 'ตรวจสลิป อนุมัติ คืนเรือ', path: '/admin/boats/dashboard', icon: <CreditCard size={18} strokeWidth={1.75} /> },
      ],
    },
    {
      title: 'คนและโปรโมชั่น',
      items: [
        { label: 'พนักงาน', desc: 'บัญชีและสิทธิ์', path: '/admin/staff', icon: <Users size={18} strokeWidth={1.75} /> },
        { label: 'สมาชิก', desc: 'ค้นหา เปิด/ปิดบัญชี', path: '/admin/members', icon: <UserCheck size={18} strokeWidth={1.75} /> },
        { label: 'โปรโมชั่น', desc: 'โค้ดส่วนลด', path: '/admin/promotions', icon: <Tag size={18} strokeWidth={1.75} /> },
        { label: 'รีวิว', desc: 'รีวิวจากผู้เข้าพัก', path: '/admin/reviews', icon: <MessageSquare size={18} strokeWidth={1.75} /> },
      ],
    },
    {
      title: 'ข้อมูลสวนและรายงาน',
      items: [
        { label: 'ข้อมูลสวน', desc: 'บัญชี เงื่อนไขการจอง', path: '/admin/site-info', icon: <Building2 size={18} strokeWidth={1.75} /> },
        { label: 'ติดต่อ', desc: 'โทร Line Facebook ที่อยู่', path: '/admin/contact', icon: <Phone size={18} strokeWidth={1.75} /> },
        { label: 'สถิติ', desc: 'รายได้รายวัน/เดือน', path: '/admin/stats', icon: <BarChart3 size={18} strokeWidth={1.75} /> },
      ],
    },
  ];

  return (
    <div className="min-h-screen pt-16" style={{ backgroundColor: 'var(--color-stone-100)' }}>
      <div className="max-w-7xl mx-auto px-4 py-8 md:py-10">
        {/* Header */}
        <header className="mb-8 md:mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-semibold text-forest-800 tracking-tight">
              แผงควบคุม
            </h1>
            <p className="text-charcoal-400 mt-1.5 text-sm md:text-base max-w-xl">
              ภาพรวมรายได้ การจอง และเมนูจัดการระบบสวนวลัยรุกขเวช
            </p>
          </div>
          <div className="md:text-right">
            <p className="text-xs text-charcoal-400">รายได้รวมที่ยืนยันแล้ว</p>
            <p className="font-display text-3xl font-semibold text-forest-800 tabular-nums">
              {formatMoney(totalRevenue)}
            </p>
          </div>
        </header>

        {/* Metrics - flat strip, no rainbow cards */}
        <section className="mb-8 grid grid-cols-2 lg:grid-cols-4 border border-stone-200 rounded-xl overflow-hidden bg-cream-100">
          {metrics.map((m, i) => (
            <div
              key={m.label}
              className={`p-5 ${i % 2 === 1 ? 'border-l border-stone-200' : ''} ${i >= 2 ? 'border-t border-stone-200' : ''} lg:border-t-0 lg:border-l ${i === 0 ? 'lg:border-l-0' : ''}`}
              style={{ borderColor: 'var(--color-stone-200)' }}
            >
              <p className="text-xs text-charcoal-400 mb-2">{m.label}</p>
              <p className="font-display text-2xl font-semibold text-forest-800 tabular-nums leading-none">
                {loading ? '—' : m.value}
              </p>
              <p className="text-xs text-charcoal-400 mt-2 leading-snug">{m.hint}</p>
            </div>
          ))}
        </section>

        {/* Ops snapshot + revenue split */}
        <section className="mb-10 grid md:grid-cols-3 gap-4">
          <button
            type="button"
            onClick={() => router.push('/admin/rooms/dashboard')}
            className="text-left p-5 rounded-xl bg-cream-100 border border-stone-200 hover:border-forest-800/30 active:scale-[0.99] transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-forest-800">จองห้องพัก</p>
              <ArrowRight size={16} className="text-charcoal-400 group-hover:text-forest-800 transition-colors" />
            </div>
            <p className="font-display text-3xl font-semibold text-forest-800 tabular-nums">
              {loading ? '—' : roomBookings.length}
            </p>
            <p className="text-xs text-charcoal-400 mt-2">
              รอจ่าย {roomPending} · รอตรวจสลิป {roomBookings.filter((b) => b.status === 'paid').length}
            </p>
          </button>

          <button
            type="button"
            onClick={() => router.push('/admin/boats/dashboard')}
            className="text-left p-5 rounded-xl bg-cream-100 border border-stone-200 hover:border-forest-800/30 active:scale-[0.99] transition-all group"
          >
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-forest-800">จองเรือคายัค</p>
              <ArrowRight size={16} className="text-charcoal-400 group-hover:text-forest-800 transition-colors" />
            </div>
            <p className="font-display text-3xl font-semibold text-forest-800 tabular-nums">
              {loading ? '—' : kayakBookings.length}
            </p>
            <p className="text-xs text-charcoal-400 mt-2">
              รอดำเนินการ {kayakPending} · รอตรวจสลิป {kayakBookings.filter((b) => b.status === 'paid').length}
            </p>
          </button>

          <div className="p-5 rounded-xl bg-cream-100 border border-stone-200">
            <p className="text-sm font-medium text-forest-800 mb-4">สัดส่วนรายได้</p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs text-charcoal-400 mb-1.5">
                  <span>ห้องพัก {roomShare}%</span>
                  <span className="tabular-nums text-forest-800">{formatMoney(totalRoomRevenue)}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-stone-200)' }}>
                  <div
                    className="h-full rounded-full bg-forest-800 transition-all duration-300"
                    style={{ width: `${roomShare}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-charcoal-400 mb-1.5">
                  <span>เรือคายัค {kayakShare}%</span>
                  <span className="tabular-nums text-forest-800">{formatMoney(totalKayakRevenue)}</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-stone-200)' }}>
                  <div
                    className="h-full rounded-full bg-lagoon-500 transition-all duration-300"
                    style={{ width: `${kayakShare}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Grouped management nav */}
        <section className="mb-10">
          <h2 className="font-display text-xl font-semibold text-forest-800 mb-5">เมนูจัดการ</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {menuGroups.map((group) => (
              <div key={group.title} className="rounded-xl bg-cream-100 border border-stone-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-stone-200">
                  <p className="text-xs font-medium text-charcoal-400 tracking-wide">{group.title}</p>
                </div>
                <ul className="divide-y" style={{ borderColor: 'var(--color-stone-200)' }}>
                  {group.items.map((item) => (
                    <li key={item.path}>
                      <button
                        type="button"
                        onClick={() => router.push(item.path)}
                        className="w-full flex items-center gap-3 px-5 py-3.5 text-left hover:bg-stone-100/80 active:bg-stone-200/50 transition-colors"
                      >
                        <span className="text-forest-800 flex-shrink-0">{item.icon}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium text-forest-800">{item.label}</span>
                          <span className="block text-xs text-charcoal-400 mt-0.5">{item.desc}</span>
                        </span>
                        <ArrowRight size={14} className="text-stone-300 flex-shrink-0" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* Bookings table */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="font-display text-xl font-semibold text-forest-800">รายการจอง</h2>
            <div className="flex gap-1 p-1 rounded-lg bg-cream-100 border border-stone-200 w-fit">
              {([
                { key: 'bookings' as const, label: `ห้องพัก (${roomBookings.length})` },
                { key: 'kayaks' as const, label: `เรือ (${kayakBookings.length})` },
              ]).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    tab === t.key
                      ? 'bg-forest-800 text-cream-100'
                      : 'text-charcoal-400 hover:text-forest-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="space-y-2 rounded-xl border border-stone-200 bg-cream-100 p-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--color-stone-200)' }} />
              ))}
            </div>
          ) : tab === 'bookings' ? (
            <div className="rounded-xl border border-stone-200 bg-cream-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left">
                      {['#', 'ลูกค้า', 'ห้อง', 'เช็คอิน', 'เช็คเอาต์', 'ราคา', 'สถานะ', 'ผู้ยืนยัน', 'สลิป'].map((h) => (
                        <th key={h} className="px-4 py-3 text-xs font-medium text-charcoal-400 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {roomBookings.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-16 text-center text-charcoal-400">
                          ยังไม่มีรายการจองห้องพัก
                        </td>
                      </tr>
                    ) : (
                      roomBookings.map((b) => (
                        <tr
                          key={b.id || b.room_booking_id}
                          className="border-b border-stone-200/70 last:border-0 hover:bg-stone-100/50 transition-colors"
                        >
                          <td className="px-4 py-3 text-charcoal-400 tabular-nums">#{b.id || b.room_booking_id}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-forest-800">{b.user_name || '-'}</p>
                            <p className="text-xs text-charcoal-400">{b.user_email || ''}</p>
                          </td>
                          <td className="px-4 py-3 text-charcoal">{b.room_name || b.type_name || '-'}</td>
                          <td className="px-4 py-3 text-charcoal-400 whitespace-nowrap">
                            {formatDate(b.check_in_date || b.check_in)}
                          </td>
                          <td className="px-4 py-3 text-charcoal-400 whitespace-nowrap">
                            {formatDate(b.check_out_date || b.check_out)}
                          </td>
                          <td className="px-4 py-3 font-medium text-forest-800 tabular-nums whitespace-nowrap">
                            {formatMoney(b.total_price)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusClass[b.status] || 'bg-stone-100 text-charcoal-400'}`}>
                              {statusLabel[b.status] || b.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-charcoal">
                            {b.approved_by_name || <span className="text-stone-300">-</span>}
                          </td>
                          <td className="px-4 py-3">
                            {b.payment_slip ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSlipModal({
                                    open: true,
                                    url: resolveMediaUrl(b.payment_slip),
                                    name: b.user_name || 'slip',
                                  })
                                }
                                className="text-xs font-medium text-forest-800 underline underline-offset-2 hover:text-lagoon-600"
                              >
                                ดูสลิป
                              </button>
                            ) : (
                              <span className="text-xs text-stone-300">ไม่มี</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-stone-200 bg-cream-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-stone-200 text-left">
                      {['#', 'ลูกค้า', 'เรือ', 'วันที่', 'เวลา', 'ราคา', 'สถานะ', 'ผู้ยืนยัน', 'สลิป'].map((h) => (
                        <th key={h} className="px-4 py-3 text-xs font-medium text-charcoal-400 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {kayakBookings.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-4 py-16 text-center text-charcoal-400">
                          ยังไม่มีรายการจองเรือ
                        </td>
                      </tr>
                    ) : (
                      kayakBookings.map((b) => (
                        <tr
                          key={b.boat_booking_id}
                          className="border-b border-stone-200/70 last:border-0 hover:bg-stone-100/50 transition-colors"
                        >
                          <td className="px-4 py-3 text-charcoal-400 tabular-nums">#{b.boat_booking_id}</td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-forest-800">{b.user_name || '-'}</p>
                            <p className="text-xs text-charcoal-400">{b.user_email || ''}</p>
                          </td>
                          <td className="px-4 py-3 text-charcoal">{b.kayak_name || '-'}</td>
                          <td className="px-4 py-3 text-charcoal-400 whitespace-nowrap">
                            {formatDate(b.booking_date)}
                          </td>
                          <td className="px-4 py-3 text-charcoal-400 whitespace-nowrap tabular-nums">
                            {b.start_time ? `${b.start_time.slice(0, 5)}-${b.end_time?.slice(0, 5) || ''}` : '-'}
                          </td>
                          <td className="px-4 py-3 font-medium text-forest-800 tabular-nums whitespace-nowrap">
                            {formatMoney(b.total_price)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusClass[b.status] || 'bg-stone-100 text-charcoal-400'}`}>
                              {statusLabel[b.status] || b.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-charcoal">
                            {b.approved_by_name || <span className="text-stone-300">-</span>}
                          </td>
                          <td className="px-4 py-3">
                            {b.payment_slip ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setSlipModal({
                                    open: true,
                                    url: resolveMediaUrl(b.payment_slip),
                                    name: b.user_name || 'slip',
                                  })
                                }
                                className="text-xs font-medium text-forest-800 underline underline-offset-2 hover:text-lagoon-600"
                              >
                                ดูสลิป
                              </button>
                            ) : (
                              <span className="text-xs text-stone-300">ไม่มี</span>
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
        </section>
      </div>

      {slipModal.open && (
        <div
          className="fixed inset-0 bg-forest-900/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSlipModal({ open: false, url: '', name: '' })}
        >
          <div
            className="bg-cream-100 rounded-xl max-w-lg w-full overflow-hidden border border-stone-200 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200">
              <h3 className="font-display font-semibold text-forest-800">
                สลิป - {slipModal.name}
              </h3>
              <button
                type="button"
                onClick={() => setSlipModal({ open: false, url: '', name: '' })}
                className="p-1.5 rounded-lg text-charcoal-400 hover:bg-stone-100 hover:text-forest-800 transition-colors"
                aria-label="ปิด"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slipModal.url}
                alt="payment slip"
                className="w-full rounded-lg object-contain max-h-[70vh]"
                referrerPolicy="no-referrer"
                crossOrigin="anonymous"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
