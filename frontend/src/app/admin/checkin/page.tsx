"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  LogIn,
  LogOut,
  Search,
  RefreshCw,
  Phone,
  BedDouble,
  AlertTriangle,
  CalendarCheck,
  Home,
  X,
  Users,
  MessageSquare,
  Clock,
  Settings,
  Save,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast, { Toaster } from "react-hot-toast";

interface RoomLine {
  booking_room_id: number;
  room_id: number;
  room_number: string;
  room_name: string;
  type_name?: string;
  status: string;
  checkin_at: string | null;
  checkout_at: string | null;
}

interface BookingRow {
  room_booking_id: number;
  id: number;
  check_in: string;
  check_out: string;
  status: string;
  user_name: string;
  user_phone: string;
  adults?: number;
  children?: number;
  child_ages?: number[];
  special_request?: string | null;
  rooms: RoomLine[];
}

interface FlatLine extends RoomLine {
  room_booking_id: number;
  check_in: string;
  check_out: string;
  user_name: string;
  user_phone: string;
  adults?: number;
  children?: number;
  child_ages?: number[];
  special_request?: string | null;
}

const toLocalISODate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// แปลง ISO date string เป็นวันที่ตามเวลาท้องถิ่น (ห้าม slice(0,10) ตรงๆ เพราะค่าที่เก็บเป็น UTC midnight
// ของวันที่ตามเวลาไทย ทำให้ slice ได้วันก่อนหน้าเมื่อ UTC offset ทำให้เวลาถอยไปอีกวัน)
const localDateStr = (iso?: string | null): string => (iso ? toLocalISODate(new Date(iso)) : "");

const formatThaiDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "2-digit",
      })
    : "-";

const formatGuestSummary = (line: FlatLine): string => {
  const adults = line.adults ?? 0;
  const children = line.children ?? 0;
  const ages = Array.isArray(line.child_ages) ? line.child_ages : [];
  let text = `ผู้ใหญ่ ${adults}`;
  if (children > 0) {
    text += ` • เด็ก ${children}`;
    if (ages.length > 0) {
      text += ` (อายุ ${ages.join(", ")} ปี)`;
    }
  }
  return text;
};

// แปลงเวลา "HH:MM" เป็นนาทีในหนึ่งวัน สำหรับเทียบช่วงเวลาเช็คอิน
const timeToMinutes = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

function AdminCheckinContent() {
  const { ready } = useAuthGuard({ allowedRoles: ["admin", "room_staff"] });
  const searchParams = useSearchParams();

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [arrivalFilter, setArrivalFilter] = useState<"today" | "tomorrow" | "all">("today");

  const [checkinFrom, setCheckinFrom] = useState("14:00");
  const [checkinTo, setCheckinTo] = useState("23:00");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({ from: "14:00", to: "23:00" });
  const [savingSettings, setSavingSettings] = useState(false);

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    text: string;
    confirmText: string;
    confirmColor: string;
    onConfirm: () => void;
  } | null>(null);

  const today = toLocalISODate(new Date());
  const tomorrow = toLocalISODate(new Date(Date.now() + 86400000));

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get("/bookings");
      setBookings(res.data?.data || []);
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลการจองได้");
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await api.get("/settings/resort", { params: { id: 4 } });
      const data = res.data?.data;
      if (data?.checkin_time_from) setCheckinFrom(data.checkin_time_from.slice(0, 5));
      if (data?.checkin_time_to) setCheckinTo(data.checkin_time_to.slice(0, 5));
    } catch {
      // ใช้ค่า default ถ้าโหลดไม่สำเร็จ
    }
  };

  useEffect(() => {
    if (!ready) return;
    fetchBookings();
    fetchSettings();
  }, [ready]);

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await api.put("/settings/resort", {
        id: 4,
        checkin_time_from: settingsDraft.from,
        checkin_time_to: settingsDraft.to,
      });
      setCheckinFrom(settingsDraft.from);
      setCheckinTo(settingsDraft.to);
      setSettingsOpen(false);
      toast.success("บันทึกช่วงเวลาเช็คอินแล้ว");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSavingSettings(false);
    }
  };

  // แตกรายการเป็นระดับ "ห้อง" (booking_room) พร้อมข้อมูลหัวการจอง — เฉพาะบิลที่อนุมัติแล้วเท่านั้น
  const allLines: FlatLine[] = useMemo(() => {
    const lines: FlatLine[] = [];
    bookings.forEach((b) => {
      if (b.status !== "approved" || !Array.isArray(b.rooms)) return;
      b.rooms.forEach((line) => {
        lines.push({
          ...line,
          room_booking_id: b.room_booking_id || b.id,
          check_in: b.check_in,
          check_out: b.check_out,
          user_name: b.user_name,
          user_phone: b.user_phone,
          adults: b.adults,
          children: b.children,
          child_ages: b.child_ages,
          special_request: b.special_request,
        });
      });
    });
    return lines;
  }, [bookings]);

  const matchesSearch = (line: FlatLine) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase().trim();
    return (
      String(line.user_name || "").toLowerCase().includes(q) ||
      String(line.user_phone || "").toLowerCase().includes(q) ||
      String(line.room_number || "").toLowerCase().includes(q) ||
      String(line.room_name || "").toLowerCase().includes(q)
    );
  };

  const arrivals = useMemo(() => {
    return allLines
      .filter((l) => l.status === "approved")
      .filter((l) => {
        if (arrivalFilter === "today") return localDateStr(l.check_in) === today;
        if (arrivalFilter === "tomorrow") return localDateStr(l.check_in) === tomorrow;
        return true;
      })
      .filter(matchesSearch)
      .sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime());
  }, [allLines, arrivalFilter, search, today, tomorrow]);

  const inHouse = useMemo(() => {
    return allLines
      .filter((l) => l.status === "checked_in")
      .filter(matchesSearch)
      .sort((a, b) => new Date(a.check_out).getTime() - new Date(b.check_out).getTime());
  }, [allLines, search]);

  const counts = useMemo(() => {
    const arrivalsToday = allLines.filter(
      (l) => l.status === "approved" && localDateStr(l.check_in) === today,
    ).length;
    const inHouseAll = allLines.filter((l) => l.status === "checked_in");
    const departingToday = inHouseAll.filter((l) => localDateStr(l.check_out) === today).length;
    const overdue = inHouseAll.filter((l) => localDateStr(l.check_out) < today).length;
    return {
      arrivalsToday,
      inHouse: inHouseAll.length,
      departingToday,
      overdue,
    };
  }, [allLines, today]);

  // เช็คอินได้จริงเฉพาะวันนี้/พรุ่งนี้เท่านั้น (กันพนักงานกดเช็คอินล่วงหน้าไกลเกินไปโดยไม่ตั้งใจ)
  // แท็บ "ทั้งหมด" ใช้ดูล่วงหน้าอย่างเดียว ยกเว้นรายการที่ใกล้ถึงวันจริงแล้ว (วันนี้/พรุ่งนี้) ถึงจะกดเช็คอินได้
  const isCheckinActionable = (line: FlatLine) => {
    const d = localDateStr(line.check_in);
    return d === today || d === tomorrow;
  };

  // นอกเวลาเช็คอินปกติไหม (เทียบเฉพาะกรณีเช็คอินวันนี้ — ไม่เตือนถ้าเป็นการเช็คอินให้ล่วงหน้า/พรุ่งนี้)
  const isOutsideCheckinWindow = (line: FlatLine): boolean => {
    if (localDateStr(line.check_in) !== today) return false;
    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return nowMinutes < timeToMinutes(checkinFrom) || nowMinutes > timeToMinutes(checkinTo);
  };

  const handleCheckin = (line: FlatLine) => {
    const outsideWindow = isOutsideCheckinWindow(line);
    setConfirmModal({
      open: true,
      title: `ยืนยันเช็คอินห้อง #${line.room_number}?`,
      text: outsideWindow
        ? `${line.user_name || "ลูกค้า"} — ${line.room_name} — ⚠️ ตอนนี้อยู่นอกเวลาเช็คอินปกติ (${checkinFrom}-${checkinTo} น.) ยืนยันว่าอนุญาตให้เช็คอินได้`
        : `${line.user_name || "ลูกค้า"} — ${line.room_name} — ยืนยันว่าลูกค้ามาถึงและรับกุญแจห้องนี้แล้ว`,
      confirmText: "เช็คอิน",
      confirmColor: outsideWindow ? "bg-amber-600" : "bg-[#0b3b2c]",
      onConfirm: async () => {
        try {
          await api.put(`/bookings/booking-rooms/${line.booking_room_id}/checkin`);
          toast.success("เช็คอินสำเร็จ");
          fetchBookings();
        } catch (err: any) {
          toast.error(err.response?.data?.message || "เช็คอินไม่สำเร็จ");
        }
      },
    });
  };

  const handleCheckout = (line: FlatLine) => {
    setConfirmModal({
      open: true,
      title: `ยืนยันเช็คเอาต์ห้อง #${line.room_number}?`,
      text: `${line.user_name || "ลูกค้า"} — ${line.room_name} — คืนสถานะห้องนี้เป็นว่าง`,
      confirmText: "เช็คเอาต์",
      confirmColor: "bg-emerald-700",
      onConfirm: async () => {
        try {
          await api.put(`/bookings/booking-rooms/${line.booking_room_id}/checkout`);
          toast.success("เช็คเอาต์สำเร็จ");
          fetchBookings();
        } catch (err: any) {
          toast.error(err.response?.data?.message || "เช็คเอาต์ไม่สำเร็จ");
        }
      },
    });
  };

  if (!ready) return null;

  return (
    <div className="w-full min-h-screen flex flex-col font-sans space-y-4 pb-10">
      <Toaster position="top-right" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200/60">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-[#0b3b2c] tracking-tight">
              เช็คอิน-เช็คเอาต์
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#0b3b2c]/10 text-[#0b3b2c]">
              Staff
            </span>
          </div>
          <p className="text-stone-500 mt-1 text-xs md:text-sm">
            หน้าเคาน์เตอร์สำหรับรับเช็คอินและคืนกุญแจเช็คเอาต์ผู้เข้าพัก
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => {
                setSettingsDraft({ from: checkinFrom, to: checkinTo });
                setSettingsOpen((v) => !v);
              }}
              className="px-3.5 py-2 text-stone-700 bg-white hover:bg-stone-100/80 rounded-xl border border-stone-200 shadow-xs transition-all text-xs font-medium flex items-center gap-2 active:scale-95"
              title="ตั้งค่าช่วงเวลาเช็คอิน"
            >
              <Clock size={14} className="text-stone-500" />
              <span>{checkinFrom}-{checkinTo} น.</span>
              <Settings size={12} className="text-stone-400" />
            </button>
            {settingsOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-stone-200 rounded-2xl shadow-xl z-50 p-4">
                <p className="text-xs font-bold text-stone-700 mb-3">ช่วงเวลาเช็คอินปกติ</p>
                <p className="text-[10.5px] text-stone-400 mb-3">
                  ใช้แสดงเตือนเฉยๆ ไม่ได้ปิดกั้นการเช็คอิน พนักงานยังยืนยันเช็คอินนอกเวลาได้ตามดุลยพินิจ
                </p>
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="time"
                    value={settingsDraft.from}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, from: e.target.value }))}
                    className="w-full px-2 py-1.5 rounded-lg border border-stone-200 text-xs"
                  />
                  <span className="text-stone-300">–</span>
                  <input
                    type="time"
                    value={settingsDraft.to}
                    onChange={(e) => setSettingsDraft((s) => ({ ...s, to: e.target.value }))}
                    className="w-full px-2 py-1.5 rounded-lg border border-stone-200 text-xs"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setSettingsOpen(false)}
                    className="px-3 py-1.5 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200/80 rounded-lg transition-colors"
                  >
                    ยกเลิก
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0b3b2c] hover:bg-[#0b3b2c]/90 rounded-lg transition-colors disabled:opacity-60"
                  >
                    <Save size={12} />
                    บันทึก
                  </button>
                </div>
              </div>
            )}
          </div>
          <button
            onClick={fetchBookings}
            className="px-3.5 py-2 text-stone-700 bg-white hover:bg-stone-100/80 rounded-xl border border-stone-200 shadow-xs transition-all text-xs font-medium flex items-center gap-2 active:scale-95"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-[#0b3b2c]" : "text-stone-500"} />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "มาถึงวันนี้", count: counts.arrivalsToday, icon: <LogIn size={15} />, color: "text-[#0b3b2c]", bg: "bg-[#0b3b2c]/10", border: "border-[#0b3b2c]/20", bar: "bg-[#0b3b2c]" },
          { label: "กำลังพักอยู่", count: counts.inHouse, icon: <Home size={15} />, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-100", bar: "bg-indigo-500" },
          { label: "ออกวันนี้", count: counts.departingToday, icon: <LogOut size={15} />, color: "text-teal-600", bg: "bg-teal-50", border: "border-teal-100", bar: "bg-teal-500" },
          { label: "เลยกำหนดออก", count: counts.overdue, icon: <AlertTriangle size={15} />, color: "text-rose-600", bg: "bg-rose-50", border: "border-rose-100", bar: "bg-rose-500" },
        ].map((c) => (
          <div key={c.label} className="bg-white pl-3 pr-2.5 py-2.5 rounded-xl border border-stone-200/80 shadow-xs relative overflow-hidden">
            <span className={`absolute left-0 top-0 bottom-0 w-1 ${c.bar}`} />
            <div className="flex items-center justify-between gap-2 relative pl-1">
              <div className="min-w-0">
                <span className="text-[10.5px] font-medium text-stone-500 leading-tight block truncate">{c.label}</span>
                <p className={`text-lg font-extrabold tracking-tight font-mono leading-tight ${c.color}`}>{c.count}</p>
              </div>
              <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${c.bg} ${c.border} ${c.color}`}>
                {c.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full sm:w-80">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
        <input
          type="text"
          placeholder="ค้นหาชื่อ, เบอร์โทร, หมายเลขห้อง..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-white pl-9 pr-8 py-2 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 text-xs font-medium text-stone-800 placeholder:text-stone-400 transition-all shadow-xs"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 rounded-full"
          >
            <X size={14} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Arrivals */}
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
            <h2 className="font-bold text-stone-800 text-sm flex items-center gap-2">
              <LogIn size={16} className="text-[#0b3b2c]" />
              รอเช็คอิน
            </h2>
            <div className="flex items-center gap-1">
              {(
                [
                  ["today", "วันนี้"],
                  ["tomorrow", "พรุ่งนี้"],
                  ["all", "ทั้งหมด"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setArrivalFilter(key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    arrivalFilter === key
                      ? "bg-[#0b3b2c] text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200/70"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-stone-100 max-h-[650px] overflow-y-auto">
            {loading ? (
              <div className="py-16 flex justify-center">
                <RefreshCw size={24} className="animate-spin text-[#0b3b2c]" />
              </div>
            ) : arrivals.length === 0 ? (
              <div className="py-16 text-center text-stone-400 text-sm">ไม่มีรายการรอเช็คอิน</div>
            ) : (
              arrivals.map((line) => {
                const actionable = isCheckinActionable(line);
                const outsideWindow = actionable && isOutsideCheckinWindow(line);
                return (
                  <div key={line.booking_room_id} className="flex items-start justify-between gap-3 px-4 py-3.5 hover:bg-stone-50/80 transition-colors">
                    <div className="min-w-0 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200/60 flex items-center justify-center text-stone-500 shrink-0 font-bold text-xs mt-0.5">
                        {(line.user_name || "U")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-800 text-sm truncate">{line.user_name || "ไม่ระบุชื่อ"}</p>
                        <p className="text-[11px] text-stone-500 flex items-center gap-1">
                          <Phone size={10} />
                          {line.user_phone || "-"}
                        </p>
                        <p className="text-[11px] text-stone-600 flex items-center gap-1 mt-0.5 flex-wrap">
                          <BedDouble size={11} className="text-stone-400" />
                          {line.room_name} #{line.room_number}
                          <span className="text-stone-300">•</span>
                          <span className="font-mono">{formatThaiDate(line.check_in)} → {formatThaiDate(line.check_out)}</span>
                        </p>
                        <p className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                          <Users size={11} className="text-stone-400" />
                          {formatGuestSummary(line)}
                        </p>
                        {line.special_request && (
                          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/70 rounded-md px-2 py-1 mt-1 flex items-start gap-1 max-w-md">
                            <MessageSquare size={11} className="shrink-0 mt-0.5" />
                            <span>{line.special_request}</span>
                          </p>
                        )}
                        {outsideWindow && (
                          <p className="text-[10.5px] text-amber-600 font-semibold flex items-center gap-1 mt-1">
                            <Clock size={10} /> นอกเวลาเช็คอินปกติ ({checkinFrom}-{checkinTo} น.)
                          </p>
                        )}
                      </div>
                    </div>
                    {actionable ? (
                      <button
                        onClick={() => handleCheckin(line)}
                        className={`inline-flex items-center gap-1.5 text-xs text-white font-semibold px-3.5 py-2 rounded-xl shadow-xs transition-all active:scale-95 shrink-0 ${
                          outsideWindow ? "bg-amber-600 hover:bg-amber-700" : "bg-[#0b3b2c] hover:bg-[#0b3b2c]/90"
                        }`}
                      >
                        <LogIn size={13} />
                        <span>เช็คอิน</span>
                      </button>
                    ) : (
                      <span className="text-[10.5px] text-stone-400 italic shrink-0 mt-1.5">
                        รอถึงวันที่ {formatThaiDate(line.check_in)}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* In-house */}
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
            <h2 className="font-bold text-stone-800 text-sm flex items-center gap-2">
              <Home size={16} className="text-indigo-600" />
              กำลังพักอยู่ในรีสอร์ท
            </h2>
          </div>

          <div className="divide-y divide-stone-100 max-h-[650px] overflow-y-auto">
            {loading ? (
              <div className="py-16 flex justify-center">
                <RefreshCw size={24} className="animate-spin text-[#0b3b2c]" />
              </div>
            ) : inHouse.length === 0 ? (
              <div className="py-16 text-center text-stone-400 text-sm">ไม่มีผู้เข้าพักในขณะนี้</div>
            ) : (
              inHouse.map((line) => {
                const isToday = localDateStr(line.check_out) === today;
                const isOverdue = localDateStr(line.check_out) < today;
                return (
                  <div key={line.booking_room_id} className="flex items-start justify-between gap-3 px-4 py-3.5 hover:bg-stone-50/80 transition-colors">
                    <div className="min-w-0 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-full bg-stone-100 border border-stone-200/60 flex items-center justify-center text-stone-500 shrink-0 font-bold text-xs mt-0.5">
                        {(line.user_name || "U")[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-stone-800 text-sm truncate">{line.user_name || "ไม่ระบุชื่อ"}</p>
                        <p className="text-[11px] text-stone-500 flex items-center gap-1">
                          <Phone size={10} />
                          {line.user_phone || "-"}
                        </p>
                        <p className="text-[11px] text-stone-600 flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <BedDouble size={11} className="text-stone-400" />
                          {line.room_name} #{line.room_number}
                          {isOverdue ? (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-semibold bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md">
                              <AlertTriangle size={10} /> เลยกำหนดออก {formatThaiDate(line.check_out)}
                            </span>
                          ) : isToday ? (
                            <span className="inline-flex items-center gap-1 text-teal-700 font-semibold bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded-md">
                              <CalendarCheck size={10} /> ออกวันนี้
                            </span>
                          ) : (
                            <span className="font-mono text-stone-500">ออก {formatThaiDate(line.check_out)}</span>
                          )}
                        </p>
                        <p className="text-[11px] text-stone-500 flex items-center gap-1 mt-0.5">
                          <Users size={11} className="text-stone-400" />
                          {formatGuestSummary(line)}
                        </p>
                        {line.special_request && (
                          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200/70 rounded-md px-2 py-1 mt-1 flex items-start gap-1 max-w-md">
                            <MessageSquare size={11} className="shrink-0 mt-0.5" />
                            <span>{line.special_request}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleCheckout(line)}
                      className="inline-flex items-center gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-3.5 py-2 rounded-xl shadow-xs transition-all active:scale-95 shrink-0"
                    >
                      <LogOut size={13} />
                      <span>เช็คเอาต์</span>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {confirmModal?.open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="font-bold text-stone-800 text-base mb-2">{confirmModal.title}</h3>
            <p className="text-sm text-stone-500 mb-5">{confirmModal.text}</p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200/80 rounded-xl transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className={`px-4 py-2 text-xs font-semibold text-white rounded-xl transition-colors ${confirmModal.confirmColor}`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminCheckinPage() {
  return (
    <Suspense fallback={null}>
      <AdminCheckinContent />
    </Suspense>
  );
}
