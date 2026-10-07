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
  Printer,
  Ship,
  Check,
  Copy,
  Calendar,
  Sparkles,
  KeyRound,
  ShieldCheck,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { PageHeader, Modal } from "@/components/admin/ui";

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

interface BoatAddon {
  boat_booking_id: number;
  booking_room_id: number;
  boat_type_name: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  boat_count: number;
  num_passengers: number;
  mode: "free" | "paid";
  price: number;
  status: string;
  printed_at: string | null;
  handed_out_at: string | null;
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
  arrival_time?: string | null;
  rooms: RoomLine[];
  boat_addons?: BoatAddon[];
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
  arrival_time?: string | null;
  boat_addons: BoatAddon[];
}

import {
  formatThaiDateShort as formatThaiDate,
  formatThaiDateLong,
  formatThaiTime,
  toISODate as toBangkokISODate,
  toUTCISOString,
  nightsBetween as calculateNights,
  BANGKOK_TIMEZONE,
} from "@/lib/date";

// แปลง ISO string จากฐานข้อมูล/API เป็นวันที่ YYYY-MM-DD ตามเวลาไทย
const localDateStr = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : toBangkokISODate(d);
};

// คำนวณนาทีของเวลาปัจจุบันในเขตเวลาไทย (0-1439 นาที)
const getBangkokCurrentMinutes = (d: Date = new Date()): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BANGKOK_TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find((p) => p.type === "hour")?.value || 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value || 0);
  return h * 60 + m;
};

// สกัดเวลาที่คาดว่าจะถึงออกจาก special_request (หน้าจองฝังไว้เป็น "[Arrival: HH:MM] ...")
const parseSpecialRequest = (
  raw?: string | null,
): { arrivalTime: string | null; note: string | null } => {
  if (!raw) return { arrivalTime: null, note: null };
  const match = raw.match(/^\[Arrival:\s*([\d:]+)\]\s*(.*)$/);
  if (!match) {
    const trimmed = raw.trim();
    return { arrivalTime: null, note: trimmed || null };
  }
  const note = match[2].trim();
  return {
    arrivalTime: match[1] || null,
    note: note && note !== "ไม่มีคำขอพิเศษ" ? note : null,
  };
};

const formatGuestSummary = (line: FlatLine): string => {
  const adults = line.adults ?? 0;
  const children = line.children ?? 0;
  const ages = Array.isArray(line.child_ages) ? line.child_ages : [];
  let text = `ผู้ใหญ่ ${adults} ท่าน`;
  if (children > 0) {
    text += ` • เด็ก ${children} ท่าน`;
    if (ages.length > 0) {
      text += ` (${ages.join(", ")} ขวบ)`;
    }
  }
  return text;
};

// แปลงเวลา "HH:MM" เป็นนาทีในหนึ่งวัน
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
  const [inHouseFilter, setInHouseFilter] = useState<"all" | "today" | "overdue">("all");
  const [mobileTab, setMobileTab] = useState<"arrivals" | "inhouse">("arrivals");

  const [checkinFrom, setCheckinFrom] = useState("14:00");
  const [checkinTo, setCheckinTo] = useState("23:00");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({ from: "14:00", to: "23:00" });
  const [savingSettings, setSavingSettings] = useState(false);

  // Live time for header
  const [currentTime, setCurrentTime] = useState<Date | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    line: FlatLine;
    isCheckout?: boolean;
    outsideWindow?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const today = useMemo(() => toBangkokISODate(new Date()), [currentTime]);
  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return toBangkokISODate(d);
  }, [currentTime]);

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get("/bookings");
      setBookings(res.data?.data || []);
    } catch {
      notify.error("ไม่สามารถโหลดข้อมูลการจองได้");
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
      // ใช้ค่า default
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
      notify.success("บันทึกช่วงเวลาเช็คอินแล้ว");
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "บันทึกไม่สำเร็จ"));
    } finally {
      setSavingSettings(false);
    }
  };

  // ตรวจสอบว่าขณะนี้อยู่ในเวลาเช็คอินปกติหรือไม่ (อิงเวลาไทย Asia/Bangkok)
  const isCurrentlyInCheckinHours = useMemo(() => {
    if (!currentTime) return true;
    const nowMinutes = getBangkokCurrentMinutes(currentTime);
    return nowMinutes >= timeToMinutes(checkinFrom) && nowMinutes <= timeToMinutes(checkinTo);
  }, [currentTime, checkinFrom, checkinTo]);

  // แตกรายการเป็นระดับ "ห้อง" (booking_room)
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
          arrival_time: b.arrival_time,
          boat_addons: (b.boat_addons || []).filter(
            (a) => a.booking_room_id === line.booking_room_id && a.status !== "cancelled",
          ),
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
      String(line.room_name || "").toLowerCase().includes(q) ||
      String(line.special_request || "").toLowerCase().includes(q)
    );
  };

  const rawArrivals = useMemo(() => {
    return allLines.filter((l) => l.status === "approved");
  }, [allLines]);

  const arrivals = useMemo(() => {
    return rawArrivals
      .filter((l) => {
        if (arrivalFilter === "today") return localDateStr(l.check_in) === today;
        if (arrivalFilter === "tomorrow") return localDateStr(l.check_in) === tomorrow;
        return true;
      })
      .filter(matchesSearch)
      .sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime());
  }, [rawArrivals, arrivalFilter, search, today, tomorrow]);

  const inHouse = useMemo(() => {
    return allLines
      .filter((l) => l.status === "checked_in")
      .filter((l) => {
        if (inHouseFilter === "today") return localDateStr(l.check_out) === today;
        if (inHouseFilter === "overdue") return localDateStr(l.check_out) < today;
        return true;
      })
      .filter(matchesSearch)
      .sort((a, b) => new Date(a.check_out).getTime() - new Date(b.check_out).getTime());
  }, [allLines, inHouseFilter, search, today]);

  const counts = useMemo(() => {
    const arrivalsToday = allLines.filter(
      (l) => l.status === "approved" && localDateStr(l.check_in) === today,
    ).length;
    const arrivalsTomorrow = allLines.filter(
      (l) => l.status === "approved" && localDateStr(l.check_in) === tomorrow,
    ).length;
    const arrivalsAll = rawArrivals.length;

    const inHouseAll = allLines.filter((l) => l.status === "checked_in");
    const departingToday = inHouseAll.filter((l) => localDateStr(l.check_out) === today).length;
    const overdue = inHouseAll.filter((l) => localDateStr(l.check_out) < today).length;
    return {
      arrivalsToday,
      arrivalsTomorrow,
      arrivalsAll,
      inHouse: inHouseAll.length,
      departingToday,
      overdue,
    };
  }, [allLines, rawArrivals.length, today, tomorrow]);

  const isCheckinActionable = (line: FlatLine) => {
    const d = localDateStr(line.check_in);
    return d === today || d === tomorrow;
  };

  const isOutsideCheckinWindow = (line: FlatLine): boolean => {
    if (localDateStr(line.check_in) !== today) return false;
    if (!currentTime) return false;
    const nowMinutes = getBangkokCurrentMinutes(currentTime);
    return nowMinutes < timeToMinutes(checkinFrom) || nowMinutes > timeToMinutes(checkinTo);
  };

  const handleCopyPhone = (phone: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!phone) return;
    navigator.clipboard.writeText(phone);
    notify.success(`คัดลอกเบอร์ ${phone} แล้ว`);
  };

  const handleCheckin = (line: FlatLine) => {
    const outsideWindow = isOutsideCheckinWindow(line);
    setConfirmModal({
      open: true,
      title: `ยืนยันการเช็คอินห้อง #${line.room_number}`,
      line,
      outsideWindow,
      isCheckout: false,
      onConfirm: async () => {
        try {
          await api.put(`/bookings/booking-rooms/${line.booking_room_id}/checkin`);
          notify.success(`เช็คอินห้อง #${line.room_number} เรียบร้อยแล้ว`);
          fetchBookings();
        } catch (err: unknown) {
          notify.error(getApiErrorMessage(err, "เช็คอินไม่สำเร็จ"));
        }
      },
    });
  };

  const handleCheckout = (line: FlatLine) => {
    setConfirmModal({
      open: true,
      title: `ยืนยันการเช็คเอาต์ห้อง #${line.room_number}`,
      line,
      isCheckout: true,
      onConfirm: async () => {
        try {
          await api.put(`/bookings/booking-rooms/${line.booking_room_id}/checkout`);
          notify.success(`เช็คเอาต์ห้อง #${line.room_number} และคืนสถานะห้องว่างแล้ว`);
          fetchBookings();
        } catch (err: unknown) {
          notify.error(getApiErrorMessage(err, "เช็คเอาต์ไม่สำเร็จ"));
        }
      },
    });
  };

  const printAddonTicket = (addon: BoatAddon, line: FlatLine) => {
    const w = window.open("", "_blank", "width=440,height=680");
    if (!w) return;
    const esc = (value: unknown): string =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    w.document.write(`<!DOCTYPE html><html><head><title>บัตรกิจกรรมเรือพาย - ${esc(line.room_name)} #${esc(line.room_number)}</title>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Sarabun', 'Segoe UI', sans-serif; padding: 28px; color: #1c1c1c; background: #fff; }
        .ticket-header { border-bottom: 2px solid #123C30; padding-bottom: 12px; margin-bottom: 16px; }
        h1 { font-size: 20px; margin: 0 0 4px; color: #123C30; font-weight: 700; }
        .sub { font-size: 12px; color: #666; margin: 0; }
        .box { border: 2px dashed #366F5A; border-radius: 12px; padding: 16px; background: #FDFCF7; }
        .row { margin: 10px 0; display: flex; justify-content: space-between; }
        .label { font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: .03em; }
        .value { font-size: 14px; font-weight: 700; color: #123C30; }
        .badge { display: inline-block; background: #E8F0ED; color: #123C30; font-size: 11px; padding: 3px 8px; border-radius: 6px; font-weight: 600; }
        .rules-box { margin-top: 20px; padding: 12px 14px; background: #FAF6EC; border-radius: 10px; border-left: 4px solid #C48A3F; }
        .rules-title { font-size: 12px; font-weight: 700; margin: 0 0 6px; color: #6B461E; }
        ul { font-size: 11px; color: #555; padding-left: 18px; margin: 0; line-height: 1.6; }
        .footer { margin-top: 24px; font-size: 10px; color: #999; text-align: center; border-top: 1px dotted #ccc; padding-top: 10px; }
      </style>
      </head><body>
        <div class="ticket-header">
          <h1>บัตรกิจกรรมเรือพาย</h1>
          <p class="sub">สวนวลัยรุกขเวช (Walai Floating Resort) • โปรดยื่นบัตรนี้ที่ท่าเรือ</p>
        </div>
        <div class="box">
          <div class="row"><div class="label">ผู้จอง / ลูกค้า</div><div class="value">${esc(line.user_name || "-")}</div></div>
          <div class="row"><div class="label">ห้องพัก</div><div class="value"><span class="badge">#${esc(line.room_number)} ${esc(line.room_name)}</span></div></div>
          <div class="row"><div class="label">ประเภทเรือ</div><div class="value">${esc(addon.boat_type_name)}</div></div>
          <div class="row"><div class="label">รอบวัน / เวลา</div><div class="value">${formatThaiDate(String(addon.booking_date).slice(0, 10))} · ${String(addon.start_time).slice(0, 5)} - ${String(addon.end_time).slice(0, 5)} น.</div></div>
          <div class="row"><div class="label">จำนวนเรือ / ผู้โดยสาร</div><div class="value">${addon.boat_count} ลำ (${addon.num_passengers} ท่าน)</div></div>
          <div class="row"><div class="label">ประเภทสิทธิ์</div><div class="value">${addon.mode === "paid" ? `บริการเสริม (฿${Number(addon.price).toLocaleString()})` : "ฟรี (แพ็กเกจห้องพัก)"}</div></div>
        </div>
        <div class="rules-box">
          <div class="rules-title">ข้อปฏิบัติความปลอดภัย</div>
          <ul>
            <li>กรุณาสวมเสื้อชูชีพตลอดเวลาขณะอยู่บนเรือ</li>
            <li>มาถึงท่าเรือก่อนเวลารอบ 10-15 นาทีเพื่อรับคำแนะนำความปลอดภัย</li>
            <li>ห้ามนำเครื่องดื่มแอลกอฮอล์ขึ้นบนเรือ</li>
          </ul>
        </div>
        <p class="footer">พิมพ์จากระบบฟรอนต์ • ${new Date().toLocaleString("th-TH")}</p>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const handlePrintAndHandOut = async (addon: BoatAddon, line: FlatLine) => {
    printAddonTicket(addon, line);
    try {
      await api.put(`/kayaks/room-addon/${addon.boat_booking_id}/hand-out`);
      notify.success("มอบบัตรเสริมเรือแล้ว");
      fetchBookings();
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "บันทึกการมอบบัตรไม่สำเร็จ"));
    }
  };

  const renderBoatAddons = (line: FlatLine) => {
    if (!line.boat_addons || line.boat_addons.length === 0) return null;
    return (
      <div className="mt-2 space-y-1.5">
        {line.boat_addons.map((addon) => (
          <div
            key={addon.boat_booking_id}
            className="flex items-center justify-between gap-2 text-xs bg-gradient-to-r from-lagoon-50/80 to-cream-100 border border-lagoon-200/80 rounded-xl px-3 py-1.5 shadow-xs"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-5 h-5 rounded-lg bg-lagoon-100 text-lagoon-700 flex items-center justify-center shrink-0">
                <Ship size={12} />
              </span>
              <span className="font-medium text-lagoon-900 truncate">
                {addon.boat_type_name} <span className="text-lagoon-600 font-normal">({addon.boat_count} ลำ)</span> •{" "}
                <span className="font-mono text-lagoon-700 font-semibold">
                  {String(addon.start_time).slice(0, 5)}-{String(addon.end_time).slice(0, 5)} น.
                </span>
              </span>
            </div>
            {addon.handed_out_at ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-forest-700 bg-forest-50 border border-forest-200/70 font-semibold px-2 py-0.5 rounded-md shrink-0">
                <Check size={11} className="stroke-[3]" /> มอบบัตรแล้ว
              </span>
            ) : (
              <button
                onClick={() => handlePrintAndHandOut(addon, line)}
                className="inline-flex items-center gap-1 text-[11px] text-white bg-lagoon-600 hover:bg-lagoon-700 font-medium px-2.5 py-1 rounded-lg transition-all active:scale-95 shadow-xs shrink-0"
              >
                <Printer size={12} />
                <span>พิมพ์บัตรเรือ</span>
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-16 max-w-[1600px] mx-auto">
      {/* Top Header with Live Clock & Quick Actions */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 relative overflow-hidden">
        {/* Subtle Decorative Background Blob */}
        <div className="absolute -right-16 -top-16 w-64 h-64 bg-forest-50/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute right-48 -bottom-16 w-48 h-48 bg-lagoon-50/40 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-10 h-10 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-800/10">
                <KeyRound size={20} className="stroke-[2.2]" />
              </span>
              <div>
                <h1 className="font-display text-2xl lg:text-3xl font-bold text-forest-900 tracking-tight">
                  เช็คอิน - เช็คเอาต์
                </h1>
              </div>
            </div>
          </div>

          {/* Live Status & Controls */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Live Clock & Shift Badge */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-cream-100/90 border border-cream-300/80 shadow-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isCurrentlyInCheckinHours ? "bg-emerald-400" : "bg-amber-400"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                    isCurrentlyInCheckinHours ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
              </span>
              <div className="text-xs">
                <span className="font-mono font-bold text-charcoal-800">
                  {currentTime ? formatThaiTime(currentTime) : "--:--"} น.
                </span>
                <span className="text-charcoal-400 ml-1.5 hidden sm:inline">
                  ({isCurrentlyInCheckinHours ? "เวลาเช็คอินปกติ" : "นอกเวลาปกติ"})
                </span>
              </div>
            </div>

            {/* Checkin Time Settings Modal Trigger Button */}
            <button
              onClick={() => {
                setSettingsDraft({ from: checkinFrom, to: checkinTo });
                setSettingsOpen(true);
              }}
              className="px-3.5 py-2 text-charcoal-700 bg-white hover:bg-forest-50/50 hover:border-forest-200 rounded-2xl border border-charcoal-200/80 shadow-xs transition-all text-xs font-semibold flex items-center gap-2 active:scale-95 group"
              title="ตั้งค่าช่วงเวลาเช็คอิน"
            >
              <Clock size={15} className="text-forest-700 group-hover:rotate-12 transition-transform" />
              <span>{checkinFrom} - {checkinTo} น.</span>
              <Settings size={13} className="text-charcoal-400" />
            </button>

            {/* Refresh Button */}
            <button
              onClick={fetchBookings}
              className="px-3.5 py-2 text-charcoal-700 bg-white hover:bg-forest-50/50 hover:border-forest-200 rounded-2xl border border-charcoal-200/80 shadow-xs transition-all text-xs font-semibold flex items-center gap-2 active:scale-95"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-forest-700" : "text-charcoal-500"} />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modern 4 Stat Overview Cards (Clean KPI Summary) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Arrivals Today */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-forest-700 uppercase tracking-wider">มาถึงวันนี้</p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
                {counts.arrivalsToday}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">ห้อง</span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400">รอเช็คอินและรับกุญแจ</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-forest-100 text-forest-800 flex items-center justify-center shrink-0">
              <LogIn size={20} className="stroke-[2.2]" />
            </div>
          </div>
        </div>

        {/* Card 2: In-House */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-lagoon-700 uppercase tracking-wider">กำลังพักอยู่</p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-charcoal-900 tracking-tight">
                {counts.inHouse}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">ห้อง</span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400">แขกที่พำนักในรีสอร์ทขณะนี้</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-lagoon-100 text-lagoon-800 flex items-center justify-center shrink-0">
              <Home size={20} className="stroke-[2.2]" />
            </div>
          </div>
        </div>

        {/* Card 3: Departing Today */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-bamboo-700 uppercase tracking-wider">ออกวันนี้</p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-charcoal-900 tracking-tight">
                {counts.departingToday}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">ห้อง</span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400">ครบกำหนดเช็คเอาต์วันนี้</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-bamboo-100 text-bamboo-800 flex items-center justify-center shrink-0">
              <LogOut size={20} className="stroke-[2.2]" />
            </div>
          </div>
        </div>

        {/* Card 4: Overdue */}
        <div className={`relative p-4 sm:p-5 rounded-3xl border transition-all ${
          counts.overdue > 0
            ? "bg-rose-50/50 border-rose-300 shadow-sm"
            : "bg-white border-cream-200 shadow-panel"
        }`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-rose-700 uppercase tracking-wider">เลยกำหนดออก</p>
              <p className={`mt-1.5 font-display text-3xl sm:text-4xl font-bold tracking-tight ${counts.overdue > 0 ? "text-rose-700" : "text-charcoal-900"}`}>
                {counts.overdue}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">ห้อง</span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400">
                {counts.overdue > 0 ? "โปรดติดต่อประสานงานด่วน" : "ไม่มีห้องค้างส่งมอบ"}
              </p>
            </div>
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${counts.overdue > 0 ? "bg-rose-200 text-rose-800" : "bg-rose-50 text-rose-500"}`}>
              <AlertTriangle size={20} className="stroke-[2.2]" />
            </div>
          </div>
        </div>
      </div>

      {/* Unified Search & Quick Controls Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl shadow-panel border border-cream-200">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหาชื่อผู้จอง, เบอร์โทร, หมายเลขห้อง (เช่น W10), หรือคำขอพิเศษ..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-cream-50/70 hover:bg-cream-50 focus:bg-white pl-10 pr-9 py-2.5 rounded-xl border border-charcoal-200/60 focus:outline-none focus:ring-2 focus:ring-forest-500/20 text-xs font-medium text-charcoal-800 placeholder:text-charcoal-400 transition-all"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-600 p-1 rounded-full hover:bg-charcoal-100 transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Mobile Tab Switcher (Visible on < xl) */}
        <div className="flex items-center gap-1 bg-cream-100 p-1 rounded-xl xl:hidden self-start md:self-auto w-full md:w-auto">
          <button
            onClick={() => setMobileTab("arrivals")}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mobileTab === "arrivals"
                ? "bg-forest-800 text-white shadow-sm"
                : "text-charcoal-600 hover:text-charcoal-900"
            }`}
          >
            <LogIn size={13} />
            <span>รอเช็คอิน ({arrivals.length})</span>
          </button>
          <button
            onClick={() => setMobileTab("inhouse")}
            className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mobileTab === "inhouse"
                ? "bg-forest-800 text-white shadow-sm"
                : "text-charcoal-600 hover:text-charcoal-900"
            }`}
          >
            <Home size={13} />
            <span>กำลังพักอยู่ ({inHouse.length})</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Split Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* ========================================================= */}
        {/* COLUMN 1: ARRIVALS (รอเช็คอิน) */}
        {/* ========================================================= */}
        <div
          className={`bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/90 flex flex-col ${
            mobileTab === "arrivals" ? "flex" : "hidden xl:flex"
          }`}
        >
          {/* Header & Date Filter Pills */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-cream-200">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-forest-50 text-forest-800 flex items-center justify-center font-bold">
                <LogIn size={16} />
              </span>
              <div>
                <h2 className="font-display font-bold text-lg text-forest-900 flex items-center gap-2">
                  รอเช็คอิน
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-forest-100 text-forest-800 font-sans font-bold">
                    {arrivals.length} รายการ
                  </span>
                </h2>
              </div>
            </div>

            {/* Date Filter Segmented Control */}
            <div className="flex items-center gap-1 bg-cream-100 p-1 rounded-xl self-start sm:self-auto">
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
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    arrivalFilter === key
                      ? "bg-white text-forest-900 shadow-sm"
                      : "text-charcoal-500 hover:text-charcoal-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* List Content */}
          <div className="space-y-3.5 max-h-[750px] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <RefreshCw size={28} className="animate-spin text-forest-700" />
                <p className="text-xs text-charcoal-400 font-medium">กำลังโหลดข้อมูลการจอง...</p>
              </div>
            ) : arrivals.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center p-6 bg-cream-50/60 rounded-3xl border border-dashed border-cream-300">
                <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-cream-200 text-forest-700 flex items-center justify-center mb-3">
                  <ShieldCheck size={28} className="stroke-[1.5]" />
                </div>
                <p className="font-display font-bold text-base text-forest-900">ไม่มีรายการรอเช็คอิน</p>
                <p className="text-xs text-charcoal-400 max-w-xs mt-1 leading-relaxed">
                  {search
                    ? `ไม่พบรายการที่ตรงกับ "${search}" ลองเปลี่ยนคำค้นหา`
                    : arrivalFilter === "today"
                    ? "ผู้เข้าพักของวันนี้เช็คอินครบทั้งหมดแล้ว หรือไม่มีรายการจองเข้าพักวันนี้"
                    : "ไม่มีรายการที่ตรงกับเงื่อนไขการกรอง"}
                </p>
              </div>
            ) : (
              arrivals.map((line) => {
                const actionable = isCheckinActionable(line);
                const outsideWindow = actionable && isOutsideCheckinWindow(line);
                const { arrivalTime: legacyArrivalTime, note } = parseSpecialRequest(line.special_request);
                // ของใหม่อ่านจากคอลัมน์ arrival_time ตรง ๆ ของเก่าก่อนมีคอลัมน์นี้ยังแกะจากข้อความเดิมได้
                const arrivalTime = line.arrival_time ? line.arrival_time.slice(0, 5) : legacyArrivalTime;
                const nights = calculateNights(line.check_in, line.check_out);
                const isArrivalToday = localDateStr(line.check_in) === today;

                return (
                  <div
                    key={line.booking_room_id}
                    className={`group relative rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${
                      outsideWindow
                        ? "bg-amber-50/20 border-amber-200 hover:border-amber-300 hover:shadow-sm"
                        : actionable
                        ? "bg-white border-cream-200 hover:border-forest-300 hover:shadow-md"
                        : "bg-cream-50/40 border-cream-200/70 opacity-90"
                    }`}
                  >
                    {/* Top Row: Room Pill + Status Tag */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-cream-100">
                      <div className="flex items-center gap-2">
                        {/* Room Number Badge */}
                        <div className="px-3 py-1 rounded-xl bg-forest-900 text-white font-display font-bold text-xs flex items-center gap-1.5 shadow-xs">
                          <BedDouble size={13} className="text-forest-200" />
                          <span>#{line.room_number}</span>
                          <span className="text-forest-200 font-sans font-normal border-l border-forest-700/80 pl-1.5">
                            {line.room_name}
                          </span>
                        </div>
                      </div>

                      {/* Date & Stay Duration Badge */}
                      <div className="flex items-center gap-1.5 text-xs text-charcoal-600 bg-cream-100/90 px-2.5 py-1 rounded-lg">
                        <Calendar size={12} className="text-forest-700" />
                        <span className="font-mono font-bold text-forest-950">
                          {formatThaiDate(line.check_in)}
                        </span>
                        <span className="text-charcoal-400">→</span>
                        <span className="font-mono text-charcoal-700">
                          {formatThaiDate(line.check_out)}
                        </span>
                        <span className="text-forest-800 font-semibold text-[11px] bg-white px-1.5 py-0.2 rounded-md shadow-xs ml-1">
                          {nights} คืน
                        </span>
                      </div>
                    </div>

                    {/* Middle Row: Guest Details */}
                    <div className="pt-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        {/* Guest Name & Avatar */}
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-forest-800 to-forest-600 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                            {(line.user_name || "U")[0].toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-display font-bold text-sm sm:text-base text-forest-950 truncate">
                              {line.user_name || "ไม่ระบุชื่อ"}
                            </h3>
                            {/* Phone with copy action */}
                            <div className="flex items-center gap-1.5 text-xs text-charcoal-500 font-mono">
                              <a
                                href={`tel:${line.user_phone}`}
                                className="hover:text-forest-800 flex items-center gap-1 hover:underline"
                              >
                                <Phone size={11} className="text-forest-700" />
                                <span>{line.user_phone || "-"}</span>
                              </a>
                              {line.user_phone && (
                                <button
                                  onClick={(e) => handleCopyPhone(line.user_phone, e)}
                                  className="text-charcoal-400 hover:text-forest-800 p-0.5 rounded transition-colors"
                                  title="คัดลอกเบอร์โทร"
                                >
                                  <Copy size={11} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Guest Count */}
                        <div className="flex items-center gap-1.5 text-xs text-charcoal-500 pt-0.5">
                          <Users size={12} className="text-charcoal-400" />
                          <span>{formatGuestSummary(line)}</span>
                        </div>

                        {/* Badges: Arrival Time & Outside Window */}
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          {arrivalTime && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-lagoon-900 bg-lagoon-50 border border-lagoon-200 px-2.5 py-0.5 rounded-lg">
                              <Clock size={11} className="text-lagoon-700" />
                              <span>คาดว่าจะถึง {arrivalTime} น.</span>
                            </span>
                          )}
                          {outsideWindow && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-100/90 border border-amber-300 px-2.5 py-0.5 rounded-lg">
                              <AlertTriangle size={11} className="text-amber-700" />
                              <span>นอกเวลาปกติ ({checkinFrom}-{checkinTo} น.)</span>
                            </span>
                          )}
                        </div>

                        {/* Special Request Note */}
                        {note && (
                          <div className="text-xs text-amber-900 bg-amber-50/90 border border-amber-200/90 rounded-xl px-3 py-1.5 mt-2 flex items-start gap-1.5 max-w-lg">
                            <MessageSquare size={12} className="shrink-0 text-amber-700 mt-0.5" />
                            <span className="leading-relaxed font-medium">{note}</span>
                          </div>
                        )}

                        {/* Boat Addons */}
                        {renderBoatAddons(line)}
                      </div>

                      {/* Action CTA Button */}
                      <div className="shrink-0 sm:self-center pt-2 sm:pt-0">
                        {actionable ? (
                          <button
                            onClick={() => handleCheckin(line)}
                            className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-bold text-white px-5 py-2.5 rounded-2xl shadow-sm transition-all active:scale-95 group/btn ${
                              outsideWindow
                                ? "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                                : "bg-forest-800 hover:bg-forest-900 shadow-forest-800/20"
                            }`}
                          >
                            <LogIn size={15} className="group-hover/btn:translate-x-0.5 transition-transform" />
                            <span>{outsideWindow ? "เช็คอินนอกเวลา" : "เช็คอิน"}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 text-xs font-semibold text-charcoal-400 bg-cream-100 border border-cream-200 px-3 py-1.5 rounded-xl">
                            <Clock size={12} />
                            <span>รอถึงวัน {formatThaiDate(line.check_in)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* COLUMN 2: IN-HOUSE (กำลังพักอยู่ในรีสอร์ท) */}
        {/* ========================================================= */}
        <div
          className={`bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/90 flex flex-col ${
            mobileTab === "inhouse" ? "flex" : "hidden xl:flex"
          }`}
        >
          {/* Header & Filter Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-cream-200">
            <div className="flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-lagoon-50 text-lagoon-800 flex items-center justify-center font-bold">
                <Home size={16} />
              </span>
              <div>
                <h2 className="font-display font-bold text-lg text-forest-900 flex items-center gap-2">
                  กำลังพักอยู่ในรีสอร์ท
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-lagoon-100 text-lagoon-800 font-sans font-bold">
                    {inHouse.length} ห้อง
                  </span>
                </h2>
              </div>
            </div>

            {/* In-House Filter Segmented Control */}
            <div className="flex items-center gap-1 bg-cream-100 p-1 rounded-xl self-start sm:self-auto">
              {(
                [
                  ["all", "ทั้งหมด"],
                  ["today", "ออกวันนี้"],
                  ["overdue", "เลยกำหนด"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setInHouseFilter(key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    inHouseFilter === key
                      ? key === "overdue" && counts.overdue > 0
                        ? "bg-rose-600 text-white shadow-sm"
                        : "bg-white text-forest-900 shadow-sm"
                      : "text-charcoal-500 hover:text-charcoal-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* List Content */}
          <div className="space-y-3.5 max-h-[750px] overflow-y-auto pr-1">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <RefreshCw size={28} className="animate-spin text-forest-700" />
                <p className="text-xs text-charcoal-400 font-medium">กำลังโหลดข้อมูลการเข้าพัก...</p>
              </div>
            ) : inHouse.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center p-6 bg-cream-50/60 rounded-3xl border border-dashed border-cream-300">
                <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-cream-200 text-lagoon-700 flex items-center justify-center mb-3">
                  <Home size={28} className="stroke-[1.5]" />
                </div>
                <p className="font-display font-bold text-base text-forest-900">
                  {inHouseFilter === "today"
                    ? "ไม่มีรายการที่ครบกำหนดออกวันนี้"
                    : inHouseFilter === "overdue"
                    ? "ไม่มีห้องที่เลยกำหนดออก"
                    : "ไม่มีผู้เข้าพักในขณะนี้"}
                </p>
                <p className="text-xs text-charcoal-400 max-w-xs mt-1 leading-relaxed">
                  {search
                    ? `ไม่พบรายการที่ตรงกับ "${search}" ลองเปลี่ยนคำค้นหา`
                    : inHouseFilter === "today"
                    ? "ไม่มีห้องพักที่มีกำหนดเช็คเอาต์ในวันนี้ หรือเช็คเอาต์ครบหมดแล้ว"
                    : inHouseFilter === "overdue"
                    ? "ไม่มีผู้เข้าพักที่ค้างส่งมอบกุญแจเกินกำหนดเวลา"
                    : "เมื่อมีผู้เข้าพักเช็คอิน รายการห้องและแขกที่พำนักอยู่จะแสดงในคอลัมน์นี้เพื่อเตรียมเช็คเอาต์"}
                </p>
              </div>
            ) : (
              inHouse.map((line) => {
                const isToday = localDateStr(line.check_out) === today;
                const isOverdue = localDateStr(line.check_out) < today;
                const { note } = parseSpecialRequest(line.special_request);
                const nights = calculateNights(line.check_in, line.check_out);

                return (
                  <div
                    key={line.booking_room_id}
                    className={`group relative rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${
                      isOverdue
                        ? "bg-rose-50/40 border-rose-300 hover:shadow-md"
                        : isToday
                        ? "bg-gradient-to-br from-bamboo-50/40 via-white to-white border-bamboo-300 hover:shadow-md"
                        : "bg-white border-cream-200 hover:border-lagoon-300 hover:shadow-md"
                    }`}
                  >
                    {/* Top Row: Room Number & Checkout Date */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-cream-100">
                      <div className="flex items-center gap-2">
                        {/* Room Badge */}
                        <div className="px-3 py-1 rounded-xl bg-forest-900 text-white font-display font-bold text-xs flex items-center gap-1.5 shadow-xs">
                          <BedDouble size={13} className="text-forest-200" />
                          <span>#{line.room_number}</span>
                          <span className="text-forest-200 font-sans font-normal border-l border-forest-700/80 pl-1.5">
                            {line.room_name}
                          </span>
                        </div>
                      </div>

                      {/* Checkout Status Tag */}
                      <div>
                        {isOverdue ? (
                          <span className="inline-flex items-center gap-1 text-xs text-rose-700 font-bold bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-xl">
                            <AlertTriangle size={12} /> เลยกำหนดออก ({formatThaiDate(line.check_out)})
                          </span>
                        ) : isToday ? (
                          <span className="inline-flex items-center gap-1 text-xs text-bamboo-800 font-bold bg-bamboo-100 border border-bamboo-300 px-2.5 py-1 rounded-xl">
                            <CalendarCheck size={12} /> กำหนดออกวันนี้ ({formatThaiDate(line.check_out)})
                          </span>
                        ) : (
                          <span className="text-xs text-charcoal-600 bg-cream-100 px-2.5 py-1 rounded-xl font-mono font-medium">
                            ออก {formatThaiDate(line.check_out)} ({nights} คืน)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Guest Info */}
                    <div className="pt-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1.5">
                        {/* Guest Name & Avatar */}
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-lagoon-700 to-lagoon-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                            {(line.user_name || "U")[0].toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-display font-bold text-sm sm:text-base text-forest-950 truncate">
                              {line.user_name || "ไม่ระบุชื่อ"}
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs text-charcoal-500 font-mono">
                              <a
                                href={`tel:${line.user_phone}`}
                                className="hover:text-forest-800 flex items-center gap-1 hover:underline"
                              >
                                <Phone size={11} className="text-forest-700" />
                                <span>{line.user_phone || "-"}</span>
                              </a>
                              {line.user_phone && (
                                <button
                                  onClick={(e) => handleCopyPhone(line.user_phone, e)}
                                  className="text-charcoal-400 hover:text-forest-800 p-0.5 rounded transition-colors"
                                  title="คัดลอกเบอร์โทร"
                                >
                                  <Copy size={11} />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Guest Count */}
                        <div className="flex items-center gap-1.5 text-xs text-charcoal-500 pt-0.5">
                          <Users size={12} className="text-charcoal-400" />
                          <span>{formatGuestSummary(line)}</span>
                        </div>

                        {/* Special Request Note */}
                        {note && (
                          <div className="text-xs text-amber-900 bg-amber-50/90 border border-amber-200/90 rounded-xl px-3 py-1.5 mt-2 flex items-start gap-1.5 max-w-lg">
                            <MessageSquare size={12} className="shrink-0 text-amber-700 mt-0.5" />
                            <span className="leading-relaxed font-medium">{note}</span>
                          </div>
                        )}

                        {/* Boat Addons */}
                        {renderBoatAddons(line)}
                      </div>

                      {/* Action CTA: Check-out Button */}
                      <div className="shrink-0 sm:self-center pt-2 sm:pt-0">
                        <button
                          onClick={() => handleCheckout(line)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-bold text-white px-5 py-2.5 rounded-2xl bg-forest-800 hover:bg-forest-900 shadow-sm shadow-forest-800/20 transition-all active:scale-95 group/btn"
                        >
                          <LogOut size={15} className="group-hover/btn:translate-x-0.5 transition-transform" />
                          <span>เช็คเอาต์</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Enhanced Confirmation Modal */}
      <Modal
        open={!!confirmModal?.open}
        title={confirmModal?.title || ""}
        onClose={() => setConfirmModal(null)}
        footer={
          <div className="flex items-center justify-end gap-2 w-full pt-2">
            <button
              onClick={() => setConfirmModal(null)}
              className="px-4 py-2 text-xs font-semibold text-charcoal-600 bg-cream-100 hover:bg-cream-200 rounded-xl transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => {
                confirmModal?.onConfirm();
                setConfirmModal(null);
              }}
              className={`inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white rounded-xl transition-all shadow-sm active:scale-95 ${
                confirmModal?.outsideWindow
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-forest-800 hover:bg-forest-900"
              }`}
            >
              {confirmModal?.isCheckout ? <LogOut size={14} /> : <LogIn size={14} />}
              <span>{confirmModal?.isCheckout ? "ยืนยันการเช็คเอาต์" : "ยืนยันการเช็คอิน"}</span>
            </button>
          </div>
        }
      >
        {confirmModal && (
          <div className="space-y-4 py-1">
            {confirmModal.outsideWindow && !confirmModal.isCheckout && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5">
                <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 space-y-0.5">
                  <p className="font-bold">เช็คอินนอกเวลามาตรฐาน</p>
                  <p className="leading-relaxed">
                    เวลาปัจจุบันอยู่นอกช่วงเวลาเช็คอินปกติ ({checkinFrom} - {checkinTo} น.) ยืนยันว่าอนุญาตให้เข้าพักก่อนเวลา
                  </p>
                </div>
              </div>
            )}

            <div className="bg-cream-50 p-4 rounded-2xl border border-cream-200 space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-cream-200">
                <span className="text-charcoal-400">ห้องพัก:</span>
                <span className="font-bold text-forest-950 font-display text-sm">
                  #{confirmModal.line.room_number} - {confirmModal.line.room_name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-charcoal-400">ชื่อผู้เข้าพัก:</span>
                <span className="font-semibold text-charcoal-800">{confirmModal.line.user_name || "-"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-charcoal-400">เบอร์โทรศัพท์:</span>
                <span className="font-mono text-charcoal-800">{confirmModal.line.user_phone || "-"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-charcoal-400">ระยะเวลาเข้าพัก:</span>
                <span className="font-mono text-forest-800 font-semibold">
                  {formatThaiDate(confirmModal.line.check_in)} → {formatThaiDate(confirmModal.line.check_out)} ({calculateNights(confirmModal.line.check_in, confirmModal.line.check_out)} คืน)
                </span>
              </div>
            </div>

            <p className="text-xs text-charcoal-500 leading-relaxed">
              {confirmModal.isCheckout
                ? "เมื่อกดยืนยัน ระบบจะปรับสถานะห้องพักกลับเป็น 'ห้องว่าง (Available)' เพื่อให้แม่บ้านทำความสะอาดและพร้อมรับผู้เข้าพักรอบถัดไป"
                : "เมื่อกดยืนยัน ระบบจะบันทึกเวลาที่ลูกค้าเข้าพัก และปรับสถานะห้องเป็น 'เข้าพักแล้ว (Checked In)'"}
            </p>
          </div>
        )}
      </Modal>

      {/* Checkin Time Settings Modal */}
      <Modal
        open={settingsOpen}
        title="ตั้งค่าช่วงเวลาเช็คอินมาตรฐาน"
        onClose={() => setSettingsOpen(false)}
        footer={
          <div className="flex items-center justify-end gap-2 w-full pt-2">
            <button
              onClick={() => setSettingsOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-charcoal-600 bg-cream-100 hover:bg-cream-200 rounded-xl transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-forest-800 hover:bg-forest-900 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-60"
            >
              <Save size={14} />
              <span>{savingSettings ? "กำลังบันทึก..." : "บันทึก"}</span>
            </button>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          <p className="text-xs text-charcoal-500 leading-relaxed">
            ระบบจะใช้ช่วงเวลานี้เพื่อแจ้งเตือนพนักงานเมื่อมีผู้เข้าพักเช็คอินก่อนหรือหลังเวลาปกติ (ไม่ได้ปิดกั้นการเช็คอิน พนักงานยังยืนยันเช็คอินนอกเวลาได้ตามดุลยพินิจ)
          </p>
          <div className="bg-cream-50 p-4 rounded-2xl border border-cream-200">
            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <label className="text-xs text-charcoal-600 font-semibold block mb-1.5">เวลาเริ่มต้นเช็คอิน</label>
                <input
                  type="time"
                  value={settingsDraft.from}
                  onChange={(e) => setSettingsDraft((s) => ({ ...s, from: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm font-mono font-bold text-forest-950 focus:outline-none focus:ring-2 focus:ring-forest-500/20 bg-white"
                />
              </div>
              <div>
                <label className="text-xs text-charcoal-600 font-semibold block mb-1.5">เวลาสิ้นสุดเช็คอิน</label>
                <input
                  type="time"
                  value={settingsDraft.to}
                  onChange={(e) => setSettingsDraft((s) => ({ ...s, to: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-charcoal-200 text-sm font-mono font-bold text-forest-950 focus:outline-none focus:ring-2 focus:ring-forest-500/20 bg-white"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>
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
