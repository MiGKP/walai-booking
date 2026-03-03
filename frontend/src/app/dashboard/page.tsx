'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { User, Mail, Phone, Save, Lock } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, updateUser } = useAuthStore();
  const [profile, setProfile] = useState({ name: '', phone: '' });
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user) setProfile({ name: user.name, phone: user.phone || '' });
  }, [isAuthenticated, user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await api.put('/auth/profile', profile);
      updateUser(res.data.data);
      toast.success('บันทึกโปรไฟล์สำเร็จ');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm) { toast.error('รหัสผ่านใหม่ไม่ตรงกัน'); return; }
    if (passwords.new_password.length < 6) { toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    setChangingPw(true);
    try {
      await api.put('/auth/change-password', { current_password: passwords.current_password, new_password: passwords.new_password });
      toast.success('เปลี่ยนรหัสผ่านสำเร็จ');
      setPasswords({ current_password: '', new_password: '', confirm: '' });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
    } finally {
      setChangingPw(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new_password !== passwords.confirm) { toast.error('รหัสผ่านไม่ตรงกัน'); return; }
    if (passwords.new_password.length < 6) { toast.error('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'); return; }
    setChangingPw(true);
    try {
      await api.put('/auth/set-password', { new_password: passwords.new_password });
      toast.success('ตั้งรหัสผ่านสำเร็จ');
      setPasswords({ current_password: '', new_password: '', confirm: '' });
      // Update local user state to reflect they now have a password
      updateUser({ has_password: true });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'ตั้งรหัสผ่านไม่สำเร็จ');
    } finally {
      setChangingPw(false);
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">โปรไฟล์ของฉัน</h1>
          <p className="text-gray-500 mt-1">จัดการข้อมูลส่วนตัวของคุณ</p>
        </div>

        {/* Nav Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
          <Link href="/dashboard" className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-gray-900 shadow-sm">โปรไฟล์</Link>
          <Link href="/dashboard/bookings" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:text-gray-900">การจองของฉัน</Link>
        </div>

        {/* Avatar + Info */}
        <div className="card p-6 mb-5">
          <div className="flex items-center gap-5 mb-6">
            <div className="w-20 h-20 rounded-2xl bg-teal-100 flex items-center justify-center overflow-hidden">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                <User size={36} className="text-teal-600" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
              <p className="text-gray-500 text-sm">{user.email}</p>
              <span className={`inline-block mt-1 text-xs font-medium px-2.5 py-1 rounded-full ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'}`}>
                {user.role === 'admin' ? 'ผู้ดูแลระบบ' : 'ลูกค้า'}
              </span>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ชื่อ-นามสกุล</label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" required className="input-field pl-10" value={profile.name || ''}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">อีเมล</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" disabled className="input-field pl-10 bg-gray-50 text-gray-500 cursor-not-allowed" value={user.email} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">เบอร์โทรศัพท์</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="tel" className="input-field pl-10" placeholder="08X-XXX-XXXX" value={profile.phone}
                  onChange={(e) => setProfile({ ...profile, phone: e.target.value })} />
              </div>
            </div>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2 disabled:opacity-60">
              <Save size={16} /> {saving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
            </button>
          </form>
        </div>

        {/* Change or Set Password */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-5 flex items-center gap-2">
            <Lock size={20} className="text-teal-600" /> {user.has_password ? 'เปลี่ยนรหัสผ่าน' : 'ตั้งรหัสผ่านใหม่ (สำหรับล็อกอินครั้งหน้า)'}
          </h2>
          
          {!user.has_password && (
            <div className="mb-4 p-3 bg-blue-50 text-blue-800 rounded-lg text-sm">
              คุณล็อกอินด้วย Google อยู่ คุณสามารถตั้งรหัสผ่านเพื่อใช้ล็อกอินด้วยอีเมลในครั้งต่อไปได้
            </div>
          )}

          <form onSubmit={user.has_password ? handleChangePassword : handleSetPassword} className="space-y-4">
            {user.has_password && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">รหัสผ่านปัจจุบัน</label>
                <input type="password" required className="input-field" value={passwords.current_password}
                  onChange={(e) => setPasswords({ ...passwords, current_password: e.target.value })} />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">รหัสผ่านใหม่</label>
              <input type="password" required className="input-field" value={passwords.new_password}
                onChange={(e) => setPasswords({ ...passwords, new_password: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">ยืนยันรหัสผ่านใหม่</label>
              <input type="password" required className="input-field" value={passwords.confirm}
                onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })} />
            </div>
            <button type="submit" disabled={changingPw} className="btn-outline flex items-center gap-2 disabled:opacity-60">
              <Lock size={16} /> {changingPw ? 'กำลังบันทึก...' : (user.has_password ? 'เปลี่ยนรหัสผ่าน' : 'ตั้งรหัสผ่าน')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
