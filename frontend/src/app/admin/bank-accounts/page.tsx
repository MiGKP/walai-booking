'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Edit2, Trash2, X, Star, CreditCard } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface BankAccount {
  bank_account_id: number;
  bank_name: string;
  account_number: string;
  account_name: string;
  promptpay_id: string | null;
  is_primary: boolean;
}

const emptyForm = { bank_name: '', account_number: '', account_name: '', promptpay_id: '', is_primary: false };

export default function BankAccountsPage() {
  const { ready } = useAuthGuard({ allowedRoles: ['admin'] });
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ready) return;
    fetchAccounts();
  }, [ready]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/settings/bank-accounts');
      setAccounts(res.data?.data || []);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลบัญชีธนาคารได้');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (acc: BankAccount) => {
    setEditing(acc);
    setForm({
      bank_name: acc.bank_name,
      account_number: acc.account_number,
      account_name: acc.account_name,
      promptpay_id: acc.promptpay_id || '',
      is_primary: acc.is_primary,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bank_name || !form.account_number || !form.account_name) {
      toast.error('กรุณากรอกข้อมูลให้ครบ');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/settings/bank-accounts/${editing.bank_account_id}`, form);
        toast.success('แก้ไขบัญชีธนาคารสำเร็จ');
      } else {
        await api.post('/settings/bank-accounts', form);
        toast.success('เพิ่มบัญชีธนาคารสำเร็จ');
      }
      setModalOpen(false);
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('ต้องการลบบัญชีธนาคารนี้?')) return;
    try {
      await api.delete(`/settings/bank-accounts/${id}`);
      toast.success('ลบบัญชีธนาคารสำเร็จ');
      fetchAccounts();
    } catch {
      toast.error('ลบไม่สำเร็จ');
    }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <ArrowLeft size={20} className="text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">บัญชีธนาคาร</h1>
              <p className="text-gray-500 mt-0.5">จัดการบัญชีรับชำระเงินของระบบ</p>
            </div>
          </div>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={16} /> เพิ่มบัญชี
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map(i => <div key={i} className="card h-24 animate-pulse bg-gray-100" />)}
          </div>
        ) : accounts.length === 0 ? (
          <div className="card p-12 text-center text-gray-400">
            <CreditCard size={48} className="mx-auto mb-3 opacity-30" />
            <p>ยังไม่มีบัญชีธนาคาร</p>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map(acc => (
              <div key={acc.bank_account_id} className={`card p-5 flex items-start justify-between gap-4 ${acc.is_primary ? 'border-2 border-teal-400' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
                    <CreditCard size={22} className="text-teal-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-bold text-gray-900">{acc.bank_name}</p>
                      {acc.is_primary && (
                        <span className="flex items-center gap-1 text-xs bg-teal-100 text-teal-700 font-semibold px-2 py-0.5 rounded-full">
                          <Star size={11} fill="currentColor" /> หลัก
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{acc.account_name}</p>
                    <p className="text-sm text-gray-500 font-mono">{acc.account_number}</p>
                    {acc.promptpay_id && (
                      <p className="text-xs text-gray-400 mt-0.5">PromptPay: {acc.promptpay_id}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(acc)}
                    className="p-2 rounded-xl hover:bg-gray-100 text-gray-500 transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(acc.bank_account_id)}
                    className="p-2 rounded-xl hover:bg-red-50 text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-bold text-lg text-gray-900">{editing ? 'แก้ไขบัญชีธนาคาร' : 'เพิ่มบัญชีธนาคาร'}</h3>
              <button onClick={() => setModalOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-xl"><X size={18} /></button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อธนาคาร *</label>
                <input className="input-field" value={form.bank_name} onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="เช่น ธนาคารกสิกรไทย" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อบัญชี *</label>
                <input className="input-field" value={form.account_name} onChange={e => setForm(f => ({ ...f, account_name: e.target.value }))} placeholder="ชื่อเจ้าของบัญชี" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เลขบัญชี *</label>
                <input className="input-field font-mono" value={form.account_number} onChange={e => setForm(f => ({ ...f, account_number: e.target.value }))} placeholder="000-0-00000-0" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">หมายเลข PromptPay (ถ้ามี)</label>
                <input className="input-field font-mono" value={form.promptpay_id} onChange={e => setForm(f => ({ ...f, promptpay_id: e.target.value }))} placeholder="เบอร์หรือเลขบัตรประชาชน" />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.is_primary} onChange={e => setForm(f => ({ ...f, is_primary: e.target.checked }))} className="w-4 h-4 accent-teal-600" />
                <span className="text-sm font-medium text-gray-700">ตั้งเป็นบัญชีหลัก</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 btn-secondary">ยกเลิก</button>
                <button type="submit" disabled={saving} className="flex-1 btn-primary">{saving ? 'กำลังบันทึก...' : 'บันทึก'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
