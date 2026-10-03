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
import { notify } from "@/lib/admin-notify";
import { PageHeader, Panel, Modal } from "@/components/admin/ui";

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
      notify.error("ไม่สามารถโหลดข้อมูลสมาชิกได้");
    } finally {
      setLoading(false);
    }
  }, [ready]);

  // 🔹 เรียก Fetch ข้อมูลครั้งแรกเมื่อพร้อมเท่านั้น
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleConfirmToggle = async () => {
    if (!confirmModal.memberId) return;

    try {
      const newStatus = !confirmModal.currentStatus;
      await api.put(`/auth/members/${confirmModal.memberId}/status`, {
        is_active: newStatus,
      });

      setMembers((prev) =>
        prev.map((m) =>
          (m.member_id ?? m.id) === confirmModal.memberId
            ? { ...m, is_active: newStatus }
            : m
        )
      );

      notify.success(
        `เปลี่ยนสถานะ ${confirmModal.memberName} เป็น ${
          newStatus ? "เปิดการใช้งาน" : "ปิดการใช้งาน"
        } สำเร็จ`
      );
    } catch (error) {
      console.error("Toggle status error:", error);
      notify.error("ไม่สามารถเปลี่ยนสถานะได้");
    } finally {
      setConfirmModal((prev) => ({ ...prev, isOpen: false }));
    }
  };

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

      return fullName.includes(query) || email.includes(query) || phone.includes(query);
    });
  }, [members, search, statusFilter]);

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentMembers = filteredMembers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredMembers.length / itemsPerPage);

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="จัดการสมาชิก"
        description="ค้นหาและจัดการสถานะบัญชีผู้ใช้งานทั่วไปในระบบ"
        actions={
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-forest-50 text-forest-700 rounded-lg border border-forest-100">
              <Users size={16} />
              <span className="font-semibold">ทั้งหมด {totalMembers}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-100">
              <UserCheck size={16} />
              <span className="font-semibold">ใช้งานอยู่ {activeMembers}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-700 rounded-lg border border-rose-100">
              <UserX size={16} />
              <span className="font-semibold">ปิดใช้งาน {inactiveMembers}</span>
            </div>
          </div>
        }
      />

      <Panel>
        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
          <div className="relative flex-1 w-full">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400"
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, อีเมล หรือเบอร์โทร..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-cream-50 border border-charcoal-200 rounded-xl text-sm font-medium text-charcoal-700 focus:outline-none focus:ring-2 focus:ring-forest-600/20 focus:border-forest-600 transition-all"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-600 p-0.5 rounded-full hover:bg-charcoal-100 transition-colors"
                title="ล้างคำค้นหา"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 p-1 bg-cream-100 rounded-xl text-sm w-full sm:w-auto shrink-0 justify-between sm:justify-start">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                statusFilter === "all"
                  ? "bg-white text-charcoal-800 shadow-sm"
                  : "text-charcoal-500 hover:text-charcoal-800"
              }`}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === "active"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-charcoal-500 hover:text-emerald-700"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              ใช้งาน
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("inactive")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === "inactive"
                  ? "bg-white text-rose-700 shadow-sm"
                  : "text-charcoal-500 hover:text-rose-700"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              ระงับ
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto rounded-xl border border-charcoal-100">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="bg-cream-50 border-b border-charcoal-100 text-xs font-medium text-charcoal-500">
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">สมาชิก</th>
                <th className="py-3 px-4">อีเมล</th>
                <th className="py-3 px-4">เบอร์โทรศัพท์</th>
                <th className="py-3 px-4 text-center">จองห้อง</th>
                <th className="py-3 px-4 text-center">จองเรือ</th>
                <th className="py-3 px-4">วันที่สมัคร</th>
                <th className="py-3 px-4 text-center">สถานะ</th>
                <th className="py-3 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-50">
              {loading ? (
                <tr key="loading-row">
                  <td colSpan={9} className="py-12 text-center text-charcoal-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="animate-spin text-forest-600" size={24} />
                      <span className="font-medium text-charcoal-500">
                        กำลังโหลดข้อมูลสมาชิก...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : currentMembers.length === 0 ? (
                <tr key="no-results-row">
                  <td colSpan={9} className="py-12 text-center text-charcoal-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users size={32} className="text-charcoal-300" />
                      <span className="font-medium text-charcoal-500">ไม่พบรายการสมาชิก</span>
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
                      className="hover:bg-cream-100/60 transition-colors"
                    >
                      <td className="py-3 px-4 font-semibold text-charcoal-400">
                        {indexOfFirstItem + idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={fullName}
                              className="w-8 h-8 rounded-full object-cover border border-charcoal-200"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-charcoal-100 flex items-center justify-center text-charcoal-500 border border-charcoal-200">
                              <UserIcon size={14} />
                            </div>
                          )}
                          <div className="font-medium text-charcoal-900">{fullName}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-charcoal-600">
                          <Mail size={13} className="text-charcoal-400" />
                          <span>{m.email || "-"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 text-charcoal-600">
                          <Phone size={13} className="text-charcoal-400" />
                          <span>{m.phone || "-"}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          <Hotel size={12} />
                          {m.room_booking_count ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-semibold text-lagoon-700 bg-lagoon-50 px-2 py-0.5 rounded-md border border-lagoon-100">
                          <Ship size={12} />
                          {m.boat_booking_count ?? 0}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-charcoal-500">
                        <div className="flex items-center gap-1">
                          <Calendar size={13} className="text-charcoal-400" />
                          {m.created_at
                            ? new Date(m.created_at).toLocaleDateString("th-TH", {
                                day: "numeric",
                                month: "short",
                                year: "2-digit",
                              })
                            : "-"}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isActive
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-rose-50 text-rose-700 border border-rose-200"
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

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setDetailModal({ isOpen: true, data: m })}
                            className="p-1.5 text-charcoal-400 hover:text-forest-700 hover:bg-forest-50 rounded-lg transition-all"
                            title="ดูรายละเอียดเพิ่มเติม"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmModal({ isOpen: true, memberId, currentStatus: isActive, memberName: fullName })}
                            title={isActive ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}
                            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-forest-600/20 ${
                              isActive ? "bg-forest-600" : "bg-charcoal-300"
                            }`}
                          >
                            <span
                              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                                isActive ? "translate-x-5" : "translate-x-1"
                              }`}
                            />
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
        {!loading && filteredMembers.length > 0 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
            <p className="text-charcoal-500">
              แสดงข้อมูล {indexOfFirstItem + 1} -{" "}
              {Math.min(indexOfLastItem, filteredMembers.length)} จากทั้งหมด {filteredMembers.length} รายการ
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-charcoal-200 bg-white text-charcoal-600 hover:bg-charcoal-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="font-semibold text-charcoal-700 px-2">
                หน้า {currentPage} / {totalPages || 1}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 rounded-lg border border-charcoal-200 bg-white text-charcoal-600 hover:bg-charcoal-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </Panel>

      <Modal
        open={confirmModal.isOpen}
        title="ยืนยันการเปลี่ยนสถานะ"
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
              className="rounded-lg px-4 py-2 text-sm font-medium text-charcoal-600 hover:bg-charcoal-50"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirmToggle}
              className="rounded-lg bg-forest-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-forest-800"
            >
              ตกลง
            </button>
          </>
        }
      >
        <div className="flex items-start gap-4">
          <div className="rounded-full bg-amber-100 p-2 text-amber-600">
            <AlertTriangle size={20} />
          </div>
          <div className="mt-1 flex-1">
            <p className="text-sm text-charcoal-600">
              คุณต้องการ{confirmModal.currentStatus ? "ปิดการใช้งาน" : "เปิดการใช้งาน"}บัญชีของ{" "}
              <span className="font-semibold text-charcoal-900">{confirmModal.memberName}</span>{" "}
              ใช่หรือไม่?
            </p>
          </div>
        </div>
      </Modal>

      <Modal
        open={detailModal.isOpen}
        title="ข้อมูลสมาชิก"
        widthClass="max-w-lg"
        onClose={() => setDetailModal({ isOpen: false, data: null })}
        footer={
          <button
            type="button"
            onClick={() => setDetailModal({ isOpen: false, data: null })}
            className="rounded-lg px-4 py-2 text-sm font-medium bg-charcoal-100 text-charcoal-700 hover:bg-charcoal-200"
          >
            ปิด
          </button>
        }
      >
        {detailModal.data && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              {detailModal.data.avatar_url || detailModal.data.image_profile ? (
                <img
                  src={detailModal.data.avatar_url || detailModal.data.image_profile}
                  alt="profile"
                  className="w-16 h-16 rounded-full object-cover border border-charcoal-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-charcoal-100 flex items-center justify-center border border-charcoal-200">
                  <UserIcon size={32} className="text-charcoal-400" />
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold text-forest-800">
                  {`${detailModal.data.first_name || ""} ${detailModal.data.last_name || ""}`.trim() ||
                    "สมาชิกไม่มีชื่อ"}
                </h3>
                <p className="text-sm text-charcoal-500">
                  ID: #{detailModal.data.member_id ?? detailModal.data.id}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">
                ข้อมูลการติดต่อ
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 rounded-xl bg-cream-50 p-4 border border-charcoal-100">
                <div className="flex items-center gap-2.5">
                  <Mail size={16} className="text-charcoal-400 shrink-0" />
                  <span className="text-sm font-medium text-charcoal-800 break-all">
                    {detailModal.data.email || "-"}
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone size={16} className="text-charcoal-400 shrink-0" />
                  <span className="text-sm font-medium text-charcoal-800">
                    {detailModal.data.phone || "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">
                ช่องทางเชื่อมต่อ
              </h4>
              <div className="grid gap-3 sm:grid-cols-3 rounded-xl bg-cream-50 p-4 border border-charcoal-100">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-charcoal-500">
                    <Globe size={14} />
                    <span className="text-xs">ล็อกอิน</span>
                  </div>
                  <span className="text-sm font-semibold text-charcoal-800 uppercase">
                    {detailModal.data.auth_provider || "EMAIL"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-emerald-600">
                    <MessageCircle size={14} />
                    <span className="text-xs text-charcoal-500">Line</span>
                  </div>
                  <span className="text-sm font-semibold text-charcoal-800">
                    {detailModal.data.line_id || "-"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5 text-blue-600">
                    <Facebook size={14} />
                    <span className="text-xs text-charcoal-500">Facebook</span>
                  </div>
                  <span className="text-sm font-semibold text-charcoal-800 truncate">
                    {detailModal.data.facebook || "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-charcoal-400">
                ประวัติการจอง
              </h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-xl bg-emerald-50/50 p-4 border border-emerald-100">
                  <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700">
                    <Hotel size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-emerald-700/70">ห้องพัก</p>
                    <p className="text-lg font-bold text-emerald-800">
                      {detailModal.data.room_booking_count ?? 0} <span className="text-sm font-normal">ครั้ง</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-xl bg-lagoon-50/50 p-4 border border-lagoon-100">
                  <div className="rounded-lg bg-lagoon-100 p-2 text-lagoon-700">
                    <Ship size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-lagoon-700/70">เรือคายัค</p>
                    <p className="text-lg font-bold text-lagoon-800">
                      {detailModal.data.boat_booking_count ?? 0} <span className="text-sm font-normal">ครั้ง</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-charcoal-500 border-t border-charcoal-100 pt-4">
              <Clock size={14} />
              <span>
                สมัครเมื่อ: {detailModal.data.created_at ? new Date(detailModal.data.created_at).toLocaleString("th-TH") : "-"}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
