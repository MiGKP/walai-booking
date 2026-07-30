'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, Waves } from 'lucide-react';
import axios from 'axios';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import api, { getApiErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage(): React.ReactElement | null {
  const router = useRouter();
  const { ready } = useAuthGuard({ guestOnly: true });
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!ready) return null;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post(
        '/auth/forgot-password',
        { email: email.trim().toLowerCase() },
        { timeout: 25000 }
      );
      setSubmitted(true);
      toast.success('หากอีเมลนี้มีอยู่ในระบบ เราได้ส่ง OTP ให้แล้ว');
      router.push(`/auth/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.code === 'ECONNABORTED') {
        toast.error('การส่ง OTP ใช้เวลานานเกินไป กรุณาลองใหม่');
      } else {
        toast.error(getApiErrorMessage(err, 'ไม่สามารถส่ง OTP ได้'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-200 px-4 pb-16 pt-28">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-forest-800 text-cream-100 shadow-sm">
            <Waves size={28} />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lagoon-600">Walai Booking</p>
          <h1 className="mt-2 font-display text-3xl text-forest-900">กู้รหัสผ่าน</h1>
          <p className="mt-2 text-sm text-charcoal-500">รับ OTP ทางอีเมลเพื่อตั้งรหัสผ่านใหม่</p>
        </div>

        <div className="card p-6 sm:p-8">
          {submitted ? (
            <div className="rounded-2xl border border-lagoon-200 bg-lagoon-50 p-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cream-100 text-lagoon-600 shadow-sm">
                <Mail size={22} />
              </div>
              <h2 className="font-display text-xl text-forest-900">เช็กอีเมลของคุณ</h2>
              <p className="mt-2 text-sm leading-6 text-charcoal-500">
                หากอีเมล <span className="font-semibold text-forest-900">{email}</span> มีอยู่ในระบบ
                เราได้ส่ง OTP สำหรับตั้งรหัสผ่านใหม่ให้แล้ว
              </p>
              <button
                type="button"
                onClick={() => router.push(`/auth/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`)}
                className="btn-primary mt-5 w-full"
              >
                ไปหน้ากรอก OTP
              </button>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-4 text-sm font-semibold text-forest-700 hover:text-forest-900"
              >
                ส่งใหม่อีกครั้ง
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className="mb-1.5 block text-sm font-medium text-charcoal-700">อีเมล</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400" />
                  <input
                    id="forgot-email"
                    type="email"
                    required
                    className="input-field pl-11"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? 'กำลังส่ง OTP...' : 'ส่ง OTP ไปยังอีเมล'}
              </button>
            </form>
          )}

          <Link href="/auth/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm font-semibold text-forest-700 hover:text-forest-900">
            <ArrowLeft size={14} />
            กลับไปเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}
