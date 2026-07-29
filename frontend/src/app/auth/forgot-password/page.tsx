'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Mail, Waves } from 'lucide-react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ guestOnly: true });
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!ready) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
      toast.success('หากอีเมลนี้มีอยู่ในระบบ เราได้ส่ง OTP สำหรับรีเซ็ตรหัสผ่านให้แล้ว');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'ไม่สามารถส่ง OTP ได้');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-16 bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-100 mb-4">
              <Waves size={32} className="text-teal-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">กู้รหัสผ่าน</h1>
            <p className="text-gray-500 mt-1">กรอกอีเมลเพื่อรับ OTP สำหรับตั้งรหัสผ่านใหม่</p>
          </div>

          {submitted ? (
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-5 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-teal-600 shadow-sm">
                <Mail size={22} />
              </div>
              <h2 className="text-lg font-bold text-gray-900">เช็กอีเมลของคุณ</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                หากอีเมล <span className="font-semibold text-gray-900">{email}</span> มีอยู่ในระบบ
                เราได้ส่ง OTP สำหรับตั้งรหัสผ่านใหม่ให้แล้ว
              </p>
              <button
                type="button"
                onClick={() => router.push(`/auth/reset-password?email=${encodeURIComponent(email)}`)}
                className="mt-4 btn-primary w-full"
              >
                ไปหน้ากรอก OTP
              </button>
              <button
                type="button"
                onClick={() => setSubmitted(false)}
                className="mt-4 text-sm font-semibold text-teal-600 hover:text-teal-700"
              >
                ส่งใหม่อีกครั้ง
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">อีเมล</label>
                <div className="relative">
                  <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    required
                    className="input-field pl-11"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed">
                {loading ? 'กำลังส่ง OTP...' : 'ส่ง OTP ไปยังอีเมล'}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-gray-600 mt-6">
            กลับไปที่{' '}
            <Link href="/auth/login" className="text-teal-600 font-semibold hover:text-teal-700">
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
