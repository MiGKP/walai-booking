"use client";

import { useState, useEffect } from "react";
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
} from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast from "react-hot-toast";
import MapPickerModal from "@/components/admin/MapPickerModal";

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

  useEffect(() => {
    if (!ready) return;
    api
      .get("/settings/resort")
      .then((res) => {
        if (res.data?.data) {
          const d = res.data.data;
          setForm({
            name: d.name || "",
            phone: d.phone || "",
            email: d.email || "",
            line_id: d.line_id || "",
            facebook: d.facebook || "",
            address: d.address || "",
            coordinates: d.coordinates || "",
            operating_days: d.operating_days || "",
            operating_hours: d.operating_hours || "",
            additional_terms: d.additional_terms || "",
            promptpay_id: d.promptpay_id || "",
            bank_account_no: d.bank_account_no || "",
            bank_account_name: d.bank_account_name || "",
            payment_due_days: d.payment_due_days
              ? String(d.payment_due_days)
              : "",
          });
        }
      })
      .catch(() => toast.error("โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [ready]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put("/settings/resort", {
        ...form,
        payment_due_days: form.payment_due_days
          ? Number(form.payment_due_days)
          : null,
      });
      toast.success("บันทึกข้อมูลเรียบร้อยแล้ว");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="space-y-6 font-sans pb-12">
      <form onSubmit={handleSave} className="space-y-6">
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
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                        <Clock size={14} className="text-stone-400" />{" "}
                        วันเปิดทำการ
                      </label>
                      <input
                        type="text"
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] transition-all"
                        value={form.operating_days}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            operating_days: e.target.value,
                          }))
                        }
                        placeholder="เช่น เปิดทุกวัน"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                        <Clock size={14} className="text-stone-400" /> เวลาทำการ
                      </label>
                      <input
                        type="text"
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] transition-all"
                        value={form.operating_hours}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            operating_hours: e.target.value,
                          }))
                        }
                        placeholder="เช่น 08:00 – 20:00 น."
                      />
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

            {/* ฝั่งขวา: ข้อมูลชำระเงิน & เงื่อนไข (แสดงเฉพาะ admin) */}
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
                      <Clock size={14} className="text-stone-400" />{" "}
                      กำหนดเวลาต้องชำระเงินหลังจอง (วัน)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={0}
                        className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] transition-all"
                        value={form.payment_due_days}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            payment_due_days: e.target.value,
                          }))
                        }
                        placeholder="เช่น 1 หรือ 3"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs text-stone-400 font-medium">
                        วัน
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1.5">
                      <FileText size={14} className="text-stone-400" />{" "}
                      เงื่อนไขและข้อกำหนดเพิ่มเติม
                    </label>
                    <textarea
                      rows={4}
                      className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-[#064e3b] transition-all resize-none"
                      value={form.additional_terms}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          additional_terms: e.target.value,
                        }))
                      }
                      placeholder="เงื่อนไขการเข้าพัก นโยบายการคืนเงิน..."
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </form>

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
