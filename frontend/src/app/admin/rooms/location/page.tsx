"use client";

import { useEffect, useState, useRef } from "react";
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
  Sparkles,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Plus,
  Trash2,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import MapPickerModal from "@/components/admin/MapPickerModal";
import { PageHeader, Panel, Modal, EmptyState } from "@/components/admin/ui";

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
  };
  const handleAddTerm = () => {
    setTermsList([...termsList, ""]);
  };
  const handleRemoveTerm = (index: number) => {
    const updated = termsList.filter((_, i) => i !== index);
    setTermsList(updated.length > 0 ? updated : [""]);
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
              name: d.name || "ห้องพัก",
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
        title: "บันทึกเรียบร้อยแล้ว!",
        message: "ระบบได้ทำการปรับปรุงข้อมูลจุดบริการห้องพักเรียบร้อยค่ะ",
      });
    } catch (err: any) {
      setStatusModal({
        isOpen: true,
        type: "error",
        title: "เกิดข้อผิดพลาด",
        message:
          err.response?.data?.message ||
          "ไม่สามารถบันทึกข้อมูลได้ กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่อีกครั้งนะคะ",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-12">
      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* Header */}
        <PageHeader
          title="ตั้งค่าจุดบริการห้องพัก & ล็อบบี้"
          description="จัดการเบอร์ติดต่อ พิกัดจุดต้อนรับ วัน และเวลาทำการประจำเคาน์เตอร์ห้องพัก"
          actions={
            <button
              type="submit"
              disabled={saving || loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#064e3b] hover:bg-[#04392b] text-white font-semibold text-xs rounded-xl transition-all shadow-xs shrink-0 cursor-pointer disabled:opacity-50"
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
          }
        />

        {loading ? (
          <div className="bg-stone-200/60 h-[400px] rounded-2xl animate-pulse" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">
            {/* ข้อมูลการติดต่อจุดต้อนรับ */}
            <div className="p-5 md:p-6 bg-white rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 text-[#064e3b] font-bold text-sm pb-3 border-b border-stone-100">
                <div className="p-1.5 bg-emerald-100/70 text-[#064e3b] rounded-lg">
                  <Building2 size={18} />
                </div>
                <h2 className="text-base font-bold">
                  ข้อมูลติดต่อจุดต้อนรับ (Lobby)
                </h2>
              </div>

              <div className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    ชื่อสถานที่ / ล็อบบี้ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b]"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="เช่น เคาน์เตอร์ต้อนรับห้องพัก"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                      <Phone size={14} className="text-stone-400" />{" "}
                      เบอร์โทรศัพท์
                    </label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b]"
                      value={form.phone}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      placeholder="08x-xxx-xxxx"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                      <Mail size={14} className="text-stone-400" /> อีเมล
                    </label>
                    <input
                      type="email"
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b]"
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
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                      <MessageCircle size={14} className="text-stone-400" /> Line ID
                    </label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b]"
                      value={form.line_id}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, line_id: e.target.value }))
                      }
                      placeholder="@room_walai"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                      <Globe size={14} className="text-stone-400" /> Facebook
                    </label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b]"
                      value={form.facebook}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, facebook: e.target.value }))
                      }
                      placeholder="facebook.com/walai.room"
                    />
                  </div>
                </div>

                {/* ===== วันเปิดทำการ และ เวลาทำการ อยู่บรรทัดเดียวกัน ===== */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* วันเปิดทำการ */}
                  <div className="relative" ref={daysRef}>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                      <Calendar size={14} className="text-[#064e3b]" />{" "}
                      วันเปิดทำการ
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setOpenDaysDropdown(!openDaysDropdown);
                        setOpenStart(false);
                        setOpenEnd(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2 bg-stone-50 border rounded-xl text-xs font-medium transition-all cursor-pointer ${
                        openDaysDropdown
                          ? "border-[#064e3b] ring-2 ring-emerald-800/20 bg-white"
                          : "border-stone-200 hover:border-stone-300"
                      }`}
                    >
                      <span
                        className={`truncate ${
                          form.operating_days
                            ? "text-stone-800 font-semibold"
                            : "text-stone-400"
                        }`}
                      >
                        {form.operating_days || "เลือกวันเปิดทำการ"}
                      </span>
                      <ChevronDown
                        size={14}
                        className={`text-stone-400 transition-transform duration-200 shrink-0 ml-1 ${
                          openDaysDropdown ? "rotate-180 text-[#064e3b]" : ""
                        }`}
                      />
                    </button>

                    {openDaysDropdown && (
                      <div className="absolute left-0 top-full mt-1 w-full bg-white border border-stone-200 rounded-2xl shadow-xl z-50 p-3 space-y-3">
                        <div className="space-y-1">
                          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block px-1">
                            ตัวเลือกลัด
                          </span>
                          <div className="grid grid-cols-3 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleQuickSelectDays("all")}
                              className="px-2 py-1 text-xs font-medium bg-emerald-50 text-[#064e3b] hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer text-center"
                            >
                              เปิดทุกวัน
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickSelectDays("weekday")}
                              className="px-2 py-1 text-xs font-medium bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer text-center"
                            >
                              จ. - ศ.
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickSelectDays("weekend")}
                              className="px-2 py-1 text-xs font-medium bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer text-center"
                            >
                              ส. - อา.
                            </button>
                          </div>
                        </div>

                        <div className="border-t border-stone-100 pt-2 space-y-1">
                          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block px-1">
                            เลือกแยกตามวัน
                          </span>
                          <div className="space-y-0.5 max-h-44 overflow-y-auto pr-1">
                            {DAYS_OPTIONS.map((day) => {
                              const isChecked = selectedDays.includes(day.full);
                              return (
                                <button
                                  key={day.full}
                                  type="button"
                                  onClick={() => handleDayToggle(day.full)}
                                  className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-xl transition-colors cursor-pointer ${
                                    isChecked
                                      ? "bg-emerald-50 text-[#064e3b] font-bold"
                                      : "text-stone-700 hover:bg-stone-50 font-normal"
                                  }`}
                                >
                                  <span>วัน{day.label}</span>
                                  <div
                                    className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                      isChecked
                                        ? "bg-[#064e3b] border-[#064e3b] text-white"
                                        : "border-stone-300 bg-white"
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

                  {/* เวลาทำการ */}
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                      <Clock size={14} className="text-emerald-600" /> เวลาทำการ (Check-in)
                    </label>

                    <div className="flex items-center gap-2">
                      {/* เวลาเริ่ม */}
                      <div className="relative flex-1" ref={startRef}>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenStart(!openStart);
                            setOpenEnd(false);
                            setOpenDaysDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 bg-stone-50 border rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            openStart
                              ? "border-[#064e3b] ring-2 ring-emerald-800/20 bg-white"
                              : "border-stone-200 hover:border-stone-300"
                          }`}
                        >
                          <div className="flex items-center">
                            <span className="text-xs uppercase font-bold text-stone-400 mr-1.5 select-none">
                              เริ่ม
                            </span>
                            <span className="text-stone-800">{startTime}</span>
                          </div>
                          <ChevronDown
                            size={14}
                            className={`text-stone-400 transition-transform duration-200 ${
                              openStart ? "rotate-180 text-[#064e3b]" : ""
                            }`}
                          />
                        </button>

                        {openStart && (
                          <div className="absolute left-0 top-full mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-lg z-50 py-1 max-h-48 overflow-y-auto">
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
                                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                                  startTime === time
                                    ? "bg-emerald-50 text-[#064e3b] font-bold"
                                    : "text-stone-700 hover:bg-stone-50"
                                }`}
                              >
                                <span>{time}</span>
                                {startTime === time && (
                                  <Check size={12} className="text-[#064e3b]" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <span className="text-xs text-stone-400 font-medium shrink-0">
                        ถึง
                      </span>

                      {/* เวลาสิ้นสุด */}
                      <div className="relative flex-1" ref={endRef}>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenEnd(!openEnd);
                            setOpenStart(false);
                            setOpenDaysDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 bg-stone-50 border rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            openEnd
                              ? "border-[#064e3b] ring-2 ring-emerald-800/20 bg-white"
                              : "border-stone-200 hover:border-stone-300"
                          }`}
                        >
                          <div className="flex items-center">
                            <span className="text-xs uppercase font-bold text-stone-400 mr-1.5 select-none">
                              สิ้นสุด
                            </span>
                            <span className="text-stone-800">{endTime}</span>
                          </div>
                          <ChevronDown
                            size={14}
                            className={`text-stone-400 transition-transform duration-200 ${
                              openEnd ? "rotate-180 text-[#064e3b]" : ""
                            }`}
                          />
                        </button>

                        {openEnd && (
                          <div className="absolute left-0 top-full mt-1 w-full bg-white border border-stone-200 rounded-xl shadow-lg z-50 py-1 max-h-48 overflow-y-auto">
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
                                className={`w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                                  endTime === time
                                    ? "bg-emerald-50 text-[#064e3b] font-bold"
                                    : "text-stone-700 hover:bg-stone-50"
                                }`}
                              >
                                <span>{time}</span>
                                {endTime === time && (
                                  <Check size={12} className="text-[#064e3b]" />
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
            </Panel>

            {/* พิกัดจุดเช็กอิน */}
            <div className="p-5 md:p-6 bg-white rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
              <div className="flex items-center gap-2 text-[#064e3b] font-bold text-sm pb-3 border-b border-stone-100">
                <div className="p-1.5 bg-emerald-100/70 text-[#064e3b] rounded-lg">
                  <MapPin size={18} />
                </div>
                <h2 className="text-base font-bold">
                  ตำแหน่งจุดเช็กอิน (Location)
                </h2>
              </div>

              <div className="space-y-4 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    คำอธิบายที่อยู่จุดเช็กอิน
                  </label>
                  <textarea
                    rows={3}
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] resize-none"
                    value={form.address}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address: e.target.value }))
                    }
                    placeholder="รายละเอียดจุดสังเกตอาคารต้อนรับ..."
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Globe size={14} className="text-stone-400" />{" "}
                      พิกัดแผนที่จุดต้อนรับ
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMapOpen(true)}
                      className="text-xs font-semibold text-[#064e3b] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <Map size={13} /> เลือกจากแผนที่
                    </button>
                  </label>
                  <input
                    type="text"
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b]"
                    value={form.coordinates}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, coordinates: e.target.value }))
                    }
                    placeholder="16.219313, 103.329219"
                  />
                </div>
              </div>
            </Panel>
            
            {/* เงื่อนไขและข้อกำหนดเพิ่มเติม (ห้องพัก) */}
            <div className="p-5 md:p-6 bg-white rounded-2xl border border-stone-200/80 shadow-2xs space-y-4 lg:col-span-2">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div className="flex items-center gap-2 text-[#064e3b] font-bold text-sm">
                  <div className="p-1.5 bg-emerald-100/70 text-[#064e3b] rounded-lg">
                    <AlertCircle size={18} />
                  </div>
                  <h2 className="text-base font-bold">
                    เงื่อนไขและข้อกำหนดเพิ่มเติม (ห้องพัก)
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={handleAddTerm}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#064e3b] hover:text-emerald-700 transition-colors cursor-pointer"
                >
                  <Plus size={14} />
                  <span>เพิ่มข้อกำหนด</span>
                </button>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {termsList.map((term, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-400 w-5 text-center shrink-0">
                      {index + 1}.
                    </span>
                    <input
                      type="text"
                      className="flex-1 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] transition-all"
                      placeholder={`ข้อกำหนดที่ ${index + 1} (เช่น ห้ามส่งเสียงดังหลัง 22:00 น.)`}
                      value={term}
                      onChange={(e) => handleTermChange(index, e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveTerm(index)}
                      className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shrink-0 cursor-pointer"
                      title="ลบข้อนี้"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </Panel>
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
        title="ยืนยันการบันทึกข้อมูล?"
        onClose={() => setShowConfirmModal(false)}
        footer={
           <>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 font-semibold text-sm rounded-lg transition-all"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmSave}
                className="px-4 py-2 bg-forest-800 hover:bg-forest-900 text-white font-semibold text-sm rounded-lg transition-all"
              >
                ยืนยันบันทึก
              </button>
           </>
        }
      >
        <p className="text-sm text-stone-500">
           คุณต้องการบันทึกการเปลี่ยนแปลงข้อมูลจุดบริการห้องพักและล็อบบี้ใช่หรือไม่คะ
        </p>
      </Modal>

      {/* ===== Modal แจ้งเตือนสถานะผลลัพธ์ ===== */}
      <Modal 
        open={statusModal.isOpen}
        title={statusModal.title}
        onClose={() => setStatusModal((prev) => ({ ...prev, isOpen: false }))}
        footer={
           <button
             type="button"
             onClick={() => setStatusModal((prev) => ({ ...prev, isOpen: false }))}
             className="w-full px-4 py-2 bg-forest-800 hover:bg-forest-900 text-white font-semibold text-sm rounded-lg transition-all"
           >
             ตกลง
           </button>
        }
      >
        <p className="text-sm text-stone-500">{statusModal.message}</p>
      </Modal>
    </div>
  );
}
