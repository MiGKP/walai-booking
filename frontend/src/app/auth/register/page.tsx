"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Waves, Mail, Lock, Phone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import api from "@/lib/api";
import toast from "react-hot-toast";
import { ArrowLeft } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { ready } = useAuthGuard({ guestOnly: true });
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    line_id: "",
    facebook: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!ready) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("รหัสผ่านไม่ตรงกัน");
      return;
    }
    if (form.password.length < 8) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/auth/register", {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        line_id: form.line_id,
        facebook: form.facebook,
      });
      const { token } = res.data.data;
      await login(token);
      toast.success("สมัครสมาชิกสำเร็จ!");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "สมัครสมาชิกไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-[#F7F9FC] flex items-center justify-center items-start py-6 px-6 ">
      <div className="w-full max-w-6xl bg-white rounded-[32px] shadow-2xl overflow-hidden grid lg:grid-cols-2">
        {/* logo section */}
        <div className="relative order-1 lg:order-1 bg-[#EEF5EF] flex flex-col items-center p-12">
          <Link
            href="/"
            className="self-start flex items-center gap-2 mb-10 text-charcoal-600 hover:text-forest-800 font-medium transition-colors duration-200 group"
          >
            <ArrowLeft size={18} />
            <span>กลับหน้าหลัก</span>

            <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-bamboo-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-250 origin-left" />
          </Link>

          <img
            src="/images/kayak.gif"
            alt="Kayak"
            className="w-[420px] object-contain"
          />
          <h2 className="text-4xl font-bold text-[#354024] mt-8 text-center">
            Walai Booking
          </h2>
          <p className="text-center text-gray-600 mt-3 leading-7">
            ระบบจองห้องพัก
            <br />
            และเรือคายัคออนไลน์
          </p>
        </div>
        {/* // form section */}
        <div className="order-2 lg:order-2 bg-white px-12 py-6 flex flex-col justify-center">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900">Create Account</h1>

            <p className="text-gray-500 mt-2">สมัครสมาชิกกับวลัยรุกขเวช</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  ชื่อ
                </label>
                <input
                  type="text"
                  required
                  className="input-field"
                  placeholder="ชื่อ"
                  value={form.first_name}
                  onChange={(e) =>
                    setForm({ ...form, first_name: e.target.value })
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
                  placeholder="นามสกุล"
                  value={form.last_name}
                  onChange={(e) =>
                    setForm({ ...form, last_name: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  อีเมล
                </label>

                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="email"
                    required
                    className="input-field pl-11"
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={(e) =>
                      setForm({ ...form, email: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  เบอร์โทรศัพท์
                </label>

                <div className="relative">
                  <Phone
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="tel"
                    className="input-field pl-11"
                    placeholder="08X-XXX-XXXX"
                    value={form.phone}
                    onChange={(e) =>
                      setForm({ ...form, phone: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  LINE ID{" "}
                  <span className="text-gray-400 text-xs">(ไม่บังคับ)</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="เช่น walai123"
                  value={form.line_id}
                  onChange={(e) =>
                    setForm({ ...form, line_id: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Facebook{" "}
                  <span className="text-gray-400 text-xs">(ไม่บังคับ)</span>
                </label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="ลิงก์หรือชื่อบัญชี Facebook"
                  value={form.facebook}
                  onChange={(e) =>
                    setForm({ ...form, facebook: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="input-field pl-11 pr-11"
                    placeholder="อย่างน้อย 8 ตัวอักษร"
                    value={form.password}
                    onChange={(e) =>
                      setForm({ ...form, password: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  ยืนยันรหัสผ่าน
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    className="input-field pl-11 pr-11"
                    placeholder="ยืนยันรหัสผ่าน"
                    value={form.confirmPassword}
                    onChange={(e) =>
                      setForm({ ...form, confirmPassword: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#354024] text-white rounded-xl py-4 mt-2 hover:bg-[#445634] transition disabled:opacity-60"
            >
              {loading ? "กำลังสมัครสมาชิก..." : "สมัครสมาชิก"}
            </button>
          </form>
          <div className="relative flex items-center py-4">
            <div className="flex-grow border-t border-gray-300"></div>

            <span className="mx-4 text-sm text-gray-500">หรือ</span>

            <div className="flex-grow border-t border-gray-300"></div>
          </div>
          <button
            onClick={handleGoogleLogin}
            className="w-full border border-gray-300 rounded-xl py-3 flex justify-center items-center gap-2 hover:bg-gray-50 transition"
          >
            สมัครด้วย Google
          </button>
          <p className="text-center text-sm text-gray-500 mt-6">
            {" "}
            มีบัญชีแล้ว?
            <Link
              href="/auth/login"
              className="text-teal-600 font-semibold hover:text-teal-900 py-1 px-2 ml-1 transition-colors duration-200"
            >
              เข้าสู่ระบบ
            </Link>
          </p>
          {/* <p className="text-center text-sm text-gray-600 mt-6">
            มีบัญชีแล้ว?{" "}
            <Link
              href="/auth/login"
              className="text-teal-600 font-semibold hover:text-teal-700"
            >
              เข้าสู่ระบบ
            </Link>
          </p> */}
        </div>
      </div>
    </div>
  );
}
