"use client";

import { useState, useEffect, useRef, useMemo } from "react";
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Loader2,
  Calendar,
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { Modal } from "@/components/admin/ui";
import { formatThaiDateShort } from "@/lib/date";

// Component Custom Dropdown (ดีไซน์ละมุนสไตล์ Walai)
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
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 bg-cream-50/70 hover:bg-cream-50 border border-cream-300 rounded-2xl text-xs font-semibold text-charcoal-700 transition-all focus:outline-none focus:ring-2 focus:ring-forest-800/20 shadow-2xs cursor-pointer"
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-charcoal-400 transition-transform duration-200 ${isOpen ? "rotate-180 text-forest-800" : ""}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full bg-white border border-cream-200/90 rounded-2xl shadow-dropdown z-50 overflow-hidden py-1 max-h-56 overflow-y-auto animate-in fade-in duration-150">
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
                className={`w-full text-left px-3.5 py-2 text-xs font-medium transition-colors flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? "bg-forest-50 text-forest-900 font-bold"
                    : "text-charcoal-600 hover:bg-cream-100 hover:text-charcoal-900"
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

  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // State สำหรับ Modal เพิ่มพนักงานใหม่
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [usePhoneAsPassword, setUsePhoneAsPassword] = useState(true);

  const initialFormState = {
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
  };

  const [staffForm, setStaffForm] = useState(initialFormState);

  // Modal State อื่นๆ
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

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, statusFilter, searchQuery]);

  const fetchStaff = async () => {
    setLoading(true);
    try {
      const res = await api.get("/auth/staff");
      setStaffList(res.data?.data || []);
    } catch {
      notify.error("ไม่สามารถโหลดข้อมูลพนักงานได้");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();

    if (usePhoneAsPassword) {
      if (!staffForm.phone || staffForm.phone.trim().length < 8) {
        notify.error("กรุณาระบุเบอร์โทรศัพท์อย่างน้อย 8-10 หลัก เพื่อใช้เป็นรหัสผ่านเริ่มต้น");
        return;
      }
    } else {
      if (!staffForm.password || staffForm.password.trim().length < 8) {
        notify.error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
        return;
      }
    }

    setIsSubmittingCreate(true);
    try {
      const payload = {
        ...staffForm,
        password: usePhoneAsPassword ? staffForm.phone.trim() : staffForm.password,
      };
      await api.post("/auth/staff", payload);
      notify.success("สร้างบัญชีพนักงานสำเร็จ");
      setStaffForm(initialFormState);
      setUsePhoneAsPassword(true);
      setIsCreateModalOpen(false);
      fetchStaff();
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "ไม่สามารถสร้างบัญชีพนักงานได้"));
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const handleToggleStatus = async (id: number, currentStatus: boolean) => {
    try {
      await api.put(`/auth/staff/${id}/status`, { status: !currentStatus });
      notify.success(
        !currentStatus
          ? "เปิดใช้งานพนักงานสำเร็จ"
          : "ระงับการใช้งานพนักงานสำเร็จ",
      );
      fetchStaff();
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "ทำรายการไม่สำเร็จ"));
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
    const fullName = staff.first_name || staff.last_name
      ? `${staff.first_name || ""} ${staff.last_name || ""}`.trim()
      : staff.name || "";

    setEditingStaff({
      id: staff.id,
      name: fullName,
      email: staff.email || "",
      phone: staff.phone || "",
      role: staff.role || "room_staff",
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
    setIsSubmittingEdit(true);
    try {
      await api.put(`/auth/staff/${editingStaff.id}`, editingStaff);
      notify.success("แก้ไขข้อมูลพนักงานสำเร็จ");
      setIsEditModalOpen(false);
      setEditingStaff(null);
      fetchStaff();
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "แก้ไขข้อมูลไม่สำเร็จ"));
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // กรองรายชื่อตาม Tab ที่เลือก
  const filteredStaffList = useMemo(() => {
    return staffList.filter((staff) => {
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
  }, [staffList, activeTab, statusFilter, searchQuery]);

  const totalPages = Math.ceil(filteredStaffList.length / ITEMS_PER_PAGE) || 1;
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredStaffList.length);

  const paginatedStaffList = useMemo(() => {
    return filteredStaffList.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredStaffList, startIndex]);

  // สถิติตัวกรอง
  const stats = useMemo(() => {
    return {
      total: staffList.length,
      active: staffList.filter((s) => s.status).length,
      inactive: staffList.filter((s) => !s.status).length,
      room: staffList.filter((s) => s.role === "room_staff").length,
      boat: staffList.filter((s) => s.role === "boat_staff").length,
      admin: staffList.filter((s) => s.role === "admin").length,
    };
  }, [staffList]);

  const renderRoleBadge = (role: string) => {
    switch (role) {
      case "admin":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-forest-50 text-forest-900 border border-forest-200">
            <ShieldCheck size={13} className="text-forest-800" />
            ผู้ดูแลระบบ
          </span>
        );
      case "room_staff":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cream-100 text-forest-800 border border-cream-300/80">
            <Home size={13} className="text-forest-700" />
            จัดการห้องพัก
          </span>
        );
      case "boat_staff":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-lagoon-50 text-lagoon-800 border border-lagoon-200">
            <Ship size={13} className="text-lagoon-700" />
            จัดการเรือ
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cream-100 text-charcoal-700 border border-cream-200">
            {role}
          </span>
        );
    }
  };

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Page Title with Action Button */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-900/10">
            <Users size={24} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold text-forest-900 leading-tight">
              จัดการพนักงาน
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap sm:flex-nowrap">
          {/* Badge สรุปจำนวน */}
          <div className="px-4 py-2.5 bg-cream-50/80 rounded-2xl border border-cream-300 shadow-2xs flex items-center gap-2.5">
            <span className="text-xs font-medium text-charcoal-500">
              พนักงานทั้งหมด
            </span>
            <span className="text-xs font-bold text-forest-900 font-mono">
              {stats.total} คน
            </span>
          </div>

          {/* ปุ่มสร้างพนักงานใหม่ (Primary Action) */}
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-forest-800 hover:bg-forest-900 text-white rounded-2xl text-xs font-bold shadow-md shadow-forest-900/10 transition-all cursor-pointer active:scale-98"
          >
            <UserPlus size={16} />
            <span>เพิ่มพนักงานใหม่</span>
          </button>
        </div>
      </div>

      {/* Main Table: Full Width */}
      <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-panel border border-cream-200/90 overflow-hidden flex flex-col min-h-[660px]">
        {/* Top Control Bar: Search & Status Filters */}
        <div className="space-y-3.5 mb-5">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1 max-w-md">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, อีเมล หรือเบอร์โทรศัพท์..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2.5 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-600 text-xs p-0.5 rounded-full hover:bg-cream-200 cursor-pointer"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Status Filter Buttons */}
            <div className="flex items-center gap-1 p-1 bg-cream-100 rounded-2xl text-xs shrink-0 self-start md:self-auto">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-white text-forest-900 shadow-2xs font-bold"
                    : "text-charcoal-600 hover:text-charcoal-900"
                }`}
              >
                ทั้งหมด ({stats.total})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === "active"
                    ? "bg-forest-800 text-white shadow-2xs font-bold"
                    : "text-charcoal-600 hover:text-forest-800"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${statusFilter === "active" ? "bg-white" : "bg-forest-600"}`}
                />
                ใช้งาน ({stats.active})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("inactive")}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === "inactive"
                    ? "bg-rose-600 text-white shadow-2xs font-bold"
                    : "text-charcoal-600 hover:text-rose-700"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${statusFilter === "inactive" ? "bg-white" : "bg-rose-600"}`}
                />
                ระงับ ({stats.inactive})
              </button>
            </div>
          </div>

          {/* Role Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-cream-100/70 border border-cream-200/80 rounded-2xl overflow-x-auto text-xs [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "all"
                  ? "bg-white text-forest-900 shadow-2xs font-bold"
                  : "text-charcoal-600 hover:text-charcoal-900"
              }`}
            >
              ทุกตำแหน่ง ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("room_staff")}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeTab === "room_staff"
                  ? "bg-white text-forest-900 shadow-2xs font-bold"
                  : "text-charcoal-600 hover:text-charcoal-900"
              }`}
            >
              <Home size={13} className="text-forest-700" />
              จัดการห้องพัก ({stats.room})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("boat_staff")}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeTab === "boat_staff"
                  ? "bg-white text-forest-900 shadow-2xs font-bold"
                  : "text-charcoal-600 hover:text-charcoal-900"
              }`}
            >
              <Ship size={13} className="text-lagoon-700" />
              จัดการเรือ ({stats.boat})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("admin")}
              className={`px-3.5 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                activeTab === "admin"
                  ? "bg-white text-forest-900 shadow-2xs font-bold"
                  : "text-charcoal-600 hover:text-charcoal-900"
              }`}
            >
              <ShieldCheck size={13} className="text-forest-800" />
              ผู้ดูแลระบบ ({stats.admin})
            </button>
          </div>
        </div>

        {/* Full-width Table Area */}
        <div className="overflow-x-auto border border-cream-200/90 rounded-2xl shadow-2xs">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50/80 text-xs font-bold text-charcoal-600 uppercase tracking-wider select-none shadow-2xs">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4 min-w-[200px]">พนักงาน</th>
                <th className="py-3.5 px-4 min-w-[220px]">ช่องทางติดต่อ</th>
                <th className="py-3.5 px-4 min-w-[150px]">ตำแหน่ง/บทบาท</th>
                <th className="py-3.5 px-4 min-w-[160px]">พื้นที่/ที่อยู่</th>
                <th className="py-3.5 px-4 min-w-[110px] text-center">สถานะ</th>
                <th className="py-3.5 px-4 text-center min-w-[120px]">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100 bg-white text-xs text-charcoal-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-charcoal-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-7 w-7 animate-spin text-forest-700" />
                      <p className="text-xs font-medium text-charcoal-500">
                        กำลังโหลดข้อมูลพนักงาน...
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredStaffList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-20 text-center text-charcoal-400">
                    <Users size={36} className="mx-auto mb-2 text-charcoal-300" />
                    <p className="text-xs font-semibold text-charcoal-600">
                      ไม่พบข้อมูลพนักงาน
                    </p>
                    <p className="text-[11px] text-charcoal-400 mt-1">
                      ลองเปลี่ยนคำค้นหาหรือตัวกรองใหม่อีกครั้ง
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedStaffList.map((s: any, idx: number) => {
                  const staffFullName =
                    s.first_name || s.last_name
                      ? `${s.first_name || ""} ${s.last_name || ""}`.trim()
                      : s.name || "ไม่ระบุชื่อ";
                  const initialLetter = (staffFullName[0] || "พ").toUpperCase();

                  const addressText = [s.province, s.district]
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-cream-50/60 border-b border-cream-100/80 last:border-0 transition-colors"
                    >
                      {/* # Index */}
                      <td className="py-3.5 px-4 text-center font-mono text-charcoal-400 font-semibold">
                        {startIndex + idx + 1}
                      </td>

                      {/* Staff Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-2xl bg-forest-100/80 border border-forest-200/60 text-forest-800 font-bold flex items-center justify-center shrink-0 text-xs shadow-2xs">
                            {initialLetter}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-forest-950 truncate">
                              {staffFullName}
                            </div>
                            <div className="text-[11px] text-charcoal-400 font-mono mt-0.5">
                              ID: #{s.id}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact: Email & Phone */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-charcoal-700">
                            <Mail size={12} className="text-forest-700 shrink-0" />
                            <span className="truncate">{s.email || "-"}</span>
                          </div>
                          {s.phone ? (
                            <div className="flex items-center gap-1.5 text-charcoal-500 font-mono text-[11px]">
                              <Phone size={12} className="text-forest-700 shrink-0" />
                              <span>{s.phone}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-charcoal-300 block">
                              ไม่มีเบอร์โทร
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Role Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {renderRoleBadge(s.role)}
                      </td>

                      {/* Location / Area */}
                      <td className="py-3.5 px-4 text-charcoal-600">
                        {addressText ? (
                          <div className="flex items-center gap-1.5">
                            <MapPin size={13} className="text-forest-700 shrink-0" />
                            <span className="truncate">{addressText}</span>
                          </div>
                        ) : (
                          <span className="text-charcoal-300 text-[11px]">
                            ไม่ระบุที่อยู่
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        {s.status ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-forest-50 text-forest-800 border border-forest-200">
                            <CheckCircle2 size={11} className="text-forest-600" />
                            ใช้งาน
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                            <XCircle size={11} className="text-rose-600" />
                            ระงับ
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openStaffDetails(s)}
                            className="p-1.5 text-charcoal-500 hover:text-forest-900 bg-cream-100/80 hover:bg-cream-200/80 border border-cream-200 rounded-xl transition-all cursor-pointer"
                            title="ดูข้อมูลรายละเอียด"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(s)}
                            className="p-1.5 text-charcoal-500 hover:text-amber-800 bg-amber-50/60 hover:bg-amber-100/80 border border-amber-200/80 rounded-xl transition-all cursor-pointer"
                            title="แก้ไขข้อมูล"
                          >
                            <Edit3 size={15} />
                          </button>

                          {s.id !== user?.id && (
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(s.id, s.status)}
                              className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                                s.status
                                  ? "text-rose-600 bg-rose-50/60 hover:bg-rose-100 border-rose-200"
                                  : "text-forest-700 bg-forest-50/60 hover:bg-forest-100 border-forest-200"
                              }`}
                              title={s.status ? "ระงับการใช้งาน" : "เปิดใช้งาน"}
                            >
                              {s.status ? (
                                <PowerOff size={15} />
                              ) : (
                                <Power size={15} />
                              )}
                            </button>
                          )}
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
        {filteredStaffList.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-auto border-t border-cream-200 text-xs text-charcoal-500">
            <span>
              แสดง{" "}
              <strong className="text-forest-950 font-mono">
                {filteredStaffList.length > 0 ? startIndex + 1 : 0}
              </strong>{" "}
              ถึง{" "}
              <strong className="text-forest-950 font-mono">{endIndex}</strong> จาก{" "}
              <strong className="text-forest-950 font-mono">{filteredStaffList.length}</strong> คน
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
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - currentPage) <= 1,
                )
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
                    <span
                      key={idx}
                      className="px-1 text-charcoal-400 font-bold"
                    >
                      {p}
                    </span>
                  ),
                )}

              <button
                type="button"
                disabled={currentPage === totalPages}
                onClick={() =>
                  setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                }
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

      {/* MODAL: เพิ่มพนักงานใหม่ */}
      <Modal
        open={isCreateModalOpen}
        title="เพิ่มพนักงานใหม่"
        onClose={() => {
          if (!isSubmittingCreate) setIsCreateModalOpen(false);
        }}
        widthClass="max-w-2xl"
      >
        <form onSubmit={handleCreateStaff} className="space-y-4">
          {/* ข้อมูลบัญชีหลัก - Grid 2 คอลัมน์ */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                ชื่อ-นามสกุล <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="นายสมชาย ใจดี"
                className="w-full px-3.5 py-2.5 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
                value={staffForm.name}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, name: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                อีเมล <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                required
                placeholder="staff@walai.com"
                className="w-full px-3.5 py-2.5 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
                value={staffForm.email}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, email: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                เบอร์โทรศัพท์ {usePhoneAsPassword && <span className="text-rose-500">*</span>}
              </label>
              <input
                type="tel"
                required={usePhoneAsPassword}
                placeholder="0812345678"
                className="w-full px-3.5 py-2.5 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs font-mono"
                value={staffForm.phone}
                onChange={(e) =>
                  setStaffForm({ ...staffForm, phone: e.target.value })
                }
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                ตำแหน่ง/บทบาท <span className="text-rose-500">*</span>
              </label>
              <CustomSelect
                options={ROLE_OPTIONS}
                value={staffForm.role}
                onChange={(val) => setStaffForm({ ...staffForm, role: val })}
              />
            </div>

            {/* Checkbox: ใช้เบอร์โทรเป็นรหัสผ่านเริ่มต้น (เต็ม 2 คอลัมน์) */}
            <div className="sm:col-span-2 p-3 bg-forest-50/70 border border-forest-200/80 rounded-2xl">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={usePhoneAsPassword}
                  onChange={(e) => setUsePhoneAsPassword(e.target.checked)}
                  className="mt-0.5 w-4 h-4 text-forest-800 rounded border-cream-300 focus:ring-forest-800/20 cursor-pointer accent-forest-800"
                />
                <div className="text-xs">
                  <span className="font-bold text-forest-900 block">
                    ใช้เบอร์โทรศัพท์เป็นรหัสผ่านเริ่มต้น (แนะนำ)
                  </span>
                  <span className="text-charcoal-500 text-[11px] block mt-0.5 leading-relaxed">
                    พนักงานสามารถใช้เบอร์โทรศัพท์เข้าสู่ระบบ แล้วไปเปลี่ยนรหัสผ่านใหม่เองได้ที่หน้าโปรไฟล์
                  </span>
                </div>
              </label>
            </div>

            {!usePhoneAsPassword && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                  รหัสผ่านที่กำหนดเอง <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  className="w-full px-3.5 py-2.5 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
                  value={staffForm.password}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, password: e.target.value })
                  }
                />
              </div>
            )}
          </div>

          {/* ข้อมูลที่อยู่เพิ่มเติม - Grid 2 คอลัมน์ */}
          <div className="pt-3 border-t border-cream-200 space-y-2.5">
            <span className="text-[11px] font-bold text-charcoal-500 uppercase tracking-wider block">
              ข้อมูลที่อยู่เพิ่มเติม (ตัวเลือก)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="sm:col-span-2">
                <input
                  type="text"
                  placeholder="บ้านเลขที่, ถนน, ซอย, อาคาร"
                  className="w-full px-3.5 py-2 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
                  value={staffForm.address}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, address: e.target.value })
                  }
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="ตำบล/แขวง"
                  className="w-full px-3 py-2 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                  value={staffForm.subdistrict}
                  onChange={(e) =>
                    setStaffForm({
                      ...staffForm,
                      subdistrict: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="อำเภอ/เขต"
                  className="w-full px-3 py-2 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                  value={staffForm.district}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, district: e.target.value })
                  }
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="จังหวัด"
                  className="w-full px-3 py-2 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                  value={staffForm.province}
                  onChange={(e) =>
                    setStaffForm({ ...staffForm, province: e.target.value })
                  }
                />
              </div>
              <div>
                <input
                  type="text"
                  placeholder="รหัสไปรษณีย์"
                  maxLength={5}
                  className="w-full px-3 py-2 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
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

          {/* Action Buttons */}
          <div className="pt-3 flex gap-2.5">
            <button
              type="button"
              disabled={isSubmittingCreate}
              onClick={() => setIsCreateModalOpen(false)}
              className="flex-1 py-2.5 px-4 bg-cream-100 hover:bg-cream-200 text-charcoal-700 text-xs font-bold rounded-2xl transition-colors cursor-pointer disabled:opacity-50"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmittingCreate}
              className="flex-1 py-2.5 px-4 bg-forest-800 hover:bg-forest-900 text-white text-xs font-bold rounded-2xl transition-all shadow-xs cursor-pointer active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmittingCreate ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>กำลังสร้างบัญชี...</span>
                </>
              ) : (
                <>
                  <UserPlus size={15} />
                  <span>สร้างบัญชีพนักงาน</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL: แก้ไขข้อมูลพนักงาน */}
      <Modal
        open={isEditModalOpen && !!editingStaff}
        title="แก้ไขข้อมูลพนักงาน"
        onClose={() => {
          if (!isSubmittingEdit) {
            setIsEditModalOpen(false);
            setEditingStaff(null);
          }
        }}
        widthClass="max-w-2xl"
      >
        {editingStaff && (
          <form onSubmit={handleUpdateStaff} className="space-y-4">
            {/* ข้อมูลบัญชีหลัก - Grid 2 คอลัมน์ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                  ชื่อ-นามสกุล <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3.5 py-2.5 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
                  value={editingStaff?.name || ""}
                  onChange={(e) =>
                    setEditingStaff({ ...editingStaff, name: e.target.value })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                  อีเมล <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  className="w-full px-3.5 py-2.5 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
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
                <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                  เบอร์โทรศัพท์
                </label>
                <input
                  type="tel"
                  placeholder="0812345678"
                  className="w-full px-3.5 py-2.5 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs font-mono"
                  value={editingStaff.phone}
                  onChange={(e) =>
                    setEditingStaff({
                      ...editingStaff,
                      phone: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                  ตำแหน่ง/บทบาท <span className="text-rose-500">*</span>
                </label>
                <CustomSelect
                  options={ROLE_OPTIONS}
                  value={editingStaff.role}
                  onChange={(val) =>
                    setEditingStaff({ ...editingStaff, role: val })
                  }
                />
              </div>
            </div>

            {/* ข้อมูลที่อยู่ - Grid 2 คอลัมน์ */}
            <div className="pt-3 border-t border-cream-200 space-y-2.5">
              <span className="text-[11px] font-bold text-charcoal-500 uppercase tracking-wider block">
                ข้อมูลที่อยู่
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="sm:col-span-2">
                  <input
                    type="text"
                    placeholder="บ้านเลขที่, ถนน, ซอย, อาคาร"
                    className="w-full px-3.5 py-2 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
                    value={editingStaff.address}
                    onChange={(e) =>
                      setEditingStaff({
                        ...editingStaff,
                        address: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="ตำบล/แขวง"
                    className="w-full px-3 py-2 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                    value={editingStaff.subdistrict}
                    onChange={(e) =>
                      setEditingStaff({
                        ...editingStaff,
                        subdistrict: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="อำเภอ/เขต"
                    className="w-full px-3 py-2 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                    value={editingStaff.district}
                    onChange={(e) =>
                      setEditingStaff({
                        ...editingStaff,
                        district: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="จังหวัด"
                    className="w-full px-3 py-2 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
                    value={editingStaff.province}
                    onChange={(e) =>
                      setEditingStaff({
                        ...editingStaff,
                        province: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="รหัสไปรษณีย์"
                    maxLength={5}
                    className="w-full px-3 py-2 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 shadow-2xs"
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

            <div className="pt-3 flex gap-2.5">
              <button
                type="button"
                disabled={isSubmittingEdit}
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingStaff(null);
                }}
                className="flex-1 py-2.5 px-4 bg-cream-100 hover:bg-cream-200 text-charcoal-700 text-xs font-bold rounded-2xl transition-colors cursor-pointer disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmittingEdit}
                className="flex-1 py-2.5 px-4 bg-forest-800 hover:bg-forest-900 text-white text-xs font-bold rounded-2xl transition-all shadow-xs cursor-pointer active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmittingEdit ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>กำลังบันทึก...</span>
                  </>
                ) : (
                  <span>บันทึกข้อมูล</span>
                )}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: รายละเอียดพนักงาน */}
      <Modal
        open={isModalOpen && !!selectedStaff}
        title="รายละเอียดพนักงาน"
        onClose={closeStaffDetails}
        footer={
          <button
            type="button"
            onClick={closeStaffDetails}
            className="py-2.5 px-5 bg-cream-100 hover:bg-cream-200 text-charcoal-700 text-xs font-bold rounded-2xl transition-colors cursor-pointer"
          >
            ปิด
          </button>
        }
      >
        {selectedStaff && (
          <div className="space-y-4 text-xs text-charcoal-700">
            <div className="flex items-center justify-between pb-3.5 border-b border-cream-200">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-forest-100 text-forest-800 font-bold flex items-center justify-center text-sm shadow-2xs border border-forest-200/60">
                  {(
                    selectedStaff.first_name?.[0] ||
                    selectedStaff.name?.[0] ||
                    "พ"
                  ).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-forest-950">
                    {selectedStaff.first_name || selectedStaff.last_name
                      ? `${selectedStaff.first_name || ""} ${selectedStaff.last_name || ""}`.trim()
                      : selectedStaff.name || "ไม่ระบุชื่อ"}
                  </h4>
                  <p className="text-xs text-charcoal-400 font-mono mt-0.5">
                    ID: #{selectedStaff.id}
                  </p>
                </div>
              </div>
              {renderRoleBadge(selectedStaff.role)}
            </div>

            <div className="space-y-3 pt-1">
              <div className="flex items-center gap-2.5 text-charcoal-700 bg-cream-50/70 p-2.5 rounded-xl border border-cream-200/60">
                <Mail size={15} className="text-forest-700 shrink-0" />
                <span className="font-medium">{selectedStaff.email}</span>
              </div>
              <div className="flex items-center gap-2.5 text-charcoal-700 bg-cream-50/70 p-2.5 rounded-xl border border-cream-200/60">
                <Phone size={15} className="text-forest-700 shrink-0" />
                <span className="font-mono font-medium">
                  {selectedStaff.phone || "ไม่ระบุเบอร์โทรศัพท์"}
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-charcoal-700 bg-cream-50/70 p-2.5 rounded-xl border border-cream-200/60">
                <MapPin size={15} className="text-forest-700 mt-0.5 shrink-0" />
                <span className="font-medium leading-relaxed">
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
              {selectedStaff.created_at && (
                <div className="flex items-center gap-2.5 text-charcoal-500 text-[11px] px-1">
                  <Calendar size={13} className="text-charcoal-400 shrink-0" />
                  <span>
                    วันที่เริ่มใช้งาน: {formatThaiDateShort(selectedStaff.created_at)}
                  </span>
                </div>
              )}
            </div>

            <div className="pt-3.5 border-t border-cream-200 flex items-center justify-between">
              <span className="text-charcoal-500 font-medium">สถานะบัญชี</span>
              {selectedStaff.status ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-forest-50 text-forest-800 border border-forest-200">
                  <CheckCircle2 size={12} className="text-forest-600" />{" "}
                  ใช้งานปกติ
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                  <XCircle size={12} className="text-rose-600" />{" "}
                  ระงับการใช้งาน
                </span>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
