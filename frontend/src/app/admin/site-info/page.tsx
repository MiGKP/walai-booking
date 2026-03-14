'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Save, MapPin } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function SiteInfoPage() {
  const { ready } = useAuthGuard({ allowedRoles: ['admin'] });
  const [form, setForm] = useState({
    name: '',
    address: '',
    coordinates: '',
    additional_terms: '',
    promptpay_id: '',
    bank_account_no: '',
    bank_account_name: '',
    payment_due_days: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ready) return;
    api.get('/settings/resort').then(res => {
      if (res.data?.data) {
        const d = res.data.data;
        setForm({
          name: d.name || '',
          address: d.address || '',
          coordinates: d.coordinates || '',
          additional_terms: d.additional_terms || '',
          promptpay_id: d.promptpay_id || '',
          bank_account_no: d.bank_account_no || '',
          bank_account_name: d.bank_account_name || '',
          payment_due_days: d.payment_due_days ? String(d.payment_due_days) : '',
        });
      }
    }).catch(() => toast.error('โหลดข้อมูลไม่สำเร็จ')).finally(() => setLoading(false));
  }, [ready]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings/resort', {
        ...form,
        payment_due_days: form.payment_due_days ? Number(form.payment_due_days) : null,
      });
      toast.success('บันทึกข้อมูลสวนสำเร็จ');
    } catch {
      toast.error('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/admin" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ข้อมูลสวนวลัยรุกขเวช</h1>
            <p className="text-gray-500 mt-0.5">แก้ไขข้อมูลแนะนำสวนที่แสดงในเว็บไซต์</p>
          </div>
        </div>

        {loading ? (
          <div className="card p-8 animate-pulse bg-gray-100 h-64" />
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="card p-6 space-y-5">
              <h2 className="font-semibold text-gray-900">ข้อมูลสวน</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อสถานที่</label>
                <input
                  className="input-field"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="สวนวลัยรุกขเวช"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><MapPin size={13} /> ที่อยู่</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="ที่อยู่สถานที่..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">พิกัด (Google Maps Coordinates)</label>
                <input
                  className="input-field font-mono text-sm"
                  value={form.coordinates}
                  onChange={e => setForm(f => ({ ...f, coordinates: e.target.value }))}
                  placeholder="16.4419, 102.8360"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เงื่อนไขเพิ่มเติม</label>
                <textarea
                  className="input-field resize-none"
                  rows={3}
                  value={form.additional_terms}
                  onChange={e => setForm(f => ({ ...f, additional_terms: e.target.value }))}
                  placeholder="เงื่อนไขและข้อกำหนดในการจอง..."
                />
              </div>
            </div>

            <div className="card p-6 space-y-5">
              <h2 className="font-semibold text-gray-900">การชำระเงิน</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เบอร์พร้อมเพย์ (PromptPay ID)</label>
                <input
                  className="input-field font-mono"
                  value={form.promptpay_id}
                  onChange={e => setForm(f => ({ ...f, promptpay_id: e.target.value }))}
                  placeholder="เช่น 0812345678 หรือ 1234567890123"
                />
                <p className="text-xs text-gray-400 mt-1">ใช้สร้าง QR Code PromptPay ในหน้าชำระเงิน</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อบัญชี</label>
                <input
                  className="input-field"
                  value={form.bank_account_name}
                  onChange={e => setForm(f => ({ ...f, bank_account_name: e.target.value }))}
                  placeholder="ชื่อเจ้าของบัญชี"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เลขบัญชี</label>
                <input
                  className="input-field font-mono"
                  value={form.bank_account_no}
                  onChange={e => setForm(f => ({ ...f, bank_account_no: e.target.value }))}
                  placeholder="000-0-00000-0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ระยะเวลาชำระเงิน (วัน)</label>
                <input
                  type="number"
                  min={0}
                  className="input-field"
                  value={form.payment_due_days}
                  onChange={e => setForm(f => ({ ...f, payment_due_days: e.target.value }))}
                  placeholder="เช่น 1 หรือ 3"
                />
              </div>
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
