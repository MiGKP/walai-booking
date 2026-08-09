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
  BedDouble,
  Sparkles,
  DoorClosed,
  ArrowRight,
  Power,
  ChevronDown,
} from "lucide-react";
import api from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatar";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast from "react-hot-toast";
import Link from "next/link";

const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_GALLERY_COUNT = 5;

export default function RoomTypesPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ allowedRoles: ["admin"] });
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

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rtRes, amRes] = await Promise.all([
        api.get("/rooms?is_admin=true"), // ✅ ใส่ ?is_admin=true
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

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      await api.patch(`/rooms/${id}/status`, { status: !currentStatus });
      toast.success(
        `เปลี่ยนสถานะเป็น ${!currentStatus ? "เปิดใช้งาน" : "ปิดใช้งาน"} เรียบร้อย`,
      );
      fetchData();
    } catch {
      toast.error("เปลี่ยนสถานะไม่สำเร็จ");
    }
  };

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

  // ฟังก์ชันสำหรับ กดเลือกทั้งหมด / ยกเลิกทั้งหมด
  const handleSelectAllAmenities = () => {
    if (form.amenities.length === amenities.length) {
      // ถ้าเลือกครบหมดแล้ว -> ล้างให้เป็นค่าว่าง
      setForm({ ...form, amenities: [] });
    } else {
      // ถ้ายังเลือกไม่ครบ -> ใส่ ID ของสิ่งอำนวยความสะดวกทั้งหมด
      setForm({ ...form, amenities: amenities.map((a) => a.id) });
    }
  };

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!coverFile) {
      toast.error("กรุณาเลือกรูปปกห้องพัก");
      return;
    }

    const numericPrice = Number(form.price);
    // ตรวจสอบราคาบังคับ
    if (!form.price || Number.isNaN(numericPrice) || numericPrice <= 0) {
      alert("กรุณาระบุราคาห้องพักให้ถูกต้อง");
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
      toast.error("ลบไม่สำเร็จ กรุณาตรวจสอบว่ามีห้องพักย่อยผูกอยู่หรือไม่");
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
        status: editingRoom.status,
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
            เพิ่ม ดู และแก้ไขประเภทห้องพักหลักในระบบสวนวลัยรุกขเวช
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
                ประเภทห้องทั้งหมด
              </span>
              <span className="text-xs font-bold text-[#0b3b2c]">
                {roomTypes.length} รายการ
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Table List Section */}
      <div className="bg-white border border-stone-200/80 rounded-2xl shadow-xs overflow-hidden flex flex-col min-h-[500px]">
        {/* Header & Search */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-[#0b3b2c]" />
            <h2 className="text-base font-bold text-stone-800">
              รายการประเภทห้องพักทั้งหมด
            </h2>
            <span className="px-2.5 py-0.5 bg-emerald-50 text-[#0b3b2c] border border-emerald-100 rounded-full text-xs font-bold">
              {filteredRoomTypes.length}
            </span>
          </div>

          <div className="relative w-full sm:w-80">
            <Search
              size={16}
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
                <th className="px-4 py-3.5">จำนวนห้องจริง</th>
                <th className="px-4 py-3.5">สิ่งอำนวยความสะดวก</th>
                <th className="px-4 py-3.5">ราคา / คืน</th>
                <th className="px-4 py-3.5">สถานะ</th>
                <th className="px-4 py-3.5 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs text-stone-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-stone-400">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#0b3b2c] border-t-transparent mb-3" />
                    <p className="text-xs font-medium text-stone-500">
                      กำลังโหลดข้อมูลห้องพัก...
                    </p>
                  </td>
                </tr>
              ) : filteredRoomTypes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-stone-400">
                    <Layers
                      size={40}
                      className="mx-auto mb-3 text-stone-300 stroke-[1.5]"
                    />
                    <p className="text-sm font-semibold text-stone-600">
                      ไม่พบประเภทห้องพัก
                    </p>
                    <p className="text-xs text-stone-400 mt-1">
                      ลองเปลี่ยนคำค้นหา หรือกดเพิ่มประเภทห้องพักใหม่
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRoomTypes.map((rt: any) => (
                  <tr
                    key={rt.id}
                    className="hover:bg-stone-50/80 transition-colors"
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
                          <div className="text-[11px] text-stone-400 truncate max-w-xs font-normal mt-0.5">
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
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <Link
                        href={`/admin/rooms/single?type_id=${rt.id}`}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-[#0b3b2c] hover:bg-emerald-100 border border-emerald-200/60 transition-all group"
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
                              className="px-2 py-0.5 bg-stone-100 text-stone-700 border border-stone-200 rounded-md text-[10px] font-medium"
                            >
                              {am.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-stone-400 font-normal">
                            ไม่ได้ระบุ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-bold text-[#0b3b2c] text-sm">
                        ฿{Number(rt.price_per_night || 0).toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(rt.id, rt.status)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                          rt.status
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                            : "bg-stone-200 text-stone-600 hover:bg-stone-300"
                        }`}
                        title="คลิกเพื่อเปิด/ปิดการใช้งาน"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${rt.status ? "bg-emerald-600" : "bg-stone-400"}`}
                        />
                        {rt.status ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                      </button>
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

      {/* Modal: Create Room Type */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#0b3b2c] flex items-center justify-center font-bold">
                  <PlusCircle size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    เพิ่มประเภทห้องพักใหม่
                  </h3>
                  <p className="text-xs text-slate-400">
                    กรอกข้อมูลเพื่อสร้างประเภทห้องพักในระบบ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateModal(false);
                  resetCreateForm();
                }}
                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Content */}
            <form
              onSubmit={handleSubmit}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                {/* 1. ชื่อประเภทห้อง */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    ชื่อประเภทห้อง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น วิลล่าริมน้ำ, เต็นท์โดม VIP"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#0b3b2c] focus:ring-4 focus:ring-[#0b3b2c]/10 transition-all"
                    value={form.type_name}
                    onChange={(e) =>
                      setForm({ ...form, type_name: e.target.value })
                    }
                  />
                </div>

                {/* 2. รายละเอียด */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-2">
                    รายละเอียด
                  </label>
                  <textarea
                    placeholder="บรรยากาศห้องพัก วิว และคำอธิบายเพิ่มเติม..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#0b3b2c] focus:ring-4 focus:ring-[#0b3b2c]/10 transition-all resize-none"
                    rows={3}
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                  />
                </div>

                {/* 3. ผู้เข้าพัก & ราคา */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      ผู้เข้าพัก (คน) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden focus-within:border-[#0b3b2c] focus-within:ring-4 focus-within:ring-[#0b3b2c]/10 transition-all">
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            capacity: Math.max(1, (form.capacity || 1) - 1),
                          })
                        }
                        className="px-3 py-3 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors font-bold text-sm cursor-pointer border-r border-slate-200 select-none"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        required
                        min="1"
                        className="w-full text-center bg-transparent py-3 text-sm font-medium text-slate-800 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                        className="px-3 py-3 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors font-bold text-sm cursor-pointer border-l border-slate-200 select-none"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      ราคา/คืน (บาท) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:outline-none focus:bg-white focus:border-[#0b3b2c] focus:ring-4 focus:ring-[#0b3b2c]/10 transition-all"
                      value={form.price}
                      onChange={(e) =>
                        setForm({ ...form, price: e.target.value })
                      }
                    />
                  </div>
                </div>

                {/* 4. สิ่งอำนวยความสะดวก */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      สิ่งอำนวยความสะดวก
                    </label>
                    <Link
                      href="/admin/rooms/amenities"
                      className="text-xs text-[#0b3b2c] font-medium hover:underline flex items-center gap-1"
                    >
                      จัดการรายการ <ArrowRight size={12} />
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setIsAmenityDropdownOpen(!isAmenityDropdownOpen)
                    }
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700 flex items-center justify-between cursor-pointer hover:bg-slate-100/80 transition-all"
                  >
                    <span>
                      {form.amenities.length > 0
                        ? `เลือกแล้ว ${form.amenities.length} รายการ`
                        : "-- เลือกสิ่งอำนวยความสะดวก --"}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform ${isAmenityDropdownOpen ? "rotate-180" : ""}`}
                    />
                  </button>

                  {/* Selected Badges */}
                  {form.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {amenities
                        .filter((a) => form.amenities.includes(a.id))
                        .map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-[#0b3b2c] text-[11px] font-semibold rounded-lg border border-emerald-100"
                          >
                            {a.name}
                            <button
                              type="button"
                              onClick={() => handleAmenityToggle(a.id)}
                              className="hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Floating Dropdown */}
                  {isAmenityDropdownOpen && (
                    <div className="absolute z-20 left-0 right-0 mt-2 bg-white border border-slate-100 rounded-2xl shadow-xl max-h-56 overflow-y-auto p-2 space-y-1">
                      {/* ตัวเลือก: เลือกทั้งหมด / ยกเลิกทั้งหมด */}
                      {amenities.length > 0 && (
                        <>
                          <label
                            className={`flex items-center gap-3 p-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                              form.amenities.length === amenities.length
                                ? "bg-emerald-100/60 text-[#0b3b2c]"
                                : "text-slate-800 hover:bg-slate-100"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded text-[#0b3b2c] focus:ring-0 accent-[#0b3b2c]"
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
                          <div className="my-1 border-b border-slate-100" />
                        </>
                      )}

                      {/* รายการแต่ละอัน */}
                      {amenities.map((am) => {
                        const checked = form.amenities.includes(am.id);
                        return (
                          <label
                            key={am.id}
                            className={`flex items-center gap-3 p-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                              checked
                                ? "bg-emerald-50 text-[#0b3b2c]"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="w-4 h-4 rounded text-[#0b3b2c] focus:ring-0 accent-[#0b3b2c]"
                              checked={checked}
                              onChange={() => handleAmenityToggle(am.id)}
                            />
                            {am.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 5. โซนจัดการรูปภาพ (Hybrid Grid + Dynamic Add Button) */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-semibold text-slate-700">
                      รูปภาพห้องพัก <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-medium text-slate-400">
                      รูปปก + รูปประกอบ ({galleryPreviews.length}/
                      {MAX_GALLERY_COUNT})
                    </span>
                  </div>

                  {/* Hybrid Grid Container */}
                  <div className="grid grid-cols-3 gap-2">
                    {/* ฝั่งซ้าย: รูปปกหลัก (กินพื้นที่ 2 คอลัมน์) */}
                    <div className="col-span-2 relative h-40 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 group">
                      {coverPreview ? (
                        <>
                          <img
                            src={coverPreview}
                            alt="Cover Preview"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-2 left-2 bg-slate-900/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-md backdrop-blur-xs">
                            รูปปกหลัก
                          </span>
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (coverPreview)
                                  URL.revokeObjectURL(coverPreview);
                                setCoverFile(null);
                                setCoverPreview(null);
                              }}
                              className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                            >
                              <X size={14} /> เปลี่ยนรูปปก
                            </button>
                          </div>
                        </>
                      ) : (
                        <label
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDropCover}
                          className={`flex flex-col items-center justify-center w-full h-full border-2 border-dashed rounded-2xl transition-all cursor-pointer p-3 text-center ${
                            isDraggingCover
                              ? "border-[#0b3b2c] bg-emerald-50/50"
                              : "border-slate-200 hover:border-slate-300 bg-slate-50/50 hover:bg-slate-50"
                          }`}
                        >
                          <UploadCloud
                            size={22}
                            className="text-slate-400 mb-1"
                          />
                          <p className="text-xs font-semibold text-slate-700">
                            อัปโหลดรูปปกหลัก
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            ลากไฟล์มาวาง หรือคลิกที่นี่
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

                    {/* ฝั่งขวา: Gallery ล็อตแรก (แสดง 2 ช่องแรก) */}
                    <div className="col-span-1 grid grid-rows-2 gap-2 h-40">
                      {[0, 1].map((idx) => {
                        const url = galleryPreviews[idx];
                        const isAddButtonSlot =
                          !url && (idx === 0 || galleryPreviews.length === idx);

                        if (url) {
                          return (
                            <div
                              key={idx}
                              className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group h-full"
                            >
                              <img
                                src={url}
                                alt={`Gallery ${idx + 1}`}
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => removeGalleryFile(idx)}
                                className="absolute inset-0 bg-slate-900/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          );
                        }

                        if (
                          isAddButtonSlot &&
                          galleryPreviews.length < MAX_GALLERY_COUNT
                        ) {
                          return (
                            <label
                              key={idx}
                              className="flex flex-col items-center justify-center w-full h-full border border-dashed border-slate-300 hover:border-[#0b3b2c] rounded-xl bg-slate-50/50 hover:bg-emerald-50/30 cursor-pointer text-slate-500 hover:text-[#0b3b2c] transition-all"
                            >
                              <PlusCircle size={18} />
                              <span className="text-[10px] font-semibold mt-1">
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
                          );
                        }

                        return (
                          <div
                            key={idx}
                            className="rounded-xl border border-slate-100 bg-slate-50/30 h-full"
                          />
                        );
                      })}
                    </div>
                  </div>

                  {/* แถบรูป Gallery ส่วนเกิน (กรณีเพิ่มรูปที่ 3 ขึ้นไป) */}
                  {galleryPreviews.length >= 2 && (
                    <div className="grid grid-cols-3 gap-2">
                      {/* รูปตั้งแต่ index ที่ 2 เป็นต้นไป */}
                      {galleryPreviews.slice(2).map((url, realIdx) => {
                        const idx = realIdx + 2;
                        return (
                          <div
                            key={idx}
                            className="relative h-20 rounded-xl overflow-hidden border border-slate-200 group"
                          >
                            <img
                              src={url}
                              alt={`Gallery ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => removeGalleryFile(idx)}
                              className="absolute inset-0 bg-slate-900/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        );
                      })}

                      {/* ปุ่มเพิ่มรูปภาพในแถบล่าง (แสดงเมื่อมีรูป >= 2 และยังไม่ครบจำนวนสูงสุด) */}
                      {galleryPreviews.length < MAX_GALLERY_COUNT && (
                        <label className="flex flex-col items-center justify-center h-20 border border-dashed border-slate-300 hover:border-[#0b3b2c] rounded-xl bg-slate-50/50 hover:bg-emerald-50/30 cursor-pointer text-slate-500 hover:text-[#0b3b2c] transition-all">
                          <PlusCircle size={18} />
                          <span className="text-[10px] font-semibold mt-1">
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
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 bg-slate-50 border-t border-slate-100 flex gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    resetCreateForm();
                  }}
                  className="flex-1 py-3 px-4 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 px-4 bg-[#0b3b2c] hover:bg-[#07271d] text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "สร้างประเภทห้องพัก"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Room Type */}
      {showEditModal && editingRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-5 pb-4 border-b border-slate-100 flex items-start justify-between bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-emerald-50 text-[#0b3b2c] flex items-center justify-center shrink-0 border border-emerald-100/60">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    แก้ไขประเภทห้องพัก
                  </h3>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    แก้ไขข้อมูลประเภทห้องพักในระบบ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingRoom(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Form Content */}
            <form
              onSubmit={handleUpdateRoom}
              className="flex flex-col flex-1 overflow-hidden"
            >
              <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                {/* 1. ชื่อประเภทห้อง */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    ชื่อประเภทห้อง <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="เช่น วิลล่าริมน้ำ, เต็นท์โดม VIP"
                    className="w-full px-4 py-2.5 bg-[#f8fafc] border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#0b3b2c] focus:ring-2 focus:ring-[#0b3b2c]/10 transition-all"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    รายละเอียด
                  </label>
                  <textarea
                    placeholder="บรรยากาศห้องพัก วิว และคำอธิบายเพิ่มเติม..."
                    className="w-full px-4 py-2.5 bg-[#f8fafc] border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#0b3b2c] focus:ring-2 focus:ring-[#0b3b2c]/10 transition-all resize-none"
                    rows={3}
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      ผู้เข้าพัก (คน) <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center bg-[#f8fafc] border border-slate-200/80 rounded-xl overflow-hidden focus-within:border-[#0b3b2c] focus-within:ring-2 focus-within:ring-[#0b3b2c]/10 transition-all">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingRoom({
                            ...editingRoom,
                            capacity: Math.max(
                              1,
                              (editingRoom.capacity || 1) - 1
                            ),
                          })
                        }
                        className="px-3 py-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors font-bold text-xs cursor-pointer border-r border-slate-200/80 select-none"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        required
                        min="1"
                        placeholder="1"
                        className="w-full text-center bg-transparent py-2.5 text-xs font-medium text-slate-800 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                        className="px-3 py-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors font-bold text-xs cursor-pointer border-l border-slate-200/80 select-none"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      ราคา/คืน (บาท) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="ระบุราคาห้องพัก"
                      className="w-full px-4 py-2.5 bg-[#f8fafc] border border-slate-200/80 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#0b3b2c] focus:ring-2 focus:ring-[#0b3b2c]/10 transition-all"
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

                {/* 4. สถานะการใช้งาน (Toggle Switch) */}
                <div className="flex items-center justify-between p-3.5 bg-[#f8fafc] border border-slate-200/80 rounded-xl">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 cursor-pointer">
                      สถานะการใช้งาน
                    </label>
                    <p className="text-[11px] font-medium text-slate-400 mt-0.5">
                      {editingRoom.status
                        ? "เปิดใช้งาน (ลูกค้าเห็นและจองได้)"
                        : "ปิดใช้งาน (ซ่อนจากหน้าแสดงผลฝั่งลูกค้า)"}
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
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      editingRoom.status ? "bg-[#0b3b2c]" : "bg-slate-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        editingRoom.status ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* 5. สิ่งอำนวยความสะดวก */}
                <div className="relative">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700">
                      สิ่งอำนวยความสะดวก
                    </label>
                    <Link
                      href="/admin/rooms/amenities"
                      className="text-xs text-[#0b3b2c] font-medium hover:underline flex items-center gap-1"
                    >
                      จัดการรายการ <ArrowRight size={12} />
                    </Link>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setIsAmenityDropdownOpen(!isAmenityDropdownOpen)
                    }
                    className="w-full px-4 py-2.5 bg-[#f8fafc] border border-slate-200/80 rounded-xl text-xs font-medium text-slate-500 flex items-center justify-between cursor-pointer hover:bg-slate-100/80 transition-all"
                  >
                    <span>
                      {(editingRoom.amenities || editingRoom.amenity_ids || [])
                        .length > 0
                        ? `เลือกแล้ว ${(editingRoom.amenities || editingRoom.amenity_ids || []).length} รายการ`
                        : "-- เลือกสิ่งอำนวยความสะดวก --"}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform ${
                        isAmenityDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Selected Badges */}
                  {(editingRoom.amenities || editingRoom.amenity_ids || [])
                    .length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
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
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-[#0b3b2c] text-[11px] font-semibold rounded-lg border border-emerald-100"
                          >
                            {a.name}
                            <button
                              type="button"
                              onClick={() =>
                                editAmenityToggle
                                  ? editAmenityToggle(a.id)
                                  : handleAmenityToggle?.(a.id)
                              }
                              className="hover:text-rose-600 transition-colors ml-0.5 cursor-pointer"
                            >
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                    </div>
                  )}

                  {/* Dropdown Menu */}
                  {isAmenityDropdownOpen && (
                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-48 overflow-y-auto p-1.5 space-y-0.5 custom-scrollbar">
                      {amenities.map((am: any) => {
                        const checked = (
                          editingRoom.amenities ||
                          editingRoom.amenity_ids ||
                          []
                        ).includes(am.id);
                        return (
                          <label
                            key={am.id}
                            className={`flex items-center gap-2.5 p-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                              checked
                                ? "bg-emerald-50/70 text-[#0b3b2c] font-semibold"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="w-3.5 h-3.5 rounded text-[#0b3b2c] focus:ring-0 accent-[#0b3b2c]"
                              checked={checked}
                              onChange={() =>
                                editAmenityToggle
                                  ? editAmenityToggle(am.id)
                                  : handleAmenityToggle?.(am.id)
                              }
                            />
                            {am.name}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 6. รูปภาพห้องพัก (Hybrid Layout ตรงตามแบบ) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-slate-700">
                      รูปภาพห้องพัก <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-medium text-slate-400">
                      รูปปก + รูปประกอบ (
                      {(editingRoom.existing_gallery?.length || 0) +
                        editGalleryPreviews.length}
                      /{MAX_GALLERY_COUNT || 5})
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5">
                    {/* ฝั่งซ้าย: รูปปกหลัก */}
                    <div className="col-span-2 relative h-36 rounded-2xl overflow-hidden border border-slate-200/80 bg-[#f8fafc] group">
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
                          <span className="absolute top-2 left-2 bg-slate-900/70 text-white text-[10px] font-semibold px-2 py-0.5 rounded-md backdrop-blur-xs">
                            {editCoverPreview ? "รูปปกใหม่" : "รูปปกปัจจุบัน"}
                          </span>
                          <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <label className="bg-white/90 hover:bg-white text-slate-800 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer">
                              <UploadCloud
                                size={14}
                                className="text-[#0b3b2c]"
                              />
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
                        <label className="flex flex-col items-center justify-center w-full h-full border-2 border-dashed border-slate-200 hover:border-slate-300 bg-[#f8fafc] hover:bg-slate-50 rounded-2xl transition-all cursor-pointer p-3 text-center">
                          <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center mb-1 text-slate-400 shadow-xs">
                            <UploadCloud size={16} />
                          </div>
                          <p className="text-xs font-semibold text-slate-700">
                            อัปโหลดรูปปกหลัก
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            ลากไฟล์มาวาง หรือคลิกที่นี่
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

                    {/* ฝั่งขวา: Gallery ช่องที่ 1 & 2 */}
                    {(() => {
                      const combinedGallery = [
                        ...(editingRoom.existing_gallery || []).map(
                          (url: string) => ({
                            type: "existing",
                            url: resolveMediaUrl(url),
                            raw: url,
                          }),
                        ),
                        ...editGalleryPreviews.map(
                          (url: string, idx: number) => ({
                            type: "new",
                            url,
                            index: idx,
                          }),
                        ),
                      ];

                      return (
                        <div className="col-span-1 grid grid-rows-2 gap-2 h-36">
                          {[0, 1].map((idx) => {
                            const item = combinedGallery[idx];
                            const isAddSlot =
                              !item &&
                              (idx === 0 || combinedGallery.length === idx) &&
                              combinedGallery.length < (MAX_GALLERY_COUNT || 5);

                            if (item) {
                              return (
                                <div
                                  key={idx}
                                  className="relative rounded-xl overflow-hidden border border-slate-200/80 bg-slate-50 group h-full"
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
                                    className="absolute inset-0 bg-slate-900/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              );
                            }

                            if (isAddSlot) {
                              return (
                                <label
                                  key={idx}
                                  className="flex flex-col items-center justify-center w-full h-full border border-dashed border-slate-200 hover:border-[#0b3b2c] rounded-xl bg-[#f8fafc] hover:bg-emerald-50/20 cursor-pointer text-slate-500 hover:text-[#0b3b2c] transition-all"
                                >
                                  <PlusCircle
                                    size={18}
                                    className="text-slate-400"
                                  />
                                  <span className="text-[10px] font-medium text-slate-600 mt-0.5">
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
                              );
                            }

                            return (
                              <div
                                key={idx}
                                className="rounded-xl border border-dashed border-slate-200/60 bg-[#f8fafc]/50 h-full"
                              />
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* แถบรูป Gallery เพิ่มเติม (ถ้ามีมากกว่า 2 รูป) */}
                  {(() => {
                    const combinedGallery = [
                      ...(editingRoom.existing_gallery || []).map(
                        (url: string) => ({
                          type: "existing",
                          url: resolveMediaUrl(url),
                          raw: url,
                        }),
                      ),
                      ...editGalleryPreviews.map(
                        (url: string, idx: number) => ({
                          type: "new",
                          url,
                          index: idx,
                        }),
                      ),
                    ];

                    if (combinedGallery.length <= 2) return null;

                    return (
                      <div className="grid grid-cols-3 gap-2.5 pt-2">
                        {combinedGallery.slice(2).map((item, realIdx) => {
                          const idx = realIdx + 2;
                          return (
                            <div
                              key={idx}
                              className="relative h-20 rounded-xl overflow-hidden border border-slate-200/80 group"
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
                                className="absolute inset-0 bg-slate-900/50 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          );
                        })}

                        {combinedGallery.length < (MAX_GALLERY_COUNT || 5) && (
                          <label className="flex flex-col items-center justify-center h-20 border border-dashed border-slate-200 hover:border-[#0b3b2c] rounded-xl bg-[#f8fafc] hover:bg-emerald-50/20 cursor-pointer text-slate-500 hover:text-[#0b3b2c] transition-all">
                            <PlusCircle size={18} className="text-slate-400" />
                            <span className="text-[10px] font-medium text-slate-600 mt-0.5">
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
                    );
                  })()}
                </div>
              </div>

              {/* Footer Actions */}
              <div className="p-5 bg-white border-t border-slate-100 flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingRoom(null);
                  }}
                  className="flex-1 py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200/80 text-slate-700 text-xs font-semibold rounded-xl transition-all cursor-pointer text-center"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={editUploading || submitting}
                  className="flex-1 py-3 px-4 bg-[#0b3b2c] hover:bg-[#07271d] text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
                >
                  {editUploading || submitting ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    "บันทึกการแก้ไข"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
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

      {/* Delete Confirmation Modal */}
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
                หากยังมีห้องพักรายห้องผูกอยู่อาจลบไม่สำเร็จ
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
