"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Phone, Save, Lock, MessageCircle, Facebook, CalendarDays, Camera, Eye, EyeOff, Star, Ticket } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { resolveAvatarUrl } from "@/lib/avatar";
import toast from "react-hot-toast";
import MyBookingsPanel from "@/components/dashboard/MyBookingsPanel";
import MyReviewsSection from "@/components/dashboard/MyReviewsSection";
import MyCouponsSection from "@/components/dashboard/MyCouponsSection";

const CARD = "rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(18,60,48,0.02),0_8px_24px_-8px_rgba(18,60,48,0.08)] p-5 sm:p-6";

function SectionHeading({ icon, title }: { icon: React.ReactNode; title: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-700">{icon}</span>
      <h2 className="font-sans text-[16px] font-semibold text-forest-900">{title}</h2>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return <label className="mb-1.5 block text-[12.5px] font-semibold text-charcoal-600">{children}</label>;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  customer: "ลูกค้า",
  room_staff: "เจ้าหน้าที่ห้องพัก",
  boat_staff: "เจ้าหน้าที่เรือ",
};

// input รหัสผ่านพร้อมปุ่มแสดง/ซ่อน (ไอคอนตา)
function PasswordField({
  value,
  onChange,
  required,
  minLength,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  minLength?: number;
}): React.ReactElement {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? "text" : "password"}
        required={required}
        minLength={minLength}
        className="input-field pr-11"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-charcoal-600"
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

// หน้าโปรไฟล์ของผู้ใช้ ใช้สำหรับแก้ไขข้อมูลส่วนตัว และจัดการรหัสผ่านตามประเภทการสมัครของ member
export default function DashboardPage() {
  const { ready, user } = useAuthGuard();
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    line_id: "",
    facebook: "",
  });
  const [avatarPreview, setAvatarPreview] = useState("");
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [passwords, setPasswords] = useState({
    current_password: "",
    new_password: "",
    confirm: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [activeTab, setActiveTab] = useState<"bookings" | "profile" | "security" | "reviews" | "coupons">("bookings");
  const displayAvatarSrc = useMemo(
    () => (avatarLoadError ? "" : avatarPreview),
    [avatarLoadError, avatarPreview],
  );

  // เคลียร์ blob URL ทิ้งตอน unmount กันหน่วยความจำรั่ว
  useEffect(() => {
    return () => {
      if (avatarPreview.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  useEffect(() => {
    if (!ready || !user) return;
    setProfile({
      first_name: user.first_name,
      last_name: user.last_name,
      phone: user.phone || "",
      line_id: user.line_id || "",
      facebook: user.facebook || "",
    });
    setAvatarPreview(resolveAvatarUrl(user.avatar));
    setAvatarLoadError(false);
  }, [ready, user]);

  // บันทึกการแก้ไขข้อมูลโปรไฟล์ เช่น ชื่อและเบอร์โทร แล้ว sync ข้อมูลใหม่กลับเข้า auth store
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put("/auth/profile", profile);
      updateUser(res.data.data);
      toast.success("บันทึกโปรไฟล์สำเร็จ");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  // กดที่รูปแล้วเลือกไฟล์ปุ๊บอัปโหลดทันที ไม่ต้องมีขั้นตอน/ปุ่มแยกต่างหาก
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
      e.target.value = "";
      return;
    }
    const MAX_AVATAR_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_AVATAR_SIZE) {
      toast.error("ขนาดไฟล์ต้องไม่เกิน 5MB");
      e.target.value = "";
      return;
    }

    setAvatarLoadError(false);
    setAvatarPreview(URL.createObjectURL(file));

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const res = await api.post("/auth/profile/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      updateUser({ avatar: res.data.data.avatar });
      setAvatarLoadError(false);
      setAvatarPreview(resolveAvatarUrl(res.data.data.avatar));
      toast.success("อัปเดตรูปโปรไฟล์สำเร็จ");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "อัปโหลดรูปโปรไฟล์ไม่สำเร็จ");
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  // เปลี่ยนรหัสผ่านสำหรับผู้ใช้ที่มีรหัสผ่านเดิมอยู่แล้ว โดยตรวจสอบความถูกต้องของข้อมูลก่อนส่งไป backend
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

  // ตั้งรหัสผ่านครั้งแรกสำหรับผู้ใช้ที่สมัครผ่าน Google และยังไม่มี password ในระบบ
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm) {
      toast.error("รหัสผ่านไม่ตรงกัน");
      return;
    }
    if (passwords.new_password.length < 6) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    setChangingPw(true);
    try {
      await api.put("/auth/set-password", {
        new_password: passwords.new_password,
      });
      toast.success("ตั้งรหัสผ่านสำเร็จ");
      setPasswords({ current_password: "", new_password: "", confirm: "" });
      // Update local user state to reflect they now have a password
      updateUser({ has_password: true });
    } catch (err: any) {
      toast.error(err.response?.data?.message || "ตั้งรหัสผ่านไม่สำเร็จ");
    } finally {
      setChangingPw(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-cream-100 pt-16">
      <div className="w-full px-4 py-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr] lg:items-start">
          {/* ---- ฝั่งซ้าย: Sidebar Navigation ---- */}
          <div className="flex flex-col gap-4">
            {/* User Mini Profile */}
            <div className={`${CARD} hidden lg:flex flex-col items-center text-center p-6 pb-7`}>
              <div className="h-24 w-24 rounded-full bg-stone-100 overflow-hidden mb-3 border-4 border-white shadow-sm">
                {displayAvatarSrc ? (
                  <img src={displayAvatarSrc} alt="Profile" className="h-full w-full object-cover" onError={() => setAvatarLoadError(true)} />
                ) : (
                  <User size={36} className="text-forest-600 w-full h-full p-4" />
                )}
              </div>
              <h2 className="font-sans text-[16px] font-bold text-forest-900 truncate w-full">
                {user.first_name} {user.last_name}
              </h2>
              <p className="text-[12.5px] text-charcoal-400 truncate w-full">{user.email}</p>
              <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider ${user.role === "admin" ? "bg-bamboo-50 text-bamboo-600" : user.role === "customer" ? "bg-forest-50 text-forest-700" : "bg-lagoon-50 text-lagoon-700"}`}>
                {ROLE_LABELS[user.role] || user.role}
              </span>
            </div>

            {/* Navigation Menu */}
            <div className={`${CARD} p-2 lg:p-3`}>
              <nav className="flex lg:flex-col gap-1 overflow-x-auto no-scrollbar">
                <button
                  onClick={() => setActiveTab("bookings")}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-3 text-[13.5px] font-semibold transition-colors ${activeTab === "bookings" ? "bg-forest-50 text-forest-900" : "text-charcoal-500 hover:bg-stone-50 hover:text-charcoal-700"}`}
                >
                  <CalendarDays size={18} className={activeTab === "bookings" ? "text-forest-700" : "text-charcoal-400"} />
                  การจองของฉัน
                </button>
                <button
                  onClick={() => setActiveTab("profile")}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-3 text-[13.5px] font-semibold transition-colors ${activeTab === "profile" ? "bg-forest-50 text-forest-900" : "text-charcoal-500 hover:bg-stone-50 hover:text-charcoal-700"}`}
                >
                  <User size={18} className={activeTab === "profile" ? "text-forest-700" : "text-charcoal-400"} />
                  ข้อมูลส่วนตัว
                </button>
                <button
                  onClick={() => setActiveTab("security")}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-3 text-[13.5px] font-semibold transition-colors ${activeTab === "security" ? "bg-forest-50 text-forest-900" : "text-charcoal-500 hover:bg-stone-50 hover:text-charcoal-700"}`}
                >
                  <Lock size={18} className={activeTab === "security" ? "text-forest-700" : "text-charcoal-400"} />
                  รหัสผ่านและความปลอดภัย
                </button>
                <button
                  onClick={() => setActiveTab("reviews")}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-3 text-[13.5px] font-semibold transition-colors ${activeTab === "reviews" ? "bg-forest-50 text-forest-900" : "text-charcoal-500 hover:bg-stone-50 hover:text-charcoal-700"}`}
                >
                  <Star size={18} className={activeTab === "reviews" ? "text-forest-700" : "text-charcoal-400"} />
                  รีวิวของฉัน
                </button>
                <button
                  onClick={() => setActiveTab("coupons")}
                  className={`flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-3 text-[13.5px] font-semibold transition-colors ${activeTab === "coupons" ? "bg-forest-50 text-forest-900" : "text-charcoal-500 hover:bg-stone-50 hover:text-charcoal-700"}`}
                >
                  <Ticket size={18} className={activeTab === "coupons" ? "text-forest-700" : "text-charcoal-400"} />
                  โปรโมชั่นของฉัน
                </button>
              </nav>
            </div>
          </div>

          {/* ---- ฝั่งขวา: Main Content ---- */}
          <div className="space-y-6">
            {activeTab === "bookings" && (
              <section className={CARD}>
                <h1 className="mb-5 font-sans text-[18px] font-semibold text-forest-900 border-b border-stone-100 pb-4">การจองของฉัน</h1>
                <MyBookingsPanel ready={ready} />
              </section>
            )}

            {activeTab === "reviews" && (
              <section className={CARD}>
                <h1 className="mb-5 font-sans text-[18px] font-semibold text-forest-900 border-b border-stone-100 pb-4">รีวิวของฉัน</h1>
                <MyReviewsSection />
              </section>
            )}

            {activeTab === "coupons" && (
              <section className={CARD}>
                <h1 className="mb-5 font-sans text-[18px] font-semibold text-forest-900 border-b border-stone-100 pb-4">โปรโมชั่นของฉัน</h1>
                <MyCouponsSection />
              </section>
            )}

            {activeTab === "profile" && (
              <div className="space-y-6">
                <section className={CARD}>
                  <h1 className="mb-5 font-sans text-[18px] font-semibold text-forest-900 border-b border-stone-100 pb-4">จัดการโปรไฟล์</h1>
                  
                  <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 pt-2">
                    {/* ---- ฝั่งซ้าย: รูปโปรไฟล์ ---- */}
                    <div className="flex flex-col items-center lg:items-start lg:w-48 shrink-0">
                      <label
                        htmlFor="avatar-upload"
                        className={`group relative grid h-28 w-28 shrink-0 place-items-center ${user.role === "customer" ? "cursor-pointer" : ""}`}
                      >
                        <div className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-forest-50 ring-4 ring-white shadow-md">
                          {displayAvatarSrc ? (
                            <img
                              src={displayAvatarSrc}
                              alt={`${user.first_name} ${user.last_name}`}
                              className="h-full w-full object-cover"
                              onError={() => setAvatarLoadError(true)}
                            />
                          ) : (
                            <User size={40} className="text-forest-600" />
                          )}
                          {user.role === "customer" && (
                            <div className="absolute inset-0 grid place-items-center rounded-full bg-forest-950/0 text-cream-100 opacity-0 transition-all group-hover:bg-forest-950/50 group-hover:opacity-100">
                              <Camera size={24} />
                            </div>
                          )}
                        </div>
                        {user.role === "customer" && (
                          <>
                            <span
                              role="img"
                              aria-label="เปลี่ยนรูปโปรไฟล์"
                              className="absolute bottom-0 right-0 grid h-8 w-8 place-items-center rounded-full bg-forest-800 text-white ring-2 ring-white shadow-sm"
                            >
                              <Camera size={14} />
                            </span>
                            <input
                              id="avatar-upload"
                              type="file"
                              accept="image/*"
                              onChange={handleAvatarChange}
                              disabled={uploadingAvatar}
                              className="hidden"
                            />
                          </>
                        )}
                      </label>
                      
                      <div className="mt-4 text-center lg:text-left">
                        <p className="text-[13px] font-bold text-forest-900">รูปภาพโปรไฟล์</p>
                        <p className="text-[12px] text-charcoal-400 mt-1.5 leading-relaxed">
                          จะแสดงในหน้าต่างๆ และหน้ารีวิวของระบบ
                        </p>
                        {uploadingAvatar && <p className="mt-2 text-[12px] font-semibold text-forest-600">กำลังอัปโหลด...</p>}
                      </div>
                    </div>

                    {/* ---- ฝั่งขวา: ฟอร์มข้อมูล ---- */}
                    <div className="flex-1 min-w-0">
                      <form onSubmit={handleSaveProfile} className="space-y-8">
                        {/* ข้อมูลส่วนตัว */}
                        <div>
                          <h3 className="text-[12.5px] font-bold text-forest-800 uppercase tracking-wide border-b border-stone-100 pb-2 mb-4">ข้อมูลส่วนตัว</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <FieldLabel>ชื่อ</FieldLabel>
                              <input
                                type="text"
                                required
                                className="input-field"
                                value={profile.first_name || ""}
                                onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                              />
                            </div>
                            <div>
                              <FieldLabel>นามสกุล</FieldLabel>
                              <input
                                type="text"
                                required
                                className="input-field"
                                value={profile.last_name || ""}
                                onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* ช่องทางติดต่อ */}
                        <div>
                          <h3 className="text-[12.5px] font-bold text-forest-800 uppercase tracking-wide border-b border-stone-100 pb-2 mb-4">ช่องทางติดต่อ</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <FieldLabel>อีเมล</FieldLabel>
                              <div className="relative">
                                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                                <input
                                  type="email"
                                  disabled
                                  className="input-field cursor-not-allowed bg-stone-50 pl-10 text-charcoal-400"
                                  value={user.email}
                                />
                              </div>
                            </div>
                            <div>
                              <FieldLabel>เบอร์โทรศัพท์</FieldLabel>
                              <div className="relative">
                                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                                <input
                                  type="tel"
                                  className="input-field pl-10"
                                  placeholder="08X-XXX-XXXX"
                                  value={profile.phone}
                                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                                />
                              </div>
                            </div>
                            <div>
                              <FieldLabel>LINE ID</FieldLabel>
                              <div className="relative">
                                <MessageCircle size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                                <input
                                  type="text"
                                  className="input-field pl-10"
                                  placeholder="เช่น walai_user"
                                  value={profile.line_id}
                                  onChange={(e) => setProfile({ ...profile, line_id: e.target.value })}
                                />
                              </div>
                            </div>
                            <div>
                              <FieldLabel>Facebook</FieldLabel>
                              <div className="relative">
                                <Facebook size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                                <input
                                  type="text"
                                  className="input-field pl-10"
                                  placeholder="ลิงก์หรือชื่อบัญชี"
                                  value={profile.facebook}
                                  onChange={(e) => setProfile({ ...profile, facebook: e.target.value })}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t border-stone-100 flex justify-end">
                          <button
                            type="submit"
                            disabled={saving}
                            className="btn-primary w-full sm:w-auto px-8 py-2.5 items-center justify-center gap-2 disabled:opacity-60"
                          >
                            <Save size={16} className="inline-block mr-2" />
                            {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {activeTab === "security" && (
              <section className={CARD}>
                <div className="max-w-md mx-auto py-2 sm:py-6">
                  <div className="mb-8 text-center">
                    <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-forest-50 text-forest-700 ring-4 ring-forest-50/50">
                      <Lock size={24} />
                    </div>
                    <h1 className="font-sans text-[18px] font-semibold text-forest-900">รหัสผ่านและความปลอดภัย</h1>
                    <p className="mt-1.5 text-[13px] text-charcoal-400">จัดการรหัสผ่านของคุณเพื่อความปลอดภัยของบัญชี</p>
                  </div>
                  
                  {user.auth_provider === "google" && !user.has_password ? (
                    <>
                      <div className="mb-6 rounded-xl bg-forest-50/60 p-4 text-[13px] leading-relaxed text-forest-800">
                        คุณล็อกอินด้วย Google อยู่ คุณสามารถตั้งรหัสผ่านเพื่อใช้ล็อกอินด้วยอีเมลในครั้งต่อไปได้
                      </div>
                      <form onSubmit={handleSetPassword} className="space-y-5">
                        <div>
                          <FieldLabel>รหัสผ่านใหม่</FieldLabel>
                          <PasswordField
                            required
                            minLength={6}
                            value={passwords.new_password}
                            onChange={(v) => setPasswords({ ...passwords, new_password: v })}
                          />
                        </div>
                        <div>
                          <FieldLabel>ยืนยันรหัสผ่านใหม่</FieldLabel>
                          <PasswordField
                            required
                            minLength={6}
                            value={passwords.confirm}
                            onChange={(v) => setPasswords({ ...passwords, confirm: v })}
                          />
                        </div>
                        <div className="pt-2">
                          <button
                            type="submit"
                            disabled={changingPw}
                            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
                          >
                            <Lock size={16} />
                            {changingPw ? "กำลังบันทึก..." : "ตั้งรหัสผ่าน"}
                          </button>
                        </div>
                      </form>
                    </>
                  ) : (
                    <form onSubmit={handleChangePassword} className="space-y-5">
                      <div>
                        <FieldLabel>รหัสผ่านปัจจุบัน</FieldLabel>
                        <PasswordField
                          required
                          value={passwords.current_password}
                          onChange={(v) => setPasswords({ ...passwords, current_password: v })}
                        />
                      </div>
                      <div className="pt-2 border-t border-stone-100"></div>
                      <div>
                        <FieldLabel>รหัสผ่านใหม่</FieldLabel>
                        <PasswordField
                          required
                          minLength={6}
                          value={passwords.new_password}
                          onChange={(v) => setPasswords({ ...passwords, new_password: v })}
                        />
                      </div>
                      <div>
                        <FieldLabel>ยืนยันรหัสผ่านใหม่</FieldLabel>
                        <PasswordField
                          required
                          minLength={6}
                          value={passwords.confirm}
                          onChange={(v) => setPasswords({ ...passwords, confirm: v })}
                        />
                      </div>
                      <div className="pt-2">
                        <button
                          type="submit"
                          disabled={changingPw}
                          className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
                        >
                          <Lock size={16} />
                          {changingPw ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
