"use client";

import { useState, useEffect, useRef } from "react";
import {
  Save,
  MapPin,
  Building2,
  CreditCard,
  FileText,
  Clock,
  User,
  QrCode,
  Loader2,
  Globe,
  Map,
  Phone,
  Mail,
  MessageCircle,
  ChevronDown,
  Check,
  Calendar,
  AlertCircle,
  Trash2,
  Plus,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast from "react-hot-toast";
import MapPickerModal from "@/components/admin/MapPickerModal";

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

export default function GeneralSettingsPage() {
  const { ready, user } = useAuthGuard({
    allowedRoles: ["admin", "room_staff", "boat_staff"],
  });

  const isAdmin = user?.role === "admin";

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
    promptpay_id: "",
    bank_account_no: "",
    bank_account_name: "",
    payment_due_days: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  
  // State สำหรับ ป๊อปอัพ ยืนยัน / ป๊อปอัพ บันทึกสำเร็จ
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSuccessOpen, setIsSuccessOpen] = useState(false);

  // State สำหรับจัดการ Dynamic List ของข้อกำหนดเพิ่มเติม
  const [termsList, setTermsList] = useState<string[]>([""]);

  // State สำหรับการเลือกวันเปิดทำการ
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [openDaysDropdown, setOpenDaysDropdown] = useState(false);
  const daysRef = useRef<HTMLDivElement>(null);

  // State & Ref สำหรับ Custom Dropdown เวลาทำการ
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

  const startTime = form.operating_hours?.split(" - ")[0] || "08:00 น.";
  const endTime = form.operating_hours?.split(" - ")[1] || "17:00 น.";

  // แปลงค่า String จาก DB
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

  // แปลง Array วัน กลับมาเป็น ข้อความ
  const formatDaysToString = (days: string[]): string => {
    if (days.length === 0) return "ยังไม่ได้เลือกวัน";
    if (days.length === 7) return "เปิดทุกวัน";

    const isMonToFri =
      days.length === 5 &&
      ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์"].every((d) =>
        days.includes(d),
      );
    if (isMonToFri) return "จันทร์ - ศุกร์";

    const isSatToSun =
      days.length === 2 && ["เสาร์", "อาทิตย์"].every((d) => days.includes(d));
    if (isSatToSun) return "เสาร์ - อาทิตย์";

    return days.join(", ");
  };

  // ตรวจจับการคลิกนอก Dropdown ทั้งหมดเพื่อปิด
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
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!ready) return;

    api
      .get("/settings/resort")
      .then((res) => {
        const rawData = res.data?.data;
        const d = Array.isArray(rawData) ? rawData[0] : rawData;

        if (d) {
          const daysStr = d.operating_days ?? "";
          setForm({
            name: d.name ?? "",
            phone: d.phone ?? "",
            email: d.email ?? "",
            line_id: d.line_id ?? "",
            facebook: d.facebook ?? "",
            address: d.address ?? "",
            coordinates: d.coordinates ?? "",
            operating_days: daysStr,
            operating_hours: d.operating_hours ?? "",
            additional_terms: d.additional_terms ?? "",
            promptpay_id: d.promptpay_id ?? "",
            bank_account_no: d.bank_account_no ?? "",
            bank_account_name: d.bank_account_name ?? "",
            payment_due_days:
              d.payment_due_days !== null && d.payment_due_days !== undefined
                ? String(d.payment_due_days)
                : "",
          });
          setSelectedDays(parseDaysStringToArray(daysStr));

          const termsStr = d.additional_terms ?? "";
          const parsedTerms = termsStr
            ? termsStr
                .split("\n")
                .map((item: string) => item.trim())
                .filter(Boolean)
            : [""];

          setTermsList(parsedTerms.length > 0 ? parsedTerms : [""]);
        }
      })
      .catch((err) => {
        console.error("Error fetching settings:", err);
        toast.error("โหลดข้อมูลไม่สำเร็จ", { position: "bottom-center" });
      })
      .finally(() => setLoading(false));
  }, [ready]);

  // ฟังก์ชันจัดการ Dynamic List ของข้อกำหนด
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

  const handleDayToggle = (day: string) => {
    let updated: string[];
    if (selectedDays.includes(day)) {
      updated = selectedDays.filter((d) => d !== day);
    } else {
      const allDays = DAYS_OPTIONS.map((d) => d.full);
      updated = [...selectedDays, day].sort(
        (a, b) => allDays.indexOf(a) - allDays.indexOf(b),
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

  // เปิด Pop-up ยืนยันการบันทึก
  const handleOpenConfirmModal = (e: React.FormEvent) => {
    e.preventDefault();
    setIsConfirmOpen(true);
  };

  // ยิง API บันทึกจริงเมื่อยืนยันใน Pop-up
  const executeSave = async () => {
    setIsConfirmOpen(false);
    setSaving(true);
    try {
      await api.put("/settings/resort", {
        ...form,
        payment_due_days: form.payment_due_days
          ? Number(form.payment_due_days)
          : null,
      });
      // เปิด Pop-up แจ้งเตือนสำเร็จ
      setIsSuccessOpen(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "บันทึกข้อมูลไม่สำเร็จ", {
        position: "bottom-center",
        duration: 4000,
      });
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="space-y-6 font-sans pb-12">
      {/* ย้าย <form> มาครอบตั้งแต่ส่วน Header */}
      <form onSubmit={handleOpenConfirmModal} className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/80">
          <div>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-[#064e3b] tracking-tight">
              ตั้งค่าข้อมูลสถานที่ & การติดต่อ
            </h1>
            <p className="text-stone-500 mt-0.5 text-xs md:text-sm">
              จัดการข้อมูลทั่วไป ช่องทางติดต่อ ที่อยู่ พิกัด
              และรายละเอียดบัญชีรับชำระเงิน
            </p>
          </div>

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
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-pulse">
            <div className="bg-stone-200/60 h-[450px] rounded-2xl" />
            <div className="bg-stone-200/60 h-[450px] rounded-2xl" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">
            {/* ฝั่งซ้าย: ข้อมูลสถานที่ & ช่องทางติดต่อ */}
            <div className="space-y-6">
              {/* การ์ด 1: ข้อมูลทั่วไป & ช่องทางติดต่อ */}
              <div className="p-5 md:p-6 bg-white rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 text-[#064e3b] font-bold text-sm pb-3 border-b border-stone-100">
                  <div className="p-1.5 bg-emerald-100/70 text-[#064e3b] rounded-lg">
                    <Building2 size={18} />
                  </div>
                  <h2 className="text-base font-bold">ข้อมูลทั่วไป & ติดต่อ</h2>
                </div>

                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      ชื่อสถานที่ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] transition-all"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="เช่น สวนวลัยรุกขเวช"
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
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] transition-all"
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
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] transition-all"
                        value={form.email}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, email: e.target.value }))
                        }
                        placeholder="contact@walai.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                        <MessageCircle size={14} className="text-stone-400" />{" "}
                        Line ID
                      </label>
                      <input
                        type="text"
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] transition-all"
                        value={form.line_id}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, line_id: e.target.value }))
                        }
                        placeholder="@walai"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                        <Globe size={14} className="text-stone-400" /> Facebook
                      </label>
                      <input
                        type="text"
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] transition-all"
                        value={form.facebook}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, facebook: e.target.value }))
                        }
                        placeholder="facebook.com/walai"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* เลือกวันเปิดทำการ */}
                    <div className="relative" ref={daysRef}>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                        <Calendar size={14} className="text-[#064e3b]" />{" "}
                        วันเปิดทำการ
                      </label>

                      <button
                        type="button"
                        onClick={() => setOpenDaysDropdown(!openDaysDropdown)}
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
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block px-1">
                              ตัวเลือกลัด
                            </span>
                            <div className="grid grid-cols-3 gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleQuickSelectDays("all")}
                                className="px-2 py-1 text-[11px] font-medium bg-emerald-50 text-[#064e3b] hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer text-center"
                              >
                                เปิดทุกวัน
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickSelectDays("weekday")}
                                className="px-2 py-1 text-[11px] font-medium bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer text-center"
                              >
                                จ. - ศ.
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickSelectDays("weekend")}
                                className="px-2 py-1 text-[11px] font-medium bg-stone-100 text-stone-700 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer text-center"
                              >
                                ส. - อา.
                              </button>
                            </div>
                          </div>

                          <div className="border-t border-stone-100 pt-2 space-y-1">
                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block px-1">
                              เลือกแยกตามวัน
                            </span>
                            <div className="space-y-0.5 max-h-44 overflow-y-auto pr-1">
                              {DAYS_OPTIONS.map((day) => {
                                const isChecked = selectedDays.includes(
                                  day.full,
                                );
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
                        <Clock size={14} className="text-emerald-600" />{" "}
                        เวลาทำการ
                      </label>

                      <div className="flex items-center gap-2">
                        {/* เวลาเปิด */}
                        <div className="relative flex-1" ref={startRef}>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenStart(!openStart);
                              setOpenEnd(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 bg-stone-50 border rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                              openStart
                                ? "border-[#064e3b] ring-2 ring-emerald-800/20 bg-white"
                                : "border-stone-200 hover:border-stone-300"
                            }`}
                          >
                            <div className="flex items-center">
                              <span className="text-[10px] uppercase font-bold text-stone-400 mr-2 select-none">
                                เปิด
                              </span>
                              <span className="text-stone-800">
                                {startTime}
                              </span>
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
                                    <Check
                                      size={12}
                                      className="text-[#064e3b]"
                                    />
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <span className="text-xs text-stone-400 font-medium shrink-0">
                          ถึง
                        </span>

                        {/* เวลาปิด */}
                        <div className="relative flex-1" ref={endRef}>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenEnd(!openEnd);
                              setOpenStart(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 bg-stone-50 border rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                              openEnd
                                ? "border-[#064e3b] ring-2 ring-emerald-800/20 bg-white"
                                : "border-stone-200 hover:border-stone-300"
                            }`}
                          >
                            <div className="flex items-center">
                              <span className="text-[10px] uppercase font-bold text-stone-400 mr-2 select-none">
                                ปิด
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
                                    <Check
                                      size={12}
                                      className="text-[#064e3b]"
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

              {/* การ์ด 2: ที่อยู่และแผนที่ */}
              <div className="p-5 md:p-6 bg-white rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 text-[#064e3b] font-bold text-sm pb-3 border-b border-stone-100">
                  <div className="p-1.5 bg-emerald-100/70 text-[#064e3b] rounded-lg">
                    <MapPin size={18} />
                  </div>
                  <h2 className="text-base font-bold">ที่อยู่ & พิกัดแผนที่</h2>
                </div>

                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                      ที่อยู่สถานที่
                    </label>
                    <textarea
                      rows={3}
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] transition-all resize-none"
                      value={form.address}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, address: e.target.value }))
                      }
                      placeholder="เลขที่ ตำบล อำเภอ จังหวัด รหัสไปรษณีย์..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Globe size={14} className="text-stone-400" />{" "}
                        พิกัดแผนที่ (Coordinates)
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsMapOpen(true)}
                        className="text-xs font-semibold text-[#064e3b] hover:text-emerald-700 flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Map size={13} /> เลือกจากแผนที่
                      </button>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] transition-all truncate"
                      value={form.coordinates}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, coordinates: e.target.value }))
                      }
                      placeholder="16.2196, 103.3293"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ฝั่งขวา: ข้อมูลชำระเงิน & เงื่อนไข */}
            {isAdmin && (
              <div className="p-5 md:p-6 bg-white rounded-2xl border border-stone-200/80 shadow-2xs space-y-4">
                <div className="flex items-center gap-2 text-[#064e3b] font-bold text-sm pb-3 border-b border-stone-100">
                  <div className="p-1.5 bg-emerald-100/70 text-[#064e3b] rounded-lg">
                    <CreditCard size={18} />
                  </div>
                  <h2 className="text-base font-bold">
                    ข้อมูลการรับชำระเงิน & เงื่อนไข
                  </h2>
                </div>

                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                      <QrCode size={14} className="text-stone-400" />{" "}
                      เบอร์พร้อมเพย์ (PromptPay ID)
                    </label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] transition-all"
                      value={form.promptpay_id}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, promptpay_id: e.target.value }))
                      }
                      placeholder="เช่น 0812345678"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                      <User size={14} className="text-stone-400" />{" "}
                      ชื่อบัญชีธนาคาร
                    </label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] transition-all"
                      value={form.bank_account_name}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          bank_account_name: e.target.value,
                        }))
                      }
                      placeholder="เช่น โครงการสวนวลัยรุกขเวช"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                      <CreditCard size={14} className="text-stone-400" />{" "}
                      เลขที่บัญชีธนาคาร
                    </label>
                    <input
                      type="text"
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] transition-all"
                      value={form.bank_account_no}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          bank_account_no: e.target.value,
                        }))
                      }
                      placeholder="000-0-00000-0"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                      <Clock size={14} className="text-emerald-600" />
                      กำหนดเวลาต้องชำระเงินหลังจอง
                    </label>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative w-32">
                        <input
                          type="number"
                          min={0}
                          className="w-full pl-3.5 pr-10 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] transition-all"
                          value={form.payment_due_days}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              payment_due_days: e.target.value,
                            }))
                          }
                          placeholder="เช่น 1"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-stone-400 pointer-events-none">
                          วัน
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {[1, 3, 7].map((days) => (
                          <button
                            key={days}
                            type="button"
                            onClick={() =>
                              setForm((f) => ({
                                ...f,
                                payment_due_days: String(days),
                              }))
                            }
                            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all cursor-pointer ${
                              form.payment_due_days === String(days)
                                ? "bg-[#064e3b] text-white border-[#064e3b] shadow-2xs"
                                : "bg-stone-50 text-stone-600 border-stone-200 hover:bg-stone-100 hover:text-stone-900"
                            }`}
                          >
                            {days} วัน
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-[11px] text-stone-400 mt-1">
                      * คำนวณวันครบกำหนดชำระอัตโนมัติหลังทำรายการจอง
                    </p>
                  </div>

                  {/* เงื่อนไขและข้อกำหนดเพิ่มเติม */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between border-t border-stone-100 pt-3">
                      <label className="block text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                        <FileText size={14} className="text-stone-400" />
                        เงื่อนไขและข้อกำหนดเพิ่มเติม
                      </label>

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
                            onChange={(e) =>
                              handleTermChange(index, e.target.value)
                            }
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
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </form>

      {/* ========================================================= */}
      {/* 1. POPUP ยืนยันการบันทึกข้อมูล */}
      {/* ========================================================= */}
      {isConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-100 transform transition-all scale-100 animate-in zoom-in-95 duration-150 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon & Title */}
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-[#064e3b] rounded-xl shrink-0">
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 className="text-base font-bold text-stone-800 tracking-tight">
                  ยืนยันการบันทึกข้อมูล
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  โปรดตรวจสอบความถูกต้องก่อนดำเนินการ
                </p>
              </div>
            </div>

            {/* Content Body */}
            <p className="text-xs text-stone-600 leading-relaxed bg-stone-50 p-3.5 rounded-xl border border-stone-100">
              คุณต้องการบันทึกการเปลี่ยนแปลงข้อมูลสถานที่ รายละเอียดการติดต่อ
              และบัญชีชำระเงินนี้ใช่หรือไม่?
            </p>

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={saving}
                onClick={() => setIsConfirmOpen(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-600 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={executeSave}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#064e3b] hover:bg-[#04392b] text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer disabled:opacity-50"
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
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. POPUP แจ้งเตือนบันทึกสำเร็จ */}
      {/* ========================================================= */}
      {isSuccessOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-stone-100 text-center space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 bg-emerald-100 text-[#064e3b] rounded-full flex items-center justify-center mx-auto">
              <Check size={28} />
            </div>

            <div>
              <h3 className="text-base font-bold text-stone-800">
                บันทึกข้อมูลสำเร็จ!
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                ระบบได้ทำการอัปเดตข้อมูลสถานที่เรียบร้อยแล้ว
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsSuccessOpen(false)}
              className="w-full py-2.5 bg-[#064e3b] hover:bg-[#04392b] text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer"
            >
              ตกลง
            </button>
          </div>
        </div>
      )}

      {/* Map Picker Modal */}
      <MapPickerModal
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        currentCoordinates={form.coordinates}
        onSelectCoordinates={(coords) =>
          setForm((f) => ({ ...f, coordinates: coords }))
        }
      />
    </div>
  );
}