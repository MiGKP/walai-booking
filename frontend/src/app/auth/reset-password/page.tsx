"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import api from "@/lib/api";
import toast from "react-hot-toast";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready } = useAuthGuard({ guestOnly: true });
  const initialEmail = useMemo(
    () => searchParams.get("email") || "",
    [searchParams],
  );
  const [form, setForm] = useState({
    email: initialEmail,
    otp: "",
    new_password: "",
    confirm_password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!ready) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.otp) {
      toast.error("กรุณากรอกอีเมลและ OTP");
      return;
    }
    if (form.new_password !== form.confirm_password) {
      toast.error("รหัสผ่านไม่ตรงกัน");
      return;
    }
    if (form.new_password.length < 6) {
      toast.error("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/reset-password", {
        email: form.email,
        otp: form.otp,
        new_password: form.new_password,
      });
      toast.success("ตั้งรหัสผ่านใหม่สำเร็จ");
      router.push("/auth/login");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "รีเซ็ตรหัสผ่านไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
      {" "}
      <div className="w-full max-w-md">
        <div className="card p-6 sm:p-8 bg-white rounded-3xl shadow-lg border border-stone-100">
          <div className="text-center mb-6 flex flex-col items-center">
            <Link
              href="/"
              className="inline-block mb-2 transition-transform duration-300 hover:scale-105"
              aria-label="กลับหน้าแรก"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-cream-100 p-1 flex items-center justify-center overflow-hidden shadow-inner border border-stone-100">
                <Image
                  src="/images/logo_walai.png"
                  alt="โลโก้ วลัย"
                  width={72}
                  height={72}
                  className="object-contain"
                  priority
                />
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-forest-800 font-display">
              ตั้งรหัสผ่านใหม่
            </h1>
            <p className="text-charcoal-500 mt-1 text-sm">
              กรอกอีเมล, OTP และรหัสผ่านใหม่ของคุณ
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1">
                อีเมล
              </label>
              <div className="relative group">
                <Mail
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-bamboo-500 transition-colors"
                />
                <input
                  type="email"
                  required
                  className="input-field pl-11 rounded-full border-stone-200 focus:border-bamboo-300 focus:ring-bamboo-100"
                  placeholder="example@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1">
                OTP
              </label>
              <input
                type="text"
                required
                inputMode="numeric"
                maxLength={6}
                className="input-field rounded-full border-stone-200 focus:border-bamboo-300 focus:ring-bamboo-100"
                placeholder="กรอกรหัส OTP 6 หลัก"
                value={form.otp}
                onChange={(e) =>
                  setForm({
                    ...form,
                    otp: e.target.value.replace(/\D/g, "").slice(0, 6),
                  })
                }
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1">
                รหัสผ่านใหม่
              </label>
              <div className="relative group">
                <Lock
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-bamboo-500 transition-colors"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="input-field pl-11 pr-11 rounded-full border-stone-200 focus:border-bamboo-300 focus:ring-bamboo-100"
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  value={form.new_password}
                  onChange={(e) =>
                    setForm({ ...form, new_password: e.target.value })
                  }
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-bamboo-600 transition-colors"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal-700 mb-1">
                ยืนยันรหัสผ่านใหม่
              </label>
              <div className="relative group">
                <Lock
                  size={18}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-bamboo-500 transition-colors"
                />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="input-field pl-11 rounded-full border-stone-200 focus:border-bamboo-300 focus:ring-bamboo-100"
                  placeholder="ยืนยันรหัสผ่านใหม่"
                  value={form.confirm_password}
                  onChange={(e) =>
                    setForm({ ...form, confirm_password: e.target.value })
                  }
                  disabled={loading}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full rounded-full shadow-md disabled:opacity-60 disabled:cursor-not-allowed transform transition-all active:scale-[0.98]"
            >
              {loading ? "กำลังบันทึก..." : "บันทึกรหัสผ่านใหม่"}
            </button>
          </form>

          <div className="relative my-6">
            <div
              className="absolute inset-0 flex items-center"
              aria-hidden="true"
            >
              <div className="w-full border-t border-stone-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-2 text-stone-500">หรือ</span>
            </div>
          </div>

          <p className="text-center text-sm text-charcoal-600">
            จำรหัสผ่านได้แล้ว?{" "}
            <Link
              href="/auth/login"
              className="text-bamboo-600 font-semibold hover:text-bamboo-700 transition-colors"
            >
              กลับไปเข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-16 flex items-start justify-center bg-cream-100">
          <div className="p-8 bg-white rounded-3xl shadow-lg border border-stone-100">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-bamboo-500 border-t-transparent" />
          </div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
