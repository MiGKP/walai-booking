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
} from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { PageHeader, StatCard, Panel, EmptyState, Modal } from "@/components/admin/ui";

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
  boat_addons: BoatAddon[];
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
      notify.success("บันทึกช่วงเวลาเช็คอินแล้ว");
    } catch (err: any) {
      notify.error(err.response?.data?.message || "บันทึกไม่สำเร็จ");
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
          notify.success("เช็คอินสำเร็จ");
          fetchBookings();
        } catch (err: any) {
          notify.error(err.response?.data?.message || "เช็คอินไม่สำเร็จ");
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
          notify.success("เช็คเอาต์สำเร็จ");
          fetchBookings();
        } catch (err: any) {
          notify.error(err.response?.data?.message || "เช็คเอาต์ไม่สำเร็จ");
        }
      },
    });
  };

  // พิมพ์บัตรเสริมเรือเป็นสลิปกระดาษให้ลูกค้า (มีรอบวันที่/เวลาระบุชัดเจน)
  const printAddonTicket = (addon: BoatAddon, line: FlatLine) => {
    const w = window.open("", "_blank", "width=420,height=640");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>บัตรเสริมเรือ</title>
      <meta charset="utf-8" />
      <style>
        body { font-family: 'Sarabun', 'Segoe UI', sans-serif; padding: 28px; color: #1c1c1c; }
        h1 { font-size: 18px; margin: 0 0 2px; color: #0b3b2c; }
        .sub { font-size: 11px; color: #888; margin-bottom: 16px; }
        .box { border: 2px dashed #0b3b2c; border-radius: 14px; padding: 18px; }
        .row { margin: 10px 0; }
        .label { font-size: 10.5px; color: #888; text-transform: uppercase; letter-spacing: .03em; }
        .value { font-size: 15px; font-weight: 700; margin-top: 2px; }
        .footer { margin-top: 18px; font-size: 10.5px; color: #999; text-align: center; }
      </style>
      </head><body>
        <h1>บัตรเสริมเรือ</h1>
        <p class="sub">สวนลัยรุกเวช — โปรดนำบัตรนี้มาแสดงที่ท่าเรือ</p>
        <div class="box">
          <div class="row"><div class="label">ลูกค้า</div><div class="value">${line.user_name || "-"}</div></div>
          <div class="row"><div class="label">ห้องพัก</div><div class="value">${line.room_name} #${line.room_number}</div></div>
          <div class="row"><div class="label">ประเภทเรือ</div><div class="value">${addon.boat_type_name}</div></div>
          <div class="row"><div class="label">วันที่ / เวลา</div><div class="value">${formatThaiDate(String(addon.booking_date).slice(0, 10))} · ${String(addon.start_time).slice(0, 5)}-${String(addon.end_time).slice(0, 5)} น.</div></div>
          <div class="row"><div class="label">จำนวนเรือ / ผู้โดยสาร</div><div class="value">${addon.boat_count} ลำ / ${addon.num_passengers} คน</div></div>
          <div class="row"><div class="label">ประเภทบัตร</div><div class="value">${addon.mode === "paid" ? `เสริม (ชำระแล้ว ฿${Number(addon.price).toLocaleString()})` : "แถมฟรีจากโปรโมชั่น"}</div></div>
        </div>
        <div style="margin-top: 24px; padding: 14px; background: #f9f9f9; border-radius: 10px;">
          <h2 style="font-size: 13px; margin: 0 0 6px; color: #333;">ข้อควรปฏิบัติ</h2>
          <ul style="font-size: 11px; color: #555; padding-left: 18px; margin: 0 0 12px; line-height: 1.5;">
            <li>ต้องสวมเสื้อชูชีพตลอดเวลาขณะอยู่บนเรือ</li>
            <li>ห้ามดื่มเครื่องดื่มแอลกอฮอล์บนเรือ</li>
            <li>กรุณามาถึงท่าเรือก่อนรอบเวลา 15 นาที</li>
          </ul>
          <h2 style="font-size: 13px; margin: 0 0 6px; color: #333;">สิ่งที่ควรมีบนเรือ</h2>
          <ul style="font-size: 11px; color: #555; padding-left: 18px; margin: 0; line-height: 1.5;">
            <li>น้ำดื่ม 1 ขวด / หมวกกันแดด</li>
            <li>ถุงกันน้ำสำหรับใส่โทรศัพท์มือถือ</li>
          </ul>
        </div>
        <p class="footer">พิมพ์เมื่อ ${new Date().toLocaleString("th-TH")}</p>
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
    } catch (err: any) {
      notify.error(err.response?.data?.message || "บันทึกการมอบบัตรไม่สำเร็จ");
    }
  };

  const renderBoatAddons = (line: FlatLine) => {
    if (!line.boat_addons || line.boat_addons.length === 0) return null;
    return (
      <div className="mt-1.5 space-y-1">
        {line.boat_addons.map((addon) => (
          <div
            key={addon.boat_booking_id}
            className="flex items-center justify-between gap-2 text-xs bg-sky-50 border border-sky-200/70 rounded-md px-2 py-1"
          >
            <span className="flex items-center gap-1 text-sky-800">
              <Ship size={11} />
              {addon.boat_type_name} · {formatThaiDate(String(addon.booking_date).slice(0, 10))} ·{" "}
              {String(addon.start_time).slice(0, 5)}-{String(addon.end_time).slice(0, 5)} · {addon.boat_count} ลำ
            </span>
            {addon.handed_out_at ? (
              <span className="inline-flex items-center gap-1 text-teal-700 font-semibold shrink-0">
                <Check size={11} /> มอบแล้ว
              </span>
            ) : (
              <button
                onClick={() => handlePrintAndHandOut(addon, line)}
                className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-900 font-semibold shrink-0"
              >
                <Printer size={11} />
                พิมพ์ + มอบบัตร
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="เช็คอิน-เช็คเอาต์"
        description="หน้าเคาน์เตอร์สำหรับรับเช็คอินและคืนกุญแจเช็คเอาต์ผู้เข้าพัก"
        actions={
          <>
            <div className="relative">
              <button
                onClick={() => {
                  setSettingsDraft({ from: checkinFrom, to: checkinTo });
                  setSettingsOpen((v) => !v);
                }}
                className="px-3.5 py-2 text-charcoal-700 bg-white hover:bg-charcoal-50 rounded-xl border border-charcoal-200 shadow-sm transition-all text-sm font-medium flex items-center gap-2 active:scale-95"
                title="ตั้งค่าช่วงเวลาเช็คอิน"
              >
                <Clock size={16} className="text-charcoal-500" />
                <span>{checkinFrom}-{checkinTo} น.</span>
                <Settings size={14} className="text-charcoal-400" />
              </button>
              {settingsOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white border border-charcoal-200 rounded-2xl shadow-xl z-50 p-4">
                  <p className="text-sm font-bold text-charcoal-800 mb-2">ช่วงเวลาเช็คอินปกติ</p>
                  <p className="text-xs text-charcoal-500 mb-4">
                    ใช้แสดงเตือนเฉยๆ ไม่ได้ปิดกั้นการเช็คอิน พนักงานยังยืนยันเช็คอินนอกเวลาได้ตามดุลยพินิจ
                  </p>
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      type="time"
                      value={settingsDraft.from}
                      onChange={(e) => setSettingsDraft((s) => ({ ...s, from: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-charcoal-200 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/20"
                    />
                    <span className="text-charcoal-400">–</span>
                    <input
                      type="time"
                      value={settingsDraft.to}
                      onChange={(e) => setSettingsDraft((s) => ({ ...s, to: e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border border-charcoal-200 text-sm focus:outline-none focus:ring-2 focus:ring-forest-500/20"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setSettingsOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-charcoal-600 bg-charcoal-50 hover:bg-charcoal-100 rounded-lg transition-colors"
                    >
                      ยกเลิก
                    </button>
                    <button
                      onClick={handleSaveSettings}
                      disabled={savingSettings}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-forest-700 hover:bg-forest-800 rounded-lg transition-colors disabled:opacity-60"
                    >
                      <Save size={14} />
                      บันทึก
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={fetchBookings}
              className="px-3.5 py-2 text-charcoal-700 bg-white hover:bg-charcoal-50 rounded-xl border border-charcoal-200 shadow-sm transition-all text-sm font-medium flex items-center gap-2 active:scale-95"
            >
              <RefreshCw size={16} className={loading ? "animate-spin text-forest-700" : "text-charcoal-500"} />
              <span>รีเฟรชข้อมูล</span>
            </button>
          </>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="มาถึงวันนี้" value={counts.arrivalsToday} icon={<LogIn />} tone="forest" />
        <StatCard label="กำลังพักอยู่" value={counts.inHouse} icon={<Home />} tone="lagoon" />
        <StatCard label="ออกวันนี้" value={counts.departingToday} icon={<LogOut />} tone="bamboo" />
        <StatCard label="เลยกำหนดออก" value={counts.overdue} icon={<AlertTriangle />} tone="rose" />
      </div>

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
        <Panel
          title="รอเช็คอิน"
          actions={
            <div className="flex items-center gap-1 bg-charcoal-50 p-1 rounded-lg">
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
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    arrivalFilter === key
                      ? "bg-white text-forest-700 shadow-sm"
                      : "text-charcoal-500 hover:text-charcoal-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          }
          className="flex flex-col"
        >
          <div className="divide-y divide-charcoal-50 max-h-[650px] overflow-y-auto -mx-5 px-5">
            {loading ? (
              <div className="py-16 flex justify-center">
                <RefreshCw size={24} className="animate-spin text-forest-700" />
              </div>
            ) : arrivals.length === 0 ? (
              <EmptyState title="ไม่มีรายการรอเช็คอิน" />
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
                        <p className="text-xs text-stone-500 flex items-center gap-1">
                          <Phone size={10} />
                          {line.user_phone || "-"}
                        </p>
                        <p className="text-xs text-stone-600 flex items-center gap-1 mt-0.5 flex-wrap">
                          <BedDouble size={11} className="text-stone-400" />
                          {line.room_name} #{line.room_number}
                          <span className="text-stone-300">•</span>
                          <span className="font-mono">{formatThaiDate(line.check_in)} → {formatThaiDate(line.check_out)}</span>
                        </p>
                        <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                          <Users size={11} className="text-stone-400" />
                          {formatGuestSummary(line)}
                        </p>
                        {line.special_request && (
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200/70 rounded-md px-2 py-1 mt-1 flex items-start gap-1 max-w-md">
                            <MessageSquare size={11} className="shrink-0 mt-0.5" />
                            <span>{line.special_request}</span>
                          </p>
                        )}
                        {outsideWindow && (
                          <p className="text-xs text-amber-600 font-semibold flex items-center gap-1 mt-1">
                            <Clock size={10} /> นอกเวลาเช็คอินปกติ ({checkinFrom}-{checkinTo} น.)
                          </p>
                        )}
                        {renderBoatAddons(line)}
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
                      <span className="text-xs text-stone-400 italic shrink-0 mt-1.5">
                        รอถึงวันที่ {formatThaiDate(line.check_in)}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Panel>

        {/* In-house */}
        <Panel title="กำลังพักอยู่ในรีสอร์ท" className="flex flex-col">
          <div className="divide-y divide-charcoal-50 max-h-[650px] overflow-y-auto -mx-5 px-5">
            {loading ? (
              <div className="py-16 flex justify-center">
                <RefreshCw size={24} className="animate-spin text-forest-700" />
              </div>
            ) : inHouse.length === 0 ? (
              <EmptyState title="ไม่มีผู้เข้าพักในขณะนี้" />
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
                        <p className="text-xs text-stone-500 flex items-center gap-1">
                          <Phone size={10} />
                          {line.user_phone || "-"}
                        </p>
                        <p className="text-xs text-stone-600 flex items-center gap-1.5 mt-0.5 flex-wrap">
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
                        <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                          <Users size={11} className="text-stone-400" />
                          {formatGuestSummary(line)}
                        </p>
                        {line.special_request && (
                          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200/70 rounded-md px-2 py-1 mt-1 flex items-start gap-1 max-w-md">
                            <MessageSquare size={11} className="shrink-0 mt-0.5" />
                            <span>{line.special_request}</span>
                          </p>
                        )}
                        {renderBoatAddons(line)}
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
        </Panel>
      </div>

      {/* Confirm Modal */}
      <Modal
        open={!!confirmModal?.open}
        title={confirmModal?.title || ""}
        onClose={() => setConfirmModal(null)}
        footer={
          <>
            <button
              onClick={() => setConfirmModal(null)}
              className="px-4 py-2 text-sm font-medium text-charcoal-600 bg-charcoal-50 hover:bg-charcoal-100 rounded-lg transition-colors"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => {
                confirmModal?.onConfirm();
                setConfirmModal(null);
              }}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${confirmModal?.confirmColor}`}
            >
              {confirmModal?.confirmText}
            </button>
          </>
        }
      >
        <p className="text-sm text-charcoal-600">{confirmModal?.text}</p>
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
