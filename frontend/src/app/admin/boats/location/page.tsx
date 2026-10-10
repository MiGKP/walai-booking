"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  Save,
  MapPin,
  Phone,
  Mail,
  MessageCircle,
  Clock,
  Globe,
  Map,
  Loader2,
  AlertCircle,
  Plus,
  Trash2,
  ExternalLink,
  Maximize2,
  Sailboat,
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import MapPickerModal from "@/components/admin/MapPickerModal";
import TimeSelect from "@/components/admin/TimeSelect";
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

const DAY_NAMES = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์"];

interface DayHour {
  id?: number;
  day_of_week: number;
  open_time: string;
  close_time: string;
  is_open: boolean;
}

const defaultHours = (): DayHour[] =>
  Array.from({ length: 7 }, (_, i) => ({
    day_of_week: i,
    open_time: "08:00",
    close_time: "18:00",
    is_open: true,
  }));

export default function BoatLocationPage() {
  const { ready } = useAuthGuard({ allowedRoles: ["boat_staff", "admin"] });

  const [recordId, setRecordId] = useState<number | string | null>(5);
  const [form, setForm] = useState({
    name: "จุดบริการเรือ & กิจกรรมทางน้ำ",
    phone: "",
    email: "",
    line_id: "",
    facebook: "",
    address: "",
    coordinates: "16.219313, 103.329219",
    additional_terms: "",
  });

  const [termsList, setTermsList] = useState<string[]>([""]);

  // เวลาทำการรายวัน 7 วัน และเวลาจองล่วงหน้าขั้นต่ำ
  const [hours, setHours] = useState<DayHour[]>(defaultHours());
  const [advanceMinutes, setAdvanceMinutes] = useState("60");
  const [bulkOpenTime, setBulkOpenTime] = useState("08:00");
  const [bulkCloseTime, setBulkCloseTime] = useState("18:00");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);

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

  const updateDay = <K extends keyof DayHour>(day: number, field: K, value: DayHour[K]): void => {
    setHours((prev) => prev.map((h) => (h.day_of_week === day ? { ...h, [field]: value } : h)));
  };

  const handleApplyToAllDays = (): void => {
    setHours((prev) =>
      prev.map((h) => ({
        ...h,
        open_time: bulkOpenTime,
        close_time: bulkCloseTime,
        is_open: true,
      }))
    );
    notify.success(`ตั้งเวลา ${bulkOpenTime} - ${bulkCloseTime} น. ให้กับทุกวันเรียบร้อย`);
  };

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

  const parseCoordsTuple = (coords: string): [number, number] => {
    if (coords) {
      const parts = coords.split(",").map((p) => parseFloat(p.trim()));
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return [parts[0], parts[1]];
      }
    }
    return [16.219313, 103.329219];
  };

  useEffect(() => {
    if (!ready) return;

    setLoading(true);
    Promise.all([
      api.get("/settings/resort"),
      api.get("/settings/boat-hours"),
    ])
      .then(([resortRes, hoursRes]) => {
        const rawData = resortRes.data?.data;
        if (rawData) {
          let d: any = null;
          if (Array.isArray(rawData)) {
            d =
              rawData.find((item: any) => item.id === 5 || item.name?.includes("เรือ")) ||
              rawData[2] ||
              rawData[0];
          } else {
            d = rawData;
          }

          if (d) {
            setRecordId(d.id || 5);
            setForm({
              name: d.name || "จุดบริการเรือ & กิจกรรมทางน้ำ",
              phone: d.phone || "",
              email: d.email || "",
              line_id: d.line_id || "",
              facebook: d.facebook || "",
              address: d.address || "",
              coordinates: d.coordinates || "16.219313, 103.329219",
              additional_terms: d.additional_terms || "",
            });

            if (d.boat_advance_booking_minutes != null) {
              setAdvanceMinutes(String(d.boat_advance_booking_minutes));
            }

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

        const hoursData: DayHour[] = hoursRes.data?.data ?? [];
        if (hoursData.length > 0) {
          const merged = defaultHours().map((def) => {
            const found = hoursData.find((d) => d.day_of_week === def.day_of_week);
            return found
              ? {
                  ...found,
                  open_time: String(found.open_time).slice(0, 5),
                  close_time: String(found.close_time).slice(0, 5),
                }
              : def;
          });
          setHours(merged);
        }
      })
      .catch((err) => {
        console.error(err);
        notify.error("โหลดข้อมูลจุดบริการเรือไม่สำเร็จ");
      })
      .finally(() => setLoading(false));
  }, [ready]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setShowConfirmModal(false);
    setSaving(true);

    const minutes = Number(advanceMinutes);
    if (!Number.isInteger(minutes) || minutes < 0 || minutes > 10080) {
      notify.error("กรุณาระบุเวลาจองล่วงหน้าเป็นจำนวนเต็มระหว่าง 0 ถึง 10080 นาที");
      setSaving(false);
      return;
    }

    // สรุป operating_days & operating_hours เป็นข้อความสรุป
    const openDaysCount = hours.filter((h) => h.is_open).length;
    let daysSummary = "เปิดทุกวัน";
    if (openDaysCount === 0) daysSummary = "ปิดให้บริการชั่วคราว";
    else if (openDaysCount === 5 && hours[1].is_open && hours[5].is_open && !hours[0].is_open && !hours[6].is_open)
      daysSummary = "จันทร์ - ศุกร์";
    else if (openDaysCount === 2 && hours[0].is_open && hours[6].is_open)
      daysSummary = "เสาร์ - อาทิตย์";

    const firstOpen = hours.find((h) => h.is_open) || hours[0];
    const hoursSummary = `${firstOpen.open_time} น. - ${firstOpen.close_time} น.`;

    try {
      await Promise.all([
        ...hours.map((h) =>
          api.put("/settings/boat-hours", {
            day_of_week: h.day_of_week,
            open_time: h.open_time,
            close_time: h.close_time,
            is_open: h.is_open,
          })
        ),
        api.put("/settings/resort", {
          id: recordId || 5,
          name: form.name,
          phone: form.phone,
          email: form.email,
          line_id: form.line_id,
          facebook: form.facebook,
          address: form.address,
          coordinates: form.coordinates,
          operating_days: daysSummary,
          operating_hours: hoursSummary,
          boat_advance_booking_minutes: minutes,
          additional_terms: termsList.filter(Boolean).join("\n"),
        }),
      ]);

      setStatusModal({
        isOpen: true,
        type: "success",
        title: "บันทึกข้อมูลสำเร็จ!",
        message: "ระบบได้ทำการปรับปรุงข้อมูลจุดบริการเรือและเวลาทำการเรียบร้อยแล้วค่ะ",
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
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-800/10">
            <Sailboat size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-forest-900 tracking-tight">
              ตั้งค่าจุดบริการเรือ & ท่าเรือ
            </h1>
            <p className="text-xs text-charcoal-500 mt-0.5">
              จัดการข้อมูลสถานที่ พิกัดท่าเรือ เวลาเปิด-ปิดรายวัน และกฎการจองเรือ
            </p>
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
          <div className="space-y-6">
            {/* ROW 1: ข้อมูลจุดบริการ และ แผนที่พิกัดท่าเรือ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start w-full">
              {/* การ์ด 1: ข้อมูลการติดต่อจุดบริการเรือ */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/90 space-y-4">
                <div className="flex items-center gap-2.5 pb-4 border-b border-cream-200">
                  <div className="w-8 h-8 rounded-xl bg-forest-50 text-forest-800 border border-forest-200/80 flex items-center justify-center">
                    <Sailboat size={17} />
                  </div>
                  <h2 className="text-base font-bold text-forest-900">
                    ข้อมูลติดต่อจุดบริการเรือ (Pier / Boathouse)
                  </h2>
                </div>

                <div className="space-y-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                      ชื่อสถานที่ / ท่าเรือ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      className="w-full px-3.5 py-2.5 bg-cream-50/60 focus:bg-white border border-cream-200 focus:border-forest-800 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 transition-all shadow-2xs"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="เช่น จุดบริการเรือคายัค & กิจกรรมทางน้ำ"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-charcoal-700 mb-1.5 flex items-center gap-1.5">
                        <Phone size={14} className="text-charcoal-400" /> เบอร์โทรศัพท์
                      </label>
                      <input
                        type="text"
                        className="w-full px-3.5 py-2.5 bg-cream-50/60 focus:bg-white border border-cream-200 focus:border-forest-800 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 transition-all shadow-2xs font-mono"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="08x-xxx-xxxx"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-charcoal-700 mb-1.5 flex items-center gap-1.5">
                        <Mail size={14} className="text-charcoal-400" /> อีเมล
                      </label>
                      <input
                        type="email"
                        className="w-full px-3.5 py-2.5 bg-cream-50/60 focus:bg-white border border-cream-200 focus:border-forest-800 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 transition-all shadow-2xs"
                        value={form.email}
                        onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                        placeholder="boat@walai.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-charcoal-700 mb-1.5 flex items-center gap-1.5">
                        <MessageCircle size={14} className="text-charcoal-400" /> Line ID
                      </label>
                      <input
                        type="text"
                        className="w-full px-3.5 py-2.5 bg-cream-50/60 focus:bg-white border border-cream-200 focus:border-forest-800 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 transition-all shadow-2xs"
                        value={form.line_id}
                        onChange={(e) => setForm((f) => ({ ...f, line_id: e.target.value }))}
                        placeholder="@boat_walai"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-charcoal-700 mb-1.5 flex items-center gap-1.5">
                        <Globe size={14} className="text-charcoal-400" /> Facebook
                      </label>
                      <input
                        type="text"
                        className="w-full px-3.5 py-2.5 bg-cream-50/60 focus:bg-white border border-cream-200 focus:border-forest-800 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 transition-all shadow-2xs"
                        value={form.facebook}
                        onChange={(e) => setForm((f) => ({ ...f, facebook: e.target.value }))}
                        placeholder="facebook.com/walai.boat"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                      คำอธิบายที่อยู่ / จุดสังเกตท่าเรือ
                    </label>
                    <textarea
                      rows={3}
                      className="w-full px-3.5 py-2.5 bg-cream-50/60 focus:bg-white border border-cream-200 focus:border-forest-800 rounded-xl text-xs font-medium text-charcoal-800 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 transition-all resize-none shadow-2xs"
                      value={form.address}
                      onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                      placeholder="รายละเอียดจุดสังเกตบริเวณท่าเรือหรือสะพานเทียบ..."
                    />
                  </div>
                </div>
              </div>

              {/* การ์ด 2: ตำแหน่งจุดบริการเรือ & พิกัดแผนที่ */}
              <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/90 space-y-4">
                <div className="flex items-center gap-2.5 pb-4 border-b border-cream-200">
                  <div className="w-8 h-8 rounded-xl bg-forest-50 text-forest-800 border border-forest-200/80 flex items-center justify-center">
                    <MapPin size={17} />
                  </div>
                  <h2 className="text-base font-bold text-forest-900">
                    ตำแหน่งจุดบริการเรือ & พิกัดแผนที่
                  </h2>
                </div>

                <div className="space-y-4 pt-1">
                  <div className="space-y-2">
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
                      className="w-full px-3.5 py-2.5 bg-cream-50/60 focus:bg-white border border-cream-200 focus:border-forest-800 rounded-xl text-xs font-mono text-charcoal-800 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 transition-all truncate shadow-2xs"
                      value={form.coordinates}
                      onChange={(e) => setForm((f) => ({ ...f, coordinates: e.target.value }))}
                      placeholder="16.219313, 103.329219"
                    />

                    <div className="pt-1.5 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-charcoal-500 px-0.5">
                        <span className="flex items-center gap-1 font-medium">
                          <Map size={12} className="text-forest-800" /> ตัวอย่างพิกัดแผนที่ (คลิกบนแผนที่เพื่อเปลี่ยนตำแหน่งได้)
                        </span>
                      </div>
                      <div className="w-full h-[220px] rounded-2xl overflow-hidden border border-cream-200/90 shadow-2xs relative bg-cream-50/50">
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

            {/* ROW 2: เวลาเปิด-ปิดรายวัน 7 วัน & การจองล่วงหน้าขั้นต่ำ */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* ตารางเวลา 7 วัน */}
              <div className="xl:col-span-8 bg-white rounded-3xl p-6 shadow-panel border border-cream-200/90 space-y-4">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-cream-200/80">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-forest-50 text-forest-800 border border-forest-200/80 flex items-center justify-center">
                      <Clock size={17} />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-forest-900 font-display">
                        เวลาเปิด-ปิดบริการเรือรายวัน (7 วัน)
                      </h2>
                    </div>
                  </div>
                  <span className="text-xs text-charcoal-400 font-medium hidden sm:inline">
                    ระบบคำนวณรอบเรือจะอิงตามเวลานี้
                  </span>
                </div>

                {/* Quick Bulk Time Setter: กำหนดเวลามาตรฐานทุกวัน */}
                <div className="bg-cream-50/80 border border-cream-200/90 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
                  <span className="text-xs font-bold text-forest-900">
                    กำหนดเวลามาตรฐานทุกวัน:
                  </span>

                  <div className="flex items-center gap-2 flex-wrap">
                    <TimeSelect
                      label="เวลาเปิดมาตรฐาน"
                      value={bulkOpenTime}
                      onChange={setBulkOpenTime}
                    />
                    <span className="text-xs sm:text-sm font-semibold text-charcoal-400 font-mono">–</span>
                    <TimeSelect
                      label="เวลาปิดมาตรฐาน"
                      value={bulkCloseTime}
                      onChange={setBulkCloseTime}
                    />
                    <button
                      type="button"
                      onClick={handleApplyToAllDays}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-forest-800 hover:bg-forest-900 text-white shadow-2xs transition-all active:scale-95 cursor-pointer"
                      title="คัดลอกเวลานี้ไปใส่ให้กับทุกวัน"
                    >
                      <span>นำไปใช้ทุกวัน</span>
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-cream-100 overflow-hidden rounded-2xl border border-cream-200/90 bg-white">
                  {hours.map((h) => {
                    const isOpen = h.is_open;
                    return (
                      <div
                        key={h.day_of_week}
                        className={`flex flex-wrap items-center justify-between gap-3 px-3.5 sm:px-4 py-3 transition-colors ${
                          isOpen ? "bg-white hover:bg-cream-50/50" : "bg-cream-50/40 opacity-70"
                        }`}
                      >
                        <div className="w-20 sm:w-24 shrink-0 flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              isOpen ? "bg-forest-600" : "bg-charcoal-300"
                            }`}
                          />
                          <span
                            className={`text-xs sm:text-sm font-bold ${
                              isOpen ? "text-forest-950" : "text-charcoal-400"
                            }`}
                          >
                            วัน{DAY_NAMES[h.day_of_week]}
                          </span>
                        </div>

                        <div
                          className={`flex items-center gap-1.5 sm:gap-2 transition-opacity ${
                            !isOpen ? "pointer-events-none opacity-40" : ""
                          }`}
                        >
                          <TimeSelect
                            label={`เวลาเปิด วัน${DAY_NAMES[h.day_of_week]}`}
                            value={h.open_time}
                            onChange={(v) => updateDay(h.day_of_week, "open_time", v)}
                          />
                          <span className="text-xs sm:text-sm font-semibold text-charcoal-400 font-mono">–</span>
                          <TimeSelect
                            label={`เวลาปิด วัน${DAY_NAMES[h.day_of_week]}`}
                            value={h.close_time}
                            onChange={(v) => updateDay(h.day_of_week, "close_time", v)}
                          />
                        </div>

                        <div className="flex shrink-0 items-center gap-2.5 ml-auto sm:ml-0">
                          <span
                            className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                              isOpen
                                ? "bg-forest-50 text-forest-800 border-forest-200/80"
                                : "bg-cream-100 text-charcoal-500 border-cream-200"
                            }`}
                          >
                            {isOpen ? "เปิด" : "ปิด"}
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isOpen}
                            aria-label={`สถานะวัน${DAY_NAMES[h.day_of_week]}`}
                            onClick={() => updateDay(h.day_of_week, "is_open", !isOpen)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-hidden cursor-pointer ${
                              isOpen ? "bg-forest-800" : "bg-cream-300"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 rounded-full bg-white shadow-xs transition-transform ${
                                isOpen ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* กฎการจองล่วงหน้า และ ข้อกำหนดการจองเรือ */}
              <div className="xl:col-span-4 space-y-6">
                {/* กฎการจองล่วงหน้า */}
                <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/90 space-y-4">
                  <div className="flex items-center gap-2.5 pb-3 border-b border-cream-200/80">
                    <div className="w-2.5 h-2.5 rounded-full bg-forest-800" />
                    <h2 className="text-base font-bold text-forest-900 font-display">
                      การจองล่วงหน้าขั้นต่ำ
                    </h2>
                  </div>

                  <div className="bg-cream-50/80 border border-cream-200/90 rounded-2xl p-4 space-y-2.5">
                    <p className="text-xs text-charcoal-500 leading-relaxed">
                      ระยะเวลาขั้นต่ำที่ลูกค้าต้องจองก่อนถึงรอบเวลา เพื่อให้เจ้าหน้าที่จัดเตรียมเรือ
                    </p>
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <span className="text-xs sm:text-sm font-semibold text-charcoal-800">
                        ต้องจองก่อนรอบเริ่มอย่างน้อย
                      </span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={10080}
                        step={5}
                        aria-label="จองล่วงหน้าขั้นต่ำ (นาที)"
                        value={advanceMinutes}
                        onChange={(e) => setAdvanceMinutes(e.target.value)}
                        className="w-20 rounded-xl border border-cream-300 bg-white px-2.5 py-1.5 text-center text-xs sm:text-sm font-bold font-mono text-forest-950 focus:border-forest-700 focus:outline-hidden focus:ring-2 focus:ring-forest-800/15"
                      />
                      <span className="text-xs sm:text-sm font-semibold text-charcoal-700">
                        นาที
                      </span>
                      <span className="text-xs text-charcoal-400 font-mono">
                        ({(Number(advanceMinutes) / 60).toFixed(1)} ชม.)
                      </span>
                    </div>
                  </div>
                </div>

                {/* ข้อกำหนดและกฎความปลอดภัยเรือ */}
                <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/90 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-cream-200/80">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-forest-800" />
                      <h2 className="text-base font-bold text-forest-900 font-display">
                        ข้อกำหนดการใช้บริการเรือ
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={handleAddTerm}
                      className="inline-flex items-center gap-1 text-xs font-bold text-forest-800 hover:text-forest-900 transition-colors cursor-pointer"
                    >
                      <Plus size={14} />
                      <span>เพิ่มข้อ</span>
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
                          className="flex-1 px-3 py-2 bg-cream-50/60 focus:bg-white border border-cream-200 rounded-xl text-xs font-medium text-charcoal-800 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
                          placeholder={`ข้อกำหนดที่ ${index + 1} (เช่น สวมเสื้อชูชีพตลอดเวลา)`}
                          value={term}
                          onChange={(e) => handleTermChange(index, e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveTerm(index)}
                          className="p-1.5 text-charcoal-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all shrink-0 cursor-pointer"
                          title="ลบข้อนี้"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Map Picker Modal */}
      {isMapOpen && (
        <MapPickerModal
          isOpen={isMapOpen}
          onClose={() => setIsMapOpen(false)}
          currentCoordinates={form.coordinates}
          onSelectCoordinates={(coords) => {
            setForm((f) => ({
              ...f,
              coordinates: coords,
            }));
            setIsMapOpen(false);
          }}
        />
      )}

      {/* Modal ยืนยันการบันทึกข้อมูล */}
      <Modal
        open={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="ยืนยันการบันทึกข้อมูลจุดบริการเรือ"
      >
        <div className="space-y-4">
          <p className="text-xs sm:text-sm text-charcoal-600">
            คุณต้องการบันทึกการเปลี่ยนแปลงข้อมูลจุดบริการเรือ เวลาทำการ และกฎการจองใช่หรือไม่?
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowConfirmModal(false)}
              className="px-4 py-2 border border-cream-300 hover:bg-cream-100 text-charcoal-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirmSave}
              className="px-4 py-2 bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              ยืนยันการบันทึก
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal แจ้งเตือนผลลัพธ์ */}
      <Modal
        open={statusModal.isOpen}
        onClose={() => setStatusModal({ ...statusModal, isOpen: false })}
        title={statusModal.title}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            {statusModal.type === "success" ? (
              <div className="w-8 h-8 rounded-full bg-forest-50 text-forest-800 flex items-center justify-center shrink-0">
                <Sailboat size={18} />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle size={18} />
              </div>
            )}
            <p className="text-xs sm:text-sm text-charcoal-600 mt-1">
              {statusModal.message}
            </p>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setStatusModal({ ...statusModal, isOpen: false })}
              className="px-4 py-2 bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold rounded-xl transition-all shadow-2xs cursor-pointer"
            >
              ตกลง
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
