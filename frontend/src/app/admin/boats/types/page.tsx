"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Plus,
  Minus,
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
  Anchor,
  Clock,
  Compass,
  CheckCircle2,
} from "lucide-react";
import api from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatar";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

// Constants & Validation Rules
const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_GALLERY_COUNT = 5;

export default function BoatTypesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { ready } = useAuthGuard({ allowedRoles: ["admin", "boat_staff"] });
  const [boatTypes, setBoatTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Modals Open/Close States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  // Form State (Create)
  const [form, setForm] = useState({
    name: "",
    description: "",
    capacity: 2,
    price_per_hour: 0,
    quantity: 1,
    is_active: true,
    boat_image: "",
    gallery_images: [] as string[],
  });

  // Create Form - File States & Drag state
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [isDraggingCover, setIsDraggingCover] = useState(false);

  // Edit Modal States
  const [editingBoat, setEditingBoat] = useState<any>(null);
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
      const res = await api.get("/kayaks");
      setBoatTypes(res.data?.data || []);
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลเรือได้");
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
      toast.error(
        `เพิ่มรูป Gallery ได้สูงสุด ${MAX_GALLERY_COUNT} รูปเท่านั้น`,
      );
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
      name: "",
      description: "",
      capacity: 2,
      price_per_hour: 0,
      quantity: 1,
      is_active: true,
      boat_image: "",
      gallery_images: [],
    });
    setCoverFile(null);
    setCoverPreview(null);
    setGalleryFiles([]);
    setGalleryPreviews([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    try {
      let boatImage = "";
      if (coverFile) {
        boatImage = await uploadImage(coverFile);
      }
      const galleryImages =
        galleryFiles.length > 0
          ? await Promise.all(galleryFiles.map((file) => uploadImage(file)))
          : [];

      await api.post("/kayaks", {
        ...form,
        boat_image: boatImage,
        gallery_images: galleryImages,
      });

      toast.success("สร้างประเภทเรือสำเร็จ");

      resetCreateForm();
      setShowCreateModal(false);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "สร้างประเภทเรือไม่สำเร็จ");
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
      await api.delete(`/kayaks/${deleteTargetId}`);
      toast.success("ลบประเภทเรือสำเร็จ");
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "ลบไม่สำเร็จ");
    } finally {
      setDeleteTargetId(null);
    }
  };

  const openEditBoat = (bt: any) => {
    setEditingBoat({
      id: bt.id,
      name: bt.name,
      description: bt.description || "",
      capacity: bt.capacity,
      price_per_hour: bt.price_per_hour,
      quantity: bt.quantity,
      is_active: bt.is_active !== false,
      boat_image: bt.main_image || bt.boat_image || "",
      existing_gallery: Array.isArray(bt.images)
        ? bt.images.filter(
            (img: string) => img !== (bt.main_image || bt.boat_image),
          )
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
      (editingBoat?.existing_gallery?.length || 0) +
      editGalleryFiles.length +
      selectedFiles.length;

    if (currentTotal > MAX_GALLERY_COUNT) {
      toast.error(
        `รวมรูปเดิมและรูปใหม่แล้วไม่สามารถเกิน ${MAX_GALLERY_COUNT} รูปได้`,
      );
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

  const handleUpdateBoat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBoat) return;
    setEditUploading(true);
    try {
      let boatImage = editingBoat.boat_image;
      if (editCoverFile) {
        boatImage = await uploadImage(editCoverFile);
      }
      const newGalleryUrls =
        editGalleryFiles.length > 0
          ? await Promise.all(editGalleryFiles.map((f) => uploadImage(f)))
          : [];
      const finalGallery = [
        ...(editingBoat.existing_gallery || []),
        ...newGalleryUrls,
      ];
      await api.put(`/kayaks/${editingBoat.id}`, {
        name: editingBoat.name,
        description: editingBoat.description,
        capacity: editingBoat.capacity,
        price_per_hour: editingBoat.price_per_hour,
        quantity: editingBoat.quantity,
        is_active: editingBoat.is_active,
        boat_image: boatImage,
        gallery_images: finalGallery,
      });
      toast.success("แก้ไขประเภทเรือสำเร็จ");

      if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
      editGalleryPreviews.forEach((url) => URL.revokeObjectURL(url));

      setShowEditModal(false);
      setEditingBoat(null);
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

  const filteredBoatTypes = boatTypes.filter((bt) => {
    const searchLower = searchQuery.toLowerCase().trim();
    return (
      !searchQuery ||
      (bt.name && bt.name.toLowerCase().includes(searchLower)) ||
      (bt.description && bt.description.toLowerCase().includes(searchLower))
    );
  });

  if (!ready) return null;

  return (
    <div className="w-full min-h-screen flex flex-col font-sans space-y-6 pb-12 text-stone-800">
      {/* 🔔 Custom Styled Toaster */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: "#0b3b2c",
            color: "#ffffff",
            borderRadius: "14px",
            fontSize: "13px",
            fontWeight: "600",
            padding: "12px 16px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
          },
          success: {
            iconTheme: {
              primary: "#34d399",
              secondary: "#0b3b2c",
            },
          },
          error: {
            style: {
              background: "#881337",
              color: "#ffffff",
            },
            iconTheme: {
              primary: "#fb7185",
              secondary: "#881337",
            },
          },
        }}
      />

      {/* Header & Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-stone-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0b3b2c]/10 text-[#0b3b2c] rounded-xl">
              <Anchor size={20} />
            </span>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-[#0b3b2c] tracking-tight">
              จัดการประเภทเรือ
            </h1>
          </div>
          <p className="text-stone-500 mt-1 text-xs md:text-sm">
            เพิ่ม ดู และแก้ไขประเภทเรือ รูปภาพ Gallery และสเปกเรือในระบบ
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-[#0b3b2c] hover:bg-[#07271d] text-white rounded-xl font-bold text-xs shadow-md hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <Plus size={16} />
            เพิ่มประเภทเรือ
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
                {boatTypes.length} รายการ
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Table List Section */}
      <div className="bg-white border border-stone-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[500px]">
        <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/50">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-stone-800">
              รายการประเภทเรือทั้งหมด
            </h2>
            <span className="px-2 py-0.5 bg-stone-200/70 text-stone-600 rounded-full text-[11px] font-bold">
              {filteredBoatTypes.length}
            </span>
          </div>

          <div className="relative w-full sm:w-80">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อประเภทเรือ หรือคำอธิบาย..."
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
                <th className="px-5 py-3.5">ชื่อประเภทเรือ</th>
                <th className="px-4 py-3.5">ที่นั่ง</th>
                <th className="px-4 py-3.5">จำนวนที่มี</th>
                <th className="px-4 py-3.5">ราคา </th>
                <th className="px-4 py-3.5">สถานะ</th>
                <th className="px-4 py-3.5 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs text-stone-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-stone-400">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#0b3b2c] border-t-transparent mb-3" />
                    <p className="text-xs font-medium text-stone-500">
                      กำลังโหลดข้อมูลเรือ...
                    </p>
                  </td>
                </tr>
              ) : filteredBoatTypes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-stone-400">
                    <Layers
                      size={40}
                      className="mx-auto mb-3 text-stone-300 stroke-[1.5]"
                    />
                    <p className="text-sm font-semibold text-stone-600">
                      ไม่พบประเภทเรือ
                    </p>
                    <p className="text-xs text-stone-400 mt-1">
                      ลองเปลี่ยนคำค้นหา หรือกดเพิ่มประเภทเรือใหม่
                    </p>
                  </td>
                </tr>
              ) : (
                filteredBoatTypes.map((bt: any) => (
                  <tr
                    key={bt.id}
                    className="hover:bg-stone-50/80 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {bt.main_image || bt.boat_image ? (
                          <div
                            onClick={() =>
                              setLightboxImage({
                                url: resolveMediaUrl(
                                  bt.main_image || bt.boat_image,
                                ),
                                title: bt.name,
                              })
                            }
                            className="relative w-12 h-12 rounded-xl overflow-hidden border border-stone-200/80 shrink-0 cursor-pointer group shadow-2xs"
                            title="คลิกเพื่อขยายดูรูปภาพ"
                          >
                            <img
                              src={resolveMediaUrl(
                                bt.main_image || bt.boat_image,
                              )}
                              alt={bt.name}
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
                            {bt.name}
                          </div>
                          <div className="text-[11px] text-stone-400 truncate max-w-sm font-normal mt-0.5">
                            {bt.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-stone-100 text-stone-700 border border-stone-200/60">
                        <Users size={13} className="text-stone-500" />
                        {bt.capacity} ที่นั่ง
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap font-medium text-stone-700">
                      {bt.quantity} ลำ
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-bold text-[#0b3b2c] text-sm">
                        ฿{Number(bt.price_per_hour || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                          bt.is_active !== false
                            ? "bg-emerald-100/80 text-emerald-800 border border-emerald-200/60"
                            : "bg-stone-100 text-stone-500 border border-stone-200"
                        }`}
                      >
                        {bt.is_active !== false ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditBoat(bt)}
                          className="p-1.5 text-stone-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => confirmDelete(bt.id)}
                          className="p-1.5 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          title="ลบประเภทเรือ"
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

      {/* 🟢 MODAL: Create Boat Type */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-stone-100 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-[#0b3b2c] text-white">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <PlusCircle size={18} className="text-emerald-300" />
                เพิ่มประเภทเรือใหม่
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

            <form
              onSubmit={handleSubmit}
              className="p-6 space-y-4 overflow-y-auto custom-scrollbar"
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    ชื่อประเภทเรือ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น เรือคายัค 2 ที่นั่ง, เรือปั่น VIP"
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    รายละเอียด
                  </label>
                  <textarea
                    placeholder="รายละเอียดอุปกรณ์ ความปลอดภัย และคำแนะนำเพิ่มเติม..."
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs resize-none"
                    rows={2}
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* ที่นั่ง (คน) */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      ที่นั่ง (คน) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center border border-stone-200 bg-stone-50 rounded-xl overflow-hidden shadow-2xs focus-within:ring-2 focus-within:ring-[#0b3b2c]/20 focus-within:border-[#0b3b2c]">
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            capacity: Math.max(1, (form.capacity || 1) - 1),
                          })
                        }
                        className="px-2.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        required
                        min="1"
                        className="w-full text-center bg-transparent text-xs font-medium text-stone-800 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={form.capacity === 0 ? "" : form.capacity}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            capacity:
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value),
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            capacity: (form.capacity || 0) + 1,
                          })
                        }
                        className="px-2.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>

                  {/* ราคา (บาท) */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      ราคา (บาท) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                      value={
                        form.price_per_hour === 0 ? "" : form.price_per_hour
                      }
                      onChange={(e) =>
                        setForm({
                          ...form,
                          price_per_hour:
                            e.target.value === "" ? 0 : Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  {/* จำนวน (ลำ) */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      จำนวน (ลำ) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center border border-stone-200 bg-stone-50 rounded-xl overflow-hidden shadow-2xs focus-within:ring-2 focus-within:ring-[#0b3b2c]/20 focus-within:border-[#0b3b2c]">
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            quantity: Math.max(1, (form.quantity || 1) - 1),
                          })
                        }
                        className="px-2.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                      >
                        <Minus size={13} />
                      </button>
                      <input
                        type="number"
                        required
                        min="1"
                        className="w-full text-center bg-transparent text-xs font-medium text-stone-800 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={form.quantity === 0 ? "" : form.quantity}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            quantity:
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value),
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            quantity: (form.quantity || 0) + 1,
                          })
                        }
                        className="px-2.5 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Drag & Drop Cover Image Upload */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    รูปภาพเรือหลัก
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
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        JPG, PNG, WEBP (ไม่เกิน 5MB)
                      </p>
                      <input
                        type="file"
                        accept="image/*"
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
                              className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-700"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {galleryPreviews.length < MAX_GALLERY_COUNT && (
                      <label className="flex items-center justify-center gap-2 p-2.5 border border-dashed border-stone-300 hover:border-[#0b3b2c] rounded-xl cursor-pointer text-xs font-medium text-stone-600 hover:text-[#0b3b2c] hover:bg-[#0b3b2c]/5 transition-all">
                        <Plus size={14} />
                        <span>เพิ่มรูป Gallery</span>
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
              </div>

              {/* Submit / Cancel / Active Status Bar */}
              <div className="pt-4 border-t border-stone-100 flex items-center justify-between gap-2">
                <label
                  htmlFor="create_is_active"
                  className="flex items-center gap-2 cursor-pointer select-none group"
                >
                  <input
                    type="checkbox"
                    id="create_is_active"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm({ ...form, is_active: e.target.checked })
                    }
                    className="w-4 h-4 text-[#0b3b2c] rounded border-stone-300 focus:ring-[#0b3b2c] accent-[#0b3b2c] cursor-pointer"
                  />
                  <span className="text-xs font-bold text-stone-700 group-hover:text-[#0b3b2c] transition-colors">
                    เปิดใช้งาน
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      resetCreateForm();
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-[#0b3b2c] hover:bg-[#07271d] text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting && (
                      <Loader2 size={14} className="animate-spin" />
                    )}
                    {submitting ? "กำลังบันทึก..." : "บันทึกประเภทเรือ"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🟡 MODAL: Edit Boat Type */}
      {showEditModal && editingBoat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-stone-200/80 flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="px-5 py-3 border-b border-stone-100 flex items-center justify-between bg-[#0b3b2c] text-white">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/20 text-amber-300 rounded-lg border border-amber-500/30">
                  <Edit3 size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight text-white">
                    แก้ไขประเภทเรือ
                  </h3>
                  <p className="text-[10px] text-stone-300 font-normal">
                    อัปเดตรายละเอียด สเปกเรือ และรูปภาพตัวอย่าง
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="p-1 text-stone-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={handleUpdateBoat}
              className="p-4 space-y-3 overflow-y-auto custom-scrollbar bg-stone-50/30 text-xs"
            >
              {/* ส่วนที่ 1: ข้อมูลทั่วไป */}
              <div className="bg-white p-3 rounded-xl border border-stone-200/70 shadow-2xs space-y-2.5">
                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    ชื่อประเภทเรือ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น เรือคายัค 2 ที่นั่ง"
                    className="w-full px-3 py-2 bg-stone-50/50 border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                    value={editingBoat.name}
                    onChange={(e) =>
                      setEditingBoat({ ...editingBoat, name: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-800 mb-1">
                    คำอธิบาย / รายละเอียด
                  </label>
                  <textarea
                    placeholder="เพิ่มรายละเอียดเรือเพื่อแจ้งให้ผู้ใช้ทราบ..."
                    className="w-full px-3 py-2 bg-stone-50/50 border border-stone-200 rounded-lg text-xs font-medium text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs resize-none"
                    rows={2}
                    value={editingBoat.description}
                    onChange={(e) =>
                      setEditingBoat({
                        ...editingBoat,
                        description: e.target.value,
                      })
                    }
                  />
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {/* ที่นั่ง (คน) */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      ที่นั่ง (คน)
                    </label>
                    <div className="flex items-center border border-stone-200 bg-stone-50/50 rounded-lg overflow-hidden focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0b3b2c]/20 focus-within:border-[#0b3b2c]">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingBoat({
                            ...editingBoat,
                            capacity: Math.max(
                              1,
                              (editingBoat.capacity || 1) - 1,
                            ),
                          })
                        }
                        className="px-2 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        required
                        min="1"
                        className="w-full text-center bg-transparent text-xs font-bold text-stone-800 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={
                          editingBoat.capacity === 0 ? "" : editingBoat.capacity
                        }
                        onChange={(e) =>
                          setEditingBoat({
                            ...editingBoat,
                            capacity:
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value),
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setEditingBoat({
                            ...editingBoat,
                            capacity: (editingBoat.capacity || 0) + 1,
                          })
                        }
                        className="px-2 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>

                  {/* ราคา(บาท) */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      ราคา (บาท)
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      className="w-full px-2.5 py-1.5 bg-stone-50/50 border border-stone-200 rounded-lg text-xs font-bold text-[#0b3b2c] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all"
                      value={
                        editingBoat.price_per_hour === 0
                          ? ""
                          : editingBoat.price_per_hour
                      }
                      onChange={(e) =>
                        setEditingBoat({
                          ...editingBoat,
                          price_per_hour:
                            e.target.value === "" ? 0 : Number(e.target.value),
                        })
                      }
                    />
                  </div>

                  {/* จำนวนเรือ (ลำ) */}
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1">
                      จำนวนเรือ (ลำ)
                    </label>
                    <div className="flex items-center border border-stone-200 bg-stone-50/50 rounded-lg overflow-hidden focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0b3b2c]/20 focus-within:border-[#0b3b2c]">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingBoat({
                            ...editingBoat,
                            quantity: Math.max(
                              1,
                              (editingBoat.quantity || 1) - 1,
                            ),
                          })
                        }
                        className="px-2 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                      >
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        required
                        min="1"
                        className="w-full text-center bg-transparent text-xs font-bold text-stone-800 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={
                          editingBoat.quantity === 0 ? "" : editingBoat.quantity
                        }
                        onChange={(e) =>
                          setEditingBoat({
                            ...editingBoat,
                            quantity:
                              e.target.value === ""
                                ? 0
                                : Number(e.target.value),
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setEditingBoat({
                            ...editingBoat,
                            quantity: (editingBoat.quantity || 0) + 1,
                          })
                        }
                        className="px-2 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ส่วนที่ 2: จัดการรูปภาพ */}
              <div className="bg-white p-3 rounded-xl border border-stone-200/70 shadow-2xs space-y-3">
                <div>
                  <label className="block font-bold text-stone-800 mb-1.5">
                    รูปภาพเรือหลัก (Cover Image)
                  </label>
                  <div className="flex items-center gap-3">
                    <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-stone-200 shrink-0 bg-stone-100 shadow-2xs group">
                      {editCoverPreview || editingBoat?.boat_image ? (
                        <img
                          src={
                            editCoverPreview ||
                            resolveMediaUrl(editingBoat.boat_image)
                          }
                          alt="Cover Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-stone-100 text-stone-400 text-[11px] font-medium">
                          ไม่มีรูปภาพ
                        </div>
                      )}
                    </div>

                    <div className="flex-1 space-y-1">
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200/80 text-stone-700 rounded-lg font-bold cursor-pointer transition-colors border border-stone-200/80 active:scale-98">
                        <UploadCloud size={14} className="text-stone-500" />
                        <span>เปลี่ยนรูปภาพหลัก</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleEditCoverChange}
                        />
                      </label>
                      <p className="text-[10px] text-stone-400">
                        รองรับไฟล์ JPG, PNG, WEBP (ไม่เกิน 5MB)
                      </p>
                    </div>
                  </div>
                </div>

                <hr className="border-stone-100" />

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block font-bold text-stone-800">
                      รูปภาพเพิ่มเติม (Gallery)
                    </label>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-stone-100 rounded-full text-stone-500">
                      {(editingBoat.existing_gallery?.length || 0) +
                        editGalleryFiles.length}
                      /{MAX_GALLERY_COUNT} รูป
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {editingBoat.existing_gallery?.map(
                      (imgUrl: string, idx: number) => (
                        <div
                          key={`exist-${idx}`}
                          className="relative h-14 rounded-lg overflow-hidden border border-stone-200 group bg-stone-100 shadow-2xs"
                        >
                          <img
                            src={resolveMediaUrl(imgUrl)}
                            alt={`Existing ${idx}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBoat({
                                  ...editingBoat,
                                  existing_gallery:
                                    editingBoat.existing_gallery.filter(
                                      (_: any, i: number) => i !== idx,
                                    ),
                                });
                              }}
                              className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded shadow-sm transition-transform active:scale-90 cursor-pointer"
                              title="ลบรูปนี้"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ),
                    )}

                    {editGalleryPreviews.map((url, idx) => (
                      <div
                        key={`new-${idx}`}
                        className="relative h-14 rounded-lg overflow-hidden border-2 border-amber-500 group bg-stone-100 shadow-2xs"
                      >
                        <img
                          src={url}
                          alt={`New preview ${idx}`}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-0.5 left-0.5 px-1 bg-amber-500 text-white rounded text-[8px] font-bold shadow-xs">
                          ใหม่
                        </span>
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button
                            type="button"
                            onClick={() => removeEditGalleryFile(idx)}
                            className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded shadow-sm transition-transform active:scale-90 cursor-pointer"
                            title="ยกเลิกรูปนี้"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {(editingBoat.existing_gallery?.length || 0) +
                    editGalleryFiles.length <
                    MAX_GALLERY_COUNT && (
                    <label className="flex items-center justify-center gap-1.5 p-2 border border-dashed border-stone-300 hover:border-[#0b3b2c] bg-stone-50/50 hover:bg-[#0b3b2c]/5 rounded-lg cursor-pointer font-bold text-stone-600 hover:text-[#0b3b2c] transition-all">
                      <Plus size={14} />
                      <span>เพิ่มรูป Gallery ใหม่</span>
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
              </div>

              {/* Submit / Cancel / Active Status Bar */}
              <div className="pt-2 flex items-center justify-between gap-2">
                <label
                  htmlFor="edit_is_active"
                  className="flex items-center gap-2 cursor-pointer select-none group"
                >
                  <input
                    type="checkbox"
                    id="edit_is_active"
                    checked={editingBoat.is_active}
                    onChange={(e) =>
                      setEditingBoat({
                        ...editingBoat,
                        is_active: e.target.checked,
                      })
                    }
                    className="w-4 h-4 text-[#0b3b2c] rounded border-stone-300 focus:ring-[#0b3b2c] accent-[#0b3b2c] cursor-pointer"
                  />
                  <span className="font-bold text-stone-700 group-hover:text-[#0b3b2c] transition-colors">
                    เปิดใช้งาน
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-3.5 py-2 rounded-xl font-bold text-stone-600 hover:bg-stone-200/60 transition-colors cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="submit"
                    disabled={editUploading}
                    className="px-4 py-2 bg-[#0b3b2c] hover:bg-[#07271d] text-white rounded-xl font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-98"
                  >
                    {editUploading ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>กำลังบันทึก...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={14} />
                        <span>บันทึกการเปลี่ยนแปลง</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🔴 MODAL: Confirm Delete */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl border border-stone-100 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                ยืนยันการลบประเภทเรือ
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?
                การดำเนินการนี้ไม่สามารถยกเลิกได้
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors w-full cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors w-full cursor-pointer"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔍 MODAL: Lightbox Viewer */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden bg-stone-900 border border-stone-800 shadow-2xl flex flex-col"
          >
            <div className="p-3 bg-stone-900/90 text-white flex items-center justify-between border-b border-stone-800">
              <span className="text-xs font-bold px-2">
                {lightboxImage.title}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center bg-black">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[75vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
