"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Home,
  Sailboat,
  TrendingUp,
  Users,
  CalendarCheck,
  BarChart3,
  Wallet,
  Tag,
  Clock,
  Calendar as CalendarIcon,
  RefreshCw,
  Phone,
  ChevronRight,
  UserCheck,
  ChevronDown,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast from "react-hot-toast";

const REVENUE_STATUSES = new Set(["approved", "checked_out"]);
const PENDING_STATUSES = new Set(["pending", "wait_for_payment", "paid"]);

type Timeframe = "today" | "month" | "year" | "all";

function formatMoney(value: number): string {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

export default function AdminPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ allowedRoles: ["admin"] });

  const [roomBookings, setRoomBookings] = useState<any[]>([]);
  const [kayakBookings, setKayakBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [timeframe, setTimeframe] = useState<Timeframe>("month");

  useEffect(() => {
    if (!ready) return;
    fetchAll();
  }, [ready]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [rb, kb] = await Promise.all([
        api.get("/bookings").catch(() => ({ data: { data: [] } })),
        api.get("/kayaks/bookings/all").catch(() => ({ data: { data: [] } })),
      ]);
      setRoomBookings(rb.data?.data || []);
      setKayakBookings(kb.data?.data || []);
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลสถิติได้");
    } finally {
      setLoading(false);
    }
  };

  // ----------------------- Filter Logic -----------------------
  const isDateInTimeframe = (dateStr: string, tf: Timeframe) => {
    if (tf === "all" || !dateStr) return true;
    const date = new Date(dateStr);
    const now = new Date();

    if (tf === "today") {
      return date.toDateString() === now.toDateString();
    }
    if (tf === "month") {
      return (
        date.getMonth() === now.getMonth() &&
        date.getFullYear() === now.getFullYear()
      );
    }
    if (tf === "year") {
      return date.getFullYear() === now.getFullYear();
    }
    return true;
  };

  const filteredRooms = useMemo(() => {
    return roomBookings.filter((b) =>
      isDateInTimeframe(b.created_at || b.check_in, timeframe),
    );
  }, [roomBookings, timeframe]);

  const filteredKayaks = useMemo(() => {
    return kayakBookings.filter((b) =>
      isDateInTimeframe(b.created_at || b.booking_date, timeframe),
    );
  }, [kayakBookings, timeframe]);

  const pendingRoomsList = useMemo(() => {
    return roomBookings.filter((b) => PENDING_STATUSES.has(b.status));
  }, [roomBookings]);

  const pendingKayaksList = useMemo(() => {
    return kayakBookings.filter((b) => PENDING_STATUSES.has(b.status));
  }, [kayakBookings]);

  // ----------------------- Calculations -----------------------
  const roomRevenue = useMemo(() => {
    return filteredRooms
      .filter((b) => REVENUE_STATUSES.has(b.status))
      .reduce((sum, b) => sum + Number(b.total_price || 0), 0);
  }, [filteredRooms]);

  const kayakRevenue = useMemo(() => {
    return filteredKayaks
      .filter((b) => REVENUE_STATUSES.has(b.status))
      .reduce((sum, b) => sum + Number(b.total_price || 0), 0);
  }, [filteredKayaks]);

  const totalRevenue = roomRevenue + kayakRevenue;

  const todayRoomBookings = useMemo(() => {
    return roomBookings.filter(
      (b) =>
        isDateInTimeframe(b.check_in, "today") &&
        REVENUE_STATUSES.has(b.status),
    ).length;
  }, [roomBookings]);

  const todayKayakBookings = useMemo(() => {
    return kayakBookings.filter(
      (b) =>
        isDateInTimeframe(b.booking_date, "today") &&
        REVENUE_STATUSES.has(b.status),
    ).length;
  }, [kayakBookings]);

  const roomApproved = filteredRooms.filter((b) =>
    REVENUE_STATUSES.has(b.status),
  ).length;
  const roomPending = filteredRooms.filter((b) =>
    PENDING_STATUSES.has(b.status),
  ).length;
  const roomCancelled = filteredRooms.filter(
    (b) => b.status === "cancelled" || b.status === "rejected",
  ).length;

  const kayakApproved = filteredKayaks.filter((b) =>
    REVENUE_STATUSES.has(b.status),
  ).length;
  const kayakPending = filteredKayaks.filter((b) =>
    PENDING_STATUSES.has(b.status),
  ).length;
  const kayakCancelled = filteredKayaks.filter(
    (b) => b.status === "cancelled" || b.status === "rejected",
  ).length;

  const roomShare =
    totalRevenue > 0 ? Math.round((roomRevenue / totalRevenue) * 100) : 0;
  const kayakShare = totalRevenue > 0 ? 100 - roomShare : 0;

  if (!ready || loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-forest-800">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <p className="text-sm font-medium">กำลังโหลดข้อมูลภาพรวม...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-10">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-forest-900">
            ภาพรวมระบบ (Overview)
          </h1>
          <p className="text-sm text-charcoal-400 mt-1">
            ยินดีต้อนรับกลับมา ควบคุมและดูสถิติทั้งหมดได้ที่นี่
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="p-2.5 rounded-xl bg-white border border-stone-200 text-charcoal-500 hover:text-forest-800 hover:border-forest-800/30 transition-colors shadow-sm"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      {/* Tier 1: Action Required & Live Today */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Pending Actions (bamboo theme) */}
        <div className="lg:col-span-8 bg-white border border-stone-100 shadow-sm rounded-2xl p-6 flex flex-col">
          <div className="flex items-center gap-2 text-bamboo-700 mb-5">
            <Clock size={20} className="stroke-[2.5px]" />
            <h2 className="text-lg font-bold font-display">รอตรวจสอบการชำระเงิน</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
            {/* Rooms Pending */}
            <div className="bg-bamboo-50/50 rounded-xl p-4 border border-bamboo-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-bamboo-800 font-bold text-sm">
                    <Home size={16} /> ห้องพัก
                  </div>
                  <span className="bg-bamboo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingRoomsList.length}
                  </span>
                </div>
                {pendingRoomsList.length === 0 ? (
                  <p className="text-xs text-bamboo-600/70 py-4 text-center">ไม่มีรายการค้างตรวจสอบ</p>
                ) : (
                  <div className="space-y-2 mt-3">
                    {pendingRoomsList.slice(0, 3).map((item, index) => (
                      <div key={item.id || index} className="text-xs bg-white p-2 rounded-lg border border-bamboo-100/50 flex justify-between">
                        <span className="font-semibold text-charcoal-700 truncate mr-2">
                           #{item.id || '?'} {item.customer_name || item.user?.name}
                        </span>
                        <span className="text-bamboo-700 font-bold shrink-0">{formatMoney(item.total_price)}</span>
                      </div>
                    ))}
                    {pendingRoomsList.length > 3 && (
                      <p className="text-xs text-center text-bamboo-600 font-medium pt-1">
                        + อีก {pendingRoomsList.length - 3} รายการ
                      </p>
                    )}
                  </div>
                )}
              </div>
              <button 
                onClick={() => router.push('/admin/rooms')}
                className="mt-4 w-full py-2 bg-white border border-bamboo-200 text-bamboo-700 text-xs font-bold rounded-lg hover:bg-bamboo-50 transition-colors"
              >
                ตรวจสอบสลิปห้องพัก
              </button>
            </div>

            {/* Kayaks Pending */}
            <div className="bg-lagoon-50/50 rounded-xl p-4 border border-lagoon-100 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 text-lagoon-800 font-bold text-sm">
                    <Sailboat size={16} /> เรือคายัค
                  </div>
                  <span className="bg-lagoon-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingKayaksList.length}
                  </span>
                </div>
                {pendingKayaksList.length === 0 ? (
                  <p className="text-xs text-lagoon-600/70 py-4 text-center">ไม่มีรายการค้างตรวจสอบ</p>
                ) : (
                  <div className="space-y-2 mt-3">
                    {pendingKayaksList.slice(0, 3).map((item, index) => (
                      <div key={item.id || index} className="text-xs bg-white p-2 rounded-lg border border-lagoon-100/50 flex justify-between">
                        <span className="font-semibold text-charcoal-700 truncate mr-2">
                           #{item.id || '?'} {item.customer_name || item.user?.name}
                        </span>
                        <span className="text-lagoon-700 font-bold shrink-0">{formatMoney(item.total_price)}</span>
                      </div>
                    ))}
                    {pendingKayaksList.length > 3 && (
                      <p className="text-xs text-center text-lagoon-600 font-medium pt-1">
                        + อีก {pendingKayaksList.length - 3} รายการ
                      </p>
                    )}
                  </div>
                )}
              </div>
              <button 
                onClick={() => router.push('/admin/boats')}
                className="mt-4 w-full py-2 bg-white border border-lagoon-200 text-lagoon-700 text-xs font-bold rounded-lg hover:bg-lagoon-50 transition-colors"
              >
                ตรวจสอบสลิปเรือคายัค
              </button>
            </div>
          </div>
        </div>

        {/* Right: Live Today */}
        <div className="lg:col-span-4 grid grid-rows-2 gap-6">
          <div className="bg-forest-900 text-white rounded-2xl p-6 relative overflow-hidden shadow-sm flex flex-col justify-center">
            <div className="absolute -right-4 -top-4 text-forest-800/50">
              <Home size={100} />
            </div>
            <div className="relative z-10">
              <p className="text-forest-200 text-xs font-medium mb-1">ห้องพักที่เข้าเช็คอินวันนี้</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-display font-bold">{todayRoomBookings}</span>
                <span className="text-sm text-forest-200">รายการ</span>
              </div>
            </div>
          </div>
          <div className="bg-lagoon-900 text-white rounded-2xl p-6 relative overflow-hidden shadow-sm flex flex-col justify-center">
            <div className="absolute -right-2 -bottom-2 text-lagoon-800/50">
              <Sailboat size={90} />
            </div>
            <div className="relative z-10">
              <p className="text-lagoon-200 text-xs font-medium mb-1">รอบพายเรือคายัควันนี้</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-display font-bold">{todayKayakBookings}</span>
                <span className="text-sm text-lagoon-200">รายการ</span>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* Tier 2 & 3: Financial & Stats */}
      <section className="bg-white border border-stone-100 shadow-sm rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2 text-forest-900">
            <TrendingUp size={20} className="stroke-[2.5px]" />
            <h2 className="text-lg font-bold font-display">สรุปรายได้และสถิติ</h2>
          </div>
          <div className="relative inline-flex">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value as Timeframe)}
              className="appearance-none bg-stone-50 border border-stone-200 text-charcoal-700 text-xs font-bold rounded-xl py-2 pl-4 pr-10 focus:outline-none focus:border-forest-500 cursor-pointer"
            >
              <option value="today">วันนี้</option>
              <option value="month">เดือนนี้</option>
              <option value="year">ปีนี้</option>
              <option value="all">ทั้งหมด</option>
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none" />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Revenue */}
          <div>
            <p className="text-xs font-bold text-charcoal-400 uppercase tracking-wider mb-2">รายรับที่อนุมัติแล้ว</p>
            <h3 className="text-4xl font-display font-bold text-forest-800 mb-6">{formatMoney(totalRevenue)}</h3>
            
            <div className="space-y-4">
              <p className="text-xs font-bold text-charcoal-500 mb-2">สัดส่วนรายได้</p>
              
              {/* Progress Bar */}
              <div className="h-3 w-full bg-stone-100 rounded-full overflow-hidden flex">
                <div style={{ width: `${roomShare}%` }} className="bg-forest-500 transition-all duration-500"></div>
                <div style={{ width: `${kayakShare}%` }} className="bg-lagoon-500 transition-all duration-500"></div>
              </div>
              
              <div className="flex justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-forest-500"></div>
                  <span className="text-charcoal-600 font-medium">ห้องพัก ({roomShare}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-lagoon-500"></div>
                  <span className="text-charcoal-600 font-medium">คายัค ({kayakShare}%)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
              <h4 className="text-xs font-bold text-charcoal-500 flex items-center gap-1.5 mb-3">
                <Home size={14} /> สถานะห้องพัก
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-charcoal-600">อนุมัติแล้ว</span> <span className="font-bold text-forest-700">{roomApproved}</span></div>
                <div className="flex justify-between"><span className="text-charcoal-600">รอยืนยัน</span> <span className="font-bold text-bamboo-600">{roomPending}</span></div>
                <div className="flex justify-between"><span className="text-charcoal-600">ยกเลิก</span> <span className="font-bold text-charcoal-400">{roomCancelled}</span></div>
              </div>
            </div>
            
            <div className="bg-stone-50 rounded-xl p-4 border border-stone-100">
              <h4 className="text-xs font-bold text-charcoal-500 flex items-center gap-1.5 mb-3">
                <Sailboat size={14} /> สถานะคายัค
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-charcoal-600">อนุมัติแล้ว</span> <span className="font-bold text-forest-700">{kayakApproved}</span></div>
                <div className="flex justify-between"><span className="text-charcoal-600">รอยืนยัน</span> <span className="font-bold text-bamboo-600">{kayakPending}</span></div>
                <div className="flex justify-between"><span className="text-charcoal-600">ยกเลิก</span> <span className="font-bold text-charcoal-400">{kayakCancelled}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tier 4: Quick Links (เมนูลัด) */}
      <section>
        <h2 className="text-lg font-bold font-display text-forest-900 mb-4 flex items-center gap-2">
           เมนูลัด (Quick Links)
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[
            { label: 'ปฏิทิน', icon: CalendarIcon, path: '/admin/calendar', color: 'text-lagoon-600', bg: 'bg-lagoon-50' },
            { label: 'จัดการสมาชิก', icon: Users, path: '/admin/members', color: 'text-forest-600', bg: 'bg-forest-50' },
            { label: 'โปรโมชั่น', icon: Tag, path: '/admin/promotions', color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'พนักงาน', icon: UserCheck, path: '/admin/staff', color: 'text-charcoal-600', bg: 'bg-stone-100' },
            { label: 'สถิติแบบละเอียด', icon: BarChart3, path: '/admin/stats', color: 'text-sky-600', bg: 'bg-sky-50' }
          ].map((item, idx) => (
            <button
              key={idx}
              onClick={() => router.push(item.path)}
              className="p-4 rounded-2xl bg-white border border-stone-100 shadow-sm hover:shadow-md hover:border-forest-200 transition-all flex flex-col items-center justify-center gap-3 group"
            >
              <div className={`p-3 rounded-xl ${item.bg} ${item.color} group-hover:scale-110 transition-transform`}>
                <item.icon size={20} />
              </div>
              <span className="text-xs font-bold text-charcoal-700">{item.label}</span>
            </button>
          ))}
        </div>
      </section>

    </div>
  );
}
