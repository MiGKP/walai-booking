"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Ship,
  Calendar,
  Clock,
  Phone,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Waves,
  Timer,
  ChevronLeft,
  ChevronRight,
  User,
  BedDouble,
  Sailboat,
  Sparkles,
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { toISODate, formatThaiDateLong } from "@/lib/date";

interface BoatLine {
  booking_boat_id: number;
  boat_type_id: number;
  boat_type_name: string;
  boat_count: number;
  num_passengers: number;
}

interface BoatCheckinBooking {
  boat_booking_id: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  total_price: number;
  status: "approved" | "checked_out";
  checkin_at: string | null;
  checkout_at: string | null;
  is_addon: boolean;
  room_booking_id: number | null;
  booking_room_id: number | null;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  boats: BoatLine[];
}

interface CheckinSummary {
  total_bookings: number;
  waiting_count: number;
  on_water_count: number;
  checked_out_count: number;
  total_boats: number;
}

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

type TabFilter = "all" | "waiting" | "on_water" | "checked_out";

function BoatCheckinContent(): React.ReactElement {
  useAuthGuard({ allowedRoles: ["admin", "boat_staff"] });

  const searchParams = useSearchParams();
  const dateFromQuery = searchParams.get("date");

  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return dateFromQuery || toISODate(new Date());
  });

  useEffect(() => {
    if (dateFromQuery) {
      setSelectedDate(dateFromQuery);
    }
  }, [dateFromQuery]);
  const [search, setSearch] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [bookings, setBookings] = useState<BoatCheckinBooking[]>([]);
  const [summary, setSummary] = useState<CheckinSummary>({
    total_bookings: 0,
    waiting_count: 0,
    on_water_count: 0,
    checked_out_count: 0,
    total_boats: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Confirm dialog state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    type: "checkin" | "checkout";
    bookingId: number | null;
    title: string;
    description: string;
  }>({
    open: false,
    type: "checkin",
    bookingId: null,
    title: "",
    description: "",
  });

  const fetchCheckinSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{
        success: boolean;
        data: {
          summary: CheckinSummary;
          bookings: BoatCheckinBooking[];
        };
      }>("/kayaks/checkin-sessions", {
        params: {
          date: selectedDate,
          search: search.trim() || undefined,
        },
      });

      if (res.data?.success && res.data.data) {
        setBookings(res.data.data.bookings || []);
        setSummary(res.data.data.summary);
      }
    } catch (err) {
      notify.error(getApiErrorMessage(err, "ไม่สามารถดึงข้อมูลเช็คอินเรือได้"));
    } finally {
      setLoading(false);
    }
  }, [selectedDate, search]);

  useEffect(() => {
    fetchCheckinSessions();
  }, [fetchCheckinSessions]);

  // Handle Check-in (ปล่อยเรือลงน้ำ)
  const handleCheckin = async (id: number) => {
    setActionLoadingId(id);
    try {
      const res = await api.put(`/kayaks/bookings/${id}/checkin`);
      if (res.data?.success) {
        notify.success("เช็คอินและบันทึกการปล่อยเรือลงน้ำสำเร็จ");
        fetchCheckinSessions();
      }
    } catch (err) {
      notify.error(getApiErrorMessage(err, "เกิดข้อผิดพลาดในการเช็คอินเรือ"));
    } finally {
      setActionLoadingId(null);
      setConfirmModal((prev) => ({ ...prev, open: false }));
    }
  };

  // Handle Check-out (รับคืนเรือ)
  const handleCheckout = async (id: number) => {
    setActionLoadingId(id);
    try {
      const res = await api.put(`/kayaks/bookings/${id}/checkout`);
      if (res.data?.success) {
        notify.success("บันทึกการคืนเรือ (Check-out) เรียบร้อยแล้ว");
        fetchCheckinSessions();
      }
    } catch (err) {
      notify.error(getApiErrorMessage(err, "เกิดข้อผิดพลาดในการคืนเรือ"));
    } finally {
      setActionLoadingId(null);
      setConfirmModal((prev) => ({ ...prev, open: false }));
    }
  };

  // Filter items based on activeTab
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (activeTab === "waiting") {
        return b.status === "approved" && !b.checkin_at;
      }
      if (activeTab === "on_water") {
        return b.status === "approved" && Boolean(b.checkin_at);
      }
      if (activeTab === "checked_out") {
        return b.status === "checked_out";
      }
      return true;
    });
  }, [bookings, activeTab]);

  // Group by Time Round
  const roundsGroup = useMemo(() => {
    const map = new Map<string, BoatCheckinBooking[]>();
    for (const b of filteredBookings) {
      const key = `${(b.start_time || "00:00").slice(0, 5)} - ${(b.end_time || "00:00").slice(0, 5)}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(b);
    }
    return Array.from(map.entries());
  }, [filteredBookings]);

  const todayStr = useMemo(() => toISODate(new Date()), []);
  const isToday = selectedDate === todayStr;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner / Title */}
      <div className="bg-gradient-to-r from-teal-900 via-forest-800 to-forest-900 rounded-3xl p-6 sm:p-8 text-cream-100 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pr-10 pointer-events-none">
          <Waves size={200} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-cream-200 text-xs font-medium mb-3 backdrop-blur-sm">
              <Ship size={14} className="text-teal-300" />
              <span>จุดปล่อยเรือและท่าเรือ (Pier Operations)</span>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white">
              เช็คอินท่าเรือ
            </h1>
            <p className="text-cream-200/80 text-xs sm:text-sm mt-1 max-w-xl">
              บันทึกการรายงานตัว ปล่อยเรือลงน้ำ และรับคืนเรือหน้าท่าประจำวัน แยกจากการตรวจสลิปหลังบ้าน
            </p>
          </div>

          {/* Quick Date Switcher */}
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-white/20 shrink-0">
            <button
              type="button"
              onClick={() => setSelectedDate(todayStr)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                isToday
                  ? "bg-white text-forest-900 shadow-sm"
                  : "text-white/90 hover:text-white hover:bg-white/10"
              }`}
            >
              วันนี้
            </button>
            <div className="relative flex items-center bg-white text-forest-900 px-3 py-1.5 rounded-xl text-xs font-semibold shadow-sm cursor-pointer hover:bg-cream-50 transition-colors">
              <Calendar size={14} className="text-forest-700 mr-2 shrink-0 pointer-events-none" />
              <input
                id="boat-checkin-date-input"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-xs text-forest-950 font-bold border-0 focus:outline-none focus:ring-0 cursor-pointer [color-scheme:light]"
              />
            </div>
            <button
              type="button"
              onClick={fetchCheckinSessions}
              disabled={loading}
              className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-charcoal-400">จองทั้งหมด</p>
            <p className="text-xl font-bold text-charcoal-800 mt-0.5">{summary.total_bookings} คิว</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-stone-100 text-charcoal-600 flex items-center justify-center">
            <Sailboat size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-charcoal-400">เรือทั้งหมด</p>
            <p className="text-xl font-bold text-teal-800 mt-0.5">{summary.total_boats} ลำ</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <Waves size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-amber-700">รอมารายงานตัว</p>
            <p className="text-xl font-bold text-amber-900 mt-0.5">{summary.waiting_count} คิว</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <Timer size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-teal-200/80 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-teal-700">กำลังพายในน้ำ</p>
            <p className="text-xl font-bold text-teal-900 mt-0.5">{summary.on_water_count} คิว</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
            <Ship size={18} />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-sm flex items-center justify-between col-span-2 lg:col-span-1">
          <div>
            <p className="text-xs font-medium text-emerald-700">คืนเรือเรียบร้อย</p>
            <p className="text-xl font-bold text-emerald-900 mt-0.5">{summary.checked_out_count} คิว</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <CheckCircle2 size={18} />
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-2.5 rounded-2xl border border-stone-200/80 shadow-sm">
        {/* Tab Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === "all"
                ? "bg-forest-800 text-cream-100 shadow-sm"
                : "text-charcoal-600 hover:bg-stone-100"
            }`}
          >
            ทั้งหมด ({summary.total_bookings})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("waiting")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === "waiting"
                ? "bg-amber-500 text-white shadow-sm"
                : "text-charcoal-600 hover:bg-amber-50"
            }`}
          >
            รอมารายงานตัว ({summary.waiting_count})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("on_water")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === "on_water"
                ? "bg-teal-700 text-white shadow-sm"
                : "text-charcoal-600 hover:bg-teal-50"
            }`}
          >
            กำลังพายในน้ำ ({summary.on_water_count})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("checked_out")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 ${
              activeTab === "checked_out"
                ? "bg-emerald-700 text-white shadow-sm"
                : "text-charcoal-600 hover:bg-emerald-50"
            }`}
          >
            คืนเรือแล้ว ({summary.checked_out_count})
          </button>
        </div>

        {/* Search Input */}
        <div className="relative min-w-[240px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อ, เบอร์โทร, รหัสจอง..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:border-forest-600 focus:ring-1 focus:ring-forest-600 transition-all"
          />
        </div>
      </div>

      {/* Main Content Grouped by Round */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-charcoal-400 shadow-sm">
          <RefreshCw size={28} className="animate-spin mx-auto text-forest-700 mb-3" />
          <p className="text-sm font-semibold text-charcoal-600">กำลังโหลดข้อมูลรอบเรือ...</p>
        </div>
      ) : roundsGroup.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-charcoal-500 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto mb-3">
            <Sailboat size={28} />
          </div>
          <h3 className="font-semibold text-charcoal-800 text-base">ไม่พบรายการจองเรือในรอบนี้</h3>
          <p className="text-xs text-charcoal-400 mt-1 max-w-sm mx-auto">
            {search
              ? "ไม่พบข้อมูลที่ตรงกับคำค้นหา ลองตรวจสอบคำสะกดอีกครั้ง"
              : `ไม่มีรอบเรือที่ตรงกับเงื่อนไขในวันที่ ${formatThaiDateLong(selectedDate)}`}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {roundsGroup.map(([roundTime, items]) => {
            const roundTotalBoats = items.reduce((sum, item) => {
              return sum + (item.boats || []).reduce((acc, b) => acc + (b.boat_count || 0), 0);
            }, 0);

            return (
              <div
                key={roundTime}
                className="bg-white rounded-2xl border border-stone-200/90 shadow-sm overflow-hidden"
              >
                {/* Round Header */}
                <div className="bg-stone-50/80 px-5 py-3.5 border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-forest-800 text-cream-100 flex items-center justify-center shrink-0">
                      <Clock size={16} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-charcoal-800 flex items-center gap-2">
                        <span>รอบเวลา {roundTime} น.</span>
                      </h2>
                      <p className="text-[11px] text-charcoal-400">
                        {items.length} คิวจอง • รวมเรือทั้งหมด {roundTotalBoats} ลำ
                      </p>
                    </div>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-forest-50 text-forest-800 border border-forest-200/60">
                    {items.filter((i) => i.status === "approved" && i.checkin_at).length} กำลังพายในน้ำ
                  </span>
                </div>

                {/* Bookings inside this round */}
                <div className="divide-y divide-stone-100">
                  {items.map((b) => {
                    const isWaiting = b.status === "approved" && !b.checkin_at;
                    const isOnWater = b.status === "approved" && Boolean(b.checkin_at);
                    const isCheckedOut = b.status === "checked_out";

                    return (
                      <div
                        key={b.boat_booking_id}
                        className={`p-4 sm:p-5 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                          isOnWater ? "bg-teal-50/20" : "hover:bg-stone-50/60"
                        }`}
                      >
                        {/* Customer & Boat Info */}
                        <div className="flex items-start gap-3.5 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              isOnWater
                                ? "bg-teal-100 text-teal-800 ring-2 ring-teal-400/40"
                                : isWaiting
                                ? "bg-amber-100 text-amber-800"
                                : "bg-stone-100 text-charcoal-600"
                            }`}
                          >
                            <Ship size={20} />
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-charcoal-900 truncate">
                                {b.customer_name}
                              </span>
                              <span className="text-xs text-charcoal-400 font-mono">
                                #{b.boat_booking_id}
                              </span>

                              {b.is_addon && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-200/60">
                                  <BedDouble size={11} />
                                  บัตรเสริมที่พัก
                                </span>
                              )}

                              {/* Status Badge */}
                              {isWaiting && (
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200/80">
                                  ⏳ รอมารายงานตัว
                                </span>
                              )}
                              {isOnWater && (
                                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200/80 flex items-center gap-1 animate-pulse">
                                  <Waves size={12} />
                                  กำลังพายอยู่ในน้ำ
                                </span>
                              )}
                              {isCheckedOut && (
                                <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-stone-100 text-charcoal-600">
                                  ✓ คืนเรือเรียบร้อย
                                </span>
                              )}
                            </div>

                            {/* Contact & Boat breakdown */}
                            <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-charcoal-500">
                              {b.customer_phone ? (
                                <a
                                  href={`tel:${b.customer_phone}`}
                                  className="inline-flex items-center gap-1 text-forest-700 hover:underline font-medium"
                                >
                                  <Phone size={12} />
                                  <span>{b.customer_phone}</span>
                                </a>
                              ) : (
                                <span className="text-charcoal-400">ไม่มีเบอร์โทร</span>
                              )}

                              <span className="text-stone-300">•</span>

                              <div className="flex flex-wrap items-center gap-1.5 font-medium text-charcoal-700">
                                {(b.boats || []).map((boat, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded-md bg-stone-100 text-charcoal-800 text-[11px]"
                                  >
                                    {boat.boat_type_name}: <b>{boat.boat_count}</b> ลำ ({boat.num_passengers} คน)
                                  </span>
                                ))}
                              </div>
                            </div>

                            {/* Timestamp Details */}
                            <div className="text-[11px] text-charcoal-400 flex flex-wrap items-center gap-3 pt-0.5">
                              {b.checkin_at && (
                                <span className="text-teal-700 font-medium">
                                  ลงน้ำเวลา:{" "}
                                  {new Date(b.checkin_at).toLocaleTimeString("th-TH", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}{" "}
                                  น.
                                </span>
                              )}
                              {b.checkout_at && (
                                <span>
                                  คืนเรือเวลา:{" "}
                                  {new Date(b.checkout_at).toLocaleTimeString("th-TH", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}{" "}
                                  น.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-stone-100 justify-end">
                          {isWaiting && (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmModal({
                                  open: true,
                                  type: "checkin",
                                  bookingId: b.boat_booking_id,
                                  title: `ยืนยันการปล่อยเรือ (รหัส #${b.boat_booking_id})`,
                                  description: `คุณ ${b.customer_name} มารายงานตัวและรับชูชีพพร้อมลงเรือแล้วหรือไม่?`,
                                });
                              }}
                              disabled={actionLoadingId === b.boat_booking_id}
                              className="px-3.5 py-2 rounded-xl bg-forest-800 text-cream-100 hover:bg-forest-900 text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                            >
                              <Ship size={14} />
                              <span>ปล่อยเรือลงน้ำ (Check-in)</span>
                            </button>
                          )}

                          {isOnWater && (
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmModal({
                                  open: true,
                                  type: "checkout",
                                  bookingId: b.boat_booking_id,
                                  title: `ยืนยันการรับคืนเรือ (รหัส #${b.boat_booking_id})`,
                                  description: `ตรวจสอบเรือและอุปกรณ์ชูชีพของคุณ ${b.customer_name} ครบถ้วนแล้วหรือไม่?`,
                                });
                              }}
                              disabled={actionLoadingId === b.boat_booking_id}
                              className="px-3.5 py-2 rounded-xl bg-teal-700 text-white hover:bg-teal-800 text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                            >
                              <CheckCircle2 size={14} />
                              <span>รับคืนเรือ (Check-out)</span>
                            </button>
                          )}

                          {isCheckedOut && (
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60 inline-flex items-center gap-1">
                              <CheckCircle2 size={13} />
                              <span>เสร็จสิ้น</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  confirmModal.type === "checkin"
                    ? "bg-forest-100 text-forest-800"
                    : "bg-teal-100 text-teal-800"
                }`}
              >
                {confirmModal.type === "checkin" ? <Ship size={20} /> : <CheckCircle2 size={20} />}
              </div>
              <h3 className="font-bold text-base text-charcoal-900">{confirmModal.title}</h3>
            </div>

            <p className="text-xs sm:text-sm text-charcoal-600 leading-relaxed">
              {confirmModal.description}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
                disabled={actionLoadingId !== null}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-charcoal-600 hover:bg-stone-100 transition-colors"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={() => {
                  if (confirmModal.bookingId) {
                    if (confirmModal.type === "checkin") {
                      handleCheckin(confirmModal.bookingId);
                    } else {
                      handleCheckout(confirmModal.bookingId);
                    }
                  }
                }}
                disabled={actionLoadingId !== null}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm transition-all ${
                  confirmModal.type === "checkin"
                    ? "bg-forest-800 hover:bg-forest-900"
                    : "bg-teal-700 hover:bg-teal-800"
                }`}
              >
                {actionLoadingId !== null ? "กำลังบันทึก..." : "ยืนยันดำเนินการ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BoatCheckinPage(): React.ReactElement {
  return (
    <Suspense fallback={<div className="p-8 text-center text-charcoal-400">กำลังโหลด...</div>}>
      <BoatCheckinContent />
    </Suspense>
  );
}
