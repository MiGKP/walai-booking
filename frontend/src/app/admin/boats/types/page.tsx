'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Anchor, LayoutDashboard, Clock, Edit2, Trash2, X, ImagePlus, XCircle } from 'lucide-react';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/avatar';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function BoatTypesPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ allowedRoles: ['admin'] });
  const [boatTypes, setBoatTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', description: '', capacity: 1, price_per_hour: 0, quantity: 1 });
  const [editingBoatType, setEditingBoatType] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editImages, setEditImages] = useState<{ id: number; image_path: string }[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [createImageFiles, setCreateImageFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!ready) return;
    fetchBoatTypes();
  }, [ready]);

  const fetchBoatTypes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/kayaks/admin/types');
      setBoatTypes(res.data?.data || []);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลประเภทเรือได้');
    } finally {
      setLoading(false);
    }
  };

  const handleEditBoatType = async (bt: any) => {
    setEditingBoatType({
      id: bt.id,
      name: bt.name,
      description: bt.description || '',
      capacity: bt.capacity,
      price_per_hour: bt.price_per_hour,
      quantity: bt.quantity,
      is_active: bt.is_active !== false
    });
    try {
      const res = await api.get(`/kayaks/${bt.id}/images`);
      setEditImages(res.data?.data || []);
    } catch {
      setEditImages([]);
    }
    setShowEditModal(true);
  };

  const handleUploadImage = async (file: File, boatTypeId: number) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await api.post('/uploads/image', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data?.data?.url as string;
  };

  const handleAddEditImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingBoatType) return;
    setUploadingImage(true);
    try {
      const url = await handleUploadImage(file, editingBoatType.id);
      await api.post(`/kayaks/${editingBoatType.id}/images`, { image_path: url });
      const res = await api.get(`/kayaks/${editingBoatType.id}/images`);
      setEditImages(res.data?.data || []);
      toast.success('เพิ่มรูปสำเร็จ');
    } catch {
      toast.error('เพิ่มรูปไม่สำเร็จ');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleDeleteEditImage = async (imgId: number) => {
    if (!editingBoatType) return;
    try {
      await api.delete(`/kayaks/${editingBoatType.id}/images/${imgId}`);
      setEditImages((prev) => prev.filter((img) => img.id !== imgId));
      toast.success('ลบรูปสำเร็จ');
    } catch {
      toast.error('ลบรูปไม่สำเร็จ');
    }
  };

  const handleUpdateBoatType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBoatType) return;
    try {
      await api.put(`/kayaks/${editingBoatType.id}`, editingBoatType);
      toast.success('แก้ไขประเภทเรือสำเร็จ');
      setShowEditModal(false);
      setEditingBoatType(null);
      fetchBoatTypes();
    } catch {
      toast.error('แก้ไขประเภทเรือไม่สำเร็จ');
    }
  };

  const handleDeleteBoatType = async (id: number, name: string) => {
    if (!confirm(`ต้องการลบประเภทเรือ "${name}" ใช่หรือไม่?`)) return;
    try {
      await api.delete(`/kayaks/${id}`);
      toast.success('ลบประเภทเรือสำเร็จ');
      fetchBoatTypes();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'ลบไม่สำเร็จ');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.post('/kayaks', form);
      const newId = res.data?.data?.boat_type_id;
      if (newId && createImageFiles.length > 0) {
        for (const file of createImageFiles) {
          try {
            const url = await handleUploadImage(file, newId);
            await api.post(`/kayaks/${newId}/images`, { image_path: url });
          } catch {}
        }
      }
      toast.success('สร้างประเภทเรือสำเร็จ');
      setForm({ name: '', description: '', capacity: 1, price_per_hour: 0, quantity: 1 });
      setCreateImageFiles([]);
      fetchBoatTypes();
    } catch {
      toast.error('สร้างประเภทเรือไม่สำเร็จ');
    }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">จัดการเรือและคายัค</h1>
          <p className="text-gray-500 mt-1">เพิ่มและจัดการประเภทเรือ</p>
        </div>

        {/* Sub Navigation */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <Link href="/staff/boats/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">
            <LayoutDashboard size={15} /> แดชบอร์ด
          </Link>
          <Link href="/admin/boats/types" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-cyan-600 text-white shadow-sm">
            <Anchor size={15} /> ประเภทเรือ
          </Link>
          <Link href="/admin/boats/rounds" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">
            <Clock size={15} /> รอบเวลาเรือ
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="card p-6 lg:col-span-1 h-fit">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Anchor size={20} className="text-cyan-600" /> เพิ่มประเภทเรือ
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อประเภทเรือ</label>
                <input type="text" required className="input-field" value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                <textarea className="input-field" rows={2} value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ที่นั่ง</label>
                  <input type="number" required min="1" className="input-field px-2" value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">ราคา/รอบ</label>
                  <input type="number" required min="0" className="input-field px-2" value={form.price_per_hour}
                    onChange={(e) => setForm({ ...form, price_per_hour: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">จำนวนลำ</label>
                  <input type="number" required min="1" className="input-field px-2" value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รูปเรือ (เพิ่มได้หลายรูป)</label>
                <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-gray-200 hover:border-cyan-400 rounded-xl px-3 py-2.5 transition-colors">
                  <ImagePlus size={16} className="text-gray-400" />
                  <span className="text-sm text-gray-500">เลือกรูปภาพ</span>
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setCreateImageFiles((prev) => [...prev, ...files]);
                      e.target.value = '';
                    }}
                  />
                </label>
                {createImageFiles.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {createImageFiles.map((f, i) => (
                      <div key={i} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={URL.createObjectURL(f)} alt="preview" className="w-14 h-14 object-cover rounded-lg border border-gray-200" />
                        <button type="button"
                          onClick={() => setCreateImageFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute -top-1.5 -right-1.5 bg-white rounded-full shadow">
                          <XCircle size={16} className="text-red-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" className="btn-primary w-full bg-cyan-600 hover:bg-cyan-700">สร้างประเภทเรือ</button>
            </form>
          </div>

          {/* Table */}
          <div className="card overflow-hidden lg:col-span-2">
            <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700">รายการประเภทเรือทั้งหมด</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">รูป</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">ชื่อ</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">ที่นั่ง</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">ราคา/รอบ</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">จำนวนลำ</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">สถานะ</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {loading ? (
                    <tr><td colSpan={7} className="p-4 text-center text-gray-400">กำลังโหลด...</td></tr>
                  ) : boatTypes.length === 0 ? (
                    <tr><td colSpan={7} className="p-4 text-center text-gray-400">ยังไม่มีข้อมูล</td></tr>
                  ) : boatTypes.map((bt: any) => (
                    <tr key={bt.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        {bt.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={resolveMediaUrl(bt.image)} alt={bt.name} className="w-12 h-10 object-cover rounded-lg border border-gray-100" />
                        ) : (
                          <div className="w-12 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <Anchor size={16} className="text-gray-300" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{bt.name}</td>
                      <td className="px-4 py-3 text-gray-600">{bt.capacity} ที่นั่ง</td>
                      <td className="px-4 py-3 text-cyan-600 font-semibold">฿{Number(bt.price_per_hour).toLocaleString()}</td>
                      <td className="px-4 py-3">{bt.quantity} ลำ</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${bt.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {bt.is_active !== false ? 'เปิดใช้งาน' : 'ปิด'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleEditBoatType(bt)} className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 transition-colors" title="แก้ไข">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => handleDeleteBoatType(bt.id, bt.name)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 transition-colors" title="ลบ">
                            <Trash2 size={16} />
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

        {/* Edit Modal */}
        {showEditModal && editingBoatType && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">แก้ไขประเภทเรือ</h3>
                <button onClick={() => { setShowEditModal(false); setEditingBoatType(null); setEditImages([]); }} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleUpdateBoatType} className="p-6 space-y-4">
                {/* Image Management */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">รูปเรือ</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {editImages.map((img) => (
                      <div key={img.id} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveMediaUrl(img.image_path)}
                          alt="boat"
                          className="w-16 h-16 object-cover rounded-xl border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteEditImage(img.id)}
                          className="absolute -top-1.5 -right-1.5 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <XCircle size={17} className="text-red-500" />
                        </button>
                      </div>
                    ))}
                    <label className={`w-16 h-16 flex flex-col items-center justify-center border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploadingImage ? 'border-gray-200 opacity-50 pointer-events-none' : 'border-gray-200 hover:border-cyan-400'}`}>
                      {uploadingImage ? (
                        <span className="text-xs text-gray-400">โหลด...</span>
                      ) : (
                        <>
                          <ImagePlus size={18} className="text-gray-400" />
                          <span className="text-xs text-gray-400 mt-0.5">เพิ่ม</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleAddEditImage} disabled={uploadingImage} />
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อประเภทเรือ</label>
                  <input type="text" required className="input-field" value={editingBoatType.name} onChange={(e) => setEditingBoatType({ ...editingBoatType, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                  <textarea className="input-field" rows={2} value={editingBoatType.description} onChange={(e) => setEditingBoatType({ ...editingBoatType, description: e.target.value })} />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ที่นั่ง</label>
                    <input type="number" required min="1" className="input-field px-2" value={editingBoatType.capacity} onChange={(e) => setEditingBoatType({ ...editingBoatType, capacity: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ราคา/รอบ</label>
                    <input type="number" required min="0" className="input-field px-2" value={editingBoatType.price_per_hour} onChange={(e) => setEditingBoatType({ ...editingBoatType, price_per_hour: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">จำนวนลำ</label>
                    <input type="number" required min="1" className="input-field px-2" value={editingBoatType.quantity} onChange={(e) => setEditingBoatType({ ...editingBoatType, quantity: Number(e.target.value) })} />
                  </div>
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={editingBoatType.is_active} onChange={(e) => setEditingBoatType({ ...editingBoatType, is_active: e.target.checked })} className="w-4 h-4 text-cyan-600 rounded" />
                    <span className="text-sm font-medium text-gray-700">เปิดใช้งาน</span>
                  </label>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => { setShowEditModal(false); setEditingBoatType(null); setEditImages([]); }} className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">ยกเลิก</button>
                  <button type="submit" className="flex-1 btn-primary bg-cyan-600 hover:bg-cyan-700">บันทึก</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
