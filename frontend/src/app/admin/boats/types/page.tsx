"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  Plus,
  Minus,
  Edit3,
  Trash2,
  X,
  Search,
  Image as ImageIcon,
  Users,
  UploadCloud,
  Loader2,
  Eye,
  Anchor,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  AlertTriangle,
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatar";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { Modal, EmptyState } from "@/components/admin/ui";

// Constants & Validation Rules
const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_GALLERY_COUNT = 5;
const ITEMS_PER_PAGE = 10;

export default function BoatTypesPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { ready } = useAuthGuard({ allowedRoles: ["admin", "boat_staff"] });
  const [boatTypes, setBoatTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Search & Pagination filter
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Clean up Object URLs to prevent memory leaks
  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      galleryPreviews.forEach((url) => URL.revokeObjectURL(url));
      if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
      editGalleryPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [coverPreview, galleryPreviews, editCoverPreview, editGalleryPreviews]);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await api.get("/kayaks/admin/types");
      setBoatTypes(res.data?.data || []);
    } catch {
      notify.error("ไม่สามารถโหลดข้อมูลเรือได้");
    } finally {
      setLoading(false);
    }
  }

  // Helper Validation
  const validateFile = (file: File) => {
    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      notify.error(`ไฟล์ ${file.name} ต้องเป็น JPG, PNG หรือ WEBP เท่านั้น`);
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      notify.error(`ไฟล์ ${file.name} มีขนาดเกิน 5MB`);
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
      notify.error(
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

      notify.success("สร้างประเภทเรือสำเร็จ");

      resetCreateForm();
      setShowCreateModal(false);
      fetchData();
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "สร้างประเภทเรือไม่สำเร็จ"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (boat: any) => {
    const boatId = boat.id || boat.boat_type_id;
    const currentStatus = boat.is_active !== false;
    try {
      await api.put(`/kayaks/${boatId}`, {
        name: boat.name || boat.type_name,
        is_active: !currentStatus,
      });
      notify.success(
        `เปลี่ยนสถานะเป็น ${!currentStatus ? "เปิดใช้งาน" : "ปิดใช้งาน"} เรียบร้อย`,
      );
      fetchData();
    } catch {
      notify.error("เปลี่ยนสถานะไม่สำเร็จ");
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteTargetId(id);
  };

  const handleDelete = async () => {
    if (!deleteTargetId) return;
    try {
      await api.delete(`/kayaks/${deleteTargetId}`);
      notify.success("ลบประเภทเรือสำเร็จ");
      fetchData();
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "ลบไม่สำเร็จ"));
    } finally {
      setDeleteTargetId(null);
    }
  };

  const openEditBoat = (bt: any) => {
    const mainImg = bt.boat_image || bt.main_image || bt.image || "";
    const rawGallery = Array.isArray(bt.gallery_images)
      ? bt.gallery_images
      : Array.isArray(bt.images)
      ? bt.images
      : [];

    setEditingBoat({
      id: bt.id || bt.boat_type_id,
      name: bt.name || bt.type_name,
      description: bt.description || "",
      capacity: bt.capacity || bt.seat_count,
      price_per_hour: bt.price_per_hour || bt.price,
      quantity: bt.quantity,
      is_active: bt.is_active !== false,
      boat_image: mainImg,
      existing_gallery: rawGallery.filter((img: string) => img && img !== mainImg),
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
      notify.error(
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
      notify.success("แก้ไขประเภทเรือสำเร็จ");

      if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
      editGalleryPreviews.forEach((url) => URL.revokeObjectURL(url));

      setShowEditModal(false);
      setEditingBoat(null);
      setEditCoverFile(null);
      setEditCoverPreview(null);
      setEditGalleryFiles([]);
      setEditGalleryPreviews([]);
      fetchData();
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "แก้ไขไม่สำเร็จ"));
    } finally {
      setEditUploading(false);
    }
  };

  const filteredBoatTypes = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();
    return boatTypes.filter((bt) => {
      const name = bt.name || bt.type_name || "";
      const description = bt.description || "";
      return (
        !searchQuery ||
        name.toLowerCase().includes(searchLower) ||
        description.toLowerCase().includes(searchLower)
      );
    });
  }, [boatTypes, searchQuery]);

  const totalPages = Math.ceil(filteredBoatTypes.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredBoatTypes.length);

  const paginatedBoatTypes = useMemo(() => {
    return filteredBoatTypes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredBoatTypes, startIndex]);

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-900/10 shrink-0">
            <Anchor size={24} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold text-forest-900 leading-tight">
              จัดการประเภทเรือ
            </h1>
            <p className="text-xs sm:text-sm text-charcoal-500 mt-1">
              กำหนดประเภทเรือคายัค อัตราค่าบริการ จำนวนที่นั่ง และจำนวนลำที่พร้อมให้บริการ
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-forest-800 hover:bg-forest-900 text-white rounded-2xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <Plus size={16} />
            เพิ่มประเภทเรือ
          </button>

          <div className="px-4 py-2.5 bg-cream-50/80 rounded-2xl border border-cream-300 shadow-2xs flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-forest-100 flex items-center justify-center text-forest-800">
              <Anchor size={18} />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-charcoal-400 block leading-tight">
                ประเภทเรือทั้งหมด
              </span>
              <span className="text-xs font-bold text-forest-900 font-mono">
                {boatTypes.length} รายการ
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Table List Section */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/90 overflow-hidden flex flex-col min-h-[600px]">
        {/* Header & Search */}
        <div className="pb-4 mb-4 border-b border-cream-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-forest-800" />
            <h2 className="text-base font-bold text-forest-900">
              รายการประเภทเรือทั้งหมด
            </h2>
            <span className="px-2.5 py-0.5 bg-forest-50 text-forest-800 border border-forest-200 rounded-full text-xs font-bold font-mono">
              {filteredBoatTypes.length} รายการ
            </span>
          </div>

          <div className="relative w-full sm:w-80">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400"
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อประเภทเรือ หรือคำอธิบาย..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-cream-50/70 border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-600 text-xs p-0.5 rounded-full hover:bg-cream-200"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Table Area */}
        <div className="overflow-x-auto border border-cream-200/90 rounded-2xl shadow-2xs">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead className="bg-cream-50/80 border-b border-cream-200 text-xs font-bold text-charcoal-600 uppercase tracking-wider select-none shadow-2xs">
              <tr>
                <th className="px-5 py-3.5">ชื่อประเภทเรือ</th>
                <th className="px-4 py-3.5">ที่นั่ง</th>
                <th className="px-4 py-3.5">จำนวนที่มี</th>
                <th className="px-4 py-3.5">ราคา / ชั่วโมง</th>
                <th className="px-4 py-3.5">สถานะ</th>
                <th className="px-4 py-3.5 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100 bg-white text-xs text-charcoal-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-charcoal-400">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-forest-800 border-t-transparent mb-3" />
                    <p className="text-xs font-medium text-charcoal-500">
                      กำลังโหลดข้อมูลเรือ...
                    </p>
                  </td>
                </tr>
              ) : filteredBoatTypes.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-0">
                    <EmptyState
                      title="ไม่พบประเภทเรือ"
                      description="ลองเปลี่ยนคำค้นหา หรือกดเพิ่มประเภทเรือใหม่"
                    />
                  </td>
                </tr>
              ) : (
                paginatedBoatTypes.map((bt: any) => {
                  const coverImg = bt.boat_image || bt.main_image || bt.image;
                  const boatName = bt.name || bt.type_name;
                  const boatId = bt.id || bt.boat_type_id;
                  const capacity = bt.capacity || bt.seat_count;
                  const price = bt.price_per_hour || bt.price;
                  const isActive = bt.is_active !== false;

                  return (
                    <tr
                      key={boatId}
                      className="hover:bg-cream-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {coverImg ? (
                            <div
                              onClick={() =>
                                setLightboxImage({
                                  url: resolveMediaUrl(coverImg),
                                  title: boatName,
                                })
                              }
                              className="relative w-12 h-12 rounded-2xl overflow-hidden border border-cream-200/90 shrink-0 cursor-pointer group shadow-2xs"
                              title="คลิกเพื่อขยายดูรูปภาพ"
                            >
                              <img
                                src={resolveMediaUrl(coverImg)}
                                alt={boatName}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                <Eye size={14} />
                              </div>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-2xl bg-cream-100 border border-cream-200 flex items-center justify-center shrink-0 text-charcoal-400">
                              <ImageIcon size={18} />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-charcoal-900 text-sm truncate">
                              {boatName}
                            </div>
                            <div className="text-xs text-charcoal-400 truncate max-w-sm font-normal mt-0.5">
                              {bt.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-cream-100 text-charcoal-700 border border-cream-200">
                          <Users size={13} className="text-charcoal-500" />
                          {capacity} ที่นั่ง
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-forest-50 text-forest-800 border border-forest-200/70">
                          <Anchor size={13} />
                          <span>{bt.quantity} ลำ</span>
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="font-bold text-forest-900 text-sm">
                          ฿{Number(price || 0).toLocaleString()}
                        </span>
                        <span className="text-xs text-charcoal-400 font-normal ml-1">
                          / ชม.
                        </span>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(bt)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                            isActive
                              ? "bg-forest-50 text-forest-800 border-forest-200 hover:bg-forest-100"
                              : "bg-cream-200 text-charcoal-600 border-cream-300 hover:bg-cream-300"
                          }`}
                          title="คลิกเพื่อเปิด/ปิดการใช้งาน"
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? "bg-forest-600" : "bg-charcoal-400"
                            }`}
                          />
                          {isActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditBoat(bt)}
                            className="p-1.5 text-charcoal-500 hover:text-amber-800 hover:bg-amber-50/80 rounded-xl transition-all cursor-pointer"
                            title="แก้ไขข้อมูล"
                          >
                            <Edit3 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => confirmDelete(boatId)}
                            className="p-1.5 text-charcoal-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                            title="ลบประเภทเรือ"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {filteredBoatTypes.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-auto border-t border-cream-200 text-xs text-charcoal-500">
            <span>
              แสดง{" "}
              <strong className="text-forest-950 font-mono">
                {filteredBoatTypes.length > 0 ? startIndex + 1 : 0}
              </strong>{" "}
              ถึง{" "}
              <strong className="text-forest-950 font-mono">{endIndex}</strong> จาก{" "}
              <strong className="text-forest-950 font-mono">{filteredBoatTypes.length}</strong> รายการ
            </span>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(1)}
                className="p-1.5 bg-white border border-cream-300 rounded-xl text-charcoal-600 hover:bg-cream-100 disabled:opacity-40 transition-all cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                title="หน้าแรก"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                className="p-1.5 bg-white border border-cream-300 rounded-xl text-charcoal-600 hover:bg-cream-100 disabled:opacity-40 transition-all cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                title="หน้าก่อนหน้า"
              >
                <ChevronLeft size={14} />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | string)[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                    acc.push("...");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, idx) =>
                  typeof p === "number" ? (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCurrentPage(p)}
                      className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer ${
                        currentPage === p
                          ? "bg-forest-800 text-white shadow-xs"
                          : "bg-white text-charcoal-600 border border-cream-300 hover:bg-cream-100 shadow-2xs"
                      }`}
                    >
                      {p}
                    </button>
                  ) : (
                    <span key={idx} className="px-1 text-charcoal-400">
                      ...
                    </span>
                  ),
                )}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                className="p-1.5 bg-white border border-cream-300 rounded-xl text-charcoal-600 hover:bg-cream-100 disabled:opacity-40 transition-all cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                title="หน้าถัดไป"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(totalPages)}
                className="p-1.5 bg-white border border-cream-300 rounded-xl text-charcoal-600 hover:bg-cream-100 disabled:opacity-40 transition-all cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                title="หน้าสุดท้าย"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: Create Boat Type */}
      <Modal
        open={showCreateModal}
        title="เพิ่มประเภทเรือใหม่"
        onClose={() => {
          setShowCreateModal(false);
          resetCreateForm();
        }}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-charcoal-700 mb-1">
                ชื่อประเภทเรือ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="เช่น เรือคายัค 2 ที่นั่ง, เรือปั่น VIP"
                className="w-full px-3.5 py-2.5 bg-cream-50/60 border border-cream-300 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 focus:bg-white transition-all shadow-2xs"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-700 mb-1">
                รายละเอียด
              </label>
              <textarea
                placeholder="รายละเอียดอุปกรณ์ ความปลอดภัย และคำแนะนำเพิ่มเติม..."
                className="w-full px-3.5 py-2.5 bg-cream-50/60 border border-cream-300 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 focus:bg-white transition-all shadow-2xs resize-none"
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
                <label className="block text-xs font-bold text-charcoal-700 mb-1">
                  ที่นั่ง (คน) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center border border-cream-300 bg-cream-50/60 rounded-xl overflow-hidden shadow-2xs focus-within:ring-2 focus-within:ring-forest-800/20 focus-within:border-forest-800 focus-within:bg-white">
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        capacity: Math.max(1, (form.capacity || 1) - 1),
                      })
                    }
                    className="px-2.5 py-2.5 bg-cream-100 hover:bg-cream-200 text-charcoal-600 transition-colors cursor-pointer"
                  >
                    <Minus size={13} />
                  </button>
                  <input
                    type="number"
                    required
                    min="1"
                    className="w-full text-center bg-transparent text-xs font-bold text-charcoal-800 focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                    className="px-2.5 py-2.5 bg-cream-100 hover:bg-cream-200 text-charcoal-600 transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* ราคา (บาท) */}
              <div>
                <label className="block text-xs font-bold text-charcoal-700 mb-1">
                  ราคา (บาท) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full px-3.5 py-2.5 bg-cream-50/60 border border-cream-300 rounded-xl text-xs font-bold text-forest-900 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 focus:bg-white transition-all shadow-2xs"
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
                <label className="block text-xs font-bold text-charcoal-700 mb-1">
                  จำนวน (ลำ) <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center border border-cream-300 bg-cream-50/60 rounded-xl overflow-hidden shadow-2xs focus-within:ring-2 focus-within:ring-forest-800/20 focus-within:border-forest-800 focus-within:bg-white">
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        quantity: Math.max(1, (form.quantity || 1) - 1),
                      })
                    }
                    className="px-2.5 py-2.5 bg-cream-100 hover:bg-cream-200 text-charcoal-600 transition-colors cursor-pointer"
                  >
                    <Minus size={13} />
                  </button>
                  <input
                    type="number"
                    required
                    min="1"
                    className="w-full text-center bg-transparent text-xs font-bold text-charcoal-800 focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                    className="px-2.5 py-2.5 bg-cream-100 hover:bg-cream-200 text-charcoal-600 transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Drag & Drop Cover Image Upload */}
            <div>
              <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                รูปภาพเรือหลัก
              </label>

              {coverPreview ? (
                <div className="relative w-full h-36 rounded-2xl overflow-hidden border-2 border-forest-800 shadow-xs group">
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
                      className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md transition-transform active:scale-95 cursor-pointer"
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
                  className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-2xl transition-all cursor-pointer group p-3 text-center ${
                    isDraggingCover
                      ? "border-forest-800 bg-forest-50/60 scale-[1.01]"
                      : "border-cream-300 hover:border-forest-700 bg-cream-50/50 hover:bg-forest-50/30"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-cream-200/80 group-hover:bg-forest-100 text-charcoal-500 group-hover:text-forest-800 flex items-center justify-center transition-colors mb-1.5">
                    <UploadCloud size={18} />
                  </div>
                  <p className="text-xs font-bold text-charcoal-700 group-hover:text-forest-800 transition-colors">
                    คลิก หรือลากไฟล์มาวางเพื่ออัปโหลด
                  </p>
                  <p className="text-xs text-charcoal-400 mt-0.5">
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
                <label className="block text-xs font-bold text-charcoal-700">
                  รูปภาพเพิ่มเติม (Gallery)
                </label>
                <span className="text-xs font-semibold text-charcoal-400 font-mono">
                  {galleryPreviews.length}/{MAX_GALLERY_COUNT} รูป
                </span>
              </div>

              <div className="space-y-2">
                {galleryPreviews.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {galleryPreviews.map((url, idx) => (
                      <div
                        key={idx}
                        className="relative h-16 rounded-xl overflow-hidden border border-cream-200 shadow-2xs group"
                      >
                        <img
                          src={url}
                          alt={`Gallery ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeGalleryFile(idx)}
                          className="absolute top-1 right-1 p-1 bg-rose-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-700 cursor-pointer shadow-xs"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {galleryPreviews.length < MAX_GALLERY_COUNT && (
                  <label className="flex items-center justify-center gap-2 p-2.5 border border-dashed border-cream-300 hover:border-forest-800 bg-cream-50/50 hover:bg-forest-50/30 rounded-xl cursor-pointer text-xs font-medium text-charcoal-600 hover:text-forest-800 transition-all">
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
          <div className="pt-4 border-t border-cream-200/80 flex items-center justify-between gap-2">
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
                className="w-4 h-4 text-forest-800 rounded border-cream-300 focus:ring-forest-800 accent-forest-800 cursor-pointer"
              />
              <span className="text-xs font-bold text-charcoal-700 group-hover:text-forest-800 transition-colors">
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
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-charcoal-600 hover:bg-cream-100 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2.5 bg-forest-800 hover:bg-forest-900 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-98"
              >
                {submitting && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                {submitting ? "กำลังบันทึก..." : "บันทึกประเภทเรือ"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* MODAL: Edit Boat Type */}
      <Modal
        open={showEditModal && !!editingBoat}
        title="แก้ไขประเภทเรือ"
        onClose={() => setShowEditModal(false)}
      >
        <form
          onSubmit={handleUpdateBoat}
          className="space-y-3.5 text-xs"
        >
          {/* ส่วนที่ 1: ข้อมูลทั่วไป */}
          <div className="bg-cream-50/40 p-3.5 rounded-2xl border border-cream-200/90 shadow-2xs space-y-2.5">
            <div>
              <label className="block font-bold text-charcoal-800 mb-1">
                ชื่อประเภทเรือ <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="เช่น เรือ 2 ที่นั่ง"
                className="w-full px-3 py-2 bg-white border border-cream-300 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
                value={editingBoat?.name || ""}
                onChange={(e) =>
                  setEditingBoat({ ...editingBoat, name: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block font-bold text-charcoal-800 mb-1">
                คำอธิบาย / รายละเอียด
              </label>
              <textarea
                placeholder="เพิ่มรายละเอียดเรือเพื่อแจ้งให้ผู้ใช้ทราบ..."
                className="w-full px-3 py-2 bg-white border border-cream-300 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs resize-none"
                rows={2}
                value={editingBoat?.description || ""}
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
                <label className="block text-xs font-bold text-charcoal-700 mb-1">
                  ที่นั่ง (คน)
                </label>
                <div className="flex items-center border border-cream-300 bg-white rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-forest-800/20 focus-within:border-forest-800 shadow-2xs">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingBoat({
                        ...editingBoat,
                        capacity: Math.max(
                          1,
                          (editingBoat?.capacity || 1) - 1,
                        ),
                      })
                    }
                    className="px-2 py-1.5 bg-cream-100 hover:bg-cream-200 text-charcoal-600 transition-colors cursor-pointer"
                  >
                    <Minus size={12} />
                  </button>
                  <input
                    type="number"
                    required
                    min="1"
                    className="w-full text-center bg-transparent text-xs font-bold text-charcoal-800 focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={
                      editingBoat?.capacity === 0 ? "" : editingBoat?.capacity || ""
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
                        capacity: (editingBoat?.capacity || 0) + 1,
                      })
                    }
                    className="px-2 py-1.5 bg-cream-100 hover:bg-cream-200 text-charcoal-600 transition-colors cursor-pointer"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>

              {/* ราคา(บาท) */}
              <div>
                <label className="block text-xs font-bold text-charcoal-700 mb-1">
                  ราคา (บาท)
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full px-2.5 py-1.5 bg-white border border-cream-300 rounded-xl text-xs font-bold text-forest-900 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
                  value={
                    editingBoat?.price_per_hour === 0
                      ? ""
                      : editingBoat?.price_per_hour || ""
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
                <label className="block text-xs font-bold text-charcoal-700 mb-1">
                  จำนวนเรือ (ลำ)
                </label>
                <div className="flex items-center border border-cream-300 bg-white rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-forest-800/20 focus-within:border-forest-800 shadow-2xs">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingBoat({
                        ...editingBoat,
                        quantity: Math.max(
                          1,
                          (editingBoat?.quantity || 1) - 1,
                        ),
                      })
                    }
                    className="px-2 py-1.5 bg-cream-100 hover:bg-cream-200 text-charcoal-600 transition-colors cursor-pointer"
                  >
                    <Minus size={12} />
                  </button>
                  <input
                    type="number"
                    required
                    min="1"
                    className="w-full text-center bg-transparent text-xs font-bold text-charcoal-800 focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    value={
                      editingBoat?.quantity === 0 ? "" : editingBoat?.quantity || ""
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
                        quantity: (editingBoat?.quantity || 0) + 1,
                      })
                    }
                    className="px-2 py-1.5 bg-cream-100 hover:bg-cream-200 text-charcoal-600 transition-colors cursor-pointer"
                  >
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ส่วนที่ 2: จัดการรูปภาพ */}
          <div className="bg-cream-50/40 p-3.5 rounded-2xl border border-cream-200/90 shadow-2xs space-y-3">
            <div>
              <label className="block font-bold text-charcoal-800 mb-1.5">
                รูปภาพเรือหลัก (Cover Image)
              </label>
              <div className="flex items-center gap-3">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-cream-200 shrink-0 bg-cream-100 shadow-2xs group">
                  {editCoverPreview || editingBoat?.boat_image ? (
                    <img
                      src={
                        editCoverPreview ||
                        resolveMediaUrl(editingBoat?.boat_image)
                      }
                      alt="Cover Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-cream-100 text-charcoal-400 text-xs font-medium">
                      ไม่มีรูปภาพ
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-1">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-cream-100 hover:bg-cream-200 text-charcoal-700 rounded-xl font-bold cursor-pointer transition-colors border border-cream-200 active:scale-98">
                    <UploadCloud size={14} className="text-charcoal-500" />
                    <span>เปลี่ยนรูปภาพหลัก</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleEditCoverChange}
                    />
                  </label>
                  <p className="text-xs text-charcoal-400">
                    รองรับไฟล์ JPG, PNG, WEBP (ไม่เกิน 5MB)
                  </p>
                </div>
              </div>
            </div>

            <hr className="border-cream-200/80" />

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block font-bold text-charcoal-800">
                  รูปภาพเพิ่มเติม (Gallery)
                </label>
                <span className="text-xs font-bold px-2 py-0.5 bg-cream-100 rounded-full text-charcoal-500 font-mono">
                  {(editingBoat?.existing_gallery?.length || 0) +
                    editGalleryFiles.length}
                  /{MAX_GALLERY_COUNT} รูป
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2 mb-2">
                {editingBoat?.existing_gallery?.map(
                  (imgUrl: string, idx: number) => (
                    <div
                      key={`exist-${idx}`}
                      className="relative h-14 rounded-xl overflow-hidden border border-cream-200 group bg-cream-100 shadow-2xs"
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
                                editingBoat?.existing_gallery.filter(
                                  (_: any, i: number) => i !== idx,
                                ),
                            });
                          }}
                          className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition-transform active:scale-90 cursor-pointer"
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
                    className="relative h-14 rounded-xl overflow-hidden border-2 border-forest-600 group bg-cream-100 shadow-2xs"
                  >
                    <img
                      src={url}
                      alt={`New preview ${idx}`}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-0.5 left-0.5 px-1 bg-forest-700 text-white rounded text-[10px] font-bold shadow-xs">
                      ใหม่
                    </span>
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => removeEditGalleryFile(idx)}
                        className="p-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-xs transition-transform active:scale-90 cursor-pointer"
                        title="ยกเลิกรูปนี้"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {(editingBoat?.existing_gallery?.length || 0) +
                editGalleryFiles.length <
                MAX_GALLERY_COUNT && (
                <label className="flex items-center justify-center gap-1.5 p-2 border border-dashed border-cream-300 hover:border-forest-800 bg-white hover:bg-forest-50/30 rounded-xl cursor-pointer font-bold text-charcoal-600 hover:text-forest-800 transition-all">
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
                checked={editingBoat?.is_active || false}
                onChange={(e) =>
                  setEditingBoat({
                    ...editingBoat,
                    is_active: e.target.checked,
                  })
                }
                className="w-4 h-4 text-forest-800 rounded border-cream-300 focus:ring-forest-800 accent-forest-800 cursor-pointer"
              />
              <span className="font-bold text-charcoal-700 group-hover:text-forest-800 transition-colors">
                เปิดใช้งาน
              </span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-3.5 py-2 rounded-xl font-bold text-charcoal-600 hover:bg-cream-100 transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={editUploading}
                className="px-4 py-2 bg-forest-800 hover:bg-forest-900 text-white rounded-xl font-bold shadow-xs hover:shadow transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer active:scale-98"
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
      </Modal>

      {/* MODAL: Confirm Delete */}
      <Modal
        open={!!deleteTargetId}
        title="ยืนยันการลบประเภทเรือ"
        onClose={() => setDeleteTargetId(null)}
        widthClass="max-w-sm"
      >
        <div className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <AlertTriangle size={24} />
          </div>
          <p className="text-xs text-charcoal-500 mt-1">
            คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?
            การดำเนินการนี้ไม่สามารถยกเลิกได้
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeleteTargetId(null)}
              className="px-4 py-2.5 bg-cream-100 hover:bg-cream-200 text-charcoal-700 rounded-xl text-xs font-bold transition-colors w-full cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors w-full cursor-pointer"
            >
              ยืนยันการลบ
            </button>
          </div>
        </div>
      </Modal>

      {/* MODAL: Lightbox Viewer */}
      <Modal
        open={!!lightboxImage}
        title={lightboxImage?.title || ""}
        onClose={() => setLightboxImage(null)}
        widthClass="max-w-3xl"
      >
        <div className="flex items-center justify-center p-2">
          <img
            src={lightboxImage?.url}
            alt={lightboxImage?.title}
            className="max-h-[70vh] w-auto object-contain rounded-2xl border border-cream-200 shadow-md"
          />
        </div>
      </Modal>
    </div>
  );
}
