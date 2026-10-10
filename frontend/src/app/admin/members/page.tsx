"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  ChevronsLeft,
  ChevronsRight,
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
import { Modal } from "@/components/admin/ui";

// Type Interface
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

  // Server-side filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const requestId = useRef(0);

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

  // Load the requested page and global member totals
  const fetchMembers = useCallback(async (): Promise<void> => {
    if (!ready) return;

    const id = ++requestId.current;
    setLoading(true);
    try {
      const res = await api.get("/members", {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: search.trim() || undefined,
          status: statusFilter,
        },
      });
      if (id !== requestId.current) return;
      setPagination(res.data?.pagination || { total: 0, totalPages: 0 });
      setSummary(res.data?.summary || { total: 0, active: 0, inactive: 0 });
      if (currentPage > Math.max(1, res.data?.pagination?.totalPages || 1)) {
        setCurrentPage(Math.max(1, res.data?.pagination?.totalPages || 1));
      }
      const rawData: Member[] = res.data?.data || [];

      const formattedData = rawData.map((item) => ({
        ...item,
        member_id: item.member_id ?? item.id,
      }));

      setMembers(formattedData);
    } catch (error) {
      console.error("Fetch members error:", error);
      if (id === requestId.current) notify.error("ไม่สามารถโหลดข้อมูลสมาชิกได้");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [ready, currentPage, search, statusFilter]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleConfirmToggle = async () => {
    if (!confirmModal.memberId) return;

    try {
      const newStatus = !confirmModal.currentStatus;
      await api.put(`/members/${confirmModal.memberId}/status`, {
        is_active: newStatus,
      });

      await fetchMembers();

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

  const { total: totalMembers, active: activeMembers, inactive: inactiveMembers } = summary;
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentMembers = members;
  const totalPages = pagination.totalPages || 1;

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-900/10">
            <Users size={24} className="stroke-[2.2]" />
          </div>
          <div>
            <h1 className="font-display text-2xl lg:text-3xl font-bold text-forest-900 leading-tight">
              จัดการสมาชิก
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <div className="px-3.5 py-2 bg-cream-50/80 rounded-2xl border border-cream-300 shadow-2xs flex items-center gap-2">
            <Users size={16} className="text-forest-700" />
            <span className="text-xs font-semibold text-charcoal-600">ทั้งหมด</span>
            <span className="text-xs font-bold text-forest-950 font-mono">{totalMembers}</span>
          </div>
          <div className="px-3.5 py-2 bg-forest-50/80 rounded-2xl border border-forest-200 shadow-2xs flex items-center gap-2 text-forest-800">
            <UserCheck size={16} className="text-forest-700" />
            <span className="text-xs font-semibold">ใช้งานอยู่</span>
            <span className="text-xs font-bold font-mono">{activeMembers}</span>
          </div>
          <div className="px-3.5 py-2 bg-rose-50/80 rounded-2xl border border-rose-200 shadow-2xs flex items-center gap-2 text-rose-800">
            <UserX size={16} className="text-rose-600" />
            <span className="text-xs font-semibold">ปิดใช้งาน</span>
            <span className="text-xs font-bold font-mono">{inactiveMembers}</span>
          </div>
        </div>
      </div>

      {/* Main Table Panel (Fixed consistent height with min-h-[660px]) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/90 overflow-hidden flex flex-col min-h-[660px]">
        {/* Panel Header */}
        <div className="pb-4 mb-4 border-b border-cream-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-forest-800" />
            <h2 className="text-base font-bold text-forest-900">
              รายชื่อสมาชิกในระบบ
            </h2>
            <span className="px-2.5 py-0.5 bg-forest-50 text-forest-800 border border-forest-200 rounded-full text-xs font-bold font-mono">
              {pagination.total} คน
            </span>
          </div>

          {/* Filter & Search Bar */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, อีเมล หรือเบอร์โทร..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 bg-cream-50/70 hover:bg-cream-50 focus:bg-white border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
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

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-cream-100 rounded-2xl text-xs w-full sm:w-auto shrink-0 justify-between sm:justify-start">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-white text-forest-900 shadow-2xs font-bold"
                    : "text-charcoal-600 hover:text-charcoal-900"
                }`}
              >
                ทั้งหมด
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("active");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === "active"
                    ? "bg-forest-800 text-white shadow-2xs font-bold"
                    : "text-charcoal-600 hover:text-forest-800"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === "active" ? "bg-white" : "bg-forest-600"}`} />
                ใช้งาน
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("inactive");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  statusFilter === "inactive"
                    ? "bg-rose-600 text-white shadow-2xs font-bold"
                    : "text-charcoal-600 hover:text-rose-700"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusFilter === "inactive" ? "bg-white" : "bg-rose-600"}`} />
                ระงับ
              </button>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto border border-cream-200/90 rounded-2xl shadow-2xs">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50/80 text-xs font-bold text-charcoal-600 uppercase tracking-wider select-none shadow-2xs">
                <th className="py-3.5 px-4 w-12 text-center">#</th>
                <th className="py-3.5 px-4">สมาชิก</th>
                <th className="py-3.5 px-4">อีเมล</th>
                <th className="py-3.5 px-4">เบอร์โทรศัพท์</th>
                <th className="py-3.5 px-4 text-center">จองห้อง</th>
                <th className="py-3.5 px-4 text-center">จองเรือ</th>
                <th className="py-3.5 px-4">วันที่สมัคร</th>
                <th className="py-3.5 px-4 text-center">สถานะ</th>
                <th className="py-3.5 px-4 text-center">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100 bg-white text-xs text-charcoal-700">
              {loading ? (
                <tr key="loading-row">
                  <td colSpan={9} className="py-16 text-center text-charcoal-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="animate-spin text-forest-700" size={24} />
                      <span className="font-medium text-charcoal-500">
                        กำลังโหลดข้อมูลสมาชิก...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : currentMembers.length === 0 ? (
                <tr key="no-results-row">
                  <td colSpan={9} className="py-16 text-center text-charcoal-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Users size={32} className="text-charcoal-300 mb-1" />
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
                      className="hover:bg-cream-50/60 border-b border-cream-100/80 last:border-0 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-center font-semibold text-charcoal-400 font-mono">
                        {indexOfFirstItem + idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          {avatar ? (
                            <img
                              src={avatar}
                              alt={fullName}
                              className="w-8 h-8 rounded-full object-cover border border-cream-300 shadow-2xs"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-cream-100 flex items-center justify-center text-forest-800 border border-cream-200 font-bold text-xs">
                              {(fullName[0] || "U").toUpperCase()}
                            </div>
                          )}
                          <div className="font-semibold text-forest-950">{fullName}</div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-charcoal-600">
                          <Mail size={12} className="text-forest-700 shrink-0" />
                          <span>{m.email || "-"}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 text-charcoal-600 font-mono">
                          <Phone size={12} className="text-forest-700 shrink-0" />
                          <span>{m.phone || "-"}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-semibold text-forest-800 bg-cream-100 px-2 py-0.5 rounded-lg border border-cream-200 font-mono">
                          <Hotel size={12} className="text-forest-700" />
                          {m.room_booking_count ?? 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-semibold text-lagoon-800 bg-lagoon-50 px-2 py-0.5 rounded-lg border border-lagoon-200 font-mono">
                          <Ship size={12} className="text-lagoon-700" />
                          {m.boat_booking_count ?? 0}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-charcoal-500">
                        <div className="flex items-center gap-1.5 text-[11px] font-medium">
                          <Calendar size={12} className="text-forest-700 shrink-0" />
                          <span>
                            {m.created_at
                              ? new Date(m.created_at).toLocaleDateString("th-TH", {
                                  day: "numeric",
                                  month: "short",
                                  year: "2-digit",
                                })
                              : "-"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                            isActive
                              ? "bg-forest-50 text-forest-800 border border-forest-200"
                              : "bg-rose-50 text-rose-800 border border-rose-200"
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? "bg-forest-600" : "bg-rose-600"
                            }`}
                          />
                          {isActive ? "ใช้งานอยู่" : "ถูกระงับ"}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setDetailModal({ isOpen: true, data: m })}
                            className="p-1.5 text-charcoal-500 hover:text-forest-900 bg-cream-100/80 hover:bg-cream-200/80 border border-cream-200 rounded-xl transition-all cursor-pointer"
                            title="ดูรายละเอียดเพิ่มเติม"
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setConfirmModal({
                                isOpen: true,
                                memberId,
                                currentStatus: isActive,
                                memberName: fullName,
                              })
                            }
                            title={isActive ? "ระงับการใช้งาน" : "เปิดการใช้งาน"}
                            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-forest-800/20 ${
                              isActive ? "bg-forest-800" : "bg-charcoal-300"
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
        {pagination.total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-auto border-t border-cream-200 text-xs text-charcoal-500">
            <span>
              แสดงข้อมูล{" "}
              <strong className="text-forest-950 font-mono">{indexOfFirstItem + 1}</strong>{" "}
              -{" "}
              <strong className="text-forest-950 font-mono">
                {Math.min(indexOfLastItem, pagination.total)}
              </strong>{" "}
              จากทั้งหมด{" "}
              <strong className="text-forest-950 font-mono">{pagination.total}</strong> รายการ
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
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
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
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="p-1.5 bg-white border border-cream-300 rounded-xl text-charcoal-600 hover:bg-cream-100 disabled:opacity-40 transition-all cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                title="หน้าถัดไป"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages || totalPages === 0}
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

      {/* MODAL: Toggle Member Status */}
      <Modal
        open={confirmModal.isOpen}
        title="ยืนยันการเปลี่ยนสถานะ"
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
              className="flex-1 py-2.5 px-4 bg-cream-100 hover:bg-cream-200 text-charcoal-700 text-xs font-bold rounded-2xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleConfirmToggle}
              className="flex-1 py-2.5 px-4 bg-forest-800 hover:bg-forest-900 text-white text-xs font-bold rounded-2xl transition-all shadow-xs cursor-pointer active:scale-98"
            >
              ยืนยัน
            </button>
          </div>
        }
      >
        <div className="flex items-start gap-3.5">
          <div className="rounded-2xl bg-amber-50 border border-amber-200 p-2.5 text-amber-700 shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div className="flex-1">
            <p className="text-xs sm:text-sm text-charcoal-600 leading-relaxed">
              คุณต้องการ{confirmModal.currentStatus ? "ระงับการใช้งาน" : "เปิดการใช้งาน"}บัญชีของ{" "}
              <span className="font-bold text-forest-950">{confirmModal.memberName}</span>{" "}
              ใช่หรือไม่?
            </p>
          </div>
        </div>
      </Modal>

      {/* MODAL: Member Details */}
      <Modal
        open={detailModal.isOpen}
        title="ข้อมูลสมาชิก"
        widthClass="max-w-lg"
        onClose={() => setDetailModal({ isOpen: false, data: null })}
        footer={
          <button
            type="button"
            onClick={() => setDetailModal({ isOpen: false, data: null })}
            className="py-2.5 px-5 bg-cream-100 hover:bg-cream-200 text-charcoal-700 text-xs font-bold rounded-2xl transition-colors cursor-pointer"
          >
            ปิด
          </button>
        }
      >
        {detailModal.data && (
          <div className="space-y-4 text-xs text-charcoal-700">
            <div className="flex items-center gap-3.5 pb-3.5 border-b border-cream-200">
              {detailModal.data.avatar_url || detailModal.data.image_profile ? (
                <img
                  src={detailModal.data.avatar_url || detailModal.data.image_profile}
                  alt="profile"
                  className="w-14 h-14 rounded-2xl object-cover border border-cream-300 shadow-2xs"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-cream-100 flex items-center justify-center border border-cream-200 text-forest-800 font-bold text-base">
                  <UserIcon size={24} className="text-forest-700" />
                </div>
              )}
              <div>
                <h3 className="text-base font-bold text-forest-950">
                  {`${detailModal.data.first_name || ""} ${detailModal.data.last_name || ""}`.trim() ||
                    "สมาชิกไม่มีชื่อ"}
                </h3>
              </div>
            </div>

            <div className="space-y-2.5">
              <span className="text-[11px] font-bold text-charcoal-500 uppercase tracking-wider block">
                ข้อมูลการติดต่อ
              </span>
              <div className="grid gap-2.5 sm:grid-cols-2 rounded-2xl bg-cream-50/70 p-3.5 border border-cream-200/90">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-forest-700 shrink-0" />
                  <span className="font-medium text-charcoal-800 break-all">
                    {detailModal.data.email || "-"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-forest-700 shrink-0" />
                  <span className="font-medium text-charcoal-800 font-mono">
                    {detailModal.data.phone || "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <span className="text-[11px] font-bold text-charcoal-500 uppercase tracking-wider block">
                ช่องทางเชื่อมต่อ
              </span>
              <div className="grid gap-2.5 sm:grid-cols-3 rounded-2xl bg-cream-50/70 p-3.5 border border-cream-200/90">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-charcoal-400 text-[11px]">
                    <Globe size={13} className="text-forest-700" />
                    <span>ล็อกอิน</span>
                  </div>
                  <span className="text-xs font-bold text-forest-950 uppercase">
                    {detailModal.data.auth_provider || "EMAIL"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-charcoal-400 text-[11px]">
                    <MessageCircle size={13} className="text-forest-700" />
                    <span>Line</span>
                  </div>
                  <span className="text-xs font-bold text-forest-950 font-mono">
                    {detailModal.data.line_id || "-"}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-1.5 text-charcoal-400 text-[11px]">
                    <Facebook size={13} className="text-lagoon-700" />
                    <span>Facebook</span>
                  </div>
                  <span className="text-xs font-bold text-forest-950 truncate">
                    {detailModal.data.facebook || "-"}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2.5">
              <span className="text-[11px] font-bold text-charcoal-500 uppercase tracking-wider block">
                ประวัติการจอง
              </span>
              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="flex items-center gap-3 rounded-2xl bg-cream-50/70 p-3.5 border border-cream-200/90">
                  <div className="rounded-xl bg-forest-100 p-2 text-forest-800">
                    <Hotel size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] text-charcoal-400">ห้องพัก</p>
                    <p className="text-base font-bold text-forest-950 font-mono">
                      {detailModal.data.room_booking_count ?? 0} <span className="text-xs font-normal text-charcoal-400">ครั้ง</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-cream-50/70 p-3.5 border border-cream-200/90">
                  <div className="rounded-xl bg-lagoon-100 p-2 text-lagoon-800">
                    <Ship size={18} />
                  </div>
                  <div>
                    <p className="text-[11px] text-charcoal-400">เรือ</p>
                    <p className="text-base font-bold text-forest-950 font-mono">
                      {detailModal.data.boat_booking_count ?? 0} <span className="text-xs font-normal text-charcoal-400">ครั้ง</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] text-charcoal-400 border-t border-cream-200 pt-3.5">
              <Clock size={13} className="text-forest-700" />
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
