"use client";

import { useEffect, useState, useRef } from "react";
import dynamic from "next/dynamic";
import {
  Save,
  Building2,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  Clock,
  Globe,
  Map,
  Loader2,
  ChevronDown,
  Check,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  ExternalLink,
  Maximize2,
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import MapPickerModal from "@/components/admin/MapPickerModal";
import { Modal } from "@/components/admin/ui";

// Dynamic import LeafletMap with SSR disabled
const LeafletMap = dynamic(() => import("@/components/admin/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[220px] bg-cream-100/70 animate-pulse flex flex-col items-center justify-center text-xs text-charcoal-400 gap-2">
      <Loader2 className="w-5 h-5 animate-spin text-forest-800" />
      <span>กำลังโหลดแผนที่...</span>
    </div>
  ),
});

// รายการวันทั้งหมดในสัปดาห์
const DAYS_OPTIONS = [
  { label: "จันทร์", full: "จันทร์" },
  { label: "อังคาร", full: "อังคาร" },
  { label: "พุธ", full: "พุธ" },
  { label: "พฤหัสบดี", full: "พฤหัสบดี" },
  { label: "ศุกร์", full: "ศุกร์" },
  { label: "เสาร์", full: "เสาร์" },
  { label: "อาทิตย์", full: "อาทิตย์" },
];

export default function RoomLocationPage() {
  // อนุญาตให้ admin และ room_staff เข้าถึงได้
  const { ready } = useAuthGuard({
    allowedRoles: ["admin", "room_staff"],
  });

  const [recordId, setRecordId] = useState<number | string | null>(4);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    line_id: "",
    facebook: "",
    address: "",
    coordinates: "",
    operating_days: "",
    operating_hours: "",
    additional_terms: "",
  });
  const [termsList, setTermsList] = useState<string[]>([""]);

  const handleTermChange = (index: number, value: string) => {
    const updated = [...termsList];
    updated[index] = value;
    setTermsList(updated);
    setForm((f) => ({
      ...f,
      additional_terms: updated.filter(Boolean).join("\n"),
    }));
  };

  const handleAddTerm = () => {
    setTermsList([...termsList, ""]);
  };

  const handleRemoveTerm = (index: number) => {
    const updated = termsList.filter((_, i) => i !== index);
    const finalTerms = updated.length > 0 ? updated : [""];
    setTermsList(finalTerms);
    setForm((f) => ({
      ...f,
      additional_terms: finalTerms.filter(Boolean).join("\n"),
    }));
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

  // State สำหรับ Modal ยืนยันและแจ้งเตือนผลลัพธ์
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    type: "success" | "error";
    title: string;
    message: string;
  }>({
    isOpen: false,
    type: "success",
    title: "",
    message: "",
  });

  // State สำหรับการเลือกวันเปิดทำการ (Dropdown)
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [openDaysDropdown, setOpenDaysDropdown] = useState(false);
  const daysRef = useRef<HTMLDivElement>(null);

  // State & Ref สำหรับ Custom Dropdown เวลาเปิด-ปิด
  const [openStart, setOpenStart] = useState(false);
  const [openEnd, setOpenEnd] = useState(false);
  const startRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // รายการเวลา 00:00 น. - 23:30 น. (ทุกๆ 30 นาที)
  const timeOptions = Array.from({ length: 48 }, (_, i) => {
    const hour = String(Math.floor(i / 2)).padStart(2, "0");
    const min = i % 2 === 0 ? "00" : "30";
    return `${hour}:${min} น.`;
  });

  // ถอดค่าเวลาเปิด-ปิดจาก operating_hours (ค่าเริ่มต้น 14:00 น. - 20:00 น.)
  const startTime = form.operating_hours?.split(" - ")[0] || "14:00 น.";
  const endTime = form.operating_hours?.split(" - ")[1] || "20:00 น.";

  // แปลงค่า String จาก DB เข้าสู่อาร์เรย์วัน
  const parseDaysStringToArray = (str: string): string[] => {
    if (!str) return [];
    if (str === "เปิดทุกวัน") return DAYS_OPTIONS.map((d) => d.full);
    if (str === "จันทร์ - ศุกร์")
      return ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
    if (str === "เสาร์ - อาทิตย์") return ["เสาร์", "อาทิตย์"];
    return str
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  };

  // แปลง Array วัน กลับมาเป็นข้อความ String รูปแบบกระชับ
  const formatDaysToString = (days: string[]): string => {
    if (days.length === 0) return "ยังไม่ได้เลือกวัน";
    if (days.length === 7) return "เปิดทุกวัน";

    const isMonToFri =
      days.length === 5 &&
      ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"].every((d) =>
        days.includes(d)
      );
    if (isMonToFri) return "จันทร์ - ศุกร์";

    const isSatToSun =
      days.length === 2 && ["เสาร์", "อาทิตย์"].every((d) => days.includes(d));
    if (isSatToSun) return "เสาร์ - อาทิตย์";

    return days.join(", ");
  };

  // แปลงพิกัด string เป็น tuple [lat, lng]
  const parseCoordsTuple = (coords: string): [number, number] => {
    if (coords) {
      const parts = coords.split(",").map((p) => parseFloat(p.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return [parts[0], parts[1]];
      }
    }
    return [16.219313, 103.329219];
  };

  // ตรวจจับการคลิกนอก Custom Dropdown เพื่อปิดเมนู
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (startRef.current && !startRef.current.contains(e.target as Node)) {
        setOpenStart(false);
      }
      if (endRef.current && !endRef.current.contains(e.target as Node)) {
        setOpenEnd(false);
      }
      if (daysRef.current && !daysRef.current.contains(e.target as Node)) {
        setOpenDaysDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!ready) return;

    setLoading(true);
    api
      .get("/settings/resort")
      .then((res) => {
        const rawData = res.data?.data;

        if (rawData) {
          let d: any = null;

          if (Array.isArray(rawData)) {
            d =
              rawData.find(
                (item: any) =>
                  item.id === 4 || item.name?.includes("ห้องพัก")
              ) ||
              rawData[1] ||
              rawData[0];
          } else {
            d = rawData;
          }

          if (d) {
            setRecordId(d.id || 4);
            const daysStr = d.operating_days ?? "";

            setForm({
              name: d.name || "เคาน์เตอร์ต้อนรับห้องพัก",
              phone: d.phone || "",
              email: d.email || "",
              line_id: d.line_id || "",
              facebook: d.facebook || "",
              address: d.address || "",
              coordinates: d.coordinates || "",
              operating_days: daysStr,
              operating_hours: d.operating_hours || "",
              additional_terms: d.additional_terms || "",
            });
            setSelectedDays(parseDaysStringToArray(daysStr));
            const termsStr = d.additional_terms || "";
            const parsedTerms = termsStr
              ? termsStr
                  .split("\n")
                  .map((item: string) => item.trim())
                  .filter(Boolean)
              : [""];
            setTermsList(parsedTerms.length > 0 ? parsedTerms : [""]);
          }
        }
      })
      .catch((err) => {
        console.error(err);
        notify.error("โหลดข้อมูลจุดบริการห้องพักไม่สำเร็จ");
      })
      .finally(() => setLoading(false));
  }, [ready]);

  const handleDayToggle = (day: string) => {
    let updated: string[];
    if (selectedDays.includes(day)) {
      updated = selectedDays.filter((d) => d !== day);
    } else {
      const allDays = DAYS_OPTIONS.map((d) => d.full);
      updated = [...selectedDays, day].sort(
        (a, b) => allDays.indexOf(a) - allDays.indexOf(b)
      );
    }
    setSelectedDays(updated);
    setForm((f) => ({ ...f, operating_days: formatDaysToString(updated) }));
  };

  const handleQuickSelectDays = (type: "all" | "weekday" | "weekend") => {
    let days: string[] = [];
    if (type === "all") days = DAYS_OPTIONS.map((d) => d.full);
    else if (type === "weekday")
      days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"];
    else if (type === "weekend") days = ["เสาร์", "อาทิตย์"];

    setSelectedDays(days);
    setForm((f) => ({ ...f, operating_days: formatDaysToString(days) }));
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const confirmSave = async () => {
    setShowConfirmModal(false);
    setSaving(true);
    try {
      await api.put("/settings/resort", {
        ...form,
        additional_terms: termsList.filter(Boolean).join("\n"),
        id: recordId || 4,
      });

      setStatusModal({
        isOpen: true,
        type: "success",
        title: "บันทึกข้อมูลสำเร็จ!",
        message: "ระบบได้ทำการปรับปรุงข้อมูลจุดบริการห้องพักและล็อบบี้เรียบร้อยแล้วค่ะ",
      });
    } catch (err: unknown) {
      setStatusModal({
        isOpen: true,
        type: "error",
        title: "เกิดข้อผิดพลาด",
        message: getApiErrorMessage(
          err,
          "ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้ง"
        ),
      });
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-12 font-sans">
      {/* Top Header Card (NO subtitle under Heading 1) */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-800/10">
            <Building2 size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-forest-900 tracking-tight">
              ตั้งค่าจุดบริการห้องพัก & ล็อบบี้
            </h1>
          </div>
        </div>

        <button
          type="button"
          disabled={saving || loading}
          onClick={handleFormSubmit}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-forest-800 hover:bg-forest-900 text-white font-bold text-xs rounded-2xl transition-all shadow-2xs shrink-0 cursor-pointer disabled:opacity-50 active:scale-95"
        >
          {saving ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>กำลังบันทึก...</span>
            </>
          ) : (
            <>
              <Save size={16} />
              <span>บันทึกการเปลี่ยนแปลง</span>
            </>
          )}
        </button>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-6">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
            <div className="bg-cream-100/70 h-[450px] rounded-3xl border border-cream-200" />
            <div className="bg-cream-100/70 h-[450px] rounded-3xl border border-cream-200" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">
            {/* ฝั่งซ้าย: ข้อมูลการติดต่อจุดต้อนรับ + เงื่อนไขเพิ่มเติม */}
            <div className="space-y-6">
              {/* การ์ด 1: ข้อมูลการติดต่อจุดต้อนรับ */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/90 space-y-4">
                <div className="flex items-center gap-2.5 pb-4 border-b border-cream-200">
                  <div className="w-8 h-8 rounded-xl bg-forest-50 text-forest-800 border border-forest-200/80 flex items-center justify-center">
                    <Building2 size={17} />
                  </div>
                  <h2 className="text-base font-bold text-forest-900">
                    ข้อมูลติดต่อจุดต้อนรับ (Lobby)
                  </h2>
                </div>

                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                      ชื่อสถานที่ / ล็อบบี้ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3.5 py-2.5 bg-cream-50/60 focus:bg-white border border-cream-200 focus:border-forest-800 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 transition-all shadow-2xs"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="เช่น เคาน์เตอร์ต้อนรับห้องพัก"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-charcoal-700 mb-1.5 flex items-center gap-1.5">
                        <Phone size={14} className="text-charcoal-400" />{" "}
                        เบอร์โทรศัพท์
                      </label>
                      <input
                        type="text"
                        className="w-full px-3.5 py-2.5 bg-cream-50/60 focus:bg-white border border-cream-200 focus:border-forest-800 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 transition-all shadow-2xs font-mono"
                        value={form.phone}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, phone: e.target.value }))
                        }
                        placeholder="08x-xxx-xxxx"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-charcoal-700 mb-1.5 flex items-center gap-1.5">
                        <Mail size={14} className="text-charcoal-400" /> อีเมล
                      </label>
                      <input
                        type="email"
                        className="w-full px-3.5 py-2.5 bg-cream-50/60 focus:bg-white border border-cream-200 focus:border-forest-800 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 transition-all shadow-2xs"
                        value={form.email}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, email: e.target.value }))
                        }
                        placeholder="room@walai.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-charcoal-700 mb-1.5 flex items-center gap-1.5">
                        <MessageCircle size={14} className="text-charcoal-400" />{" "}
                        Line ID
                      </label>
                      <input
                        type="text"
                        className="w-full px-3.5 py-2.5 bg-cream-50/60 focus:bg-white border border-cream-200 focus:border-forest-800 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 transition-all shadow-2xs"
                        value={form.line_id}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, line_id: e.target.value }))
                        }
                        placeholder="@room_walai"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-charcoal-700 mb-1.5 flex items-center gap-1.5">
                        <Globe size={14} className="text-charcoal-400" /> Facebook
                      </label>
                      <input
                        type="text"
                        className="w-full px-3.5 py-2.5 bg-cream-50/60 focus:bg-white border border-cream-200 focus:border-forest-800 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 transition-all shadow-2xs"
                        value={form.facebook}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, facebook: e.target.value }))
                        }
                        placeholder="facebook.com/walai.room"
                      />
                    </div>
                  </div>

                  {/* วันเปิดทำการ และ เวลาทำการ */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* วันเปิดทำการ */}
                    <div className="relative" ref={daysRef}>
                      <label className="block text-xs font-bold text-charcoal-700 mb-1.5 flex items-center gap-1.5">
                        <Calendar size={14} className="text-forest-800" />{" "}
                        วันเปิดทำการ
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setOpenDaysDropdown(!openDaysDropdown);
                          setOpenStart(false);
                          setOpenEnd(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 bg-cream-50/60 border rounded-xl text-xs font-medium transition-all cursor-pointer ${
                          openDaysDropdown
                            ? "border-forest-800 ring-2 ring-forest-800/20 bg-white"
                            : "border-cream-200 hover:border-cream-300"
                        }`}
                      >
                        <span
                          className={`truncate ${
                            form.operating_days
                              ? "text-charcoal-800 font-bold"
                              : "text-charcoal-400"
                          }`}
                        >
                          {form.operating_days || "เลือกวันเปิดทำการ"}
                        </span>
                        <ChevronDown
                          size={14}
                          className={`text-charcoal-400 transition-transform duration-200 shrink-0 ml-1 ${
                            openDaysDropdown ? "rotate-180 text-forest-800" : ""
                          }`}
                        />
                      </button>

                      {openDaysDropdown && (
                        <div className="absolute left-0 top-full mt-1.5 w-full bg-white border border-cream-200 rounded-2xl shadow-xl z-50 p-3.5 space-y-3 animate-in fade-in duration-150">
                          <div className="space-y-1.5">
                            <span className="text-[11px] font-bold text-charcoal-400 uppercase tracking-wider block px-1">
                              ตัวเลือกลัด
                            </span>
                            <div className="grid grid-cols-3 gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleQuickSelectDays("all")}
                                className="px-2 py-1.5 text-xs font-bold bg-forest-50 text-forest-800 hover:bg-forest-100 rounded-xl transition-colors cursor-pointer text-center"
                              >
                                เปิดทุกวัน
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickSelectDays("weekday")}
                                className="px-2 py-1.5 text-xs font-bold bg-cream-100 text-charcoal-700 hover:bg-cream-200 rounded-xl transition-colors cursor-pointer text-center"
                              >
                                จ. - ศ.
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickSelectDays("weekend")}
                                className="px-2 py-1.5 text-xs font-bold bg-cream-100 text-charcoal-700 hover:bg-cream-200 rounded-xl transition-colors cursor-pointer text-center"
                              >
                                ส. - อา.
                              </button>
                            </div>
                          </div>

                          <div className="border-t border-cream-200 pt-2.5 space-y-1">
                            <span className="text-[11px] font-bold text-charcoal-400 uppercase tracking-wider block px-1">
                              เลือกแยกตามวัน
                            </span>
                            <div className="space-y-1 max-h-44 overflow-y-auto pr-1">
                              {DAYS_OPTIONS.map((day) => {
                                const isChecked = selectedDays.includes(
                                  day.full
                                );
                                return (
                                  <button
                                    key={day.full}
                                    type="button"
                                    onClick={() => handleDayToggle(day.full)}
                                    className={`w-full flex items-center justify-between px-3 py-1.5 text-xs rounded-xl transition-colors cursor-pointer ${
                                      isChecked
                                        ? "bg-forest-50 text-forest-800 font-bold"
                                        : "text-charcoal-700 hover:bg-cream-50 font-medium"
                                    }`}
                                  >
                                    <span>วัน{day.label}</span>
                                    <div
                                      className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                        isChecked
                                          ? "bg-forest-800 border-forest-800 text-white"
                                          : "border-cream-300 bg-white"
                                      }`}
                                    >
                                      {isChecked && <Check size={12} />}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* เวลาทำการ Check-in */}
                    <div>
                      <label className="block text-xs font-bold text-charcoal-700 mb-1.5 flex items-center gap-1.5">
                        <Clock size={14} className="text-forest-700" />{" "}
                        เวลาทำการ (Check-in)
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        {/* เวลาเริ่ม */}
                        <div className="relative" ref={startRef}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-charcoal-500">
                              เวลาเริ่ม
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenStart(!openStart);
                              setOpenEnd(false);
                              setOpenDaysDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 bg-cream-50/60 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              openStart
                                ? "border-forest-800 ring-2 ring-forest-800/20 bg-white"
                                : "border-cream-200 hover:border-cream-300"
                            }`}
                          >
                            <span className="text-charcoal-800 truncate">
                              {startTime}
                            </span>
                            <ChevronDown
                              size={14}
                              className={`text-charcoal-400 transition-transform duration-200 shrink-0 ml-1 ${
                                openStart ? "rotate-180 text-forest-800" : ""
                              }`}
                            />
                          </button>

                          {openStart && (
                            <div className="absolute left-0 top-full mt-1.5 w-full bg-white border border-cream-200 rounded-xl shadow-lg z-50 py-1 max-h-48 overflow-y-auto animate-in fade-in duration-150">
                              {timeOptions.map((time) => (
                                <button
                                  key={time}
                                  type="button"
                                  onClick={() => {
                                    setForm((f) => ({
                                      ...f,
                                      operating_hours: `${time} - ${endTime}`,
                                    }));
                                    setOpenStart(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer ${
                                    startTime === time
                                      ? "bg-forest-50 text-forest-800 font-bold"
                                      : "text-charcoal-700 hover:bg-cream-50"
                                  }`}
                                >
                                  <span>{time}</span>
                                  {startTime === time && (
                                    <Check
                                      size={12}
                                      className="text-forest-800"
                                    />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* เวลาสิ้นสุด */}
                        <div className="relative" ref={endRef}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-charcoal-500">
                              เวลาสิ้นสุด
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenEnd(!openEnd);
                              setOpenStart(false);
                              setOpenDaysDropdown(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 bg-cream-50/60 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              openEnd
                                ? "border-forest-800 ring-2 ring-forest-800/20 bg-white"
                                : "border-cream-200 hover:border-cream-300"
                            }`}
                          >
                            <span className="text-charcoal-800 truncate">
                              {endTime}
                            </span>
                            <ChevronDown
                              size={14}
                              className={`text-charcoal-400 transition-transform duration-200 shrink-0 ml-1 ${
                                openEnd ? "rotate-180 text-forest-800" : ""
                              }`}
                            />
                          </button>

                          {openEnd && (
                            <div className="absolute left-0 top-full mt-1.5 w-full bg-white border border-cream-200 rounded-xl shadow-lg z-50 py-1 max-h-48 overflow-y-auto animate-in fade-in duration-150">
                              {timeOptions.map((time) => (
                                <button
                                  key={time}
                                  type="button"
                                  onClick={() => {
                                    setForm((f) => ({
                                      ...f,
                                      operating_hours: `${startTime} - ${time}`,
                                    }));
                                    setOpenEnd(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer ${
                                    endTime === time
                                      ? "bg-forest-50 text-forest-800 font-bold"
                                      : "text-charcoal-700 hover:bg-cream-50"
                                  }`}
                                >
                                  <span>{time}</span>
                                  {endTime === time && (
                                    <Check
                                      size={12}
                                      className="text-forest-800"
                                    />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* การ์ด 2: เงื่อนไขและข้อกำหนดเพิ่มเติม (ห้องพัก) - อยู่ฝั่งซ้ายใต้การ์ด 1 ขนาดเท่ากัน */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/90 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-cream-200">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-forest-50 text-forest-800 border border-forest-200/80 flex items-center justify-center">
                      <AlertCircle size={17} />
                    </div>
                    <h2 className="text-base font-bold text-forest-900">
                      เงื่อนไขและข้อกำหนดเพิ่มเติม (ห้องพัก)
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTerm}
                    className="inline-flex items-center gap-1 text-xs font-bold text-forest-800 hover:text-forest-900 transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>เพิ่มข้อกำหนด</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {termsList.map((term, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-charcoal-400 w-5 text-center shrink-0">
                        {index + 1}.
                      </span>
                      <input
                        type="text"
                        className="flex-1 px-3.5 py-2.5 bg-cream-50/60 focus:bg-white border border-cream-200 rounded-xl text-xs font-medium text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
                        placeholder={`ข้อกำหนดที่ ${index + 1} (เช่น ห้ามส่งเสียงดังหลัง 22:00 น.)`}
                        value={term}
                        onChange={(e) => handleTermChange(index, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveTerm(index)}
                        className="p-2 text-charcoal-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shrink-0 cursor-pointer"
                        title="ลบข้อนี้"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ฝั่งขวา: ตำแหน่งจุดเช็กอิน & พิกัดแผนที่ */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/90 space-y-4">
                <div className="flex items-center gap-2.5 pb-4 border-b border-cream-200">
                  <div className="w-8 h-8 rounded-xl bg-forest-50 text-forest-800 border border-forest-200/80 flex items-center justify-center">
                    <MapPin size={17} />
                  </div>
                  <h2 className="text-base font-bold text-forest-900">
                    ตำแหน่งจุดเช็กอิน & พิกัดแผนที่
                  </h2>
                </div>

                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                      คำอธิบายที่อยู่ / จุดสังเกตอาคารต้อนรับ
                    </label>
                    <textarea
                      rows={3}
                      className="w-full px-3.5 py-2.5 bg-cream-50/60 focus:bg-white border border-cream-200 focus:border-forest-800 rounded-xl text-xs font-medium text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 transition-all resize-none shadow-2xs"
                      value={form.address}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, address: e.target.value }))
                      }
                      placeholder="รายละเอียดจุดสังเกตอาคารต้อนรับห้องพัก..."
                    />
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-charcoal-700 flex items-center gap-1.5">
                        <Globe size={14} className="text-forest-800" />
                        พิกัดแผนที่ (Coordinates)
                      </label>
                      <div className="flex items-center gap-2">
                        {form.coordinates && (
                          <a
                            href={`https://www.google.com/maps?q=${encodeURIComponent(
                              form.coordinates.replace(/\s+/g, "")
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] font-bold text-charcoal-500 hover:text-forest-800 flex items-center gap-1 transition-colors"
                            title="เปิดดูตำแหน่งบน Google Maps"
                          >
                            <ExternalLink size={12} />
                            <span>Google Maps</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => setIsMapOpen(true)}
                          className="text-xs font-bold text-forest-800 hover:text-forest-900 flex items-center gap-1 hover:underline cursor-pointer"
                        >
                          <Maximize2 size={12} />
                          <span>ขยาย / ค้นหาพิกัด</span>
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      className="w-full px-3.5 py-2.5 bg-cream-50/60 focus:bg-white border border-cream-200 focus:border-forest-800 rounded-xl text-xs font-mono text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 transition-all truncate shadow-2xs"
                      value={form.coordinates}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, coordinates: e.target.value }))
                      }
                      placeholder="16.219313, 103.329219"
                    />

                    {/* กล่องแสดง Map Preview */}
                    <div className="pt-1.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-charcoal-500 px-0.5">
                        <span className="flex items-center gap-1 font-medium">
                          <Map size={12} className="text-forest-800" /> ตัวอย่างพิกัดแผนที่ (คลิกบนแผนที่เพื่อเปลี่ยนตำแหน่งได้)
                        </span>
                      </div>
                      <div className="w-full h-[250px] rounded-2xl overflow-hidden border border-cream-200/90 shadow-2xs relative bg-cream-50/50">
                        <LeafletMap
                          position={parseCoordsTuple(form.coordinates)}
                          showControls={false}
                          setPosition={(pos) =>
                            setForm((f) => ({
                              ...f,
                              coordinates: `${pos[0].toFixed(6)}, ${pos[1].toFixed(6)}`,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Map Picker Modal */}
      <MapPickerModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        currentCoordinates={form.coordinates}
        onSelectCoordinates={(coords) =>
          setForm((f) => ({ ...f, coordinates: coords }))
        }
      />

      {/* ===== Modal ยืนยันการบันทึก ===== */}
      <Modal
        open={showConfirmModal}
        title="ยืนยันการบันทึกข้อมูล"
        onClose={() => setShowConfirmModal(false)}
        widthClass="max-w-sm"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              disabled={saving}
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 py-2.5 px-4 bg-cream-100 hover:bg-cream-200 text-charcoal-700 text-xs font-bold rounded-2xl transition-colors cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={confirmSave}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-forest-800 hover:bg-forest-900 text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 active:scale-98"
            >
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <Save size={14} />
                  <span>ยืนยันบันทึก</span>
                </>
              )}
            </button>
          </div>
        }
      >
        <div className="text-center space-y-3 py-1">
          <div className="w-12 h-12 rounded-2xl bg-forest-50 border border-forest-200 text-forest-800 flex items-center justify-center mx-auto shadow-2xs">
            <Save size={24} className="stroke-[2.2]" />
          </div>
          <p className="text-sm font-semibold text-charcoal-800 leading-relaxed max-w-xs mx-auto">
            คุณต้องการบันทึกการเปลี่ยนแปลงข้อมูลจุดบริการห้องพักนี้ใช่หรือไม่?
          </p>
        </div>
      </Modal>

      {/* ===== Modal แจ้งเตือนสถานะผลลัพธ์ ===== */}
      <Modal
        open={statusModal.isOpen}
        onClose={() => setStatusModal((prev) => ({ ...prev, isOpen: false }))}
        widthClass="max-w-sm"
      >
        <div className="text-center space-y-4 py-2">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto shadow-2xs ${
              statusModal.type === "success"
                ? "bg-forest-50 text-forest-800 border border-forest-200"
                : "bg-rose-50 text-rose-600 border border-rose-200"
            }`}
          >
            {statusModal.type === "success" ? (
              <Check size={26} className="stroke-[2.5]" />
            ) : (
              <AlertCircle size={26} className="stroke-[2.5]" />
            )}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-forest-900">
              {statusModal.type === "success"
                ? "บันทึกข้อมูลสำเร็จ!"
                : statusModal.title || "เกิดข้อผิดพลาด"}
            </h3>
            {statusModal.type === "error" && statusModal.message && (
              <p className="text-xs text-charcoal-600 leading-relaxed max-w-xs mx-auto">
                {statusModal.message}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() =>
              setStatusModal((prev) => ({ ...prev, isOpen: false }))
            }
            className="w-full py-2.5 bg-forest-800 hover:bg-forest-900 text-white rounded-2xl text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-98"
          >
            ตกลง
          </button>
        </div>
      </Modal>
    </div>
  );
}
