"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  CalendarDays,
  Clock,
  Eye,
  X,
  RefreshCw,
  LogOut,
  LogIn,
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
import api from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatar";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast, { Toaster } from "react-hot-toast";

// Mapping สถานะสำหรับ UI
const statusLabel: Record<string, string> = {
  pending: "รอดำเนินการ",
  paid: "รอตรวจสอบสลิป",
  approved: "อนุมัติแล้ว (รอเช็คอิน)",
  checked_in: "เช็คอินแล้ว",
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
      bg: "bg-blue-500/10 border-blue-200/80 text-blue-700",
      text: "รอตรวจสอบสลิป",
      dot: "bg-blue-500",
    },
    approved: {
      bg: "bg-indigo-500/10 border-indigo-200/80 text-indigo-700",
      text: "อนุมัติแล้ว (รอเช็คอิน)",
      dot: "bg-indigo-500",
    },
    checked_in: {
      bg: "bg-emerald-500/10 border-emerald-200/80 text-emerald-700",
      text: "เช็คอินแล้ว (กำลังเข้าพัก)",
      dot: "bg-emerald-500 animate-pulse",
    },
    checked_out: {
      bg: "bg-slate-500/10 border-slate-200/80 text-slate-600",
      text: "เช็คเอาต์เรียบร้อย",
      dot: "bg-slate-400",
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
  | "checked_in"
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
    "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
    "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
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
          {/* Calendar Header */}
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

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 text-center text-[10px] font-bold text-stone-400 mb-1">
            <span>อา</span>
            <span>จ</span>
            <span>อ</span>
            <span>พ</span>
            <span>พฤ</span>
            <span>ศ</span>
            <span>ส</span>
          </div>

          {/* Days Grid */}
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
                      ? "bg-emerald-100 text-[#0b3b2c] font-bold border border-emerald-300"
                      : "text-stone-700 hover:bg-stone-100"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Quick Select Buttons */}
          <div className="flex items-center justify-between pt-2 mt-2 border-t border-stone-100 text-[10px]">
            <button
              onClick={() => {
                const today = new Date().toISOString().split("T")[0];
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

// ฟังก์ชันช่วยคำนวณจำนวนคืนที่พัก
const calculateNights = (checkIn?: string, checkOut?: string) => {
  if (!checkIn || !checkOut) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

export default function RoomStaffDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { ready } = useAuthGuard({
    allowedRoles: ["admin", "room_staff"],
  });

  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // อ่านค่า State จาก URL Query Parameters
  const filter = (searchParams.get("filter") as FilterType) || "all";
  const roomType = searchParams.get("roomType") || "all";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const searchParam = searchParams.get("search") || "";
  const currentPage = Number(searchParams.get("page")) || 1;

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
    confirmColor: "bg-[#0b3b2c]",
    onConfirm: () => {},
  });

  // Modal กรณีปฏิเสธการจอง (ระบุเหตุผล)
  const [rejectModal, setRejectModal] = useState<{
    open: boolean;
    bookingId: number | null;
    reason: string;
  }>({ open: false, bookingId: null, reason: "" });

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

  useEffect(() => {
    if (!ready) return;
    fetchBookings();
  }, [ready]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get("/bookings");
      setBookings(res.data?.data || []);
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลการจองได้");
    } finally {
      setLoading(false);
    }
  };

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
        } catch (err: any) {
          toast.error(err.response?.data?.message || "ทำรายการไม่สำเร็จ");
        }
      },
    );
  };

  // handleRejectSubmit (ปฏิเสธพร้อมระบุเหตุผล)
  const handleRejectSubmit = async () => {
    if (!rejectModal.bookingId) return;
    try {
      await api.put(`/bookings/${rejectModal.bookingId}/status`, {
        status: "rejected",
        reject_reason: rejectModal.reason.trim() || "ข้อมูลหลักฐานไม่ถูกต้อง",
      });
      toast.success("ปฏิเสธรายการจองเรียบร้อยแล้ว");

      setBookings((prev) =>
        prev.map((b) =>
          b.id === rejectModal.bookingId
            ? { ...b, status: "rejected", reject_reason: rejectModal.reason }
            : b,
        ),
      );

      setRejectModal({ open: false, bookingId: null, reason: "" });
      fetchBookings();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "ปฏิเสธการจองไม่สำเร็จ");
    }
  };

  // handleCheckin
  const handleCheckin = (id: number) => {
    openConfirmDialog(
      "ยืนยันการเช็คอิน?",
      "เมื่อยืนยัน สถานะจะเปลี่ยนเป็น 'เช็คอินแล้ว'",
      "info",
      "ยืนยัน Check-in",
      "bg-indigo-600",
      async () => {
        try {
          await api.put(`/bookings/${id}/checkin`);
          toast.success("เช็คอินผู้เข้าพักสำเร็จ");
          setBookings((prev) =>
            prev.map((b) =>
              b.id === id
                ? { ...b, status: "checked_in", checkin_at: new Date().toISOString() }
                : b,
            ),
          );
          fetchBookings();
        } catch (err: any) {
          toast.error(err.response?.data?.message || "เช็คอินไม่สำเร็จ");
        }
      },
    );
  };

  // handleCheckout
  const handleCheckout = (id: number) => {
    openConfirmDialog(
      "ยืนยันการเช็คเอาต์?",
      "เมื่อยืนยัน สถานะจะเปลี่ยนเป็น 'เช็คเอาต์แล้ว' และคืนสถานะห้องพัก",
      "warning",
      "ยืนยัน Check-out",
      "bg-emerald-700",
      async () => {
        try {
          await api.put(`/bookings/${id}/checkout`);
          toast.success("เช็คเอาต์สำเร็จเรียบร้อย");
          setBookings((prev) =>
            prev.map((b) =>
              b.id === id
                ? { ...b, status: "checked_out", checkout_at: new Date().toISOString() }
                : b,
            ),
          );
          fetchBookings();
        } catch (err: any) {
          toast.error(err.response?.data?.message || "เช็คเอาต์ไม่สำเร็จ");
        }
      },
    );
  };

  // พิมพ์รายละเอียดการจอง / ใบเสร็จ
  const handlePrintDetails = () => {
    window.print();
  };

  // รวบรวมประเภทห้องพักทั้งหมดที่มีในระบบ
  const roomTypes = useMemo(() => {
    const types = new Set<string>();
    bookings.forEach((b) => {
      const name = b.type_name || b.room_name;
      if (name) types.add(name);
    });
    return Array.from(types);
  }, [bookings]);

  const roomTypeOptions = useMemo(() => {
    return [
      { value: "all", label: "ทั้งหมดทุกประเภท" },
      ...roomTypes.map((t) => ({ value: t, label: t })),
    ];
  }, [roomTypes]);

  // คำนวณสรุปสถิติต่างๆ
  const counts = useMemo(() => {
    const approvedList = bookings.filter((b) =>
      ["approved", "checked_in", "checked_out"].includes(b.status),
    );
    const pendingSlipList = bookings.filter(
      (b) =>
        b.payment_slip &&
        ![
          "approved",
          "checked_in",
          "checked_out",
          "rejected",
          "cancelled",
        ].includes(b.status),
    );

    return {
      has_slip: pendingSlipList.length,
      pending: bookings.filter((b) => !b.payment_slip && b.status === "pending")
        .length,
      approved: bookings.filter((b) => b.status === "approved").length,
      checked_in: bookings.filter((b) => b.status === "checked_in").length,
      checked_out: bookings.filter((b) => b.status === "checked_out").length,
      totalRevenue: approvedList.reduce(
        (acc, curr) => acc + Number(curr.total_price || 0),
        0,
      ),
      pendingRevenue: pendingSlipList.reduce(
        (acc, curr) => acc + Number(curr.total_price || 0),
        0,
      ),
    };
  }, [bookings]);

  // ระบบกรองข้อมูลหลัก
  const filtered = useMemo(() => {
    let list = bookings;

    // 1. Filter ตามสถานะ
    if (filter === "has_slip")
      list = list.filter(
        (b) =>
          b.payment_slip &&
          ![
            "approved",
            "checked_in",
            "checked_out",
            "rejected",
            "cancelled",
          ].includes(b.status),
      );
    else if (filter === "pending")
      list = list.filter((b) => !b.payment_slip && b.status === "pending");
    else if (filter === "approved")
      list = list.filter((b) => b.status === "approved");
    else if (filter === "checked_in")
      list = list.filter((b) => b.status === "checked_in");
    else if (filter === "checked_out")
      list = list.filter((b) => b.status === "checked_out");

    // 2. Filter ตามประเภทห้องพัก
    if (roomType !== "all") {
      list = list.filter((b) => (b.type_name || b.room_name) === roomType);
    }

    // 3. Filter ตามช่วงวันที่เข้าพัก
    if (dateFrom)
      list = list.filter(
        (b) => b.check_in && new Date(b.check_in) >= new Date(dateFrom),
      );
    if (dateTo)
      list = list.filter(
        (b) => b.check_in && new Date(b.check_in) <= new Date(dateTo),
      );

    // 4. Search Filter
    if (searchParam.trim()) {
      const q = searchParam.toLowerCase().trim();
      list = list.filter((b) => {
        const bookingId = String(b.room_booking_id || b.id || "").toLowerCase();
        const userName = String(b.user_name || "").toLowerCase();
        const userPhone = String(b.user_phone || b.phone || "").toLowerCase();
        const userEmail = String(b.user_email || "").toLowerCase();
        const roomName = String(b.room_name || b.type_name || "").toLowerCase();
        const roomNum = String(b.room_number || b.room_id || "").toLowerCase();

        return (
          bookingId.includes(q) ||
          userName.includes(q) ||
          userPhone.includes(q) ||
          userEmail.includes(q) ||
          roomName.includes(q) ||
          roomNum.includes(q)
        );
      });
    }

    return list;
  }, [bookings, filter, roomType, dateFrom, dateTo, searchParam]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;

  const paginatedBookings = useMemo(() => {
    return filtered.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    );
  }, [filtered, currentPage]);

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
    <div className="w-full min-h-screen flex flex-col font-sans space-y-4 pb-10">
      {/* CSS สำหรับจัดแต่งการพิมพ์ (Print Stylesheet) */}
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-stone-200/60 print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl md:text-3xl font-bold text-[#0b3b2c] tracking-tight">
              แดชบอร์ดห้องพัก
            </h1>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#0b3b2c]/10 text-[#0b3b2c]">
              Staff
            </span>
          </div>
          <p className="text-stone-500 mt-1 text-xs md:text-sm">
            ตรวจสอบหลักฐานการชำระเงิน อนุมัติการจอง เช็คอิน และเช็คเอาต์ผู้เข้าพัก
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 print:hidden">
        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between relative">
            <div className="space-y-1">
              <span className="text-xs font-medium text-stone-500">
                รอตรวจสอบสลิป
              </span>
              <p className="text-2xl font-extrabold text-blue-600 tracking-tight font-mono">
                {counts.has_slip}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <FileCheck2 size={18} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between relative">
            <div className="space-y-1">
              <span className="text-xs font-medium text-stone-500">
                ยังไม่ชำระเงิน
              </span>
              <p className="text-2xl font-extrabold text-[#0b3b2c] tracking-tight font-mono">
                {counts.pending}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-[#0b3b2c]/10 border border-[#0b3b2c]/20 flex items-center justify-center text-[#0b3b2c]">
              <Clock size={18} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between relative">
            <div className="space-y-1">
              <span className="text-xs font-medium text-stone-500">
                อนุมัติแล้ว (รอเช็คอิน)
              </span>
              <p className="text-2xl font-extrabold text-indigo-600 tracking-tight font-mono">
                {counts.approved}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <ShieldCheck size={18} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-start justify-between relative">
            <div className="space-y-1">
              <span className="text-xs font-medium text-stone-500">
                พักอยู่ (รอ Check-out)
              </span>
              <p className="text-2xl font-extrabold text-emerald-600 tracking-tight font-mono">
                {counts.checked_in}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
              <LogIn size={18} />
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden group sm:col-span-2 lg:col-span-1">
          <div className="flex items-start justify-between relative">
            <div className="space-y-1">
              <span className="text-xs font-medium text-stone-500">
                รายได้ที่ยืนยันแล้ว
              </span>
              <p className="text-xl font-extrabold text-[#0b3b2c] tracking-tight font-mono">
                ฿{counts.totalRevenue.toLocaleString()}
              </p>
              {counts.pendingRevenue > 0 && (
                <p className="text-[10px] text-blue-600 font-medium">
                  (รอตรวจสอบ: ฿{counts.pendingRevenue.toLocaleString()})
                </p>
              )}
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#0b3b2c]">
              <Wallet size={18} />
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs space-y-4 print:hidden">
        {/* Tabs Filter */}
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-0.5">
          {(
            [
              ["all", "ทั้งหมด", bookings.length],
              ["has_slip", "รอตรวจสอบสลิป", counts.has_slip],
              ["pending", "ยังไม่ชำระ", counts.pending],
              ["approved", "รอเช็คอิน", counts.approved],
              ["checked_in", "เช็คอินแล้ว", counts.checked_in],
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
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
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

        {/* ค้นหา + ตัวกรองประเภทห้อง + ช่วงวันที่ + ปุ่มรีเฟรช */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-stone-100">
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Search Input */}
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

            {/* Room Type Selector */}
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

            {/* 🔥 Custom Date Range Picker ปรับปรุงดีไซน์ปฏิทินสวยงาม */}
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

            {/* Clear Filters */}
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

          {/* Refresh Button */}
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
      </div>

      {/* Bookings Table Card */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-sm overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs md:text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200/80 text-stone-500 font-bold text-[11px] tracking-wider uppercase">
                <th className="px-5 py-4">ID</th>
                <th className="px-5 py-4">ลูกค้า</th>
                <th className="px-5 py-4">ห้องพัก</th>
                <th className="px-5 py-4">ระยะเวลาเข้าพัก</th>
                <th className="px-5 py-4">ยอดรวม</th>
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
                  <td colSpan={8} className="py-16 text-center text-stone-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 mb-1">
                        <Filter size={20} />
                      </div>
                      <p className="font-semibold text-stone-700 text-sm">
                        ไม่พบรายการจองห้องพัก
                      </p>
                      <p className="text-xs text-stone-400">
                        ลองปรับเปลี่ยนข้อความค้นหาหรือเงื่อนไขการกรอง
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedBookings.map((b: any) => {
                  const bookingId = b.room_booking_id || b.id;
                  const nights = calculateNights(b.check_in, b.check_out);
                  const cfg = statusConfig[b.status] || {
                    bg: "bg-stone-100 text-stone-600 border-stone-200",
                    text: b.status,
                    dot: "bg-stone-400",
                  };

                  return (
                    <tr
                      key={bookingId}
                      className="hover:bg-stone-50/80 transition-colors group"
                    >
                      <td className="px-5 py-4 text-stone-400 font-mono text-xs font-semibold">
                        #{bookingId}
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
                            <p className="text-[11px] text-stone-500 font-mono flex items-center gap-1 mt-0.5">
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
                            <p className="text-[11px] text-stone-500">
                              ห้อง{" "}
                              <span className="font-mono font-medium">
                                {b.room_number || b.room_id}
                              </span>
                            </p>
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
                            <span className="text-[10px] text-stone-400 flex items-center gap-1 font-medium">
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
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.bg}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}
                            />
                            {statusLabel[b.status] || b.status}
                          </span>
                          {b.approved_by_name &&
                            [
                              "approved",
                              "checked_in",
                              "checked_out",
                              "rejected",
                            ].includes(b.status) && (
                              <span className="text-[10px] text-stone-400 ml-1">
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
                            className="inline-flex items-center gap-1.5 text-xs text-blue-700 bg-blue-50/80 hover:bg-blue-100 border border-blue-200/80 px-3 py-1.5 rounded-xl font-semibold transition-all active:scale-95 shadow-2xs"
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
                            <span className="text-xs text-teal-700 font-semibold bg-teal-50 border border-teal-200/80 px-3 py-1 rounded-xl inline-block">
                              เช็คเอาต์แล้ว
                            </span>
                          ) : b.status === "checked_in" ? (
                            <button
                              onClick={() => handleCheckout(bookingId)}
                              className="inline-flex items-center gap-1.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-3.5 py-1.5 rounded-xl shadow-xs transition-all active:scale-95"
                            >
                              <LogOut size={13} />
                              <span>Check-out</span>
                            </button>
                          ) : b.status === "approved" ? (
                            <button
                              onClick={() => handleCheckin(bookingId)}
                              className="inline-flex items-center gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-3.5 py-1.5 rounded-xl shadow-xs transition-all active:scale-95"
                            >
                              <LogIn size={13} />
                              <span>Check-in</span>
                            </button>
                          ) : b.status === "rejected" ? (
                            <span className="text-xs text-rose-600 font-semibold bg-rose-50 border border-rose-200/80 px-3 py-1 rounded-xl inline-block">
                              ปฏิเสธแล้ว
                            </span>
                          ) : b.status === "cancelled" ? (
                            <span className="text-xs text-stone-500 font-semibold bg-stone-100 border border-stone-200 px-3 py-1 rounded-xl inline-block">
                              ยกเลิกแล้ว
                            </span>
                          ) : b.payment_slip ? (
                            <>
                              <button
                                onClick={() => handleApprove(bookingId)}
                                className="inline-flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-3 py-1.5 rounded-xl transition-all shadow-xs active:scale-95"
                              >
                                <span>อนุมัติ</span>
                              </button>
                              <button
                                onClick={() =>
                                  setRejectModal({
                                    open: true,
                                    bookingId,
                                    reason: "",
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
        {filtered.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-stone-50/80 border-t border-stone-200/80 text-xs text-stone-500 print:hidden">
            <span>
              แสดง{" "}
              <strong className="text-stone-800 font-mono">
                {(currentPage - 1) * itemsPerPage + 1}
              </strong>{" "}
              ถึง{" "}
              <strong className="text-stone-800 font-mono">
                {Math.min(currentPage * itemsPerPage, filtered.length)}
              </strong>{" "}
              จากทั้งหมด{" "}
              <strong className="text-stone-800 font-mono">
                {filtered.length}
              </strong>{" "}
              รายการ
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 disabled:opacity-40 hover:bg-stone-50 transition-colors shadow-2xs"
              >
                <ChevronsLeft size={16} />
              </button>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
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
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 disabled:opacity-40 hover:bg-stone-50 transition-colors shadow-2xs"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-stone-200 bg-white text-stone-600 disabled:opacity-40 hover:bg-stone-50 transition-colors shadow-2xs"
              >
                <ChevronsRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Slip Modal */}
      {slipModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs print:hidden">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
              <h3 className="font-bold text-stone-800 text-base flex items-center gap-2">
                <FileCheck2 className="text-blue-600" size={18} />
                หลักฐานการชำระเงิน ({slipModal.name})
              </h3>
              <button
                onClick={() => setSlipModal({ open: false, url: "", name: "" })}
                className="p-1.5 rounded-full text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto flex justify-center bg-stone-50 p-2 rounded-2xl border border-stone-100">
              <img
                src={slipModal.url}
                alt="สลิปการโอนเงิน"
                className="max-w-full h-auto object-contain rounded-xl shadow-xs"
              />
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setSlipModal({ open: false, url: "", name: "" })}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-colors"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {detailsModal.open &&
        detailsModal.booking &&
        (() => {
          const booking = detailsModal.booking;
          const isCheckedIn = !!booking.checkin_at;
          const isCheckedOut = !!booking.checkout_at;
          const nights = calculateNights(booking.check_in, booking.check_out);

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs printable-modal-overlay">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95 duration-200 printable-modal">
                <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-[#0b3b2c]/10 text-[#0b3b2c] rounded-xl print:hidden">
                      <FileText size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-800 text-base md:text-lg">
                        ใบยืนยันการจองห้องพัก
                      </h3>
                      <p className="text-stone-400 text-xs font-mono">
                        หมายเลขอ้างอิง: #{booking.room_booking_id || booking.id}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      setDetailsModal({ open: false, booking: null })
                    }
                    className="p-1.5 rounded-full text-stone-400 hover:bg-stone-100 transition-colors print:hidden"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3 text-xs text-stone-600">
                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100 space-y-1.5 print:bg-white print:border-stone-200">
                    <div className="flex items-center gap-2 font-semibold text-stone-800 text-sm mb-1">
                      <User size={15} className="text-stone-500 print:hidden" />
                      <span>ข้อมูลผู้จอง</span>
                    </div>
                    <p>
                      <strong className="text-stone-700">ชื่อ-สกุล:</strong>{" "}
                      {booking.user_name || "ไม่ระบุ"}
                    </p>
                    <p>
                      <strong className="text-stone-700">เบอร์โทรศัพท์:</strong>{" "}
                      <span className="font-mono text-stone-800 font-medium">
                        {booking.user_phone || booking.phone || "-"}
                      </span>
                    </p>
                  </div>

                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100 space-y-1.5 print:bg-white print:border-stone-200">
                    <div className="flex items-center gap-2 font-semibold text-stone-800 text-sm mb-1">
                      <BedDouble size={15} className="text-stone-500 print:hidden" />
                      <span>รายละเอียดห้องพัก</span>
                    </div>
                    <p>
                      <strong className="text-stone-700">
                        ชื่อห้อง/ประเภท:
                      </strong>{" "}
                      {booking.room_name || booking.type_name}
                    </p>
                    <p>
                      <strong className="text-stone-700">หมายเลขห้อง:</strong>{" "}
                      {booking.room_number || booking.room_id}
                    </p>
                    <p>
                      <strong className="text-stone-700">ระยะเวลาเข้าพัก:</strong>{" "}
                      {booking.check_in
                        ? new Date(booking.check_in).toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "-"}{" "}
                      ถึง{" "}
                      {booking.check_out
                        ? new Date(booking.check_out).toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })
                        : "-"}{" "}
                      ({nights} คืน)
                    </p>

                    <div className="pt-2 mt-2 border-t border-stone-200/60">
                      <div className="flex items-center gap-1.5 text-stone-700 font-semibold mb-1">
                        <MessageSquare size={13} className="text-[#0b3b2c] print:hidden" />
                        <span>คำขอพิเศษ (Special Request):</span>
                      </div>
                      <p className="text-stone-600 bg-white p-2 rounded-xl border border-stone-200/80 leading-relaxed italic print:border-stone-300">
                        {booking.special_request ||
                          booking.special_requests ||
                          "ไม่มีคำขอพิเศษ"}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100 space-y-1.5 print:bg-white print:border-stone-200">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-stone-700">
                        สถานะรายการ:
                      </span>

                      {isCheckedOut ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[11px] font-bold print:border print:border-teal-300">
                          เช็คเอาต์แล้ว (
                          {new Date(booking.checkout_at).toLocaleTimeString(
                            "th-TH",
                            { hour: "2-digit", minute: "2-digit" },
                          )}{" "}
                          น.)
                        </span>
                      ) : isCheckedIn ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold print:border print:border-emerald-300">
                          เช็คอินแล้ว (
                          {new Date(booking.checkin_at).toLocaleTimeString(
                            "th-TH",
                            { hour: "2-digit", minute: "2-digit" },
                          )}{" "}
                          น.)
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#0b3b2c]/10 text-[#0b3b2c] text-[11px] font-bold print:border print:border-emerald-300">
                          {statusLabel[booking.status] || booking.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {booking.status === "rejected" && (booking.reject_reason || booking.reason) && (
                    <div className="p-3 bg-rose-50 rounded-2xl border border-rose-200/80 space-y-1 text-rose-800 print:bg-white print:border-rose-300">
                      <span className="font-semibold">เหตุผลที่ปฏิเสธ:</span>
                      <p className="italic text-rose-700">{booking.reject_reason || booking.reason}</p>
                    </div>
                  )}

                  <div className="p-3 bg-stone-50 rounded-2xl border border-stone-100 flex justify-between items-center print:bg-white print:border-stone-200">
                    <span className="font-semibold text-stone-700">
                      ยอดรวมสุทธิ
                    </span>
                    <span className="text-base font-extrabold text-[#0b3b2c] font-mono">
                      ฿{Number(booking.total_price || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 print:hidden">
                  <button
                    onClick={handlePrintDetails}
                    className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Printer size={14} />
                    <span>พิมพ์ใบยืนยัน</span>
                  </button>
                  <button
                    onClick={() =>
                      setDetailsModal({ open: false, booking: null })
                    }
                    className="flex-1 py-2.5 bg-[#0b3b2c] hover:bg-[#082c21] text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
                  >
                    ปิดหน้าต่าง
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Reject Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 print:hidden">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-stone-100 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-rose-50 border border-rose-100 text-rose-600">
              <AlertTriangle size={24} />
            </div>

            <div>
              <h3 className="text-base font-bold text-stone-800">
                ปฏิเสธรายการจองนี้?
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                กรุณาระบุเหตุผลในการปฏิเสธสลิปหรือการจอง
              </p>
            </div>

            <textarea
              rows={3}
              placeholder="ระบุเหตุผล เช่น ยอดเงินไม่ครบ, สลิปไม่ชัดเจน, บัญชีโอนไม่ถูกต้อง..."
              value={rejectModal.reason}
              onChange={(e) =>
                setRejectModal((prev) => ({ ...prev, reason: e.target.value }))
              }
              className="w-full p-3 bg-stone-50 rounded-xl border border-stone-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 text-xs text-stone-800 placeholder:text-stone-400"
            />

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() =>
                  setRejectModal({ open: false, bookingId: null, reason: "" })
                }
                className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleRejectSubmit}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-opacity"
              >
                ยืนยันปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 bg-stone-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150 print:hidden">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-stone-100 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-stone-50 border border-stone-100 text-stone-700">
              {confirmModal.icon === "warning" && (
                <AlertTriangle size={24} className="text-[#0b3b2c]" />
              )}
              {confirmModal.icon === "info" && (
                <Info size={24} className="text-indigo-500" />
              )}
              {confirmModal.icon === "question" && (
                <HelpCircle size={24} className="text-[#0b3b2c]" />
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-stone-800">
                {confirmModal.title}
              </h3>
              <p className="text-xs text-stone-500 mt-1">{confirmModal.text}</p>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() =>
                  setConfirmModal((prev) => ({ ...prev, open: false }))
                }
                className="flex-1 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal((prev) => ({ ...prev, open: false }));
                }}
                className={`flex-1 py-2.5 rounded-xl text-white text-xs font-bold shadow-sm hover:opacity-90 transition-opacity ${confirmModal.confirmColor}`}
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

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