"use client";

import { useState, useEffect, useMemo } from "react";
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
  DoorClosed,
  ArrowRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { Modal, EmptyState } from "@/components/admin/ui";
import api, { getApiErrorMessage } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatar";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import Link from "next/link";

const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_GALLERY_COUNT = 5;

export default function RoomTypesPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ allowedRoles: ["admin", "room_staff"] });
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const [form, setForm] = useState({
    type_name: "",
    description: "",
    capacity: 2,
    price: "",
    room_image: "",
    gallery_images: [] as string[],
    amenities: [] as number[],
  });

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [isDraggingCover, setIsDraggingCover] = useState(false);

  const [editingRoom, setEditingRoom] = useState<any>(null);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [editGalleryFiles, setEditGalleryFiles] = useState<File[]>([]);
  const [editGalleryPreviews, setEditGalleryPreviews] = useState<string[]>([]);
  const [editUploading, setEditUploading] = useState(false);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [isAmenityDropdownOpen, setIsAmenityDropdownOpen] = useState(false);
  const [isEditAmenityDropdownOpen, setIsEditAmenityDropdownOpen] =
    useState(false);

  useEffect(() => {
    if (!ready) return;
    fetchData();
  }, [ready]);

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
      const [rtRes, amRes] = await Promise.all([
        api.get("/rooms?is_admin=true"),
        api.get("/rooms/amenities/all"),
      ]);
      setRoomTypes(rtRes.data?.data || []);
      setAmenities(amRes.data?.data || []);
    } catch {
      notify.error("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  }

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      await api.patch(`/rooms/${id}/status`, { status: !currentStatus });
      notify.success(
        `เปลี่ยนสถานะเป็น ${!currentStatus ? "เปิดใช้งาน" : "ปิดใช้งาน"} เรียบร้อย`,
      );
      fetchData();
    } catch {
      notify.error("เปลี่ยนสถานะไม่สำเร็จ");
    }
  };

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

  const handleSelectAllAmenities = () => {
    if (form.amenities.length === amenities.length) {
      setForm({ ...form, amenities: [] });
    } else {
      setForm({ ...form, amenities: amenities.map((a) => a.id) });
    }
  };

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
      price: "",
      room_image: "",
      gallery_images: [],
      amenities: [],
    });
    setCoverFile(null);
    setCoverPreview(null);
    setGalleryFiles([]);
    setGalleryPreviews([]);
    setIsAmenityDropdownOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!coverFile) {
      notify.error("กรุณาเลือกรูปปกห้องพัก");
      return;
    }

    const numericPrice = Number(form.price);
    if (!form.price || Number.isNaN(numericPrice) || numericPrice <= 0) {
      notify.error("กรุณาระบุราคาห้องพักให้ถูกต้อง");
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
        price: numericPrice,
        room_image: roomImage,
        gallery_images: galleryImages,
      });

      notify.success("สร้างประเภทห้องพักสำเร็จ");
      resetCreateForm();
      setShowCreateModal(false);
      fetchData();
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "สร้างประเภทห้องพักไม่สำเร็จ"));
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
      const res = await api.delete(`/rooms/${deleteTargetId}`);
      notify.success(res.data?.message ?? "ปิดใช้งานประเภทห้องแล้ว");
      fetchData();
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "ปิดใช้งานไม่สำเร็จ"));
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
      status: rt.status,
      amenity_ids: (rt.amenities || []).map((a: any) => a.id),
      existing_gallery: Array.isArray(rt.images)
        ? rt.images.filter((img: string) => img !== rt.main_image)
        : [],
    });
    setEditCoverFile(null);
    setEditCoverPreview(null);
    setEditGalleryFiles([]);
    setEditGalleryPreviews([]);
    setIsEditAmenityDropdownOpen(false);
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

  const handleEditSelectAllAmenities = () => {
    if (!editingRoom) return;
    const currentSelected = editingRoom.amenity_ids || [];
    if (currentSelected.length === amenities.length) {
      setEditingRoom({ ...editingRoom, amenity_ids: [] });
    } else {
      setEditingRoom({
        ...editingRoom,
        amenity_ids: amenities.map((a) => a.id),
      });
    }
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
        status: editingRoom.status,
      });
      notify.success("แก้ไขประเภทห้องพักสำเร็จ");

      if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
      editGalleryPreviews.forEach((url) => URL.revokeObjectURL(url));

      setShowEditModal(false);
      setEditingRoom(null);
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

  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const filteredRoomTypes = useMemo(() => {
    const searchLower = searchQuery.toLowerCase().trim();
    return roomTypes.filter((rt) => {
      return (
        !searchQuery ||
        (rt.type_name && rt.type_name.toLowerCase().includes(searchLower)) ||
        (rt.description && rt.description.toLowerCase().includes(searchLower))
      );
    });
  }, [roomTypes, searchQuery]);

  const totalPages = Math.ceil(filteredRoomTypes.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredRoomTypes.length);

  const paginatedRoomTypes = useMemo(() => {
    return filteredRoomTypes.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredRoomTypes, startIndex]);

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-900/10">
            <Layers size={24} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold text-forest-900 leading-tight">
              จัดการประเภทห้องพัก
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-forest-800 hover:bg-forest-900 text-white rounded-2xl font-bold text-xs shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-98"
          >
            <Plus size={16} />
            เพิ่มประเภทห้องพัก
          </button>

          <div className="px-4 py-2.5 bg-cream-50/80 rounded-2xl border border-cream-300 shadow-2xs flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-forest-100 flex items-center justify-center text-forest-800">
              <Layers size={18} />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-charcoal-400 block leading-tight">
                ประเภทห้องทั้งหมด
              </span>
              <span className="text-xs font-bold text-forest-900">
                {roomTypes.length} รายการ
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Table List Section (Fixed consistent height with min-h-[660px]) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/90 overflow-hidden flex flex-col min-h-[660px]">
        {/* Header & Search */}
        <div className="pb-4 mb-4 border-b border-cream-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-forest-800" />
            <h2 className="text-base font-bold text-forest-900">
              รายการประเภทห้องพักทั้งหมด
            </h2>
            <span className="px-2.5 py-0.5 bg-forest-50 text-forest-800 border border-forest-200 rounded-full text-xs font-bold font-mono">
              {filteredRoomTypes.length} รายการ
            </span>
          </div>

          <div className="relative w-full sm:w-80">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400"
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อประเภทห้อง หรือคำอธิบาย..."
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
                <th className="px-5 py-3.5">ประเภทห้อง</th>
                <th className="px-4 py-3.5">ความจุ</th>
                <th className="px-4 py-3.5">จำนวนห้องจริง</th>
                <th className="px-4 py-3.5">สิ่งอำนวยความสะดวก</th>
                <th className="px-4 py-3.5">ราคา / คืน</th>
                <th className="px-4 py-3.5">สถานะ</th>
                <th className="px-4 py-3.5 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100 bg-white text-xs text-charcoal-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-charcoal-400">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-forest-800 border-t-transparent mb-3" />
                    <p className="text-xs font-medium text-charcoal-500">
                      กำลังโหลดข้อมูลห้องพัก...
                    </p>
                  </td>
                </tr>
              ) : filteredRoomTypes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <EmptyState
                      title="ไม่พบประเภทห้องพัก"
                      description="ลองเปลี่ยนคำค้นหา หรือกดเพิ่มประเภทห้องพักใหม่"
                    />
                  </td>
                </tr>
              ) : (
                paginatedRoomTypes.map((rt: any) => (
                  <tr
                    key={rt.id}
                    className="hover:bg-cream-50/50 transition-colors"
                  >
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
                            className="relative w-12 h-12 rounded-2xl overflow-hidden border border-cream-200/90 shrink-0 cursor-pointer group shadow-2xs"
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
                          <div className="w-12 h-12 rounded-2xl bg-cream-100 border border-cream-200 flex items-center justify-center shrink-0 text-charcoal-400">
                            <ImageIcon size={18} />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-charcoal-900 text-sm truncate">
                            {rt.type_name}
                          </div>
                          <div className="text-xs text-charcoal-400 truncate max-w-xs font-normal mt-0.5">
                            {rt.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-cream-100 text-charcoal-700 border border-cream-200">
                        <Users size={13} className="text-charcoal-500" />
                        {rt.capacity} คน
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <Link
                        href={`/admin/rooms/single?type_id=${rt.id}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-forest-50 text-forest-800 hover:bg-forest-100 border border-forest-200/70 transition-all group"
                        title="เปิดหน้าจัดการห้อง — แสดงโซนและเลขห้องถัดไปของประเภทนี้"
                      >
                        <DoorClosed size={13} />
                        <span>{rt.room_count || 0} ห้อง</span>
                        <ArrowRight
                          size={11}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        />
                      </Link>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {rt.amenities && rt.amenities.length > 0 ? (
                          rt.amenities.map((am: any) => (
                            <span
                              key={am.id}
                              className="px-2 py-0.5 bg-cream-100/90 text-charcoal-700 border border-cream-200/90 rounded-lg text-xs font-medium"
                            >
                              {am.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-charcoal-400 font-normal">
                            ไม่ได้ระบุ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-bold text-forest-900 text-sm">
                        ฿{Number(rt.price_per_night || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(rt.id, rt.status)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                          rt.status
                            ? "bg-forest-50 text-forest-800 border-forest-200 hover:bg-forest-100"
                            : "bg-cream-200 text-charcoal-600 border-cream-300 hover:bg-cream-300"
                        }`}
                        title="คลิกเพื่อเปิด/ปิดการใช้งาน"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            rt.status ? "bg-forest-600" : "bg-charcoal-400"
                          }`}
                        />
                        {rt.status ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditRoom(rt)}
                          className="p-1.5 text-charcoal-500 hover:text-amber-800 hover:bg-amber-50/80 rounded-xl transition-all cursor-pointer"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          type="button"
                          disabled={!rt.status}
                          onClick={() => confirmDelete(rt.id)}
                          className="p-1.5 text-charcoal-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                          title={
                            rt.status
                              ? "ปิดใช้งานประเภทห้อง"
                              : "ปิดใช้งานอยู่แล้ว"
                          }
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

        {/* Pagination Footer */}
        {filteredRoomTypes.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-auto border-t border-cream-200 text-xs text-charcoal-500">
            <span>
              แสดง{" "}
              <strong className="text-forest-950 font-mono">
                {filteredRoomTypes.length > 0 ? startIndex + 1 : 0}
              </strong>{" "}
              ถึง{" "}
              <strong className="text-forest-950 font-mono">{endIndex}</strong> จาก{" "}
              <strong className="text-forest-950 font-mono">{filteredRoomTypes.length}</strong> รายการ
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
                    <span key={idx} className="px-1 text-charcoal-400 font-bold">
                      {p}
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

      {/* ======================================================== */}
      {/* Modal: Create Room Type (2-Column Studio Grid Layout)    */}
      {/* ======================================================== */}
      <Modal
        open={showCreateModal}
        title="เพิ่มประเภทห้องพักใหม่"
        widthClass="max-w-3xl"
        onClose={() => {
          setShowCreateModal(false);
          resetCreateForm();
        }}
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => {
                setShowCreateModal(false);
                resetCreateForm();
              }}
              className="px-4 py-2 text-xs font-semibold text-charcoal-600 bg-cream-100 hover:bg-cream-200 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-forest-800 hover:bg-forest-900 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                "สร้างประเภทห้องพัก"
              )}
            </button>
          </div>
        }
      >
        <form onSubmit={handleSubmit} className="py-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* ฝั่งซ้าย: ฟอร์มข้อมูล */}
            <div className="space-y-3.5">
              {/* 1. ชื่อประเภทห้อง */}
              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1.5">
                  ชื่อประเภทห้อง <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="เช่น วิลล่าริมน้ำ, เต็นท์โดม VIP"
                  className="w-full px-3.5 py-2.5 bg-cream-50/70 border border-cream-300 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-hidden focus:bg-white focus:border-forest-800 focus:ring-2 focus:ring-forest-800/10 transition-all"
                  value={form.type_name}
                  onChange={(e) =>
                    setForm({ ...form, type_name: e.target.value })
                  }
                />
              </div>

              {/* 2. รายละเอียด */}
              <div>
                <label className="block text-xs font-semibold text-charcoal-700 mb-1.5">
                  รายละเอียด
                </label>
                <textarea
                  placeholder="บรรยากาศห้องพัก วิว และคำอธิบายเพิ่มเติม..."
                  className="w-full px-3.5 py-2 bg-cream-50/70 border border-cream-300 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-hidden focus:bg-white focus:border-forest-800 focus:ring-2 focus:ring-forest-800/10 transition-all resize-none"
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>

              {/* 3. ผู้เข้าพัก & ราคา */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1.5">
                    ผู้เข้าพัก (คน) <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center bg-cream-50/70 border border-cream-300 rounded-xl overflow-hidden focus-within:border-forest-800 focus-within:ring-2 focus-within:ring-forest-800/10 transition-all">
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          capacity: Math.max(1, (form.capacity || 1) - 1),
                        })
                      }
                      className="px-3 py-2 text-charcoal-500 hover:text-charcoal-800 hover:bg-cream-200 transition-colors font-bold text-xs cursor-pointer border-r border-cream-300 select-none"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      required
                      min="1"
                      className="w-full text-center bg-transparent py-2 text-xs font-medium text-charcoal-800 focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      value={form.capacity}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          capacity: Math.max(1, Number(e.target.value) || 1),
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
                      className="px-3 py-2 text-charcoal-500 hover:text-charcoal-800 hover:bg-cream-200 transition-colors font-bold text-xs cursor-pointer border-l border-cream-300 select-none"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1.5">
                    ราคา/คืน (บาท) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="เช่น 2500"
                    className="w-full px-3.5 py-2 bg-cream-50/70 border border-cream-300 rounded-xl text-xs font-medium text-charcoal-800 focus:outline-hidden focus:bg-white focus:border-forest-800 focus:ring-2 focus:ring-forest-800/10 transition-all"
                    value={form.price}
                    onChange={(e) =>
                      setForm({ ...form, price: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* 4. สิ่งอำนวยความสะดวก (Inline Expandable Drawer — No Overflow Bug) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-charcoal-700">
                    สิ่งอำนวยความสะดวก
                  </label>
                  <Link
                    href="/admin/rooms/amenities"
                    className="text-[11px] text-forest-800 font-medium hover:underline flex items-center gap-1"
                  >
                    จัดการรายการ <ArrowRight size={11} />
                  </Link>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setIsAmenityDropdownOpen(!isAmenityDropdownOpen)
                  }
                  className="w-full px-3.5 py-2 bg-cream-50/70 border border-cream-300 rounded-xl text-xs font-medium text-charcoal-700 flex items-center justify-between cursor-pointer hover:bg-cream-100 transition-all"
                >
                  <span className="truncate">
                    {form.amenities.length > 0
                      ? `เลือกแล้ว ${form.amenities.length} รายการ`
                      : "-- เลือกสิ่งอำนวยความสะดวก --"}
                  </span>
                  <ChevronDown
                    size={15}
                    className={`text-charcoal-400 shrink-0 transition-transform ${
                      isAmenityDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Inline Drawer */}
                {isAmenityDropdownOpen && (
                  <div className="mt-2 bg-white border border-cream-300 rounded-xl shadow-xs max-h-36 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                    {amenities.length > 0 && (
                      <>
                        <label
                          className={`flex items-center gap-2.5 p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            form.amenities.length === amenities.length
                              ? "bg-forest-100/70 text-forest-900"
                              : "text-charcoal-800 hover:bg-cream-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded text-forest-800 focus:ring-0 accent-forest-800 cursor-pointer"
                            checked={
                              amenities.length > 0 &&
                              form.amenities.length === amenities.length
                            }
                            onChange={handleSelectAllAmenities}
                          />
                          <span>
                            {form.amenities.length === amenities.length
                              ? "ยกเลิกการเลือกทั้งหมด"
                              : "เลือกทั้งหมด"}
                          </span>
                        </label>
                        <div className="my-1 border-b border-cream-200" />
                      </>
                    )}

                    {amenities.map((am) => {
                      const checked = form.amenities.includes(am.id);
                      return (
                        <label
                          key={am.id}
                          className={`flex items-center gap-2.5 p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                            checked
                              ? "bg-forest-50 text-forest-800 font-semibold"
                              : "text-charcoal-700 hover:bg-cream-50"
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="w-3.5 h-3.5 rounded text-forest-800 focus:ring-0 accent-forest-800 cursor-pointer"
                            checked={checked}
                            onChange={() => handleAmenityToggle(am.id)}
                          />
                          {am.name}
                        </label>
                      );
                    })}
                  </div>
                )}

                {/* Selected Badges (Bounded Max Height) */}
                {form.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto custom-scrollbar p-0.5">
                    {amenities
                      .filter((a) => form.amenities.includes(a.id))
                      .map((a) => (
                        <span
                          key={a.id}
                          className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-forest-50 text-forest-800 text-[11px] font-semibold rounded-lg border border-forest-200"
                        >
                          {a.name}
                          <button
                            type="button"
                            onClick={() => handleAmenityToggle(a.id)}
                            className="hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                          >
                            <X size={11} />
                          </button>
                        </span>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* ฝั่งขวา: โซนรูปภาพ (Cover + Gallery) */}
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-charcoal-700">
                    รูปภาพหน้าปกหลัก <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[11px] font-medium text-charcoal-400">
                    (แนะนำอัตราส่วน 4:3 หรือ 16:9)
                  </span>
                </div>

                {/* รูปปกหลัก */}
                <div className="relative h-44 rounded-2xl overflow-hidden border-2 border-dashed border-cream-300 hover:border-forest-800 bg-cream-50/50 group transition-all">
                  {coverPreview ? (
                    <>
                      <img
                        src={coverPreview}
                        alt="Cover Preview"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute top-2.5 left-2.5 bg-forest-900/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-lg backdrop-blur-xs">
                        รูปปกหลัก
                      </span>
                      <div className="absolute inset-0 bg-charcoal-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => {
                            if (coverPreview) URL.revokeObjectURL(coverPreview);
                            setCoverFile(null);
                            setCoverPreview(null);
                          }}
                          className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer"
                        >
                          <X size={13} /> เปลี่ยนรูปปก
                        </button>
                      </div>
                    </>
                  ) : (
                    <label
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDropCover}
                      className={`flex flex-col items-center justify-center w-full h-full transition-all cursor-pointer p-4 text-center ${
                        isDraggingCover
                          ? "bg-forest-50/80 border-forest-800"
                          : "hover:bg-cream-100/70"
                      }`}
                    >
                      <UploadCloud size={24} className="text-forest-800 mb-1.5" />
                      <p className="text-xs font-bold text-forest-900">
                        คลิกเพื่ออัปโหลดรูปปกหลัก
                      </p>
                      <p className="text-[11px] text-charcoal-400 mt-0.5">
                        หรือลากไฟล์มาวางที่นี่ (JPG, PNG, WEBP &le; 5MB)
                      </p>
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
              </div>

              {/* Gallery รูปประกอบ */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-charcoal-700">
                    รูปประกอบเพิ่มเติม (Gallery)
                  </span>
                  <span className="text-[11px] font-medium text-charcoal-400">
                    ({galleryPreviews.length}/{MAX_GALLERY_COUNT} รูป)
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {galleryPreviews.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-xl overflow-hidden border border-cream-300 bg-cream-50/60 group shadow-2xs"
                    >
                      <img
                        src={url}
                        alt={`Gallery ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeGalleryFile(idx)}
                        className="absolute inset-0 bg-charcoal-900/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}

                  {galleryPreviews.length < MAX_GALLERY_COUNT && (
                    <label className="flex flex-col items-center justify-center aspect-square border border-dashed border-cream-300 hover:border-forest-800 rounded-xl bg-cream-50/40 hover:bg-forest-50/30 cursor-pointer text-charcoal-500 hover:text-forest-800 transition-all">
                      <PlusCircle size={16} />
                      <span className="text-[10px] font-bold mt-1">
                        เพิ่มรูป
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
            </div>
          </div>
        </form>
      </Modal>

      {/* ======================================================== */}
      {/* Modal: Edit Room Type (2-Column Studio Grid Layout)      */}
      {/* ======================================================== */}
      {editingRoom && (
        <Modal
          open={showEditModal}
          title="แก้ไขประเภทห้องพัก"
          widthClass="max-w-3xl"
          onClose={() => {
            setShowEditModal(false);
            setEditingRoom(null);
          }}
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingRoom(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-charcoal-600 bg-cream-100 hover:bg-cream-200 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={editUploading || submitting}
                onClick={handleUpdateRoom}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-forest-800 hover:bg-forest-900 rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-60"
              >
                {editUploading || submitting ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  "บันทึกการแก้ไข"
                )}
              </button>
            </div>
          }
        >
          <form onSubmit={handleUpdateRoom} className="py-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* ฝั่งซ้าย: ข้อมูล */}
              <div className="space-y-3.5">
                {/* 1. ชื่อประเภทห้อง */}
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1.5">
                    ชื่อประเภทห้อง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น วิลล่าริมน้ำ, เต็นท์โดม VIP"
                    className="w-full px-3.5 py-2.5 bg-cream-50/70 border border-cream-300 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-hidden focus:bg-white focus:border-forest-800 focus:ring-2 focus:ring-forest-800/10 transition-all"
                    value={editingRoom.type_name || ""}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        type_name: e.target.value,
                      })
                    }
                  />
                </div>

                {/* 2. รายละเอียด */}
                <div>
                  <label className="block text-xs font-semibold text-charcoal-700 mb-1.5">
                    รายละเอียด
                  </label>
                  <textarea
                    placeholder="บรรยากาศห้องพัก วิว และคำอธิบายเพิ่มเติม..."
                    className="w-full px-3.5 py-2 bg-cream-50/70 border border-cream-300 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-hidden focus:bg-white focus:border-forest-800 focus:ring-2 focus:ring-forest-800/10 transition-all resize-none"
                    rows={2}
                    value={editingRoom.description || ""}
                    onChange={(e) =>
                      setEditingRoom({
                        ...editingRoom,
                        description: e.target.value,
                      })
                    }
                  />
                </div>

                {/* 3. ผู้เข้าพัก & ราคา */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-charcoal-700 mb-1.5">
                      ผู้เข้าพัก (คน) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center bg-cream-50/70 border border-cream-300 rounded-xl overflow-hidden focus-within:border-forest-800 focus-within:ring-2 focus-within:ring-forest-800/10 transition-all">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingRoom({
                            ...editingRoom,
                            capacity: Math.max(
                              1,
                              (editingRoom.capacity || 1) - 1,
                            ),
                          })
                        }
                        className="px-3 py-2 text-charcoal-500 hover:text-charcoal-800 hover:bg-cream-200 transition-colors font-bold text-xs cursor-pointer border-r border-cream-300 select-none"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="1"
                        className="w-full text-center bg-transparent py-2 text-xs font-medium text-charcoal-800 focus:outline-hidden [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        value={editingRoom.capacity || ""}
                        onChange={(e) =>
                          setEditingRoom({
                            ...editingRoom,
                            capacity: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setEditingRoom({
                            ...editingRoom,
                            capacity: (editingRoom.capacity || 0) + 1,
                          })
                        }
                        className="px-3 py-2 text-charcoal-500 hover:text-charcoal-800 hover:bg-cream-200 transition-colors font-bold text-xs cursor-pointer border-l border-cream-300 select-none"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-charcoal-700 mb-1.5">
                      ราคา/คืน (บาท) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="ระบุราคาห้องพัก"
                      className="w-full px-3.5 py-2 bg-cream-50/70 border border-cream-300 rounded-xl text-xs font-medium text-charcoal-800 focus:outline-hidden focus:bg-white focus:border-forest-800 focus:ring-2 focus:ring-forest-800/10 transition-all"
                      value={editingRoom.price || ""}
                      onChange={(e) =>
                        setEditingRoom({
                          ...editingRoom,
                          price: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>

                {/* 4. สถานะการใช้งาน */}
                <div className="flex items-center justify-between p-2.5 bg-cream-50/70 border border-cream-300 rounded-xl">
                  <div>
                    <label className="block text-xs font-semibold text-charcoal-800 cursor-pointer">
                      สถานะการใช้งาน
                    </label>
                    <p className="text-[11px] font-medium text-charcoal-400">
                      {editingRoom.status
                        ? "เปิดใช้งาน (ลูกค้าเห็นและจองได้)"
                        : "ปิดใช้งาน (ซ่อนจากหน้าลูกค้า)"}
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={Boolean(editingRoom.status)}
                    onClick={() =>
                      setEditingRoom({
                        ...editingRoom,
                        status: !editingRoom.status,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      editingRoom.status ? "bg-forest-800" : "bg-cream-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        editingRoom.status
                          ? "translate-x-5"
                          : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* 5. สิ่งอำนวยความสะดวก (Inline Expandable Drawer — No Overflow Bug) */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-charcoal-700">
                      สิ่งอำนวยความสะดวก
                    </label>
                    <Link
                      href="/admin/rooms/amenities"
                      className="text-[11px] text-forest-800 font-medium hover:underline flex items-center gap-1"
                    >
                      จัดการรายการ <ArrowRight size={11} />
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setIsEditAmenityDropdownOpen(!isEditAmenityDropdownOpen)
                    }
                    className="w-full px-3.5 py-2 bg-cream-50/70 border border-cream-300 rounded-xl text-xs font-medium text-charcoal-700 flex items-center justify-between cursor-pointer hover:bg-cream-100 transition-all"
                  >
                    <span className="truncate">
                      {(editingRoom.amenities || editingRoom.amenity_ids || [])
                        .length > 0
                        ? `เลือกแล้ว ${(editingRoom.amenities || editingRoom.amenity_ids || []).length} รายการ`
                        : "-- เลือกสิ่งอำนวยความสะดวก --"}
                    </span>
                    <ChevronDown
                      size={15}
                      className={`text-charcoal-400 shrink-0 transition-transform ${
                        isEditAmenityDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Inline Drawer */}
                  {isEditAmenityDropdownOpen && (
                    <div className="mt-2 bg-white border border-cream-300 rounded-xl shadow-xs max-h-36 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                      {amenities.length > 0 && (
                        <>
                          <label
                            className={`flex items-center gap-2.5 p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              (editingRoom.amenity_ids || []).length ===
                              amenities.length
                                ? "bg-forest-100/70 text-forest-900"
                                : "text-charcoal-800 hover:bg-cream-100"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 rounded text-forest-800 focus:ring-0 accent-forest-800 cursor-pointer"
                              checked={
                                amenities.length > 0 &&
                                (editingRoom.amenity_ids || []).length ===
                                  amenities.length
                              }
                              onChange={handleEditSelectAllAmenities}
                            />
                            <span>
                              {(editingRoom.amenity_ids || []).length ===
                              amenities.length
                                ? "ยกเลิกการเลือกทั้งหมด"
                                : "เลือกทั้งหมด"}
                            </span>
                          </label>
                          <div className="my-1 border-b border-cream-200" />
                        </>
                      )}

                      {amenities.map((am: any) => {
                        const checked = (
                          editingRoom.amenities ||
                          editingRoom.amenity_ids ||
                          []
                        ).includes(am.id);
                        return (
                          <label
                            key={am.id}
                            className={`flex items-center gap-2.5 p-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                              checked
                                ? "bg-forest-50 text-forest-800 font-semibold"
                                : "text-charcoal-700 hover:bg-cream-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 rounded text-forest-800 focus:ring-0 accent-forest-800 cursor-pointer"
                              checked={checked}
                              onChange={() => editAmenityToggle(am.id)}
                            />
                            {am.name}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Selected Badges (Bounded Max Height) */}
                  {(editingRoom.amenities ||
                    editingRoom.amenity_ids ||
                    []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto custom-scrollbar p-0.5">
                      {amenities
                        .filter((a: any) =>
                          (
                            editingRoom.amenities ||
                            editingRoom.amenity_ids ||
                            []
                          ).includes(a.id),
                        )
                        .map((a: any) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-forest-50 text-forest-800 text-[11px] font-semibold rounded-lg border border-forest-200"
                          >
                            {a.name}
                            <button
                              type="button"
                              onClick={() => editAmenityToggle(a.id)}
                              className="hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ฝั่งขวา: โซนรูปภาพ (Cover + Gallery) */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-charcoal-700">
                      รูปภาพหน้าปกหลัก <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-medium text-charcoal-400">
                      (แนะนำอัตราส่วน 4:3 หรือ 16:9)
                    </span>
                  </div>

                  {/* รูปปกหลัก */}
                  <div className="relative h-44 rounded-2xl overflow-hidden border-2 border-dashed border-cream-300 hover:border-forest-800 bg-cream-50/50 group transition-all">
                    {editCoverPreview || editingRoom.room_image ? (
                      <>
                        <img
                          src={
                            editCoverPreview ||
                            resolveMediaUrl(editingRoom.room_image)
                          }
                          alt="Cover Preview"
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-2.5 left-2.5 bg-forest-900/80 text-white text-[10px] font-semibold px-2 py-0.5 rounded-lg backdrop-blur-xs">
                          {editCoverPreview ? "รูปปกใหม่" : "รูปปกปัจจุบัน"}
                        </span>
                        <div className="absolute inset-0 bg-charcoal-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <label className="bg-white hover:bg-cream-50 text-forest-900 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer">
                            <UploadCloud size={14} className="text-forest-800" />
                            เปลี่ยนรูปปก
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleEditCoverChange}
                            />
                          </label>
                        </div>
                      </>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-full hover:bg-cream-100/70 transition-all cursor-pointer p-4 text-center">
                        <UploadCloud size={24} className="text-forest-800 mb-1.5" />
                        <p className="text-xs font-bold text-forest-900">
                          อัปโหลดรูปปกหลัก
                        </p>
                        <p className="text-[11px] text-charcoal-400 mt-0.5">
                          คลิกเพื่อเลือกไฟล์รูปภาพ
                        </p>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleEditCoverChange}
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* Gallery รูปประกอบ */}
                {(() => {
                  const combinedGallery = [
                    ...(editingRoom.existing_gallery || []).map(
                      (url: string) => ({
                        type: "existing",
                        url: resolveMediaUrl(url),
                        raw: url,
                      }),
                    ),
                    ...editGalleryPreviews.map((url: string, idx: number) => ({
                      type: "new",
                      url,
                      index: idx,
                    })),
                  ];

                  return (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-charcoal-700">
                          รูปประกอบเพิ่มเติม (Gallery)
                        </span>
                        <span className="text-[11px] font-medium text-charcoal-400">
                          ({combinedGallery.length}/{MAX_GALLERY_COUNT} รูป)
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-2">
                        {combinedGallery.map((item, idx) => (
                          <div
                            key={idx}
                            className="relative aspect-square rounded-xl overflow-hidden border border-cream-300 group shadow-2xs"
                          >
                            <img
                              src={item.url}
                              alt={`Gallery ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                if (item.type === "existing") {
                                  setEditingRoom((prev: any) => ({
                                    ...prev,
                                    existing_gallery:
                                      prev.existing_gallery.filter(
                                        (g: string) => g !== item.raw,
                                      ),
                                  }));
                                } else {
                                  removeEditGalleryFile(item.index!);
                                }
                              }}
                              className="absolute inset-0 bg-charcoal-900/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}

                        {combinedGallery.length < MAX_GALLERY_COUNT && (
                          <label className="flex flex-col items-center justify-center aspect-square border border-dashed border-cream-300 hover:border-forest-800 rounded-xl bg-cream-50/40 hover:bg-forest-50/30 cursor-pointer text-charcoal-500 hover:text-forest-800 transition-all">
                            <PlusCircle
                              size={16}
                              className="text-charcoal-400"
                            />
                            <span className="text-[10px] font-bold mt-1">
                              เพิ่มรูป
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
                    </div>
                  );
                })()}
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Lightbox Modal */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/80 backdrop-blur-md animate-in fade-in duration-150 cursor-pointer"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full bg-forest-950 rounded-3xl overflow-hidden shadow-2xl border border-forest-900"
          >
            <div className="p-3.5 bg-forest-900/90 flex items-center justify-between border-b border-forest-800 text-cream-50">
              <span className="text-xs font-semibold px-2">
                {lightboxImage.title}
              </span>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1 hover:bg-forest-800 rounded-xl text-cream-200 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-3 flex items-center justify-center bg-black/40">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[75vh] w-auto object-contain rounded-2xl"
              />
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-cream-200/90 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-charcoal-900">
                ยืนยันการปิดใช้งานประเภทห้องพัก
              </h3>
              <p className="text-xs text-charcoal-500 mt-1 leading-relaxed">
                ประเภทห้องพักนี้จะถูกปิดใช้งาน ไม่แสดงให้ลูกค้าจอง <br />
                ข้อมูลและประวัติการจองยังคงอยู่ ไม่ได้ลบถาวร
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 py-2.5 px-4 bg-cream-100 hover:bg-cream-200 text-charcoal-700 text-xs font-bold rounded-2xl transition-all cursor-pointer border border-cream-200 shadow-2xs"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-2xl transition-all shadow-xs cursor-pointer"
              >
                ปิดใช้งาน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
