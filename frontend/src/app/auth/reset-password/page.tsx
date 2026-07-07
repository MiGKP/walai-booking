'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock, Mail, Waves } from 'lucide-react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import api from '@/lib/api';
import toast from 'react-hot-toast';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready } = useAuthGuard({ guestOnly: true });
  const initialEmail = useMemo(() => searchParams.get('email') || '', [searchParams]);
  const [form, setForm] = useState({ email: initialEmail, otp: '', new_password: '', confirm_password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!ready) return null;

  const handleSubmit = async (e: React.FormEvent) => {
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
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'รีเซ็ตรหัสผ่านไม่สำเร็จ');
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
            <h1 className="text-2xl font-bold text-gray-900">ตั้งรหัสผ่านใหม่</h1>
            <p className="text-gray-500 mt-1">กรอกอีเมล, OTP และรหัสผ่านใหม่ของคุณ</p>
          </div>

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
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">OTP</label>
              <input
                type="text"
                required
                inputMode="numeric"
                maxLength={6}
                className="input-field"
                placeholder="กรอกรหัส OTP 6 หลัก"
                value={form.otp}
                onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, '').slice(0, 6) })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">รหัสผ่านใหม่</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-field pl-11 pr-11"
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  value={form.new_password}
                  onChange={(e) => setForm({ ...form, new_password: e.target.value })}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ยืนยันรหัสผ่านใหม่</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="input-field pl-11"
                  placeholder="ยืนยันรหัสผ่านใหม่"
                  value={form.confirm_password}
                  onChange={(e) => setForm({ ...form, confirm_password: e.target.value })}
                />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? 'กำลังบันทึก...' : 'บันทึกรหัสผ่านใหม่'}
            </button>
          </form>

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

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen pt-16 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-4 border-teal-600 border-t-transparent" /></div>}>
      <ResetPasswordContent />
    </Suspense>
  );
}
