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
  Filter,
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
  HelpCircle,
  Info,
  Phone,
  MessageSquare,
  Printer,
  Moon,
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { toISODate } from "@/lib/date";
import { resolveMediaUrl } from "@/lib/avatar";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { useAuth } from "@/hooks/useAuth";
import toast, { Toaster } from "react-hot-toast";

import {
  PageHeader,
  StatCard,
  Panel,
  Modal,
  BookingStatusBadge,
  EmptyState,
} from "@/components/admin/ui";


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
  approved: "อนุมัติแล้ว (รอเช็คเอาต์)",
  checked_out: "เช็คเอาต์แล้ว",
  cancelled: "ยกเลิก",
  rejected: "ถูกปฏิเสธ",
};

const statusConfig: Record<string, { bg: string; text: string; dot: string }> =
  {
    pending: {
      bg: "bg-[#0b3b2c]/10 border-[#0b3b2c]/80 text-[#0b3b2c]",
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
      text: "อนุมัติแล้ว (รอเช็คเอาต์)",
      dot: "bg-lagoon-500",
    },
    checked_out: {
      bg: "bg-charcoal-500/10 border-charcoal-200/80 text-charcoal-600",
      text: "เช็คเอาต์เรียบร้อย",
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

type FilterType =
  | "all"
  | "has_slip"
  | "pending"
  | "approved"
  | "checked_out";

// -------------------------------------------------------------
// Component: Custom DatePicker ปฏิทินดีไซน์สวยงาม
// -------------------------------------------------------------
function CustomDatePicker({
  value,
  onChange,
  placeholder = "เลือกวันที่",
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const selectedDate = value ? new Date(value) : null;
  const [viewDate, setViewDate] = useState(() => selectedDate || new Date());

  useEffect(() => {
    if (value) setViewDate(new Date(value));
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        datePickerRef.current &&
        !datePickerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const monthNames = [
    "มกราคม",
    "กุมภาพันธ์",
    "มีนาคม",
    "เมษายน",
    "พฤษภาคม",
    "มิถุนายน",
    "กรกฎาคม",
    "สิงหาคม",
    "กันยายน",
    "ตุลาคม",
    "พฤศจิกายน",
    "ธันวาคม",
  ];

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const formattedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(formattedDate);
    setIsOpen(false);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === month &&
      today.getFullYear() === year
    );
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === month &&
      selectedDate.getFullYear() === year
    );
  };

  return (
    <div className="relative inline-block" ref={datePickerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-stone-200 hover:border-stone-300 text-xs font-mono text-stone-700 transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20"
      >
        <span>
          {value
            ? new Date(value).toLocaleDateString("th-TH", {
                day: "numeric",
                month: "short",
                year: "2-digit",
              })
            : placeholder}
        </span>
        {value && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="hover:text-rose-500 text-stone-400 p-0.5"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-64 bg-white border border-stone-200 rounded-2xl shadow-xl z-50 p-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-100">
            <button
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-stone-800">
              {monthNames[month]} {year + 543}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-stone-100 text-stone-600 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-xs font-bold text-stone-400 mb-1">
            <span>อา</span>
            <span>จ</span>
            <span>อ</span>
            <span>พ</span>
            <span>พฤ</span>
            <span>ศ</span>
            <span>ส</span>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const selected = isSelected(day);
              const today = isToday(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-7 w-7 rounded-xl text-xs font-medium flex items-center justify-center transition-all ${
                    selected
                      ? "bg-[#0b3b2c] text-white font-bold shadow-xs scale-105"
                      : today
                        ? "bg-forest-100 text-[#0b3b2c] font-bold border border-forest-300"
                        : "text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2 mt-2 border-t border-stone-100 text-xs">
            <button
              onClick={() => {
                const today = toISODate(new Date());
                onChange(today);
                setIsOpen(false);
              }}
              className="text-[#0b3b2c] font-bold hover:underline"
            >
              วันนี้
            </button>
            <button
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              className="text-stone-400 hover:text-stone-600"
            >
              ล้างค่า
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

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
        className="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-xs font-semibold text-stone-700 transition-all focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 shadow-2xs"
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
                    ? "bg-forest-50 text-forest-900 font-bold"
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

// ฟังก์ชันช่วยแปลงวันที่เป็น YYYY-MM-DD ตามเวลาท้องถิ่น (ไม่ใช้ toISOString เพราะจะเพี้ยนข้ามวันตาม timezone)
const toLocalISODate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ตัวเลือกกรองวันที่แบบด่วน: วันนี้ / สัปดาห์นี้ (จันทร์-อาทิตย์) / เดือนนี้
const getQuickDateRange = (kind: "today" | "week" | "month"): { from: string; to: string } => {
  const now = new Date();
  if (kind === "today") {
    const iso = toLocalISODate(now);
    return { from: iso, to: iso };
  }
  if (kind === "week") {
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: toLocalISODate(monday), to: toLocalISODate(sunday) };
  }
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { from: toLocalISODate(first), to: toLocalISODate(last) };
};

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
  const { user } = useAuth();

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 0 });
  const [counts, setCounts] = useState({ all: 0, has_slip: 0, pending: 0, approved: 0, checked_out: 0, totalRevenue: 0, pendingRevenue: 0 });
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

  // การเรียงลำดับตาราง (คลิกหัวคอลัมน์ "ลำดับ"/"ยอดรวม"/"ระยะเวลาเข้าพัก" เพื่อสลับ asc/desc)
  // ค่าเริ่มต้น (sortKey = null) จะเรียงตามวันที่จองใหม่สุดก่อน (backend ORDER BY created_at DESC อยู่แล้ว)
  const [sortKey, setSortKey] = useState<"check_in" | "total_price" | "created_at" | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const toggleSort = (key: "check_in" | "total_price" | "created_at") => {
    updateQueryParams({ page: 1 });
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

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
    confirmColor: "bg-[#0b3b2c]",
    onConfirm: () => {},
  });

  // Modal กรณีปฏิเสธการจอง (เพิ่ม selectedReason และ customReason)
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
      const res = await api.get("/bookings", { params: { page: currentPage, limit: itemsPerPage,
        filter, search: searchParam.trim() || undefined,
        room_type: roomType === "all" ? undefined : roomType,
        date_from: dateFrom || undefined, date_to: dateTo || undefined, sort: sortKey || undefined, sort_dir: sortDir,
      } });
      if (id !== requestId.current) return;
      setBookings(res.data?.data || []);
      setPagination(res.data.pagination);
      setCounts(res.data.summary);
      if (currentPage > Math.max(1, res.data.pagination.totalPages)) updateQueryParams({ page: Math.max(1, res.data.pagination.totalPages) });
    } catch {
      if (id === requestId.current) toast.error("ไม่สามารถโหลดข้อมูลการจองได้");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [ready, currentPage, filter, roomType, dateFrom, dateTo, searchParam, updateQueryParams, sortKey, sortDir]);

  useEffect(() => { fetchBookings(); }, [fetchBookings]);
  useEffect(() => {
    if (!ready) return;
    api.get("/rooms", { params: { is_admin: true } }).then((res) => {
      const types: { type_name?: string; room_name?: string; name?: string }[] = res.data?.data || [];
      setCatalogTypes(Array.from(new Set(types.map((type) => type.type_name || type.room_name || "").filter(Boolean))));
    }).catch(() => toast.error("ไม่สามารถโหลดประเภทห้องพักได้"));
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

  // handleStatus (อนุมัติ)
  const handleApprove = (id: number) => {
    openConfirmDialog(
      "อนุมัติรายการจองนี้?",
      "เมื่ออนุมัติแล้ว สถานะจะเปลี่ยนเป็น 'รอเช็คอิน'",
      "question",
      "อนุมัติการจอง",
      "bg-[#0b3b2c]",
      async () => {
        try {
          await api.put(`/bookings/${id}/status`, { status: "approved" });
          toast.success("อนุมัติการจองเรียบร้อยแล้ว");
          setBookings((prev) =>
            prev.map((b) => (b.id === id ? { ...b, status: "approved" } : b)),
          );
          fetchBookings();
        } catch (err: unknown) {
          toast.error(getApiErrorMessage(err, "ทำรายการไม่สำเร็จ"));
        }
      },
    );
  };

  // handleRejectSubmit (ปฏิเสธพร้อมประมวลผลข้อความเหตุผล)
  const handleRejectSubmit = async () => {
    if (!rejectModal.bookingId) return;

    // คำนวณเหตุผลสุดท้ายที่จะส่งให้ Backend
    const finalReason =
      rejectModal.selectedReason === "อื่นๆ"
        ? rejectModal.customReason.trim()
        : rejectModal.selectedReason;

    if (rejectModal.selectedReason === "อื่นๆ" && !finalReason) {
      toast.error("กรุณาระบุเหตุผลเพิ่มเติม");
      return;
    }

    try {
      await api.put(`/bookings/${rejectModal.bookingId}/status`, {
        status: "rejected",
        reject_reason: finalReason || "ข้อมูลหลักฐานไม่ถูกต้อง",
      });
      toast.success("ปฏิเสธรายการจองเรียบร้อยแล้ว");

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
      toast.error(getApiErrorMessage(err, "ปฏิเสธการจองไม่สำเร็จ"));
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
    <div className="space-y-6 pb-12">
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
          .printable-modal-overlay {
            position: absolute !important;
            background: transparent !important;
            padding: 0 !important;
          }
        }
      `}</style>

      {/* Header Bar */}
      <PageHeader
        title="แดชบอร์ดห้องพัก"
        description="ตรวจสอบหลักฐานการชำระเงิน อนุมัติการจอง และเช็คเอาต์ผู้เข้าพัก"
      />

      {/* Summary Cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5 print:hidden">
        <StatCard label="รอตรวจสอบสลิป" value={counts.has_slip} icon={<FileCheck2 />} tone="lagoon" />
        <StatCard label="ยังไม่ชำระเงิน" value={counts.pending} icon={<Clock />} tone="charcoal" />
        <StatCard label="อนุมัติแล้ว (รอเช็คเอาต์)" value={counts.approved} icon={<ShieldCheck />} tone="forest" />
        <StatCard label="เช็คเอาต์แล้ว" value={counts.checked_out} icon={<LogOut />} tone="bamboo" />
        <StatCard 
          label="รายได้ที่ยืนยันแล้ว" 
          value={`฿${counts.totalRevenue.toLocaleString()}`} 
          hint={counts.pendingRevenue > 0 ? `รอตรวจสอบ: ฿${counts.pendingRevenue.toLocaleString()}` : undefined}
          icon={<Wallet />} 
          tone="forest" 
        />
      </section>


      {/* Control Bar */}
      <Panel className="print:hidden">
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-0.5">
          {(
            [
              ["all", "ทั้งหมด", counts.all],
              ["has_slip", "รอตรวจสอบสลิป", counts.has_slip],
              ["pending", "ยังไม่ชำระ", counts.pending],
              ["approved", "อนุมัติแล้ว", counts.approved],
              ["checked_out", "เช็คเอาต์แล้ว", counts.checked_out],
            ] as const
          ).map(([val, label, count]) => {
            const active = filter === val;
            return (
              <button
                key={val}
                onClick={() => handleFilterChange(val as FilterType)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                  active
                    ? "bg-[#0b3b2c] text-white shadow-xs"
                    : "bg-stone-100/80 text-stone-600 hover:bg-stone-200/70"
                }`}
              >
                <span>{label}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    active
                      ? "bg-white/20 text-white"
                      : "bg-stone-200 text-stone-700"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            <div className="relative flex-1 sm:w-64 min-w-[200px]">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="ค้นหาชื่อ, เบอร์โทร, ห้อง, ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full bg-stone-50 pl-9 pr-8 py-1.5 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-[#0b3b2c]/20 text-xs font-medium text-stone-800 placeholder:text-stone-400 transition-all"
              />
              {searchInput && (
                <button
                  onClick={() => {
                    setSearchInput("");
                    updateQueryParams({ search: null, page: 1 });
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 rounded-full"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200/80 text-xs text-stone-600">
              <BedDouble size={15} className="text-stone-400" />
              <span className="font-medium text-stone-500 whitespace-nowrap">
                ประเภท:
              </span>
              <CustomSelect
                options={roomTypeOptions}
                value={roomType}
                onChange={(val) =>
                  updateQueryParams({ roomType: val, page: 1 })
                }
                width="w-48"
              />
            </div>

            <div className="flex items-center gap-1">
              {(
                [
                  ["today", "วันนี้"],
                  ["week", "สัปดาห์นี้"],
                  ["month", "เดือนนี้"],
                ] as const
              ).map(([kind, label]) => {
                const range = getQuickDateRange(kind);
                const active = dateFrom === range.from && dateTo === range.to;
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => handleDateChange(range.from, range.to)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      active
                        ? "bg-[#0b3b2c] text-white shadow-xs"
                        : "bg-stone-100/80 text-stone-600 hover:bg-stone-200/70"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200/80 text-xs text-stone-600">
              <CalendarDays size={15} className="text-[#0b3b2c]" />
              <span className="font-medium text-stone-500 whitespace-nowrap">
                วันที่:
              </span>
              <CustomDatePicker
                value={dateFrom}
                onChange={(val) => handleDateChange(val, dateTo)}
                placeholder="DD/MM/YYYY"
              />
              <span className="text-stone-300 font-bold">–</span>
              <CustomDatePicker
                value={dateTo}
                onChange={(val) => handleDateChange(dateFrom, val)}
                placeholder="DD/MM/YYYY"
              />
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-xl border border-rose-200 font-medium transition-colors"
                title="ล้างการกรองทั้งหมด"
              >
                <RotateCcw size={13} />
                <span>รีเซ็ตตัวกรอง</span>
              </button>
            )}
          </div>

          <button
            onClick={fetchBookings}
            className="px-3.5 py-2 text-stone-700 bg-white hover:bg-stone-100/80 rounded-xl border border-stone-200 shadow-xs transition-all text-xs font-medium flex items-center gap-2 active:scale-95 ml-auto"
            title="รีเฟรชข้อมูล"
          >
            <RefreshCw
              size={14}
              className={
                loading ? "animate-spin text-[#0b3b2c]" : "text-stone-500"
              }
            />
            <span>รีเฟรชข้อมูล</span>
          </button>
        </div>
      </Panel>

      {/* Bookings Table Card */}
      <Panel title="รายการจองห้องพัก" className="print:hidden p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="border-b border-charcoal-100 text-charcoal-400 bg-cream-50 font-bold text-xs tracking-wider uppercase">
                <th className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => toggleSort("created_at")}
                    className="flex items-center gap-1 hover:text-[#0b3b2c] transition-colors"
                    title="เรียงตามวันที่จอง (เก่า-ใหม่)"
                  >
                    ลำดับ
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${
                        sortKey === "created_at"
                          ? sortDir === "asc"
                            ? "rotate-180 text-[#0b3b2c]"
                            : "text-[#0b3b2c]"
                          : "text-stone-300"
                      }`}
                    />
                  </button>
                </th>
                <th className="px-5 py-4">ลูกค้า</th>
                <th className="px-5 py-4">ห้องพัก</th>
                <th className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => toggleSort("check_in")}
                    className="flex items-center gap-1 hover:text-[#0b3b2c] transition-colors"
                  >
                    ระยะเวลาเข้าพัก
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${
                        sortKey === "check_in"
                          ? sortDir === "asc"
                            ? "rotate-180 text-[#0b3b2c]"
                            : "text-[#0b3b2c]"
                          : "text-stone-300"
                      }`}
                    />
                  </button>
                </th>
                <th className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => toggleSort("total_price")}
                    className="flex items-center gap-1 hover:text-[#0b3b2c] transition-colors"
                  >
                    ยอดรวม
                    <ChevronDown
                      size={12}
                      className={`transition-transform ${
                        sortKey === "total_price"
                          ? sortDir === "asc"
                            ? "rotate-180 text-[#0b3b2c]"
                            : "text-[#0b3b2c]"
                          : "text-stone-300"
                      }`}
                    />
                  </button>
                </th>
                <th className="px-5 py-4">สถานะ</th>
                <th className="px-5 py-4 text-center">สลิปโอนเงิน</th>
                <th className="px-5 py-4 text-right">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-stone-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw
                        size={28}
                        className="animate-spin text-[#0b3b2c]"
                      />
                      <span className="text-xs font-medium text-stone-500">
                        กำลังโหลดข้อมูลรายการจอง...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : paginatedBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16">
                    <EmptyState 
                      title="ไม่พบรายการจอง" 
                      description="ลองปรับเปลี่ยนข้อความค้นหาหรือเงื่อนไขการกรอง" 
                    />
                  </td>
                </tr>
              ) : (
                paginatedBookings.map((b: any, idx: number) => {
                  const bookingId = b.room_booking_id || b.id;
                  const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
                  const nights = calculateNights(b.check_in, b.check_out);
                  const cfg = statusConfig[b.status] || {
                    bg: "bg-stone-100 text-stone-600 border-stone-200",
                    text: b.status,
                    dot: "bg-stone-400",
                  };

                  return (
                    <tr key={bookingId} className="hover:bg-cream-100/60 border-b border-charcoal-50 last:border-0 transition-colors group">
                      <td className="px-5 py-4 text-stone-400 font-mono text-xs font-semibold">
                        {rowNumber}
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-stone-100 border border-stone-200/60 flex items-center justify-center text-stone-500 shrink-0 font-bold text-xs">
                            {(b.user_name || "U")[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-stone-800 leading-snug">
                              {b.user_name || "ไม่ระบุชื่อ"}
                            </p>
                            <p className="text-xs text-stone-500 font-mono flex items-center gap-1 mt-0.5">
                              <Phone size={10} className="text-stone-400" />
                              {b.user_phone || b.phone || "-"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <BedDouble
                            size={16}
                            className="text-stone-400 shrink-0"
                          />
                          <div>
                            <p className="font-semibold text-stone-800 leading-snug">
                              {b.room_name || b.type_name || "-"}
                            </p>
                            <p className="text-xs text-stone-500">
                              {Array.isArray(b.rooms) && b.rooms.length > 1
                                ? `${b.rooms.length} ห้อง`
                                : (
                                  <>
                                    ห้อง{" "}
                                    <span className="font-mono font-medium">
                                      {b.room_number ||
                                        b.rooms?.[0]?.room_number ||
                                        b.room_id ||
                                        "-"}
                                    </span>
                                  </>
                                )}
                            </p>
                            {Array.isArray(b.rooms) && b.rooms.length > 1 && (
                              <ul className="mt-1 space-y-0.5 text-xs text-stone-500">
                                {b.rooms.map(
                                  (line: {
                                    booking_room_id: number;
                                    room_number: string;
                                    room_name: string;
                                    status: string;
                                  }) => (
                                    <li key={line.booking_room_id}>
                                      {line.room_name} #{line.room_number}
                                      {line.status === "checked_out"
                                        ? " ✓ ออกแล้ว"
                                        : line.status === "checked_in"
                                          ? " • เช็คอินแล้ว"
                                          : ""}
                                    </li>
                                  ),
                                )}
                              </ul>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5 text-xs text-stone-700 font-mono">
                            <span className="font-medium bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200/50">
                              {b.check_in
                                ? new Date(b.check_in).toLocaleDateString(
                                    "th-TH",
                                    {
                                      day: "numeric",
                                      month: "short",
                                      year: "2-digit",
                                    },
                                  )
                                : "-"}
                            </span>
                            <span className="text-stone-300">→</span>
                            <span className="font-medium bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200/50">
                              {b.check_out
                                ? new Date(b.check_out).toLocaleDateString(
                                    "th-TH",
                                    {
                                      day: "numeric",
                                      month: "short",
                                      year: "2-digit",
                                    },
                                  )
                                : "-"}
                            </span>
                          </div>
                          {nights > 0 && (
                            <span className="text-xs text-stone-400 flex items-center gap-1 font-medium">
                              <Moon size={10} /> {nights} คืน
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 font-bold text-[#0b3b2c] font-mono text-sm whitespace-nowrap">
                        ฿{Number(b.total_price || 0).toLocaleString()}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          <BookingStatusBadge status={b.status} />
                          {b.approved_by_name &&
                            ["approved", "checked_out", "rejected"].includes(
                              b.status,
                            ) && (
                              <span className="text-xs text-stone-400 ml-1">
                                โดย: {b.approved_by_name}
                              </span>
                            )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        {b.payment_slip ? (
                          <button
                            onClick={() =>
                              setSlipModal({
                                open: true,
                                url: resolveMediaUrl(b.payment_slip),
                                name: b.user_name || "slip",
                              })
                            }
                            className="inline-flex items-center gap-1.5 text-xs text-lagoon-700 bg-lagoon-50/80 hover:bg-lagoon-100 border border-lagoon-200/80 px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95 shadow-2xs"
                          >
                            <Eye size={13} />
                            <span>ดูสลิป</span>
                          </button>
                        ) : (
                          <span className="text-xs text-stone-300 italic">
                            ไม่มีสลิป
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() =>
                              setDetailsModal({ open: true, booking: b })
                            }
                            className="p-1.5 text-stone-500 hover:text-stone-800 bg-stone-100 hover:bg-stone-200/80 rounded-xl transition-colors"
                            title="ดูรายละเอียดการจอง"
                          >
                            <FileText size={15} />
                          </button>

                          {b.status === "checked_out" ? (
                            <span className="text-xs text-lagoon-700 font-semibold bg-lagoon-50 border border-lagoon-200/80 px-3 py-1 rounded-xl inline-block">
                              เช็คเอาต์แล้ว
                            </span>
                          ) : b.status === "approved" ? (
                            <div className="flex flex-col items-end gap-1">
                              {(() => {
                                const lines: { status: string }[] = Array.isArray(b.rooms) ? b.rooms : [];
                                const checkedInCount = lines.filter((l) => l.status === "checked_in").length;
                                const total = lines.length || 1;
                                return (
                                  <span className="text-xs text-lagoon-700 font-semibold bg-lagoon-50 border border-lagoon-200/80 px-3 py-1 rounded-xl inline-block">
                                    เช็คอินแล้ว {checkedInCount}/{total} ห้อง
                                  </span>
                                );
                              })()}
                              <button
                                onClick={() =>
                                  router.push(
                                    `${user?.role === "room_staff" ? "/staff/rooms/checkin" : "/admin/checkin"}?search=${encodeURIComponent(b.user_phone || b.user_name || "")}`,
                                  )
                                }
                                className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-[#0b3b2c] font-medium transition-colors"
                              >
                                <LogIn size={11} />
                                <span>ไปหน้าเช็คอิน-เช็คเอาต์</span>
                              </button>
                            </div>
                          ) : b.status === "rejected" ? (
                            <span className="text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-200/80 px-3 py-1 rounded-xl inline-block">
                              ปฏิเสธแล้ว
                            </span>
                          ) : b.status === "cancelled" ? (
                            <span className="text-xs text-stone-500 font-semibold bg-stone-100 border border-stone-200 px-3 py-1 rounded-xl inline-block">
                              ยกเลิกแล้ว
                            </span>
                          ) : ((b.status === "pending" || b.status === "paid") && Number(b.total_price) === 0)
                            || (b.status === "paid" && String(b.payment_slip || "").trim()) ? (
                            <>
                              <button
                                onClick={() => handleApprove(bookingId)}
                                className="inline-flex items-center gap-1 text-xs bg-forest-600 hover:bg-forest-700 text-white font-semibold px-3 py-1.5 rounded-xl transition-all shadow-xs active:scale-95"
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
                                className="inline-flex items-center gap-1 text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold px-3 py-1.5 rounded-xl border border-rose-200 transition-all active:scale-95"
                              >
                                <span>ปฏิเสธ</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-xs text-stone-400 italic">
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
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-stone-50/80 border-t border-stone-200/80 text-xs text-stone-500 print:hidden">
            <span>
              แสดง{" "}
              <strong className="text-stone-800 font-mono">
                {(currentPage - 1) * itemsPerPage + 1}
              </strong>{" "}
              ถึง{" "}
              <strong className="text-stone-800 font-mono">
                {Math.min(currentPage * itemsPerPage, pagination.total)}
              </strong>{" "}
              จากทั้งหมด{" "}
              <strong className="text-stone-800 font-mono">
                {pagination.total}
              </strong>{" "}
              รายการ
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={loading || currentPage === 1}
                className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 disabled:opacity-40 hover:bg-stone-50 transition-colors shadow-2xs"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={loading || currentPage === 1}
                className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 disabled:opacity-40 hover:bg-stone-50 transition-colors shadow-2xs"
              >
                <ChevronLeft size={16} />
              </button>

              {getPaginationRange().map((page, idx) =>
                typeof page === "number" ? (
                  <button
                    key={idx}
                    onClick={() => handlePageChange(page)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition-all ${
                      currentPage === page
                        ? "bg-[#0b3b2c] text-white shadow-2xs"
                        : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
                    }`}
                  >
                    {page}
                  </button>
                ) : (
                  <span key={idx} className="px-1 text-stone-400 font-bold">
                    {page}
                  </span>
                ),
              )}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={loading || currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 disabled:opacity-40 hover:bg-stone-50 transition-colors shadow-2xs"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={loading || currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 disabled:opacity-40 hover:bg-stone-50 transition-colors shadow-2xs"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </Panel>

      {/* Slip Modal */}
      <Modal 
        open={slipModal.open} 
        title={`หลักฐานการชำระเงิน (${slipModal.name})`} 
        onClose={() => setSlipModal({ open: false, url: "", name: "" })}
        footer={
          <button
            onClick={() => setSlipModal({ open: false, url: "", name: "" })}
            className="rounded-xl bg-charcoal-100 px-4 py-2 text-xs font-semibold text-charcoal-700 transition-colors hover:bg-charcoal-200"
          >
            ปิดหน้าต่าง
          </button>
        }
      >
        <div className="flex justify-center rounded-2xl border border-charcoal-100 bg-cream-50 p-2">
          <img
            src={slipModal.url}
            alt="สลิปการโอนเงิน"
            className="max-h-[60vh] rounded-xl object-contain shadow-xs"
          />
        </div>
      </Modal>

      {/* Details Modal */}
      {detailsModal.open &&
        detailsModal.booking &&
        (() => {
          const booking = detailsModal.booking;
          const isCheckedIn = !!booking.checkin_at;
          const isCheckedOut = !!booking.checkout_at;
          const nights = calculateNights(booking.check_in, booking.check_out);

          return (
            <Modal
              open={detailsModal.open}
              title="ใบยืนยันการจองห้องพัก"
              onClose={() => setDetailsModal({ open: false, booking: null })}
              footer={
                <div className="flex w-full gap-2">
                  <button
                    onClick={handlePrintDetails}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-charcoal-100 py-2.5 text-xs font-semibold text-charcoal-700 transition-colors hover:bg-charcoal-200"
                  >
                    <Printer size={14} /> พิมพ์ใบยืนยัน
                  </button>
                  <button
                    onClick={() => setDetailsModal({ open: false, booking: null })}
                    className="flex-1 rounded-xl bg-[#0b3b2c] py-2.5 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#082c21]"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              }
            >
              <div className="space-y-3 text-sm text-charcoal-600 printable-modal">
                <div className="p-3 bg-cream-50 rounded-xl border border-charcoal-100 space-y-1.5 print:bg-white print:border-charcoal-200">
                  <div className="flex items-center gap-2 font-semibold text-charcoal-800 text-sm mb-2">
                    <User size={15} className="text-charcoal-500 print:hidden" />
                    <span>ข้อมูลผู้จอง</span>
                  </div>
                  <p><strong className="text-charcoal-700">ชื่อ-สกุล:</strong> {booking.user_name || "ไม่ระบุ"}</p>
                  <p><strong className="text-charcoal-700">เบอร์โทรศัพท์:</strong> <span className="font-mono text-charcoal-800 font-medium">{booking.user_phone || booking.phone || "-"}</span></p>
                  <p><strong className="text-charcoal-700">หมายเลขอ้างอิง:</strong> #{booking.room_booking_id || booking.id}</p>
                </div>

                <div className="p-3 bg-cream-50 rounded-xl border border-charcoal-100 space-y-1.5 print:bg-white print:border-charcoal-200">
                  <div className="flex items-center gap-2 font-semibold text-charcoal-800 text-sm mb-2">
                    <BedDouble size={15} className="text-charcoal-500 print:hidden" />
                    <span>รายละเอียดห้องพัก</span>
                  </div>
                  {Array.isArray(booking.rooms) && booking.rooms.length > 0 ? (
                    <ul className="space-y-2">
                      {booking.rooms.map((line: { booking_room_id: number; room_number?: string; room_id?: number; room_name?: string; type_name?: string; subtotal?: number | string }) => (
                        <li key={line.booking_room_id} className="flex flex-wrap justify-between gap-2 border-b border-charcoal-100 pb-2">
                          <span>{line.room_name || line.type_name || 'ห้องพัก'} · ห้อง {line.room_number || line.room_id}</span>
                          <span>฿{Number(line.subtotal || 0).toLocaleString('th-TH')}</span>
                        </li>
                      ))}
                    </ul>
                  ) : <>
                    <p><strong className="text-charcoal-700">ชื่อห้อง/ประเภท:</strong> {booking.room_name || booking.type_name}</p>
                    <p><strong className="text-charcoal-700">หมายเลขห้อง:</strong> {booking.room_number || booking.room_id}</p>
                  </>}
                  <p>
                    <strong className="text-charcoal-700">ระยะเวลาเข้าพัก:</strong>{" "}
                    {booking.check_in ? new Date(booking.check_in).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : "-"} ถึง{" "}
                    {booking.check_out ? new Date(booking.check_out).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" }) : "-"} ({nights} คืน)
                  </p>

                  <div className="pt-2 mt-2 border-t border-charcoal-200/60">
                    <div className="flex items-center gap-1.5 text-charcoal-700 font-semibold mb-1">
                      <MessageSquare size={13} className="text-[#0b3b2c] print:hidden" />
                      <span>คำขอพิเศษ (Special Request):</span>
                    </div>
                    <p className="text-charcoal-600 bg-white p-2 rounded-xl border border-charcoal-200/80 leading-relaxed italic print:border-charcoal-300">
                      {booking.special_request || booking.special_requests || "ไม่มีคำขอพิเศษ"}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-cream-50 rounded-xl border border-charcoal-100 flex items-center justify-between print:bg-white print:border-charcoal-200">
                  <span className="font-semibold text-charcoal-700">สถานะรายการ:</span>
                  <BookingStatusBadge status={booking.status} />
                </div>

                {booking.status === "rejected" && (booking.reject_reason || booking.reason) && (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 space-y-1 text-rose-800 print:bg-white print:border-rose-300">
                    <span className="font-semibold">เหตุผลที่ปฏิเสธ:</span>
                    <p className="italic text-rose-700">{booking.reject_reason || booking.reason}</p>
                  </div>
                )}

                <div className="p-3 bg-cream-50 rounded-xl border border-charcoal-100 flex justify-between items-center print:bg-white print:border-charcoal-200">
                  <span className="font-semibold text-charcoal-700">ยอดรวมสุทธิ</span>
                  <span className="text-lg font-extrabold text-[#0b3b2c] font-mono">฿{Number(booking.total_price || 0).toLocaleString()}</span>
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
              className="flex-1 rounded-xl bg-charcoal-100 py-2.5 text-xs font-semibold text-charcoal-700 transition-colors hover:bg-charcoal-200"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleRejectSubmit}
              className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-semibold text-white shadow-md transition-all hover:bg-rose-700 active:scale-95"
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
                    ? "border-rose-400 bg-rose-50 text-rose-700 shadow-sm"
                    : "border-charcoal-200 bg-cream-50 text-charcoal-600 hover:bg-cream-100"
                }`}
              >
                <span>{reason}</span>
                <div className={`flex h-4 w-4 items-center justify-center rounded-full border ${isSelected ? "border-rose-500 bg-rose-500" : "border-charcoal-300 bg-white"}`}>
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
              className="w-full rounded-xl border border-charcoal-200 bg-cream-50 p-3 text-xs text-charcoal-800 outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
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
              className="flex-1 rounded-xl bg-charcoal-100 py-2.5 text-xs font-semibold text-charcoal-700 transition-colors hover:bg-charcoal-200"
            >
              ยกเลิก
            </button>
            <button
              onClick={() => {
                confirmModal.onConfirm();
                setConfirmModal((prev) => ({ ...prev, open: false }));
              }}
              className={`flex-1 rounded-xl py-2.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 ${confirmModal.confirmColor}`}
            >
              {confirmModal.confirmText}
            </button>
          </div>
        }
      >
        <p className="text-sm text-charcoal-600">{confirmModal.text}</p>
      </Modal>

      {/* Toast Notification */}
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

export default function AdminRoomsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center">
          <RefreshCw size={28} className="animate-spin text-[#0b3b2c]" />
        </div>
      }
    >
      <RoomStaffDashboardContent />
    </Suspense>
  );
}
