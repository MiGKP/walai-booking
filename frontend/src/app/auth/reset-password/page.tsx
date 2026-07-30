'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff, Lock, Mail, Waves } from 'lucide-react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import api, { getApiErrorMessage } from '@/lib/api';
import toast from 'react-hot-toast';

function ResetPasswordContent(): React.ReactElement | null {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready } = useAuthGuard({ guestOnly: true });
  const initialEmail = useMemo(() => searchParams.get('email') || '', [searchParams]);
  const [form, setForm] = useState({ email: initialEmail, otp: '', new_password: '', confirm_password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!ready) return null;

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!form.email || !form.otp) {
      toast.error('กรุณากรอกอีเมลและ OTP');
      return;
    }
    if (form.new_password !== form.confirm_password) {
      toast.error('รหัสผ่านไม่ตรงกัน');
      return;
    }
    if (form.new_password.length < 6) {
      toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email: form.email, otp: form.otp, new_password: form.new_password });
      toast.success('ตั้งรหัสผ่านใหม่สำเร็จ');
      router.push('/auth/login');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'รีเซ็ตรหัสผ่านไม่สำเร็จ'));
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
          <h1 className="mt-2 font-display text-3xl text-forest-900">ตั้งรหัสผ่านใหม่</h1>
          <p className="mt-2 text-sm text-charcoal-500">กรอกอีเมล OTP และรหัสผ่านใหม่</p>
        </div>

        <div className="card p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium text-charcoal-700">อีเมล</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400" />
                <input
                  id="reset-email"
                  type="email"
                  required
                  className="input-field pl-11"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>
            <div>
              <label htmlFor="reset-otp" className="mb-1.5 block text-sm font-medium text-charcoal-700">OTP</label>
              <input
                id="reset-otp"
                type="text"
                required
                inputMode="numeric"
                maxLength={6}
                className="input-field"
                placeholder="กรอกรหัส OTP 6 หลัก"
                value={form.otp}
                onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-charcoal-700">รหัสผ่านใหม่</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400" />
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-field pl-11 pr-11"
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  value={form.new_password}
                  onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                  disabled={loading}
                />
                <button type="button" aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'} onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-forest-800" disabled={loading}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-charcoal-700">ยืนยันรหัสผ่านใหม่</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400" />
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-field pl-11"
                  placeholder="ยืนยันรหัสผ่านใหม่"
                  value={form.confirm_password}
                  onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                  disabled={loading}
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
            </button>
          </form>

          <Link href="/auth/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm font-semibold text-forest-700 hover:text-forest-900">
            <ArrowLeft size={14} />
            กลับไปเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage(): React.ReactElement {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center bg-cream-200"><div className="h-10 w-10 animate-spin rounded-full border-2 border-forest-800 border-t-transparent" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
