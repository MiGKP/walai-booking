"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Sailboat,
  TrendingUp,
  Users,
  Clock,
  RefreshCw,
  UserCheck,
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
  const [staffList, setStaffList] = useState<any[]>([]);
  const [membersList, setMembersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [timeframe, setTimeframe] = useState<Timeframe>("month");

  useEffect(() => {
    if (!ready) return;
    fetchAll();
  }, [ready]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [rb, kb, st, mb] = await Promise.all([
        api.get("/bookings").catch(() => ({ data: { data: [] } })),
        api.get("/kayaks/bookings/all").catch(() => ({ data: { data: [] } })),
        api.get("/auth/staff").catch(() => ({ data: { data: [] } })),
        api.get("/members").catch(() => ({ data: { data: [] } })),
      ]);
      setRoomBookings(rb.data?.data || []);
      setKayakBookings(kb.data?.data || []);
      setStaffList(st.data?.data || []);
      
      const rawMembers = mb.data;
      const parsedMembers = Array.isArray(rawMembers)
        ? rawMembers
        : rawMembers?.data || rawMembers?.members || [];
      setMembersList(parsedMembers);
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
          <p className="text-sm font-medium">กำลังโหลดข้อมูลภาพรวมของระบบ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10 font-sans">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center pb-4 border-b border-stone-200/80">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-forest-800 tracking-tight flex items-center gap-2">
            <TrendingUp size={28} className="text-forest-800" />
            ภาพรวมระบบ
          </h1>
          <p className="mt-1 text-xs md:text-sm text-charcoal-400">
            ยอดขาย สถิติการเข้าพัก และข้อมูลทรัพยากรบุคลากร
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            className="rounded-xl border border-stone-200 bg-white p-2.5 text-forest-800 font-semibold text-xs shadow-sm transition-colors hover:bg-stone-50 flex items-center gap-2"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={16} /> รีเฟรช
          </button>
        </div>
      </header>

      {/* Tier 1: Executive KPIs (Revenue, Members, Staff) */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Revenue Card (Takes up more space) */}
        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-sm lg:col-span-6 flex flex-col justify-between">
          <div className="mb-6 flex flex-col justify-between gap-4 2xl:flex-row 2xl:items-center">
            <div className="flex items-center gap-2 text-forest-800">
              <TrendingUp size={20} className="stroke-[2.5px]" />
              <h2 className="font-display text-xl font-bold tracking-tight">ยอดขายที่อนุมัติแล้ว</h2>
            </div>
            
            {/* Segmented Control for Timeframe */}
            <div className="flex w-full overflow-x-auto rounded-xl bg-stone-100/80 p-1 2xl:w-auto">
              <div className="flex min-w-max w-full">
                {[
                  { id: "today", label: "วันนี้" },
                  { id: "month", label: "เดือนนี้" },
                  { id: "year", label: "ปีนี้" },
                  { id: "all", label: "ทั้งหมด" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTimeframe(tab.id as Timeframe)}
                    className={`flex-1 rounded-lg px-3 py-1.5 sm:px-4 sm:py-2 text-[11px] sm:text-xs font-bold transition-all ${
                      timeframe === tab.id
                        ? "bg-white text-forest-800 shadow-sm"
                        : "text-charcoal-500 hover:bg-stone-200/50 hover:text-forest-700"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-6 font-display text-3xl sm:text-4xl font-bold text-forest-800 break-words">{formatMoney(totalRevenue)}</h3>
            <div className="space-y-4">
              <p className="text-xs font-bold text-charcoal-500">สัดส่วนรายได้</p>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-stone-100">
                <div style={{ width: `${roomShare}%` }} className="bg-forest-500 transition-all duration-500"></div>
                <div style={{ width: `${kayakShare}%` }} className="bg-lagoon-500 transition-all duration-500"></div>
              </div>
              <div className="flex justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-forest-500"></div>
                  <span className="font-medium text-charcoal-600">ห้องพัก ({roomShare}%)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-lagoon-500"></div>
                  <span className="font-medium text-charcoal-600">คายัค ({kayakShare}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Resources Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 lg:grid-rows-2 gap-6 lg:col-span-6">
          {/* Members */}
          <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl bg-amber-50 p-5 sm:p-6 text-amber-900 border border-amber-100 shadow-sm">
            <div className="absolute -right-4 -top-4 text-amber-200/50">
              <Users size={100} />
            </div>
            <div className="relative z-10">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-amber-700/80">ฐานลูกค้า</p>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl sm:text-4xl font-bold">{membersList.length}</span>
                <span className="text-xs sm:text-sm text-amber-700">บัญชี</span>
              </div>
            </div>
          </div>
          
          {/* Staff */}
          <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl bg-stone-50 p-5 sm:p-6 text-charcoal-900 border border-stone-200 shadow-sm">
            <div className="absolute -bottom-4 -right-4 text-stone-200/60">
              <UserCheck size={90} />
            </div>
            <div className="relative z-10">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-charcoal-500">พนักงาน</p>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="font-display text-3xl sm:text-4xl font-bold">{staffList.length}</span>
                <span className="text-xs sm:text-sm text-charcoal-500">คน</span>
              </div>
              
              <div className="flex flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-medium">
                <span className="rounded-md bg-forest-100 px-2 py-1 text-forest-800">
                  ห้องพัก: {staffList.filter((s) => s.role === "room_staff").length}
                </span>
                <span className="rounded-md bg-lagoon-100 px-2 py-1 text-lagoon-800">
                  คายัค: {staffList.filter((s) => s.role === "boat_staff").length}
                </span>
                <span className="rounded-md bg-stone-200 px-2 py-1 text-charcoal-700">
                  แอดมิน: {staffList.filter((s) => s.role === "admin").length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tier 2: Live Today & Bookings Performance */}
      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Live Today */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:col-span-5">
          <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl bg-forest-900 p-5 sm:p-6 text-white shadow-sm">
            <div className="absolute -right-4 -top-4 text-forest-800/50">
              <Home size={100} />
            </div>
            <div className="relative z-10">
              <p className="mb-1 text-xs font-medium text-forest-200">ห้องพักที่เช็คอินวันนี้</p>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl sm:text-4xl font-bold">{todayRoomBookings}</span>
                <span className="text-xs sm:text-sm text-forest-200">ห้อง</span>
              </div>
            </div>
          </div>
          <div className="relative flex flex-col justify-center overflow-hidden rounded-2xl bg-lagoon-900 p-5 sm:p-6 text-white shadow-sm">
            <div className="absolute -bottom-2 -right-2 text-lagoon-800/50">
              <Sailboat size={90} />
            </div>
            <div className="relative z-10">
              <p className="mb-1 text-xs font-medium text-lagoon-200">คิวเรือคายัควันนี้</p>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-3xl sm:text-4xl font-bold">{todayKayakBookings}</span>
                <span className="text-xs sm:text-sm text-lagoon-200">คิว</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bookings Status Breakdown */}
        <div className="rounded-2xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-sm lg:col-span-7">
          <h2 className="mb-4 font-display text-lg sm:text-xl font-bold tracking-tight text-forest-800">
            สถานะการจองตามช่วงเวลา
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-stone-200/80 bg-stone-50 p-4">
              <h4 className="mb-3 flex items-center gap-1.5 text-[11px] font-bold text-charcoal-500">
                <Home size={14} /> สรุปห้องพัก
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-charcoal-600">อนุมัติแล้ว</span> <span className="font-bold text-forest-700">{roomApproved}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-charcoal-600">รอยืนยันสลิป</span> <span className="font-bold text-bamboo-600">{roomPending}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-charcoal-600">ยกเลิก/ปฏิเสธ</span> <span className="font-bold text-charcoal-400">{roomCancelled}</span>
                </div>
              </div>
            </div>
            
            <div className="rounded-xl border border-stone-200/80 bg-stone-50 p-4">
              <h4 className="mb-3 flex items-center gap-1.5 text-[11px] font-bold text-charcoal-500">
                <Sailboat size={14} /> สรุปคายัค
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-charcoal-600">อนุมัติแล้ว</span> <span className="font-bold text-forest-700">{kayakApproved}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-charcoal-600">รอยืนยันสลิป</span> <span className="font-bold text-bamboo-600">{kayakPending}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-charcoal-600">ยกเลิก/ปฏิเสธ</span> <span className="font-bold text-charcoal-400">{kayakCancelled}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tier 3: Action Required (Pending) */}
      <section className="rounded-2xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-sm">
        <div className="mb-5 flex items-center gap-2 text-bamboo-700">
          <Clock size={20} className="stroke-[2.5px]" />
          <h2 className="font-display text-lg sm:text-xl font-bold tracking-tight">รอตรวจสอบการชำระเงิน</h2>
        </div>
        
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Rooms Pending */}
          <div className="flex flex-col justify-between rounded-xl border border-bamboo-100 bg-bamboo-50/50 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-bold text-bamboo-800">
                  <Home size={16} /> ห้องพัก
                </div>
                <span className="rounded-full bg-bamboo-600 px-2 py-0.5 text-xs font-bold text-white">
                  {pendingRoomsList.length}
                </span>
              </div>
              {pendingRoomsList.length === 0 ? (
                <p className="py-4 text-center text-xs text-bamboo-600/70">ไม่มีรายการค้างตรวจสอบ</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {pendingRoomsList.slice(0, 3).map((item, index) => (
                    <div key={item.id || index} className="flex justify-between rounded-lg border border-bamboo-100/50 bg-white p-2 text-xs">
                      <span className="mr-2 truncate font-semibold text-charcoal-700">
                         #{item.id || '?'} {item.customer_name || item.user?.name}
                      </span>
                      <span className="shrink-0 font-bold text-bamboo-700">{formatMoney(item.total_price)}</span>
                    </div>
                  ))}
                  {pendingRoomsList.length > 3 && (
                    <p className="pt-1 text-center text-xs font-medium text-bamboo-600">
                      + อีก {pendingRoomsList.length - 3} รายการ
                    </p>
                  )}
                </div>
              )}
            </div>
            <button 
              onClick={() => router.push('/admin/rooms')}
              className="mt-4 w-full rounded-lg border border-bamboo-200 bg-white py-2 text-xs font-bold text-bamboo-700 transition-colors hover:bg-bamboo-50"
            >
              ตรวจสอบสลิปห้องพัก
            </button>
          </div>

          {/* Kayaks Pending */}
          <div className="flex flex-col justify-between rounded-xl border border-lagoon-100 bg-lagoon-50/50 p-4">
            <div>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sm font-bold text-lagoon-800">
                  <Sailboat size={16} /> เรือคายัค
                </div>
                <span className="rounded-full bg-lagoon-600 px-2 py-0.5 text-xs font-bold text-white">
                  {pendingKayaksList.length}
                </span>
              </div>
              {pendingKayaksList.length === 0 ? (
                <p className="py-4 text-center text-xs text-lagoon-600/70">ไม่มีรายการค้างตรวจสอบ</p>
              ) : (
                <div className="mt-3 space-y-2">
                  {pendingKayaksList.slice(0, 3).map((item, index) => (
                    <div key={item.id || index} className="flex justify-between rounded-lg border border-lagoon-100/50 bg-white p-2 text-xs">
                      <span className="mr-2 truncate font-semibold text-charcoal-700">
                         #{item.id || '?'} {item.customer_name || item.user?.name}
                      </span>
                      <span className="shrink-0 font-bold text-lagoon-700">{formatMoney(item.total_price)}</span>
                    </div>
                  ))}
                  {pendingKayaksList.length > 3 && (
                    <p className="pt-1 text-center text-xs font-medium text-lagoon-600">
                      + อีก {pendingKayaksList.length - 3} รายการ
                    </p>
                  )}
                </div>
              )}
            </div>
            <button 
              onClick={() => router.push('/admin/boats')}
              className="mt-4 w-full rounded-lg border border-lagoon-200 bg-white py-2 text-xs font-bold text-lagoon-700 transition-colors hover:bg-lagoon-50"
            >
              ตรวจสอบสลิปเรือคายัค
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
