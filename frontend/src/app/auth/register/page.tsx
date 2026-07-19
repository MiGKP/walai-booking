'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Waves, Mail, Lock, Phone } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const router = useRouter();
  const { login } = useAuth();
  const { ready } = useAuthGuard({ guestOnly: true });
  const [form, setForm] = useState({ first_name: '', last_name: '', email: '', password: '', confirmPassword: '', phone: '', line_id: '', facebook: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!ready) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const res = await api.post('/auth/register', {
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
      toast.success('สมัครสมาชิกสำเร็จ!');
      router.push('/dashboard');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'สมัครสมาชิกไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/google`;
  };

  return (
    <div className="min-h-screen pt-16 bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-100 mb-4">
              <Waves size={32} className="text-teal-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">สมัครสมาชิก</h1>
            <p className="text-gray-500 mt-1">สร้างบัญชีใหม่กับวาลัย</p>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 border-2 border-gray-200 rounded-xl hover:bg-gray-50 transition-all duration-200 mb-6 font-medium text-gray-700"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            สมัครด้วย Google
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
            <div className="relative flex justify-center text-sm"><span className="px-3 bg-white text-gray-500">หรือ</span></div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อ</label>
                <input type="text" required className="input-field" placeholder="ชื่อ"
                  value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">นามสกุล</label>
                <input type="text" required className="input-field" placeholder="นามสกุล"
                  value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">อีเมล</label>
              <div className="relative">
                <Mail size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" required className="input-field pl-11" placeholder="your@email.com"
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">เบอร์โทรศัพท์</label>
              <div className="relative">
                <Phone size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="tel" className="input-field pl-11" placeholder="08X-XXX-XXXX"
                  value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">LINE ID</label>
              <input type="text" className="input-field" placeholder="เช่น walai_user"
                value={form.line_id} onChange={(e) => setForm({ ...form, line_id: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Facebook</label>
              <input type="text" className="input-field" placeholder="ลิงก์หรือชื่อบัญชี Facebook"
                value={form.facebook} onChange={(e) => setForm({ ...form, facebook: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">รหัสผ่าน</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type={showPassword ? 'text' : 'password'} required className="input-field pl-11 pr-11"
                  placeholder="อย่างน้อย 8 ตัวอักษร" value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ยืนยันรหัสผ่าน</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type={showPassword ? 'text' : 'password'} required className="input-field pl-11"
                  placeholder="ยืนยันรหัสผ่าน" value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2 disabled:opacity-60 disabled:cursor-not-allowed">
              {loading ? 'กำลังสมัครสมาชิก...' : 'สมัครสมาชิก'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-600 mt-6">
            มีบัญชีแล้ว?{' '}
            <Link href="/auth/login" className="text-teal-600 font-semibold hover:text-teal-700">เข้าสู่ระบบ</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
