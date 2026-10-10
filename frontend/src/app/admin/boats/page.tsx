"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  Clock,
  Eye,
  X,
  RefreshCw,
  LogOut,
  LogIn,
  Filter,
  Anchor,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ShieldCheck,
  FileCheck2,
  Search,
  RotateCcw,
  Wallet,
  FileText,
  User,
  ChevronDown,
  AlertTriangle,
  HelpCircle,
  Info,
  Phone,
  MessageSquare,
  Printer,
  Ship,
  Timer,
  Layers,
} from "lucide-react";
import {
  Modal,
  BookingStatusBadge,
  EmptyState,
  CustomDatePicker,
  CustomSelect,
} from "@/components/admin/ui";
import api, { getApiErrorMessage } from "@/lib/api";
import { pickResortInfo, type ResortInfoRecord } from "@/lib/resort-info";
import { toISODate } from "@/lib/date";
import { resolveMediaUrl } from "@/lib/avatar";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";

// ตัวเลือกเหตุผลในการปฏิเสธ
const REJECT_REASONS = [
  "สลิปไม่ชัดเจน / อ่านข้อมูลไม่ได้",
  "ยอดเงินไม่ถูกต้อง / ไม่ครบถ้วน",
  "บัญชีโอนเงินไม่ถูกต้อง",
  "ไม่พบยอดเงินโอนในระบบ",
  "รายการจองซ้ำซ้อน",
  "อื่นๆ",
];

// Mapping สถานะสำหรับ UI
const statusLabel: Record<string, string> = {
  pending: "รอดำเนินการ",
  paid: "รอตรวจสอบสลิป",
  approved: "อนุมัติแล้ว (รอลงเรือ)",
  checked_out: "คืนเรือแล้ว",
  cancelled: "ยกเลิก",
  rejected: "ถูกปฏิเสธ",
};

const statusConfig: Record<string, { bg: string; text: string; dot: string }> =
  {
    pending: {
      bg: "bg-lagoon-900/10 border-lagoon-900/80 text-lagoon-900",
      text: "รอดำเนินการ",
      dot: "bg-amber-500",
    },
    paid: {
      bg: "bg-lagoon-500/10 border-lagoon-200/80 text-lagoon-700",
      text: "รอตรวจสอบสลิป",
      dot: "bg-lagoon-500",
    },
    approved: {
      bg: "bg-lagoon-500/10 border-lagoon-200/80 text-lagoon-700",
      text: "อนุมัติแล้ว (รอลงเรือ)",
      dot: "bg-lagoon-500",
    },
    checked_out: {
      bg: "bg-charcoal-500/10 border-charcoal-200/80 text-charcoal-600",
      text: "คืนเรือเรียบร้อย",
      dot: "bg-charcoal-400",
    },
    cancelled: {
      bg: "bg-stone-500/10 border-stone-200/80 text-stone-600",
      text: "ยกเลิกการจอง",
      dot: "bg-stone-400",
    },
    rejected: {
      bg: "bg-rose-500/10 border-rose-200/80 text-rose-700",
      text: "ถูกปฏิเสธ",
      dot: "bg-rose-500",
    },
  };

type FilterType = "all" | "has_slip" | "pending" | "approved" | "checked_out";


function BoatStaffDashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { ready } = useAuthGuard({
    allowedRoles: ["admin", "boat_staff"],
  });

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [counts, setCounts] = useState({ all: 0, has_slip: 0, pending: 0, approved: 0, checked_out: 0, totalRevenue: 0, pendingRevenue: 0 });
  const [catalogTypes, setCatalogTypes] = useState<string[]>([]);
  const requestId = useRef(0);

  // อ่านค่า State จาก URL Query Parameters
  const filter = (searchParams.get("filter") as FilterType) || "all";
  const boatType = searchParams.get("boatType") || "all";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const searchParam = searchParams.get("search") || "";
  const pageParam = Number(searchParams.get("page"));
  const currentPage = Number.isSafeInteger(pageParam) && pageParam > 0 ? pageParam : 1;

  // Search Debounce State
  const [searchInput, setSearchInput] = useState(searchParam);

  // Modal สลิป และ รายละเอียด
  const [slipModal, setSlipModal] = useState<{
    open: boolean;
    url: string;
    name: string;
  }>({ open: false, url: "", name: "" });

  const [detailsModal, setDetailsModal] = useState<{
    open: boolean;
    booking: any | null;
  }>({ open: false, booking: null });

  const [resort, setResort] = useState<ResortInfoRecord | null>(null);
  // ข้อควรทราบของเรือแยกจากของห้องพัก (แถว boat id 5)
  const [boatTerms, setBoatTerms] = useState<string | null>(null);
  useEffect(() => {
    if (!detailsModal.open || resort) return;
    api.get("/settings/resort")
      .then((res) => {
        setResort(pickResortInfo(res.data?.data, "main"));
        setBoatTerms(pickResortInfo(res.data?.data, "boat").additional_terms ?? null);
      })
      .catch(() => undefined);
  }, [detailsModal.open, resort]);

  // Modal ยืนยันการทำงานทั่วไป
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    text: string;
    icon: "question" | "warning" | "info";
    confirmText: string;
    confirmColor: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: "",
    text: "",
    icon: "question",
    confirmText: "ยืนยัน",
    confirmColor: "bg-forest-800 hover:bg-forest-900",
    onConfirm: () => {},
  });

  // Modal กรณีปฏิเสธการจอง (ใช้เลือกรายการ + กรอกเหตุผลเพิ่มเติม)
  const [rejectModal, setRejectModal] = useState<{
    open: boolean;
    bookingId: number | null;
    selectedReason: string;
    customReason: string;
  }>({
    open: false,
    bookingId: null,
    selectedReason: REJECT_REASONS[0], // ค่าเริ่มต้นตัวแรก
    customReason: "",
  });

  const itemsPerPage = 10;

  // ช่วงเวลาด่วน (วันนี้, สัปดาห์นี้, เดือนนี้)
  const quickDateRanges = useMemo(() => {
    const now = new Date();
    const today = toISODate(now);

    // สัปดาห์นี้ (จันทร์ ถึง อาทิตย์)
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const startOfWeek = toISODate(monday);
    const endOfWeek = toISODate(sunday);

    // เดือนนี้ (1 ถึง วันสุดท้ายของเดือน)
    const startOfMonth = toISODate(new Date(now.getFullYear(), now.getMonth(), 1));
    const endOfMonth = toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));

    return {
      today: { label: "วันนี้", from: today, to: today },
      thisWeek: { label: "สัปดาห์นี้", from: startOfWeek, to: endOfWeek },
      thisMonth: { label: "เดือนนี้", from: startOfMonth, to: endOfMonth },
    };
  }, []);

  // ฟังก์ชันช่วยอัปเดต Query String ใน URL
  const updateQueryParams = useCallback(
    (paramsToUpdate: Record<string, string | number | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(paramsToUpdate).forEach(([key, value]) => {
        if (value === null || value === "" || value === undefined) {
          params.delete(key);
        } else {
          params.set(key, String(value));
        }
      });

      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, pathname, router],
  );

  // Debounce การค้นหา
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchParam) {
        updateQueryParams({ search: searchInput, page: 1 });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, searchParam, updateQueryParams]);

  // ซิงค์ SearchInput หาก URL เปลี่ยนโดยตรง
  useEffect(() => {
    setSearchInput(searchParam);
  }, [searchParam]);

  const handleFilterChange = (newFilter: FilterType) => {
    updateQueryParams({ filter: newFilter, page: 1 });
  };

  const handleDateChange = (from: string, to: string) => {
    updateQueryParams({ dateFrom: from, dateTo: to, page: 1 });
  };

  const handleClearFilters = () => {
    setSearchInput("");
    router.replace(pathname, { scroll: false });
  };

  const handlePageChange = (page: number) => {
    updateQueryParams({ page });
  };

  const fetchBookings = useCallback(async (): Promise<void> => {
    if (!ready) return;
    const id = ++requestId.current;
    setLoading(true);
    try {
      const res = await api.get("/kayaks/bookings/all", { params: { page: currentPage, limit: itemsPerPage,
        filter, search: searchParam.trim() || undefined,
        boat_type: boatType === "all" ? undefined : boatType,
        date_from: dateFrom || undefined, date_to: dateTo || undefined,
      } });
      if (id !== requestId.current) return;
      setBookings(res.data?.data || []);
      setPagination(res.data.pagination);
      setCounts(res.data.summary);
      if (currentPage > Math.max(1, res.data.pagination.totalPages)) updateQueryParams({ page: Math.max(1, res.data.pagination.totalPages) });
    } catch {
      if (id === requestId.current) notify.error("ไม่สามารถโหลดข้อมูลการจองได้");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [ready, currentPage, filter, boatType, dateFrom, dateTo, searchParam, updateQueryParams]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);
  useEffect(() => {
    if (!ready) return;
    api.get("/kayaks/admin/types").then((res) => {
      const types: { type_name?: string; room_name?: string; name?: string }[] = res.data?.data || [];
      setCatalogTypes(Array.from(new Set(types.map((type) => type.name || type.type_name || "").filter(Boolean))));
    }).catch(() => notify.error("ไม่สามารถโหลดประเภทเรือได้"));
  }, [ready]);


  const openConfirmDialog = (
    title: string,
    text: string,
    icon: "question" | "warning" | "info",
    confirmText: string,
    confirmColor: string,
    onConfirm: () => void,
  ) => {
    setConfirmModal({
      open: true,
      title,
      text,
      icon,
      confirmText,
      confirmColor,
      onConfirm,
    });
  };

  // handleApprove (อนุมัติ)
  const handleApprove = (id: number) => {
    openConfirmDialog(
      "อนุมัติรายการจองเรือนี้?",
      "เมื่ออนุมัติแล้ว สถานะจะเปลี่ยนเป็น 'อนุมัติแล้ว (รอลงเรือ)'",
      "question",
      "อนุมัติการจอง",
      "bg-forest-800 hover:bg-forest-900",
      async () => {
        try {
          await api.put(`/kayaks/bookings/${id}/status`, {
            status: "approved",
          });
          notify.success("อนุมัติการจองเรียบร้อยแล้ว");
          setBookings((prev) =>
            prev.map((b) =>
              (b.boat_booking_id || b.id) === id
                ? { ...b, status: "approved" }
                : b,
            ),
          );
          fetchBookings();
        } catch (err: unknown) {
          notify.error(getApiErrorMessage(err, "ทำรายการไม่สำเร็จ"));
        }
      },
    );
  };

  // handleRejectSubmit (ประมวลผลข้อความเหตุผลส่งให้ API)
  const handleRejectSubmit = async () => {
    if (!rejectModal.bookingId) return;

    const finalReason =
      rejectModal.selectedReason === "อื่นๆ"
        ? rejectModal.customReason.trim()
        : rejectModal.selectedReason;

    if (rejectModal.selectedReason === "อื่นๆ" && !finalReason) {
      notify.error("กรุณาระบุเหตุผลเพิ่มเติม");
      return;
    }

    try {
      await api.put(`/kayaks/bookings/${rejectModal.bookingId}/status`, {
        status: "rejected",
        reject_reason: finalReason || "ข้อมูลหลักฐานไม่ถูกต้อง",
      });
      notify.success("ปฏิเสธรายการจองเรียบร้อยแล้ว");

      setBookings((prev) =>
        prev.map((b) =>
          (b.boat_booking_id || b.id) === rejectModal.bookingId
            ? { ...b, status: "rejected", reject_reason: finalReason }
            : b,
        ),
      );

      setRejectModal({
        open: false,
        bookingId: null,
        selectedReason: REJECT_REASONS[0],
        customReason: "",
      });
      fetchBookings();
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "ปฏิเสธการจองไม่สำเร็จ"));
    }
  };

  // handleCheckout (คืนเรือ)
  const handleCheckout = (id: number) => {
    openConfirmDialog(
      "ยืนยันการคืนเรือ (Check-out)?",
      "เมื่อยืนยัน สถานะจะเปลี่ยนเป็น 'คืนเรือแล้ว'",
      "warning",
      "ยืนยัน Check-out",
      "bg-bamboo-700 hover:bg-bamboo-800",
      async () => {
        try {
          await api.put(`/kayaks/bookings/${id}/checkout`);
          notify.success("คืนเรือสำเร็จเรียบร้อย");
          setBookings((prev) =>
            prev.map((b) =>
              (b.boat_booking_id || b.id) === id
                ? {
                    ...b,
                    status: "checked_out",
                    checkout_at: new Date().toISOString(),
                  }
                : b,
            ),
          );
          fetchBookings();
        } catch (err: unknown) {
          notify.error(getApiErrorMessage(err, "เช็คเอาต์ไม่สำเร็จ"));
        }
      },
    );
  };

  const handlePrintDetails = () => {
    window.print();
  };

  const boatTypes = catalogTypes;

  const boatTypeOptions = useMemo(() => {
    return [
      { value: "all", label: "ทั้งหมดทุกประเภท" },
      ...boatTypes.map((t) => ({ value: t, label: t })),
    ];
  }, [boatTypes]);

  const totalPages = Math.max(1, pagination.totalPages);
  const paginatedBookings = bookings;

  const getPaginationRange = () => {
    const delta = 1;
    const range: (number | string)[] = [];
    for (
      let i = Math.max(2, currentPage - delta);
      i <= Math.min(totalPages - 1, currentPage + delta);
      i++
    ) {
      range.push(i);
    }
    if (currentPage - delta > 2) range.unshift("...");
    if (currentPage + delta < totalPages - 1) range.push("...");
    range.unshift(1);
    if (totalPages > 1) range.push(totalPages);
    return range;
  };

  const hasActiveFilters =
    filter !== "all" || boatType !== "all" || dateFrom || dateTo || searchParam;

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-16 max-w-[1600px] mx-auto">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          .print\\:hidden,
          button,
          .no-print {
            display: none !important;
          }
          .printable-modal,
          .printable-modal * {
            visibility: visible !important;
          }
          .printable-modal {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 20px !important;
            box-shadow: none !important;
            border: none !important;
            background: #ffffff !important;
          }
          .fixed,
          [role="dialog"] {
            position: static !important;
            max-height: none !important;
            overflow: visible !important;
            box-shadow: none !important;
          }
          .printable-modal-overlay {
            position: absolute !important;
            background: transparent !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Top Header Card with Integrated Revenue */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/80 relative print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-800/10 shrink-0">
              <Ship size={20} className="stroke-[2.2]" />
            </span>
            <div>
              <h1 className="font-display text-2xl lg:text-3xl font-bold text-forest-900 tracking-tight">
                จัดการการจองเรือ
              </h1>
            </div>
          </div>

          {/* Revenue Pill / Badge in Top Header */}
          <div className="flex items-center gap-3 bg-forest-50/70 border border-forest-100/90 px-4 py-2.5 rounded-2xl self-start sm:self-auto shrink-0 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-forest-800 text-white flex items-center justify-center shadow-sm shrink-0">
              <Wallet size={18} className="stroke-[2.2]" />
            </div>
            <div>
              <span className="text-[11px] font-semibold text-forest-700 uppercase tracking-wider block">รายได้ยืนยันแล้ว</span>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-lg sm:text-xl font-bold text-forest-950 tracking-tight">
                  ฿{counts.totalRevenue.toLocaleString()}
                </span>
                {counts.pendingRevenue > 0 && (
                  <span className="text-[11px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
                    รอตรวจ ฿{counts.pendingRevenue.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5 Interactive Filter Cards */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-3.5 print:hidden">
        {[
          {
            key: "all" as FilterType,
            label: "ทั้งหมด",
            count: counts.all,
            icon: <Layers size={19} className="stroke-[2.2]" />,
            activeBorder: "border-forest-800 ring-2 ring-forest-800/20 shadow-md",
            activeBg: "bg-forest-900 text-white",
            iconBg: "bg-forest-50 text-forest-800 border-forest-100",
            activeIconBg: "bg-white/20 text-white border-white/20",
          },
          {
            key: "has_slip" as FilterType,
            label: "รอตรวจสอบสลิป",
            count: counts.has_slip,
            icon: <FileCheck2 size={19} className="stroke-[2.2]" />,
            activeBorder: "border-lagoon-600 ring-2 ring-lagoon-600/20 shadow-md",
            activeBg: "bg-lagoon-700 text-white",
            iconBg: "bg-lagoon-50 text-lagoon-700 border-lagoon-200",
            activeIconBg: "bg-white/20 text-white border-white/20",
          },
          {
            key: "pending" as FilterType,
            label: "ยังไม่ชำระเงิน",
            count: counts.pending,
            icon: <Clock size={19} className="stroke-[2.2]" />,
            activeBorder: "border-amber-600 ring-2 ring-amber-600/20 shadow-md",
            activeBg: "bg-amber-600 text-white",
            iconBg: "bg-amber-50 text-amber-700 border-amber-200",
            activeIconBg: "bg-white/20 text-white border-white/20",
          },
          {
            key: "approved" as FilterType,
            label: "อนุมัติแล้ว",
            count: counts.approved,
            icon: <ShieldCheck size={19} className="stroke-[2.2]" />,
            activeBorder: "border-forest-700 ring-2 ring-forest-700/20 shadow-md",
            activeBg: "bg-forest-800 text-white",
            iconBg: "bg-forest-50 text-forest-800 border-forest-100",
            activeIconBg: "bg-white/20 text-white border-white/20",
          },
          {
            key: "checked_out" as FilterType,
            label: "คืนเรือแล้ว",
            count: counts.checked_out,
            icon: <Anchor size={19} className="stroke-[2.2]" />,
            activeBorder: "border-bamboo-800 ring-2 ring-bamboo-800/20 shadow-md",
            activeBg: "bg-bamboo-800 text-white",
            iconBg: "bg-bamboo-50 text-bamboo-800 border-bamboo-200",
            activeIconBg: "bg-white/20 text-white border-white/20",
          },
        ].map((item) => {
          const isActive = filter === item.key;
          return (
            <button
              key={item.key}
              onClick={() => handleFilterChange(item.key)}
              className={`text-left relative p-4 sm:p-4.5 rounded-3xl transition-all duration-200 border cursor-pointer hover:shadow-md ${
                isActive
                  ? `${item.activeBorder} ${item.activeBg}`
                  : "bg-white border-cream-200/90 shadow-panel hover:border-forest-300"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p
                    className={`text-xs font-semibold uppercase tracking-wider ${
                      isActive ? "text-white/80" : "text-charcoal-500"
                    }`}
                  >
                    {item.label}
                  </p>
                  <p
                    className={`mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight ${
                      isActive ? "text-white" : "text-forest-950"
                    }`}
                  >
                    {item.count}
                    <span
                      className={`text-xs sm:text-sm font-normal ml-1.5 font-sans ${
                        isActive ? "text-white/80" : "text-charcoal-400"
                      }`}
                    >
                      รายการ
                    </span>
                  </p>
                </div>
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl border flex items-center justify-center shrink-0 transition-colors ${
                    isActive ? item.activeIconBg : item.iconBg
                  }`}
                >
                  {item.icon}
                </div>
              </div>
            </button>
          );
        })}
      </section>

      {/* Filter & Control Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl shadow-panel border border-cream-200/90 space-y-3.5 print:hidden">
        {/* Row 1: Actions & Active Filter indicator */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-charcoal-500">ตัวกรอง:</span>
            <span className="text-xs font-bold text-forest-900 bg-cream-100 px-3 py-1 rounded-xl border border-cream-200">
              {filter === "all"
                ? "ทั้งหมด"
                : filter === "has_slip"
                ? "รอตรวจสอบสลิป"
                : filter === "pending"
                ? "ยังไม่ชำระเงิน"
                : filter === "approved"
                ? "อนุมัติแล้ว"
                : "คืนเรือแล้ว"}
            </span>
          </div>

          {/* Action Buttons (Right) */}
          <div className="flex items-center gap-2 shrink-0">
            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1.5 text-xs text-charcoal-600 hover:text-charcoal-900 bg-cream-100 hover:bg-cream-200 px-3.5 py-2 rounded-2xl border border-cream-300/80 font-semibold transition-colors"
                title="ล้างการกรองทั้งหมด"
              >
                <RotateCcw size={13} />
                <span>รีเซ็ตตัวกรอง</span>
              </button>
            )}
            <button
              onClick={fetchBookings}
              className="px-3.5 py-2 text-charcoal-700 bg-white hover:bg-forest-50/50 hover:border-forest-200 rounded-2xl border border-cream-300 shadow-xs transition-all text-xs font-semibold flex items-center gap-2 active:scale-95"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw
                size={14}
                className={loading ? "animate-spin text-forest-700" : "text-charcoal-500"}
              />
              <span>รีเฟรชข้อมูล</span>
            </button>
          </div>
        </div>

        {/* Row 2: Secondary Filter Controls (Search, Type, Date Range & Presets) */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2.5 border-t border-cream-100">
          {/* Search Input */}
          <div className="relative flex-1 sm:w-64 min-w-[200px]">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, เบอร์โทร, ประเภทเรือ, ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-cream-50/70 hover:bg-cream-50 focus:bg-white pl-10 pr-8 py-2 rounded-2xl border border-cream-300 focus:outline-none focus:ring-2 focus:ring-forest-500/20 text-xs font-medium text-charcoal-800 placeholder:text-charcoal-400 transition-all"
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput("");
                  updateQueryParams({ search: null, page: 1 });
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-600 p-0.5 rounded-full"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Boat Type Selector */}
          <div className="flex items-center gap-2 bg-cream-50/80 px-3 py-1.5 rounded-2xl border border-cream-300 text-xs text-charcoal-700">
            <Ship size={14} className="text-forest-700" />
            <span className="font-medium text-charcoal-500 whitespace-nowrap">
              ประเภท:
            </span>
            <CustomSelect
              options={boatTypeOptions}
              value={boatType}
              onChange={(val) =>
                updateQueryParams({ boatType: val, page: 1 })
              }
              width="w-40"
            />
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-2 bg-cream-50/80 px-3 py-1.5 rounded-2xl border border-cream-300 text-xs text-charcoal-700">
            <CalendarDays size={14} className="text-forest-700 shrink-0" />
            <span className="font-medium text-charcoal-500 whitespace-nowrap">
              วันที่:
            </span>
            <CustomDatePicker
              value={dateFrom}
              onChange={(val) => handleDateChange(val, dateTo)}
              placeholder="เริ่ม"
            />
            <span className="text-cream-400 font-bold">–</span>
            <CustomDatePicker
              value={dateTo}
              onChange={(val) => handleDateChange(dateFrom, val)}
              placeholder="สิ้นสุด"
            />
          </div>

          {/* Quick Date Presets */}
          <div className="flex items-center gap-1 bg-cream-100 p-1 rounded-2xl">
            {(
              [
                ["today", quickDateRanges.today.label, quickDateRanges.today.from, quickDateRanges.today.to],
                ["thisWeek", quickDateRanges.thisWeek.label, quickDateRanges.thisWeek.from, quickDateRanges.thisWeek.to],
                ["thisMonth", quickDateRanges.thisMonth.label, quickDateRanges.thisMonth.from, quickDateRanges.thisMonth.to],
              ] as const
            ).map(([key, label, from, to]) => {
              const isActive = dateFrom === from && dateTo === to;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (isActive) {
                      handleDateChange("", "");
                    } else {
                      handleDateChange(from, to);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-forest-800 text-white shadow-xs font-bold"
                      : "text-charcoal-600 hover:text-charcoal-900 hover:bg-cream-200/60"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bookings Table Panel (Fixed consistent height with min-h-[660px]) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/90 overflow-hidden flex flex-col min-h-[660px] print:hidden">
        {/* Table Panel Header */}
        <div className="pb-4 mb-4 border-b border-cream-200/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-forest-800" />
            <h2 className="text-base font-bold text-forest-900">
              รายการจองเรือทั้งหมด
            </h2>
            <span className="px-2.5 py-0.5 bg-forest-50 text-forest-800 border border-forest-200 rounded-full text-xs font-bold font-mono">
              {pagination.total} รายการ
            </span>
          </div>
        </div>

        <div className="overflow-x-auto border border-cream-200/90 rounded-2xl shadow-2xs">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50/80 text-charcoal-600 font-bold text-xs uppercase tracking-wider">
                <th className="px-3.5 py-3.5 whitespace-nowrap">ลูกค้า / รหัสจอง</th>
                <th className="px-3.5 py-3.5 min-w-[190px]">ประเภทเรือ</th>
                <th className="px-3.5 py-3.5 whitespace-nowrap">วัน - รอบเวลา</th>
                <th className="px-3 py-3.5 whitespace-nowrap">ยอดรวม</th>
                <th className="px-3.5 py-3.5 whitespace-nowrap">สถานะ</th>
                <th className="px-3 py-3.5 text-center whitespace-nowrap">สลิปโอนเงิน</th>
                <th className="px-4 py-3.5 text-right whitespace-nowrap sticky right-0 bg-cream-50/95 backdrop-blur-xs shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] z-10">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-charcoal-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw
                        size={28}
                        className="animate-spin text-forest-700"
                      />
                      <span className="text-xs font-medium text-charcoal-500">
                        กำลังโหลดข้อมูลรายการจอง...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : paginatedBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 px-6 py-8">
                      <div className="w-14 h-14 rounded-2xl bg-cream-50 border border-cream-200 text-charcoal-400 flex items-center justify-center mb-1">
                        <Ship size={26} className="stroke-[1.5]" />
                      </div>
                      <p className="font-display font-bold text-base text-forest-900">ไม่พบรายการจอง</p>
                      <p className="text-xs text-charcoal-400 max-w-sm">
                        {hasActiveFilters
                          ? "ลองปรับเปลี่ยนคำค้นหาหรือเงื่อนไขการกรองใหม่"
                          : "ยังไม่มีรายการจองเรือในระบบ"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedBookings.map((b: any) => {
                  const bookingId = b.boat_booking_id || b.id;

                  return (
                    <tr
                      key={bookingId}
                      className="hover:bg-cream-50/60 border-b border-cream-100/80 last:border-0 transition-colors group"
                    >
                      <td className="px-4 py-3.5">
                        <div className="min-w-[130px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-xs font-bold text-forest-800 bg-cream-100 px-1.5 py-0.5 rounded-md border border-cream-200 shadow-2xs">
                              #{bookingId}
                            </span>
                            <span className="font-semibold text-charcoal-900 text-xs sm:text-sm">
                              {b.user_name || "ไม่ระบุชื่อ"}
                            </span>
                          </div>
                          <p className="text-xs text-charcoal-500 font-mono flex items-center gap-1 mt-1">
                            <Phone size={10} className="text-charcoal-400" />
                            {b.user_phone || b.phone || "-"}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="min-w-[230px] max-w-[340px] space-y-1.5">
                          {Array.isArray(b.boats) && b.boats.length > 0 ? (
                            b.boats.map((line: any, idx: number) => (
                              <div
                                key={line.booking_boat_id || `boat-${idx}`}
                                className="flex items-center justify-between gap-2 bg-cream-50/80 border border-cream-200/90 rounded-xl px-2.5 py-1.5 transition-colors hover:bg-cream-100/70"
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <Ship size={13} className="text-forest-700 shrink-0" />
                                  <span className="font-semibold text-charcoal-900 text-xs">
                                    {line.type_name || b.kayak_name || "เรือ"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 text-[11px]">
                                  <span className="font-bold text-forest-900 bg-white px-1.5 py-0.5 rounded-md border border-cream-200/90 font-mono shadow-2xs">
                                    {line.boat_count ?? 1} ลำ
                                  </span>
                                  <span className="text-charcoal-400 font-medium whitespace-nowrap">
                                    ({line.num_passengers ?? 0} คน)
                                  </span>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs bg-cream-50/80 border border-cream-200/90 rounded-xl px-2.5 py-1.5">
                              <Ship size={13} className="text-forest-700 shrink-0" />
                              <span className="font-semibold text-charcoal-900">
                                {b.kayak_name || b.boat_name || "-"}
                              </span>
                            </div>
                          )}

                          {b.is_addon && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-lagoon-50 border border-lagoon-200/80 text-lagoon-800 text-[10px] font-semibold">
                                <span>แพ็กเกจห้องพัก #{b.room_booking_id}</span>
                                <span className="text-lagoon-600 font-normal">
                                  • {b.addon_mode === "free" ? "สิทธิ์ฟรี" : "ชำระรวมกับห้อง"}
                                </span>
                              </span>
                            </div>
                          )}
                        </div>
                      </td>

                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-charcoal-800 text-xs">
                            {b.booking_date
                              ? new Date(b.booking_date).toLocaleDateString(
                                  "th-TH",
                                  {
                                    day: "numeric",
                                    month: "short",
                                    year: "2-digit",
                                  },
                                )
                              : "-"}
                          </span>
                          <div className="flex items-center gap-1 text-[11px] text-charcoal-500 font-mono">
                            <Timer size={11} className="text-forest-700/80" />
                            <span>
                              {b.start_time && b.end_time
                                ? `${b.start_time?.slice(0, 5)} - ${b.end_time?.slice(0, 5)}`
                                : "-"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3.5 font-bold text-forest-900 font-mono text-sm whitespace-nowrap">
                        ฿{Number(b.total_price || 0).toLocaleString()}
                      </td>

                      <td className="px-3.5 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          {b.is_addon && ['pending', 'paid'].includes(b.status) ? (
                            <span className="inline-block rounded-xl border border-bamboo-200 bg-bamboo-50 px-2.5 py-1 text-xs font-semibold text-bamboo-800">รออนุมัติห้องพัก #{b.room_booking_id}</span>
                          ) : <BookingStatusBadge status={b.status} />}
                          {b.approved_by_name &&
                            ["approved", "checked_out", "rejected"].includes(
                              b.status,
                            ) && (
                              <span className="text-[11px] text-charcoal-400 ml-1">
                                โดย: {b.approved_by_name}
                              </span>
                            )}
                        </div>
                      </td>

                      <td className="px-3 py-3.5 text-center whitespace-nowrap">
                        {b.payment_slip ? (
                          <button
                            onClick={() =>
                              setSlipModal({
                                open: true,
                                url: resolveMediaUrl(b.payment_slip),
                                name: b.user_name || "slip",
                              })
                            }
                            className="inline-flex items-center gap-1.5 text-xs text-forest-800 bg-forest-50 hover:bg-forest-100 border border-forest-200/80 px-2.5 py-1.5 rounded-xl font-semibold transition-all active:scale-95 shadow-2xs"
                          >
                            <Eye size={13} />
                            <span>ดูสลิป</span>
                          </button>
                        ) : (
                          <span className="text-charcoal-300 font-mono text-xs">
                            -
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-right whitespace-nowrap sticky right-0 bg-white/95 group-hover:bg-cream-50/95 backdrop-blur-xs shadow-[-6px_0_12px_-4px_rgba(0,0,0,0.06)] z-10 transition-colors">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() =>
                              setDetailsModal({ open: true, booking: b })
                            }
                            className="p-1.5 text-charcoal-500 hover:text-charcoal-800 bg-cream-100 hover:bg-cream-200/80 rounded-xl transition-colors"
                            title="ดูรายละเอียดการจอง"
                          >
                            <FileText size={15} />
                          </button>

                          {b.status === "checked_out" ? (
                            <span className="text-xs text-bamboo-800 font-semibold bg-bamboo-50 border border-bamboo-200 px-3 py-1 rounded-xl inline-block">
                              เช็คเอาต์แล้ว
                            </span>
                          ) : b.status === "approved" ? (
                            <Link
                              href={`/admin/boats/checkin?date=${b.booking_date ? toISODate(new Date(b.booking_date)) : ""}`}
                              className="inline-flex items-center gap-1.5 text-xs bg-forest-50 hover:bg-forest-100 text-forest-800 font-semibold px-2.5 py-1.5 rounded-xl border border-forest-200/80 shadow-2xs transition-all active:scale-95"
                              title="ไปที่หน้าเช็คอินท่าเรือเพื่อปล่อยเรือ"
                            >
                              <Ship size={13} className="text-forest-700" />
                              <span>รอเช็คอินท่าเรือ</span>
                            </Link>
                          ) : b.status === "rejected" ? (
                            <span className="text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl inline-block">
                              ปฏิเสธแล้ว
                            </span>
                          ) : b.status === "cancelled" ? (
                            <span className="text-xs text-charcoal-500 font-semibold bg-cream-100 border border-cream-200 px-2.5 py-1 rounded-xl inline-block">
                              ยกเลิกแล้ว
                            </span>
                          ) : b.is_addon && ['pending', 'paid'].includes(b.status) ? (
                            <span className="inline-block max-w-44 whitespace-normal text-left text-[11px] leading-relaxed text-charcoal-600">
                              รอตรวจสลิปห้อง #{b.room_booking_id}
                            </span>
                          ) : b.payment_slip ? (
                            <>
                              <button
                                onClick={() => handleApprove(bookingId)}
                                className="inline-flex items-center gap-1 text-xs bg-forest-800 hover:bg-forest-900 text-white font-semibold px-2.5 py-1.5 rounded-xl transition-all shadow-xs active:scale-95"
                              >
                                <span>อนุมัติ</span>
                              </button>
                              <button
                                onClick={() =>
                                  setRejectModal({
                                    open: true,
                                    bookingId,
                                    selectedReason: REJECT_REASONS[0],
                                    customReason: "",
                                  })
                                }
                                className="inline-flex items-center gap-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold px-2.5 py-1.5 rounded-xl border border-rose-200 transition-all active:scale-95"
                              >
                                <span>ปฏิเสธ</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-charcoal-400 italic">
                              รอดำเนินการ
                            </span>
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
        {pagination.total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-auto border-t border-cream-200/80 text-xs text-charcoal-500 print:hidden">
            <span>
              แสดง{" "}
              <strong className="text-charcoal-800 font-mono">
                {(currentPage - 1) * itemsPerPage + 1}
              </strong>{" "}
              ถึง{" "}
              <strong className="text-charcoal-800 font-mono">
                {Math.min(currentPage * itemsPerPage, pagination.total)}
              </strong>{" "}
              จากทั้งหมด{" "}
              <strong className="text-charcoal-800 font-mono">
                {pagination.total}
              </strong>{" "}
              รายการ
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={loading || currentPage === 1}
                className="p-1.5 rounded-xl border border-cream-300 bg-white text-charcoal-600 disabled:opacity-40 hover:bg-cream-100 transition-colors shadow-2xs"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={loading || currentPage === 1}
                className="p-1.5 rounded-xl border border-cream-300 bg-white text-charcoal-600 disabled:opacity-40 hover:bg-cream-100 transition-colors shadow-2xs"
              >
                <ChevronLeft size={16} />
              </button>

              {getPaginationRange().map((page, idx) =>
                typeof page === "number" ? (
                  <button
                    key={idx}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold font-mono transition-all ${
                      currentPage === page
                        ? "bg-forest-800 text-white shadow-2xs"
                        : "bg-white text-charcoal-600 border border-cream-300 hover:bg-cream-100"
                    }`}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={idx} className="px-1 text-charcoal-400 font-bold">
                    {page}
                  </span>
                ),
              )}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={loading || currentPage >= totalPages}
                className="p-1.5 rounded-xl border border-cream-300 bg-white text-charcoal-600 disabled:opacity-40 hover:bg-cream-100 transition-colors shadow-2xs"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={loading || currentPage >= totalPages}
                className="p-1.5 rounded-xl border border-cream-300 bg-white text-charcoal-600 disabled:opacity-40 hover:bg-cream-100 transition-colors shadow-2xs"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
      

      {/* Slip Modal */}
      <Modal 
        open={slipModal.open} 
        title={`หลักฐานการชำระเงิน (${slipModal.name})`} 
        onClose={() => setSlipModal({ open: false, url: "", name: "" })}
        footer={
          <button
            onClick={() => setSlipModal({ open: false, url: "", name: "" })}
            className="rounded-xl bg-cream-100 px-4 py-2 text-xs font-semibold text-charcoal-700 transition-colors hover:bg-cream-200"
          >
            ปิดหน้าต่าง
          </button>
        }
      >
        <div className="flex justify-center rounded-2xl border border-cream-200 bg-cream-50/80 p-2">
          <img
            src={slipModal.url}
            alt="สลิปการโอนเงิน"
            className="max-h-[60vh] rounded-xl object-contain shadow-xs"
          />
        </div>
      </Modal>

      {/* Details Modal */}
      {detailsModal.open && detailsModal.booking && (() => {
        const booking = detailsModal.booking;

        return (
          <Modal
            open={detailsModal.open}
            title="ใบยืนยันการจองเรือ"
            onClose={() => setDetailsModal({ open: false, booking: null })}
            footer={
              <div className="flex w-full gap-2">
                <button
                  onClick={handlePrintDetails}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-cream-100 py-2.5 text-xs font-semibold text-charcoal-700 transition-colors hover:bg-cream-200"
                >
                  <Printer size={14} /> พิมพ์ใบยืนยัน
                </button>
                <button
                  onClick={() => setDetailsModal({ open: false, booking: null })}
                  className="flex-1 rounded-xl bg-forest-800 py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-forest-900"
                >
                  ปิดหน้าต่าง
                </button>
              </div>
            }
          >
            <div className="space-y-4 text-sm text-charcoal-600 printable-modal">
              <div className="p-3.5 bg-cream-50/80 rounded-2xl border border-cream-200/90 space-y-1.5 print:bg-white print:border-cream-300">
                <div className="flex items-center gap-2 font-semibold text-forest-900 text-sm mb-2">
                  <User size={15} className="text-forest-700 print:hidden" />
                  <span>ข้อมูลผู้จอง</span>
                </div>
                <p><strong className="text-charcoal-700">ชื่อ-สกุล:</strong> {booking.user_name || "ไม่ระบุ"}</p>
                <p><strong className="text-charcoal-700">เบอร์โทรศัพท์:</strong> <span className="font-mono text-charcoal-800 font-medium">{booking.user_phone || booking.phone || "-"}</span></p>
                <p><strong className="text-charcoal-700">หมายเลขอ้างอิง:</strong> #{booking.boat_booking_id || booking.id}</p>
              </div>

              <div className="p-3.5 bg-cream-50/80 rounded-2xl border border-cream-200/90 space-y-1.5 print:bg-white print:border-cream-300">
                <div className="flex items-center gap-2 font-semibold text-forest-900 text-sm mb-2">
                  <Ship size={15} className="text-forest-700 print:hidden" />
                  <span>รายละเอียดการใช้งานเรือ</span>
                </div>
                <p><strong className="text-charcoal-700">ประเภทเรือ:</strong> {booking.kayak_name || booking.boat_name}</p>
                {booking.is_addon && <p className="text-forest-800">
                  เรือจากโปรโมชั่นห้องพัก{booking.addon_mode === "free" ? " · สิทธิ์ฟรี" : booking.addon_mode === "paid" ? " · มีค่าใช้จ่ายรวมกับค่าห้องพัก" : ""}
                  {booking.room_booking_id && <span className="block">{`การจองห้องพัก #${booking.room_booking_id}`}</span>}
                </p>}
                {Array.isArray(booking.boats) && booking.boats.length > 0 && (
                  <ul className="mt-1 space-y-0.5 pl-4 list-disc text-charcoal-600">
                    {booking.boats.map((line: any) => (
                      <li key={line.booking_boat_id}>
                        {line.type_name || "เรือ"} — {line.num_passengers ?? 0} คน / {line.boat_count ?? 0} ลำ
                        {line.subtotal != null ? ` · ฿${Number(line.subtotal).toLocaleString()}` : ""}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2"><strong className="text-charcoal-700">วันที่จอง:</strong> {booking.booking_date ? new Date(booking.booking_date).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : "-"}</p>
                <p><strong className="text-charcoal-700">รอบเวลา:</strong> {booking.start_time && booking.end_time ? `${booking.start_time.slice(0, 5)} - ${booking.end_time.slice(0, 5)} น.` : "-"}</p>
                
                {booking.special_request && (
                  <div className="pt-2 mt-2 border-t border-cream-200">
                    <div className="flex items-center gap-1.5 text-charcoal-700 font-semibold mb-1">
                      <MessageSquare size={13} className="text-forest-800 print:hidden" />
                      <span>คำขอพิเศษ:</span>
                    </div>
                    <p className="text-charcoal-600 bg-white p-2.5 rounded-xl border border-cream-200 leading-relaxed italic print:border-cream-300">
                      {booking.special_request}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-cream-50/80 rounded-2xl border border-cream-200/90 space-y-1.5 print:bg-white print:border-cream-300">
                <div className="flex items-center gap-2 font-semibold text-forest-900 text-sm mb-2">
                  <span>สถานที่และการติดต่อ</span>
                </div>
                <p><strong className="text-charcoal-700">สถานที่:</strong> {resort?.name || "-"}</p>
                {resort?.address && <p><strong className="text-charcoal-700">ที่อยู่:</strong> {resort.address}</p>}
                {resort?.coordinates && (
                  <p><strong className="text-charcoal-700">พิกัดแผนที่:</strong> <a className="underline text-forest-800" href={`https://maps.google.com/?q=${encodeURIComponent(resort.coordinates)}`} target="_blank" rel="noreferrer">เปิดในแผนที่</a></p>
                )}
                {resort?.phone && <p><strong className="text-charcoal-700">โทร:</strong> <span className="font-mono">{resort.phone}</span></p>}
                {resort?.line_id && <p><strong className="text-charcoal-700">LINE:</strong> {resort.line_id}</p>}
                {resort?.facebook && <p><strong className="text-charcoal-700">Facebook:</strong> {resort.facebook}</p>}
              </div>

              {boatTerms && (
                <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 space-y-1 text-amber-900 print:bg-white print:border-amber-300">
                  <span className="font-semibold">ข้อควรทราบ</span>
                  <p className="whitespace-pre-line text-xs leading-relaxed">{boatTerms}</p>
                </div>
              )}

              <div className="p-3.5 bg-cream-50/80 rounded-2xl border border-cream-200/90 space-y-2 print:bg-white print:border-cream-300">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-charcoal-700">สถานะรายการ:</span>
                  {booking.is_addon && ['pending', 'paid'].includes(booking.status) ? (
                    <p className="text-sm text-bamboo-800">รอเจ้าหน้าที่ห้องพักอนุมัติห้อง #{booking.room_booking_id} เรือจะอนุมัติอัตโนมัติ ไม่ต้องชำระหรืออนุมัติแยก</p>
                  ) : <BookingStatusBadge status={booking.status} />}
                </div>
                {booking.approved_by_name &&
                  ["approved", "checked_out", "rejected"].includes(booking.status) && (
                    <div className="text-xs text-charcoal-600 border-t border-cream-200/80 pt-1.5 flex items-center justify-between">
                      <span>{booking.status === "rejected" ? "ปฏิเสธโดย:" : "อนุมัติโดย:"}</span>
                      <span className="font-semibold text-forest-900">{booking.approved_by_name}</span>
                    </div>
                  )}
                {booking.checkin_at && (
                  <div className="text-xs text-charcoal-600 border-t border-cream-200/80 pt-1.5 flex items-center justify-between">
                    <span>เช็คอินปล่อยเรือลงน้ำ:</span>
                    <span className="font-medium text-teal-800">
                      {new Date(booking.checkin_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                      {booking.checkin_by_name ? ` (โดย ${booking.checkin_by_name})` : ""}
                    </span>
                  </div>
                )}
                {booking.checkout_at && (
                  <div className="text-xs text-charcoal-600 border-t border-cream-200/80 pt-1.5 flex items-center justify-between">
                    <span>คืนเรือ (เช็คเอาต์):</span>
                    <span className="font-medium text-charcoal-700">
                      {new Date(booking.checkout_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                      {booking.checkout_by_name ? ` (โดย ${booking.checkout_by_name})` : ""}
                    </span>
                  </div>
                )}
              </div>

              {booking.status === "rejected" && (booking.reject_reason || booking.reason) && (
                <div className="p-3.5 bg-rose-50/80 rounded-2xl border border-rose-200 space-y-1 text-rose-800 print:bg-white print:border-rose-300">
                  <span className="font-semibold">เหตุผลที่ปฏิเสธ:</span>
                  <p className="italic text-rose-700">{booking.reject_reason || booking.reason}</p>
                </div>
              )}

              <div className="p-3.5 bg-cream-50/80 rounded-2xl border border-cream-200/90 flex justify-between items-center print:bg-white print:border-cream-300">
                <span className="font-semibold text-charcoal-700">ยอดรวมสุทธิ</span>
                <span className="text-lg font-extrabold text-forest-900 font-mono">฿{Number(booking.total_price || 0).toLocaleString()}</span>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Reject Modal */}
      <Modal
        open={rejectModal.open}
        title="ปฏิเสธรายการจองนี้?"
        onClose={() => setRejectModal({ open: false, bookingId: null, selectedReason: REJECT_REASONS[0], customReason: "" })}
        widthClass="max-w-sm"
        footer={
          <div className="flex w-full gap-2">
            <button
              onClick={() => setRejectModal({ open: false, bookingId: null, selectedReason: REJECT_REASONS[0], customReason: "" })}
              className="flex-1 rounded-xl bg-cream-100 py-2.5 text-xs font-semibold text-charcoal-700 transition-colors hover:bg-cream-200"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleRejectSubmit}
              className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-semibold text-white shadow-xs transition-all hover:bg-rose-700 active:scale-95"
            >
              ยืนยันปฏิเสธ
            </button>
          </div>
        }
      >
        <p className="mb-4 text-xs text-charcoal-400">โปรดเลือกเหตุผลในการปฏิเสธการจอง</p>
        <div className="space-y-2">
          {REJECT_REASONS.map((reason) => {
            const isSelected = rejectModal.selectedReason === reason;
            return (
              <button
                key={reason}
                onClick={() => setRejectModal((prev) => ({ ...prev, selectedReason: reason }))}
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-xs font-semibold transition-all ${
                  isSelected
                    ? "border-rose-400 bg-rose-50 text-rose-700 shadow-2xs"
                    : "border-cream-200 bg-cream-50/80 text-charcoal-600 hover:bg-cream-100"
                }`}
              >
                <span>{reason}</span>
                <div className={`flex h-4 w-4 items-center justify-center rounded-full border ${isSelected ? "border-rose-500 bg-rose-500" : "border-cream-300 bg-white"}`}>
                  {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
              </button>
            );
          })}
          {rejectModal.selectedReason === "อื่นๆ" && (
            <textarea
              rows={2}
              placeholder="โปรดระบุเหตุผลเพิ่มเติม..."
              value={rejectModal.customReason}
              onChange={(e) => setRejectModal((prev) => ({ ...prev, customReason: e.target.value }))}
              className="w-full rounded-xl border border-cream-200 bg-cream-50/80 p-3 text-xs text-charcoal-800 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
            />
          )}
        </div>
      </Modal>

      {/* Confirm Modal */}
      <Modal
        open={confirmModal.open}
        title={confirmModal.title}
        onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        widthClass="max-w-sm"
        footer={
          <div className="flex w-full gap-2">
            <button
              onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
              className="flex-1 rounded-xl bg-cream-100 py-2.5 text-xs font-semibold text-charcoal-700 transition-colors hover:bg-cream-200"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => {
                confirmModal.onConfirm();
                setConfirmModal((prev) => ({ ...prev, open: false }));
              }}
              className={`flex-1 rounded-xl py-2.5 text-xs font-semibold text-white shadow-xs transition-opacity hover:opacity-90 ${confirmModal.confirmColor}`}
            >
              {confirmModal.confirmText}
            </button>
          </div>
        }
      >
        <p className="text-sm text-charcoal-600">{confirmModal.text}</p>
      </Modal>

      {/* Toast Notification */}
    </div>
  );
}

export default function AdminBoatsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <RefreshCw size={28} className="animate-spin text-forest-800" />
        </div>
      }
    >
      <BoatStaffDashboardContent />
    </Suspense>
  );
}
