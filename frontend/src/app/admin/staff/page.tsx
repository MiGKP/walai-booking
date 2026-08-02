"use client";

import { useState, useEffect, useRef } from "react";
import {
  UserPlus,
  Eye,
  Power,
  PowerOff,
  X,
  Edit3,
  ShieldCheck,
  Home,
  Ship,
  Phone,
  Mail,
  MapPin,
  CheckCircle2,
  XCircle,
  Users,
  ChevronDown,
  Search,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast from "react-hot-toast";
import { Toaster } from "react-hot-toast";

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
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 transition-all focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 shadow-2xs"
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-stone-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-[#0b3b2c]" : ""}`}
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

export default function StaffManagementPage() {
  const { ready, user } = useAuthGuard({ allowedRoles: ["admin"] });
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "all" | "room_staff" | "boat_staff" | "admin"
  >("all");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  const [staffForm, setStaffForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    role: "room_staff",
    address: "",
    subdistrict: "",
    district: "",
    province: "",
    postal_code: "",
  });

  // Modal State
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const ROLE_OPTIONS = [
    { value: "room_staff", label: "พนักงานจัดการห้องพัก (Room Staff)" },
    { value: "boat_staff", label: "พนักงานจัดการเรือ (Boat Staff)" },
    { value: "admin", label: "ผู้ดูแลระบบ (Admin)" },
  ];

  useEffect(() => {
    if (!ready) return;
    fetchStaff();
  }, [ready]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get("/auth/staff");
      setStaffList(res.data?.data || []);
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลพนักงานได้");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/auth/staff", staffForm);
      toast.success("สร้างบัญชีพนักงานสำเร็จ");
      setStaffForm({
        name: "",
        email: "",
        password: "",
        phone: "",
        role: "room_staff",
        address: "",
        subdistrict: "",
        district: "",
        province: "",
        postal_code: "",
      });
      fetchStaff();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "สร้างพนักงานไม่สำเร็จ");
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    if (user?.id === id) {
      toast.error("ไม่สามารถเปลี่ยนสถานะตัวเองได้");
      return;
    }
    try {
      await api.put(`/auth/staff/${id}/status`, { status: !currentStatus });
      toast.success(
        currentStatus ? "ระงับบัญชีสำเร็จ" : "เปิดใช้งานบัญชีสำเร็จ",
      );
      fetchStaff();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "เปลี่ยนสถานะไม่สำเร็จ");
    }
  };

  const openStaffDetails = (staff: any) => {
    setSelectedStaff(staff);
    setIsModalOpen(true);
  };

  const closeStaffDetails = () => {
    setIsModalOpen(false);
    setSelectedStaff(null);
  };

  const openEditModal = (staff: any) => {
    let firstName = staff.first_name || "";
    let lastName = staff.last_name || "";

    // ถ้าไม่มี first_name แต่มี name ให้ทำการแยกด้วยช่องว่าง
    if (!firstName && staff.name) {
      const parts = staff.name.trim().split(" ");
      firstName = parts[0] || "";
      lastName = parts.slice(1).join(" ") || "";
    }

    setEditingStaff({
      id: staff.id,
      name: staff.name || `${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      email: staff.email,
      phone: staff.phone || "",
      role: staff.role,
      address: staff.address || "",
      subdistrict: staff.subdistrict || "",
      district: staff.district || "",
      province: staff.province || "",
      postal_code: staff.postal_code || "",
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaff) return;
    try {
      await api.put(`/auth/staff/${editingStaff.id}`, editingStaff);
      toast.success("แก้ไขข้อมูลพนักงานสำเร็จ");
      setIsEditModalOpen(false);
      setEditingStaff(null);
      fetchStaff();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "แก้ไขข้อมูลไม่สำเร็จ");
    }
  };

  // กรองรายชื่อตาม Tab ที่เลือก
  const filteredStaffList = staffList.filter((staff) => {
    const matchesRole = activeTab === "all" || staff.role === activeTab;
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && staff.status) ||
      (statusFilter === "inactive" && !staff.status);

    const fullName =
      `${staff.first_name || ""} ${staff.last_name || ""} ${staff.name || ""}`.toLowerCase();
    const searchLower = searchQuery.toLowerCase().trim();

    const matchesSearch =
      !searchQuery ||
      fullName.includes(searchLower) ||
      (staff.email && staff.email.toLowerCase().includes(searchLower)) ||
      (staff.phone && staff.phone.includes(searchLower));

    return matchesRole && matchesStatus && matchesSearch;
  });

  const renderRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[#0b3b2c]/10 text-[#0b3b2c] border border-[#0b3b2c]/20">
            <ShieldCheck size={13} className="text-[#0b3b2c]" />
            ผู้ดูแลระบบ
          </span>
        );
      case "room_staff":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <Home size={13} className="text-emerald-700" />
            จัดการห้องพัก
          </span>
        );
      case "boat_staff":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-teal-50 text-teal-800 border border-teal-200">
            <Ship size={13} className="text-teal-700" />
            จัดการเรือ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-700">
            {role}
          </span>
        );
    }
  };

  if (!ready) return null;

  return (
    <div className="w-full min-h-screen flex flex-col font-sans space-y-4 pb-10">
      {/* Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/80">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-[#0b3b2c] tracking-tight">
            จัดการพนักงาน
          </h1>
          <p className="text-stone-400 mt-0.5 text-xs md:text-sm">
            เพิ่ม ดู และบริหารจัดการสิทธิ์พนักงานในระบบสวนวลัยรุกขเวช
          </p>
        </div>

        <div className="p-3 bg-white rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-3 self-start sm:self-auto">
          <div className="w-8 h-8 rounded-lg bg-[#0b3b2c]/10 flex items-center justify-center text-[#0b3b2c]">
            <Users size={18} />
          </div>
          <div>
            <span className="text-[11px] font-semibold text-stone-400 block leading-tight">
              พนักงานทั้งหมด
            </span>
            <span className="text-sm font-bold text-[#0b3b2c]">
              {staffList.length} คน
            </span>
          </div>
        </div>
      </div>
      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Form Create Staff Column */}
        <div className="lg:col-span-5 bg-white border border-stone-200/80 rounded-2xl shadow-2xs overflow-hidden">
          <div className="p-4 bg-[#0b3b2c] text-white flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-lg">
              <UserPlus size={18} className="text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-wide">
                เพิ่มพนักงานใหม่
              </h2>{" "}
              <p className="text-[11px] text-emerald-100/80">
                กรอกข้อมูลเพื่อสร้างบัญชีผู้ใช้งานใหม่
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateStaff} className="p-5 space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">
                  ชื่อ-นามสกุล <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="นายสมชาย ใจดี"
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                  value={staffForm.name}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, name: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">
                  อีเมล <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="staff@walai.com"
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                  value={staffForm.email}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, email: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    รหัสผ่าน <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                    value={staffForm.password}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, password: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    type="tel"
                    placeholder="0812345678"
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs"
                    value={staffForm.phone}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, phone: e.target.value })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">
                  ตำแหน่ง/บทบาท <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  options={ROLE_OPTIONS}
                  value={staffForm.role}
                  onChange={(val) => setStaffForm({ ...staffForm, role: val })}
                />
              </div>
            </div>

            {/* Address Optional */}
            <div className="pt-3 border-t border-stone-100">
              <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-2">
                ข้อมูลที่อยู่เพิ่มเติม (ตัวเลือก)
              </span>
              <div className="space-y-2">
                <textarea
                  placeholder="บ้านเลขที่, ถนน, อาคาร"
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all shadow-2xs resize-none"
                  rows={2}
                  value={staffForm.address}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, address: e.target.value })
                  }
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="ตำบล/แขวง"
                    className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] shadow-2xs"
                    value={staffForm.subdistrict}
                    onChange={(e) =>
                      setStaffForm({
                        ...staffForm,
                        subdistrict: e.target.value,
                      })
                    }
                  />
                  <input
                    type="text"
                    placeholder="อำเภอ/เขต"
                    className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] shadow-2xs"
                    value={staffForm.district}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, district: e.target.value })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="จังหวัด"
                    className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] shadow-2xs"
                    value={staffForm.province}
                    onChange={(e) =>
                      setStaffForm({ ...staffForm, province: e.target.value })
                    }
                  />
                  <input
                    type="text"
                    placeholder="รหัสไปรษณีย์"
                    maxLength={5}
                    className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] shadow-2xs"
                    value={staffForm.postal_code}
                    onChange={(e) =>
                      setStaffForm({
                        ...staffForm,
                        postal_code: e.target.value,
                      })
                    }
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-[#0b3b2c] hover:bg-[#07271d] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm mt-2"
            >
              <UserPlus size={16} />
              สร้างบัญชีพนักงาน
            </button>
          </form>
        </div>

        {/* Table Staff List Column */}
        <div className="lg:col-span-7 bg-white border border-stone-200/80 rounded-2xl shadow-2xs overflow-hidden flex flex-col h-[580px]">
          {" "}
          {/* Header & Tabs & Search/Status Filters */}
          <div className="p-4 border-b border-stone-100 space-y-3 shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-stone-800">
                รายชื่อพนักงานในระบบ
              </h2>
              <span className="text-[11px] text-stone-400 font-medium">
                แสดงผล {filteredStaffList.length} รายการ
              </span>
            </div>

            {/* 🔍 เพิ่มช่องค้นหา + กรองสถานะ */}
            <div className="flex flex-col sm:flex-row items-center gap-2">
              {/* ช่องค้นหา ชื่อ / เบอร์ / อีเมล */}
              <div className="relative flex-1 w-full">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400"
                />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อ, อีเมล หรือเบอร์โทร..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* ปุ่มกรองสถานะ (ใช้งาน / ระงับ) */}
              <div className="flex items-center gap-1 p-1 bg-stone-100/80 rounded-xl text-xs w-full sm:w-auto shrink-0 justify-between sm:justify-start">
                <button
                  type="button"
                  onClick={() => setStatusFilter("all")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    statusFilter === "all"
                      ? "bg-white text-stone-800 shadow-2xs"
                      : "text-stone-500 hover:text-stone-800"
                  }`}
                >
                  ทั้งหมด
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("active")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                    statusFilter === "active"
                      ? "bg-emerald-50 text-emerald-800 shadow-2xs"
                      : "text-stone-500 hover:text-[#0b3b2c]"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                  ใช้งาน
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter("inactive")}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                    statusFilter === "inactive"
                      ? "bg-rose-50 text-rose-800 shadow-2xs"
                      : "text-stone-500 hover:text-rose-700"
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600" />
                  ระงับ
                </button>
              </div>
            </div>

            {/* Filter Role Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-stone-100/80 rounded-xl overflow-x-auto text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                  activeTab === "all"
                    ? "bg-white text-[#0b3b2c] shadow-2xs"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                ทั้งหมด ({staffList.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("room_staff")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === "room_staff"
                    ? "bg-white text-[#0b3b2c] shadow-2xs"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                <Home size={13} />
                ห้องพัก (
                {staffList.filter((s) => s.role === "room_staff").length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("boat_staff")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === "boat_staff"
                    ? "bg-white text-[#0b3b2c] shadow-2xs"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                <Ship size={13} />
                เรือคายัค (
                {staffList.filter((s) => s.role === "boat_staff").length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("admin")}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === "admin"
                    ? "bg-white text-[#0b3b2c] shadow-2xs"
                    : "text-stone-500 hover:text-stone-800"
                }`}
              >
                <ShieldCheck size={13} />
                ผู้ดูแลระบบ (
                {staffList.filter((s) => s.role === "admin").length})
              </button>
            </div>
          </div>
          {/* Table Area - ปรับให้ Scroll เลื่อนขึ้นลงเฉพาะด้านในส่วนนี้ */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-stone-50 z-10 shadow-2xs">
                <tr className="border-b border-stone-200/80 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                  <th className="px-4 py-3">รายชื่อพนักงาน</th>
                  <th className="px-3 py-3">ตำแหน่ง</th>
                  <th className="px-3 py-3">สถานะ</th>
                  <th className="px-3 py-3 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs text-stone-700">
                {loading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-12 text-center text-stone-400"
                    >
                      <div className="inline-block animate-spin rounded-full h-5 w-5 border-2 border-[#0b3b2c] border-t-transparent mb-2" />
                      <p className="text-xs">กำลังโหลดข้อมูล...</p>
                    </td>
                  </tr>
                ) : filteredStaffList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-12 text-center text-stone-400"
                    >
                      <Users
                        size={32}
                        className="mx-auto mb-2 text-stone-300"
                      />
                      <p className="text-xs font-medium">
                        ไม่พบข้อมูลพนักงานที่ค้นหา
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredStaffList.map((s: any) => (
                    <tr
                      key={s.id}
                      className="hover:bg-stone-50/80 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="font-bold text-stone-900">
                          {s.first_name || s.last_name
                            ? `${s.first_name || ""} ${s.last_name || ""}`.trim()
                            : s.name || "ไม่ระบุชื่อ"}
                        </div>
                        <div className="text-[11px] text-stone-400 flex items-center gap-2 mt-0.5 font-medium">
                          <span className="flex items-center gap-1">
                            <Mail size={11} /> {s.email}
                          </span>
                          {s.phone && (
                            <span className="flex items-center gap-1">
                              <Phone size={11} /> {s.phone}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {renderRoleBadge(s.role)}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {s.status ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2
                              size={11}
                              className="text-emerald-600"
                            />
                            ใช้งาน
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                            <XCircle size={11} className="text-rose-600" />
                            ระงับ
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openStaffDetails(s)}
                            className="p-1.5 text-stone-400 hover:text-[#0b3b2c] hover:bg-stone-100 rounded-lg transition-all"
                            title="ดูข้อมูลรายละเอียด"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(s)}
                            className="p-1.5 text-stone-400 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-all"
                            title="แก้ไขข้อมูล"
                          >
                            <Edit3 size={16} />
                          </button>

                          {s.id !== user?.id && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(s.id, s.status)}
                              className={`p-1.5 rounded-lg transition-all ${
                                s.status
                                  ? "text-stone-300 hover:text-rose-600 hover:bg-rose-50"
                                  : "text-stone-300 hover:text-emerald-600 hover:bg-emerald-50"
                              }`}
                              title={s.status ? "ระงับการใช้งาน" : "เปิดใช้งาน"}
                            >
                              {s.status ? (
                                <PowerOff size={16} />
                              ) : (
                                <Power size={16} />
                              )}
                            </button>
                          )}
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
      {/* MODAL: Edit Staff */}
      {isEditModalOpen && editingStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl border border-stone-200 flex flex-col max-h-[90vh]">
            <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <h3 className="text-sm font-bold text-[#0b3b2c] flex items-center gap-2">
                <Edit3 size={16} className="text-amber-700" />
                แก้ไขข้อมูลพนักงาน
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingStaff(null);
                }}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form
              onSubmit={handleUpdateStaff}
              className="p-5 space-y-3.5 overflow-y-auto"
            >
              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">
                  ชื่อ-นามสกุล
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c]"
                  value={editingStaff?.name || ""}
                  onChange={(e) =>
                    setEditingStaff({ ...editingStaff, name: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    อีเมล
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c]"
                    value={editingStaff.email}
                    onChange={(e) =>
                      setEditingStaff({
                        ...editingStaff,
                        email: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">
                    เบอร์โทรศัพท์
                  </label>
                  <input
                    type="tel"
                    className="w-full px-3.5 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c]"
                    value={editingStaff.phone}
                    onChange={(e) =>
                      setEditingStaff({
                        ...editingStaff,
                        phone: e.target.value,
                      })
                    }
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-600 mb-1">
                  ตำแหน่ง
                </label>
                <CustomSelect
                  options={ROLE_OPTIONS}
                  value={editingStaff.role}
                  onChange={(val) =>
                    setEditingStaff({ ...editingStaff, role: val })
                  }
                />
              </div>

              <div className="border-t border-stone-100 pt-3">
                <span className="text-[11px] font-bold text-stone-400 uppercase tracking-wider block mb-2">
                  ข้อมูลที่อยู่
                </span>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="บ้านเลขที่, ซอย, ถนน"
                    className="w-full px-3.5 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c]"
                    value={editingStaff.address}
                    onChange={(e) =>
                      setEditingStaff({
                        ...editingStaff,
                        address: e.target.value,
                      })
                    }
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="ตำบล/แขวง"
                      className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c]"
                      value={editingStaff.subdistrict}
                      onChange={(e) =>
                        setEditingStaff({
                          ...editingStaff,
                          subdistrict: e.target.value,
                        })
                      }
                    />
                    <input
                      type="text"
                      placeholder="อำเภอ/เขต"
                      className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c]"
                      value={editingStaff.district}
                      onChange={(e) =>
                        setEditingStaff({
                          ...editingStaff,
                          district: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="จังหวัด"
                      className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c]"
                      value={editingStaff.province}
                      onChange={(e) =>
                        setEditingStaff({
                          ...editingStaff,
                          province: e.target.value,
                        })
                      }
                    />
                    <input
                      type="text"
                      placeholder="รหัสไปรษณีย์"
                      maxLength={5}
                      className="w-full px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c]"
                      value={editingStaff.postal_code}
                      onChange={(e) =>
                        setEditingStaff({
                          ...editingStaff,
                          postal_code: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingStaff(null);
                  }}
                  className="flex-1 py-2 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-4 bg-[#0b3b2c] hover:bg-[#07271d] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL: Staff Details */}
      {isModalOpen && selectedStaff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl border border-stone-200 flex flex-col">
            <div className="px-5 py-3.5 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
              <h3 className="text-sm font-bold text-[#0b3b2c] flex items-center gap-2">
                <Eye size={16} className="text-[#0b3b2c]" />
                รายละเอียดพนักงาน
              </h3>
              <button
                type="button"
                onClick={closeStaffDetails}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs text-stone-700 overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                <div>
                  <h4 className="text-sm font-bold text-stone-900">
                    {selectedStaff.first_name || selectedStaff.last_name
                      ? `${selectedStaff.first_name || ""} ${selectedStaff.last_name || ""}`.trim()
                      : selectedStaff.name || "ไม่ระบุชื่อ"}
                  </h4>
                  <p className="text-[11px] text-stone-400">
                    ID: #{selectedStaff.id}
                  </p>
                </div>
                {renderRoleBadge(selectedStaff.role)}
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-stone-600">
                  <Mail size={14} className="text-stone-400" />
                  <span>{selectedStaff.email}</span>
                </div>
                <div className="flex items-center gap-2 text-stone-600">
                  <Phone size={14} className="text-stone-400" />
                  <span>{selectedStaff.phone || "ไม่ระบุเบอร์โทรศัพท์"}</span>
                </div>
                <div className="flex items-start gap-2 text-stone-600">
                  <MapPin
                    size={14}
                    className="text-stone-400 mt-0.5 shrink-0"
                  />
                  <span>
                    {[
                      selectedStaff.address,
                      selectedStaff.subdistrict,
                      selectedStaff.district,
                      selectedStaff.province,
                      selectedStaff.postal_code,
                    ]
                      .filter(Boolean)
                      .join(" ") || "ไม่ระบุที่อยู่"}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                <span className="text-stone-500 font-medium">สถานะบัญชี</span>
                {selectedStaff.status ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 size={11} className="text-emerald-600" />{" "}
                    ใช้งาน
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                    <XCircle size={11} className="text-rose-600" />{" "}
                    ระงับการใช้งาน
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 bg-stone-50/50 border-t border-stone-100 flex justify-end">
              <button
                type="button"
                onClick={closeStaffDetails}
                className="py-2 px-4 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-bold rounded-xl transition-all"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
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
              primary: "#34d399", // สีเขียวสว่าง
              secondary: "#0b3b2c",
            },
          },
          error: {
            style: {
              background: "#881337", // โทนสีแดงเข้ม
              color: "#ffffff",
            },
            iconTheme: {
              primary: "#fb7185",
              secondary: "#881337",
            },
          },
        }}
      />
    </div>
  );
}
