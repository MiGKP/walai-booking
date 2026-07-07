'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home, Edit2, Trash2, X } from 'lucide-react';
import api from '@/lib/api';
import { resolveMediaUrl } from '@/lib/avatar';
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

  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editGalleryFiles, setEditGalleryFiles] = useState<File[]>([]);
  const [editUploading, setEditUploading] = useState(false);

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

  const openEditRoom = (rt: any) => {
    setEditingRoom({
      id: rt.id,
      type_name: rt.type_name,
      description: rt.description || '',
      capacity: rt.capacity,
      price: rt.price_per_night,
      room_image: rt.main_image || '',
      amenity_ids: (rt.amenities || []).map((a: any) => a.id),
      existing_gallery: Array.isArray(rt.images) ? rt.images.filter((img: string) => img !== rt.main_image) : [],
    });
    setEditCoverFile(null);
    setEditGalleryFiles([]);
    setShowEditModal(true);
  };

  const editAmenityToggle = (id: number) => {
    setEditingRoom((prev: any) => {
      const has = prev.amenity_ids.includes(id);
      return { ...prev, amenity_ids: has ? prev.amenity_ids.filter((a: number) => a !== id) : [...prev.amenity_ids, id] };
    });
  };

  const handleUpdateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoom) return;
    setEditUploading(true);
    try {
      let roomImage = editingRoom.room_image;
      if (editCoverFile) {
        roomImage = await uploadImage(editCoverFile);
      }
      const newGalleryUrls = editGalleryFiles.length > 0
        ? await Promise.all(editGalleryFiles.map((f) => uploadImage(f)))
        : [];
      const finalGallery = [...(editingRoom.existing_gallery || []), ...newGalleryUrls];
      await api.put(`/rooms/${editingRoom.id}`, {
        type_name: editingRoom.type_name,
        room_name: editingRoom.type_name,
        description: editingRoom.description,
        capacity: editingRoom.capacity,
        price: editingRoom.price,
        room_image: roomImage,
        amenity_ids: editingRoom.amenity_ids,
        gallery_images: finalGallery,
        status: true,
      });
      toast.success('แก้ไขประเภทห้องพักสำเร็จ');
      setShowEditModal(false);
      setEditingRoom(null);
      setEditCoverFile(null);
      setEditGalleryFiles([]);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'แก้ไขไม่สำเร็จ');
    } finally {
      setEditUploading(false);
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
                      <th className="text-right px-4 py-3 font-semibold text-gray-600">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 bg-white">
                    {loading ? (
                       <tr><td colSpan={4} className="p-4 text-center text-gray-500">กำลังโหลด...</td></tr>
                    ) : roomTypes.length === 0 ? (
                       <tr><td colSpan={4} className="p-4 text-center text-gray-500">ยังไม่มีข้อมูล</td></tr>
                    ) : (
                      roomTypes.map((rt: any) => (
                        <tr key={rt.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{rt.type_name}</td>
                          <td className="px-4 py-3 text-gray-600">{rt.capacity} คน</td>
                          <td className="px-4 py-3 text-teal-600 font-semibold">฿{Number(rt.price_per_night).toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button onClick={() => openEditRoom(rt)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไข">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => handleDelete(rt.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="ลบ">
                                <Trash2 size={16} />
                              </button>
                            </div>
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

      {/* Edit Room Type Modal */}
      {showEditModal && editingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">แก้ไขประเภทห้องพัก</h3>
              <button onClick={() => { setShowEditModal(false); setEditingRoom(null); }} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleUpdateRoom} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทห้อง</label>
                <input type="text" required className="input-field" value={editingRoom.type_name} onChange={(e) => setEditingRoom({ ...editingRoom, type_name: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รายละเอียด</label>
                <textarea className="input-field" rows={3} value={editingRoom.description} onChange={(e) => setEditingRoom({ ...editingRoom, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ผู้เข้าพัก (คน)</label>
                  <input type="number" required min="1" className="input-field" value={editingRoom.capacity} onChange={(e) => setEditingRoom({ ...editingRoom, capacity: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ราคา/คืน</label>
                  <input type="number" required min="0" className="input-field" value={editingRoom.price} onChange={(e) => setEditingRoom({ ...editingRoom, price: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รูปปกห้องพัก</label>
                {editingRoom.room_image && !editCoverFile && (
                  <div className="mb-2 relative w-full h-32 rounded-xl overflow-hidden border border-gray-200">
                    <img src={resolveMediaUrl(editingRoom.room_image)} alt="รูปปัจจุบัน" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 left-2 text-xs text-white bg-black/50 px-2 py-0.5 rounded-full">รูปปัจจุบัน</span>
                  </div>
                )}
                {editCoverFile && (
                  <div className="mb-2 relative w-full h-32 rounded-xl overflow-hidden border border-teal-300">
                    <img src={URL.createObjectURL(editCoverFile)} alt="รูปใหม่" className="w-full h-full object-cover" />
                    <span className="absolute bottom-1 left-2 text-xs text-white bg-teal-600/80 px-2 py-0.5 rounded-full">รูปใหม่</span>
                  </div>
                )}
                <input type="file" accept="image/*" className="input-field" onChange={(e) => setEditCoverFile(e.target.files?.[0] || null)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">รูปภาพเพิ่มเติม (Gallery)</label>
                {editingRoom.existing_gallery && editingRoom.existing_gallery.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 mb-1.5">รูปปัจจุบัน — hover เพื่อลบ</p>
                    <div className="flex flex-wrap gap-2">
                      {editingRoom.existing_gallery.map((img: string, idx: number) => (
                        <div key={idx} className="relative w-20 h-16 rounded-lg overflow-hidden border border-gray-200 group">
                          <img src={resolveMediaUrl(img)} alt={`gallery ${idx + 1}`} className="w-full h-full object-cover" />
                          <button type="button"
                            className="absolute inset-0 bg-red-600/70 text-white text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            onClick={() => setEditingRoom((prev: any) => ({ ...prev, existing_gallery: prev.existing_gallery.filter((_: string, i: number) => i !== idx) }))}>
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {editGalleryFiles.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-teal-600 mb-1.5">รูปใหม่ที่จะเพิ่ม</p>
                    <div className="flex flex-wrap gap-2">
                      {editGalleryFiles.map((f, idx) => (
                        <div key={idx} className="relative w-20 h-16 rounded-lg overflow-hidden border border-teal-300 group">
                          <img src={URL.createObjectURL(f)} alt={`new ${idx}`} className="w-full h-full object-cover" />
                          <button type="button"
                            className="absolute inset-0 bg-red-600/70 text-white text-lg font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            onClick={() => setEditGalleryFiles((prev) => prev.filter((_, i) => i !== idx))}>
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <input type="file" accept="image/*" multiple className="input-field"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setEditGalleryFiles((prev) => [...prev, ...files]);
                    e.target.value = '';
                  }} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">สิ่งอำนวยความสะดวก</label>
                {amenities.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-3 border border-gray-200 rounded-xl bg-gray-50">
                    {amenities.map(am => (
                      <label key={am.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-1 rounded">
                        <input type="checkbox" className="rounded text-teal-600" checked={editingRoom.amenity_ids.includes(am.id)} onChange={() => editAmenityToggle(am.id)} />
                        <span className="text-gray-700">{am.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowEditModal(false); setEditingRoom(null); setEditCoverFile(null); }} className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors">ยกเลิก</button>
                <button type="submit" disabled={editUploading} className="flex-1 btn-primary bg-teal-600 hover:bg-teal-700 disabled:opacity-60">
                  {editUploading ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
