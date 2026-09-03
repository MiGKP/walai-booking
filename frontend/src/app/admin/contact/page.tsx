'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Phone, Mail, MessageCircle, MapPin, Clock } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { pickResortInfo } from '@/lib/resort-info';

export default function ContactInfoPage() {
  const { ready, user } = useAuthGuard({ allowedRoles: ['admin', 'room_staff', 'boat_staff'] });
  const [form, setForm] = useState({
    phone: '', email: '', line_id: '', facebook: '',
    address: '', operating_days: '', operating_hours: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const backPath = user?.role === 'admin' ? '/admin' : user?.role === 'room_staff' ? '/staff/rooms/dashboard' : '/staff/boats/dashboard';

  useEffect(() => {
    if (!ready) return;
    api.get('/settings/resort').then(res => {
      if (res.data?.data) {
        const d = pickResortInfo(res.data.data, 'main');
        setForm({
          phone: d.phone || '', email: d.email || '',
          line_id: d.line_id || '', facebook: d.facebook || '',
          address: d.address || '', operating_days: d.operating_days || '',
          operating_hours: d.operating_hours || '',
        });
      }
    }).catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ')).finally(() => setLoading(false));
  }, [ready]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings/resort', { id: 3, ...form });
      toast.success('บันทึกข้อมูลติดต่อสำเร็จ');
    } catch (err: unknown) {
      toast.error(
        err && typeof err === 'object' && 'response' in err
          ? String((err as { response?: { data?: { message?: string } } }).response?.data?.message || 'บันทึกไม่สำเร็จ')
          : 'บันทึกไม่สำเร็จ'
      );
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href={backPath} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ข้อมูลติดต่อ</h1>
            <p className="text-gray-500 mt-0.5">แก้ไขช่องทางติดต่อที่แสดงในเว็บไซต์</p>
          </div>
        </div>

        {loading ? <div className="card h-64 animate-pulse bg-gray-100" /> : (
          <form onSubmit={handleSave} className="card p-6 space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Phone size={13} /> เบอร์โทรศัพท์</label>
                <input className="input-field" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="08x-xxx-xxxx" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Mail size={13} /> อีเมล</label>
                <input type="email" className="input-field" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="contact@walai.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><MessageCircle size={13} /> Line ID</label>
                <input className="input-field" value={form.line_id} onChange={e => setForm(f => ({ ...f, line_id: e.target.value }))} placeholder="@walai" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><MessageCircle size={13} /> Facebook</label>
                <input className="input-field" value={form.facebook} onChange={e => setForm(f => ({ ...f, facebook: e.target.value }))} placeholder="facebook.com/walai" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><MapPin size={13} /> ที่อยู่</label>
              <textarea className="input-field resize-none" rows={2} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="ที่อยู่สถานที่..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Clock size={13} /> วันเปิดทำการ</label>
              <input className="input-field" value={form.operating_days} onChange={e => setForm(f => ({ ...f, operating_days: e.target.value }))} placeholder="เช่น เปิดทุกวัน / จันทร์-ศุกร์" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Clock size={13} /> เวลาทำการ</label>
              <input className="input-field" value={form.operating_hours} onChange={e => setForm(f => ({ ...f, operating_hours: e.target.value }))} placeholder="เช่น 08:00 – 20:00 น." />
            </div>
            <button type="submit" disabled={saving} className="btn-primary w-full flex items-center justify-center gap-2">
              <Save size={16} /> {saving ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
