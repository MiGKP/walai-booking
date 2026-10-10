"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Tag,
  Percent,
  DollarSign,
  Save,
  Search,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  AlertCircle,
  Ship,
  Bed,
  Users,
  X,
  Calendar,
  Gift,
  Ticket,
} from "lucide-react";
import { Modal, CustomDatePicker } from "@/components/admin/ui";
import api, { getApiErrorMessage } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { isPromoExpired } from "@/lib/promotions";
import { useAuth } from "@/hooks/useAuth";
import {
  appliesToLabel,
  parseAppliesTo,
  type PromoAppliesTo,
} from "@/lib/promotions";

interface RoomType {
  id: number;
  name?: string;
  type_name?: string;
  room_name?: string;
}

interface Promotion {
  id: number;
  code: string;
  name: string;
  description?: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  min_nights?: number;
  min_price?: number;
  max_discount?: number;
  start_date?: string;
  end_date?: string;
  usage_limit?: number;
  usage_limit_per_member?: number | null;
  is_collectible?: boolean;
  stackable?: boolean;
  applies_to?: PromoAppliesTo | string | null;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  room_type_id?: number;
  room_type_name?: string;
  room_count?: number;
  boat_ticket_count?: number;
  boat_addon_mode?: "free" | "paid";
  boat_addon_price?: number | null;
}

const defaultForm = {
  code: "",
  name: "",
  description: "",
  discount_type: "percent" as "percent" | "fixed",
  discount_value: "",
  min_nights: "",
  min_price: "",
  max_discount: "",
  start_date: "",
  end_date: "",
  usage_limit: "",
  usage_limit_per_member: "",
  is_collectible: false,
  stackable: false,
  applies_to: "both" as PromoAppliesTo,
  is_active: true,
  room_type_id: "",
  room_count: "1",
  boat_ticket_count: "0",
  boat_addon_mode: "free" as "free" | "paid",
  boat_addon_price: "",
};

// Component Custom Dropdown
function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "เลือก...",
  width = "w-full",
  className = "",
  buttonClassName,
}: {
  options: { value: string | number; label: string }[];
  value: string | number;
  onChange: (val: any) => void;
  placeholder?: string;
  width?: string;
  className?: string;
  buttonClassName?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(
    (opt) => String(opt.value) === String(value),
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const btnClass =
    buttonClassName ||
    "w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-white border border-cream-200 rounded-xl text-xs font-semibold text-charcoal-700 transition-all focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs";

  return (
    <div className={`relative ${width} ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        className={btnClass}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-charcoal-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-forest-800" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full bg-white border border-cream-200 rounded-xl shadow-lg z-50 overflow-hidden py-1 max-h-56 overflow-y-auto animate-in fade-in duration-150">
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 text-xs font-medium transition-colors flex items-center justify-between ${
                  isSelected
                    ? "bg-forest-50 text-forest-900 font-bold"
                    : "text-charcoal-600 hover:bg-cream-50 hover:text-charcoal-900"
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-forest-800" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ฟังก์ชันแปลง Date String ให้เหมาะกับ <input type="date" />
const formatDateForInput = (dateStr?: string) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return "";
  }
};

export default function PromotionsPage() {
  const { ready } = useAuthGuard({ allowedRoles: ["admin", "room_staff"] });
  const { user } = useAuth();
  // พนักงานห้องพักดูและดูผู้ใช้โปรได้ แต่สร้าง แก้ ลบ หรือเปิดปิดไม่ได้
  const canEdit = user?.role === "admin";
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive" | "expired" | "used"
  >("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [promoTab, setPromoTab] = useState<"room" | "kayak">("room");
  const [hasBoatAddon, setHasBoatAddon] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  // State สำหรับ ป๊อบอัพยืนยันการลบ
  const [deletingPromotion, setDeletingPromotion] = useState<Promotion | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [redemptionPromo, setRedemptionPromo] = useState<Promotion | null>(null);
  const [redemptions, setRedemptions] = useState<{
    wallet: { saved: number; used: number; expired: number };
    redemptions: Array<{
      booking_promotion_id: number;
      email: string;
      first_name?: string;
      last_name?: string;
      booking_type: string;
      room_booking_id: number | null;
      boat_booking_id: number | null;
      booking_status: string;
      discount_amount: number;
      created_at: string;
    }>;
  } | null>(null);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);

  const DISCOUNT_TYPE_OPTIONS = [
    { value: "percent", label: "เปอร์เซ็นต์ (%)" },
    { value: "fixed", label: "จำนวนเงิน (฿)" },
  ];

  useEffect(() => {
    if (!ready) return;
    fetchPromotions();
    fetchRoomTypes();

    return () => {
      notify.dismiss();
    };
  }, [ready]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const res = await api.get("/promotions");
      setPromotions(res.data?.data || []);
    } catch {
      notify.error("โหลดข้อมูลโปรโมชั่นไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoomTypes = async () => {
    try {
      const res = await api.get("/rooms");
      setRoomTypes(res.data?.data || res.data || []);
    } catch (err) {
      console.error("โหลดข้อมูลประเภทห้องพักไม่สำเร็จ", err);
    }
  };

  const roomTypeOptions = [
    { value: "", label: "ทุกประเภทห้องพัก" },
    ...roomTypes.map((rt) => ({
      value: rt.id,
      label: rt.type_name || rt.room_name || rt.name || `ห้อง ${rt.id}`,
    })),
  ];

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...defaultForm,
      applies_to: "room",
    });
    setPromoTab("room");
    setHasBoatAddon(false);
    setShowModal(true);
  };

  const openEdit = (p: Promotion) => {
    setEditingId(p.id);
    const isKayak = p.applies_to === "kayak";
    const hasAddon = Number(p.boat_ticket_count || 0) > 0;
    setPromoTab(isKayak ? "kayak" : "room");
    setHasBoatAddon(hasAddon);
    setForm({
      code: p.code || "",
      name: p.name || "",
      description: p.description || "",
      discount_type: p.discount_type,
      discount_value: String(p.discount_value ?? ""),
      min_nights: p.min_nights ? String(p.min_nights) : "",
      min_price: p.min_price ? String(p.min_price) : "",
      max_discount: p.max_discount ? String(p.max_discount) : "",
      start_date: formatDateForInput(p.start_date),
      end_date: formatDateForInput(p.end_date),
      usage_limit: p.usage_limit ? String(p.usage_limit) : "",
      usage_limit_per_member: p.usage_limit_per_member
        ? String(p.usage_limit_per_member)
        : "",
      is_collectible: true,
      stackable: false,
      applies_to: isKayak ? "kayak" : "room",
      is_active: p.is_active,
      room_type_id: p.room_type_id ? String(p.room_type_id) : "",
      room_count: p.room_count ? String(p.room_count) : "1",
      boat_ticket_count: p.boat_ticket_count ? String(p.boat_ticket_count) : "1",
      boat_addon_mode: p.boat_addon_mode === "paid" ? "paid" : "free",
      boat_addon_price: p.boat_addon_price ? String(p.boat_addon_price) : "",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isRoom = promoTab === "room";
      const payload = {
        ...form,
        discount_value: Number(form.discount_value),
        min_nights: isRoom && form.min_nights ? Number(form.min_nights) : null,
        min_price: form.min_price ? Number(form.min_price) : null,
        max_discount: form.max_discount ? Number(form.max_discount) : null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        usage_limit_per_member: form.usage_limit_per_member
          ? Number(form.usage_limit_per_member)
          : null,
        is_collectible: true,
        stackable: false,
        applies_to: isRoom ? "room" : "kayak",
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        room_type_id: isRoom && hasBoatAddon && form.room_type_id ? Number(form.room_type_id) : null,
        room_count: isRoom && hasBoatAddon && form.room_count ? Number(form.room_count) : 1,
        boat_ticket_count: isRoom && hasBoatAddon && form.boat_ticket_count ? Number(form.boat_ticket_count) : 0,
        boat_addon_mode: isRoom && hasBoatAddon ? form.boat_addon_mode : "free",
        boat_addon_price:
          isRoom && hasBoatAddon && form.boat_addon_mode === "paid" && form.boat_addon_price
            ? Number(form.boat_addon_price)
            : null,
      };

      if (editingId) {
        await api.put(`/promotions/${editingId}`, payload);
        notify.success("แก้ไขโปรโมชั่นสำเร็จ");
      } else {
        await api.post("/promotions", payload);
        notify.success("เพิ่มโปรโมชั่นสำเร็จ");
      }
      setShowModal(false);
      fetchPromotions();
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "บันทึกไม่สำเร็จ"));
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (p: Promotion) => {
    try {
      await api.put(`/promotions/${p.id}/toggle`);
      notify.success(p.is_active ? "ปิดโปรโมชั่นแล้ว" : "เปิดโปรโมชั่นแล้ว");
      fetchPromotions();
    } catch {
      notify.error("เปลี่ยนสถานะไม่สำเร็จ");
    }
  };

  const openRedemptions = async (p: Promotion): Promise<void> => {
    setRedemptionPromo(p);
    setRedemptionsLoading(true);
    try {
      const res = await api.get(`/promotions/${p.id}/redemptions`);
      setRedemptions(res.data.data);
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "โหลดประวัติไม่สำเร็จ"));
      setRedemptionPromo(null);
      setRedemptions(null);
    } finally {
      setRedemptionsLoading(false);
    }
  };

  // ฟังก์ชันกดยืนยันลบจริง
  const confirmDelete = async () => {
    if (!deletingPromotion) return;
    setDeleting(true);
    try {
      await api.delete(`/promotions/${deletingPromotion.id}`);
      notify.success("ลบโปรโมชั่นสำเร็จ");
      fetchPromotions();
      setDeletingPromotion(null);
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "ลบไม่สำเร็จ"));
    } finally {
      setDeleting(false);
    }
  };

  const counts = useMemo(() => {
    const total = promotions.length;
    const active = promotions.filter(
      (p) =>
        p.is_active &&
        !isPromoExpired(p.end_date) &&
        !(p.usage_limit && p.usage_count >= p.usage_limit),
    ).length;
    const inactive = promotions.filter((p) => !p.is_active).length;
    const expired = promotions.filter((p) => {
      const isExp = isPromoExpired(p.end_date);
      const isFull = Boolean(p.usage_limit && p.usage_count >= p.usage_limit);
      return isExp || isFull;
    }).length;
    const usedPromos = promotions.filter((p) => (p.usage_count || 0) > 0).length;
    const totalUsed = promotions.reduce((s, p) => s + (p.usage_count || 0), 0);
    return { total, active, inactive, expired, usedPromos, totalUsed };
  }, [promotions]);

  const filtered = useMemo(() => {
    return promotions.filter((p) => {
      const matchSearch =
        !search.trim() ||
        (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
        (p.code && p.code.toLowerCase().includes(search.toLowerCase()));

      if (!matchSearch) return false;

      const isExpired = isPromoExpired(p.end_date);
      const isFull = Boolean(p.usage_limit && p.usage_count >= p.usage_limit);

      if (statusFilter === "active") {
        return p.is_active && !isExpired && !isFull;
      }
      if (statusFilter === "inactive") {
        return !p.is_active;
      }
      if (statusFilter === "expired") {
        return isExpired || isFull;
      }
      if (statusFilter === "used") {
        return (p.usage_count || 0) > 0;
      }

      return true;
    });
  }, [promotions, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedPromotions = filtered.slice(
    (safeCurrentPage - 1) * itemsPerPage,
    safeCurrentPage * itemsPerPage,
  );

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Page Title */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-800/10">
            <Tag size={20} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-forest-900 tracking-tight">
              จัดการโปรโมชั่น
            </h1>
          </div>
        </div>

        <button
          disabled={!canEdit}
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 bg-forest-800 hover:bg-forest-900 text-white px-4 py-2.5 rounded-2xl font-bold shadow-2xs transition-all text-xs active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          <Plus size={16} />
          <span>เพิ่มโปรโมชั่น</span>
        </button>
      </div>

      {/* Stats & Filter Cards (5 Columns) — Clickable Filter Selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: ทั้งหมด */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter("all");
            setCurrentPage(1);
          }}
          className={`rounded-3xl p-4 sm:p-5 shadow-panel border text-left transition-all cursor-pointer ${
            statusFilter === "all"
              ? "bg-forest-50/60 border-forest-800 ring-2 ring-forest-800/20 shadow-md scale-[1.02]"
              : "bg-white border-cream-200/90 hover:border-cream-300 hover:shadow-md"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-charcoal-400 uppercase tracking-wider">
                รายการทั้งหมด
              </p>
              <h3 className="text-2xl font-bold text-forest-900 mt-1">
                {counts.total}
              </h3>
            </div>
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
                statusFilter === "all"
                  ? "bg-forest-800 text-white shadow-xs"
                  : "bg-forest-50 text-forest-800 border border-forest-200"
              }`}
            >
              <Tag size={20} />
            </div>
          </div>
        </button>

        {/* Card 2: กำลังเปิดใช้งาน */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter("active");
            setCurrentPage(1);
          }}
          className={`rounded-3xl p-4 sm:p-5 shadow-panel border text-left transition-all cursor-pointer ${
            statusFilter === "active"
              ? "bg-forest-50/70 border-forest-700 ring-2 ring-forest-700/20 shadow-md scale-[1.02]"
              : "bg-white border-cream-200/90 hover:border-cream-300 hover:shadow-md"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-charcoal-400 uppercase tracking-wider">
                กำลังเปิดใช้งาน
              </p>
              <h3 className="text-2xl font-bold text-forest-700 mt-1">
                {counts.active}
              </h3>
            </div>
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
                statusFilter === "active"
                  ? "bg-forest-700 text-white shadow-xs"
                  : "bg-forest-50 text-forest-700 border border-forest-200"
              }`}
            >
              <CheckCircle2 size={20} />
            </div>
          </div>
        </button>

        {/* Card 3: ปิดใช้งาน */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter("inactive");
            setCurrentPage(1);
          }}
          className={`rounded-3xl p-4 sm:p-5 shadow-panel border text-left transition-all cursor-pointer ${
            statusFilter === "inactive"
              ? "bg-cream-100/80 border-charcoal-700 ring-2 ring-charcoal-700/20 shadow-md scale-[1.02]"
              : "bg-white border-cream-200/90 hover:border-cream-300 hover:shadow-md"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-charcoal-400 uppercase tracking-wider">
                ปิดใช้งาน
              </p>
              <h3 className="text-2xl font-bold text-charcoal-700 mt-1">
                {counts.inactive}
              </h3>
            </div>
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
                statusFilter === "inactive"
                  ? "bg-charcoal-700 text-white shadow-xs"
                  : "bg-cream-100 text-charcoal-600 border border-cream-300"
              }`}
            >
              <ToggleLeft size={20} />
            </div>
          </div>
        </button>

        {/* Card 4: หมดอายุ / สิทธิ์เต็ม */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter("expired");
            setCurrentPage(1);
          }}
          className={`rounded-3xl p-4 sm:p-5 shadow-panel border text-left transition-all cursor-pointer ${
            statusFilter === "expired"
              ? "bg-rose-50/60 border-rose-600 ring-2 ring-rose-600/20 shadow-md scale-[1.02]"
              : "bg-white border-cream-200/90 hover:border-cream-300 hover:shadow-md"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-charcoal-400 uppercase tracking-wider">
                หมดอายุ / สิทธิ์เต็ม
              </p>
              <h3 className="text-2xl font-bold text-rose-700 mt-1">
                {counts.expired}
              </h3>
            </div>
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${
                statusFilter === "expired"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              <AlertCircle size={20} />
            </div>
          </div>
        </button>

        {/* Card 5: ถูกใช้งานแล้ว */}
        <button
          type="button"
          onClick={() => {
            setStatusFilter("used");
            setCurrentPage(1);
          }}
          className={`rounded-3xl p-4 sm:p-5 shadow-panel border text-left transition-all cursor-pointer col-span-2 sm:col-span-1 lg:col-span-1 ${
            statusFilter === "used"
              ? "bg-amber-50/80 border-amber-500 ring-2 ring-amber-400/30 shadow-md scale-[1.02]"
              : "bg-white border-cream-200/90 hover:border-cream-300 hover:shadow-md"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-charcoal-400 uppercase tracking-wider">
                ถูกใช้งานแล้ว
              </p>
              <h3 className="text-2xl font-bold text-amber-700 mt-1">
                {counts.usedPromos}{" "}
                <span className="text-xs font-normal text-charcoal-400">
                  โปรโมชั่น
                </span>
              </h3>
              <p className="text-[11px] text-amber-600/90 mt-0.5 font-medium">
                (ยอดใช้รวม {counts.totalUsed} ครั้ง)
              </p>
            </div>
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors shrink-0 ${
                statusFilter === "used"
                  ? "bg-amber-500 text-white shadow-xs"
                  : "bg-amber-50 text-amber-700 border border-amber-200"
              }`}
            >
              <Sparkles size={20} />
            </div>
          </div>
        </button>
      </div>

      {/* Main Table Container */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/90 overflow-hidden flex flex-col min-h-[660px]">
        {/* Panel Header & Search Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-cream-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2.5 h-2.5 rounded-full bg-forest-800" />
            <h2 className="text-base font-bold text-forest-900">
              รายการโปรโมชั่น
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-forest-50 text-forest-800 border border-forest-200 font-mono">
              {filtered.length} รายการ
            </span>

            {statusFilter !== "all" && (
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-cream-100 text-charcoal-700 border border-cream-200 flex items-center gap-1.5 ml-1">
                <span>
                  กรอง:{" "}
                  {statusFilter === "active"
                    ? "เปิดใช้งาน"
                    : statusFilter === "inactive"
                    ? "ปิดใช้งาน"
                    : statusFilter === "expired"
                    ? "หมดอายุ/สิทธิ์เต็ม"
                    : `ใช้งานแล้ว (${counts.usedPromos} โปรโมชั่น)`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setCurrentPage(1);
                  }}
                  className="text-charcoal-400 hover:text-charcoal-700 p-0.5"
                  title="รีเซ็ตตัวกรอง"
                >
                  <X size={12} />
                </button>
              </span>
            )}
          </div>

          <div className="relative w-full sm:w-72">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400"
            />
            <input
              type="text"
              className="w-full pl-9 pr-8 py-2 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
              placeholder="ค้นหาชื่อหรือโค้ดโปรโมชั่น..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-600 text-xs p-0.5 rounded-full hover:bg-cream-200 cursor-pointer"
                title="ล้างคำค้นหา"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Table Wrapper (Fixed Height) */}
        <div className="overflow-x-auto border border-cream-200/90 rounded-2xl shadow-2xs mt-4 flex-1 flex flex-col min-h-[460px] bg-white">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50/80 text-xs font-bold text-charcoal-600 uppercase tracking-wider select-none shadow-2xs">
                <th className="px-4 py-3.5 whitespace-nowrap">โค้ด</th>
                <th className="px-4 py-3.5">ชื่อโปรโมชั่น</th>
                <th className="px-4 py-3.5">ห้องพัก & บัตรเสริมเรือ</th>
                <th className="px-4 py-3.5 whitespace-nowrap">ส่วนลด</th>
                <th className="px-4 py-3.5 whitespace-nowrap">เงื่อนไข</th>
                <th className="px-4 py-3.5 whitespace-nowrap">ระยะเวลา</th>
                <th className="px-4 py-3.5 whitespace-nowrap">ใช้แล้ว</th>
                <th className="px-4 py-3.5 whitespace-nowrap">สถานะ</th>
                <th className="px-4 py-3.5 text-right whitespace-nowrap">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100 bg-white text-xs text-charcoal-700">
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-16 text-center text-charcoal-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock
                        className="animate-spin text-forest-800"
                        size={24}
                      />
                      <span className="text-xs font-medium">กำลังโหลดข้อมูล...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-6 py-16 text-center text-charcoal-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <Tag size={32} className="text-cream-300 mb-1" />
                      <p className="font-semibold text-charcoal-700 text-sm">
                        ไม่พบข้อมูลโปรโมชั่น
                      </p>
                      <p className="text-xs text-charcoal-400">
                        ลองค้นหาด้วยคำอื่น หรือกดเพิ่มโปรโมชั่นใหม่
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedPromotions.map((p) => {
                  const targetRoom = roomTypes.find(
                    (r) => r.id === p.room_type_id,
                  );
                  const roomName =
                    p.room_type_name || targetRoom?.name || "ทุกประเภทห้อง";

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-cream-50/50 transition-colors"
                    >
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center font-mono font-bold text-forest-800 bg-forest-50/80 border border-forest-200 px-2.5 py-1 rounded-lg text-xs tracking-wider">
                            {p.code}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(p.code);
                              notify.success("คัดลอกโค้ดเรียบร้อย");
                            }}
                            className="text-charcoal-400 hover:text-forest-800 p-1 rounded-md hover:bg-forest-50 transition-colors cursor-pointer"
                            title="คัดลอกโค้ด"
                          >
                            <Copy size={13} />
                          </button>
                        </div>
                        <p className="mt-1 text-xs font-medium text-charcoal-400">
                          {appliesToLabel(parseAppliesTo(p.applies_to))}
                        </p>
                      </td>
                      <td className="px-4 py-3.5 max-w-[200px]">
                        <p className="font-bold text-charcoal-900 truncate">
                          {p.name}
                        </p>
                        {p.description && (
                          <p className="text-xs text-charcoal-400 mt-0.5 line-clamp-1">
                            {p.description}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-charcoal-800 font-semibold">
                            <Bed size={13} className="text-forest-700" />
                            <span>
                              {roomName} ({p.room_count || 1} ห้อง)
                            </span>
                          </div>
                          {Boolean(p.boat_ticket_count) && (
                            <div className="flex items-center gap-1.5 text-lagoon-800 font-semibold">
                              <Ship size={13} className="text-lagoon-600" />
                              <span>
                                บัตรเสริมเรือ {p.boat_ticket_count} ครั้ง/ห้อง
                                {p.boat_addon_mode === "paid"
                                  ? ` (ขาย ฿${p.boat_addon_price ?? 0}/ครั้ง)`
                                  : " (แจกฟรี)"}
                              </span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {p.discount_type === "percent" ? (
                            <>
                              <Percent size={13} className="text-forest-700" />
                              <span className="font-bold text-forest-900 text-xs">
                                {p.discount_value}%
                              </span>
                            </>
                          ) : (
                            <>
                              <DollarSign
                                size={13}
                                className="text-forest-700"
                              />
                              <span className="font-bold text-forest-900 text-xs">
                                ฿{Number(p.discount_value).toLocaleString()}
                              </span>
                            </>
                          )}
                        </div>
                        {p.max_discount && (
                          <p className="text-xs text-charcoal-400 mt-0.5">
                            สูงสุด ฿{Number(p.max_discount).toLocaleString()}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-charcoal-600 whitespace-nowrap">
                        {p.min_nights && <p>• ขั้นต่ำ {p.min_nights} คืน</p>}
                        {p.min_price && (
                          <p>
                            • ขั้นต่ำ ฿{Number(p.min_price).toLocaleString()}
                          </p>
                        )}
                        {!p.min_nights && !p.min_price && (
                          <span className="text-charcoal-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-charcoal-600 whitespace-nowrap">
                        {p.start_date
                          ? new Date(p.start_date).toLocaleDateString("th-TH", {
                              day: "numeric",
                              month: "short",
                              year: "2-digit",
                            })
                          : "∞"}
                        {" – "}
                        {p.end_date
                          ? new Date(p.end_date).toLocaleDateString("th-TH", {
                              day: "numeric",
                              month: "short",
                              year: "2-digit",
                            })
                          : "∞"}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-semibold text-charcoal-700 whitespace-nowrap">
                        {p.usage_count}
                        {p.usage_limit ? ` / ${p.usage_limit}` : ""} ครั้ง
                      </td>

                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {(() => {
                          const isExpired = isPromoExpired(p.end_date);
                          const isLimitReached =
                            p.usage_limit && p.usage_count >= p.usage_limit;

                          if (isExpired) {
                            return (
                              <span className="inline-flex items-center gap-1 text-xs bg-rose-50 text-rose-700 border border-rose-200 font-semibold px-2.5 py-1 rounded-full">
                                หมดอายุ
                              </span>
                            );
                          }
                          if (isLimitReached) {
                            return (
                              <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-800 border border-amber-200 font-semibold px-2.5 py-1 rounded-full">
                                สิทธิ์เต็มแล้ว
                              </span>
                            );
                          }
                          return (
                            <button
                              disabled={!canEdit}
                              onClick={() => handleToggle(p)}
                              className="inline-flex items-center focus:outline-none transition-transform active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {p.is_active ? (
                                <span className="inline-flex items-center gap-1.5 text-xs bg-forest-50 text-forest-800 border border-forest-200 font-semibold px-2.5 py-1 rounded-full">
                                  <ToggleRight
                                    size={14}
                                    className="text-forest-700"
                                  />{" "}
                                  เปิดใช้งาน
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-xs bg-cream-100 text-charcoal-500 border border-cream-200 font-semibold px-2.5 py-1 rounded-full">
                                  <ToggleLeft
                                    size={14}
                                    className="text-charcoal-400"
                                  />{" "}
                                  ปิดใช้งาน
                                </span>
                              )}
                            </button>
                          );
                        })()}
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => void openRedemptions(p)}
                            className="p-1.5 text-charcoal-400 hover:text-forest-800 hover:bg-forest-50 rounded-lg transition-all cursor-pointer"
                            title="ดูผู้ใช้"
                          >
                            <Users size={15} />
                          </button>
                          <button
                            disabled={!canEdit}
                            onClick={() => openEdit(p)}
                            className="p-1.5 text-charcoal-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="แก้ไข"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            disabled={!canEdit}
                            onClick={() => setDeletingPromotion(p)}
                            className="p-1.5 text-charcoal-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                            title="ลบ"
                          >
                            <Trash2 size={15} />
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-auto border-t border-cream-200 text-xs text-charcoal-500">
          <div>
            แสดง {filtered.length === 0 ? 0 : (safeCurrentPage - 1) * itemsPerPage + 1} -{" "}
            {Math.min(safeCurrentPage * itemsPerPage, filtered.length)} จากทั้งหมด{" "}
            <span className="font-bold text-forest-900">{filtered.length}</span> รายการ
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={safeCurrentPage <= 1}
                className="p-1.5 rounded-lg border border-cream-200 text-charcoal-600 hover:bg-cream-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="หน้าแรก"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage <= 1}
                className="p-1.5 rounded-lg border border-cream-200 text-charcoal-600 hover:bg-cream-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="ก่อนหน้า"
              >
                <ChevronLeft size={14} />
              </button>

              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((page) => {
                    return (
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - safeCurrentPage) <= 1
                    );
                  })
                  .map((page, idx, arr) => {
                    const prev = arr[idx - 1];
                    const showEllipsis = prev && page - prev > 1;
                    return (
                      <div key={page} className="flex items-center gap-1">
                        {showEllipsis && (
                          <span className="px-1 text-charcoal-400">...</span>
                        )}
                        <button
                          onClick={() => setCurrentPage(page)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                            safeCurrentPage === page
                              ? "bg-forest-800 text-white shadow-2xs"
                              : "border border-cream-200 text-charcoal-600 hover:bg-cream-100"
                          }`}
                        >
                          {page}
                        </button>
                      </div>
                    );
                  })}
              </div>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage >= totalPages}
                className="p-1.5 rounded-lg border border-cream-200 text-charcoal-600 hover:bg-cream-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="ถัดไป"
              >
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={safeCurrentPage >= totalPages}
                className="p-1.5 rounded-lg border border-cream-200 text-charcoal-600 hover:bg-cream-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="หน้าสุดท้าย"
              >
                <ChevronsRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Redemption History Card */}
      {redemptionPromo && (
        <div className="rounded-3xl border border-cream-200/90 bg-white p-5 sm:p-6 shadow-panel">
          <div className="mb-4 flex items-center justify-between gap-3 pb-3 border-b border-cream-200">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-forest-800" />
              <h3 className="text-sm font-bold text-forest-900">
                ผู้ใช้ / ประวัติ — <span className="font-mono">{redemptionPromo.code}</span>
              </h3>
            </div>
            <button
              type="button"
              className="text-xs text-charcoal-400 hover:text-charcoal-700 p-1 rounded-lg hover:bg-cream-100 transition-colors"
              onClick={() => {
                setRedemptionPromo(null);
                setRedemptions(null);
              }}
            >
              <X size={16} />
            </button>
          </div>
          {redemptionsLoading ? (
            <div className="flex items-center justify-center py-8 text-xs font-medium text-charcoal-500 gap-2">
              <Clock className="animate-spin text-forest-800" size={16} />
              <span>กำลังโหลด...</span>
            </div>
          ) : redemptions == null || redemptions.redemptions.length === 0 ? (
            <p className="text-xs text-charcoal-400 text-center py-6">ยังไม่มีคนใช้โค้ดนี้</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-charcoal-500">
                เก็บแล้ว <span className="font-bold text-forest-900">{redemptions.wallet.saved}</span> · ใช้ครบ{" "}
                <span className="font-bold text-forest-900">{redemptions.wallet.used}</span> · หมดอายุ{" "}
                <span className="font-bold text-rose-600">{redemptions.wallet.expired}</span>
              </p>
              <div className="overflow-x-auto border border-cream-200/90 rounded-2xl shadow-2xs">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="text-left bg-cream-50/80 border-b border-cream-200 font-bold text-charcoal-600">
                      <th className="px-4 py-3">สมาชิก</th>
                      <th className="px-4 py-3">ประเภท</th>
                      <th className="px-4 py-3">รหัสจอง</th>
                      <th className="px-4 py-3">สถานะ</th>
                      <th className="px-4 py-3">ส่วนลด</th>
                      <th className="px-4 py-3">วันที่</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-cream-100 text-charcoal-700">
                    {redemptions.redemptions.map((row) => (
                      <tr key={row.booking_promotion_id} className="hover:bg-cream-50/50 transition-colors">
                        <td className="px-4 py-2.5">
                          {row.first_name || ""} {row.last_name || ""} <span className="text-charcoal-400">({row.email})</span>
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-charcoal-800">
                          {row.booking_type === "room" ? "ห้องพัก" : "เรือ"}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-forest-800 font-bold">
                          #{row.room_booking_id ?? row.boat_booking_id}
                        </td>
                        <td className="px-4 py-2.5">{row.booking_status}</td>
                        <td className="px-4 py-2.5 font-bold text-forest-800 tabular-nums">
                          ฿{Number(row.discount_amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-charcoal-500">
                          {new Date(row.created_at).toLocaleString("th-TH")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Modal Form */}
      <Modal
        open={showModal}
        title={editingId ? "แก้ไขโปรโมชั่น" : "เพิ่มโปรโมชั่นใหม่"}
        onClose={() => setShowModal(false)}
        widthClass="max-w-6xl"
      >
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3">
          {/* Top Segmented Tab Switcher (Room vs Kayak) */}
          <div className="flex p-1 bg-cream-100 rounded-2xl border border-cream-200">
            <button
              type="button"
              onClick={() => {
                setPromoTab("room");
                setForm((f) => ({ ...f, applies_to: "room" }));
              }}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                promoTab === "room"
                  ? "bg-forest-800 text-white shadow-xs"
                  : "text-charcoal-600 hover:text-forest-900 hover:bg-cream-200/50"
              }`}
            >
              <Bed size={14} />
              <span>โปรโมชั่นห้องพัก</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setPromoTab("kayak");
                setForm((f) => ({ ...f, applies_to: "kayak", min_nights: "" }));
              }}
              className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                promoTab === "kayak"
                  ? "bg-forest-800 text-white shadow-xs"
                  : "text-charcoal-600 hover:text-forest-900 hover:bg-cream-200/50"
              }`}
            >
              <Ship size={14} />
              <span>โปรโมชั่นเรือ</span>
            </button>
          </div>

          {/* TAB 1: โปรโมชั่นห้องพัก (Side-by-side 2-column layout) */}
          {promoTab === "room" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 items-start animate-in fade-in duration-150">
              {/* คอลัมน์ซ้าย: ข้อมูลส่วนลดห้องพัก */}
              <div className="bg-cream-50/50 p-3.5 rounded-2xl border border-cream-200/80 space-y-2.5">
                <div className="flex items-center gap-2 pb-1.5 border-b border-cream-200/70">
                  <Bed size={14} className="text-forest-700" />
                  <span className="text-xs font-bold text-forest-900">
                    ข้อมูลส่วนลดห้องพัก
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-charcoal-700 mb-0.5">
                      โค้ดส่วนลด <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className="w-full bg-white border border-cream-200 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold uppercase text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.code}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          code: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="เช่น ROOM10"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-charcoal-700 mb-0.5">
                      ชื่อโปรโมชั่น <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className="w-full bg-white border border-cream-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="เช่น ลดค่าห้อง 10%"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-bold text-charcoal-700 mb-0.5">
                      คำอธิบาย / เงื่อนไขย่อ
                    </label>
                    <input
                      className="w-full bg-white border border-cream-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.description}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value }))
                      }
                      placeholder="เช่น สำหรับเข้าพักวันธรรมดา หรือจองล่วงหน้า..."
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-charcoal-700 mb-0.5">
                      ประเภทส่วนลด <span className="text-rose-500">*</span>
                    </label>
                    <CustomSelect
                      options={DISCOUNT_TYPE_OPTIONS}
                      value={form.discount_type}
                      onChange={(val) =>
                        setForm((f) => ({
                          ...f,
                          discount_type: val as "percent" | "fixed",
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-charcoal-700 mb-0.5">
                      มูลค่าส่วนลด <span className="text-rose-500">*</span>{" "}
                      {form.discount_type === "percent" ? "(%)" : "(฿)"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={form.discount_type === "percent" ? "100" : undefined}
                      step="0.01"
                      className="w-full bg-white border border-cream-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.discount_value}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          discount_value: e.target.value,
                        }))
                      }
                      placeholder={form.discount_type === "percent" ? "เช่น 10" : "เช่น 300"}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-charcoal-700 mb-0.5">
                      จองขั้นต่ำ (คืน)
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="w-full bg-white border border-cream-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.min_nights}
                      onChange={(e) => setForm((f) => ({ ...f, min_nights: e.target.value }))}
                      placeholder="ไม่จำกัด (เว้นว่างได้)"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-charcoal-700 mb-0.5">
                      ยอดจองขั้นต่ำ (฿)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full bg-white border border-cream-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.min_price}
                      onChange={(e) => setForm((f) => ({ ...f, min_price: e.target.value }))}
                      placeholder="ไม่จำกัด (เว้นว่างได้)"
                    />
                  </div>
                </div>
              </div>

              {/* คอลัมน์ขวา: เงื่อนไขและระยะเวลา + Add-on เสริมเรือ */}
              <div className="bg-cream-50/50 p-3.5 rounded-2xl border border-cream-200/80 space-y-2.5">
                <div className="flex items-center gap-2 pb-1.5 border-b border-cream-200/70">
                  <Calendar size={14} className="text-forest-700" />
                  <span className="text-xs font-bold text-forest-900">
                    เงื่อนไขและระยะเวลา
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-bold text-charcoal-700 mb-0.5">
                      ลดได้สูงสุดไม่เกิน (฿)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full bg-white border border-cream-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.max_discount}
                      onChange={(e) => setForm((f) => ({ ...f, max_discount: e.target.value }))}
                      placeholder="ไม่จำกัด (เว้นว่างได้)"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-charcoal-700 mb-0.5">
                      สิทธิ์ทั้งหมด (ใบ)
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="w-full bg-white border border-cream-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.usage_limit}
                      onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))}
                      placeholder="ไม่จำกัด (เช่น 100)"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-charcoal-700 mb-0.5">
                      วันที่เริ่มใช้งาน
                    </label>
                    <CustomDatePicker
                      value={form.start_date || ""}
                      onChange={(val) => setForm((f) => ({ ...f, start_date: val }))}
                      placeholder="เริ่มทันที"
                      className="w-full relative"
                      buttonClassName="w-full flex items-center justify-between bg-white border border-cream-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-charcoal-800 hover:border-forest-300 focus:outline-none focus:ring-2 focus:ring-forest-800/20 shadow-2xs"
                      showCalendarIcon
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-charcoal-700 mb-0.5">
                      วันที่สิ้นสุดการใช้งาน
                    </label>
                    <CustomDatePicker
                      value={form.end_date || ""}
                      onChange={(val) => setForm((f) => ({ ...f, end_date: val }))}
                      placeholder="ไม่กำหนดวันหมดอายุ"
                      min={form.start_date}
                      className="w-full relative"
                      buttonClassName="w-full flex items-center justify-between bg-white border border-cream-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-charcoal-800 hover:border-forest-300 focus:outline-none focus:ring-2 focus:ring-forest-800/20 shadow-2xs"
                      showCalendarIcon
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-charcoal-700 mb-0.5">
                      จำกัดต่อสมาชิก (ครั้ง/คน)
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="w-full bg-white border border-cream-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.usage_limit_per_member}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          usage_limit_per_member: e.target.value,
                        }))
                      }
                      placeholder="ไม่จำกัด (เช่น 1)"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="block text-[11px] font-bold text-charcoal-700 mb-0.5">
                      สถานะเปิดใช้งาน
                    </label>
                    <div className="flex items-center justify-between px-2.5 py-1 bg-white border border-cream-200 rounded-xl h-[33px]">
                      <span className="text-xs font-semibold text-charcoal-700">
                        {form.is_active ? "เปิดใช้งานทันที" : "ปิดใช้งาน"}
                      </span>
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={form.is_active}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, is_active: e.target.checked }))
                          }
                        />
                        <div className="w-8 h-4.5 bg-cream-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-cream-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-forest-800 relative"></div>
                      </label>
                    </div>
                  </div>

                  {/* Add-on เสริมเรือ (ทางเลือก) - การ์ดคอนทราสต์ชัดเจน มองเห็นช่องกรอกชัดเจน ไม่กลืนกับพื้นหลัง */}
                  <div className="sm:col-span-2 pt-1 border-t border-cream-200/70">
                    <div className={`p-2.5 rounded-xl border transition-all ${
                      hasBoatAddon
                        ? "bg-emerald-50/70 border-forest-600 shadow-xs ring-1 ring-forest-500/30"
                        : "bg-white border-cream-300 hover:border-forest-400"
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                            hasBoatAddon ? "bg-forest-800 text-white shadow-2xs" : "bg-cream-100 text-forest-700"
                          }`}>
                            <Ship size={13} />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-charcoal-900">
                              Add-on สิทธิพิเศษเรือพาย/คายัค
                            </span>
                            <span className="text-[10px] text-charcoal-500 ml-1.5 hidden sm:inline">
                              (ให้สิทธิ์เรือเสริมเมื่อจองห้องพัก)
                            </span>
                          </div>
                        </div>

                        {/* ปุ่มเปิด/ปิด Add-on ชัดเจน มองเห็นง่าย ไม่จม */}
                        <button
                          type="button"
                          onClick={() => {
                            const next = !hasBoatAddon;
                            setHasBoatAddon(next);
                            if (!next) {
                              setForm((f) => ({
                                ...f,
                                room_type_id: "",
                                boat_ticket_count: "1",
                                boat_addon_mode: "free",
                                boat_addon_price: "",
                              }));
                            }
                          }}
                          className={`flex items-center gap-2 px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            hasBoatAddon
                              ? "bg-forest-800 text-white border-forest-800 shadow-2xs"
                              : "bg-cream-100 text-charcoal-600 border-cream-300 hover:bg-cream-200 hover:text-charcoal-800"
                          }`}
                        >
                          <span>{hasBoatAddon ? "เปิด Add-on" : "ปิด (ไม่เพิ่ม)"}</span>
                          <div className={`w-7 h-4 rounded-full relative transition-colors ${
                            hasBoatAddon ? "bg-forest-600" : "bg-cream-300"
                          }`}>
                            <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                              hasBoatAddon ? "right-0.5" : "left-0.5"
                            }`} />
                          </div>
                        </button>
                      </div>

                      {hasBoatAddon && (
                        <div className="mt-2.5 pt-2.5 border-t border-forest-300 grid grid-cols-1 sm:grid-cols-3 gap-2.5 animate-in fade-in duration-150">
                          <div>
                            <label className="block text-[11px] font-bold text-forest-950 mb-1">
                              เฉพาะห้องพัก
                            </label>
                            <CustomSelect
                              buttonClassName="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 bg-white border border-forest-300 hover:border-forest-600 rounded-xl text-xs font-bold text-charcoal-800 transition-all focus:outline-none focus:ring-2 focus:ring-forest-500/20 shadow-xs"
                              options={[
                                { value: "", label: "ทุกประเภทห้อง" },
                                ...roomTypes.map((rt) => ({
                                  value: String(rt.id),
                                  label: rt.name || `ห้องพัก ${rt.id}`,
                                })),
                              ]}
                              value={form.room_type_id}
                              onChange={(val) =>
                                setForm((f) => ({ ...f, room_type_id: val }))
                              }
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-forest-950 mb-1">
                              จำนวนบัตรเรือ (รอบ)
                            </label>
                            <input
                              type="number"
                              min="1"
                              className="w-full bg-white border border-forest-300 hover:border-forest-600 rounded-xl px-2.5 py-1.5 text-xs font-bold text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-800/30 shadow-xs"
                              value={form.boat_ticket_count}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  boat_ticket_count: e.target.value,
                                }))
                              }
                              placeholder="1"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-forest-950 mb-1">
                              เงื่อนไขบัตรเรือ
                            </label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((f) => ({ ...f, boat_addon_mode: "free", boat_addon_price: "" }))
                                }
                                className={`py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                  form.boat_addon_mode === "free"
                                    ? "bg-forest-800 text-white border-forest-800 shadow-xs"
                                    : "bg-white text-charcoal-700 border-forest-200 hover:bg-forest-50/50"
                                }`}
                              >
                                ฟรี
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((f) => ({ ...f, boat_addon_mode: "paid" }))
                                }
                                className={`py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                                  form.boat_addon_mode === "paid"
                                    ? "bg-forest-800 text-white border-forest-800 shadow-xs"
                                    : "bg-white text-charcoal-700 border-forest-200 hover:bg-forest-50/50"
                                }`}
                              >
                                จ่ายเพิ่ม
                              </button>
                            </div>
                          </div>

                          {form.boat_addon_mode === "paid" && (
                            <div className="sm:col-span-3 pt-1">
                              <label className="block text-[11px] font-bold text-forest-950 mb-1">
                                ราคาบัตรเรือพิเศษ (฿ / บัตร) <span className="text-rose-600 font-bold">*</span>
                              </label>
                              <input
                                type="number"
                                min="0"
                                className="w-full bg-white border border-forest-300 hover:border-forest-600 rounded-xl px-2.5 py-1.5 text-xs font-bold text-charcoal-900 focus:outline-none focus:ring-2 focus:ring-forest-800/30 shadow-xs"
                                value={form.boat_addon_price}
                                onChange={(e) =>
                                  setForm((f) => ({
                                    ...f,
                                    boat_addon_price: e.target.value,
                                  }))
                                }
                                placeholder="เช่น 150"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: โปรโมชั่นเรือ / คายัค (Side-by-side 2-column layout) */}
          {promoTab === "kayak" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start animate-in fade-in duration-150">
              {/* คอลัมน์ซ้าย: ข้อมูลส่วนลดเรือ */}
              <div className="bg-cream-50/50 p-4 rounded-2xl border border-cream-200/80 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-cream-200/70">
                  <Ship size={15} className="text-forest-700" />
                  <span className="text-xs font-bold text-forest-900">
                    ข้อมูลส่วนลดเรือ
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-charcoal-700 mb-1">
                      โค้ดส่วนลดเรือ <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className="w-full bg-white border border-cream-200 rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.code}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          code: e.target.value.toUpperCase(),
                        }))
                      }
                      placeholder="เช่น BOAT20"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-charcoal-700 mb-1">
                      ชื่อโปรโมชั่น <span className="text-rose-500">*</span>
                    </label>
                    <input
                      className="w-full bg-white border border-cream-200 rounded-xl px-3 py-2 text-xs font-semibold text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="เช่น ลดค่าเรือ 20%"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-charcoal-700 mb-1">
                      คำอธิบาย / เงื่อนไขย่อ
                    </label>
                    <input
                      className="w-full bg-white border border-cream-200 rounded-xl px-3 py-2 text-xs font-semibold text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.description}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, description: e.target.value }))
                      }
                      placeholder="เช่น ใช้ได้เฉพาะการจองกิจกรรมเรือพายและคายัค..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal-700 mb-1">
                      ประเภทส่วนลด <span className="text-rose-500">*</span>
                    </label>
                    <CustomSelect
                      options={DISCOUNT_TYPE_OPTIONS}
                      value={form.discount_type}
                      onChange={(val) =>
                        setForm((f) => ({
                          ...f,
                          discount_type: val as "percent" | "fixed",
                        }))
                      }
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal-700 mb-1">
                      มูลค่าส่วนลด <span className="text-rose-500">*</span>{" "}
                      {form.discount_type === "percent" ? "(%)" : "(฿)"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max={form.discount_type === "percent" ? "100" : undefined}
                      step="0.01"
                      className="w-full bg-white border border-cream-200 rounded-xl px-3 py-2 text-xs font-semibold text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.discount_value}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          discount_value: e.target.value,
                        }))
                      }
                      placeholder={form.discount_type === "percent" ? "เช่น 20" : "เช่น 100"}
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-charcoal-700 mb-1">
                      ยอดจองเรือขั้นต่ำ (฿)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full bg-white border border-cream-200 rounded-xl px-3 py-2 text-xs font-semibold text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.min_price}
                      onChange={(e) => setForm((f) => ({ ...f, min_price: e.target.value }))}
                      placeholder="ไม่จำกัด (เว้นว่างได้)"
                    />
                  </div>
                </div>
              </div>

              {/* คอลัมน์ขวา: เงื่อนไขและระยะเวลาเรือ */}
              <div className="bg-cream-50/50 p-4 rounded-2xl border border-cream-200/80 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-cream-200/70">
                  <Calendar size={15} className="text-forest-700" />
                  <span className="text-xs font-bold text-forest-900">
                    เงื่อนไขและระยะเวลา
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-charcoal-700 mb-1">
                      ลดได้สูงสุดไม่เกิน (฿)
                    </label>
                    <input
                      type="number"
                      min="0"
                      className="w-full bg-white border border-cream-200 rounded-xl px-3 py-2 text-xs font-semibold text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.max_discount}
                      onChange={(e) => setForm((f) => ({ ...f, max_discount: e.target.value }))}
                      placeholder="ไม่จำกัด (เว้นว่างได้)"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-charcoal-700 mb-1">
                      สิทธิ์ทั้งหมด (ใบ)
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="w-full bg-white border border-cream-200 rounded-xl px-3 py-2 text-xs font-semibold text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.usage_limit}
                      onChange={(e) => setForm((f) => ({ ...f, usage_limit: e.target.value }))}
                      placeholder="ไม่จำกัด (เช่น 50)"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal-700 mb-1">
                      วันที่เริ่มใช้งาน
                    </label>
                    <CustomDatePicker
                      value={form.start_date || ""}
                      onChange={(val) => setForm((f) => ({ ...f, start_date: val }))}
                      placeholder="เริ่มทันที"
                      className="w-full relative"
                      buttonClassName="w-full flex items-center justify-between bg-white border border-cream-200 rounded-xl px-3 py-2 text-xs font-semibold text-charcoal-800 hover:border-forest-300 focus:outline-none focus:ring-2 focus:ring-forest-800/20 shadow-2xs"
                      showCalendarIcon
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-charcoal-700 mb-1">
                      วันที่สิ้นสุดการใช้งาน
                    </label>
                    <CustomDatePicker
                      value={form.end_date || ""}
                      onChange={(val) => setForm((f) => ({ ...f, end_date: val }))}
                      placeholder="ไม่กำหนดวันหมดอายุ"
                      min={form.start_date}
                      className="w-full relative"
                      buttonClassName="w-full flex items-center justify-between bg-white border border-cream-200 rounded-xl px-3 py-2 text-xs font-semibold text-charcoal-800 hover:border-forest-300 focus:outline-none focus:ring-2 focus:ring-forest-800/20 shadow-2xs"
                      showCalendarIcon
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-charcoal-700 mb-1">
                      จำกัดต่อสมาชิก (ครั้ง/คน)
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="w-full bg-white border border-cream-200 rounded-xl px-3 py-2 text-xs font-semibold text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                      value={form.usage_limit_per_member}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          usage_limit_per_member: e.target.value,
                        }))
                      }
                      placeholder="ไม่จำกัด (เช่น 1)"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    <label className="block text-xs font-bold text-charcoal-700 mb-1">
                      สถานะเปิดใช้งาน
                    </label>
                    <div className="flex items-center justify-between px-3 py-1.5 bg-white border border-cream-200 rounded-xl h-[38px]">
                      <span className="text-xs font-semibold text-charcoal-700">
                        {form.is_active ? "เปิดใช้งานทันที" : "ปิดใช้งาน"}
                      </span>
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={form.is_active}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, is_active: e.target.checked }))
                          }
                        />
                        <div className="w-8 h-4.5 bg-cream-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-cream-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-forest-800 relative"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-cream-200">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2.5 text-xs font-bold text-charcoal-600 hover:bg-cream-100 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 bg-forest-800 hover:bg-forest-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-2xs transition-all disabled:opacity-50 cursor-pointer active:scale-98"
            >
              {saving ? (
                <Clock size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}
              <span>{saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deletingPromotion}
        title="ยืนยันการลบโปรโมชั่น"
        onClose={() => !deleting && setDeletingPromotion(null)}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center shrink-0">
              <AlertCircle size={20} />
            </div>
            <div>
              <p className="text-xs text-charcoal-500">
                การดำเนินการนี้จะไม่สามารถย้อนกลับได้
              </p>
            </div>
          </div>

          <div className="bg-cream-50/70 border border-cream-200 rounded-2xl p-4 text-xs text-charcoal-700">
            คุณต้องการลบโปรโมชั่น{" "}
            <span className="font-bold text-rose-700">
              "{deletingPromotion?.name}"
            </span>{" "}
            (โค้ด:{" "}
            <span className="font-mono font-bold text-forest-900">
              {deletingPromotion?.code}
            </span>
            ) ใช่หรือไม่?
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeletingPromotion(null)}
              className="px-4 py-2 text-xs font-bold text-charcoal-600 hover:bg-cream-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={confirmDelete}
              className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
            >
              {deleting ? (
                <Clock size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              <span>{deleting ? "กำลังลบ..." : "ยืนยันลบข้อมูล"}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
