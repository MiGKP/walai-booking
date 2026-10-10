"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Home,
  Sailboat,
  TrendingUp,
  Users,
  RefreshCw,
  LayoutDashboard,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  BedDouble,
  Tag,
  Star,
  MessageSquare,
  Building2,
  Calendar,
  CreditCard,
  UserCheck,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { Skeleton } from "@/components/admin/ui";
import {
  toISODate,
  formatThaiTime,
  formatThaiDateShort,
} from "@/lib/date";

const REVENUE_STATUSES = new Set(["approved", "checked_out"]);
const PENDING_STATUSES = new Set(["pending", "wait_for_payment", "paid"]);

type Timeframe = "today" | "month" | "year" | "all";

function formatMoney(value: number): string {
  return `฿${Number(value || 0).toLocaleString("th-TH")}`;
}

const getCleanDate = (dateVal: any): string => {
  if (!dateVal) return "";
  if (typeof dateVal === "string") return dateVal.split("T")[0].split(" ")[0].trim();
  try {
    return toISODate(new Date(dateVal));
  } catch {
    return "";
  }
};

export default function AdminPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ allowedRoles: ["admin"] });

  const [roomBookings, setRoomBookings] = useState<any[]>([]);
  const [kayakBookings, setKayakBookings] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [membersList, setMembersList] = useState<any[]>([]);
  const [singleRooms, setSingleRooms] = useState<any[]>([]);
  const [recentReviews, setRecentReviews] = useState<any[]>([]);
  const [promotionsList, setPromotionsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [timeframe, setTimeframe] = useState<Timeframe>("month");
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    fetchAll();
  }, [ready]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [rb, kb, st, mb, rm, rv, pr] = await Promise.all([
        api.get("/bookings").catch(() => ({ data: { data: [] } })),
        api.get("/kayaks/bookings/all").catch(() => ({ data: { data: [] } })),
        api.get("/auth/staff").catch(() => ({ data: { data: [] } })),
        api.get("/members").catch(() => ({ data: { data: [] } })),
        api.get("/rooms/single/all").catch(() => ({ data: { data: [] } })),
        api.get("/reviews/public?limit=4").catch(() => ({ data: { data: [] } })),
        api.get("/promotions").catch(() => ({ data: { data: [] } })),
      ]);

      setRoomBookings(rb.data?.data || []);
      setKayakBookings(kb.data?.data || []);
      setStaffList(st.data?.data || []);

      const rawMembers = mb.data;
      const parsedMembers = Array.isArray(rawMembers)
        ? rawMembers
        : rawMembers?.data || rawMembers?.members || [];
      setMembersList(parsedMembers);

      setSingleRooms(rm.data?.data || []);
      setRecentReviews(rv.data?.data || []);
      setPromotionsList(pr.data?.data || []);
    } catch {
      notify.error("ไม่สามารถโหลดข้อมูลสถิติได้");
    } finally {
      setLoading(false);
    }
  };

  const todayStr = useMemo(() => toISODate(new Date()), [currentTime]);

  // ----------------------- Filter Logic By Timeframe -----------------------
  const isDateInTimeframe = (dateStr: string, tf: Timeframe) => {
    if (tf === "all" || !dateStr) return true;
    const clean = getCleanDate(dateStr);
    const date = new Date(clean);
    const now = new Date();

    if (tf === "today") {
      return clean === todayStr;
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
      isDateInTimeframe(b.created_at || b.check_in, timeframe)
    );
  }, [roomBookings, timeframe, todayStr]);

  const filteredKayaks = useMemo(() => {
    return kayakBookings.filter((b) =>
      isDateInTimeframe(b.created_at || b.booking_date, timeframe)
    );
  }, [kayakBookings, timeframe, todayStr]);

  // ----------------------- Pending Slip Queues -----------------------
  const pendingRoomsList = useMemo(() => {
    return roomBookings.filter((b) => PENDING_STATUSES.has(b.status));
  }, [roomBookings]);

  const pendingKayaksList = useMemo(() => {
    return kayakBookings.filter((b) => PENDING_STATUSES.has(b.status));
  }, [kayakBookings]);

  // ----------------------- Revenue Calculations -----------------------
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

  // ----------------------- Today's Operations Statistics -----------------------
  const todayRoomArrivals = useMemo(() => {
    return roomBookings.filter(
      (b) =>
        getCleanDate(b.check_in) === todayStr &&
        REVENUE_STATUSES.has(b.status) &&
        !b.checkin_at
    ).length;
  }, [roomBookings, todayStr]);

  const todayRoomInHouse = useMemo(() => {
    return roomBookings.filter((b) => {
      const inDate = getCleanDate(b.check_in);
      const outDate = getCleanDate(b.check_out);
      return (
        REVENUE_STATUSES.has(b.status) &&
        inDate <= todayStr &&
        outDate >= todayStr &&
        b.status !== "checked_out"
      );
    }).length;
  }, [roomBookings, todayStr]);

  const todayRoomDepartures = useMemo(() => {
    return roomBookings.filter(
      (b) =>
        getCleanDate(b.check_out) === todayStr &&
        REVENUE_STATUSES.has(b.status)
    ).length;
  }, [roomBookings, todayStr]);

  const totalRoomsCount = singleRooms.length > 0 ? singleRooms.length : 20;
  const occupancyRate = totalRoomsCount > 0
    ? Math.min(100, Math.round((todayRoomInHouse / totalRoomsCount) * 100))
    : 0;

  // Kayak operations today
  const todayKayakList = useMemo(() => {
    return kayakBookings.filter(
      (b) =>
        getCleanDate(b.booking_date) === todayStr &&
        REVENUE_STATUSES.has(b.status)
    );
  }, [kayakBookings, todayStr]);

  const todayKayakPassengers = useMemo(() => {
    return todayKayakList.reduce((sum, b) => sum + Number(b.num_passengers || 0), 0);
  }, [todayKayakList]);

  // ----------------------- Reviews & Ratings -----------------------
  const avgRating = useMemo(() => {
    if (!recentReviews || recentReviews.length === 0) return 4.9;
    const sum = recentReviews.reduce((acc, r) => acc + Number(r.rating || 5), 0);
    return Math.round((sum / recentReviews.length) * 10) / 10;
  }, [recentReviews]);

  // ----------------------- Status Breakdown -----------------------
  const roomApproved = filteredRooms.filter((b) =>
    REVENUE_STATUSES.has(b.status)
  ).length;
  const roomPending = filteredRooms.filter((b) =>
    PENDING_STATUSES.has(b.status)
  ).length;
  const roomCancelled = filteredRooms.filter(
    (b) => b.status === "cancelled" || b.status === "rejected"
  ).length;

  const kayakApproved = filteredKayaks.filter((b) =>
    REVENUE_STATUSES.has(b.status)
  ).length;
  const kayakPending = filteredKayaks.filter((b) =>
    PENDING_STATUSES.has(b.status)
  ).length;
  const kayakCancelled = filteredKayaks.filter(
    (b) => b.status === "cancelled" || b.status === "rejected"
  ).length;

  const roomShare =
    totalRevenue > 0 ? Math.round((roomRevenue / totalRevenue) * 100) : 0;
  const kayakShare = totalRevenue > 0 ? 100 - roomShare : 0;

  const timeframes: { id: Timeframe; label: string }[] = [
    { id: "today", label: "วันนี้" },
    { id: "month", label: "เดือนนี้" },
    { id: "year", label: "ปีนี้" },
    { id: "all", label: "ทั้งหมด" },
  ];

  if (!ready || loading) {
    return (
      <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
        <Skeleton className="h-24 w-full rounded-3xl" />
        <div className="grid grid-cols-2 gap-3.5 sm:gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-72 rounded-3xl" />
          <Skeleton className="h-72 rounded-3xl lg:col-span-2" />
        </div>
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 max-w-[1600px] mx-auto">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP HEADER (Style aligned with /admin/checkin - No subtitle)
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="w-10 h-10 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-800/10">
              <LayoutDashboard size={20} className="stroke-[2.2]" />
            </span>
            <div>
              <h1 className="font-display text-2xl lg:text-3xl font-bold text-forest-900 tracking-tight">
                ภาพรวมระบบ
              </h1>
            </div>
          </div>

          {/* Right Controls: Live Clock, Timeframe Pill, Refresh Button */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Live Clock with soft pulsating indicator */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-cream-100/90 border border-cream-300/80 shadow-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-emerald-400" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <div className="text-xs">
                <span className="font-mono font-bold text-charcoal-800">
                  {currentTime ? formatThaiTime(currentTime) : "--:--"}
                </span>
                <span className="text-charcoal-500 ml-1.5 hidden sm:inline text-[11px]">
                  (เวลาไทย)
                </span>
              </div>
            </div>

            {/* Timeframe selector pill */}
            <div className="bg-cream-100/90 p-1 rounded-2xl flex items-center gap-1 border border-cream-300/80 shadow-xs">
              {timeframes.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTimeframe(tab.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 ${
                    timeframe === tab.id
                      ? "bg-forest-800 text-white shadow-sm shadow-forest-800/20"
                      : "text-charcoal-600 hover:text-forest-900 hover:bg-cream-200/50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchAll}
              className="px-3.5 py-2 text-charcoal-700 bg-white hover:bg-forest-50/50 hover:border-forest-200 rounded-2xl border border-charcoal-200/80 shadow-xs transition-all text-xs font-semibold flex items-center gap-2 active:scale-95"
              title="รีเฟรชข้อมูลทั้งหมด"
            >
              <RefreshCw
                size={14}
                className={loading ? "animate-spin text-forest-700" : "text-charcoal-500"}
              />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. TOP 4 KPI CARDS (Soft cards, Pridi typography, Soft Badges)
          ───────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Approved Revenue */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-forest-700 uppercase tracking-wider">
                ยอดขายที่อนุมัติแล้ว
              </p>
              <p className="mt-1.5 font-display text-2xl sm:text-3xl font-bold text-forest-950 tracking-tight">
                {formatMoney(totalRevenue)}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-forest-50 text-forest-800 border border-forest-100 flex items-center justify-center shrink-0">
              <TrendingUp size={20} className="stroke-[2.2]" />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-charcoal-500 border-t border-cream-100 pt-2 truncate">
            ห้องพัก {formatMoney(roomRevenue)} • คายัค {formatMoney(kayakRevenue)}
          </p>
        </div>

        {/* Card 2: Today's Occupancy & Rooms */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-forest-700 uppercase tracking-wider">
                อัตราเข้าพักวันนี้
              </p>
              <p className="mt-1.5 font-display text-2xl sm:text-3xl font-bold text-forest-950 tracking-tight">
                {occupancyRate}%
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">
                  ({todayRoomInHouse}/{totalRoomsCount} ห้อง)
                </span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-forest-50 text-forest-800 border border-forest-100 flex items-center justify-center shrink-0">
              <BedDouble size={20} className="stroke-[2.2]" />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-charcoal-500 border-t border-cream-100 pt-2">
            รอเช็คอิน {todayRoomArrivals} • ออกวันนี้ {todayRoomDepartures}
          </p>
        </div>

        {/* Card 3: Today's Kayak Sessions */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-lagoon-700 uppercase tracking-wider">
                คิวเรือวันนี้
              </p>
              <p className="mt-1.5 font-display text-2xl sm:text-3xl font-bold text-forest-950 tracking-tight">
                {todayKayakList.length}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">
                  คิว
                </span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-lagoon-50 text-lagoon-800 border border-lagoon-100 flex items-center justify-center shrink-0">
              <Sailboat size={20} className="stroke-[2.2]" />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-charcoal-500 border-t border-cream-100 pt-2">
            ผู้โดยสาร {todayKayakPassengers} ท่าน • ยอดอนุมัติแล้ว
          </p>
        </div>

        {/* Card 4: Customer Satisfaction & Members Base */}
        <div className="p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-bamboo-800 uppercase tracking-wider">
                ความพึงพอใจ & ลูกค้า
              </p>
              <p className="mt-1.5 font-display text-2xl sm:text-3xl font-bold text-forest-950 tracking-tight flex items-center gap-1.5">
                <span>{avgRating}</span>
                <Star size={18} className="fill-amber-400 text-amber-400 inline" />
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1 font-sans">
                  ({membersList.length} สมาชิก)
                </span>
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-bamboo-50 text-bamboo-800 border border-bamboo-100 flex items-center justify-center shrink-0">
              <Users size={20} className="stroke-[2.2]" />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-charcoal-500 border-t border-cream-100 pt-2 truncate">
            รีวิวทั้งหมด {recentReviews.length} รายการล่าสุด
          </p>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. URGENT ACTION ITEMS: PENDING SLIPS QUEUE
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
            <h2 className="font-display text-base lg:text-lg font-bold text-forest-900 tracking-tight">
              รายการรอตรวจสอบการชำระเงิน
            </h2>
          </div>
          <span className="text-xs text-charcoal-500">
            ค้างตรวจทั้งหมด {pendingRoomsList.length + pendingKayaksList.length} รายการ
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Room Slips Pending */}
          <div className="flex flex-col justify-between rounded-2xl bg-cream-50/70 border border-cream-200/80 p-5">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-charcoal-800">
                  <Home size={16} className="text-forest-700" />
                  <span>ห้องพัก</span>
                </div>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-bold border bg-amber-50/90 text-amber-900 border-amber-200/80">
                  {pendingRoomsList.length} รายการ
                </span>
              </div>

              {pendingRoomsList.length === 0 ? (
                <div className="py-7 text-center text-charcoal-500 bg-white/70 rounded-xl border border-cream-200/60 text-xs flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={14} className="text-forest-700" />
                  <span>ไม่มีรายการห้องพักค้างตรวจสอบ</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingRoomsList.slice(0, 3).map((item, index) => (
                    <Link href={`/admin/rooms?search=${encodeURIComponent(String(item.room_booking_id || item.id))}`}
                      key={item.room_booking_id || item.id || index}
                      className="flex justify-between items-center rounded-xl bg-white p-3 text-xs border border-cream-200/80 shadow-2xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-charcoal-800 truncate">
                          #{item.room_booking_id || item.id} {item.customer_name || item.user_name || item.guest_name || "ลูกค้า"}
                        </p>
                        <p className="text-[11px] text-charcoal-500">
                          เข้าพัก: {formatThaiDateShort(item.check_in)}
                        </p>
                      </div>
                      <span className="shrink-0 font-bold text-forest-800">
                        {formatMoney(item.total_price)}
                      </span>
                    </Link>
                  ))}
                  {pendingRoomsList.length > 3 && (
                    <p className="pt-1 text-center text-[11px] font-medium text-charcoal-400">
                      + อีก {pendingRoomsList.length - 3} รายการ
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => router.push("/admin/rooms")}
              className="mt-4 w-full rounded-xl bg-white hover:bg-forest-50/70 text-forest-800 border border-forest-200/90 py-2.5 text-xs font-semibold shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span>ตรวจสอบสลิปห้องพัก</span>
              <ArrowUpRight size={13} />
            </button>
          </div>

          {/* Kayak Slips Pending */}
          <div className="flex flex-col justify-between rounded-2xl bg-cream-50/70 border border-cream-200/80 p-5">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-charcoal-800">
                  <Sailboat size={16} className="text-lagoon-700" />
                  <span>เรือ / คายัค</span>
                </div>
                <span className="rounded-full px-2.5 py-0.5 text-xs font-bold border bg-lagoon-50 text-lagoon-800 border-lagoon-200/70">
                  {pendingKayaksList.length} รายการ
                </span>
              </div>

              {pendingKayaksList.length === 0 ? (
                <div className="py-7 text-center text-charcoal-500 bg-white/70 rounded-xl border border-cream-200/60 text-xs flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={14} className="text-forest-700" />
                  <span>ไม่มีรายการเรือค้างตรวจสอบ</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {pendingKayaksList.slice(0, 3).map((item, index) => (
                    <Link href={`/admin/boats?search=${encodeURIComponent(String(item.boat_booking_id || item.id))}`}
                      key={item.boat_booking_id || item.id || index}
                      className="flex justify-between items-center rounded-xl bg-white p-3 text-xs border border-cream-200/80 shadow-2xs"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="font-semibold text-charcoal-800 truncate">
                          #{item.boat_booking_id || item.id} {item.customer_name || item.user_name || "ลูกค้า"}
                        </p>
                        <p className="text-[11px] text-charcoal-500">
                          วันที่: {formatThaiDateShort(item.booking_date)}
                        </p>
                      </div>
                      <span className="shrink-0 font-bold text-lagoon-900">
                        {formatMoney(item.total_price)}
                      </span>
                    </Link>
                  ))}
                  {pendingKayaksList.length > 3 && (
                    <p className="pt-1 text-center text-[11px] font-medium text-charcoal-400">
                      + อีก {pendingKayaksList.length - 3} รายการ
                    </p>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => router.push("/admin/boats")}
              className="mt-4 w-full rounded-xl bg-white hover:bg-forest-50/70 text-forest-800 border border-forest-200/90 py-2.5 text-xs font-semibold shadow-2xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
            >
              <span>ตรวจสอบสลิปเรือ</span>
              <ArrowUpRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. TODAY'S OPERATIONS PULSE (Front Desk & Water Activities)
          ───────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Today's Rooms Pulse */}
        <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-forest-50 text-forest-800 border border-forest-100 flex items-center justify-center">
                  <BedDouble size={16} />
                </span>
                <h3 className="font-display text-base font-bold text-forest-900">
                  การเคลื่อนไหวห้องพักวันนี้
                </h3>
              </div>
              <span className="text-xs font-semibold text-forest-800 bg-forest-50 border border-forest-100 px-2.5 py-1 rounded-xl">
                {formatThaiDateShort(todayStr)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center my-3">
              <div className="p-3 rounded-2xl bg-cream-50/70 border border-cream-200/80">
                <p className="text-[11px] text-charcoal-500 font-medium">รอเข้าพัก</p>
                <p className="mt-1 font-display text-xl font-bold text-forest-900">
                  {todayRoomArrivals}
                </p>
                <p className="text-[10px] text-charcoal-400 mt-0.5">ห้อง</p>
              </div>

              <div className="p-3 rounded-2xl bg-cream-50/70 border border-cream-200/80">
                <p className="text-[11px] text-charcoal-500 font-medium">กำลังพักอยู่</p>
                <p className="mt-1 font-display text-xl font-bold text-forest-900">
                  {todayRoomInHouse}
                </p>
                <p className="text-[10px] text-charcoal-400 mt-0.5">ห้อง</p>
              </div>

              <div className="p-3 rounded-2xl bg-cream-50/70 border border-cream-200/80">
                <p className="text-[11px] text-charcoal-500 font-medium">เช็คเอาต์วันนี้</p>
                <p className="mt-1 font-display text-xl font-bold text-forest-900">
                  {todayRoomDepartures}
                </p>
                <p className="text-[10px] text-charcoal-400 mt-0.5">ห้อง</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/admin/checkin")}
            className="mt-4 w-full rounded-xl bg-forest-800 hover:bg-forest-900 text-white py-2.5 text-xs font-semibold shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            <LogIn size={13} />
            <span>เข้าสู่ระบบเช็คอิน - เช็คเอาต์</span>
          </button>
        </div>

        {/* Today's Kayak Pulse */}
        <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-lagoon-50 text-lagoon-800 border border-lagoon-100 flex items-center justify-center">
                  <Sailboat size={16} />
                </span>
                <h3 className="font-display text-base font-bold text-forest-900">
                  กิจกรรมทางน้ำ & เรือวันนี้
                </h3>
              </div>
              <span className="text-xs font-semibold text-lagoon-800 bg-lagoon-50 border border-lagoon-100 px-2.5 py-1 rounded-xl">
                {todayKayakList.length} รอบที่จอง
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center my-3">
              <div className="p-3 rounded-2xl bg-cream-50/70 border border-cream-200/80">
                <p className="text-[11px] text-charcoal-500 font-medium">ผู้พายเรือทั้งหมด</p>
                <p className="mt-1 font-display text-xl font-bold text-forest-900">
                  {todayKayakPassengers}
                </p>
                <p className="text-[10px] text-charcoal-400 mt-0.5">ท่าน</p>
              </div>

              <div className="p-3 rounded-2xl bg-cream-50/70 border border-cream-200/80">
                <p className="text-[11px] text-charcoal-500 font-medium">ยอดขายเรือวันนี้</p>
                <p className="mt-1 font-display text-xl font-bold text-forest-900">
                  {formatMoney(
                    todayKayakList.reduce((sum, b) => sum + Number(b.total_price || 0), 0)
                  )}
                </p>
                <p className="text-[10px] text-charcoal-400 mt-0.5">บาท</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => router.push("/admin/calendar")}
            className="mt-4 w-full rounded-xl bg-white hover:bg-lagoon-50 text-lagoon-900 border border-lagoon-200/90 py-2.5 text-xs font-semibold shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
          >
            <Calendar size={13} />
            <span>ดูปฏิทินรวมห้องพักและคายัค</span>
          </button>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. REVENUE SPLIT & BOOKING LIFECYCLE (Timeframe View)
          ───────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Revenue Share Card */}
        <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 flex flex-col justify-between lg:col-span-1">
          <div>
            <h3 className="font-display text-base lg:text-lg font-bold text-forest-900 tracking-tight">
              สัดส่วนรายได้ ({timeframes.find((t) => t.id === timeframe)?.label})
            </h3>
            <p className="mt-2.5 font-display text-3xl font-bold text-forest-950">
              {formatMoney(totalRevenue)}
            </p>

            {/* Visual Bar */}
            <div className="mt-5 flex h-3.5 w-full overflow-hidden rounded-full bg-cream-100 p-0.5 border border-cream-200/80">
              <div
                style={{ width: `${roomShare}%` }}
                className="bg-forest-700 rounded-l-full transition-all duration-500"
              />
              <div
                style={{ width: `${kayakShare}%` }}
                className="bg-lagoon-600 rounded-r-full transition-all duration-500"
              />
            </div>

            <div className="mt-4 space-y-2.5 text-xs text-charcoal-600">
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-cream-50/70 border border-cream-200/60">
                <span className="flex items-center gap-2 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-forest-700" />
                  ห้องพัก ({roomShare}%)
                </span>
                <span className="font-bold text-forest-900">
                  {formatMoney(roomRevenue)}
                </span>
              </div>
              <div className="flex items-center justify-between p-2.5 rounded-2xl bg-cream-50/70 border border-cream-200/60">
                <span className="flex items-center gap-2 font-medium">
                  <span className="h-2.5 w-2.5 rounded-full bg-lagoon-600" />
                  คายัค ({kayakShare}%)
                </span>
                <span className="font-bold text-lagoon-900">
                  {formatMoney(kayakRevenue)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Booking Status Summary */}
        <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 lg:col-span-2">
          <h3 className="font-display text-base lg:text-lg font-bold text-forest-900 tracking-tight mb-4">
            สถานะการจองตามช่วงเวลา ({timeframes.find((t) => t.id === timeframe)?.label})
          </h3>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            {[
              {
                name: "สรุปห้องพัก",
                icon: <Home size={15} className="text-forest-700" />,
                a: roomApproved,
                p: roomPending,
                c: roomCancelled,
              },
              {
                name: "สรุปคายัค",
                icon: <Sailboat size={15} className="text-lagoon-700" />,
                a: kayakApproved,
                p: kayakPending,
                c: kayakCancelled,
              },
            ].map((g) => (
              <div
                key={g.name}
                className="rounded-2xl bg-cream-50/70 border border-cream-200/80 p-4"
              >
                <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-charcoal-700">
                  {g.icon} <span>{g.name}</span>
                </h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-cream-200/60">
                    <span className="text-charcoal-600">อนุมัติ / เช็คเอาต์แล้ว</span>
                    <span className="font-bold text-forest-800">{g.a}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-cream-200/60">
                    <span className="text-charcoal-600">รอยืนยันสลิป</span>
                    <span className="font-bold text-amber-800">{g.p}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-charcoal-600">ยกเลิก / ปฏิเสธ</span>
                    <span className="font-medium text-charcoal-400">{g.c}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Staff Summary Pills */}
          <div className="mt-4 pt-3 border-t border-cream-200/70 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-charcoal-500 font-medium">พนักงาน {staffList.length} คน:</span>
            <span className="px-2.5 py-0.5 rounded-full bg-forest-50 text-forest-800 border border-forest-200/80 font-medium text-[11px]">
              ห้องพัก {staffList.filter((s) => s.role === "room_staff").length} คน
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-lagoon-50 text-lagoon-800 border border-lagoon-200/80 font-medium text-[11px]">
              คายัค {staffList.filter((s) => s.role === "boat_staff").length} คน
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-cream-100 text-charcoal-700 border border-cream-300/80 font-medium text-[11px]">
              ผู้ดูแล {staffList.filter((s) => s.role === "admin").length} คน
            </span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. GUEST REVIEWS FEED & ACTIVE PROMOTIONS
          ───────────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Recent Guest Reviews */}
        <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-bamboo-50 text-bamboo-800 border border-bamboo-100 flex items-center justify-center">
                  <MessageSquare size={16} />
                </span>
                <h3 className="font-display text-base font-bold text-forest-900">
                  รีวิวล่าสุดจากลูกค้า
                </h3>
              </div>
              <button
                type="button"
                onClick={() => router.push("/admin/reviews")}
                className="text-xs text-forest-800 hover:text-forest-900 font-medium flex items-center gap-1"
              >
                <span>ดูทั้งหมด</span>
                <ArrowUpRight size={12} />
              </button>
            </div>

            {recentReviews.length === 0 ? (
              <div className="py-8 text-center text-charcoal-400 text-xs italic bg-cream-50/50 rounded-2xl border border-cream-200/60">
                ยังไม่มีข้อมูลรีวิวในระบบ
              </div>
            ) : (
              <div className="space-y-2.5">
                {recentReviews.slice(0, 3).map((rev) => (
                  <div
                    key={rev.review_id}
                    className="p-3 rounded-2xl bg-cream-50/70 border border-cream-200/70 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5 font-semibold text-charcoal-800">
                        <span>{rev.first_name} {rev.last_name || ""}</span>
                        {rev.room_name && (
                          <span className="text-[11px] text-charcoal-500 font-normal">
                            ({rev.room_name})
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 text-amber-500">
                        {Array.from({ length: rev.rating || 5 }).map((_, i) => (
                          <Star key={i} size={11} className="fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-charcoal-600 line-clamp-2 text-[11px]">
                      {rev.comment || "ไม่มีความเห็นเพิ่มเติม"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active Promotions Overview */}
        <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-forest-50 text-forest-800 border border-forest-100 flex items-center justify-center">
                  <Tag size={16} />
                </span>
                <h3 className="font-display text-base font-bold text-forest-900">
                  โปรโมชั่น & โค้ดส่วนลด
                </h3>
              </div>
              <button
                type="button"
                onClick={() => router.push("/admin/promotions")}
                className="text-xs text-forest-800 hover:text-forest-900 font-medium flex items-center gap-1"
              >
                <span>จัดการโปรโมชั่น</span>
                <ArrowUpRight size={12} />
              </button>
            </div>

            {promotionsList.length === 0 ? (
              <div className="py-8 text-center text-charcoal-400 text-xs italic bg-cream-50/50 rounded-2xl border border-cream-200/60">
                ยังไม่มีแคมเปญโปรโมชั่นที่เปิดใช้งาน
              </div>
            ) : (
              <div className="space-y-2.5">
                {promotionsList.slice(0, 3).map((promo) => (
                  <div
                    key={promo.id || promo.code}
                    className="flex items-center justify-between p-3 rounded-2xl bg-cream-50/70 border border-cream-200/70 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-forest-800 bg-forest-50 px-2 py-0.5 rounded-lg border border-forest-100">
                          {promo.code}
                        </span>
                        <span className="font-medium text-charcoal-800 truncate">
                          {promo.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-charcoal-500 mt-1">
                        ส่วนลด{" "}
                        {promo.discount_type === "percent"
                          ? `${Number(promo.discount_value)}%`
                          : formatMoney(promo.discount_value)}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-[11px] font-semibold text-charcoal-600">
                        ใช้แล้ว {promo.usage_count || 0}
                        {promo.usage_limit ? ` / ${promo.usage_limit}` : " ครั้ง"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. QUICK SHORTCUTS BAR
          ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80">
        <h3 className="font-display text-base font-bold text-forest-900 mb-4">
          ทางลัดจัดการระบบ
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            {
              label: "ปฏิทินจองรวม",
              href: "/admin/calendar",
              icon: <Calendar size={18} className="text-forest-700" />,
            },
            {
              label: "เช็คอิน-เช็คเอาต์",
              href: "/admin/checkin",
              icon: <LogIn size={18} className="text-forest-700" />,
            },
            {
              label: "จัดการห้องพัก",
              href: "/admin/rooms",
              icon: <Home size={18} className="text-forest-700" />,
            },
            {
              label: "จัดการเรือ / คายัค",
              href: "/admin/boats",
              icon: <Sailboat size={18} className="text-lagoon-700" />,
            },
            {
              label: "จัดการพนักงาน",
              href: "/admin/staff",
              icon: <Users size={18} className="text-bamboo-800" />,
            },
            {
              label: "ข้อมูลรีสอร์ท",
              href: "/admin/site-info",
              icon: <Building2 size={18} className="text-charcoal-700" />,
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="p-3.5 rounded-2xl bg-cream-50/70 hover:bg-forest-50/60 border border-cream-200/80 hover:border-forest-200/90 transition-all text-center flex flex-col items-center justify-center gap-2 group shadow-2xs active:scale-95"
            >
              <div className="w-9 h-9 rounded-xl bg-white border border-cream-200 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
                {item.icon}
              </div>
              <span className="text-xs font-semibold text-charcoal-700 group-hover:text-forest-900 transition-colors">
                {item.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
