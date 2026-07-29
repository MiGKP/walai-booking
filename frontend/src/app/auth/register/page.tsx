'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  Lock,
  Mail,
  Phone,
  User,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

const RegisterScene3D = dynamic(
  () => import('@/components/auth/RegisterScene3D'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#d9ece7] text-stone-500">
        กำลังโหลด 3D Scene...
      </div>
    ),
  }
);

interface RegisterResponse {
  data: {
    token: string;
    user?: unknown;
  };
}

interface RegisterErrorResponse {
  message?: string;
}

const getRegisterErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError<RegisterErrorResponse>(error)) {
    return error.response?.data?.message || 'สมัครสมาชิกไม่สำเร็จ';
  }
  return 'สมัครสมาชิกไม่สำเร็จ';
};

export default function RegisterPage(): React.ReactElement | null {
  const router = useRouter();
  const { login } = useAuth();
  const { ready } = useAuthGuard({ guestOnly: true });

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    line_id: '',
    facebook: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!ready) return null;

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน');
      return;
    }

    if (form.password.length < 8) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร');
      return;
    }

    setLoading(true);

    try {
      const response = await api.post<RegisterResponse>('/auth/register', {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        password: form.password,
        phone: form.phone,
        line_id: form.line_id,
        facebook: form.facebook,
      });

      const { token } = response.data.data;
      await login(token);
      toast.success('สมัครสมาชิกสำเร็จ!');
      router.push('/dashboard');
    } catch (error: unknown) {
      toast.error(getRegisterErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = (): void => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  };

  return (
    // 🔒 ล็อกความสูงหน้าจอ 100vh + ปิด Scroll ถาวรทุกส่วน
    <div className="h-screen w-screen overflow-hidden bg-stone-100 p-3 sm:p-5 lg:p-6">
      <div className="mx-auto grid h-full w-full max-w-[1500px] overflow-hidden rounded-[28px] border border-stone-200 bg-cream-100 shadow-[0_28px_90px_rgba(18,60,48,0.14)] lg:grid-cols-[1.12fr_0.88fr] lg:rounded-[36px]">
        
        {/* Left Section: 3D Scene + Hero Overlay */}
        <section className="relative overflow-hidden bg-[#d9ece7]">
          <RegisterScene3D />

          <Link
            href="/"
            className="absolute left-5 top-5 z-20 inline-flex items-center gap-2 rounded-full border border-white/50 bg-cream-100/85 px-4 py-2 text-sm font-semibold text-forest-800 shadow-sm backdrop-blur-md transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-bamboo-400 sm:left-7 sm:top-7"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            กลับหน้าหลัก
          </Link>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-forest-900/80 via-forest-900/26 to-transparent px-6 pb-6 pt-20 text-cream-100 sm:px-9 sm:pb-8 lg:px-12 lg:pb-12 lg:pt-32">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-bamboo-200">
              <span className="h-px w-8 bg-bamboo-300" />
              Walai floating stay
            </div>
            <h1 className="max-w-xl text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
              เริ่มต้นการเดินทาง
              <br />
              กลางธรรมชาติ
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-cream-100/80 sm:text-base">
              สมัครสมาชิกเพื่อเริ่มต้นจองห้องพักและเรือคายัค
              สัมผัสประสบการณ์พักผ่อนสุดพิเศษที่วลัยรุกขเวช
            </p>
          </div>
        </section>

        {/* Right Section: Registration Form (ปิด Scroll 100%) */}
        <section className="flex items-center justify-center overflow-hidden px-6 py-6 sm:px-10 lg:px-12 lg:py-8">
          <div className="w-full max-w-[480px] animate-fade-in">
            <div className="mb-5">
              <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-lagoon-700">
                Create Account
              </p>
              <h2 className="text-2xl font-semibold text-charcoal sm:text-3xl lg:text-4xl">
                สมัครสมาชิก
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-stone-500">
                กรอกข้อมูลด้านล่างเพื่อสร้างบัญชีผู้ใช้ใหม่
              </p>
            </div>

            <form
              onSubmit={handleSubmit}
              className="space-y-3.5"
              aria-busy={loading}
            >
              {/* First Name & Last Name */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="first_name"
                    className="mb-1 block text-xs font-semibold text-charcoal"
                  >
                    ชื่อ <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User
                      size={16}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                    />
                    <input
                      id="first_name"
                      type="text"
                      required
                      className="input-field h-[42px] pl-10 text-sm"
                      placeholder="ชื่อ"
                      value={form.first_name}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          first_name: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="last_name"
                    className="mb-1 block text-xs font-semibold text-charcoal"
                  >
                    นามสกุล <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="last_name"
                    type="text"
                    required
                    className="input-field h-[42px] px-3.5 text-sm"
                    placeholder="นามสกุล"
                    value={form.last_name}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        last_name: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Email & Phone */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="reg-email"
                    className="mb-1 block text-xs font-semibold text-charcoal"
                  >
                    อีเมล <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Mail
                      size={16}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                    />
                    <input
                      id="reg-email"
                      type="email"
                      autoComplete="email"
                      required
                      className="input-field h-[42px] pl-10 text-sm"
                      placeholder="your@email.com"
                      value={form.email}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          email: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="mb-1 block text-xs font-semibold text-charcoal"
                  >
                    เบอร์โทรศัพท์
                  </label>
                  <div className="relative">
                    <Phone
                      size={16}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                    />
                    <input
                      id="phone"
                      type="tel"
                      className="input-field h-[42px] pl-10 text-sm"
                      placeholder="08X-XXX-XXXX"
                      value={form.phone}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          phone: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Line ID & Facebook */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="line_id"
                    className="mb-1 block text-xs font-semibold text-charcoal"
                  >
                    LINE ID{' '}
                    <span className="font-normal text-stone-400">
                      (ไม่บังคับ)
                    </span>
                  </label>
                  <input
                    id="line_id"
                    type="text"
                    className="input-field h-[42px] px-3.5 text-sm"
                    placeholder="เช่น walai123"
                    value={form.line_id}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, line_id: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <label
                    htmlFor="facebook"
                    className="mb-1 block text-xs font-semibold text-charcoal"
                  >
                    Facebook{' '}
                    <span className="font-normal text-stone-400">
                      (ไม่บังคับ)
                    </span>
                  </label>
                  <input
                    id="facebook"
                    type="text"
                    className="input-field h-[42px] px-3.5 text-sm"
                    placeholder="ลิงก์ หรือ ชื่อบัญชี"
                    value={form.facebook}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, facebook: e.target.value }))
                    }
                  />
                </div>
              </div>

              {/* Password & Confirm Password */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="reg-password"
                    className="mb-1 block text-xs font-semibold text-charcoal"
                  >
                    รหัสผ่าน <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                    />
                    <input
                      id="reg-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      className="input-field h-[42px] pl-10 pr-10 text-sm"
                      placeholder="8 ตัวอักษรขึ้นไป"
                      value={form.password}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-stone-400 transition hover:text-forest-800"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="mb-1 block text-xs font-semibold text-charcoal"
                  >
                    ยืนยันรหัสผ่าน <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Lock
                      size={16}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
                    />
                    <input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      className="input-field h-[42px] pl-10 pr-10 text-sm"
                      placeholder="ยืนยันรหัสผ่าน"
                      value={form.confirmPassword}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          confirmPassword: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="group mt-1 flex w-full items-center justify-center gap-2 rounded-xl bg-forest-800 px-6 py-3 font-semibold text-cream-100 transition duration-200 hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <LoaderCircle size={18} className="animate-spin" />
                    กำลังสมัครสมาชิก...
                  </>
                ) : (
                  <>
                    สมัครสมาชิก
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-4 flex items-center gap-4">
              <span className="h-px flex-1 bg-stone-200" />
              <span className="text-xs font-medium text-stone-400">หรือ</span>
              <span className="h-px flex-1 bg-stone-200" />
            </div>

            {/* Google Button */}
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="flex w-full items-center justify-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-2.5 font-semibold text-charcoal transition hover:border-stone-300 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-lagoon-400 focus:ring-offset-2 active:scale-[0.98]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              สมัครด้วย Google
            </button>

            {/* Link to Login */}
            <p className="mt-4 text-center text-xs sm:text-sm text-stone-500">
              มีบัญชีอยู่แล้ว?{' '}
              <Link
                href="/auth/login"
                className="font-semibold text-forest-800 transition-colors hover:text-lagoon-700 focus:outline-none focus:underline"
              >
                เข้าสู่ระบบ
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}