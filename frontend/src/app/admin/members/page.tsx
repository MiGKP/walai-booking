"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Search,
  UserCheck,
  UserX,
  Hotel,
  Ship,
  Calendar,
  Phone,
  Mail,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Eye,
  User as UserIcon,
  Clock,
  Globe,
  MessageCircle,
  Facebook,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast, { Toaster } from "react-hot-toast";

// 🔹 Type Interface
interface Member {
  id: number | string;
  member_id?: number | string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  image_profile?: string;
  is_active?: boolean;
  room_booking_count?: number;
  boat_booking_count?: number;
  auth_provider?: string;
  line_id?: string;
  facebook?: string;
  created_at?: string;
  updated_at?: string;
}

interface ConfirmModalState {
  isOpen: boolean;
  memberId: number | string | null;
  currentStatus: boolean;
  memberName: string;
}

interface DetailModalState {
  isOpen: boolean;
  data: Member | null;
}

export default function AdminMembersPage() {
  const { ready } = useAuthGuard({ allowedRoles: ["admin"] });
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔹 State สำหรับ Filter & Search (ค้นหาจาก Client-side ไม่ยิง API)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    memberId: null,
    currentStatus: true,
    memberName: "",
  });

  const [detailModal, setDetailModal] = useState<DetailModalState>({
    isOpen: false,
    data: null,
  });

  // 🔹 ดึงข้อมูลจาก API ครั้งเดียว (ไม่ส่ง params search/status ไปที่ backend)
  const fetchMembers = useCallback(async () => {
    if (!ready) return;

    setLoading(true);
    try {
      const res = await api.get("/auth/members");
      const rawData: Member[] = res.data?.data || [];

      const formattedData = rawData.map((item) => ({
        ...item,
        member_id: item.member_id ?? item.id,
      }));

      setMembers(formattedData);
    } catch (error) {
      console.error("Fetch members error:", error);
      toast.error("ไม่สามารถโหลดข้อมูลสมาชิกได้");
    } finally {
      setLoading(false);
    }
  }, [ready]);

  // 🔹 เรียก Fetch ข้อมูลครั้งแรกเมื่อพร้อมเท่านั้น
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // 🔹 Reset หน้า Pagination เมื่อเปลี่ยนคำค้นหาหรือตัวกรอง
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  // 🔹 สรุปตัวเลขสถิติรวมทั้งหมดจาก Database (ไม่ลดลงตามคำค้นหา)
  const { totalMembers, activeMembers, inactiveMembers } = useMemo(() => {
    const total = members.length;
    const active = members.filter((m) => m.is_active !== false).length;
    const inactive = members.filter((m) => m.is_active === false).length;

    return {
      totalMembers: total,
      activeMembers: active,
      inactiveMembers: inactive,
    };
  }, [members]);

  // 🔹 Filter ข้อมูลฝั่ง Client (ค้นหาลื่นๆ ทันที ไม่กระตุก)
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // 1. กรองตามสถานะ
      const isActive = m.is_active !== false;
      if (statusFilter === "active" && !isActive) return false;
      if (statusFilter === "inactive" && isActive) return false;

      // 2. กรองตามคำค้นหา (ชื่อ, นามสกุล, อีเมล, เบอร์โทร)
      const query = search.trim().toLowerCase();
      if (!query) return true;

      const fullName = `${m.first_name || ""} ${m.last_name || ""}`.toLowerCase();
      const email = (m.email || "").toLowerCase();
      const phone = (m.phone || "").toLowerCase();

      return (
        fullName.includes(query) ||
        email.includes(query) ||
        phone.includes(query)
      );
    });
  }, [members, search, statusFilter]);

  // 🔹 คำนวณ Pagination จากข้อมูลที่ Filter แล้ว
  const { currentMembers, totalPages, indexOfFirstItem, indexOfLastItem } = useMemo(() => {
    const total = filteredMembers.length;
    const pages = Math.ceil(total / itemsPerPage);
    const last = currentPage * itemsPerPage;
    const first = last - itemsPerPage;
    const current = filteredMembers.slice(first, last);

    return {
      currentMembers: current,
      totalPages: pages,
      indexOfFirstItem: first,
      indexOfLastItem: last,
    };
  }, [filteredMembers, currentPage, itemsPerPage]);

  const openToggleModal = (memberId: number | string, currentStatus: boolean, name: string) => {
    if (memberId === undefined || memberId === null || memberId === "") {
      toast.error("ไม่พบรหัสสมาชิก");
      return;
    }
    setConfirmModal({
      isOpen: true,
      memberId,
      currentStatus,
      memberName: name,
    });
  };

  const handleConfirmToggle = async () => {
    if (confirmModal.memberId === null) {
      toast.error("ไม่พบรหัสสมาชิกที่ต้องการระงับ/เปิดใช้งาน");
      return;
    }

    try {
      await api.put(`/auth/members/${confirmModal.memberId}/status`, {
        is_active: !confirmModal.currentStatus,
      });

      toast.success(
        confirmModal.currentStatus ? "ระงับการใช้งานสมาชิกแล้ว" : "เปิดการใช้งานสมาชิกแล้ว"
      );

      // อัปเดต State ฝั่ง Client ทันทีเพื่อให้ UI เปลี่ยนแปลงเร็วที่สุด
      setMembers((prev) =>
        prev.map((m) =>
          (m.member_id ?? m.id) === confirmModal.memberId
            ? { ...m, is_active: !confirmModal.currentStatus }
            : m
        )
      );
    } catch (error: unknown) {
      console.error("Update Status Error:", error);
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || "เปลี่ยนสถานะไม่สำเร็จ");
    } finally {
      setConfirmModal({
        isOpen: false,
        memberId: null,
        currentStatus: true,
        memberName: "",
      });
    }
  };

  if (!ready) return null;

  return (
    <div className="w-full min-h-screen flex flex-col font-sans space-y-4 pb-10">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/80">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-[#0b3b2c] tracking-tight">
            จัดการสมาชิก
          </h1>
          <p className="text-stone-400 mt-0.5 text-xs md:text-sm">
            ค้นหาและจัดการสถานะบัญชีผู้ใช้งานทั่วไปในระบบ
          </p>
        </div>
      </div>

      {/* Stats Summary Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <Users size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500">สมาชิกทั้งหมด</p>
            <p className="text-2xl font-bold text-stone-900">{totalMembers}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
            <UserCheck size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500">ใช้งานอยู่</p>
            <p className="text-2xl font-bold text-teal-700">{activeMembers}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-2xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100">
            <UserX size={22} />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500">ถูกปิดใช้งาน</p>
            <p className="text-2xl font-bold text-rose-600">{inactiveMembers}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-3 rounded-2xl border border-stone-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {/* ช่องค้นหา */}
          <div className="relative flex-1 w-full">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, อีเมล หรือเบอร์โทร..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-700 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 focus:border-[#0b3b2c] transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 rounded-full hover:bg-stone-200/50 transition-colors"
                title="ล้างคำค้นหา"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* ปุ่มกรองสถานะ */}
          <div className="flex items-center gap-1 p-1 bg-stone-100/80 rounded-xl text-xs w-full sm:w-auto shrink-0 justify-between sm:justify-start">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all ${
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
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
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
              className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
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
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-3xl border border-stone-200/80 shadow-sm overflow-hidden flex flex-col justify-between">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-stone-50/80 border-b border-stone-200/80 text-[11px] uppercase tracking-wider text-stone-500 font-bold">
                <th className="py-3.5 px-4 sm:px-6">#</th>
                <th className="py-3.5 px-4">สมาชิก</th>
                <th className="py-3.5 px-4">อีเมล</th>
                <th className="py-3.5 px-4">เบอร์โทรศัพท์</th>
                <th className="py-3.5 px-4 text-center">จองห้อง</th>
                <th className="py-3.5 px-4 text-center">จองเรือ</th>
                <th className="py-3.5 px-4">วันที่สมัคร</th>
                <th className="py-3.5 px-4 text-center">สถานะ</th>
                <th className="py-3.5 px-4 text-center">ดูข้อมูล</th>
                <th className="py-3.5 px-4 sm:px-6 text-center">เปิด/ปิด</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 text-xs text-stone-700">
              {loading ? (
                <tr key="loading-row">
                  <td colSpan={10} className="py-12 text-center text-stone-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="animate-spin text-[#0b3b2c]" size={24} />
                      <span className="font-medium text-stone-500">
                        กำลังโหลดข้อมูลสมาชิก...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : currentMembers.length === 0 ? (
                <tr key="no-results-row">
                  <td colSpan={10} className="py-12 text-center text-stone-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users size={32} className="text-stone-300" />
                      <span className="font-medium text-stone-500">ไม่พบรายการสมาชิก</span>
                    </div>
                  </td>
                </tr>
              ) : (
                currentMembers.map((m, idx) => {
                  const memberId = m.member_id ?? m.id;
                  const fullName =
                    `${m.first_name || ""} ${m.last_name || ""}`.trim() || "-";
                  const isActive = m.is_active !== false;
                  const avatar = m.avatar_url || m.image_profile;

                  return (
                    <tr
                      key={memberId || idx}
                      className="hover:bg-stone-50/60 transition-colors"
                    >
                      <td className="py-3.5 px-4 sm:px-6 font-semibold text-stone-400">
                        {indexOfFirstItem + idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={fullName}
                              className="w-8 h-8 rounded-full object-cover border border-stone-200"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 border border-stone-200">
                              <UserIcon size={14} />
                            </div>
                          )}
                          <div className="font-semibold text-stone-900">{fullName}</div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-stone-600">
                          <Mail size={13} className="text-stone-400" />
                          <span>{m.email || "-"}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-stone-600">
                          <Phone size={13} className="text-stone-400" />
                          <span>{m.phone || "-"}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          <Hotel size={12} />
                          {m.room_booking_count ?? 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-100">
                          <Ship size={12} />
                          {m.boat_booking_count ?? 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-stone-500">
                        <div className="flex items-center gap-1">
                          <Calendar size={13} className="text-stone-400" />
                          {m.created_at
                            ? new Date(m.created_at).toLocaleDateString("th-TH", {
                                day: "numeric",
                                month: "short",
                                year: "2-digit",
                              })
                            : "-"}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-600 border border-rose-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              isActive ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          {isActive ? "ใช้งานอยู่" : "ถูกปิดใช้งาน"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setDetailModal({ isOpen: true, data: m })}
                          className="p-1.5 text-stone-500 hover:text-[#0b3b2c] hover:bg-emerald-50 rounded-lg transition-all cursor-pointer"
                          title="ดูรายละเอียดเพิ่มเติม"
                        >
                          <Eye size={16} />
                        </button>
                      </td>

                      <td className="py-3.5 px-4 sm:px-6 text-center">
                        <button
                          type="button"
                          onClick={() => openToggleModal(memberId, isActive, fullName)}
                          title={isActive ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
                          className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 cursor-pointer ${
                            isActive ? "bg-emerald-600" : "bg-stone-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform ${
                              isActive ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && filteredMembers.length > 0 && (
          <div className="px-6 py-4 border-t border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-50/50">
            <p className="text-xs text-stone-500 font-medium">
              แสดงข้อมูล {indexOfFirstItem + 1} -{" "}
              {Math.min(indexOfLastItem, filteredMembers.length)} จากรายการที่พบ {filteredMembers.length} รายการ
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs font-semibold text-stone-700 px-2">
                หน้า {currentPage} / {totalPages || 1}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-stone-100 space-y-4">
            <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                ยืนยันการเปลี่ยนสถานะ
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                คุณต้องการ
                {confirmModal.currentStatus ? "ปิดการใช้งาน" : "เปิดการใช้งาน"} บัญชีของ{" "}
                <span className="font-bold text-stone-800">
                  {confirmModal.memberName}
                </span>{" "}
                ใช่หรือไม่?
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmToggle}
                className="px-4 py-2 bg-[#0b3b2c] hover:bg-[#082d22] text-white text-xs font-semibold rounded-xl transition-all shadow-2xs cursor-pointer"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Member Detail Modal */}
      {detailModal.isOpen && detailModal.data && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-stone-100 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="bg-[#0b3b2c] px-6 py-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                {detailModal.data.avatar_url || detailModal.data.image_profile ? (
                  <img
                    src={detailModal.data.avatar_url || detailModal.data.image_profile}
                    alt="profile"
                    className="w-12 h-12 rounded-full object-cover border-2 border-white/20"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                    <UserIcon size={24} className="text-white" />
                  </div>
                )}
                <div>
                  <h3 className="text-base font-bold">
                    {`${detailModal.data.first_name || ""} ${detailModal.data.last_name || ""}`.trim() ||
                      "สมาชิกไม่มีชื่อ"}
                  </h3>
                  <p className="text-xs text-emerald-200/80">
                    ID: #{detailModal.data.member_id ?? detailModal.data.id}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailModal({ isOpen: false, data: null })}
                className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-6 space-y-5 text-xs text-stone-700 max-h-[80vh] overflow-y-auto">
              {/* ข้อมูลการติดต่อ */}
              <div className="space-y-2">
                <h4 className="font-bold text-stone-400 text-[11px] uppercase tracking-wider">
                  ข้อมูลการติดต่อ
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-stone-50 p-3.5 rounded-2xl border border-stone-200/60">
                  <div className="flex items-center gap-2">
                    <Mail size={15} className="text-stone-400 shrink-0" />
                    <span className="font-semibold text-stone-800 break-all">
                      {detailModal.data.email || "-"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={15} className="text-stone-400 shrink-0" />
                    <span className="font-semibold text-stone-800">
                      {detailModal.data.phone || "-"}
                    </span>
                  </div>
                </div>
              </div>

              {/* ช่องทาง Social & Auth Provider */}
              <div className="space-y-2">
                <h4 className="font-bold text-stone-400 text-[11px] uppercase tracking-wider">
                  ช่องทางเชื่อมต่อ & ระบบล็อกอิน
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-stone-50 p-3.5 rounded-2xl border border-stone-200/60">
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-stone-400" />
                    <div>
                      <p className="text-[10px] text-stone-400 font-semibold">การเข้าสู่ระบบ</p>
                      <p className="font-bold text-stone-800 uppercase">
                        {detailModal.data.auth_provider || "EMAIL"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle size={14} className="text-emerald-600" />
                    <div>
                      <p className="text-[10px] text-stone-400 font-semibold">Line ID</p>
                      <p className="font-bold text-stone-800">
                        {detailModal.data.line_id || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Facebook size={14} className="text-blue-600" />
                    <div>
                      <p className="text-[10px] text-stone-400 font-semibold">Facebook</p>
                      <p className="font-bold text-stone-800 truncate max-w-[90px]">
                        {detailModal.data.facebook || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* สรุปการจอง */}
              <div className="space-y-2">
                <h4 className="font-bold text-stone-400 text-[11px] uppercase tracking-wider">
                  ประวัติการใช้งาน
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3.5 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                      <Hotel size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-500 font-semibold">การจองห้องพัก</p>
                      <p className="text-lg font-bold text-emerald-800">
                        {detailModal.data.room_booking_count ?? 0}{" "}
                        <span className="text-xs font-normal">ครั้ง</span>
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 bg-teal-50/60 border border-teal-100 rounded-2xl flex items-center gap-3">
                    <div className="p-2 bg-teal-100 text-teal-700 rounded-xl">
                      <Ship size={18} />
                    </div>
                    <div>
                      <p className="text-[11px] text-stone-500 font-semibold">การจองเรือ</p>
                      <p className="text-lg font-bold text-teal-800">
                        {detailModal.data.boat_booking_count ?? 0}{" "}
                        <span className="text-xs font-normal">ครั้ง</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* วันที่สมัคร & เวลาแก้ไขล่าสุด */}
              <div className="pt-2 border-t border-stone-100 flex flex-col gap-1 text-stone-500 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> วันที่สมัครสมาชิก:
                  </span>
                  <span className="font-semibold text-stone-700">
                    {detailModal.data.created_at
                      ? new Date(detailModal.data.created_at).toLocaleString("th-TH")
                      : "-"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>อัปเดตล่าสุด:</span>
                  <span className="font-semibold text-stone-700">
                    {detailModal.data.updated_at
                      ? new Date(detailModal.data.updated_at).toLocaleString("th-TH")
                      : "-"}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-stone-50 px-6 py-3.5 border-t border-stone-100 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailModal({ isOpen: false, data: null })}
                className="px-5 py-2 bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold rounded-xl transition-all cursor-pointer"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
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
    </div>
  );
}