"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Star,
  Trash2,
  Search,
  MessageSquare,
  AlertCircle,
  X,
  ChevronDown,
  RefreshCw,
  Sparkles,
  BedDouble,
  Calendar,
  ChevronLeft,
  ChevronRight,
  User,
  SlidersHorizontal,
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatar";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { Modal } from "@/components/admin/ui";
import { formatThaiDateShort, formatThaiDateLong } from "@/lib/date";

interface CustomSelectOption {
  value: string | number;
  label: string;
}

// Custom Dropdown Styled with Soft Cream & Forest Green
function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "เลือก...",
  width = "w-full",
}: {
  options: CustomSelectOption[];
  value: string | number;
  onChange: (val: string | number) => void;
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
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-cream-50/80 hover:bg-cream-100/70 border border-charcoal-200/60 rounded-xl text-xs font-semibold text-charcoal-800 transition-all focus:outline-none focus:ring-2 focus:ring-forest-500/20 shadow-2xs"
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={13}
          className={`text-charcoal-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-forest-700" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-full min-w-[180px] bg-white border border-cream-200 rounded-2xl shadow-panel z-50 overflow-hidden py-1.5 max-h-60 overflow-y-auto animate-in fade-in duration-150">
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
                    : "text-charcoal-700 hover:bg-cream-100/80 hover:text-charcoal-900"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-forest-800 shrink-0 ml-2" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Soft Star Rating Display Component
function StarDisplay({
  rating,
  size = 14,
}: {
  rating: number;
  size?: number;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={size}
          className={
            s <= rating
              ? "fill-bamboo-400 text-bamboo-500"
              : "text-cream-300 fill-cream-100"
          }
        />
      ))}
    </div>
  );
}

interface ReviewItem {
  review_id: number;
  first_name: string;
  last_name: string;
  email: string;
  image_profile?: string | null;
  room_name: string;
  type_name: string;
  rating: number | string;
  comment?: string | null;
  check_in?: string | null;
  check_out?: string | null;
  review_date: string;
}

interface RoomTypeItem {
  id: number;
  room_name: string;
  type_name: string;
}

export default function AdminReviewsPage() {
  const { ready } = useAuthGuard({ allowedRoles: ["admin", "room_staff"] });
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isFetching, setIsFetching] = useState(false);

  // Search state with debounce
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [filterRoomType, setFilterRoomType] = useState<string | number>("");
  const [starFilter, setStarFilter] = useState<string>("all"); // 'all' | '5' | '4' | '3' | '2' | '1'
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [globalRatingTotals, setGlobalRatingTotals] = useState<Record<number, number>>({});
  const requestId = useRef(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);

  // State for Delete Confirmation Modal
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Debounce search input (300ms) to avoid lagging on keystrokes
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchInput]);

  // Initial load: Fetch Room Types & Overall Review Stats concurrently
  useEffect(() => {
    if (!ready) return;
    let isMounted = true;

    const initData = async () => {
      try {
        const [roomsRes, summaryRes] = await Promise.all([
          api.get("/rooms", { params: { is_admin: true } }),
          api.get("/reviews/admin/all", { params: { limit: 1 } }),
        ]);

        if (isMounted) {
          setRoomTypes(roomsRes.data?.data || []);
          if (summaryRes.data?.summary?.ratingCounts) {
            setGlobalRatingTotals(summaryRes.data.summary.ratingCounts);
          }
          if (summaryRes.data?.avg_rating != null) {
            setAvgRating(summaryRes.data.avg_rating);
          }
        }
      } catch {
        // ignore
      }
    };

    initData();
    return () => {
      isMounted = false;
    };
  }, [ready]);

  // Main Review List Fetcher
  const fetchReviews = useCallback(async (): Promise<void> => {
    if (!ready) return;
    const id = ++requestId.current;
    setIsFetching(true);

    try {
      const params: Record<string, string | number> = {
        page: currentPage,
        limit: pageSize,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (filterRoomType) params.room_type_id = filterRoomType;
      if (starFilter !== "all") {
        params.min_rating = starFilter;
        params.max_rating = starFilter;
      }

      const res = await api.get("/reviews/admin/all", { params });
      if (id !== requestId.current) return;

      setReviews(res.data?.data || []);
      const totalCount = res.data?.pagination?.total ?? res.data?.total ?? 0;
      const totalPagesCount = Math.max(
        1,
        res.data?.pagination?.totalPages ?? Math.ceil(totalCount / pageSize),
      );
      setPagination({ total: totalCount, totalPages: totalPagesCount });

      if (res.data?.avg_rating != null && starFilter === "all" && !filterRoomType && !debouncedSearch) {
        setAvgRating(res.data.avg_rating);
      }
      if (res.data?.summary?.ratingCounts && starFilter === "all" && !filterRoomType && !debouncedSearch) {
        setGlobalRatingTotals(res.data.summary.ratingCounts);
      }
    } catch {
      if (id === requestId.current) notify.error("ไม่สามารถโหลดรีวิวได้");
    } finally {
      if (id === requestId.current) {
        setIsFetching(false);
        setInitialLoading(false);
      }
    }
  }, [ready, currentPage, pageSize, debouncedSearch, filterRoomType, starFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/reviews/admin/${deleteTargetId}`);
      notify.success("ลบรีวิวเรียบร้อยแล้ว");
      await fetchReviews();
      setDeleteTargetId(null);
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "ลบรีวิวไม่สำเร็จ"));
    } finally {
      setIsDeleting(false);
    }
  };

  const roomTypeOptions: CustomSelectOption[] = [
    { value: "", label: "ทุกห้องพัก" },
    ...roomTypes.map((rt) => ({
      value: rt.id,
      label: `${rt.room_name} — ${rt.type_name}`,
    })),
  ];

  const totalAllStars = useMemo(() => {
    return [5, 4, 3, 2, 1].reduce(
      (sum, star) => sum + (globalRatingTotals[star] || 0),
      0,
    );
  }, [globalRatingTotals]);

  const attentionReviewsCount =
    (globalRatingTotals[1] || 0) +
    (globalRatingTotals[2] || 0) +
    (globalRatingTotals[3] || 0);

  // Pagination Number Buttons Helper
  const pageNumbers = useMemo(() => {
    const total = pagination.totalPages;
    const current = currentPage;
    const pages: (number | string)[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push("...");
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 2) pages.push("...");
      pages.push(total);
    }
    return pages;
  }, [currentPage, pagination.totalPages]);

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-16 max-w-[1600px] mx-auto">
      {/* Top Header with Soft Cream / Forest Green Style */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-10 h-10 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-800/10">
                <MessageSquare size={20} className="stroke-[2.2]" />
              </span>
              <div>
                <h1 className="font-display text-2xl lg:text-3xl font-bold text-forest-900 tracking-tight">
                  จัดการรีวิว
                </h1>
                <p className="text-xs sm:text-sm text-charcoal-500 font-medium">
                  ดูและจัดการความคิดเห็น คะแนนความพึงพอใจ และข้อเสนอแนะจากผู้เข้าพัก
                </p>
              </div>
            </div>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => fetchReviews()}
              className="px-3.5 py-2 text-charcoal-700 bg-white hover:bg-forest-50/50 hover:border-forest-200 rounded-2xl border border-charcoal-200/80 shadow-xs transition-all text-xs font-semibold flex items-center gap-2 active:scale-95"
            >
              <RefreshCw
                size={14}
                className={
                  isFetching ? "animate-spin text-forest-700" : "text-charcoal-500"
                }
              />
              <span className="hidden sm:inline">รีเฟรช</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4 Overview Stat Cards (KPI Summary) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Average Score */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-forest-700 uppercase tracking-wider">
                คะแนนเฉลี่ย
              </p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
                {avgRating !== null ? Number(avgRating).toFixed(1) : "-"}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">
                  / 5.0
                </span>
              </p>
              <div className="mt-1.5 flex items-center gap-1.5">
                {avgRating !== null && (
                  <StarDisplay rating={Math.round(Number(avgRating))} size={13} />
                )}
                <span className="text-[11px] text-charcoal-400 font-medium">
                  ความพึงพอใจรวม
                </span>
              </div>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-forest-50 text-forest-800 border border-forest-100 flex items-center justify-center shrink-0">
              <Star size={20} className="stroke-[2.2] fill-forest-800/20" />
            </div>
          </div>
        </div>

        {/* Card 2: Total Reviews */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-forest-700 uppercase tracking-wider">
                รีวิวทั้งหมด
              </p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
                {totalAllStars || pagination.total}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">
                  รายการ
                </span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400">
                ความคิดเห็นทั้งหมดที่ได้รับ
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-forest-50 text-forest-800 border border-forest-100 flex items-center justify-center shrink-0">
              <MessageSquare size={20} className="stroke-[2.2]" />
            </div>
          </div>
        </div>

        {/* Card 3: 5-Star Reviews */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-forest-700 uppercase tracking-wider">
                รีวิว 5 ดาว
              </p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
                {globalRatingTotals[5] || 0}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">
                  รายการ
                </span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400 font-medium">
                {totalAllStars > 0
                  ? `คิดเป็น ${Math.round(
                      ((globalRatingTotals[5] || 0) / totalAllStars) * 100,
                    )}% ของรีวิวทั้งหมด`
                  : "ยังไม่มีรีวิว 5 ดาว"}
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-forest-50 text-forest-800 border border-forest-100 flex items-center justify-center shrink-0">
              <Sparkles size={20} className="stroke-[2.2]" />
            </div>
          </div>
        </div>

        {/* Card 4: Feedback / Attention (1-3 Stars) */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-bamboo-800 uppercase tracking-wider">
                ข้อเสนอแนะ (1-3 ดาว)
              </p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight">
                {attentionReviewsCount}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">
                  รายการ
                </span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400 font-medium">
                {attentionReviewsCount > 0
                  ? "ความคิดเห็นที่ควรนำไปพัฒนาบริการ"
                  : "ไม่มีรีวิวคะแนนต่ำในขณะนี้"}
              </p>
            </div>
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border ${
                attentionReviewsCount > 0
                  ? "bg-bamboo-50 border-bamboo-200 text-bamboo-800"
                  : "bg-cream-100 border-cream-200 text-charcoal-400"
              }`}
            >
              <AlertCircle size={20} className="stroke-[2.2]" />
            </div>
          </div>
        </div>
      </div>

      {/* Unified Search, Filter Pills & Pagination Control Bar */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-panel border border-cream-200/90 space-y-3.5">
        {/* Row 1: Star Rating Filter Pills (กดกรองระดับดาวได้ทันที) */}
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-cream-100 pb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-charcoal-500 mr-1 flex items-center gap-1">
              <Star size={13} className="text-bamboo-500 fill-bamboo-400" />
              <span>ระดับดาว:</span>
            </span>

            {/* Pill: All */}
            <button
              onClick={() => {
                setStarFilter("all");
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5 ${
                starFilter === "all"
                  ? "bg-forest-800 text-white shadow-xs"
                  : "bg-cream-100/90 text-charcoal-700 hover:bg-cream-200/80 border border-cream-200/70"
              }`}
            >
              <span>ทั้งหมด</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  starFilter === "all"
                    ? "bg-forest-700 text-white"
                    : "bg-white text-charcoal-500"
                }`}
              >
                {totalAllStars || pagination.total}
              </span>
            </button>

            {/* Pills: 5 to 1 Star */}
            {[5, 4, 3, 2, 1].map((s) => {
              const count = globalRatingTotals[s] || 0;
              const isActive = starFilter === String(s);
              return (
                <button
                  key={s}
                  onClick={() => {
                    setStarFilter(String(s));
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5 ${
                    isActive
                      ? "bg-forest-800 text-white shadow-xs"
                      : "bg-cream-100/90 text-charcoal-700 hover:bg-cream-200/80 border border-cream-200/70"
                  }`}
                >
                  <Star
                    size={11}
                    className={
                      isActive
                        ? "fill-bamboo-300 text-bamboo-300"
                        : "fill-bamboo-400 text-bamboo-500"
                    }
                  />
                  <span>{s} ดาว</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive
                        ? "bg-forest-700 text-white"
                        : "bg-white text-charcoal-500"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active filter clear action */}
          {(searchInput || filterRoomType || starFilter !== "all") && (
            <button
              onClick={() => {
                setSearchInput("");
                setDebouncedSearch("");
                setFilterRoomType("");
                setStarFilter("all");
                setCurrentPage(1);
              }}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 hover:underline ml-auto"
            >
              <X size={13} />
              <span>ล้างตัวกรอง</span>
            </button>
          )}
        </div>

        {/* Row 2: Search input, Room Select & Rows Per Page */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input with Debounce */}
          <div className="relative flex-1 max-w-md">
            <Search
              size={15}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อผู้รีวิว, อีเมล, ชื่อห้อง, หรือข้อความ..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full bg-cream-50/70 hover:bg-cream-50 focus:bg-white pl-9 pr-9 py-2 rounded-xl border border-charcoal-200/60 focus:outline-none focus:ring-2 focus:ring-forest-500/20 text-xs font-medium text-charcoal-800 placeholder:text-charcoal-400 transition-all"
            />
            {searchInput && (
              <button
                onClick={() => {
                  setSearchInput("");
                  setDebouncedSearch("");
                  setCurrentPage(1);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-600 p-0.5 rounded-full hover:bg-charcoal-100 transition-colors"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Filters & Page Size Controls */}
          <div className="flex items-center gap-2.5 self-end md:self-auto flex-wrap">
            {/* Room Filter Dropdown */}
            <div className="w-44 sm:w-48">
              <CustomSelect
                options={roomTypeOptions}
                value={filterRoomType}
                onChange={(val) => {
                  setFilterRoomType(val);
                  setCurrentPage(1);
                }}
                placeholder="เลือกห้องพัก..."
              />
            </div>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 bg-cream-50/80 px-2.5 py-1.5 rounded-xl border border-charcoal-200/60 text-xs font-medium text-charcoal-700">
              <SlidersHorizontal size={13} className="text-charcoal-400" />
              <span className="hidden sm:inline text-charcoal-500">แสดง:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-transparent font-semibold text-forest-900 focus:outline-none cursor-pointer pr-1"
              >
                <option value={5}>5 แถว</option>
                <option value={10}>10 แถว</option>
                <option value={20}>20 แถว</option>
                <option value={50}>50 แถว</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Reviews List Section */}
      <div className="bg-white rounded-3xl shadow-panel border border-cream-200/90 overflow-hidden relative">
        {/* Loading overlay during background fetch */}
        {isFetching && !initialLoading && (
          <div className="absolute inset-0 bg-white/40 backdrop-blur-[0.5px] z-10 flex items-center justify-center transition-all">
            <div className="bg-white/90 border border-cream-200 px-3.5 py-2 rounded-2xl shadow-panel flex items-center gap-2 text-xs font-semibold text-forest-900">
              <RefreshCw size={14} className="animate-spin text-forest-700" />
              <span>กำลังอัปเดตข้อมูล...</span>
            </div>
          </div>
        )}

        {/* List Header */}
        <div className="px-5 py-4 border-b border-cream-200 bg-cream-50/40 flex items-center justify-between">
          <h2 className="font-display font-bold text-base sm:text-lg text-forest-900 flex items-center gap-2">
            <span>รายการความคิดเห็นจากผู้เข้าพัก</span>
            <span className="text-xs font-normal text-charcoal-400 font-sans">
              (แสดง {reviews.length} จากทั้งหมด {pagination.total} รายการ)
            </span>
          </h2>
        </div>

        {/* Reviews List */}
        <div className="divide-y divide-cream-100">
          {initialLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse bg-cream-50/70 rounded-2xl border border-cream-100"
                />
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="p-16 text-center">
              <div className="w-14 h-14 mx-auto rounded-3xl bg-cream-100 text-charcoal-400 flex items-center justify-center border border-cream-200 mb-3">
                <MessageSquare size={26} className="stroke-[1.7]" />
              </div>
              <h3 className="font-display font-semibold text-charcoal-800 text-base">
                ไม่พบรีวิวในเงื่อนไขที่เลือก
              </h3>
              <p className="text-xs text-charcoal-400 mt-1 max-w-sm mx-auto">
                ลองปรับเปลี่ยนคำค้นหาหรือเลือกระดับดาวด้านบนเพื่อดูความคิดเห็นรายการอื่น
              </p>
            </div>
          ) : (
            reviews.map((r) => (
              <div
                key={r.review_id}
                className="p-5 sm:p-6 hover:bg-cream-50/40 transition-colors"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Reviewer Profile & Stay Information */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    {r.image_profile ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveMediaUrl(r.image_profile)}
                        alt={r.first_name}
                        className="w-11 h-11 rounded-2xl object-cover shrink-0 border border-cream-200 shadow-xs"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-2xl bg-forest-100 text-forest-800 border border-forest-200/70 flex items-center justify-center shrink-0 font-display font-bold text-sm shadow-xs">
                        {r.first_name?.[0] || <User size={18} />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-charcoal-900 text-sm">
                          {r.first_name} {r.last_name}
                        </p>
                        <span className="text-[11px] text-charcoal-400">
                          ({r.email})
                        </span>
                      </div>

                      {/* Stay dates and review date */}
                      <div className="flex items-center gap-3 mt-1 text-xs text-charcoal-500 flex-wrap">
                        {r.check_in && (
                          <div className="flex items-center gap-1">
                            <Calendar size={12} className="text-charcoal-400" />
                            <span>
                              เข้าพัก: {formatThaiDateShort(r.check_in)} –{" "}
                              {formatThaiDateShort(r.check_out)}
                            </span>
                          </div>
                        )}
                        <span className="text-charcoal-300">•</span>
                        <span>
                          รีวิวเมื่อ {formatThaiDateLong(r.review_date)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Room Tag & Rating Stars */}
                  <div className="flex items-start sm:items-end flex-col shrink-0 gap-1.5">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-cream-100/90 border border-cream-200/80 text-forest-900 font-semibold text-xs">
                      <BedDouble size={13} className="text-forest-700" />
                      <span>{r.room_name}</span>
                      <span className="text-charcoal-400 font-normal">
                        ({r.type_name})
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <StarDisplay rating={Number(r.rating)} size={14} />
                      <span className="text-xs font-bold text-charcoal-800">
                        {Number(r.rating).toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Review Comment Box */}
                {r.comment && (
                  <div className="mt-3.5 bg-cream-50/60 border border-cream-200/70 rounded-2xl p-3.5 sm:p-4 text-xs sm:text-sm text-charcoal-800 leading-relaxed">
                    <p className="whitespace-pre-line italic">
                      "{r.comment}"
                    </p>
                  </div>
                )}

                {/* Review Footer & Delete Action */}
                <div className="mt-3.5 flex items-center justify-end">
                  <button
                    onClick={() => setDeleteTargetId(r.review_id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 px-3 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>ลบรีวิวนี้</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Enhanced Full Table Pagination Bar (การแบ่งหน้าตาราง) */}
        <div className="px-5 py-4 bg-cream-50/50 border-t border-cream-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-charcoal-600">
          <div className="flex items-center gap-2">
            <span>
              แสดงรายการที่{" "}
              <strong className="text-forest-900 font-semibold">
                {pagination.total > 0 ? (currentPage - 1) * pageSize + 1 : 0}
              </strong>{" "}
              -{" "}
              <strong className="text-forest-900 font-semibold">
                {Math.min(currentPage * pageSize, pagination.total)}
              </strong>{" "}
              จากทั้งหมด{" "}
              <strong className="text-forest-900 font-semibold">
                {pagination.total}
              </strong>{" "}
              รายการ
            </span>
          </div>

          {/* Numbered Page Buttons & Navigation */}
          <div className="flex items-center gap-1 flex-wrap">
            {/* Prev Button */}
            <button
              type="button"
              className="px-3 py-1.5 text-charcoal-700 bg-white hover:bg-forest-50/50 hover:border-forest-200 rounded-xl border border-charcoal-200/80 shadow-2xs transition-all font-semibold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              disabled={isFetching || currentPage <= 1}
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            >
              <ChevronLeft size={13} />
              <span className="hidden sm:inline">ก่อนหน้า</span>
            </button>

            {/* Page Number Buttons */}
            {pageNumbers.map((p, idx) => {
              if (p === "...") {
                return (
                  <span
                    key={`ellipsis-${idx}`}
                    className="px-2 py-1 text-charcoal-400 font-bold"
                  >
                    ...
                  </span>
                );
              }
              const pageNum = Number(p);
              const isActive = pageNum === currentPage;
              return (
                <button
                  key={`page-${pageNum}`}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`w-8 h-8 rounded-xl font-bold text-xs transition-all flex items-center justify-center ${
                    isActive
                      ? "bg-forest-800 text-white shadow-xs"
                      : "bg-white text-charcoal-700 hover:bg-cream-100 border border-charcoal-200/70"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next Button */}
            <button
              type="button"
              className="px-3 py-1.5 text-charcoal-700 bg-white hover:bg-forest-50/50 hover:border-forest-200 rounded-xl border border-charcoal-200/80 shadow-2xs transition-all font-semibold flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              disabled={isFetching || currentPage >= pagination.totalPages}
              onClick={() =>
                setCurrentPage((page) =>
                  Math.min(pagination.totalPages, page + 1),
                )
              }
            >
              <span className="hidden sm:inline">ถัดไป</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteTargetId !== null}
        title="ยืนยันการลบรีวิว"
        onClose={() => setDeleteTargetId(null)}
        footer={
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTargetId(null)}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-charcoal-700 hover:bg-cream-100 rounded-xl border border-cream-200 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-panel transition-all disabled:opacity-50 cursor-pointer active:scale-95"
            >
              <Trash2 size={14} />
              <span>{isDeleting ? "กำลังลบ..." : "ยืนยันการลบ"}</span>
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-xs sm:text-sm text-charcoal-600 leading-relaxed">
            คุณแน่ใจหรือไม่ว่าต้องการลบความคิดเห็นนี้ออกจากระบบ? เมื่อลบแล้วจะไม่สามารถกู้คืนข้อมูลได้
          </p>
        </div>
      </Modal>
    </div>
  );
}
