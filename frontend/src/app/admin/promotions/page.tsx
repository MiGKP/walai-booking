'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Edit2, ToggleLeft, ToggleRight, Tag, Percent, DollarSign, X, Save, Search } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Promotion {
  id: number;
  code: string;
  name: string;
  description?: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  min_nights?: number;
  min_price?: number;
  max_discount?: number;
  start_date?: string;
  end_date?: string;
  usage_limit?: number;
  usage_count: number;
  is_active: boolean;
  created_at: string;
}

const defaultForm = {
  code: '',
  name: '',
  description: '',
  discount_type: 'percent' as 'percent' | 'fixed',
  discount_value: '',
  min_nights: '',
  min_price: '',
  max_discount: '',
  start_date: '',
  end_date: '',
  usage_limit: '',
  is_active: true,
};

export default function PromotionsPage() {
  const { ready } = useAuthGuard({ allowedRoles: ['admin'] });
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!ready) return;
    fetchPromotions();
  }, [ready]);

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/promotions');
      setPromotions(res.data?.data || []);
    } catch {
      toast.error('โหลดข้อมูลโปรโมชั่นไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (p: Promotion) => {
    setEditingId(p.id);
    setForm({
      code: p.code,
      name: p.name,
      description: p.description || '',
      discount_type: p.discount_type,
      discount_value: String(p.discount_value),
      min_nights: p.min_nights ? String(p.min_nights) : '',
      min_price: p.min_price ? String(p.min_price) : '',
      max_discount: p.max_discount ? String(p.max_discount) : '',
      start_date: p.start_date ? p.start_date.split('T')[0] : '',
      end_date: p.end_date ? p.end_date.split('T')[0] : '',
      usage_limit: p.usage_limit ? String(p.usage_limit) : '',
      is_active: p.is_active,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        discount_value: Number(form.discount_value),
        min_nights: form.min_nights ? Number(form.min_nights) : null,
        min_price: form.min_price ? Number(form.min_price) : null,
        max_discount: form.max_discount ? Number(form.max_discount) : null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
      };

      if (editingId) {
        await api.put(`/promotions/${editingId}`, payload);
        toast.success('แก้ไขโปรโมชั่นสำเร็จ');
      } else {
        await api.post('/promotions', payload);
        toast.success('เพิ่มโปรโมชั่นสำเร็จ');
      }
      setShowModal(false);
      fetchPromotions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (p: Promotion) => {
    try {
      await api.put(`/promotions/${p.id}/toggle`);
      toast.success(p.is_active ? 'ปิดโปรโมชั่นแล้ว' : 'เปิดโปรโมชั่นแล้ว');
      fetchPromotions();
    } catch {
      toast.error('เปลี่ยนสถานะไม่สำเร็จ');
    }
  };

  const handleDelete = async (p: Promotion) => {
    if (!confirm(`ต้องการลบโปรโมชั่น "${p.name}" ใช่ไหม?`)) return;
    try {
      await api.delete(`/promotions/${p.id}`);
      toast.success('ลบโปรโมชั่นสำเร็จ');
      fetchPromotions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ');
    }
  };

  const filtered = promotions.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  if (!ready) return null;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <ArrowLeft size={20} className="text-gray-600" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">จัดการโปรโมชั่น</h1>
              <p className="text-gray-500 mt-0.5">สร้างและจัดการโค้ดส่วนลดสำหรับการจองห้องพัก</p>
            </div>
          </div>
          <button
            onClick={openCreate}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> เพิ่มโปรโมชั่น
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center">
              <Tag size={22} className="text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">โปรโมชั่นทั้งหมด</p>
              <p className="text-2xl font-bold text-purple-600">{promotions.length}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center">
              <ToggleRight size={22} className="text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">เปิดใช้งาน</p>
              <p className="text-2xl font-bold text-green-600">{promotions.filter(p => p.is_active).length}</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center">
              <Tag size={22} className="text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">ใช้งานแล้วทั้งหมด (ครั้ง)</p>
              <p className="text-2xl font-bold text-orange-500">{promotions.reduce((s, p) => s + (p.usage_count || 0), 0)}</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input-field pl-9"
            placeholder="ค้นหาชื่อหรือโค้ดโปรโมชั่น..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">โค้ด</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">ชื่อโปรโมชั่น</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">ส่วนลด</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">เงื่อนไข</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">ระยะเวลา</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">ใช้แล้ว</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">สถานะ</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {loading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-400">กำลังโหลด...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-gray-400">ไม่มีโปรโมชั่น</td></tr>
                ) : filtered.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono font-bold text-purple-700 bg-purple-50 px-2 py-1 rounded-lg text-xs">
                        {p.code}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.name}</p>
                      {p.description && <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {p.discount_type === 'percent' ? (
                          <><Percent size={13} className="text-teal-600" /><span className="font-bold text-teal-700">{p.discount_value}%</span></>
                        ) : (
                          <><DollarSign size={13} className="text-teal-600" /><span className="font-bold text-teal-700">฿{Number(p.discount_value).toLocaleString()}</span></>
                        )}
                      </div>
                      {p.max_discount && (
                        <p className="text-xs text-gray-400">สูงสุด ฿{Number(p.max_discount).toLocaleString()}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {p.min_nights && <p>จองขั้นต่ำ {p.min_nights} คืน</p>}
                      {p.min_price && <p>ยอดขั้นต่ำ ฿{Number(p.min_price).toLocaleString()}</p>}
                      {!p.min_nights && !p.min_price && <span className="text-gray-300">-</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {p.start_date ? new Date(p.start_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '∞'}
                      {' – '}
                      {p.end_date ? new Date(p.end_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '∞'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {p.usage_count}{p.usage_limit ? `/${p.usage_limit}` : ''} ครั้ง
                    </td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleToggle(p)} className="flex items-center gap-1.5">
                        {p.is_active ? (
                          <span className="flex items-center gap-1 text-xs bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-full">
                            <ToggleRight size={13} /> เปิด
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs bg-gray-100 text-gray-500 font-medium px-2.5 py-1 rounded-full">
                            <ToggleLeft size={13} /> ปิด
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">
                {editingId ? 'แก้ไขโปรโมชั่น' : 'เพิ่มโปรโมชั่นใหม่'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-100 rounded-full">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">โค้ดโปรโมชั่น *</label>
                  <input
                    className="input-field font-mono uppercase"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                    placeholder="เช่น SUMMER20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อโปรโมชั่น *</label>
                  <input
                    className="input-field"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="เช่น ลดฤดูร้อน 20%"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">คำอธิบาย</label>
                <textarea
                  className="input-field resize-none"
                  rows={2}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="รายละเอียดเพิ่มเติม..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทส่วนลด *</label>
                  <select
                    className="input-field"
                    value={form.discount_type}
                    onChange={e => setForm(f => ({ ...f, discount_type: e.target.value as 'percent' | 'fixed' }))}
                    required
                  >
                    <option value="percent">เปอร์เซ็นต์ (%)</option>
                    <option value="fixed">จำนวนเงิน (฿)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    มูลค่าส่วนลด * {form.discount_type === 'percent' ? '(%)' : '(฿)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input-field"
                    value={form.discount_value}
                    onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                    placeholder={form.discount_type === 'percent' ? 'เช่น 20' : 'เช่น 500'}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">จองขั้นต่ำ (คืน)</label>
                  <input
                    type="number"
                    min="1"
                    className="input-field"
                    value={form.min_nights}
                    onChange={e => setForm(f => ({ ...f, min_nights: e.target.value }))}
                    placeholder="ไม่จำกัด"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ยอดขั้นต่ำ (฿)</label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={form.min_price}
                    onChange={e => setForm(f => ({ ...f, min_price: e.target.value }))}
                    placeholder="ไม่จำกัด"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ส่วนลดสูงสุด (฿)</label>
                  <input
                    type="number"
                    min="0"
                    className="input-field"
                    value={form.max_discount}
                    onChange={e => setForm(f => ({ ...f, max_discount: e.target.value }))}
                    placeholder="ไม่จำกัด"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วันเริ่ม</label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วันสิ้นสุด</label>
                  <input
                    type="date"
                    className="input-field"
                    value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">จำกัดการใช้ (ครั้ง)</label>
                  <input
                    type="number"
                    min="1"
                    className="input-field"
                    value={form.usage_limit}
                    onChange={e => setForm(f => ({ ...f, usage_limit: e.target.value }))}
                    placeholder="ไม่จำกัด"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm font-medium text-gray-700">
                  {form.is_active ? 'เปิดใช้งานทันที' : 'ปิดใช้งาน'}
                </span>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-secondary flex-1"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  <Save size={16} />
                  {saving ? 'กำลังบันทึก...' : (editingId ? 'บันทึกการแก้ไข' : 'สร้างโปรโมชั่น')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
