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
  X,
  Phone,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast from "react-hot-toast";

// สถานะที่นับเป็นรายได้สำเร็จ
const REVENUE_STATUSES = new Set(["approved", "checked_out"]);
// สถานะที่นับว่ารอชำระ/รอตรวจสอบ
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
  const [loading, setLoading] = useState(true);

  // State สำหรับ Filter เลือกช่วงเวลา
  const [timeframe, setTimeframe] = useState<Timeframe>("month");

  // Modal สรุปรายการค้างชำระ
  const [showPendingModal, setShowPendingModal] = useState(false);

  const [membersList, setMembersList] = useState<any[]>([]);

  useEffect(() => {
    if (!ready) return;
    fetchAll();
  }, [ready]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [rb, kb, st, mb] = await Promise.all([
        api.get("/bookings"),
        api.get("/kayaks/bookings/all").catch(() => ({ data: { data: [] } })),
        api.get("/auth/staff").catch(() => ({ data: { data: [] } })),
        api.get("/members").catch(() => ({ data: { data: [] } })),
      ]);
      setRoomBookings(rb.data?.data || []);
      setKayakBookings(kb.data?.data || []);
      setStaffList(st.data?.data || []);
      const rawMembers = mb.data;
      const memberList = Array.isArray(rawMembers)
        ? rawMembers
        : rawMembers?.data || rawMembers?.members || [];

      console.log("=== สมาชิกที่ดึงมาได้ ===", memberList); // ดูรายการใน F12 Console
      setMembersList(memberList);
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลได้");
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

  // กรองรายการตาม Timeframe ที่เลือก
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

  // รายการค้างชำระทั้งหมด (สำหรับแสดงใน Modal)
  const pendingRoomsList = useMemo(() => {
    return filteredRooms.filter((b) => PENDING_STATUSES.has(b.status));
  }, [filteredRooms]);

  const pendingKayaksList = useMemo(() => {
    return filteredKayaks.filter((b) => PENDING_STATUSES.has(b.status));
  }, [filteredKayaks]);

  // ----------------------- Calculations -----------------------
  // รายได้ที่อนุมัติแล้วตามช่วงเวลา
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

  // การติดตามยอดค้างชำระ/รออนุมัติ (Payment Tracking)
  const pendingPaymentAmount = useMemo(() => {
    const pendingRooms = pendingRoomsList.reduce(
      (sum, b) => sum + Number(b.total_price || 0),
      0,
    );
    const pendingKayaks = pendingKayaksList.reduce(
      (sum, b) => sum + Number(b.total_price || 0),
      0,
    );
    return pendingRooms + pendingKayaks;
  }, [pendingRoomsList, pendingKayaksList]);

  // การจองวันนี้ (Today's Live Status)
  const todayRoomBookings = useMemo(() => {
    return roomBookings.filter(
      (b) =>
        isDateInTimeframe(b.check_in || b.created_at, "today") &&
        REVENUE_STATUSES.has(b.status),
    ).length;
  }, [roomBookings]);

  const todayKayakBookings = useMemo(() => {
    return kayakBookings.filter(
      (b) =>
        isDateInTimeframe(b.booking_date || b.created_at, "today") &&
        REVENUE_STATUSES.has(b.status),
    ).length;
  }, [kayakBookings]);

  // สถิติสถานะห้องพัก
  const roomApproved = filteredRooms.filter((b) =>
    REVENUE_STATUSES.has(b.status),
  ).length;
  const roomPending = filteredRooms.filter((b) =>
    PENDING_STATUSES.has(b.status),
  ).length;
  const roomCancelled = filteredRooms.filter(
    (b) => b.status === "cancelled" || b.status === "rejected",
  ).length;

  // สถิติสถานะเรือ
  const kayakApproved = filteredKayaks.filter((b) =>
    REVENUE_STATUSES.has(b.status),
  ).length;
  const kayakPending = filteredKayaks.filter((b) =>
    PENDING_STATUSES.has(b.status),
  ).length;
  const kayakCancelled = filteredKayaks.filter(
    (b) => b.status === "cancelled" || b.status === "rejected",
  ).length;

  // สัดส่วนรายได้
  const roomShare =
    totalRevenue > 0 ? Math.round((roomRevenue / totalRevenue) * 100) : 0;
  const kayakShare = totalRevenue > 0 ? 100 - roomShare : 0;

  if (!ready) return null;

  return (
    <div className="space-y-6 font-sans pb-10">
      {/* Header & Timeframe Selector */}
      <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-stone-200/80">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-forest-800 tracking-tight">
            ภาพรวมระบบผู้ดูแล
          </h1>
          <p className="text-charcoal-400 mt-1 text-xs md:text-sm">
            สถิติรายได้ สรุปผลการดำเนินงาน และข้อมูลภาพรวมสวนวลัยรุกขเวช
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* ปุ่ม รีเฟรชข้อมูล */}
          <button
            onClick={fetchAll}
            disabled={loading}
            className="p-2 rounded-xl bg-white border border-stone-200/80 text-charcoal-500 hover:text-forest-800 hover:border-forest-800/40 transition-all shadow-xs"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>

          {/* Timeframe Toggle Buttons */}
          <div className="bg-stone-100 p-1 rounded-xl flex items-center gap-1 border border-stone-200/60">
            {[
              { key: "today", label: "วันนี้" },
              { key: "month", label: "เดือนนี้" },
              { key: "year", label: "ปีนี้" },
              { key: "all", label: "ทั้งหมด" },
            ].map((tf) => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key as Timeframe)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  timeframe === tf.key
                    ? "bg-white text-forest-800 shadow-sm"
                    : "text-charcoal-400 hover:text-charcoal-600"
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Card ยอดรายได้รวมสุทธิ */}
          <div className="bg-white px-4 py-2 rounded-xl border border-stone-200/80 shadow-sm flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-forest-800/10 flex items-center justify-center text-forest-800">
              <Wallet size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-charcoal-400 uppercase tracking-wider">
                รายได้สุทธิ (
                {timeframe === "today"
                  ? "วันนี้"
                  : timeframe === "month"
                    ? "เดือนนี้"
                    : timeframe === "year"
                      ? "ปีนี้"
                      : "ทั้งหมด"}
                )
              </p>
              <p className="font-display text-lg font-bold text-forest-800 tabular-nums leading-none mt-0.5">
                {loading ? "—" : formatMoney(totalRevenue)}
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Top 4 Key Performance Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl border border-stone-200/80 bg-white shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-charcoal-500">
              รายได้ห้องพัก
            </span>
            <div className="p-1.5 rounded-lg bg-stone-100 text-forest-800">
              <Home size={18} />
            </div>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-forest-800 tabular-nums">
              {loading ? "—" : formatMoney(roomRevenue)}
            </p>
            <p className="text-[11px] mt-1 text-charcoal-400 font-medium">
              สำเร็จ {roomApproved} รายการ
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-stone-200/80 bg-white shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-charcoal-500">
              รายได้เรือคายัค
            </span>
            <div className="p-1.5 rounded-lg bg-stone-100 text-lagoon-600">
              <Sailboat size={18} />
            </div>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-forest-800 tabular-nums">
              {loading ? "—" : formatMoney(kayakRevenue)}
            </p>
            <p className="text-[11px] mt-1 text-charcoal-400 font-medium">
              สำเร็จ {kayakApproved} รายการ
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-stone-200/80 bg-white shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-charcoal-500">
              สมาชิกในระบบ
            </span>
            <div className="p-1.5 rounded-lg bg-stone-100 text-forest-800">
              <UserCheck size={18} />
            </div>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-forest-800 tabular-nums">
              {loading ? "—" : `${membersList.length} คน`}
            </p>
            <p className="text-[11px] mt-1 text-charcoal-400 font-medium">
              บัญชีผู้ใช้งานทั่วไป (Members)
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-stone-200/80 bg-white shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-charcoal-500">
              พนักงานทั้งหมด
            </span>
            <div className="p-1.5 rounded-lg bg-stone-100 text-charcoal-500">
              <Users size={18} />
            </div>
          </div>

          <div>
            <p className="font-display text-2xl font-bold text-forest-800 tabular-nums">
              {loading ? "—" : `${staffList.length} คน`}
            </p>

            {/* แยกแสดงตาม Role โดยใช้ Lucide Icons */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[11px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                <Home size={12} className="text-emerald-700" />
                ห้องพัก:{" "}
                {loading
                  ? "—"
                  : staffList.filter((s: any) => s.role === "room_staff")
                      .length}
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-sky-50 text-sky-800 border border-sky-200/60">
                <Sailboat size={12} className="text-sky-700" />
                เรือคายัค:{" "}
                {loading
                  ? "—"
                  : staffList.filter((s: any) => s.role === "boat_staff")
                      .length}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Today Live Status Banner */}
      <section className="p-4 rounded-2xl bg-forest-800 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-white/10 text-emerald-300">
            <CalendarCheck size={22} />
          </div>
          <div>
            <p className="text-xs text-emerald-200 font-semibold uppercase tracking-wider">
              สถานะการเข้าใช้งานวันนี้ (Today's Live)
            </p>
            <p className="text-sm font-medium text-stone-100 mt-0.5">
              สรุปจำนวนการจองที่มีผลเปิดเข้าพักและใช้งานเรือในวันนี้
            </p>
          </div>
        </div>
        <div className="flex items-center gap-6 shrink-0 border-t sm:border-t-0 pt-3 sm:pt-0 border-white/10">
          <div className="text-left sm:text-right">
            <p className="text-[11px] text-stone-300">ห้องพักเข้าพักวันนี้</p>
            <p className="text-xl font-bold text-white tabular-nums">
              {loading ? "—" : `${todayRoomBookings} รายการ`}
            </p>
          </div>
          <div className="h-8 w-px bg-white/10 hidden sm:block" />
          <div className="text-left sm:text-right">
            <p className="text-[11px] text-stone-300">เรือคายัคใช้งานวันนี้</p>
            <p className="text-xl font-bold text-white tabular-nums">
              {loading ? "—" : `${todayKayakBookings} รายการ`}
            </p>
          </div>
        </div>
      </section>

      {/* Middle Row: Navigation Cards + Revenue Split */}
      <section className="grid md:grid-cols-3 gap-4">
        {/* Room Booking Overview */}
        <div
          onClick={() => router.push("/staff/rooms/dashboard")}
          className="cursor-pointer p-5 rounded-2xl bg-white border border-stone-200/80 hover:border-forest-800/40 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-forest-800/10 text-forest-800">
                  <Home size={18} />
                </div>
                <span className="text-sm font-bold text-forest-800">
                  จัดการระบบห้องพัก
                </span>
              </div>
              <ArrowRight
                size={16}
                className="text-charcoal-400 group-hover:text-forest-800 group-hover:translate-x-1 transition-all"
              />
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-display text-3xl font-bold text-forest-800 tabular-nums">
                {loading ? "—" : filteredRooms.length}
              </span>
              <span className="text-xs text-charcoal-400">
                รายการจองช่วงนี้
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 grid grid-cols-3 text-center text-xs">
            <div>
              <p className="text-[10px] text-charcoal-400">อนุมัติ</p>
              <p className="font-bold text-emerald-700">{roomApproved}</p>
            </div>
            <div>
              <p className="text-[10px] text-charcoal-400">รอดำเนินการ</p>
              <p className="font-bold text-amber-600">{roomPending}</p>
            </div>
            <div>
              <p className="text-[10px] text-charcoal-400">ยกเลิก</p>
              <p className="font-bold text-rose-600">{roomCancelled}</p>
            </div>
          </div>
        </div>

        {/* Kayak Booking Overview */}
        <div
          onClick={() => router.push("/staff/boats/dashboard")}
          className="cursor-pointer p-5 rounded-2xl bg-white border border-stone-200/80 hover:border-forest-800/40 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-lagoon-50 text-lagoon-700">
                  <Sailboat size={18} />
                </div>
                <span className="text-sm font-bold text-forest-800">
                  จัดการระบบเรือคายัค
                </span>
              </div>
              <ArrowRight
                size={16}
                className="text-charcoal-400 group-hover:text-forest-800 group-hover:translate-x-1 transition-all"
              />
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="font-display text-3xl font-bold text-forest-800 tabular-nums">
                {loading ? "—" : filteredKayaks.length}
              </span>
              <span className="text-xs text-charcoal-400">
                รายการจองช่วงนี้
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-stone-100 grid grid-cols-3 text-center text-xs">
            <div>
              <p className="text-[10px] text-charcoal-400">อนุมัติ</p>
              <p className="font-bold text-emerald-700">{kayakApproved}</p>
            </div>
            <div>
              <p className="text-[10px] text-charcoal-400">รอดำเนินการ</p>
              <p className="font-bold text-amber-600">{kayakPending}</p>
            </div>
            <div>
              <p className="text-[10px] text-charcoal-400">ยกเลิก</p>
              <p className="font-bold text-rose-600">{kayakCancelled}</p>
            </div>
          </div>
        </div>

        {/* Revenue Split Gauge */}
        <div className="p-5 rounded-2xl bg-white border border-stone-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                <TrendingUp size={18} />
              </div>
              <span className="text-sm font-bold text-forest-800">
                สัดส่วนรายได้ธุรกิจ
              </span>
            </div>
            <div className="space-y-3.5">
              <div>
                <div className="flex justify-between text-xs text-charcoal-500 mb-1">
                  <span>ห้องพัก ({roomShare}%)</span>
                  <span className="font-bold text-forest-800">
                    {formatMoney(roomRevenue)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full bg-forest-800 rounded-full transition-all duration-500"
                    style={{ width: `${roomShare}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs text-charcoal-500 mb-1">
                  <span>เรือคายัค ({kayakShare}%)</span>
                  <span className="font-bold text-forest-800">
                    {formatMoney(kayakRevenue)}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full bg-lagoon-500 rounded-full transition-all duration-500"
                    style={{ width: `${kayakShare}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Links Section */}
      <section className="p-5 rounded-2xl bg-white border border-stone-200/80 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-bold text-charcoal-400 uppercase tracking-wider">
            เมนูด่วนสำหรับผู้ดูแลระบบ
          </h2>
          <span className="text-[11px] text-stone-400 font-medium">
            5 รายการ
          </span>
        </div>

        {/* Responsive Grid: 2 คอลัมน์ (มือถือ) -> 3 คอลัมน์ (แท็บเล็ต) -> 5 คอลัมน์ (จอใหญ่) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* 1. ปฏิทินการจองรวม */}
          <button
            type="button"
            onClick={() => router.push("/admin/calendar")}
            className="p-3.5 rounded-xl bg-stone-50/70 border border-stone-200/60 hover:bg-white hover:border-forest-800/40 hover:shadow-md text-left transition-all duration-200 group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 text-forest-800 flex items-center justify-center group-hover:bg-forest-800 group-hover:text-white transition-colors">
                  <CalendarIcon size={18} />
                </div>
                <ChevronRight
                  size={14}
                  className="text-stone-300 group-hover:text-forest-800 group-hover:translate-x-0.5 transition-all"
                />
              </div>
              <p className="text-xs font-bold text-charcoal-800 group-hover:text-forest-800 transition-colors">
                ปฏิทินการจองรวม
              </p>
              <p className="text-[10px] text-charcoal-400 mt-0.5 line-clamp-1">
                ดูผังห้องและเรือ
              </p>
            </div>
          </button>

          {/* 2. จัดการสมาชิก */}
          <button
            type="button"
            onClick={() => router.push("/admin/members")}
            className="p-3.5 rounded-xl bg-stone-50/70 border border-stone-200/60 hover:bg-white hover:border-forest-800/40 hover:shadow-md text-left transition-all duration-200 group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center group-hover:bg-teal-700 group-hover:text-white transition-colors">
                  <UserCheck size={18} />
                </div>
                <ChevronRight
                  size={14}
                  className="text-stone-300 group-hover:text-teal-700 group-hover:translate-x-0.5 transition-all"
                />
              </div>
              <p className="text-xs font-bold text-charcoal-800 group-hover:text-teal-800 transition-colors">
                จัดการสมาชิก
              </p>
              <p className="text-[10px] text-charcoal-400 mt-0.5 line-clamp-1">
                ตรวจสอบ/เปิดปิดบัญชีลูกค้า
              </p>
            </div>
          </button>

          {/* 3. จัดการพนักงาน & สิทธิ์ */}
          <button
            type="button"
            onClick={() => router.push("/admin/staff")}
            className="p-3.5 rounded-xl bg-stone-50/70 border border-stone-200/60 hover:bg-white hover:border-forest-800/40 hover:shadow-md text-left transition-all duration-200 group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center group-hover:bg-indigo-700 group-hover:text-white transition-colors">
                  <Users size={18} />
                </div>
                <ChevronRight
                  size={14}
                  className="text-stone-300 group-hover:text-indigo-700 group-hover:translate-x-0.5 transition-all"
                />
              </div>
              <p className="text-xs font-bold text-charcoal-800 group-hover:text-indigo-800 transition-colors">
                จัดการพนักงาน & สิทธิ์
              </p>
              <p className="text-[10px] text-charcoal-400 mt-0.5 line-clamp-1">
                เพิ่ม/ลบ และกำหนด Admin/Staff
              </p>
            </div>
          </button>

          {/* 4. โปรโมชั่น */}
          <button
            type="button"
            onClick={() => router.push("/admin/promotions")}
            className="p-3.5 rounded-xl bg-stone-50/70 border border-stone-200/60 hover:bg-white hover:border-forest-800/40 hover:shadow-md text-left transition-all duration-200 group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
                  <Tag size={18} />
                </div>
                <ChevronRight
                  size={14}
                  className="text-stone-300 group-hover:text-amber-700 group-hover:translate-x-0.5 transition-all"
                />
              </div>
              <p className="text-xs font-bold text-charcoal-800 group-hover:text-amber-800 transition-colors">
                โปรโมชั่น
              </p>
              <p className="text-[10px] text-charcoal-400 mt-0.5 line-clamp-1">
                จัดการส่วนลดและคูปอง
              </p>
            </div>
          </button>

          {/* 5. รายงานสถิติ */}
          <button
            type="button"
            onClick={() => router.push("/admin/stats")}
            className="p-3.5 rounded-xl bg-stone-50/70 border border-stone-200/60 hover:bg-white hover:border-forest-800/40 hover:shadow-md text-left transition-all duration-200 group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-sky-50 text-sky-700 flex items-center justify-center group-hover:bg-sky-700 group-hover:text-white transition-colors">
                  <BarChart3 size={18} />
                </div>
                <ChevronRight
                  size={14}
                  className="text-stone-300 group-hover:text-sky-700 group-hover:translate-x-0.5 transition-all"
                />
              </div>
              <p className="text-xs font-bold text-charcoal-800 group-hover:text-sky-800 transition-colors">
                รายงานสถิติ
              </p>
              <p className="text-[10px] text-charcoal-400 mt-0.5 line-clamp-1">
                วิเคราะห์เชิงลึก & ส่งออก CSV
              </p>
            </div>
          </button>
        </div>
      </section>

      {/* Modal รายละเอียดรายการค้างชำระ */}
      {showPendingModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-stone-100 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center pb-4 border-b border-stone-100">
              <div className="flex items-center gap-2 text-amber-700 font-bold">
                <Clock size={20} />
                <span>รายการติดตามค้างชำระ / รออนุมัติ</span>
              </div>
              <button
                onClick={() => setShowPendingModal(false)}
                className="p-1 rounded-lg text-charcoal-400 hover:bg-stone-100 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 my-4 pr-1 flex-1">
              {/* รายการห้องพัก */}
              <div>
                <h3 className="text-xs font-bold text-charcoal-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Home size={14} className="text-forest-800" /> ห้องพัก (
                  {pendingRoomsList.length} รายการ)
                </h3>
                {pendingRoomsList.length === 0 ? (
                  <p className="text-xs text-charcoal-400 italic bg-stone-50 p-3 rounded-xl">
                    ไม่มีรายการห้องพักค้างชำระ
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pendingRoomsList.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-stone-50 rounded-xl border border-stone-200/60 flex justify-between items-center text-xs"
                      >
                        <div>
                          <p className="font-bold text-charcoal-800">
                            {item.customer_name ||
                              item.user?.name ||
                              `การจอง #${item.id}`}
                          </p>
                          <p className="text-charcoal-400 text-[11px] mt-0.5">
                            เช็คอิน: {item.check_in}
                          </p>
                          {item.phone && (
                            <p className="text-charcoal-400 text-[11px] flex items-center gap-1 mt-0.5">
                              <Phone size={10} /> {item.phone}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-amber-700">
                            {formatMoney(item.total_price)}
                          </p>
                          <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-medium">
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* รายการเรือ */}
              <div>
                <h3 className="text-xs font-bold text-charcoal-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Sailboat size={14} className="text-lagoon-600" /> เรือคายัค (
                  {pendingKayaksList.length} รายการ)
                </h3>
                {pendingKayaksList.length === 0 ? (
                  <p className="text-xs text-charcoal-400 italic bg-stone-50 p-3 rounded-xl">
                    ไม่มีรายการเรือคายัคค้างชำระ
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pendingKayaksList.map((item) => (
                      <div
                        key={item.id}
                        className="p-3 bg-stone-50 rounded-xl border border-stone-200/60 flex justify-between items-center text-xs"
                      >
                        <div>
                          <p className="font-bold text-charcoal-800">
                            {item.customer_name ||
                              item.user?.name ||
                              `การจอง #${item.id}`}
                          </p>
                          <p className="text-charcoal-400 text-[11px] mt-0.5">
                            วันจอง: {item.booking_date}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-amber-700">
                            {formatMoney(item.total_price)}
                          </p>
                          <span className="inline-block mt-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[10px] font-medium">
                            {item.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-stone-100 text-right">
              <button
                onClick={() => setShowPendingModal(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-charcoal-700 font-semibold text-xs rounded-xl transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
