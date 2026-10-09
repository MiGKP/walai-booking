"use client";

import { useState, useEffect } from "react";
import {
  Save,
  AlertCircle,
  Loader2,
  Clock,
  Users,
  Car,
  Bed,
  Anchor,
  ShieldCheck,
  CreditCard,
  Layers,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { pickResortInfo } from "@/lib/resort-info";
import { PageHeader, Panel } from "@/components/admin/ui";
import CancellationPolicyCard from "@/components/settings/CancellationPolicyCard";
import TermsListEditor from "@/components/admin/TermsListEditor";
import KidsPolicyEditor from "@/components/admin/KidsPolicyEditor";

type PolicyTab = "all" | "room" | "boat" | "refund";

export default function PoliciesSettingsPage() {
  const { ready, user } = useAuthGuard({
    allowedRoles: ["admin", "room_staff", "boat_staff"],
  });

  const [activeTab, setActiveTab] = useState<PolicyTab>("all");

  const [form, setForm] = useState({
    // นโยบายห้องพัก
    checkin_time_from: "14:00",
    checkin_time_to: "23:00",
    checkout_time: "12:00",
    important_info: "",
    kids_policy: "",
    infant_max_age_exclusive: "6",
    parking_info: "",
    // นโยบายเรือ
    boat_terms: "",
    boat_checkin_advance_minutes: 15,
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ready) {
      fetchPolicies();
    }
  }, [ready]);

  const fetchPolicies = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const { data } = await api.get("/settings/resort");
      const roomInfo = pickResortInfo(data.data, "room"); // id 4
      const mainInfo = pickResortInfo(data.data, "main"); // id 3
      const boatInfo = pickResortInfo(data.data, "boat"); // id 5

      setForm({
        checkin_time_from: (roomInfo?.checkin_time_from as string) || "14:00",
        checkin_time_to: (roomInfo?.checkin_time_to as string) || "23:00",
        checkout_time: (roomInfo?.checkout_time as string) || "12:00",
        important_info: (roomInfo?.important_info as string) || "",
        kids_policy: (roomInfo?.kids_policy as string) || "",
        infant_max_age_exclusive: String(mainInfo?.infant_max_age_exclusive ?? 6),
        parking_info: (roomInfo?.parking_info as string) || "",
        boat_terms: (boatInfo?.additional_terms as string) || "",
        boat_checkin_advance_minutes: Number(boatInfo?.boat_checkin_advance_minutes ?? 15),
      });
    } catch (error) {
      console.error("Failed to load policies", error);
      setLoadError(true);
      notify.error("ไม่สามารถโหลดข้อมูลนโยบายได้");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const infantAge = Number(form.infant_max_age_exclusive);
    if (
      user?.role === "admin" &&
      (form.infant_max_age_exclusive.trim() === "" ||
        !Number.isInteger(infantAge) ||
        infantAge < 0 ||
        infantAge > 18)
    ) {
      notify.error("กรุณาระบุอายุที่เริ่มนับความจุเป็นจำนวนเต็ม 0-18 ปี");
      return;
    }

    try {
      setSaving(true);
      const promises: Promise<unknown>[] = [
        // บันทึกนโยบายห้องพัก (id: 4)
        api.put("/settings/resort", {
          id: 4,
          checkin_time_from: form.checkin_time_from,
          checkin_time_to: form.checkin_time_to,
          checkout_time: form.checkout_time,
          important_info: form.important_info,
          kids_policy: form.kids_policy,
          parking_info: form.parking_info,
        }),
        // บันทึกข้อกำหนดและกฎความปลอดภัยเรือ + เวลาเช็คอินก่อนรอบเรือ (id: 5)
        api.put("/settings/resort", {
          id: 5,
          additional_terms: form.boat_terms,
          boat_checkin_advance_minutes: Number(form.boat_checkin_advance_minutes) || 0,
        }),
      ];

      if (user?.role === "admin") {
        promises.push(
          api.put("/settings/resort", {
            id: 3,
            infant_max_age_exclusive: infantAge,
          })
        );
      }

      await Promise.all(promises);
      notify.success("บันทึกนโยบายทั้งหมดสำเร็จ");
    } catch (error) {
      console.error("Failed to save policies", error);
      notify.error("บันทึกไม่สำเร็จ โปรดลองอีกครั้ง");
    } finally {
      setSaving(false);
    }
  };

  if (!ready || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50/50">
        <Loader2 className="h-8 w-8 animate-spin text-forest-600" />
      </div>
    );
  }

  const showRoom = activeTab === "all" || activeTab === "room";
  const showBoat = activeTab === "all" || activeTab === "boat";
  const showRefund = activeTab === "all" || activeTab === "refund";
  const refundScope: "all" | "room" | "boat" =
    activeTab === "room" ? "room" : activeTab === "boat" ? "boat" : "all";

  return (
    <div className="space-y-6 pb-12 font-sans">
      <PageHeader
        title="ตั้งค่านโยบายและข้อกำหนด"
        actions={
          <button
            onClick={handleSave}
            disabled={saving || loading || loadError}
            className="flex items-center gap-2 rounded-2xl bg-forest-800 px-5 py-2.5 text-xs font-bold text-white shadow-2xs transition-all hover:bg-forest-900 active:scale-95 disabled:opacity-70 cursor-pointer"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            <span>{saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}</span>
          </button>
        }
      />

      {/* Navigation Tabs (ตัวเลือกหมวดหมู่นโยบาย) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-cream-200">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "all"
              ? "bg-forest-800 text-white shadow-xs"
              : "bg-white text-charcoal-600 hover:bg-cream-100 hover:text-forest-900 border border-cream-200"
          }`}
        >
          <Layers size={14} />
          <span>นโยบายทั้งหมด</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("room")}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "room"
              ? "bg-forest-800 text-white shadow-xs"
              : "bg-white text-charcoal-600 hover:bg-cream-100 hover:text-forest-900 border border-cream-200"
          }`}
        >
          <Bed size={14} />
          <span>นโยบายห้องพัก</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("boat")}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "boat"
              ? "bg-forest-800 text-white shadow-xs"
              : "bg-white text-charcoal-600 hover:bg-cream-100 hover:text-forest-900 border border-cream-200"
          }`}
        >
          <Anchor size={14} />
          <span>นโยบายบริการเรือ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("refund")}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === "refund"
              ? "bg-forest-800 text-white shadow-xs"
              : "bg-white text-charcoal-600 hover:bg-cream-100 hover:text-forest-900 border border-cream-200"
          }`}
        >
          <CreditCard size={14} />
          <span>การยกเลิก & คืนเงิน</span>
        </button>
      </div>

      {/* SECTION 1: นโยบายการยกเลิกและการคืนเงิน */}
      {showRefund && <CancellationPolicyCard scope={refundScope} />}

      {/* SECTION 2: นโยบายและกฎระเบียบห้องพัก */}
      {showRoom && (
        <Panel>
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
              <div className="w-8 h-8 rounded-xl bg-forest-50 text-forest-800 border border-forest-200/80 flex items-center justify-center">
                <Bed size={17} />
              </div>
              <div>
                <h2 className="text-base font-bold text-forest-900 font-display">
                  นโยบายและกฎระเบียบการเข้าพัก (Room Policies)
                </h2>
                <p className="text-xs text-charcoal-400">
                  เวลาเช็คอิน-เช็คเอาต์ กฎระเบียบห้องพัก และนโยบายเตียงเสริม
                </p>
              </div>
            </div>

            {/* Check-in / Check-out */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-forest-900 font-bold text-xs sm:text-sm">
                <Clock size={16} className="text-forest-700" />
                <h3>เวลาเช็คอิน / เช็คเอาต์</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    เวลาเช็คอิน (ตั้งแต่ - ถึง)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={form.checkin_time_from}
                      onChange={(e) =>
                        setForm({ ...form, checkin_time_from: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-forest-500/20 focus:border-forest-700 transition-all font-mono"
                    />
                    <span className="text-stone-400">-</span>
                    <input
                      type="time"
                      value={form.checkin_time_to}
                      onChange={(e) =>
                        setForm({ ...form, checkin_time_to: e.target.value })
                      }
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-forest-500/20 focus:border-forest-700 transition-all font-mono"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                    เวลาเช็คเอาต์ (ก่อน)
                  </label>
                  <input
                    type="time"
                    value={form.checkout_time}
                    onChange={(e) =>
                      setForm({ ...form, checkout_time: e.target.value })
                    }
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-forest-500/20 focus:border-forest-700 transition-all font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Important Info */}
            <div className="space-y-4 pt-4 border-t border-stone-100">
              <div className="flex items-center gap-2 text-forest-900 font-bold text-xs sm:text-sm">
                <AlertCircle size={16} className="text-forest-700" />
                <h3>กฎและข้อกำหนดที่พัก (Important Details)</h3>
              </div>
              <TermsListEditor
                value={form.important_info}
                onChange={(val) => setForm({ ...form, important_info: val })}
                placeholder="เช่น รวมอาหารเช้าสำหรับทุกการจอง, งดส่งเสียงดังหลังเวลา 22:00 น."
              />
            </div>

            {/* Kids Policy */}
            <div className="space-y-4 pt-4 border-t border-stone-100">
              <div className="flex items-center gap-2 text-forest-900 font-bold text-xs sm:text-sm">
                <Users size={16} className="text-forest-700" />
                <h3>นโยบายเด็กและเตียงเสริม</h3>
              </div>
              {user?.role === "admin" && (
                <div>
                  <label
                    htmlFor="infant-age"
                    className="block text-xs font-semibold text-stone-700 mb-1.5"
                  >
                    อายุที่เริ่มนับรวมในความจุห้อง (ปี)
                  </label>
                  <input
                    id="infant-age"
                    type="number"
                    min={0}
                    max={18}
                    step={1}
                    required
                    value={form.infant_max_age_exclusive}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        infant_max_age_exclusive: e.target.value,
                      })
                    }
                    className="w-32 px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold font-mono focus:ring-2 focus:ring-forest-500/20 focus:border-forest-700 transition-all"
                  />
                  <p className="mt-1.5 text-xs text-charcoal-400">
                    เด็กที่อายุต่ำกว่าค่านี้เข้าพักฟรีและไม่นับความจุห้อง
                  </p>
                </div>
              )}
              <KidsPolicyEditor
                value={form.kids_policy}
                onChange={(val) => setForm({ ...form, kids_policy: val })}
              />
            </div>

            {/* Parking Info */}
            <div className="space-y-4 pt-4 border-t border-stone-100">
              <div className="flex items-center gap-2 text-forest-900 font-bold text-xs sm:text-sm">
                <Car size={16} className="text-forest-700" />
                <h3>การเดินทางและที่จอดรถ</h3>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  รายละเอียดที่จอดรถและการเดินทาง
                </label>
                <textarea
                  rows={3}
                  value={form.parking_info}
                  onChange={(e) =>
                    setForm({ ...form, parking_info: e.target.value })
                  }
                  placeholder="มีลานจอดรถส่วนตัวให้บริการฟรีในบริเวณรีสอร์ต พร้อมระบบรักษาความปลอดภัย 24 ชม."
                  className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-forest-500/20 focus:border-forest-700 transition-all leading-relaxed"
                />
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* SECTION 3: นโยบายและกฎความปลอดภัยบริการเรือ */}
      {showBoat && (
        <Panel>
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-3 border-b border-stone-100">
              <div className="w-8 h-8 rounded-xl bg-forest-50 text-forest-800 border border-forest-200/80 flex items-center justify-center">
                <Anchor size={17} />
              </div>
              <div>
                <h2 className="text-base font-bold text-forest-900 font-display">
                  นโยบายและข้อกำหนดบริการเรือ (Boat Safety & Policies)
                </h2>
                <p className="text-xs text-charcoal-400">
                  กฎระเบียบความปลอดภัยการลงเรือ อุปกรณ์ชูชีพ และข้อจำกัดทางสภาพอากาศ
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-forest-900 font-bold text-xs sm:text-sm">
                <ShieldCheck size={16} className="text-forest-700" />
                <h3>ข้อกำหนดและกฎความปลอดภัยการลงเรือ</h3>
              </div>

              <div>
                <TermsListEditor
                  value={form.boat_terms}
                  onChange={(val) => setForm({ ...form, boat_terms: val })}
                  placeholder="เช่น ผู้โดยสารทุกคนต้องสวมเสื้อชูชีพตลอดเวลาขณะอยู่บนเรือ"
                />
                <p className="mt-2.5 text-xs text-charcoal-400">
                  ข้อความนี้จะแสดงให้ลูกค้าเห็นในหน้ารายละเอียดการจองเรือ และขั้นตอนก่อนยืนยันลงเรือ
                </p>
              </div>
            </div>

            {/* เวลาเช็คอิน / รายงานตัวก่อนรอบเรือ */}
            <div className="space-y-4 pt-4 border-t border-stone-100">
              <div className="flex items-center gap-2 text-forest-900 font-bold text-xs sm:text-sm">
                <Clock size={16} className="text-forest-700" />
                <h3>เวลาเช็คอิน / รายงานตัวก่อนรอบเรือ</h3>
              </div>

              <div className="rounded-2xl border border-cream-200/90 bg-cream-50/60 p-4 sm:p-5 space-y-3.5">
                <p className="text-xs text-charcoal-500 leading-relaxed">
                  ระยะเวลาขั้นต่ำที่ลูกค้าต้องมารายงานตัวที่จุดบริการเรือก่อนถึงรอบเวลา เพื่อให้เจ้าหน้าที่เตรียมเรือ สวมอุปกรณ์ชูชีพ และแนะนำข้อควรระวัง
                </p>

                <div className="flex items-center gap-2.5 flex-wrap pt-1">
                  <span className="text-xs sm:text-sm font-semibold text-charcoal-800">
                    ต้องเช็คอิน / รายงานตัวก่อนรอบเรืออย่างน้อย
                  </span>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={23}
                      value={Math.floor(Number(form.boat_checkin_advance_minutes) / 60)}
                      onChange={(e) => {
                        const h = Math.max(0, parseInt(e.target.value) || 0);
                        const m = Number(form.boat_checkin_advance_minutes) % 60;
                        setForm({ ...form, boat_checkin_advance_minutes: h * 60 + m });
                      }}
                      className="w-16 rounded-xl border border-cream-300 bg-white px-2.5 py-1.5 text-center text-xs sm:text-sm font-bold font-mono text-forest-950 focus:border-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-800/15"
                    />
                    <span className="text-xs sm:text-sm font-semibold text-charcoal-700">
                      ชม.
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={59}
                      step={5}
                      value={Number(form.boat_checkin_advance_minutes) % 60}
                      onChange={(e) => {
                        const m = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                        const h = Math.floor(Number(form.boat_checkin_advance_minutes) / 60);
                        setForm({ ...form, boat_checkin_advance_minutes: h * 60 + m });
                      }}
                      className="w-16 rounded-xl border border-cream-300 bg-white px-2.5 py-1.5 text-center text-xs sm:text-sm font-bold font-mono text-forest-950 focus:border-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-800/15"
                    />
                    <span className="text-xs sm:text-sm font-semibold text-charcoal-700">
                      นาที
                    </span>
                  </div>

                  <span className="text-xs text-charcoal-500 font-medium">
                    (รวม {form.boat_checkin_advance_minutes} นาที)
                  </span>
                </div>

                {/* Quick presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-cream-200/60">
                  <span className="text-[11px] text-charcoal-400 font-medium">ตัวเลือกด่วน:</span>
                  {[
                    { label: "10 นาที", mins: 10 },
                    { label: "15 นาที", mins: 15 },
                    { label: "20 นาที", mins: 20 },
                    { label: "30 นาที", mins: 30 },
                    { label: "45 นาที", mins: 45 },
                    { label: "1 ชั่วโมง", mins: 60 },
                  ].map((preset) => {
                    const isSelected = Number(form.boat_checkin_advance_minutes) === preset.mins;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          setForm({ ...form, boat_checkin_advance_minutes: preset.mins })
                        }
                        className={`text-xs px-2.5 py-1 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-forest-800 border-forest-800 text-white font-bold shadow-2xs"
                            : "bg-white border-cream-300 text-charcoal-600 hover:border-forest-600 hover:text-forest-900"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                {/* Dynamic Example Preview */}
                <div className="text-[11px] text-forest-900 bg-forest-50/80 border border-forest-200/70 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                  <span className="shrink-0 text-base">💡</span>
                  <span>
                    ตัวอย่าง: รอบเรือเวลา <strong>10:00 น.</strong> ผู้โดยสารต้องเดินทางมาถึงและเช็คอินภายในเวลา{" "}
                    <strong>
                      {(() => {
                        const mins = Number(form.boat_checkin_advance_minutes) || 0;
                        const date = new Date();
                        date.setHours(10, 0, 0, 0);
                        date.setMinutes(date.getMinutes() - mins);
                        return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} น.`;
                      })()}
                    </strong>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
