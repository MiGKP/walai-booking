"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  PlusCircle,
  Edit3,
  Trash2,
  X,
  Search,
  Image as ImageIcon,
  Layers,
  AlertTriangle,
  Users,
  UploadCloud,
  Loader2,
  Eye,
  CheckCircle2,
  BedDouble,
  Sparkles,
} from "lucide-react";
import api from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatar";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast from "react-hot-toast";
import Link from "next/link";

// Constants & Validation Rules
const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_GALLERY_COUNT = 5;

export default function RoomTypesPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ allowedRoles: ["admin"] });
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Modals Open/Close States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form State (Create)
  const [form, setForm] = useState({
    type_name: "",
    description: "",
    capacity: 2,
    price: 0,
    room_image: "",
    gallery_images: [] as string[],
    amenities: [] as number[],
  });

  // Create Form - File States & Drag state
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [isDraggingCover, setIsDraggingCover] = useState(false);

  // Edit Modal States
  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [editGalleryFiles, setEditGalleryFiles] = useState<File[]>([]);
  const [editGalleryPreviews, setEditGalleryPreviews] = useState<string[]>([]);
  const [editUploading, setEditUploading] = useState(false);

  // Modals (Delete Confirm & Image Lightbox)
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    if (!ready) return;
    fetchData();
  }, [ready]);

  // Clean up Object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      galleryPreviews.forEach((url) => URL.revokeObjectURL(url));
      if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
      editGalleryPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [coverPreview, galleryPreviews, editCoverPreview, editGalleryPreviews]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rtRes, amRes] = await Promise.all([
        api.get("/rooms"),
        api.get("/rooms/amenities/all"),
      ]);
      setRoomTypes(rtRes.data?.data || []);
      setAmenities(amRes.data?.data || []);
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  // Helper Validation
  const validateFile = (file: File) => {
    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      toast.error(`ไฟล์ ${file.name} ต้องเป็น JPG, PNG หรือ WEBP เท่านั้น`);
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`ไฟล์ ${file.name} มีขนาดเกิน 5MB`);
      return false;
    }
    return true;
  };

  // Handlers สำหรับรูปปก (สร้างใหม่)
  const processCoverFile = (file: File) => {
    if (validateFile(file)) {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processCoverFile(file);
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCover(true);
  };

  const handleDragLeave = () => {
    setIsDraggingCover(false);
  };

  const handleDropCover = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingCover(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processCoverFile(file);
  };

  // Handlers สำหรับรูป Gallery (สร้างใหม่)
  const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);

    if (galleryFiles.length + selectedFiles.length > MAX_GALLERY_COUNT) {
      toast.error(`เพิ่มรูป Gallery ได้สูงสุด ${MAX_GALLERY_COUNT} รูปเท่านั้น`);
      return;
    }

    const validFiles = selectedFiles.filter(validateFile);
    if (validFiles.length > 0) {
      const newPreviews = validFiles.map((file) => URL.createObjectURL(file));
      setGalleryFiles((prev) => [...prev, ...validFiles]);
      setGalleryPreviews((prev) => [...prev, ...newPreviews]);
    }
    e.target.value = "";
  };

  const removeGalleryFile = (index: number) => {
    if (galleryPreviews[index]) {
      URL.revokeObjectURL(galleryPreviews[index]);
    }
    setGalleryFiles((prev) => prev.filter((_, i) => i !== index));
    setGalleryPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAmenityToggle = (id: number) => {
    setForm((prev) => {
      const isSelected = prev.amenities.includes(id);
      return {
        ...prev,
        amenities: isSelected
          ? prev.amenities.filter((a) => a !== id)
          : [...prev.amenities, id],
      };
    });
  };

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append("image", file);
    const res = await api.post("/uploads/image", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res.data.data.url as string;
  };

  const resetCreateForm = () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    galleryPreviews.forEach((url) => URL.revokeObjectURL(url));

    setForm({
      type_name: "",
      description: "",
      capacity: 2,
      price: 0,
      room_image: "",
      gallery_images: [],
      amenities: [],
    });
    setCoverFile(null);
    setCoverPreview(null);
    setGalleryFiles([]);
    setGalleryPreviews([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coverFile) {
      toast.error("กรุณาเลือกรูปปกห้องพัก");
      return;
    }

    setSubmitting(true);
    try {
      const roomImage = await uploadImage(coverFile);
      const galleryImages =
        galleryFiles.length > 0
          ? await Promise.all(galleryFiles.map((file) => uploadImage(file)))
          : [];

      await api.post("/rooms/type", {
        ...form,
        room_image: roomImage,
        gallery_images: galleryImages,
      });

      toast.success("สร้างประเภทห้องพักสำเร็จ");

      resetCreateForm();
      setShowCreateModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "สร้างประเภทห้องพักไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await api.delete(`/rooms/${deleteTargetId}`);
      toast.success("ลบประเภทห้องพักสำเร็จ");
      fetchData();
    } catch {
      toast.error("ลบไม่สำเร็จ");
    } finally {
      setDeleteTargetId(null);
    }
  };

  const openEditRoom = (rt: any) => {
    setEditingRoom({
      id: rt.id,
      type_name: rt.type_name,
      description: rt.description || "",
      capacity: rt.capacity,
      price: rt.price_per_night,
      room_image: rt.main_image || "",
      amenity_ids: (rt.amenities || []).map((a: any) => a.id),
      existing_gallery: Array.isArray(rt.images)
        ? rt.images.filter((img: string) => img !== rt.main_image)
        : [],
    });
    setEditCoverFile(null);
    setEditCoverPreview(null);
    setEditGalleryFiles([]);
    setEditGalleryPreviews([]);
    setShowEditModal(true);
  };

  const handleEditCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateFile(file)) {
      if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
      setEditCoverFile(file);
      setEditCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleEditGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const currentTotal =
      (editingRoom?.existing_gallery?.length || 0) +
      editGalleryFiles.length +
      selectedFiles.length;

    if (currentTotal > MAX_GALLERY_COUNT) {
      toast.error(`รวมรูปเดิมและรูปใหม่แล้วไม่สามารถเกิน ${MAX_GALLERY_COUNT} รูปได้`);
      return;
    }

    const validFiles = selectedFiles.filter(validateFile);
    if (validFiles.length > 0) {
      const newPreviews = validFiles.map((file) => URL.createObjectURL(file));
      setEditGalleryFiles((prev) => [...prev, ...validFiles]);
      setEditGalleryPreviews((prev) => [...prev, ...newPreviews]);
    }
    e.target.value = "";
  };

  const removeEditGalleryFile = (index: number) => {
    if (editGalleryPreviews[index]) {
      URL.revokeObjectURL(editGalleryPreviews[index]);
    }
    setEditGalleryFiles((prev) => prev.filter((_, i) => i !== index));
    setEditGalleryPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const editAmenityToggle = (id: number) => {
    setEditingRoom((prev: any) => {
      const has = prev.amenity_ids.includes(id);
      return {
        ...prev,
        amenity_ids: has
          ? prev.amenity_ids.filter((a: number) => a !== id)
          : [...prev.amenity_ids, id],
      };
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
      const newGalleryUrls =
        editGalleryFiles.length > 0
          ? await Promise.all(editGalleryFiles.map((f) => uploadImage(f)))
          : [];
      const finalGallery = [
        ...(editingRoom.existing_gallery || []),
        ...newGalleryUrls,
      ];
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
      toast.success("แก้ไขประเภทห้องพักสำเร็จ");

      if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
      editGalleryPreviews.forEach((url) => URL.revokeObjectURL(url));

      setShowEditModal(false);
      setEditingRoom(null);
      setEditCoverFile(null);
      setEditCoverPreview(null);
      setEditGalleryFiles([]);
      setEditGalleryPreviews([]);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "แก้ไขไม่สำเร็จ");
    } finally {
      setEditUploading(false);
    }
  };

  const filteredRoomTypes = roomTypes.filter((rt) => {
    const searchLower = searchQuery.toLowerCase().trim();
    return (
      !searchQuery ||
      (rt.type_name && rt.type_name.toLowerCase().includes(searchLower)) ||
      (rt.description && rt.description.toLowerCase().includes(searchLower))
    );
  });

  if (!ready) return null;

  return (
    <div className="w-full min-h-screen flex flex-col font-sans space-y-6 pb-12 text-stone-800">
      {/* Header & Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-stone-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0b3b2c]/10 text-[#0b3b2c] rounded-xl">
              <BedDouble size={20} />
            </span>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-[#0b3b2c] tracking-tight">
              จัดการประเภทห้องพัก
            </h1>
          </div>
          <p className="text-stone-500 mt-1 text-xs md:text-sm">
            เพิ่ม ดู และแก้ไขประเภทห้องพักในระบบสวนวลัยรุกขเวช
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-[#0b3b2c] hover:bg-[#07271d] text-white rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <Plus size={16} />
            เพิ่มประเภทห้องพัก
          </button>

          <div className="px-3.5 py-2 bg-white rounded-xl border border-stone-200/80 shadow-xs flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#0b3b2c]/10 flex items-center justify-center text-[#0b3b2c]">
              <Layers size={18} />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-stone-400 block leading-tight">
                ทั้งหมด
              </span>
              <span className="text-xs font-bold text-[#0b3b2c]">
                {roomTypes.length} รายการ
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-stone-200/60 rounded-xl overflow-x-auto text-xs w-fit border border-stone-200/80">
        <Link
          href="/admin/rooms/types"
          className="px-4 py-2 rounded-lg font-bold bg-white text-[#0b3b2c] shadow-xs transition-all whitespace-nowrap flex items-center gap-1.5"
        >
          <Layers size={14} />
          ประเภทห้องพัก
        </Link>
        <Link
          href="/admin/rooms/single"
          className="px-4 py-2 rounded-lg font-medium text-stone-600 hover:text-stone-900 transition-all whitespace-nowrap"
        >
          จัดการรายห้อง
        </Link>
        <Link
          href="/admin/rooms/amenities"
          className="px-4 py-2 rounded-lg font-medium text-stone-600 hover:text-stone-900 transition-all whitespace-nowrap"
        >
          สิ่งอำนวยความสะดวก
        </Link>
      </div>

      {/* Table List Section (Full Width) */}
      <div className="bg-white border border-stone-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[500px]">
        {/* Header & Search */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/50">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-stone-800">
              รายการประเภทห้องพักทั้งหมด
            </h2>
            <span className="px-2 py-0.5 bg-stone-200/70 text-stone-600 rounded-full text-[11px] font-bold">
              {filteredRoomTypes.length}
            </span>
          </div>

          <div className="relative w-full sm:w-80">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อประเภทห้อง หรือคำอธิบาย..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-white border border-stone-200 rounded-xl text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs p-0.5 rounded-full hover:bg-stone-100"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Table Area */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-stone-100/70 border-b border-stone-200/80 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">ประเภทห้อง</th>
                <th className="px-4 py-3.5">ความจุ</th>
                <th className="px-4 py-3.5">สิ่งอำนวยความสะดวก</th>
                <th className="px-4 py-3.5">ราคา / คืน</th>
                <th className="px-4 py-3.5 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs text-stone-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-stone-400">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#0b3b2c] border-t-transparent mb-3" />
                    <p className="text-xs font-medium text-stone-500">กำลังโหลดข้อมูลห้องพัก...</p>
                  </td>
                </tr>
              ) : filteredRoomTypes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-stone-400">
                    <Layers size={40} className="mx-auto mb-3 text-stone-300 stroke-[1.5]" />
                    <p className="text-sm font-semibold text-stone-600">ไม่พบประเภทห้องพัก</p>
                    <p className="text-xs text-stone-400 mt-1">ลองเปลี่ยนคำค้นหา หรือกดเพิ่มประเภทห้องพักใหม่</p>
                  </td>
                </tr>
              ) : (
                filteredRoomTypes.map((rt: any) => (
                  <tr key={rt.id} className="hover:bg-stone-50/80 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {rt.main_image ? (
                          <div
                            onClick={() =>
                              setLightboxImage({
                                url: resolveMediaUrl(rt.main_image),
                                title: rt.type_name,
                              })
                            }
                            className="relative w-12 h-12 rounded-xl overflow-hidden border border-stone-200/80 shrink-0 cursor-pointer group shadow-2xs"
                            title="คลิกเพื่อขยายดูรูปภาพ"
                          >
                            <img
                              src={resolveMediaUrl(rt.main_image)}
                              alt={rt.type_name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Eye size={14} />
                            </div>
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0 text-stone-400">
                            <ImageIcon size={18} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-stone-900 text-sm truncate">
                            {rt.type_name}
                          </div>
                          <div className="text-[11px] text-stone-400 truncate max-w-sm font-normal mt-0.5">
                            {rt.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200/60">
                        <Users size={13} className="text-stone-500" />
                        {rt.capacity} คน
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {rt.amenities && rt.amenities.length > 0 ? (
                          rt.amenities.map((am: any) => (
                            <span
                              key={am.id}
                              className="px-2 py-0.5 bg-emerald-50 text-[#0b3b2c] border border-emerald-200/50 rounded-md text-[10px] font-medium"
                            >
                              {am.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-stone-400 font-normal">ไม่ได้ระบุ</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-bold text-[#0b3b2c] text-sm">
                        ฿{Number(rt.price_per_night || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditRoom(rt)}
                          className="p-1.5 text-stone-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-all"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmDelete(rt.id)}
                          className="p-1.5 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          title="ลบประเภทห้อง"
                        >
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

      {/* 🟢 MODAL: Create Room Type */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-stone-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-[#0b3b2c] text-white">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <PlusCircle size={18} className="text-emerald-300" />
                เพิ่มประเภทห้องพักใหม่
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="p-1 text-emerald-100 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    ชื่อประเภทห้อง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น วิลล่าริมน้ำ, เต็นท์โดม VIP"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                    value={form.type_name}
                    onChange={(e) =>
                      setForm({ ...form, type_name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    รายละเอียด
                  </label>
                  <textarea
                    placeholder="บรรยากาศห้องพัก วิว และคำอธิบายเพิ่มเติม..."
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs resize-none"
                    rows={2}
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      ผู้เข้าพัก (คน) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                      value={form.capacity}
                      onChange={(e) =>
                        setForm({ ...form, capacity: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      ราคา/คืน (บาท) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                      value={form.price}
                      onChange={(e) =>
                        setForm({ ...form, price: Number(e.target.value) })
                      }
                    />
                  </div>
                </div>

                {/* Drag & Drop Cover Image Upload */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    รูปปกห้องพัก <span className="text-rose-500">*</span>
                  </label>

                  {coverPreview ? (
                    <div className="relative w-full h-36 rounded-xl overflow-hidden border-2 border-[#0b3b2c] shadow-xs group">
                      <img
                        src={coverPreview}
                        alt="Cover Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (coverPreview) URL.revokeObjectURL(coverPreview);
                            setCoverFile(null);
                            setCoverPreview(null);
                          }}
                          className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-md transition-transform active:scale-95 cursor-pointer"
                        >
                          <X size={14} /> เปลี่ยนรูปภาพ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDropCover}
                      className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl transition-all cursor-pointer group p-3 text-center ${
                        isDraggingCover
                          ? "border-[#0b3b2c] bg-[#0b3b2c]/10 scale-[1.01]"
                          : "border-stone-300 hover:border-[#0b3b2c] bg-stone-50 hover:bg-[#0b3b2c]/5"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-stone-200/80 group-hover:bg-[#0b3b2c]/10 text-stone-500 group-hover:text-[#0b3b2c] flex items-center justify-center transition-colors mb-1.5">
                        <UploadCloud size={18} />
                      </div>
                      <p className="text-xs font-bold text-stone-700 group-hover:text-[#0b3b2c] transition-colors">
                        คลิก หรือลากไฟล์มาวางเพื่ออัปโหลด
                      </p>
                      <p className="text-[10px] text-stone-400 mt-0.5">JPG, PNG, WEBP (ไม่เกิน 5MB)</p>
                      <input
                        type="file"
                        accept="image/*"
                        required
                        className="hidden"
                        onChange={handleCoverChange}
                      />
                    </label>
                  )}
                </div>

                {/* Gallery Files Upload */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-stone-700">
                      รูปภาพเพิ่มเติม (Gallery)
                    </label>
                    <span className="text-[11px] font-semibold text-stone-400">
                      {galleryPreviews.length}/{MAX_GALLERY_COUNT} รูป
                    </span>
                  </div>

                  <div className="space-y-2">
                    {galleryPreviews.length > 0 && (
                      <div className="grid grid-cols-4 gap-2">
                        {galleryPreviews.map((url, idx) => (
                          <div
                            key={idx}
                            className="relative h-16 rounded-xl overflow-hidden border border-stone-200 shadow-2xs group"
                          >
                            <img
                              src={url}
                              alt={`Gallery ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeGalleryFile(idx)}
                              className="absolute inset-0 bg-rose-600/80 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {galleryPreviews.length < MAX_GALLERY_COUNT && (
                      <label className="flex items-center justify-center gap-2 w-full py-2.5 px-3 border border-stone-200 hover:border-[#0b3b2c] rounded-xl bg-stone-50 hover:bg-[#0b3b2c]/5 transition-all cursor-pointer text-stone-600 hover:text-[#0b3b2c]">
                        <UploadCloud size={15} />
                        <span className="text-xs font-semibold">
                          {galleryPreviews.length > 0
                            ? "เพิ่มรูปภาพประกอบอีก..."
                            : "เลือกรูปภาพประกอบเพิ่มเติม"}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleGalleryChange}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Amenities Checklist */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    สิ่งอำนวยความสะดวก
                  </label>
                  {amenities.length > 0 ? (
                    <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto p-2 border border-stone-200 rounded-xl bg-stone-50/80 custom-scrollbar">
                      {amenities.map((am) => {
                        const checked = form.amenities.includes(am.id);
                        return (
                          <label
                            key={am.id}
                            className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer select-none ${
                              checked
                                ? "bg-white text-[#0b3b2c] font-bold shadow-2xs border border-emerald-200"
                                : "text-stone-600 hover:bg-stone-100"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="rounded text-[#0b3b2c] focus:ring-[#0b3b2c]/30 accent-[#0b3b2c]"
                              checked={checked}
                              onChange={() => handleAmenityToggle(am.id)}
                            />
                            <span className="truncate">{am.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-stone-400 bg-stone-50 p-3 rounded-xl border border-stone-200 text-center font-medium">
                      ยังไม่มีสิ่งอำนวยความสะดวกในระบบ
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 flex gap-2 border-t border-stone-100 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="flex-1 py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 px-4 bg-[#0b3b2c] hover:bg-[#07271d] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      กำลังบันทึก...
                    </>
                  ) : (
                    "สร้างประเภทห้องพัก"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🟡 MODAL: Edit Room Type */}
      {showEditModal && editingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-stone-100 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50">
              <h3 className="text-sm font-bold text-[#0b3b2c] flex items-center gap-2">
                <Edit3 size={16} className="text-amber-600" />
                แก้ไขประเภทห้องพัก
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingRoom(null);
                }}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdateRoom} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    ชื่อประเภทห้อง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                    value={editingRoom.type_name}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        type_name: e.target.value,
                      })
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    รายละเอียด
                  </label>
                  <textarea
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs resize-none"
                    rows={2}
                    value={editingRoom.description}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        description: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      ผู้เข้าพัก (คน) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                      value={editingRoom.capacity}
                      onChange={(e) =>
                        setEditingRoom({
                          ...editingRoom,
                          capacity: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      ราคา/คืน (บาท) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                      value={editingRoom.price}
                      onChange={(e) =>
                        setEditingRoom({
                          ...editingRoom,
                          price: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                {/* Cover Image Edit */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    รูปปกห้องพัก
                  </label>

                  <div className="relative w-full h-32 rounded-xl overflow-hidden border border-stone-200 mb-2 group shadow-2xs">
                    <img
                      src={
                        editCoverPreview ||
                        resolveMediaUrl(editingRoom.room_image)
                      }
                      alt="Cover"
                      className="w-full h-full object-cover"
                    />
                    <span
                      className={`absolute bottom-2 left-2 text-[10px] text-white px-2 py-0.5 rounded-md font-semibold backdrop-blur-md ${
                        editCoverPreview ? "bg-[#0b3b2c]" : "bg-black/60"
                      }`}
                    >
                      {editCoverPreview ? "รูปใหม่ที่จะเปลี่ยน" : "รูปปัจจุบัน"}
                    </span>
                  </div>

                  <label className="flex items-center justify-center gap-2 w-full py-2 px-3 border border-stone-200 hover:border-[#0b3b2c] rounded-xl bg-stone-50 hover:bg-[#0b3b2c]/5 transition-all cursor-pointer text-stone-600 hover:text-[#0b3b2c]">
                    <UploadCloud size={15} />
                    <span className="text-xs font-semibold">เปลี่ยนรูปปก</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleEditCoverChange}
                    />
                  </label>
                </div>

                {/* Gallery Images Edit */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    รูปภาพเพิ่มเติม (Gallery)
                  </label>

                  {editingRoom.existing_gallery &&
                    editingRoom.existing_gallery.length > 0 && (
                      <div className="mb-2.5">
                        <p className="text-[11px] text-stone-400 mb-1 font-medium">
                          รูปปัจจุบัน ({editingRoom.existing_gallery.length})
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {editingRoom.existing_gallery.map(
                            (img: string, idx: number) => (
                              <div
                                key={idx}
                                className="relative h-16 rounded-xl overflow-hidden border border-stone-200 group"
                              >
                                <img
                                  src={resolveMediaUrl(img)}
                                  alt={`gallery ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  className="absolute inset-0 bg-rose-600/80 text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                  onClick={() =>
                                    setEditingRoom((prev: any) => ({
                                      ...prev,
                                      existing_gallery:
                                        prev.existing_gallery.filter(
                                          (_: string, i: number) => i !== idx,
                                        ),
                                    }))
                                  }
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}

                  {editGalleryPreviews.length > 0 && (
                    <div className="mb-2.5">
                      <p className="text-[11px] text-[#0b3b2c] mb-1 font-bold">
                        รูปใหม่ที่จะเพิ่ม ({editGalleryPreviews.length})
                      </p>
                      <div className="grid grid-cols-4 gap-2">
                        {editGalleryPreviews.map((url, idx) => (
                          <div
                            key={idx}
                            className="relative h-16 rounded-xl overflow-hidden border-2 border-[#0b3b2c] group"
                          >
                            <img
                              src={url}
                              alt={`new preview ${idx}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              className="absolute inset-0 bg-rose-600/80 text-white font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                              onClick={() => removeEditGalleryFile(idx)}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {(editingRoom?.existing_gallery?.length || 0) +
                    editGalleryFiles.length <
                    MAX_GALLERY_COUNT && (
                    <label className="flex items-center justify-center gap-2 w-full py-2 px-3 border border-stone-200 hover:border-[#0b3b2c] rounded-xl bg-stone-50 hover:bg-[#0b3b2c]/5 transition-all cursor-pointer text-stone-600 hover:text-[#0b3b2c]">
                      <UploadCloud size={15} />
                      <span className="text-xs font-semibold">
                        อัปโหลดรูปเพิ่มเติม
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleEditGalleryChange}
                      />
                    </label>
                  )}
                </div>

                {/* Amenities List */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    สิ่งอำนวยความสะดวก
                  </label>
                  {amenities.length > 0 && (
                    <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto p-2 border border-stone-200 rounded-xl bg-stone-50/80 custom-scrollbar">
                      {amenities.map((am) => {
                        const isChecked =
                          editingRoom.amenity_ids.includes(am.id);
                        return (
                          <label
                            key={am.id}
                            className={`flex items-center gap-2 p-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                              isChecked
                                ? "bg-white text-[#0b3b2c] font-bold shadow-2xs border border-emerald-200"
                                : "text-stone-600 hover:bg-stone-100"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="rounded text-[#0b3b2c] accent-[#0b3b2c]"
                              checked={isChecked}
                              onChange={() => editAmenityToggle(am.id)}
                            />
                            <span className="truncate">{am.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 flex gap-2 border-t border-stone-100 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingRoom(null);
                    setEditCoverFile(null);
                    setEditCoverPreview(null);
                    setEditGalleryFiles([]);
                    setEditGalleryPreviews([]);
                  }}
                  className="flex-1 py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={editUploading}
                  className="flex-1 py-2.5 px-4 bg-[#0b3b2c] hover:bg-[#07271d] text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {editUploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />{" "}
                      กำลังบันทึก...
                    </>
                  ) : (
                    "บันทึกการแก้ไข"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🖼️ MODAL: Image Lightbox */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-md animate-in fade-in duration-150 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full bg-stone-900 rounded-2xl overflow-hidden shadow-2xl border border-stone-800"
          >
            <div className="p-3 bg-stone-900/90 flex items-center justify-between border-b border-stone-800 text-white">
              <span className="text-xs font-semibold px-2">
                {lightboxImage.title}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center bg-black/50">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* 🔴 MODAL: Delete Confirm */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-stone-100 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                ยืนยันการลบประเภทห้องพัก
              </h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                คุณแน่ใจหรือไม่ที่จะลบประเภทห้องพักนี้? <br />
                การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
              >
                ลบข้อมูล
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}