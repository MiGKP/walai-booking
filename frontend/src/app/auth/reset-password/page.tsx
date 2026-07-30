'use client';

import { Suspense, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Lock,
  Mail,
  Waves,
} from 'lucide-react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import api, { getApiErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

const MIN_PASSWORD_LENGTH = 8;

function ResetPasswordContent(): React.ReactElement | null {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready } = useAuthGuard({ guestOnly: true });
  const initialEmail = useMemo(
    () => searchParams.get('email') || '',
    [searchParams]
  );
  const [form, setForm] = useState({
    email: initialEmail,
    otp: '',
    new_password: '',
    confirm_password: '',
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

    if (!form.email.trim() || !form.otp) {
      toast.error('กรุณากรอกอีเมลและ OTP');
      return;
    }
    if (form.new_password.length < MIN_PASSWORD_LENGTH) {
      toast.error(
        `รหัสผ่านต้องมีอย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`
      );
      return;
    }
    if (form.new_password !== form.confirm_password) {
      toast.error('รหัสผ่านไม่ตรงกัน');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        email: form.email.trim().toLowerCase(),
        otp: form.otp,
        new_password: form.new_password,
      });
      toast.success('ตั้งรหัสผ่านใหม่สำเร็จ');
      router.push('/auth/login');
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'รีเซ็ตรหัสผ่านไม่สำเร็จ'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 p-3 sm:p-5 lg:p-6">
      <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] w-full max-w-[560px] items-center justify-center sm:min-h-[calc(100vh-2.5rem)] lg:min-h-[calc(100vh-3rem)]">
        <div className="w-full overflow-hidden rounded-[28px] border border-stone-200 bg-cream-100 px-6 py-10 shadow-[0_28px_90px_rgba(18,60,48,0.14)] sm:px-10 sm:py-12 lg:rounded-[36px] lg:px-12">
          <div className="mb-8 animate-fade-in">
            <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-full bg-forest-800 text-cream-100">
              <Waves size={21} aria-hidden="true" />
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-lagoon-700">
              Account recovery
            </p>
            <h1 className="text-3xl font-semibold text-charcoal sm:text-4xl">
              ตั้งรหัสผ่านใหม่
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              กรอก OTP จากอีเมลแล้วตั้งรหัสผ่านใหม่
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="animate-fade-in space-y-5"
            aria-busy={loading}
          >
            <div>
              <label
                htmlFor="reset-email"
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
                  id="reset-email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input-field h-[52px] pl-12"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={(event) =>
                    updateField('email', event.target.value)
                  }
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="reset-otp"
                className="mb-2 block text-sm font-semibold text-charcoal"
              >
                OTP
              </label>
              <div className="relative">
                <KeyRound
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                  aria-hidden="true"
                />
                <input
                  id="reset-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  required
                  maxLength={6}
                  className="input-field h-[52px] pl-12 tracking-[0.35em]"
                  placeholder="000000"
                  value={form.otp}
                  onChange={(event) =>
                    updateField(
                      'otp',
                      event.target.value.replace(/\D/g, '').slice(0, 6)
                    )
                  }
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="new-password"
                className="mb-2 block text-sm font-semibold text-charcoal"
              >
                รหัสผ่านใหม่
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                  aria-hidden="true"
                />
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  className="input-field h-[52px] pl-12 pr-12"
                  placeholder={`อย่างน้อย ${MIN_PASSWORD_LENGTH} ตัวอักษร`}
                  value={form.new_password}
                  onChange={(event) =>
                    updateField('new_password', event.target.value)
                  }
                  disabled={loading}
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-1 text-stone-400 transition-colors hover:text-forest-800 focus:outline-none focus:ring-2 focus:ring-lagoon-400"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="mb-2 block text-sm font-semibold text-charcoal"
              >
                ยืนยันรหัสผ่านใหม่
              </label>
              <div className="relative">
                <Lock
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400"
                  aria-hidden="true"
                />
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  minLength={MIN_PASSWORD_LENGTH}
                  className="input-field h-[52px] pl-12 pr-12"
                  placeholder="กรอกรหัสผ่านอีกครั้ง"
                  value={form.confirm_password}
                  onChange={(event) =>
                    updateField('confirm_password', event.target.value)
                  }
                  disabled={loading}
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
                  disabled={loading}
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
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  บันทึกรหัสผ่านใหม่
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </>
              )}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-stone-500">
            <Link
              href="/auth/forgot-password"
              className="font-semibold text-forest-800 transition-colors hover:text-lagoon-700 focus:outline-none focus:underline"
            >
              ส่ง OTP ใหม่
            </Link>
            <span className="mx-2 text-stone-300">·</span>
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 font-semibold text-forest-800 transition-colors hover:text-lagoon-700 focus:outline-none focus:underline"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-stone-100">
          <LoaderCircle
            size={28}
            className="animate-spin text-forest-800"
            aria-hidden="true"
          />
          <span className="sr-only">กำลังโหลด...</span>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
