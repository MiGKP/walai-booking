"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Phone, Save, Lock, Upload } from "lucide-react";
import api from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { resolveAvatarUrl } from "@/lib/avatar";
import toast from "react-hot-toast";
import Link from "next/link";

// หน้าโปรไฟล์ของผู้ใช้ ใช้สำหรับแก้ไขข้อมูลส่วนตัว และจัดการรหัสผ่านตามประเภทการสมัครของ member
export default function DashboardPage() {
  const router = useRouter();
  const { ready, user } = useAuthGuard();
  const { updateUser } = useAuth();
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    line_id: "",
    facebook: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
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
  const displayAvatarSrc = useMemo(
    () => (avatarLoadError ? "" : avatarPreview),
    [avatarLoadError, avatarPreview],
  );

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

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarLoadError(false);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) {
      toast.error("กรุณาเลือกรูปโปรไฟล์ก่อน");
      return;
    }

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("avatar", avatarFile);
      const res = await api.post("/auth/profile/avatar", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      updateUser({ avatar: res.data.data.avatar });
      setAvatarLoadError(false);
      setAvatarPreview(resolveAvatarUrl(res.data.data.avatar));
      setAvatarFile(null);
      toast.success("อัปเดตรูปโปรไฟล์สำเร็จ");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "อัปโหลดรูปโปรไฟล์ไม่สำเร็จ");
    } finally {
      setUploadingAvatar(false);
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
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">โปรไฟล์ของฉัน</h1>
          <p className="text-gray-500 mt-1">จัดการข้อมูลส่วนตัวของคุณ</p>
        </div>

        {/* Nav Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-900 shadow-sm"
          >
            โปรไฟล์
          </Link>
          <Link
            href="/dashboard/bookings"
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            การจองของฉัน
          </Link>
        </div>

        {/* Avatar + Info */}
        <div className="card p-6 mb-5">
          <div className="flex items-center gap-5 mb-6">
            <div className="w-20 h-20 rounded-2xl bg-teal-100 flex items-center justify-center overflow-hidden">
              {displayAvatarSrc ? (
                <img
                  src={displayAvatarSrc}
                  alt={`${user.first_name} ${user.last_name}`}
                  className="w-full h-full object-cover"
                  onError={() => setAvatarLoadError(true)}
                />
              ) : (
                <User size={36} className="text-teal-600" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {user.first_name} {user.last_name}
              </h2>
              <p className="text-gray-500 text-sm">{user.email}</p>
              <span
                className={`inline-block mt-1 text-xs font-medium px-2.5 py-1 rounded-full ${user.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-teal-100 text-teal-700"}`}
              >
                {user.role === "admin" ? "ผู้ดูแลระบบ" : "ลูกค้า"}
              </span>
            </div>
          </div>

          {user.role === "customer" && (
            <div className="mb-6 rounded-xl border border-gray-200 p-4 bg-gray-50">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                รูปโปรไฟล์
              </label>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                  className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-teal-100 file:px-4 file:py-2 file:text-teal-700"
                />
                <button
                  type="button"
                  onClick={handleUploadAvatar}
                  disabled={uploadingAvatar || !avatarFile}
                  className="btn-outline flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Upload size={16} />{" "}
                  {uploadingAvatar ? "กำลังอัปโหลด..." : "อัปโหลดรูป"}
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  ชื่อ
                </label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={profile.first_name || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, first_name: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  นามสกุล
                </label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={profile.last_name || ""}
                  onChange={(e) =>
                    setProfile({ ...profile, last_name: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                อีเมล
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="email"
                  disabled
                  className="input-field pl-10 bg-gray-50 text-gray-500 cursor-not-allowed"
                  value={user.email}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                เบอร์โทรศัพท์
              </label>
              <div className="relative">
                <Phone
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="tel"
                  className="input-field pl-10"
                  placeholder="08X-XXX-XXXX"
                  value={profile.phone}
                  onChange={(e) =>
                    setProfile({ ...profile, phone: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                LINE ID
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="เช่น walai_user"
                value={profile.line_id}
                onChange={(e) =>
                  setProfile({ ...profile, line_id: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Facebook
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="ลิงก์หรือชื่อบัญชี Facebook"
                value={profile.facebook}
                onChange={(e) =>
                  setProfile({ ...profile, facebook: e.target.value })
                }
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="btn-primary flex items-center gap-2 disabled:opacity-60"
            >
              <Save size={16} />{" "}
              {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
            </button>
          </form>
        </div>

        {/* Password Section: only show for customers */}
        {user.role === "customer" && (
          <div className="card p-6">
            {user.auth_provider === "google" && !user.has_password ? (
              /* Google user — offer to set a password */
              <>
                <h2 className="text-lg font-bold text-gray-900 mb-2 flex items-center gap-2">
                  <Lock size={20} className="text-teal-600" /> ตั้งรหัสผ่าน
                </h2>
                <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">
                  คุณล็อกอินด้วย Google อยู่
                  คุณสามารถตั้งรหัสผ่านเพื่อใช้ล็อกอินด้วยอีเมลในครั้งต่อไปได้
                </div>
                <form onSubmit={handleSetPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      รหัสผ่านใหม่
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      className="input-field"
                      value={passwords.new_password}
                      onChange={(e) =>
                        setPasswords({
                          ...passwords,
                          new_password: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      ยืนยันรหัสผ่านใหม่
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      className="input-field"
                      value={passwords.confirm}
                      onChange={(e) =>
                        setPasswords({ ...passwords, confirm: e.target.value })
                      }
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={changingPw}
                    className="btn-outline flex items-center gap-2 disabled:opacity-60"
                  >
                    <Lock size={16} />{" "}
                    {changingPw ? "กำลังบันทึก..." : "ตั้งรหัสผ่าน"}
                  </button>
                </form>
              </>
            ) : (
              /* Email user (or Google user that already set password) — change password */
              <>
                <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
                  <Lock size={20} className="text-teal-600" /> เปลี่ยนรหัสผ่าน
                </h2>
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      รหัสผ่านปัจจุบัน
                    </label>
                    <input
                      type="password"
                      required
                      className="input-field"
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
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      รหัสผ่านใหม่
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      className="input-field"
                      value={passwords.new_password}
                      onChange={(e) =>
                        setPasswords({
                          ...passwords,
                          new_password: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      ยืนยันรหัสผ่านใหม่
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      className="input-field"
                      value={passwords.confirm}
                      onChange={(e) =>
                        setPasswords({ ...passwords, confirm: e.target.value })
                      }
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={changingPw}
                    className="btn-outline flex items-center gap-2 disabled:opacity-60"
                  >
                    <Lock size={16} />{" "}
                    {changingPw ? "กำลังบันทึก..." : "เปลี่ยนรหัสผ่าน"}
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
