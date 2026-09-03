"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  Save,
  Lock,
  ShieldCheck,
  MessageSquare,
  Facebook,
  MapPin,
} from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast from "react-hot-toast";

export default function AdminProfilePage() {
  const router = useRouter();
  const { ready, user } = useAuthGuard();
  const { updateUser } = useAuth();

  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    line_id: "",
    facebook: "",
    address: "",
  });

  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
    confirm: "",
  });

  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;
    setProfile({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      phone: user.phone || "",
      line_id: user.line_id || "",
      facebook: user.facebook || "",
      address: user.address || "",
    });
  }, [ready, user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put("/auth/profile", profile);
      updateUser(res.data.data);
      toast.success("บันทึกข้อมูลสำเร็จ");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm) {
      toast.error("รหัสผ่านใหม่ไม่ตรงกัน");
      return;
    }
    if (passwords.new_password.length < 6) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    setChangingPw(true);
    try {
      await api.put("/auth/change-password", {
        current_password: passwords.current_password,
        new_password: passwords.new_password,
      });
      toast.success("เปลี่ยนรหัสผ่านสำเร็จ");
      setPasswords({ current_password: "", new_password: "", confirm: "" });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ");
    } finally {
      setChangingPw(false);
    }
  };

  if (!ready || !user) return null;

  return (
    /* ปรับ p-2 md:p-3 ให้ชิดขอบบนมากขึ้น และ space-y-3 ให้ช่องว่างระหว่างการ์ดแคบลง */
    <div className="w-full p-2 md:p-3 space-y-3 font-sans">
      {/* Header Card - Compact */}
      <div className="bg-white rounded-2xl p-3.5 md:p-4 border border-stone-200/80 shadow-sm flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-[#133E31]/10 flex items-center justify-center text-[#133E31] shrink-0">
          <ShieldCheck size={24} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-[#133E31]">
              {user.first_name || "ผู้ใช้แอดมิน"} 
            </h1>
            <span className="bg-[#133E31] text-white text-xs font-bold px-2 py-0.5 rounded-md uppercase tracking-wide">
              ADMIN
            </span>
          </div>
          <p className="text-xs text-stone-500 mt-0.5">{user.email}</p>
        </div>
      </div>

      {/* Grid 2 ฝั่ง - ชิดบนมากขึ้น */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4 items-start">
        {/* การ์ดฝั่งซ้าย: ข้อมูลส่วนตัว */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-stone-200/80 shadow-sm">
          <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-stone-100">
            <User className="text-[#133E31]" size={18} />
            <h2 className="text-base font-bold text-[#133E31]">
              ข้อมูลส่วนตัว
            </h2>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  ชื่อ
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#133E31]/20 focus:border-[#133E31] transition-all bg-stone-50/30"
                  value={profile.first_name}
                  onChange={(e) =>
                    setProfile({ ...profile, first_name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  นามสกุล
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#133E31]/20 focus:border-[#133E31] transition-all bg-stone-50/30"
                  value={profile.last_name}
                  onChange={(e) =>
                    setProfile({ ...profile, last_name: e.target.value })
                  }
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">
                อีเมลผู้ดูแลระบบ
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                />
                <input
                  type="email"
                  disabled
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 bg-stone-100/70 text-stone-500 text-sm cursor-not-allowed font-mono"
                  value={user.email}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">
                เบอร์โทรศัพท์
              </label>
              <div className="relative">
                <Phone
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                />
                <input
                  type="tel"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#133E31]/20 focus:border-[#133E31] transition-all bg-stone-50/30"
                  placeholder="08X-XXX-XXXX"
                  value={profile.phone}
                  onChange={(e) =>
                    setProfile({ ...profile, phone: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  LINE ID
                </label>
                <div className="relative">
                  <MessageSquare
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                  />
                  <input
                    type="text"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#133E31]/20 focus:border-[#133E31] transition-all bg-stone-50/30"
                    placeholder="line_admin"
                    value={profile.line_id}
                    onChange={(e) =>
                      setProfile({ ...profile, line_id: e.target.value })
                    }
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-stone-700 mb-1">
                  Facebook
                </label>
                <div className="relative">
                  <Facebook
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                  />
                  <input
                    type="text"
                    className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#133E31]/20 focus:border-[#133E31] transition-all bg-stone-50/30"
                    placeholder="ชื่อ Facebook"
                    value={profile.facebook}
                    onChange={(e) =>
                      setProfile({ ...profile, facebook: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">
                ที่อยู่
              </label>
              <div className="relative">
                <MapPin
                  size={16}
                  className="absolute left-3 top-2.5 text-stone-400"
                />
                <textarea
                  rows={2}
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#133E31]/20 focus:border-[#133E31] transition-all bg-stone-50/30 resize-none"
                  placeholder="กรอกที่อยู่ปัจจุบัน..."
                  value={profile.address}
                  onChange={(e) =>
                    setProfile({ ...profile, address: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="pt-2 border-t border-stone-100 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 bg-[#133E31] hover:bg-[#0D2B22] text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
              >
                <Save size={15} />
                {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
              </button>
            </div>
          </form>
        </div>

        {/* การ์ดฝั่งขวา: เปลี่ยนรหัสผ่าน */}
        <div className="bg-white rounded-2xl p-4 md:p-5 border border-stone-200/80 shadow-sm">
          <div className="flex items-center gap-2 pb-2.5 mb-3 border-b border-stone-100">
            <Lock className="text-[#133E31]" size={18} />
            <h2 className="text-base font-bold text-[#133E31]">
              เปลี่ยนรหัสผ่าน
            </h2>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">
                รหัสผ่านปัจจุบัน
              </label>
              <input
                type="password"
                required
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#133E31]/20 focus:border-[#133E31] transition-all bg-stone-50/30"
                value={passwords.current_password}
                onChange={(e) =>
                  setPasswords({
                    ...passwords,
                    current_password: e.target.value,
                  })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">
                รหัสผ่านใหม่
              </label>
              <input
                type="password"
                required
                minLength={6}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#133E31]/20 focus:border-[#133E31] transition-all bg-stone-50/30"
                value={passwords.new_password}
                onChange={(e) =>
                  setPasswords({ ...passwords, new_password: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-stone-700 mb-1">
                ยืนยันรหัสผ่านใหม่
              </label>
              <input
                type="password"
                required
                minLength={6}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#133E31]/20 focus:border-[#133E31] transition-all bg-stone-50/30"
                value={passwords.confirm}
                onChange={(e) =>
                  setPasswords({ ...passwords, confirm: e.target.value })
                }
              />
            </div>

            <div className="pt-2 border-t border-stone-100 flex justify-end">
              <button
                type="submit"
                disabled={changingPw}
                className="px-4 py-2 border border-[#133E31] text-[#133E31] hover:bg-[#133E31] hover:text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-50"
              >
                <Lock size={15} />
                {changingPw ? "กำลังอัปเดต..." : "อัปเดตรหัสผ่าน"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
