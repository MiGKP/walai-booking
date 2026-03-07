'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, Edit, Trash2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function RoomTypesPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ allowedRoles: ['admin'] });
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({ 
    type_name: '', 
    description: '', 
    capacity: 2, 
    price: 0, 
    room_image: '', 
    gallery_images: [] as string[],
    amenities: [] as number[]
  });
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

  useEffect(() => {
    if (!ready) return;
    fetchData();
  }, [ready]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rtRes, amRes] = await Promise.all([
        api.get('/rooms'),
        api.get('/rooms/amenities/all')
      ]);
      setRoomTypes(rtRes.data?.data || []);
      setAmenities(amRes.data?.data || []);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  const handleAmenityToggle = (id: number) => {
    setForm(prev => {
      const isSelected = prev.amenities.includes(id);
      if (isSelected) {
        return { ...prev, amenities: prev.amenities.filter(a => a !== id) };
      } else {
        return { ...prev, amenities: [...prev.amenities, id] };
      }
    });
  };

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append('image', file);
    const res = await api.post('/uploads/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.data.url as string;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coverFile) {
      toast.error('กรุณาเลือกรูปปกห้องพัก');
      return;
    }

    setSubmitting(true);
    try {
      const roomImage = await uploadImage(coverFile);
      const galleryImages = galleryFiles.length > 0
        ? await Promise.all(galleryFiles.map((file) => uploadImage(file)))
        : [];

      await api.post('/rooms/type', {
        ...form,
        room_image: roomImage,
        gallery_images: galleryImages,
      });

      toast.success('สร้างประเภทห้องพักสำเร็จ');
      setForm({ type_name: '', description: '', capacity: 2, price: 0, room_image: '', gallery_images: [], amenities: [] });
      setCoverFile(null);
      setGalleryFiles([]);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'สร้างประเภทห้องพักไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบประเภทห้องพักนี้?')) return;
    try {
      await api.delete(`/rooms/${id}`);
      toast.success('ลบประเภทห้องพักสำเร็จ');
      fetchData();
    } catch {
      toast.error('ลบไม่สำเร็จ');
    }
  };

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => router.push('/admin')} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ArrowLeft className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">จัดการประเภทห้องพัก</h1>
            <p className="text-gray-500 mt-1">เพิ่มและแก้ไขประเภทห้องพักหลัก</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 bg-white p-2 rounded-xl shadow-sm w-fit border border-gray-100">
          <Link href="/admin/rooms/types" className="px-4 py-2 rounded-lg text-sm font-medium bg-teal-50 text-teal-700">ประเภทห้องพัก</Link>
          <Link href="/admin/rooms/single" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">จัดการรายห้อง</Link>
          <Link href="/admin/rooms/amenities" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">สิ่งอำนวยความสะดวก</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Form */}
          <div className="card p-6 lg:col-span-1 h-fit">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Home size={20} className="text-teal-600" />
              เพิ่มประเภทห้องใหม่
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทห้อง (เช่น วิลล่า, เต็นท์)</label>
                <input type="text" required className="input-field" value={form.type_name} onChange={(e) => setForm({ ...form, type_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                <textarea className="input-field" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ผู้เข้าพัก (คน)</label>
                  <input type="number" required min="1" className="input-field" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ราคา/คืน</label>
                  <input type="number" required min="0" className="input-field" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รูปปกห้องพัก</label>
                <input
                  type="file"
                  accept="image/*"
                  required
                  className="input-field"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                />
                {coverFile && <p className="mt-1 text-xs text-gray-500">ไฟล์ที่เลือก: {coverFile.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รูปเพิ่มเติมสำหรับ member</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="input-field"
                  onChange={(e) => setGalleryFiles(Array.from(e.target.files || []))}
                />
                {galleryFiles.length > 0 && (
                  <div className="mt-2 space-y-1 text-xs text-gray-500">
                    {galleryFiles.map((file) => (
                      <p key={`${file.name}-${file.lastModified}`}>{file.name}</p>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Amenities Multi-select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">สิ่งอำนวยความสะดวก</label>
                {amenities.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 border border-gray-200 rounded-xl bg-gray-50">
                    {amenities.map(am => (
                      <label key={am.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1 rounded">
                        <input 
                          type="checkbox" 
                          className="rounded text-teal-600 focus:ring-teal-500"
                          checked={form.amenities.includes(am.id)}
                          onChange={() => handleAmenityToggle(am.id)}
                        />
                        <span className="text-gray-700">{am.name}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-200 text-center">
                    ยังไม่มีสิ่งอำนวยความสะดวกในระบบ
                  </div>
                )}
              </div>

              <button type="submit" disabled={submitting} className="btn-primary w-full mt-4 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed">
                {submitting ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
            </form>
          </div>
          
          {/* Table */}
          <div className="lg:col-span-2">
            <div className="card overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700">
                รายการประเภทห้องพักทั้งหมด
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white border-b border-gray-100">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">ประเภทห้อง</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">ผู้เข้าพัก</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">ราคา</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-600">ห้องว่าง</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {loading ? (
                       <tr><td colSpan={5} className="p-4 text-center text-gray-500">กำลังโหลด...</td></tr>
                    ) : roomTypes.length === 0 ? (
                       <tr><td colSpan={5} className="p-4 text-center text-gray-500">ยังไม่มีข้อมูล</td></tr>
                    ) : (
                      roomTypes.map((rt: any) => (
                        <tr key={rt.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{rt.type_name}</td>
                          <td className="px-4 py-3 text-gray-600">{rt.capacity} คน</td>
                          <td className="px-4 py-3 text-teal-600 font-semibold">฿{Number(rt.price_per_night).toLocaleString()}</td>
                          <td className="px-4 py-3">{rt.available_count} ห้อง</td>
                          <td className="px-4 py-3 text-right">
                            <button onClick={() => handleDelete(rt.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="ลบ">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
