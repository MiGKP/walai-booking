"use client";

import { useState, useEffect, useMemo, useCallback, useRef, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  CalendarDays,
  Clock,
  Eye,
  X,
  RefreshCw,
  LogIn,
  LogOut,
  BedDouble,
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
  Phone,
  MessageSquare,
  Printer,
  Moon,
  Check,
  Ban,
  Layers,
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { toISODate, formatThaiDate, formatThaiDateLong } from "@/lib/date";
import { resolveMediaUrl } from "@/lib/avatar";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { Modal, CustomDatePicker, CustomSelect } from "@/components/admin/ui";

// ตัวเลือกเหตุผลในการปฏิเสธ
const REJECT_REASONS = [
  "สลิปไม่ชัดเจน / อ่านข้อมูลไม่ได้",
  "ยอดเงินไม่ถูกต้อง / ไม่ครบถ้วน",
  "บัญชีโอนเงินไม่ถูกต้อง",
  "ไม่พบยอดเงินโอนในระบบ",
  "รายการจองซ้ำซ้อน",
  "อื่นๆ",
];

// Mapping สถานะสำหรับ UI (โทนสีละมุน นุ่มนวลตามโทน Walai Resort)
const STATUS_BADGE_STYLE: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
  pending: {
    bg: "bg-amber-50/80",
    text: "text-amber-800",
    border: "border-amber-200/80",
    dot: "bg-amber-500",
    label: "ยังไม่ชำระเงิน",
  },
  paid: {
    bg: "bg-lagoon-50",
    text: "text-lagoon-800",
    border: "border-lagoon-200",
    dot: "bg-lagoon-500",
    label: "รอตรวจสอบสลิป",
  },
  approved: {
    bg: "bg-forest-50",
    text: "text-forest-800",
    border: "border-forest-200",
    dot: "bg-forest-500",
    label: "อนุมัติแล้ว",
  },
  checked_out: {
    bg: "bg-bamboo-50",
    text: "text-bamboo-800",
    border: "border-bamboo-200",
    dot: "bg-bamboo-500",
    label: "เช็คเอาต์แล้ว",
  },
  cancelled: {
    bg: "bg-charcoal-50/70",
    text: "text-charcoal-500",
    border: "border-charcoal-200/70",
    dot: "bg-charcoal-400",
    label: "ยกเลิกแล้ว",
  },
  rejected: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
    label: "ถูกปฏิเสธ",
  },
};

type FilterType = "all" | "has_slip" | "pending" | "approved" | "checked_out";

// ฟังก์ชันช่วยคำนวณจำนวนคืนที่พัก
const calculateNights = (checkIn?: string, checkOut?: string) => {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

function RoomStaffDashboardContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { ready } = useAuthGuard({ allowedRoles: ["admin", "room_staff"] });

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [counts, setCounts] = useState({
    all: 0,
    has_slip: 0,
    pending: 0,
    approved: 0,
    checked_out: 0,
    totalRevenue: 0,
    pendingRevenue: 0,
  });
  const [catalogTypes, setCatalogTypes] = useState<string[]>([]);
  const requestId = useRef(0);

  // อ่านค่า State จาก URL Query Parameters
  const filter = (searchParams.get("filter") as FilterType) || "all";
  const roomType = searchParams.get("roomType") || "all";
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

  // Modal กรณีปฏิเสธการจอง
  const [rejectModal, setRejectModal] = useState<{
    open: boolean;
    bookingId: number | null;
    selectedReason: string;
    customReason: string;
  }>({
    open: false,
    bookingId: null,
    selectedReason: REJECT_REASONS[0],
    customReason: "",
  });

  const itemsPerPage = 10;

  // ช่วงวันที่ด่วน (วันนี้ / สัปดาห์นี้ / เดือนนี้)
  const quickDateRanges = useMemo(() => {
    const now = new Date();
    const today = toISODate(now);

    // สัปดาห์นี้ (จันทร์ - อาทิตย์)
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
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
      const res = await api.get("/bookings", {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          filter,
          search: searchParam.trim() || undefined,
          room_type: roomType === "all" ? undefined : roomType,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        },
      });
      if (id !== requestId.current) return;
      setBookings(res.data?.data || []);
      setPagination(res.data.pagination);
      setCounts(res.data.summary);
      if (currentPage > Math.max(1, res.data.pagination.totalPages)) {
        updateQueryParams({ page: Math.max(1, res.data.pagination.totalPages) });
      }
    } catch {
      if (id === requestId.current) notify.error("ไม่สามารถโหลดข้อมูลการจองได้");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [ready, currentPage, filter, roomType, dateFrom, dateTo, searchParam, updateQueryParams]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (!ready) return;
    api
      .get("/rooms", { params: { is_admin: true } })
      .then((res) => {
        const types: { type_name?: string; room_name?: string; name?: string }[] = res.data?.data || [];
        setCatalogTypes(
          Array.from(new Set(types.map((type) => type.type_name || type.room_name || "").filter(Boolean))),
        );
      })
      .catch(() => notify.error("ไม่สามารถโหลดประเภทห้องพักได้"));
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
      "อนุมัติรายการจองนี้?",
      "เมื่ออนุมัติแล้ว สถานะจะเปลี่ยนเป็น 'อนุมัติแล้ว' (รอผู้เข้าพักเช็คอิน)",
      "question",
      "อนุมัติการจอง",
      "bg-forest-800 hover:bg-forest-900",
      async () => {
        try {
          await api.put(`/bookings/${id}/status`, { status: "approved" });
          notify.success("อนุมัติการจองเรียบร้อยแล้ว");
          setBookings((prev) => prev.map((b) => (b.id === id ? { ...b, status: "approved" } : b)));
          fetchBookings();
        } catch (err: unknown) {
          notify.error(getApiErrorMessage(err, "ทำรายการไม่สำเร็จ"));
        }
      },
    );
  };

  // handleRejectSubmit (ปฏิเสธพร้อมประมวลผลข้อความเหตุผล)
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
      await api.put(`/bookings/${rejectModal.bookingId}/status`, {
        status: "rejected",
        reject_reason: finalReason || "ข้อมูลหลักฐานไม่ถูกต้อง",
      });
      notify.success("ปฏิเสธรายการจองเรียบร้อยแล้ว");

      setBookings((prev) =>
        prev.map((b) =>
          b.id === rejectModal.bookingId
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

  const handlePrintDetails = () => {
    window.print();
  };

  const roomTypes = catalogTypes;

  const roomTypeOptions = useMemo(() => {
    return [
      { value: "all", label: "ทั้งหมดทุกประเภท" },
      ...roomTypes.map((t) => ({ value: t, label: t })),
    ];
  }, [roomTypes]);

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
    filter !== "all" || roomType !== "all" || dateFrom || dateTo || searchParam;

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
        }
      `}</style>

      {/* Top Header Card with Integrated Revenue */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/80 relative print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-800/10 shrink-0">
              <BedDouble size={20} className="stroke-[2.2]" />
            </span>
            <div>
              <h1 className="font-display text-2xl lg:text-3xl font-bold text-forest-900 tracking-tight">
                จัดการการจองห้องพัก
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
            label: "เช็คเอาต์แล้ว",
            count: counts.checked_out,
            icon: <LogOut size={19} className="stroke-[2.2]" />,
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
                : "เช็คเอาต์แล้ว"}
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
              placeholder="ค้นหาชื่อ, เบอร์โทร, ห้อง, ID..."
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

          {/* Room Type Selector */}
          <div className="flex items-center gap-2 bg-cream-50/80 px-3 py-1.5 rounded-2xl border border-cream-300 text-xs text-charcoal-700">
            <BedDouble size={14} className="text-forest-700" />
            <span className="font-medium text-charcoal-500 whitespace-nowrap">ประเภท:</span>
            <CustomSelect
              options={roomTypeOptions}
              value={roomType}
              onChange={(val) => updateQueryParams({ roomType: val, page: 1 })}
              width="w-40"
            />
          </div>

          {/* Date Range Selector */}
          <div className="flex items-center gap-2 bg-cream-50/80 px-3 py-1.5 rounded-2xl border border-cream-300 text-xs text-charcoal-700">
            <CalendarDays size={14} className="text-forest-700 shrink-0" />
            <span className="font-medium text-charcoal-500 whitespace-nowrap">วันที่:</span>
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
              รายการจองห้องพักทั้งหมด
            </h2>
            <span className="px-2.5 py-0.5 bg-forest-50 text-forest-800 border border-forest-200 rounded-full text-xs font-bold font-mono">
              {pagination.total} รายการ
            </span>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto border border-cream-200/90 rounded-2xl shadow-2xs">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="border-b border-cream-200 bg-cream-50/80 text-charcoal-600 font-bold text-xs uppercase tracking-wider">
                <th className="px-4 py-3.5 whitespace-nowrap">รหัสการจอง</th>
                <th className="px-4 py-3.5 whitespace-nowrap">ลูกค้า</th>
                <th className="px-4 py-3.5 whitespace-nowrap">ห้องพัก</th>
                <th className="px-4 py-3.5 whitespace-nowrap">ระยะเวลาเข้าพัก</th>
                <th className="px-4 py-3.5 whitespace-nowrap">ยอดรวม</th>
                <th className="px-4 py-3.5 whitespace-nowrap">สถานะ</th>
                <th className="px-4 py-3.5 text-center whitespace-nowrap">สลิปโอนเงิน</th>
                <th className="px-5 py-3.5 text-right whitespace-nowrap">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-20 text-center text-charcoal-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw size={28} className="animate-spin text-forest-700" />
                      <span className="text-xs font-medium text-charcoal-500">
                        กำลังโหลดข้อมูลรายการจอง...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : paginatedBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center gap-2 px-6 py-8">
                      <div className="w-14 h-14 rounded-2xl bg-cream-50 border border-cream-200 text-charcoal-400 flex items-center justify-center mb-1">
                        <BedDouble size={26} className="stroke-[1.5]" />
                      </div>
                      <p className="font-display font-bold text-base text-forest-900">ไม่พบรายการจอง</p>
                      <p className="text-xs text-charcoal-400 max-w-sm">
                        {hasActiveFilters
                          ? "ลองปรับเปลี่ยนคำค้นหาหรือเงื่อนไขการกรองใหม่"
                          : "ยังไม่มีรายการจองห้องพักในระบบ"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedBookings.map((b: any) => {
                  const bookingId = b.room_booking_id || b.id;
                  const nights = calculateNights(b.check_in, b.check_out);
                  const st = STATUS_BADGE_STYLE[b.status] || {
                    bg: "bg-cream-100",
                    text: "text-charcoal-600",
                    border: "border-cream-300",
                    dot: "bg-charcoal-400",
                    label: b.status,
                  };

                  return (
                    <tr
                      key={bookingId}
                      className="hover:bg-cream-50/60 border-b border-cream-100/80 last:border-0 transition-colors group"
                    >
                      {/* Booking ID */}
                      <td className="px-4 py-3.5 text-charcoal-400 font-mono text-xs font-semibold whitespace-nowrap">
                        #{bookingId}
                      </td>

                      {/* Customer */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5 min-w-[120px]">
                          <div className="w-8 h-8 rounded-2xl bg-cream-100 border border-cream-200/90 flex items-center justify-center text-forest-800 shrink-0 font-bold text-xs shadow-xs">
                            {(b.user_name || "U")[0].toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p
                              className="font-semibold text-charcoal-900 text-xs truncate max-w-[130px]"
                              title={b.user_name || "ไม่ระบุชื่อ"}
                            >
                              {b.user_name || "ไม่ระบุชื่อ"}
                            </p>
                            <p className="text-[11px] text-charcoal-400 font-mono flex items-center gap-1 mt-0.5 whitespace-nowrap">
                              <Phone size={10} className="text-charcoal-400" />
                              {b.user_phone || b.phone || "-"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Rooms */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-start gap-2 min-w-[140px]">
                          <BedDouble size={15} className="text-forest-700 shrink-0 mt-0.5" />
                          <div className="space-y-1">
                            {Array.isArray(b.rooms) && b.rooms.length > 0 ? (
                              (() => {
                                const roomMap = new Map<string, string[]>();
                                b.rooms.forEach((r: any) => {
                                  const name = r.room_name || b.type_name || b.room_name || "ห้องพัก";
                                  const num = r.room_number ? `${r.room_number}` : r.room_id ? `${r.room_id}` : "";
                                  if (!roomMap.has(name)) roomMap.set(name, []);
                                  if (num) roomMap.get(name)!.push(num);
                                });

                                return Array.from(roomMap.entries()).map(([name, nums]) => (
                                  <div key={name} className="text-xs">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-semibold text-charcoal-900 whitespace-nowrap">
                                        {name}
                                      </span>
                                      {nums.length > 1 && (
                                        <span className="text-charcoal-400 font-medium whitespace-nowrap text-[11px]">
                                          ({nums.length} ห้อง)
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 flex-wrap mt-1">
                                      {nums.map((num, nIdx) => (
                                        <span
                                          key={`${name}-${num}-${nIdx}`}
                                          className="inline-flex items-center px-1.5 py-0.5 rounded-lg bg-cream-100 text-forest-900 border border-cream-200 font-mono text-[11px] font-bold"
                                        >
                                          {num}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                ));
                              })()
                            ) : (
                              <div className="text-xs">
                                <p className="font-semibold text-charcoal-900 whitespace-nowrap">
                                  {b.room_name || b.type_name || "ห้องพัก"}
                                </p>
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-lg bg-cream-100 text-forest-900 border border-cream-200 font-mono text-[11px] font-bold mt-1">
                                  {b.room_number || b.room_id || "-"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Stay Duration */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-charcoal-800">
                            <CalendarDays size={13} className="text-forest-700 shrink-0" />
                            <span>{formatThaiDate(b.check_in, "2-digit")}</span>
                            <span className="text-charcoal-400 font-normal">–</span>
                            <span>{formatThaiDate(b.check_out, "2-digit")}</span>
                          </div>
                          {nights > 0 && (
                            <div className="flex items-center gap-1 text-[11px] text-charcoal-400 pl-4">
                              <Moon size={10} className="text-forest-700" />
                              <span>{nights} คืน</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Total Price */}
                      <td className="px-4 py-3.5 font-bold text-forest-900 font-mono text-sm whitespace-nowrap">
                        ฿{Number(b.total_price || 0).toLocaleString()}
                      </td>

                      {/* Status Badge */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${st.bg} ${st.text} ${st.border}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                            {st.label}
                          </span>
                          {b.approved_by_name &&
                            ["approved", "checked_out", "rejected"].includes(b.status) && (
                              <span className="text-[11px] text-charcoal-400 ml-1">
                                โดย: {b.approved_by_name}
                              </span>
                            )}
                        </div>
                      </td>

                      {/* Payment Slip Button */}
                      <td className="px-4 py-3.5 text-center whitespace-nowrap">
                        {b.payment_slip ? (
                          <button
                            onClick={() =>
                              setSlipModal({
                                open: true,
                                url: resolveMediaUrl(b.payment_slip),
                                name: b.user_name || "slip",
                              })
                            }
                            className="inline-flex items-center gap-1.5 text-xs text-forest-800 bg-forest-50 hover:bg-forest-100 border border-forest-200 px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95 shadow-xs"
                          >
                            <Eye size={13} className="text-forest-700" />
                            <span>ดูสลิป</span>
                          </button>
                        ) : (
                          <span className="text-xs text-charcoal-400 italic">
                            ไม่มีสลิป
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setDetailsModal({ open: true, booking: b })}
                            className="p-1.5 text-charcoal-500 hover:text-charcoal-900 bg-cream-100/80 hover:bg-cream-200/80 border border-cream-200 rounded-xl transition-colors"
                            title="ดูรายละเอียดการจอง"
                          >
                            <FileText size={14} />
                          </button>

                          {b.status === "checked_out" ? (
                            <span className="text-xs text-bamboo-800 font-semibold bg-bamboo-50 border border-bamboo-200 px-2.5 py-1 rounded-xl inline-block">
                              เช็คเอาต์แล้ว
                            </span>
                          ) : b.status === "approved" ? (
                            <span className="text-xs text-forest-800 font-semibold bg-forest-50 border border-forest-200 px-2.5 py-1 rounded-xl inline-block">
                              อนุมัติแล้ว
                            </span>
                          ) : b.status === "rejected" ? (
                            <span className="text-xs text-rose-700 font-semibold bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl inline-block">
                              ปฏิเสธแล้ว
                            </span>
                          ) : b.status === "cancelled" ? (
                            <span className="text-xs text-charcoal-500 font-semibold bg-charcoal-50 border border-charcoal-200/70 px-2.5 py-1 rounded-xl inline-block">
                              ยกเลิกแล้ว
                            </span>
                          ) : ((b.status === "pending" || b.status === "paid") && Number(b.total_price) === 0)
                            || (b.status === "paid" && String(b.payment_slip || "").trim()) ? (
                            <>
                              <button
                                onClick={() => handleApprove(bookingId)}
                                className="inline-flex items-center gap-1 text-xs bg-forest-800 hover:bg-forest-900 text-white font-semibold px-3 py-1.5 rounded-xl transition-all shadow-xs active:scale-95"
                              >
                                <Check size={12} className="stroke-[2.5]" />
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
                                className="inline-flex items-center gap-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold px-2.5 py-1.5 rounded-xl border border-rose-200 transition-all active:scale-95"
                              >
                                <Ban size={12} />
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-auto border-t border-cream-200 text-xs text-charcoal-500 print:hidden">
            <span>
              แสดง{" "}
              <strong className="text-forest-950 font-mono">
                {(currentPage - 1) * itemsPerPage + 1}
              </strong>{" "}
              ถึง{" "}
              <strong className="text-forest-950 font-mono">
                {Math.min(currentPage * itemsPerPage, pagination.total)}
              </strong>{" "}
              จากทั้งหมด{" "}
              <strong className="text-forest-950 font-mono">{pagination.total}</strong>{" "}
              รายการ
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={loading || currentPage === 1}
                className="p-1.5 rounded-xl border border-cream-300 bg-white text-charcoal-600 disabled:opacity-40 hover:bg-cream-100 transition-colors shadow-2xs"
                title="หน้าแรก"
              >
                <ChevronsLeft size={14} />
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={loading || currentPage === 1}
                className="p-1.5 rounded-xl border border-cream-300 bg-white text-charcoal-600 disabled:opacity-40 hover:bg-cream-100 transition-colors shadow-2xs"
                title="หน้าก่อนหน้า"
              >
                <ChevronLeft size={14} />
              </button>

              {getPaginationRange().map((page, idx) =>
                typeof page === "number" ? (
                  <button
                    key={idx}
                    onClick={() => handlePageChange(page)}
                    className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-bold font-mono transition-all ${
                      currentPage === page
                        ? "bg-forest-800 text-white shadow-xs"
                        : "bg-white text-charcoal-600 border border-cream-300 hover:bg-cream-100 shadow-2xs"
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
                title="หน้าถัดไป"
              >
                <ChevronRight size={14} />
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={loading || currentPage >= totalPages}
                className="p-1.5 rounded-xl border border-cream-300 bg-white text-charcoal-600 disabled:opacity-40 hover:bg-cream-100 transition-colors shadow-2xs"
                title="หน้าสุดท้าย"
              >
                <ChevronsRight size={14} />
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
            className="rounded-xl bg-cream-100 border border-cream-300 px-4 py-2 text-xs font-semibold text-charcoal-700 transition-colors hover:bg-cream-200"
          >
            ปิดหน้าต่าง
          </button>
        }
      >
        <div className="flex justify-center rounded-2xl border border-cream-200 bg-cream-50/60 p-3">
          <img
            src={slipModal.url}
            alt="สลิปการโอนเงิน"
            className="max-h-[65vh] rounded-xl object-contain shadow-xs"
          />
        </div>
      </Modal>

      {/* Details Modal */}
      {detailsModal.open &&
        detailsModal.booking &&
        (() => {
          const booking = detailsModal.booking;
          const nights = calculateNights(booking.check_in, booking.check_out);

          return (
            <Modal
              open={detailsModal.open}
              title="ใบยืนยันการจองห้องพัก"
              onClose={() => setDetailsModal({ open: false, booking: null })}
              footer={
                <div className="flex w-full gap-2.5">
                  <button
                    onClick={handlePrintDetails}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-cream-100 border border-cream-300 py-2.5 text-xs font-semibold text-charcoal-700 transition-colors hover:bg-cream-200"
                  >
                    <Printer size={14} className="text-charcoal-500" /> พิมพ์ใบยืนยัน
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
              <div className="space-y-3.5 text-sm text-charcoal-600 printable-modal">
                {/* Guest info card */}
                <div className="p-3.5 bg-cream-50/80 rounded-2xl border border-cream-200 space-y-1.5 print:bg-white print:border-charcoal-200">
                  <div className="flex items-center gap-2 font-semibold text-forest-900 text-sm mb-2">
                    <User size={15} className="text-forest-700 print:hidden" />
                    <span>ข้อมูลผู้จอง</span>
                  </div>
                  <p>
                    <strong className="text-charcoal-700">ชื่อ-สกุล:</strong>{" "}
                    {booking.user_name || "ไม่ระบุ"}
                  </p>
                  <p>
                    <strong className="text-charcoal-700">เบอร์โทรศัพท์:</strong>{" "}
                    <span className="font-mono text-charcoal-800 font-medium">
                      {booking.user_phone || booking.phone || "-"}
                    </span>
                  </p>
                  <p>
                    <strong className="text-charcoal-700">หมายเลขอ้างอิง:</strong>{" "}
                    <span className="font-mono">#{booking.room_booking_id || booking.id}</span>
                  </p>
                  <p><strong className="text-charcoal-700">ผู้เข้าพัก:</strong>{" "}
                    {booking.guests ?? booking.guest_count ?? (Number(booking.adults || 0) + Number(booking.children || 0))} คน
                    {booking.adults != null && booking.children != null && <span> (ผู้ใหญ่ {booking.adults} · เด็ก {booking.children})</span>}
                  </p>
                </div>

                {/* Room info card */}
                <div className="p-3.5 bg-cream-50/80 rounded-2xl border border-cream-200 space-y-1.5 print:bg-white print:border-charcoal-200">
                  <div className="flex items-center gap-2 font-semibold text-forest-900 text-sm mb-2">
                    <BedDouble size={15} className="text-forest-700 print:hidden" />
                    <span>รายละเอียดห้องพัก</span>
                  </div>
                  {Array.isArray(booking.rooms) && booking.rooms.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="text-xs text-charcoal-700 font-medium">
                        ห้องที่จอง ({booking.rooms.length} ห้อง):
                      </div>
                      <div className="flex flex-col gap-1.5 pt-0.5">
                        {booking.rooms.map((r: {
                          booking_room_id: number;
                          room_name?: string;
                          type_name?: string;
                          room_number?: string;
                          room_id?: number;
                          subtotal?: number | string;
                          status?: string;
                          checkin_at?: string;
                          checkout_at?: string;
                          checkin_by_name?: string;
                          checkout_by_name?: string;
                        }) => (
                          <div
                            key={r.booking_room_id}
                            className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-white border border-cream-200 text-xs text-charcoal-800 shadow-2xs"
                          >
                            <div className="flex items-center gap-1.5">
                              <span>{r.room_name || r.type_name || "ห้องพัก"}</span>
                              <span className="font-mono font-bold text-forest-800 bg-cream-100 px-1.5 py-0.5 rounded-lg border border-cream-200">
                                {r.room_number || r.room_id || "-"}
                              </span>
                              <span>฿{Number(r.subtotal || 0).toLocaleString("th-TH")}</span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-charcoal-500">
                              {r.checkin_at && (
                                <span className="text-teal-700">
                                  เช็คอิน: {new Date(r.checkin_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                                  {r.checkin_by_name ? ` (${r.checkin_by_name})` : ""}
                                </span>
                              )}
                              {r.checkout_at && (
                                <span className="text-charcoal-500">
                                  • เช็คเอาต์: {new Date(r.checkout_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                                  {r.checkout_by_name ? ` (${r.checkout_by_name})` : ""}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <p>
                        <strong className="text-charcoal-700">ชื่อห้อง/ประเภท:</strong>{" "}
                        {booking.room_name || booking.type_name || "ห้องพัก"}
                      </p>
                      <p>
                        <strong className="text-charcoal-700">หมายเลขห้อง:</strong>{" "}
                        {booking.room_number || booking.room_id || "-"}
                      </p>
                    </>
                  )}
                  <p className="pt-1">
                    <strong className="text-charcoal-700">ระยะเวลาเข้าพัก:</strong>{" "}
                    {formatThaiDateLong(booking.check_in)} ถึง{" "}
                    {formatThaiDateLong(booking.check_out)} ({nights} คืน)
                  </p>

                  <div className="pt-2 mt-2 border-t border-cream-200">
                    <div className="flex items-center gap-1.5 text-charcoal-700 font-semibold mb-1">
                      <MessageSquare size={13} className="text-forest-700 print:hidden" />
                      <span>คำขอพิเศษ (Special Request):</span>
                    </div>
                    <p className="text-charcoal-600 bg-white p-2.5 rounded-xl border border-cream-200/80 leading-relaxed italic print:border-charcoal-300 text-xs">
                      {booking.special_request || booking.special_requests || "ไม่มีคำขอพิเศษ"}
                    </p>
                  </div>
                </div>

                {/* Status Row */}
                <div className="p-3.5 bg-cream-50/80 rounded-2xl border border-cream-200 space-y-2 print:bg-white print:border-charcoal-200">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-charcoal-700">สถานะรายการ:</span>
                    {(() => {
                      const st = STATUS_BADGE_STYLE[booking.status] || {
                        bg: "bg-cream-100",
                        text: "text-charcoal-600",
                        border: "border-cream-300",
                        dot: "bg-charcoal-400",
                        label: booking.status,
                      };
                      return (
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${st.bg} ${st.text} ${st.border}`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                          {st.label}
                        </span>
                      );
                    })()}
                  </div>
                  {booking.approved_by_name &&
                    ["approved", "checked_out", "rejected"].includes(booking.status) && (
                      <div className="text-xs text-charcoal-600 border-t border-cream-200/80 pt-1.5 flex items-center justify-between">
                        <span>{booking.status === "rejected" ? "ปฏิเสธโดย:" : "อนุมัติโดย:"}</span>
                        <span className="font-semibold text-forest-900">{booking.approved_by_name}</span>
                      </div>
                    )}
                </div>

                {/* Reject Reason (if rejected) */}
                {booking.status === "rejected" && (booking.reject_reason || booking.reason) && (
                  <div className="p-3.5 bg-rose-50 rounded-2xl border border-rose-200 space-y-1 text-rose-800 print:bg-white print:border-rose-300 text-xs">
                    <span className="font-semibold">เหตุผลที่ปฏิเสธ:</span>
                    <p className="italic text-rose-700">{booking.reject_reason || booking.reason}</p>
                  </div>
                )}

                {/* Total Price */}
                <div className="p-3.5 bg-cream-50/80 rounded-2xl border border-cream-200 flex justify-between items-center print:bg-white print:border-charcoal-200">
                  <span className="font-semibold text-charcoal-700">ยอดรวมสุทธิ</span>
                  <span className="text-lg font-extrabold text-forest-900 font-mono">
                    ฿{Number(booking.total_price || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </Modal>
          );
        })()}

      {/* Reject Modal */}
      <Modal
        open={rejectModal.open}
        title="ปฏิเสธรายการจองนี้?"
        onClose={() =>
          setRejectModal({
            open: false,
            bookingId: null,
            selectedReason: REJECT_REASONS[0],
            customReason: "",
          })
        }
        widthClass="max-w-sm"
        footer={
          <div className="flex w-full gap-2.5">
            <button
              onClick={() =>
                setRejectModal({
                  open: false,
                  bookingId: null,
                  selectedReason: REJECT_REASONS[0],
                  customReason: "",
                })
              }
              className="flex-1 rounded-xl bg-cream-100 border border-cream-300 py-2.5 text-xs font-semibold text-charcoal-700 transition-colors hover:bg-cream-200"
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
        <p className="mb-3 text-xs text-charcoal-400">โปรดเลือกเหตุผลในการปฏิเสธการจอง</p>
        <div className="space-y-2">
          {REJECT_REASONS.map((reason) => {
            const isSelected = rejectModal.selectedReason === reason;
            return (
              <button
                key={reason}
                onClick={() => setRejectModal((prev) => ({ ...prev, selectedReason: reason }))}
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-xs font-semibold transition-all ${
                  isSelected
                    ? "border-rose-300 bg-rose-50 text-rose-800 shadow-2xs"
                    : "border-cream-300 bg-cream-50/70 text-charcoal-600 hover:bg-cream-100"
                }`}
              >
                <span>{reason}</span>
                <div
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    isSelected ? "border-rose-500 bg-rose-500" : "border-cream-400 bg-white"
                  }`}
                >
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
              className="w-full rounded-2xl border border-cream-300 bg-cream-50/70 p-3 text-xs text-charcoal-800 outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400 mt-2"
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
          <div className="flex w-full gap-2.5">
            <button
              onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
              className="flex-1 rounded-xl bg-cream-100 border border-cream-300 py-2.5 text-xs font-semibold text-charcoal-700 transition-colors hover:bg-cream-200"
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
        <p className="text-sm text-charcoal-600 leading-relaxed">{confirmModal.text}</p>
      </Modal>
    </div>
  );
}

export default function AdminRoomsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <RefreshCw size={28} className="animate-spin text-forest-700" />
        </div>
      }
    >
      <RoomStaffDashboardContent />
    </Suspense>
  );
}
