"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Trash2,
  Edit2,
  ToggleLeft,
  ToggleRight,
  Tag,
  Percent,
  DollarSign,
  X,
  Save,
  Search,
  Sparkles,
  CheckCircle2,
  Clock,
  ChevronDown,
  Copy,
  AlertCircle,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast from "react-hot-toast";

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
  usage_count: number;
  is_active: boolean;
  created_at: string;
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
  is_active: true,
};

// 🌟 Component Custom Dropdown
function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "เลือก...",
  width = "w-full",
}: {
  options: { value: string | number; label: string }[];
  value: string | number;
  onChange: (val: any) => void;
  placeholder?: string;
  width?: string;
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

  return (
    <div className={`relative ${width}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 transition-all focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] shadow-2xs"
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-stone-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#0b3b2c]" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full bg-white border border-stone-200 rounded-xl shadow-lg z-50 overflow-hidden py-1 max-h-56 overflow-y-auto animate-in fade-in duration-150">
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
                    ? "bg-emerald-50 text-emerald-900 font-bold"
                    : "text-stone-600 hover:bg-stone-100/80 hover:text-stone-900"
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0b3b2c]" />
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
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const DISCOUNT_TYPE_OPTIONS = [
    { value: "percent", label: "เปอร์เซ็นต์ (%)" },
    { value: "fixed", label: "จำนวนเงิน (฿)" },
  ];

  useEffect(() => {
    if (!ready) return
    fetchPromotions();

    return () => {
      toast.dismiss();
    };
  }, [ready]);

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const res = await api.get("/promotions");
      setPromotions(res.data?.data || []);
    } catch {
      toast.error("โหลดข้อมูลโปรโมชั่นไม่สำเร็จ");
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
        toast.success("แก้ไขโปรโมชั่นสำเร็จ");
      } else {
        await api.post("/promotions", payload);
        toast.success("เพิ่มโปรโมชั่นสำเร็จ");
      }
      setShowModal(false);
      fetchPromotions();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (p: Promotion) => {
    try {
      await api.put(`/promotions/${p.id}/toggle`);
      toast.success(p.is_active ? "ปิดโปรโมชั่นแล้ว" : "เปิดโปรโมชั่นแล้ว");
      fetchPromotions();
    } catch {
      toast.error("เปลี่ยนสถานะไม่สำเร็จ");
    }
  };

  const handleDelete = async (p: Promotion) => {
    if (!confirm(`ต้องการลบโปรโมชั่น "${p.name}" ใช่ไหม?`)) return;
    try {
      await api.delete(`/promotions/${p.id}`);
      toast.success("ลบโปรโมชั่นสำเร็จ");
      fetchPromotions();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || "ลบไม่สำเร็จ");
    }
  };

  const filtered = promotions.filter(
    (p) =>
      (p.name && p.name.toLowerCase().includes(search.toLowerCase())) ||
      (p.code && p.code.toLowerCase().includes(search.toLowerCase())),
  );

  if (!ready) return null;

  return (
    <div className="w-full min-h-screen flex flex-col font-sans space-y-4 pb-10">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/80">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-[#0b3b2c] tracking-tight">
            จัดการโปรโมชั่น
          </h1>
          <p className="text-stone-400 mt-0.5 text-xs md:text-sm">
            สร้างและจัดการโค้ดส่วนลดสำหรับการจองห้องพัก
          </p>
        </div>

        <button
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 bg-[#0b3b2c] hover:bg-[#07271d] text-white px-4 py-2.5 rounded-xl font-medium shadow-2xs transition-all text-sm active:scale-95 cursor-pointer"
        >
          <Plus size={18} />
          <span>เพิ่มโปรโมชั่น</span>
        </button>
      </div>

      {/* 🌟 Stats Cards (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        {/* Card 1: โปรโมชั่นทั้งหมด */}
        <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                โปรโมชั่นทั้งหมด
              </p>
              <h3 className="text-2xl font-extrabold text-[#0b3b2c] mt-1">
                {promotions.length}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#0b3b2c]/10 text-[#0b3b2c] border border-[#0b3b2c]/20 flex items-center justify-center">
              <Tag size={22} />
            </div>
          </div>
        </div>

        {/* Card 2: กำลังเปิดใช้งาน */}
        <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                กำลังเปิดใช้งาน
              </p>
              <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">
                {promotions.filter((p) => p.is_active).length}
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
              <CheckCircle2 size={22} />
            </div>
          </div>
        </div>

        {/* Card 3: ถูกใช้งานไปแล้ว */}
        <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                ถูกใช้งานไปแล้ว
              </p>
              <h3 className="text-2xl font-extrabold text-amber-600 mt-1">
                {promotions.reduce((s, p) => s + (p.usage_count || 0), 0)}{" "}
                <span className="text-xs font-normal text-stone-400">
                  ครั้ง
                </span>
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <Sparkles size={22} />
            </div>
          </div>
        </div>

        {/* Card 4: หมดอายุ / สิทธิ์เต็ม */}
        <div className="bg-white border border-stone-200/80 rounded-2xl p-5 shadow-2xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
                หมดอายุ / สิทธิ์เต็ม
              </p>
              <h3 className="text-2xl font-extrabold text-rose-600 mt-1">
                {
                  promotions.filter((p) => {
                    const isExpired =
                      p.end_date && new Date(p.end_date) < new Date();
                    const isFull =
                      p.usage_limit && p.usage_count >= p.usage_limit;
                    return isExpired || isFull;
                  }).length
                }
              </h3>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
              <AlertCircle size={22} />
            </div>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative mb-2">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
        />
        <input
          className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-medium text-stone-700 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] shadow-2xs transition-all"
          placeholder="ค้นหาชื่อหรือโค้ดโปรโมชั่น..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table Container */}
      <div className="bg-white border border-stone-200/80 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200/80 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                <th className="px-5 py-3.5">โค้ด</th>
                <th className="px-5 py-3.5">ชื่อโปรโมชั่น</th>
                <th className="px-5 py-3.5">ส่วนลด</th>
                <th className="px-5 py-3.5">เงื่อนไข</th>
                <th className="px-5 py-3.5">ระยะเวลา</th>
                <th className="px-5 py-3.5">ใช้แล้ว</th>
                <th className="px-5 py-3.5">สถานะ</th>
                <th className="px-5 py-3.5 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-stone-700">
              {loading ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-stone-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Clock
                        className="animate-spin text-[#0b3b2c]"
                        size={24}
                      />
                      <span>กำลังโหลดข้อมูล...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-12 text-center text-stone-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-1">
                      <Tag size={32} className="text-stone-300 mb-1" />
                      <p className="font-medium text-stone-600">
                        ไม่พบข้อมูลโปรโมชั่น
                      </p>
                      <p className="text-xs text-stone-400">
                        ลองค้นหาด้วยคำอื่น หรือกดเพิ่มโปรโมชั่นใหม่
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-stone-50/80 transition-colors"
                  >
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center font-mono font-bold text-[#0b3b2c] bg-[#0b3b2c]/10 border border-[#0b3b2c]/20 px-2.5 py-1 rounded-lg text-xs tracking-wider">
                          {p.code}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(p.code);
                            toast.success("คัดลอกโค้ดเรียบร้อย");
                          }}
                          className="text-stone-400 hover:text-stone-700 p-1 rounded-md hover:bg-stone-100 transition-colors cursor-pointer"
                          title="คัดลอกโค้ด"
                        >
                          <Copy size={13} />
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-bold text-stone-900">{p.name}</p>
                      {p.description && (
                        <p className="text-[11px] text-stone-400 mt-0.5 line-clamp-1">
                          {p.description}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {p.discount_type === "percent" ? (
                          <>
                            <Percent size={14} className="text-emerald-700" />
                            <span className="font-bold text-emerald-800 text-xs">
                              {p.discount_value}%
                            </span>
                          </>
                        ) : (
                          <>
                            <DollarSign
                              size={14}
                              className="text-emerald-700"
                            />
                            <span className="font-bold text-emerald-800 text-xs">
                              ฿{Number(p.discount_value).toLocaleString()}
                            </span>
                          </>
                        )}
                      </div>
                      {p.max_discount && (
                        <p className="text-[10px] text-stone-400 mt-0.5">
                          สูงสุด ฿{Number(p.max_discount).toLocaleString()}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-stone-600 whitespace-nowrap">
                      {p.min_nights && <p>• ขั้นต่ำ {p.min_nights} คืน</p>}
                      {p.min_price && (
                        <p>• ขั้นต่ำ ฿{Number(p.min_price).toLocaleString()}</p>
                      )}
                      {!p.min_nights && !p.min_price && (
                        <span className="text-stone-300">-</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-stone-600 whitespace-nowrap">
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
                    <td className="px-5 py-4 text-xs font-semibold text-stone-700 whitespace-nowrap">
                      {p.usage_count}
                      {p.usage_limit ? ` / ${p.usage_limit}` : ""} ครั้ง
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      {(() => {
                        const isExpired =
                          p.end_date && new Date(p.end_date) < new Date();
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
                            <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 border border-amber-200 font-semibold px-2.5 py-1 rounded-full">
                              สิทธิ์เต็มแล้ว
                            </span>
                          );
                        }
                        return (
                          <button
                            onClick={() => handleToggle(p)}
                            className="inline-flex items-center focus:outline-none transition-transform active:scale-95 cursor-pointer"
                          >
                            {p.is_active ? (
                              <span className="inline-flex items-center gap-1.5 text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold px-2.5 py-1 rounded-full">
                                <ToggleRight
                                  size={14}
                                  className="text-emerald-600"
                                />{" "}
                                เปิดใช้งาน
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs bg-stone-100 text-stone-500 border border-stone-200 font-semibold px-2.5 py-1 rounded-full">
                                <ToggleLeft
                                  size={14}
                                  className="text-stone-400"
                                />{" "}
                                ปิดใช้งาน
                              </span>
                            )}
                          </button>
                        );
                      })()}
                    </td>

                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 text-stone-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                          title="แก้ไข"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                          title="ลบ"
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

      {/* Modal Form */}
      {showModal && (
        <div
          className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 transition-all animate-in fade-in duration-150"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl border border-stone-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50/50">
              <h3 className="text-sm font-bold text-[#0b3b2c]">
                {editingId ? "แก้ไขโปรโมชั่น" : "เพิ่มโปรโมชั่นใหม่"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    โค้ดโปรโมชั่น <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-mono font-bold uppercase text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        code: e.target.value.toUpperCase(),
                      }))
                    }
                    placeholder="เช่น SUMMER20"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    ชื่อโปรโมชั่น <span className="text-rose-500">*</span>
                  </label>
                  <input
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="เช่น ลดฤดูร้อน 20%"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">
                  คำอธิบาย
                </label>
                <textarea
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all resize-none shadow-2xs"
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="รายละเอียดเพิ่มเติม..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
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
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    มูลค่าส่วนลด <span className="text-rose-500">*</span>{" "}
                    {form.discount_type === "percent" ? "(%)" : "(฿)"}
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={form.discount_type === "percent" ? "100" : undefined}
                    step="0.01"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                    value={form.discount_value}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        discount_value: e.target.value,
                      }))
                    }
                    placeholder={
                      form.discount_type === "percent" ? "เช่น 20" : "เช่น 500"
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    จองขั้นต่ำ (คืน)
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                    value={form.min_nights}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, min_nights: e.target.value }))
                    }
                    placeholder="ไม่จำกัด"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    ยอดขั้นต่ำ (฿)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                    value={form.min_price}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, min_price: e.target.value }))
                    }
                    placeholder="ไม่จำกัด"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    ส่วนลดสูงสุด (฿)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs font-semibold text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                    value={form.max_discount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, max_discount: e.target.value }))
                    }
                    placeholder="ไม่จำกัด"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    วันเริ่ม
                  </label>
                  <input
                    type="date"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, start_date: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    วันสิ้นสุด
                  </label>
                  <input
                    type="date"
                    min={form.start_date}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                    value={form.end_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, end_date: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    จำกัดการใช้ (ครั้ง)
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                    value={form.usage_limit}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, usage_limit: e.target.value }))
                    }
                    placeholder="ไม่จำกัด"
                  />
                </div>
              </div>

              {/* Toggle เปิด/ปิดการใช้งาน */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-stone-600">
                  สถานะโปรโมชั่น
                </span>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={form.is_active}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, is_active: e.target.checked }))
                    }
                  />
                  <div className="w-9 h-5 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0b3b2c] relative"></div>
                  <span className="text-xs font-medium text-stone-700">
                    {form.is_active ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 bg-[#0b3b2c] hover:bg-[#07271d] text-white px-5 py-2 rounded-xl text-xs font-semibold shadow-2xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <Clock size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}
                  <span>{saving ? "กำลังบันทึก..." : "บันทึกโปรโมชั่น"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
