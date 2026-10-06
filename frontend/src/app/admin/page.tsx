"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Sailboat,
  TrendingUp,
  Users,
  RefreshCw,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { PageHeader, StatCard, Panel, StatusBadge, EmptyState, Skeleton } from "@/components/admin/ui";

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
      notify.error("ไม่สามารถโหลดข้อมูลสถิติได้");
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
      <div className="space-y-5">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const timeframes: { id: Timeframe; label: string }[] = [
    { id: "today", label: "วันนี้" },
    { id: "month", label: "เดือนนี้" },
    { id: "year", label: "ปีนี้" },
    { id: "all", label: "ทั้งหมด" },
  ];

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        title="ภาพรวมระบบ"
        description="ยอดขาย สถิติการเข้าพัก และข้อมูลทรัพยากรบุคลากร"
        actions={
          <>
            <div className="flex rounded-xl bg-white p-1 shadow-panel">
              {timeframes.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTimeframe(tab.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    timeframe === tab.id
                      ? "bg-forest-800 text-cream-100"
                      : "text-charcoal-500 hover:bg-charcoal-50"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={fetchAll}
              className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-forest-800 shadow-panel hover:bg-cream-100"
            >
              <RefreshCw size={14} /> รีเฟรช
            </button>
          </>
        }
      />

      {/* Overview: การ์ดสถิติ */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="ยอดขายที่อนุมัติแล้ว" value={formatMoney(totalRevenue)} icon={<TrendingUp />} tone="forest" />
        <StatCard label="ห้องพักเช็คอินวันนี้" value={`${todayRoomBookings} ห้อง`} icon={<Home />} tone="forest" />
        <StatCard label="คิวเรือวันนี้" value={`${todayKayakBookings} คิว`} icon={<Sailboat />} tone="lagoon" />
        <StatCard label="ฐานลูกค้า" value={`${membersList.length} บัญชี`} icon={<Users />} tone="bamboo" />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* สัดส่วนรายได้ */}
        <Panel title="สัดส่วนรายได้" className="lg:col-span-1">
          <p className="font-display text-3xl font-semibold text-forest-800">{formatMoney(totalRevenue)}</p>
          <div className="mt-5 flex h-3 w-full overflow-hidden rounded-full bg-charcoal-50">
            <div style={{ width: `${roomShare}%` }} className="bg-forest-500 transition-all duration-500" />
            <div style={{ width: `${kayakShare}%` }} className="bg-lagoon-500 transition-all duration-500" />
          </div>
          <div className="mt-3 space-y-2 text-xs text-charcoal-600">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-forest-500" />ห้องพัก ({roomShare}%)</span>
              <span className="font-semibold">{formatMoney(roomRevenue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-lagoon-500" />คายัค ({kayakShare}%)</span>
              <span className="font-semibold">{formatMoney(kayakRevenue)}</span>
            </div>
          </div>
        </Panel>

        {/* สถานะการจอง */}
        <Panel title="สถานะการจองตามช่วงเวลา" className="lg:col-span-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { name: "สรุปห้องพัก", icon: <Home size={14} />, a: roomApproved, p: roomPending, c: roomCancelled },
              { name: "สรุปคายัค", icon: <Sailboat size={14} />, a: kayakApproved, p: kayakPending, c: kayakCancelled },
            ].map((g) => (
              <div key={g.name} className="rounded-xl bg-cream-100 p-4">
                <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-charcoal-500">{g.icon} {g.name}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-charcoal-600">อนุมัติแล้ว</span><span className="font-semibold text-forest-700">{g.a}</span></div>
                  <div className="flex justify-between"><span className="text-charcoal-600">รอยืนยันสลิป</span><span className="font-semibold text-bamboo-600">{g.p}</span></div>
                  <div className="flex justify-between"><span className="text-charcoal-600">ยกเลิก/ปฏิเสธ</span><span className="font-semibold text-charcoal-400">{g.c}</span></div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
            <span className="text-charcoal-400">พนักงาน {staffList.length} คน:</span>
            <StatusBadge tone="success">ห้องพัก {staffList.filter((s) => s.role === "room_staff").length}</StatusBadge>
            <StatusBadge tone="info">คายัค {staffList.filter((s) => s.role === "boat_staff").length}</StatusBadge>
            <StatusBadge tone="neutral">แอดมิน {staffList.filter((s) => s.role === "admin").length}</StatusBadge>
          </div>
        </Panel>
      </section>

      {/* งานที่ต้องดำเนินการ */}
      <Panel title="รอตรวจสอบการชำระเงิน">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[
            { name: "ห้องพัก", icon: <Home size={16} />, list: pendingRoomsList, href: "/admin/rooms", btn: "ตรวจสอบสลิปห้องพัก", tone: "bamboo" },
            { name: "เรือ", icon: <Sailboat size={16} />, list: pendingKayaksList, href: "/admin/boats", btn: "ตรวจสอบสลิปเรือ", tone: "lagoon" },
          ].map((g) => (
            <div key={g.name} className="flex flex-col justify-between rounded-xl bg-cream-100 p-4">
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-charcoal-700">{g.icon} {g.name}</div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold text-white ${g.tone === "bamboo" ? "bg-bamboo-500" : "bg-lagoon-600"}`}>
                    {g.list.length}
                  </span>
                </div>
                {g.list.length === 0 ? (
                  <EmptyState title="ไม่มีรายการค้างตรวจสอบ" />
                ) : (
                  <div className="mt-3 space-y-2">
                    {g.list.slice(0, 3).map((item, index) => (
                      <div key={item.id || index} className="flex justify-between rounded-lg bg-white p-2.5 text-xs shadow-panel">
                        <span className="mr-2 truncate font-medium text-charcoal-700">
                          #{item.id || "?"} {item.customer_name || item.user?.name}
                        </span>
                        <span className="shrink-0 font-semibold text-forest-700">{formatMoney(item.total_price)}</span>
                      </div>
                    ))}
                    {g.list.length > 3 && (
                      <p className="pt-1 text-center text-xs font-medium text-charcoal-400">+ อีก {g.list.length - 3} รายการ</p>
                    )}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => router.push(g.href)}
                className="mt-4 w-full rounded-lg bg-white py-2 text-xs font-semibold text-forest-800 shadow-panel transition-colors hover:bg-forest-50"
              >
                {g.btn}
              </button>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

