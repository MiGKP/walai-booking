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
  KeyRound,
  ShieldCheck,
  LayoutGrid,
  List,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Bell,
  BellRing,
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { Modal } from "@/components/admin/ui";
import {
  formatThaiDateShort as formatThaiDate,
  formatThaiDateLong,
  formatThaiTime,
  toISODate as toBangkokISODate,
  toUTCISOString,
  nightsBetween as calculateNights,
  BANGKOK_TIMEZONE,
} from "@/lib/date";

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

// สกัดเวลาที่คาดว่าจะถึง และคำขอพิเศษ (รองรับทั้ง arrival_time โดยตรง และรูปแบบเดิม [Arrival: HH:MM])
const parseSpecialRequest = (
  raw?: string | null,
  directArrival?: string | null,
): { arrivalTime: string | null; note: string | null } => {
  let arrivalTime = directArrival ? String(directArrival).slice(0, 5) : null;
  let note: string | null = raw ? raw.trim() : null;

  if (raw) {
    const match = raw.match(/^\[Arrival:\s*([\d:]+)\]\s*(.*)$/);
    if (match) {
      if (!arrivalTime) arrivalTime = match[1];
      note = match[2].trim();
    }
  }

  return {
    arrivalTime: arrivalTime || null,
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
  const [inHouseFilter, setInHouseFilter] = useState<"all" | "today" | "staying">("all");
  const [mobileTab, setMobileTab] = useState<"arrivals" | "inhouse">("arrivals");

  // Toggle Density View (Detailed vs Compact for handling 100+ rooms easily)
  const [densityView, setDensityView] = useState<"detailed" | "compact">("detailed");
  const [sortBy, setSortBy] = useState<"room" | "time" | "name">("time");

  // Pagination (5 items per page)
  const ITEMS_PER_PAGE = 5;
  const [arrivalPage, setArrivalPage] = useState(1);
  const [inHousePage, setInHousePage] = useState(1);
  const [handedOutAddonIds, setHandedOutAddonIds] = useState<Set<number>>(new Set());

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

  // Reset page when search or filters change
  useEffect(() => {
    setArrivalPage(1);
  }, [search, arrivalFilter]);

  useEffect(() => {
    setInHousePage(1);
  }, [search, inHouseFilter]);

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

  // แตกรายการเป็นระดับ "ห้อง" (booking_room) จากข้อมูลจริงในฐานข้อมูล
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
    const bookingNumber = q.replace(/^#\s*/, "");
    return (
      (Boolean(bookingNumber) && String(line.room_booking_id).includes(bookingNumber)) ||
      String(line.user_name || "").toLowerCase().includes(q) ||
      String(line.user_phone || "").toLowerCase().includes(q) ||
      String(line.room_number || "").toLowerCase().includes(q) ||
      String(line.room_name || "").toLowerCase().includes(q) ||
      String(line.special_request || "").toLowerCase().includes(q)
    );
  };

  const sortItems = (items: FlatLine[]) => {
    return [...items].sort((a, b) => {
      if (sortBy === "room") {
        return a.room_number.localeCompare(b.room_number, undefined, { numeric: true });
      }
      if (sortBy === "name") {
        return (a.user_name || "").localeCompare(b.user_name || "");
      }
      // Sort by arrival time / date default
      const { arrivalTime: timeA } = parseSpecialRequest(a.special_request);
      const { arrivalTime: timeB } = parseSpecialRequest(b.special_request);
      if (timeA && timeB) {
        return timeToMinutes(timeA) - timeToMinutes(timeB);
      }
      return new Date(a.check_in).getTime() - new Date(b.check_in).getTime();
    });
  };

  const rawArrivals = useMemo(() => {
    return allLines.filter((l) => l.status === "approved");
  }, [allLines]);

  const arrivals = useMemo(() => {
    const filtered = rawArrivals
      .filter((l) => {
        if (arrivalFilter === "today") return localDateStr(l.check_in) === today;
        if (arrivalFilter === "tomorrow") return localDateStr(l.check_in) === tomorrow;
        return true;
      })
      .filter(matchesSearch);
    return sortItems(filtered);
  }, [rawArrivals, arrivalFilter, matchesSearch, sortBy, today, tomorrow]);

  const totalArrivalPages = Math.max(1, Math.ceil(arrivals.length / ITEMS_PER_PAGE));
  const paginatedArrivals = useMemo(() => {
    const start = (arrivalPage - 1) * ITEMS_PER_PAGE;
    return arrivals.slice(start, start + ITEMS_PER_PAGE);
  }, [arrivals, arrivalPage]);

  const inHouse = useMemo(() => {
    const filtered = allLines
      .filter((l) => l.status === "checked_in")
      .filter((l) => {
        if (inHouseFilter === "today") return localDateStr(l.check_out) <= today;
        if (inHouseFilter === "staying") return localDateStr(l.check_out) > today;
        return true;
      })
      .filter(matchesSearch);
    return sortItems(filtered);
  }, [allLines, inHouseFilter, matchesSearch, sortBy, today]);

  const totalInHousePages = Math.max(1, Math.ceil(inHouse.length / ITEMS_PER_PAGE));
  const paginatedInHouse = useMemo(() => {
    const start = (inHousePage - 1) * ITEMS_PER_PAGE;
    return inHouse.slice(start, start + ITEMS_PER_PAGE);
  }, [inHouse, inHousePage]);

  const counts = useMemo(() => {
    const arrivalsToday = allLines.filter(
      (l) => l.status === "approved" && localDateStr(l.check_in) === today,
    ).length;
    const arrivalsTomorrow = allLines.filter(
      (l) => l.status === "approved" && localDateStr(l.check_in) === tomorrow,
    ).length;
    const arrivalsAll = rawArrivals.length;

    const inHouseAll = allLines.filter((l) => l.status === "checked_in");
    const departingToday = inHouseAll.filter((l) => localDateStr(l.check_out) <= today).length;
    const staying = inHouseAll.filter((l) => localDateStr(l.check_out) > today).length;
    return {
      arrivalsToday,
      arrivalsTomorrow,
      arrivalsAll,
      inHouse: inHouseAll.length,
      departingToday,
      staying,
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
      title: `ยืนยันการเช็คอินห้อง ${line.room_number}`,
      line,
      outsideWindow,
      isCheckout: false,
      onConfirm: async () => {
        try {
          await api.put(`/bookings/booking-rooms/${line.booking_room_id}/checkin`);
          notify.success(`เช็คอินห้อง ${line.room_number} เรียบร้อยแล้ว`);
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
      title: `ยืนยันการเช็คเอาต์ห้อง ${line.room_number}`,
      line,
      isCheckout: true,
      onConfirm: async () => {
        try {
          await api.put(`/bookings/booking-rooms/${line.booking_room_id}/checkout`);
          notify.success(`เช็คเอาต์ห้อง ${line.room_number} และคืนสถานะห้องว่างแล้ว`);
          fetchBookings();
        } catch (err: unknown) {
          notify.error(getApiErrorMessage(err, "เช็คเอาต์ไม่สำเร็จ"));
        }
      },
    });
  };

  const printAddonTicket = (addon: BoatAddon, line: FlatLine) => {
    const w = window.open("", "_blank", "width=680,height=480");
    if (!w) return;
    const esc = (value: unknown): string =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    w.document.write(`<!DOCTYPE html><html><head><title>บัตรกิจกรรมเรือพาย - ห้อง #${esc(line.room_number)}</title>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Pridi:wght@500;600;700&family=Sarabun:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: 'Sarabun', -apple-system, sans-serif;
          background: #EEF2F0;
          color: #1c1c1c;
          padding: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .ticket-wrapper {
          width: 10cm;
          height: 7cm;
          background: #ffffff;
          border-radius: 12px;
          border: 1.5px solid #123C30;
          display: flex;
          overflow: hidden;
          box-shadow: 0 6px 20px rgba(18, 60, 48, 0.1);
          position: relative;
        }
        /* ฝั่งซ้าย: บัตรหลัก (Main Pass ~68%) */
        .main-pass {
          width: 68%;
          display: flex;
          flex-direction: column;
          border-right: 1.5px dashed #366F5A;
          position: relative;
        }
        .main-header {
          background: #123C30;
          color: #ffffff;
          padding: 8px 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .resort-title {
          font-size: 8px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #A3C9BC;
          font-weight: 600;
        }
        .pass-name {
          font-family: 'Pridi', serif;
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
        }
        .main-content {
          padding: 8px 12px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          flex: 1;
        }
        .room-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #F2F7F5;
          border: 1px solid #D1E3DC;
          border-radius: 6px;
          padding: 4px 8px;
          margin-bottom: 6px;
        }
        .room-badge {
          font-family: 'Pridi', serif;
          font-size: 14px;
          font-weight: 700;
          color: #123C30;
        }
        .guest-name {
          font-size: 11px;
          font-weight: 600;
          color: #2D4F43;
          max-width: 140px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px 8px;
          font-size: 10px;
        }
        .info-item {
          display: flex;
          flex-direction: column;
        }
        .info-label {
          color: #666;
          font-size: 8.5px;
          text-transform: uppercase;
        }
        .info-val {
          color: #123C30;
          font-weight: 600;
          font-size: 10.5px;
        }
        .info-val.time-tag {
          color: #0E5C49;
          font-weight: 700;
          font-size: 11px;
        }
        .safety-strip {
          margin-top: 4px;
          padding: 3px 6px;
          background: #FAF6EC;
          border-left: 2.5px solid #C48A3F;
          border-radius: 4px;
          font-size: 8.5px;
          color: #634E2A;
          line-height: 1.2;
        }
        /* รอยบากตัดคูปอง */
        .notch-top, .notch-bottom {
          position: absolute;
          width: 14px;
          height: 14px;
          background: #EEF2F0;
          border-radius: 50%;
          border: 1.5px solid #123C30;
          right: -7px;
          z-index: 10;
        }
        .notch-top { top: -8px; }
        .notch-bottom { bottom: -8px; }
        /* ฝั่งขวา: หางบัตรสำหรับคืนท่าเรือ (Stub ~32%) */
        .stub-pass {
          width: 32%;
          background: #FAFCFB;
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          text-align: center;
        }
        .stub-header {
          font-size: 8px;
          font-weight: 700;
          color: #366F5A;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid #DCE6E2;
          padding-bottom: 3px;
        }
        .stub-room {
          margin: 4px 0;
        }
        .stub-room-num {
          font-family: 'Pridi', serif;
          font-size: 16px;
          font-weight: 700;
          color: #123C30;
        }
        .stub-boat {
          font-size: 9.5px;
          color: #444;
          font-weight: 600;
        }
        .stub-time {
          font-size: 10px;
          font-weight: 700;
          color: #0E5C49;
          margin-top: 2px;
        }
        .stamp-box {
          border: 1px dashed #A7BCB3;
          border-radius: 4px;
          padding: 6px 2px;
          font-size: 8px;
          color: #777;
          margin-top: 4px;
          background: #ffffff;
        }
        .stub-footer {
          font-size: 7.5px;
          color: #999;
          margin-top: 3px;
        }
        @media print {
          body {
            background: #ffffff;
            padding: 0;
            margin: 0;
            min-height: auto;
            display: flex;
            justify-content: center;
            align-items: flex-start;
            padding-top: 25mm; /* ขยับบัตรลงมาจากขอบบนกระดาษ 2.5 ซม. */
          }
          .ticket-wrapper {
            width: 10cm;
            height: 7cm;
            box-shadow: none;
            page-break-inside: avoid;
            margin: 0 auto;
          }
          .notch-top, .notch-bottom {
            background: #ffffff;
          }
          @page {
            size: auto;
            margin: 15mm auto;
          }
        }
      </style>
      </head><body>
        <div class="ticket-wrapper">
          <!-- Main Pass (Left) -->
          <div class="main-pass">
            <div class="notch-top"></div>
            <div class="notch-bottom"></div>
            <div class="main-header">
              <div>
                <div class="resort-title">Walai Floating Resort</div>
                <div class="pass-name">บัตรกิจกรรมเรือพาย</div>
              </div>
              <div style="font-size: 9px; color: #D1E3DC;">สวนวลัยรุกขเวช</div>
            </div>
            <div class="main-content">
              <div class="room-row">
                <span class="room-badge">#${esc(line.room_number)} ${esc(line.room_name)}</span>
                <span class="guest-name">${esc(line.user_name || "-")}</span>
              </div>
              <div class="info-grid">
                <div class="info-item">
                  <span class="info-label">ประเภทเรือ</span>
                  <span class="info-val">${esc(addon.boat_type_name)}</span>
                </div>
                <div class="info-item">
                  <span class="info-label">รอบวัน & เวลา</span>
                  <span class="info-val time-tag">${formatThaiDate(String(addon.booking_date).slice(0, 10))} • ${String(addon.start_time).slice(0, 5)}-${String(addon.end_time).slice(0, 5)} น.</span>
                </div>
                <div class="info-item">
                  <span class="info-label">จำนวนเรือ / ผู้โดยสาร</span>
                  <span class="info-val">${addon.boat_count} ลำ (${addon.num_passengers} ท่าน)</span>
                </div>
                <div class="info-item">
                  <span class="info-label">สิทธิ์การใช้งาน</span>
                  <span class="info-val" style="color: #0E5C49;">${addon.mode === "paid" ? `บริการเสริม (฿${Number(addon.price).toLocaleString()})` : "ฟรี (แพ็กเกจห้องพัก)"}</span>
                </div>
              </div>
              <div class="safety-strip">
                ⚠️ <strong>ข้อปฏิบัติ:</strong> สวมชูชีพตลอดเวลา • ถึงท่าเรือก่อนเวลา 10 นาที • ห้ามนำสุราขึ้นเรือ
              </div>
            </div>
          </div>

          <!-- Stub (Right) -->
          <div class="stub-pass">
            <div class="stub-header">หางบัตร (ท่าเรือ)</div>
            <div class="stub-room">
              <div class="stub-room-num">#${esc(line.room_number)}</div>
              <div class="stub-boat">${esc(addon.boat_type_name)} (${addon.boat_count} ลำ)</div>
              <div class="stub-time">${String(addon.start_time).slice(0, 5)} - ${String(addon.end_time).slice(0, 5)} น.</div>
            </div>
            <div class="stamp-box">
              เจ้าหน้าที่ท่าเรือ / ลงชื่อ
            </div>
            <div class="stub-footer">
              ${new Date().toLocaleDateString("th-TH", { timeZone: BANGKOK_TIMEZONE })}
            </div>
          </div>
        </div>
      </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const handlePrintOnly = (addon: BoatAddon, line: FlatLine) => {
    printAddonTicket(addon, line);
    api.put(`/kayaks/room-addon/${addon.boat_booking_id}/print`).catch(() => {});
  };

  const handleToggleHandout = async (addon: BoatAddon, line: FlatLine) => {
    const nextSet = new Set(handedOutAddonIds);
    const willHandOut = !addon.handed_out_at && !nextSet.has(addon.boat_booking_id);

    if (willHandOut) {
      nextSet.add(addon.boat_booking_id);
      setHandedOutAddonIds(nextSet);
      try {
        await api.put(`/kayaks/room-addon/${addon.boat_booking_id}/hand-out`);
        fetchBookings();
        notify.success(`บันทึกการยื่นบัตรเรือ ห้อง ${line.room_number} เรียบร้อยแล้ว`);
      } catch (err: unknown) {
        notify.error(getApiErrorMessage(err, "บันทึกการมอบบัตรไม่สำเร็จ"));
      }
    }
  };

  const renderBoatAddons = (line: FlatLine) => {
    if (!line.boat_addons || line.boat_addons.length === 0) return null;
    return (
      <div className="mt-2.5 space-y-2 pt-2 border-t border-cream-100">
        {line.boat_addons.map((addon) => {
          const isHandedOut = !!addon.handed_out_at || handedOutAddonIds.has(addon.boat_booking_id);
          return (
            <div
              key={addon.boat_booking_id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs bg-cream-50/60 border border-cream-200/60 rounded-xl p-2 sm:px-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Ship size={13} className="text-charcoal-500 shrink-0" />
                <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                  <span className="font-semibold text-charcoal-900 text-xs truncate">
                    {addon.boat_type_name}
                  </span>
                  <span className="text-[11px] text-charcoal-500 whitespace-nowrap">
                    ({addon.boat_count} ลำ • {addon.num_passengers} ท่าน)
                  </span>
                  <span className="text-[11px] text-charcoal-400 font-mono whitespace-nowrap">
                    • {String(addon.start_time).slice(0, 5)} - {String(addon.end_time).slice(0, 5)} น.
                  </span>
                </div>
              </div>

              {/* Actions: Print Button & Handout Button */}
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-auto">
                <button
                  onClick={() => handlePrintOnly(addon, line)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-charcoal-700 bg-white hover:bg-cream-100 border border-cream-300 px-2.5 py-1 rounded-lg transition-all active:scale-95 shadow-xs whitespace-nowrap"
                  title="พิมพ์บัตรกิจกรรมเรือพาย (10x7 cm)"
                >
                  <Printer size={12} className="text-charcoal-500" />
                  <span>พิมพ์บัตร</span>
                </button>

                {isHandedOut ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-charcoal-600 bg-cream-200/80 border border-cream-300/80 px-2 py-1 rounded-lg whitespace-nowrap">
                    <Check size={12} className="text-charcoal-600 stroke-[2.5]" />
                    <span>ยื่นบัตรแล้ว</span>
                  </span>
                ) : (
                  <button
                    onClick={() => handleToggleHandout(addon, line)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-forest-900 bg-forest-100/80 hover:bg-forest-200/80 border border-forest-200/80 px-2.5 py-1 rounded-lg transition-all active:scale-95 whitespace-nowrap"
                    title="กดเพื่อบันทึกว่ายื่นบัตรให้แขกแล้ว"
                  >
                    <span>ยื่นบัตรให้แขกแล้ว</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-16 max-w-[1600px] mx-auto">
      {/* Top Header with Live Clock & Quick Actions */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 relative">
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
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-forest-700 uppercase tracking-wider">มาถึงวันนี้</p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
                {counts.arrivalsToday}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">ห้อง</span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400">รอเช็คอินและรับกุญแจ</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-forest-50 text-forest-800 border border-forest-100 flex items-center justify-center shrink-0">
              <LogIn size={20} className="stroke-[2.2]" />
            </div>
          </div>
        </div>

        {/* Card 2: In-House */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-forest-700 uppercase tracking-wider">กำลังพักอยู่</p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
                {counts.inHouse}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">ห้อง</span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400">แขกที่พำนักในรีสอร์ทขณะนี้</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-forest-50 text-forest-800 border border-forest-100 flex items-center justify-center shrink-0">
              <Home size={20} className="stroke-[2.2]" />
            </div>
          </div>
        </div>

        {/* Card 3: Staying */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-forest-700 uppercase tracking-wider">พักต่อเนื่อง</p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
                {counts.staying}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">ห้อง</span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400">แขกที่ยังพักผ่อนต่อในวันถัดไป</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-forest-50 text-forest-800 border border-forest-100 flex items-center justify-center shrink-0">
              <CalendarCheck size={20} className="stroke-[2.2]" />
            </div>
          </div>
        </div>

        {/* Card 4: Due Today Notification */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-bamboo-800 uppercase tracking-wider">แจ้งเตือนคืนห้องวันนี้</p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
                {counts.departingToday}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">ห้อง</span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400 font-medium">
                {counts.departingToday > 0 ? "ห้องที่ครบกำหนดคืนกุญแจวันนี้" : "ไม่มีห้องต้องคืนวันนี้"}
              </p>
            </div>
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
              counts.departingToday > 0
                ? "bg-bamboo-50 border-bamboo-200 text-bamboo-800"
                : "bg-cream-100 border-cream-200 text-charcoal-400"
            }`}>
              <Bell size={20} className="stroke-[2.2]" />
            </div>
          </div>
        </div>
      </div>

      {/* Unified Search & Control Bar (Density & Sorting Tools for 100+ Rooms) */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white p-3 rounded-2xl shadow-panel border border-cream-200">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none" />
          <input
            type="text"
            placeholder="ค้นหาเลขจอง, ชื่อผู้จอง, เบอร์โทร, หมายเลขห้อง..."
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

        {/* Sorting and Layout Density Controls */}
        <div className="flex items-center gap-2 self-end md:self-auto flex-wrap">
          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 bg-cream-50 px-2.5 py-1.5 rounded-xl border border-cream-200 text-xs">
            <ArrowUpDown size={13} className="text-charcoal-400" />
            <span className="text-charcoal-500 hidden sm:inline">เรียงตาม:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "room" | "time" | "name")}
              className="bg-transparent font-semibold text-forest-900 focus:outline-none cursor-pointer"
            >
              <option value="time">เวลาคาดว่าจะถึง</option>
              <option value="room">หมายเลขห้อง (Room #)</option>
              <option value="name">ชื่อผู้เข้าพัก</option>
            </select>
          </div>

          {/* View Density Switcher */}
          <div className="flex items-center gap-1 bg-cream-100 p-1 rounded-xl">
            <button
              onClick={() => setDensityView("detailed")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                densityView === "detailed" ? "bg-white text-forest-900 shadow-sm" : "text-charcoal-500 hover:text-charcoal-800"
              }`}
              title="มุมมองการ์ดละเอียด"
            >
              <LayoutGrid size={14} />
              <span className="hidden sm:inline">การ์ด</span>
            </button>
            <button
              onClick={() => setDensityView("compact")}
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                densityView === "compact" ? "bg-white text-forest-900 shadow-sm" : "text-charcoal-500 hover:text-charcoal-800"
              }`}
              title="มุมมองแถวกะทัดรัด (สำหรับห้องจำนวนมาก)"
            >
              <List size={14} />
              <span className="hidden sm:inline">กะทัดรัด</span>
            </button>
          </div>
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
              <h2 className="font-display font-bold text-lg text-forest-900 flex items-center gap-1.5">
                รอเช็คอิน
                <span className="text-xs font-normal text-charcoal-400 font-sans">
                  ({arrivals.length})
                </span>
              </h2>
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
          <div className="space-y-3">
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
              paginatedArrivals.map((line) => {
                const actionable = isCheckinActionable(line);
                const { arrivalTime, note } = parseSpecialRequest(line.special_request, line.arrival_time);
                const nights = calculateNights(line.check_in, line.check_out);

                // --- COMPACT VIEW ROW ---
                if (densityView === "compact") {
                  return (
                    <div
                      key={line.booking_room_id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border bg-white border-cream-200/90 hover:border-forest-300 hover:shadow-xs transition-all duration-150"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-display font-bold text-xs text-charcoal-900 shrink-0">
                          {line.room_number}
                        </span>
                        <div className="min-w-0">
                          <p className="font-display font-bold text-xs text-charcoal-900 truncate">
                            {line.user_name || "ไม่ระบุชื่อ"}
                          </p>
                          <p className="text-[11px] text-charcoal-400 flex items-center gap-1 truncate font-mono">
                            <Phone size={10} /> {line.user_phone || "-"} • {formatThaiDate(line.check_in)} ({nights} คืน)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {arrivalTime && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-charcoal-500 font-mono">
                            <Clock size={10} className="text-charcoal-400" /> {arrivalTime} น.
                          </span>
                        )}
                        {actionable ? (
                          <button
                            onClick={() => handleCheckin(line)}
                            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 transition-all active:scale-95"
                          >
                            เช็คอิน
                          </button>
                        ) : (
                          <span className="text-[11px] text-charcoal-400 font-mono">
                            รอถึงวัน
                          </span>
                        )}
                      </div>
                    </div>
                  );
                }

                // --- DETAILED CARD VIEW ---
                return (
                  <div
                    key={line.booking_room_id}
                    className={`group relative rounded-2xl border p-4 sm:p-5 transition-all duration-200 ${
                      actionable
                        ? "bg-white border-cream-200/90 hover:border-forest-200 hover:shadow-md"
                        : "bg-cream-50/40 border-cream-200/70 opacity-90"
                    }`}
                  >
                    {/* Top Row: Room Pill + Status Tag */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-cream-100">
                      <div className="flex items-center gap-2">
                        {/* Room Number Badge (Soft & Calm) */}
                        <div className="px-3 py-1 rounded-xl bg-cream-100/90 border border-cream-300/70 font-display font-bold text-xs flex items-center gap-1.5 shadow-xs">
                          <BedDouble size={13} className="text-forest-700" />
                          <span className="text-forest-900">{line.room_number}</span>
                          <span className="text-charcoal-600 font-sans font-normal border-l border-cream-300 pl-1.5">
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

                    {/* Middle Row: Guest Details & Check-in CTA Button */}
                    <div className="pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 space-y-1.5 flex-1">
                        {/* Guest Name */}
                        <div className="flex items-center gap-2.5 flex-wrap">
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

                        {/* Guest Count */}
                        <div className="flex items-center gap-1.5 text-xs text-charcoal-500 pt-0.5">
                          <Users size={12} className="text-charcoal-400" />
                          <span>{formatGuestSummary(line)}</span>
                        </div>

                        {/* Badges: Arrival Time */}
                        {arrivalTime && (
                          <div className="flex items-center gap-2 flex-wrap pt-0.5">
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-forest-800 bg-cream-100 border border-cream-200 px-2.5 py-0.5 rounded-lg">
                              <Clock size={11} className="text-forest-700" />
                              <span>คาดว่าจะถึง {arrivalTime} น.</span>
                            </span>
                            {(timeToMinutes(arrivalTime) < timeToMinutes(checkinFrom) || timeToMinutes(arrivalTime) > timeToMinutes(checkinTo)) && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-bamboo-900 bg-bamboo-50 border border-bamboo-200 px-2 py-0.5 rounded-lg">
                                <AlertTriangle size={11} className="text-bamboo-700" />
                                <span>ถึงนอกเวลามาตรฐาน ({checkinFrom}-{checkinTo} น.)</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Action CTA Button */}
                      <div className="shrink-0 pt-1 sm:pt-0">
                        {actionable ? (
                          <button
                            onClick={() => handleCheckin(line)}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-bold text-white px-5 py-2.5 rounded-2xl bg-forest-800 hover:bg-forest-900 shadow-sm shadow-forest-800/20 transition-all active:scale-95 group/btn"
                          >
                            <LogIn size={15} className="group-hover/btn:translate-x-0.5 transition-transform" />
                            <span>เช็คอิน</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1 text-xs font-semibold text-charcoal-400 bg-cream-100 border border-cream-200 px-3 py-1.5 rounded-xl">
                            <Clock size={12} />
                            <span>รอถึงวัน {formatThaiDate(line.check_in)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Special Request Note (Full Width Framed Box) */}
                    {note && (
                      <div className="text-xs text-charcoal-700 bg-cream-100/70 border border-cream-200/90 rounded-xl px-3 py-2 mt-2.5 flex items-start gap-2">
                        <MessageSquare size={13} className="shrink-0 text-forest-700 mt-0.5" />
                        <span className="leading-relaxed font-medium">{note}</span>
                      </div>
                    )}

                    {/* Boat Addons (Full Width) */}
                    {renderBoatAddons(line)}
                  </div>
                );
              })
            )}
          </div>

          {/* Arrivals Pagination Footer */}
          {arrivals.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-cream-200 text-xs text-charcoal-500">
              <span>
                แสดง <strong className="text-forest-950 font-mono">{(arrivalPage - 1) * ITEMS_PER_PAGE + 1}</strong> - <strong className="text-forest-950 font-mono">{Math.min(arrivalPage * ITEMS_PER_PAGE, arrivals.length)}</strong> จาก <strong className="text-forest-950 font-mono">{arrivals.length}</strong> รายการ
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setArrivalPage((p) => Math.max(1, p - 1))}
                  disabled={arrivalPage === 1}
                  className="p-1.5 rounded-lg border border-cream-300 bg-white text-charcoal-700 disabled:opacity-40 hover:bg-cream-50 transition-colors shadow-2xs"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2.5 py-1 text-xs font-bold text-forest-900 font-mono">
                  {arrivalPage} / {totalArrivalPages}
                </span>
                <button
                  onClick={() => setArrivalPage((p) => Math.min(totalArrivalPages, p + 1))}
                  disabled={arrivalPage >= totalArrivalPages}
                  className="p-1.5 rounded-lg border border-cream-300 bg-white text-charcoal-700 disabled:opacity-40 hover:bg-cream-50 transition-colors shadow-2xs"
                  title="หน้าถัดไป"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
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
              <h2 className="font-display font-bold text-lg text-forest-900 flex items-center gap-1.5">
                กำลังพักอยู่ในรีสอร์ท
                <span className="text-xs font-normal text-charcoal-400 font-sans">
                  ({inHouse.length})
                </span>
              </h2>
            </div>

            {/* In-House Filter Segmented Control */}
            <div className="flex items-center gap-1 bg-cream-100 p-1 rounded-xl self-start sm:self-auto">
              {(
                [
                  ["all", "ทั้งหมด"],
                  ["today", "คืนห้องวันนี้"],
                  ["staying", "พักต่อเนื่อง"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setInHouseFilter(key)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    inHouseFilter === key
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
          <div className="space-y-3">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <RefreshCw size={28} className="animate-spin text-forest-700" />
                <p className="text-xs text-charcoal-400 font-medium">กำลังโหลดข้อมูลการเข้าพัก...</p>
              </div>
            ) : inHouse.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center p-6 bg-cream-50/60 rounded-3xl border border-dashed border-cream-300">
                <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-cream-200 text-forest-700 flex items-center justify-center mb-3">
                  <Home size={28} className="stroke-[1.5]" />
                </div>
                <p className="font-display font-bold text-base text-forest-900">
                  {inHouseFilter === "today"
                    ? "ไม่มีห้องที่ต้องคืนวันนี้"
                    : inHouseFilter === "staying"
                    ? "ไม่มีห้องที่พักต่อเนื่อง"
                    : "ไม่มีผู้เข้าพักในขณะนี้"}
                </p>
                <p className="text-xs text-charcoal-400 max-w-xs mt-1 leading-relaxed">
                  {search
                    ? `ไม่พบรายการที่ตรงกับ "${search}" ลองเปลี่ยนคำค้นหา`
                    : inHouseFilter === "today"
                    ? "ไม่มีห้องพักที่มีกำหนดเช็คเอาต์ในวันนี้ หรือเช็คเอาต์ส่งมอบกุญแจครบหมดแล้ว"
                    : inHouseFilter === "staying"
                    ? "ไม่มีผู้เข้าพักที่จองพักข้ามวันถัดไปในขณะนี้"
                    : "เมื่อมีผู้เข้าพักเช็คอิน รายการห้องและแขกที่พำนักอยู่จะแสดงในคอลัมน์นี้เพื่อเตรียมเช็คเอาต์"}
                </p>
              </div>
            ) : (
              paginatedInHouse.map((line) => {
                const isDueToday = localDateStr(line.check_out) <= today;
                const { note } = parseSpecialRequest(line.special_request, line.arrival_time);
                const nights = calculateNights(line.check_in, line.check_out);

                // --- COMPACT VIEW ROW ---
                if (densityView === "compact") {
                  return (
                    <div
                      key={line.booking_room_id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-2xl border bg-white border-cream-200/90 hover:border-forest-300 hover:shadow-xs transition-all duration-150"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-display font-bold text-xs text-charcoal-900 shrink-0">
                          {line.room_number}
                        </span>
                        <div className="min-w-0">
                          <p className="font-display font-bold text-xs text-charcoal-900 truncate">
                            {line.user_name || "ไม่ระบุชื่อ"}
                          </p>
                          <p className="text-[11px] text-charcoal-400 flex items-center gap-1 truncate font-mono">
                            <Phone size={10} /> {line.user_phone || "-"} • ออก {formatThaiDate(line.check_out)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isDueToday && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-charcoal-600 bg-cream-100 px-2 py-0.5 rounded-md">
                            <Bell size={10} className="text-charcoal-500" /> คืนห้องวันนี้
                          </span>
                        )}
                        <button
                          onClick={() => handleCheckout(line)}
                          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white bg-forest-800 hover:bg-forest-900 transition-all active:scale-95"
                        >
                          เช็คเอาต์
                        </button>
                      </div>
                    </div>
                  );
                }

                // --- DETAILED CARD VIEW ---
                return (
                  <div
                    key={line.booking_room_id}
                    className="group relative rounded-2xl border p-4 sm:p-5 transition-all duration-200 bg-white border-cream-200/90 hover:border-forest-200 hover:shadow-md"
                  >
                    {/* Top Row: Room Number & Checkout Date */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pb-3 border-b border-cream-100">
                      <div className="flex items-center gap-2">
                        {/* Room Badge (Soft & Calm) */}
                        <div className="px-3 py-1 rounded-xl bg-cream-100/90 border border-cream-300/70 font-display font-bold text-xs flex items-center gap-1.5 shadow-xs">
                          <BedDouble size={13} className="text-forest-700" />
                          <span className="text-forest-900">{line.room_number}</span>
                          <span className="text-charcoal-600 font-sans font-normal border-l border-cream-300 pl-1.5">
                            {line.room_name}
                          </span>
                        </div>
                      </div>

                      {/* Checkout Status Tag */}
                      <div>
                        {isDueToday ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-charcoal-700 font-medium bg-cream-100/90 border border-cream-200 px-3 py-1 rounded-xl shadow-xs">
                            <Bell size={12} className="text-charcoal-500 stroke-[2.2]" /> แจ้งเตือนคืนห้องวันนี้ ({formatThaiDate(line.check_out)})
                          </span>
                        ) : (
                          <span className="text-xs text-charcoal-600 bg-cream-100 px-2.5 py-1 rounded-xl font-mono font-medium">
                            พักต่อเนื่อง • ออก {formatThaiDate(line.check_out)} ({nights} คืน)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Middle Row: Guest Info & Check-out CTA Button */}
                    <div className="pt-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="min-w-0 space-y-1.5 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="font-display font-bold text-sm sm:text-base text-forest-950 truncate">
                            {line.user_name || "ไม่ระบุชื่อ"}
                          </h3>
                          <div className="flex items-center gap-1 text-xs text-charcoal-500 font-mono">
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

                        {/* Guest Count */}
                        <div className="flex items-center gap-1.5 text-xs text-charcoal-500 pt-0.5">
                          <Users size={12} className="text-charcoal-400" />
                          <span>{formatGuestSummary(line)}</span>
                        </div>
                      </div>

                      {/* Action CTA: Check-out Button */}
                      <div className="shrink-0 pt-1 sm:pt-0">
                        <button
                          onClick={() => handleCheckout(line)}
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 text-xs font-bold text-white px-5 py-2.5 rounded-2xl bg-forest-800 hover:bg-forest-900 shadow-sm shadow-forest-800/20 transition-all active:scale-95 group/btn"
                        >
                          <LogOut size={15} className="group-hover/btn:translate-x-0.5 transition-transform" />
                          <span>เช็คเอาต์</span>
                        </button>
                      </div>
                    </div>

                    {/* Special Request Note (Full Width Framed Box) */}
                    {note && (
                      <div className="text-xs text-charcoal-700 bg-cream-100/70 border border-cream-200/90 rounded-xl px-3 py-2 mt-2.5 flex items-start gap-2">
                        <MessageSquare size={13} className="shrink-0 text-forest-700 mt-0.5" />
                        <span className="leading-relaxed font-medium">{note}</span>
                      </div>
                    )}

                    {/* Boat Addons (Full Width) */}
                    {renderBoatAddons(line)}
                  </div>
                );
              })
            )}
          </div>

          {/* In-House Pagination Footer */}
          {inHouse.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-cream-200 text-xs text-charcoal-500">
              <span>
                แสดง <strong className="text-forest-950 font-mono">{(inHousePage - 1) * ITEMS_PER_PAGE + 1}</strong> - <strong className="text-forest-950 font-mono">{Math.min(inHousePage * ITEMS_PER_PAGE, inHouse.length)}</strong> จาก <strong className="text-forest-950 font-mono">{inHouse.length}</strong> รายการ
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setInHousePage((p) => Math.max(1, p - 1))}
                  disabled={inHousePage === 1}
                  className="p-1.5 rounded-lg border border-cream-300 bg-white text-charcoal-700 disabled:opacity-40 hover:bg-cream-50 transition-colors shadow-2xs"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2.5 py-1 text-xs font-bold text-forest-900 font-mono">
                  {inHousePage} / {totalInHousePages}
                </span>
                <button
                  onClick={() => setInHousePage((p) => Math.min(totalInHousePages, p + 1))}
                  disabled={inHousePage >= totalInHousePages}
                  className="p-1.5 rounded-lg border border-cream-300 bg-white text-charcoal-700 disabled:opacity-40 hover:bg-cream-50 transition-colors shadow-2xs"
                  title="หน้าถัดไป"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
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
