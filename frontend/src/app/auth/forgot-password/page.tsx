"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image"; // นำเข้า Image จาก next/image
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react"; // นำ Waves ออก เพราะจะใช้โลโก้แทน
import { useAuthGuard } from "@/hooks/useAuthGuard";
import api from "@/lib/api";
import toast from "react-hot-toast";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ guestOnly: true });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!ready) return null;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(
        "/auth/forgot-password",
        { email: email.trim().toLowerCase() },
        { timeout: 25000 },
      );
      setSubmitted(true);
      toast.success("หากอีเมลนี้มีอยู่ในระบบ เราได้ส่ง OTP ให้แล้ว");
      router.push(
        `/auth/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`,
      );
    } catch (err: unknown) {
      const axiosErr = err as {
        code?: string;
        response?: { data?: { message?: string } };
      };
      if (axiosErr.code === "ECONNABORTED") {
        toast.error("การส่ง OTP ใช้เวลานานเกินไป กรุณาลองใหม่");
      } else {
        toast.error(axiosErr.response?.data?.message || "ไม่สามารถส่ง OTP ได้");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    // ปรับพื้นหลังเป็นสีขาวครีม (cream-100) ตาม Navbar/Footer
    <div className="min-h-screen pt-24 pb-12 bg-cream-100 flex items-start justify-center px-4">
      <div className="w-full max-w-md">
        <div className="card p-8 bg-white rounded-3xl shadow-lg border border-stone-100">
          <div className="text-center mb-8 flex flex-col items-center">
            {/* โลโก้สำหรับคลิกกลับหน้าหลัก พร้อมเอฟเฟกต์ hover */}
            <Link
              href="/"
              className="inline-block mb-4 transition-transform duration-300 hover:scale-105"
              aria-label="กลับหน้าแรก"
            >
              <div className="w-20 h-20 rounded-full bg-cream-100 p-1 flex items-center justify-center overflow-hidden shadow-inner border border-stone-100">
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
            {/* ปรับสีหัวข้อเป็นสีเขียวเข้ม (forest-800) */}
            <h1 className="text-2xl font-bold text-forest-800 font-display">
              กู้รหัสผ่าน
            </h1>
            <p className="text-charcoal-500 mt-1.5 text-sm">
              กรอกอีเมลเพื่อรับ OTP สำหรับตั้งรหัสผ่านใหม่
            </p>
          </div>

          {submitted ? (
            // ปรับสีกล่องแจ้งเตือนเมื่อส่งสำเร็จ
            <div className="rounded-2xl border border-bamboo-200 bg-bamboo-50 p-6 text-center shadow-inner">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white text-bamboo-500 shadow-md">
                <Mail size={26} />
              </div>
              <h2 className="text-lg font-bold text-forest-900 font-display">
                เช็กอีเมลของคุณ
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-charcoal-700">
                หากอีเมล{" "}
                <span className="font-semibold text-forest-800 break-all">
                  {email}
                </span>{" "}
                มีอยู่ในระบบ เราได้ส่ง OTP สำหรับตั้งรหัสผ่านใหม่ให้แล้ว
              </p>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/auth/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`,
                  )
                }
                className="mt-5 btn-primary w-full shadow-md"
              >
                ไปหน้ากรอก OTP
              </button>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-4 text-sm font-semibold text-bamboo-600 hover:text-bamboo-700 transition-colors"
              >
                ส่งใหม่อีกครั้ง
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-charcoal-700 mb-1.5">
                  อีเมลที่ใช้สมัครสมาชิก
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
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full rounded-full shadow-md disabled:opacity-60 disabled:cursor-not-allowed transform transition-all active:scale-[0.98]"
              >
                {loading ? "กำลังส่ง OTP..." : "ส่ง OTP ไปยังอีเมล"}
              </button>
            </form>
          )}

          <div className="relative my-7">
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
