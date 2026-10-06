"use client";

import { useState, useEffect } from "react";
import { Save, AlertCircle, Loader2, Clock, Users, Car } from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { pickResortInfo } from "@/lib/resort-info";
import { PageHeader, Panel } from "@/components/admin/ui";

export default function PoliciesSettingsPage() {
  const { ready, user } = useAuthGuard({
    allowedRoles: ["admin", "room_staff"],
  });

  const [form, setForm] = useState({
    checkin_time_from: "14:00",
    checkin_time_to: "23:00",
    checkout_time: "12:00",
    important_info: "",
    kids_policy: "",
    infant_max_age_exclusive: "6",
    parking_info: "",
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
      const info = pickResortInfo(data.data, "room"); // 4 is room
      const mainInfo = pickResortInfo(data.data, "main");
      if (info) {
        setForm({
          checkin_time_from: (info.checkin_time_from as string) || "14:00",
          checkin_time_to: (info.checkin_time_to as string) || "23:00",
          checkout_time: (info.checkout_time as string) || "12:00",
          important_info: (info.important_info as string) || "",
          kids_policy: (info.kids_policy as string) || "",
          infant_max_age_exclusive: String(mainInfo.infant_max_age_exclusive ?? 6),
          parking_info: (info.parking_info as string) || "",
        });
      }
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
    if (user?.role === 'admin' && (form.infant_max_age_exclusive.trim() === '' || !Number.isInteger(infantAge) || infantAge < 0 || infantAge > 18)) {
      notify.error('กรุณาระบุอายุที่เริ่มนับความจุเป็นจำนวนเต็ม 0-18 ปี');
      return;
    }
    try {
      setSaving(true);
      await api.put("/settings/resort", {
        id: 4, // ID for Room 
        checkin_time_from: form.checkin_time_from,
        checkin_time_to: form.checkin_time_to,
        checkout_time: form.checkout_time,
        important_info: form.important_info,
        kids_policy: form.kids_policy,
        parking_info: form.parking_info,
      });
      if (user?.role === 'admin') {
        await api.put('/settings/resort', {
          id: 3, infant_max_age_exclusive: infantAge,
        });
      }
      notify.success("บันทึกนโยบายสำเร็จ");
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

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="ตั้งค่านโยบายและข้อมูลสำคัญ"
        description="ข้อมูลเหล่านี้จะแสดงในหน้ารายละเอียดห้องพัก"
        actions={
          <button
            onClick={handleSave}
            disabled={saving || loading || loadError}
            className="flex items-center gap-2 rounded-xl bg-forest-700 px-5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-forest-800 active:scale-95 disabled:opacity-70 cursor-pointer"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span>{saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}</span>
          </button>
        }
      />

      <Panel>
        <div className="space-y-6">
          {/* Check-in / Check-out */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-forest-900 font-bold text-sm pb-3 border-b border-stone-100">
              <Clock size={18} />
              <h2>เวลาเช็คอิน / เช็คเอาต์</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">เวลาเช็คอิน (ตั้งแต่ - ถึง)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={form.checkin_time_from}
                    onChange={(e) => setForm({ ...form, checkin_time_from: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-forest-500/20 focus:border-forest-700 transition-all"
                  />
                  <span className="text-stone-400">-</span>
                  <input
                    type="time"
                    value={form.checkin_time_to}
                    onChange={(e) => setForm({ ...form, checkin_time_to: e.target.value })}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-forest-500/20 focus:border-forest-700 transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">เวลาเช็คเอาต์ (ก่อน)</label>
                <input
                  type="time"
                  value={form.checkout_time}
                  onChange={(e) => setForm({ ...form, checkout_time: e.target.value })}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-forest-500/20 focus:border-forest-700 transition-all"
                />
              </div>
            </div>
          </div>

          {/* Important Info */}
          <div className="space-y-4 pt-4 border-t border-stone-100">
            <div className="flex items-center gap-2 text-forest-900 font-bold text-sm pb-3 border-b border-stone-100">
              <AlertCircle size={18} />
              <h2>ข้อมูลสำคัญที่พัก (Important Details)</h2>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">กฎและข้อกำหนด (ขึ้นบรรทัดใหม่เพื่อแยกข้อ)</label>
              <textarea
                rows={5}
                value={form.important_info}
                onChange={(e) => setForm({ ...form, important_info: e.target.value })}
                placeholder="รวมอาหารเช้าสำหรับทุกการจอง\nไม่อนุญาตให้นำสัตว์เลี้ยงเข้าพัก"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-forest-500/20 focus:border-forest-700 transition-all"
              />
            </div>
          </div>

          {/* Kids Policy */}
          <div className="space-y-4 pt-4 border-t border-stone-100">
            <div className="flex items-center gap-2 text-forest-900 font-bold text-sm pb-3 border-b border-stone-100">
              <Users size={18} />
              <h2>นโยบายเด็กและเตียงเสริม</h2>
            </div>
            {user?.role === 'admin' && (
              <div>
                <label htmlFor="infant-age" className="block text-xs font-semibold text-stone-700 mb-1.5">อายุที่เริ่มนับรวมในความจุห้อง (ปี)</label>
                <input id="infant-age" type="number" min={0} max={18} step={1} required
                  value={form.infant_max_age_exclusive}
                  onChange={(event) => setForm({ ...form, infant_max_age_exclusive: event.target.value })}
                  className="input-field max-w-xs" />
                <p className="mt-2 text-xs text-charcoal-500">เด็กที่อายุต่ำกว่าค่านี้เข้าพักฟรีและไม่นับความจุห้อง ใช้กับการจองใหม่</p>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">ข้อกำหนดเด็กและเตียง (รูปแบบ หัวข้อ: รายละเอียด)</label>
              <textarea
                rows={4}
                value={form.kids_policy}
                onChange={(e) => setForm({ ...form, kids_policy: e.target.value })}
                placeholder="เด็ก 0-5 ปี: เข้าพักฟรี\nเด็ก 6-11 ปี: คิดราคาเด็ก / เตียงเสริม"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-forest-500/20 focus:border-forest-700 transition-all"
              />
            </div>
          </div>

          {/* Parking Info */}
          <div className="space-y-4 pt-4 border-t border-stone-100">
            <div className="flex items-center gap-2 text-forest-900 font-bold text-sm pb-3 border-b border-stone-100">
              <Car size={18} />
              <h2>การเดินทางและที่จอดรถ</h2>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">รายละเอียดที่จอดรถและการเดินทาง</label>
              <textarea
                rows={3}
                value={form.parking_info}
                onChange={(e) => setForm({ ...form, parking_info: e.target.value })}
                placeholder="มีลานจอดรถส่วนตัวให้บริการฟรีในบริเวณ..."
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-forest-500/20 focus:border-forest-700 transition-all"
              />
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
