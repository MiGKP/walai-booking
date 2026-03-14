'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, BarChart3, TrendingUp, Anchor, Users, CalendarDays } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

const MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

export default function StatsPage() {
  const { ready, user } = useAuthGuard({ allowedRoles: ['admin', 'room_staff', 'boat_staff'] });
  const [period, setPeriod] = useState<'day' | 'month'>('month');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const backPath = user?.role === 'admin' ? '/admin' : user?.role === 'room_staff' ? '/staff/rooms/dashboard' : '/staff/boats/dashboard';

  useEffect(() => {
    if (!ready) return;
    fetchStats();
  }, [ready, period]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const params: any = { period };
      if (period === 'day') params.date = date;
      else { params.month = month; params.year = year; }
      const res = await api.get('/settings/stats', { params });
      setData(res.data?.data);
    } catch { toast.error('โหลดสถิติไม่สำเร็จ'); }
    finally { setLoading(false); }
  };

  const roomStats = data?.room_summary || {};
  const kayakStats = data?.kayak_summary || {};
  const roomRevenue = Number(roomStats.revenue || 0);
  const kayakRevenue = Number(kayakStats.revenue || 0);
  const totalRevenue = roomRevenue + kayakRevenue;

  // chart data for monthly view — day is already 'YYYY-MM-DD' string from TO_CHAR
  const roomChart: any[] = data?.room_chart || [];
  const kayakChart: any[] = data?.kayak_chart || [];
  const allDays = Array.from(new Set([...roomChart.map((r: any) => String(r.day)), ...kayakChart.map((r: any) => String(r.day))])).sort();
  const maxRevenue = Math.max(...allDays.map(day => {
    const r = roomChart.find((r: any) => String(r.day) === day);
    const k = kayakChart.find((k: any) => String(k.day) === day);
    return Number(r?.revenue || 0) + Number(k?.revenue || 0);
  }), 1);

  if (!ready) return null;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href={backPath} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">รายงานสถิติ</h1>
            <p className="text-gray-500 mt-0.5">ภาพรวมรายได้และจำนวนการจอง</p>
          </div>
        </div>

        {/* Period Selector */}
        <div className="card p-5 mb-6 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ช่วงเวลา</label>
            <div className="flex gap-2">
              <button
                onClick={() => setPeriod('day')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${period === 'day' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                รายวัน
              </button>
              <button
                onClick={() => setPeriod('month')}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${period === 'month' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                รายเดือน
              </button>
            </div>
          </div>

          {period === 'day' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
              <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เดือน</label>
                <select className="input-field" value={month} onChange={e => setMonth(e.target.value)}>
                  {MONTHS.map((m, i) => (
                    <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ปี</label>
                <select className="input-field" value={year} onChange={e => setYear(e.target.value)}>
                  {[2024, 2025, 2026, 2027].map(y => (
                    <option key={y} value={y}>{y + 543}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <button onClick={fetchStats} className="btn-primary px-6">ดูรายงาน</button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => <div key={i} className="card h-24 animate-pulse bg-gray-100" />)}
          </div>
        ) : data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="card p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-teal-100 flex items-center justify-center">
                    <TrendingUp size={18} className="text-teal-600" />
                  </div>
                  <p className="text-xs text-gray-500">รายได้รวม</p>
                </div>
                <p className="text-2xl font-bold text-teal-600">฿{totalRevenue.toLocaleString()}</p>
              </div>
              <div className="card p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center">
                    <CalendarDays size={18} className="text-blue-600" />
                  </div>
                  <p className="text-xs text-gray-500">จองห้องพัก (อนุมัติ)</p>
                </div>
                <p className="text-2xl font-bold text-blue-600">{roomStats.approved_count || 0}</p>
                <p className="text-xs text-gray-400 mt-1">รอ {roomStats.pending_count || 0} | ยกเลิก {roomStats.cancelled_count || 0}</p>
              </div>
              <div className="card p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center">
                    <Anchor size={18} className="text-cyan-600" />
                  </div>
                  <p className="text-xs text-gray-500">จองเรือ (อนุมัติ)</p>
                </div>
                <p className="text-2xl font-bold text-cyan-600">{kayakStats.approved_count || 0}</p>
                <p className="text-xs text-gray-400 mt-1">รอ {kayakStats.pending_count || 0} | ยกเลิก {kayakStats.cancelled_count || 0}</p>
              </div>
              <div className="card p-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <Users size={18} className="text-indigo-600" />
                  </div>
                  <p className="text-xs text-gray-500">สมาชิกทั้งหมด</p>
                </div>
                <p className="text-2xl font-bold text-indigo-600">{data.total_members || 0}</p>
              </div>
            </div>

            {/* Revenue Split */}
            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-1">ห้องพัก</h3>
                <p className="text-3xl font-bold text-teal-600 mb-3">฿{roomRevenue.toLocaleString()}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">อนุมัติแล้ว</span><span className="font-medium text-green-600">{roomStats.approved_count || 0}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">รอดำเนินการ</span><span className="font-medium text-orange-500">{roomStats.pending_count || 0}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">ยกเลิก</span><span className="font-medium text-red-400">{roomStats.cancelled_count || 0}</span></div>
                </div>
              </div>
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-1">เรือคายัค</h3>
                <p className="text-3xl font-bold text-cyan-600 mb-3">฿{kayakRevenue.toLocaleString()}</p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">อนุมัติแล้ว</span><span className="font-medium text-green-600">{kayakStats.approved_count || 0}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">รอดำเนินการ</span><span className="font-medium text-orange-500">{kayakStats.pending_count || 0}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">ยกเลิก</span><span className="font-medium text-red-400">{kayakStats.cancelled_count || 0}</span></div>
                </div>
              </div>
            </div>

            {/* Monthly Chart */}
            {period === 'month' && allDays.length > 0 && (
              <div className="card p-5">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 size={18} className="text-teal-600" /> กราฟรายได้รายวัน (เดือน {MONTHS[Number(month) - 1]} {Number(year) + 543})
                </h3>
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-1 min-w-max h-40 pb-6 border-b border-gray-100">
                    {allDays.map(day => {
                      const dayStr = String(day);
                      const r = roomChart.find((x: any) => String(x.day) === dayStr);
                      const k = kayakChart.find((x: any) => String(x.day) === dayStr);
                      const rv = Number(r?.revenue || 0);
                      const kv = Number(k?.revenue || 0);
                      const total = rv + kv;
                      const barH = Math.round((total / maxRevenue) * 120);
                      const rH = total > 0 ? Math.round((rv / total) * barH) : 0;
                      const kH = barH - rH;
                      const dayNum = dayStr.slice(-2).replace(/^0/, '');
                      return (
                        <div key={dayStr} className="flex flex-col items-center gap-0.5 w-7 group relative">
                          <div className="absolute bottom-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                            {dayNum} — ฿{total.toLocaleString()}
                          </div>
                          <div className="flex flex-col-reverse w-5">
                            {kH > 0 && <div className="bg-cyan-400 rounded-t-sm w-full" style={{ height: kH }} />}
                            {rH > 0 && <div className="bg-teal-500 w-full" style={{ height: rH }} />}
                          </div>
                          <span className="text-xs text-gray-400">{dayNum}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-4 mt-3 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-teal-500 inline-block" /> ห้องพัก</div>
                  <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-cyan-400 inline-block" /> เรือ</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
