'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Facebook,
  LoaderCircle,
  Lock,
  Mail,
  MessageCircle,
  Phone,
  User,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import api, { getApiErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

interface RegisterResponse {
  data: {
    token: string;
  };
}

const RegisterScene3D = dynamic(() => import('@/components/auth/Scene3D'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#d9ece7] text-sm text-forest-800/70">
      กำลังเตรียมบรรยากาศ...
    </div>
  ),
});

const MIN_PASSWORD_LENGTH = 8;

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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!ready) return null;

  const updateField = (field: keyof typeof form, value: string): void => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();

    if (form.password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`);
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('รหัสผ่านไม่ตรงกัน');
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
      await login(response.data.data.token);
      toast.success('สมัครสมาชิกสำเร็จ!');
      router.push('/dashboard');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'สมัครสมาชิกไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = (): void => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen bg-stone-100 p-3 sm:p-5 lg:p-6">
      {/*
        บนจอ lg ตรึงความสูงกริดไว้เท่าหน้าจอ แล้วให้เฉพาะคอลัมน์ฟอร์มเลื่อนเอง
        ฉาก 3D จึงอยู่นิ่งเต็มพาเนลแม้ฟอร์มสมัครจะยาวกว่าหน้าจอ
      */}
      <div className="mx-auto grid min-h-[calc(100vh-1.5rem)] w-full max-w-[1500px] overflow-hidden rounded-[28px] border border-stone-200 bg-cream-100 shadow-[0_28px_90px_rgba(18,60,48,0.14)] sm:min-h-[calc(100vh-2.5rem)] lg:h-[calc(100vh-3rem)] lg:min-h-0 lg:grid-cols-[1.12fr_0.88fr] lg:rounded-[36px]">
        <section className="relative min-h-[250px] overflow-hidden bg-[#d9ece7] sm:min-h-[300px] lg:min-h-0">
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
              เริ่มต้นทริปแรก
              <br />
              ริมสายน้ำ
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-cream-100/80 sm:text-base">
              สมัครสมาชิกเพื่อจองที่พักลอยน้ำและเรือคายัค
              พร้อมติดตามสถานะการจองได้ทุกที่
            </p>
          </div>
        </section>

        <section className="lg:overflow-y-auto">
          <div className="flex min-h-full items-center justify-center px-6 py-10 sm:px-10 lg:px-14 lg:py-12">
            <div className="w-full max-w-[480px] animate-fade-in">
            <div className="mb-8">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-lagoon-700">
                Create account
              </p>
                <h2 className="text-3xl font-semibold text-charcoal sm:text-4xl">
                  สมัครสมาชิก
                </h2>
                <p className="mt-2 text-sm leading-6 text-stone-500">
                  กรอกข้อมูลเพื่อเริ่มจองกับวลัยรุกขเวช
                </p>
              </div>

              <form
                onSubmit={handleSubmit}
                className="space-y-5"
                aria-busy={loading}
              >
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="register-first-name"
                      className="mb-2 block text-sm font-semibold text-charcoal"
                    >
                      ชื่อ
                    </label>
                    <div className="relative">
                      <User
                        size={18}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                        aria-hidden="true"
                      />
                      <input
                        id="register-first-name"
                        type="text"
                        autoComplete="given-name"
                        required
                        className="input-field h-[52px] pl-12"
                        placeholder="ชื่อ"
                        value={form.first_name}
                        onChange={(event) =>
                          updateField('first_name', event.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="register-last-name"
                      className="mb-2 block text-sm font-semibold text-charcoal"
                    >
                      นามสกุล
                    </label>
                    <div className="relative">
                      <User
                        size={18}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                        aria-hidden="true"
                      />
                      <input
                        id="register-last-name"
                        type="text"
                        autoComplete="family-name"
                        required
                        className="input-field h-[52px] pl-12"
                        placeholder="นามสกุล"
                        value={form.last_name}
                        onChange={(event) =>
                          updateField('last_name', event.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="register-email"
                    className="mb-2 block text-sm font-semibold text-charcoal"
                  >
                    อีเมล
                  </label>
                  <div className="relative">
                    <Mail
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                      aria-hidden="true"
                    />
                    <input
                      id="register-email"
                      type="email"
                      autoComplete="email"
                      required
                      className="input-field h-[52px] pl-12"
                      placeholder="your@email.com"
                      value={form.email}
                      onChange={(event) =>
                        updateField('email', event.target.value)
                      }
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="register-phone"
                    className="mb-2 block text-sm font-semibold text-charcoal"
                  >
                    เบอร์โทรศัพท์
                  </label>
                  <div className="relative">
                    <Phone
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                      aria-hidden="true"
                    />
                    <input
                      id="register-phone"
                      type="tel"
                      autoComplete="tel"
                      inputMode="tel"
                      className="input-field h-[52px] pl-12"
                      placeholder="08X-XXX-XXXX"
                      value={form.phone}
                      onChange={(event) =>
                        updateField('phone', event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="register-line"
                      className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-charcoal"
                    >
                      LINE ID
                      <span className="text-xs font-medium text-stone-400">
                        (ไม่บังคับ)
                      </span>
                    </label>
                    <div className="relative">
                      <MessageCircle
                        size={18}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                        aria-hidden="true"
                      />
                      <input
                        id="register-line"
                        type="text"
                        className="input-field h-[52px] pl-12"
                        placeholder="เช่น walai123"
                        value={form.line_id}
                        onChange={(event) =>
                          updateField('line_id', event.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="register-facebook"
                      className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-charcoal"
                    >
                      Facebook
                      <span className="text-xs font-medium text-stone-400">
                        (ไม่บังคับ)
                      </span>
                    </label>
                    <div className="relative">
                      <Facebook
                        size={18}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                        aria-hidden="true"
                      />
                      <input
                        id="register-facebook"
                        type="text"
                        className="input-field h-[52px] pl-12"
                        placeholder="ลิงก์หรือชื่อบัญชี"
                        value={form.facebook}
                        onChange={(event) =>
                          updateField('facebook', event.target.value)
                        }
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="register-password"
                    className="mb-2 block text-sm font-semibold text-charcoal"
                  >
                    รหัสผ่าน
                  </label>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                      aria-hidden="true"
                    />
                    <input
                      id="register-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                      aria-describedby="register-password-hint"
                      className="input-field h-[52px] pl-12 pr-12"
                      placeholder={`อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`}
                      value={form.password}
                      onChange={(event) =>
                        updateField('password', event.target.value)
                      }
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 transition-colors hover:text-forest-800 focus:outline-none focus:ring-2 focus:ring-lagoon-400"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p
                    id="register-password-hint"
                    className="mt-2 text-xs text-stone-400"
                  >
                    ใช้ตัวอักษรและตัวเลขผสมกันเพื่อความปลอดภัย
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="register-confirm-password"
                    className="mb-2 block text-sm font-semibold text-charcoal"
                  >
                    ยืนยันรหัสผ่าน
                  </label>
                  <div className="relative">
                    <Lock
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                      aria-hidden="true"
                    />
                    <input
                      id="register-confirm-password"
                      type={showConfirmPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      className="input-field h-[52px] pl-12 pr-12"
                      placeholder="กรอกรหัสผ่านอีกครั้ง"
                      value={form.confirmPassword}
                      onChange={(event) =>
                        updateField('confirmPassword', event.target.value)
                      }
                    />
                    <button
                      type="button"
                      aria-label={
                        showConfirmPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'
                      }
                      onClick={() =>
                        setShowConfirmPassword((visible) => !visible)
                      }
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 transition-colors hover:text-forest-800 focus:outline-none focus:ring-2 focus:ring-lagoon-400"
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl bg-forest-800 px-6 py-3.5 font-semibold text-cream-100 transition duration-200 hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <LoaderCircle
                        size={18}
                        className="animate-spin"
                        aria-hidden="true"
                      />
                      กำลังสมัครสมาชิก...
                    </>
                  ) : (
                    <>
                      สมัครสมาชิก
                      <ArrowRight
                        size={18}
                        className="transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </>
                  )}
                </button>
              </form>

              <div className="my-6 flex items-center gap-4">
                <span className="h-px flex-1 bg-stone-200" />
                <span className="text-xs font-medium text-stone-400">หรือ</span>
                <span className="h-px flex-1 bg-stone-200" />
              </div>

              <button
                type="button"
                onClick={handleGoogleRegister}
                className="flex w-full items-center justify-center gap-3 rounded-xl border border-stone-200 bg-white px-4 py-3 font-semibold text-charcoal transition hover:border-stone-300 hover:bg-stone-100 focus:outline-none focus:ring-2 focus:ring-lagoon-400 focus:ring-offset-2 active:scale-[0.98]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
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

              <p className="mt-7 text-center text-sm text-stone-500">
                มีบัญชีแล้ว?{' '}
                <Link
                  href="/auth/login"
                  className="font-semibold text-forest-800 transition-colors hover:text-lagoon-700 focus:outline-none focus:underline"
                >
                  เข้าสู่ระบบ
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
