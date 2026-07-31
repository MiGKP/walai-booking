"use client";

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  LoaderCircle,
  Mail,
  Waves,
} from 'lucide-react';
import axios from 'axios';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import api, { getApiErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage(): React.ReactElement | null {
  const router = useRouter();
  const { ready } = useAuthGuard({ guestOnly: true });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!ready) return null;

  const normalizedEmail = email.trim().toLowerCase();

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ): Promise<void> => {
    event.preventDefault();
    setLoading(true);
    try {
      await api.post(
        '/auth/forgot-password',
        { email: normalizedEmail },
        { timeout: 25000 }
      );
      setSubmitted(true);
      toast.success('หากอีเมลนี้มีอยู่ในระบบ เราได้ส่ง OTP ให้แล้ว');
      router.push(
        `/auth/reset-password?email=${encodeURIComponent(normalizedEmail)}`
      );
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        toast.error('การส่ง OTP ใช้เวลานานเกินไป กรุณาลองใหม่');
      } else {
        toast.error(getApiErrorMessage(error, 'ไม่สามารถส่ง OTP ได้'));
      }
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
              กู้รหัสผ่าน
            </h1>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              รับ OTP ทางอีเมลเพื่อตั้งรหัสผ่านใหม่
            </p>
          </div>

          {submitted ? (
            <div className="animate-fade-in rounded-2xl border border-lagoon-200 bg-lagoon-50 p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cream-100 text-lagoon-700 shadow-sm">
                <Mail size={22} aria-hidden="true" />
              </div>
              <h2 className="text-xl font-semibold text-charcoal">
                เช็กอีเมลของคุณ
              </h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                หากอีเมล{' '}
                <span className="font-semibold text-forest-800">{email}</span>{' '}
                มีอยู่ในระบบ เราได้ส่ง OTP สำหรับตั้งรหัสผ่านใหม่ให้แล้ว
              </p>
              <button
                type="button"
                onClick={() =>
                  router.push(
                    `/auth/reset-password?email=${encodeURIComponent(normalizedEmail)}`
                  )
                }
                className="group mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-forest-800 px-6 py-3.5 font-semibold text-cream-100 transition duration-200 hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2 active:scale-[0.98]"
              >
                ไปหน้ากรอก OTP
                <ArrowRight
                  size={18}
                  className="transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-4 text-sm font-semibold text-forest-800 transition-colors hover:text-lagoon-700 focus:outline-none focus:underline"
              >
                ส่งใหม่อีกครั้ง
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="animate-fade-in space-y-5"
              aria-busy={loading}
            >
              <div>
                <label
                  htmlFor="forgot-email"
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
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    required
                    className="input-field h-[52px] pl-12"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={loading}
                  />
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
                    กำลังส่ง OTP...
                  </>
                ) : (
                  <>
                    ส่ง OTP ไปยังอีเมล
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </>
                )}
              </button>
            </form>
          )}

          <p className="mt-7 text-center text-sm text-stone-500">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1.5 font-semibold text-forest-800 transition-colors hover:text-lagoon-700 focus:outline-none focus:underline"
            >
              <ArrowLeft size={14} aria-hidden="true" />
              กลับไปเข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
