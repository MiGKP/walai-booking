"use client";

import { useState, useEffect, useRef } from "react";
import {
  Star,
  Trash2,
  Search,
  Filter,
  MessageSquare,
  AlertTriangle,
  X,
  ChevronDown,
} from "lucide-react";
import api from "@/lib/api";
import { resolveMediaUrl } from "@/lib/avatar";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { PageHeader, Panel, Modal, EmptyState } from "@/components/admin/ui";

// Component Custom Dropdown สไตล์เดียวกับไฟล์ตัวอย่าง
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
        <div className="absolute right-0 top-full mt-1.5 w-full min-w-[180px] bg-white border border-stone-200 rounded-xl shadow-lg z-50 overflow-hidden py-1 max-h-56 overflow-y-auto animate-in fade-in duration-150">
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

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          size={14}
          className={
            s <= rating
              ? "fill-yellow-400 text-yellow-400"
              : "text-gray-200 fill-gray-200"
          }
        />
      ))}
    </div>
  );
}

export default function AdminReviewsPage() {
  const { ready } = useAuthGuard({ allowedRoles: ["admin", "room_staff"] });
  const [reviews, setReviews] = useState<any[]>([]);
  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterRoomType, setFilterRoomType] = useState("");
  const [filterRating, setFilterRating] = useState("");
  const [avgRating, setAvgRating] = useState<number | null>(null);

  // State สำหรับ Popup ยืนยันการลบ
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Options สำหรับ Dropdown กรองคะแนน
  const RATING_OPTIONS = [
    { value: "", label: "คะแนนทั้งหมด" },
    { value: "5", label: "5 ดาว" },
    { value: "4", label: "4 ดาวขึ้นไป" },
    { value: "3", label: "3 ดาวขึ้นไป" },
    { value: "2", label: "2 ดาวขึ้นไป" },
    { value: "1", label: "1 ดาวขึ้นไป" },
  ];

  useEffect(() => {
    if (!ready) return;
    fetchRoomTypes();
    fetchReviews();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    fetchReviews();
  }, [filterRoomType, filterRating]);

  const fetchRoomTypes = async () => {
    try {
      const res = await api.get("/rooms");
      setRoomTypes(res.data?.data || []);
    } catch (error) {
      console.error("Failed to fetch room types", error);
    }
  };

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filterRoomType) params.room_type_id = filterRoomType;
      if (filterRating) params.min_rating = filterRating;
      const res = await api.get("/reviews/admin/all", { params });
      setReviews(res.data?.data || []);
      setAvgRating(res.data?.avg_rating ?? null);
    } catch {
      notify.error("ไม่สามารถโหลดรีวิวได้");
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/reviews/admin/${deleteTargetId}`);
      notify.success("ลบรีวิวสำเร็จ");
      setReviews((prev) => prev.filter((r) => r.review_id !== deleteTargetId));
      setDeleteTargetId(null);
    } catch {
      notify.error("ลบรีวิวไม่สำเร็จ");
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = reviews.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.first_name + " " + r.last_name).toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.room_name?.toLowerCase().includes(q) ||
      r.comment?.toLowerCase().includes(q)
    );
  });

  const ratingCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => Number(r.rating) === star).length,
  }));

  const roomTypeOptions = [
    { value: "", label: "ห้องพักทั้งหมด" },
    ...roomTypes.map((rt: any) => ({
      value: rt.id,
      label: `${rt.room_name} — ${rt.type_name}`,
    })),
  ];

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="จัดการรีวิว"
        description="ดูแลและจัดการรีวิวสำหรับการจองห้องพัก"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Filter size={15} className="text-gray-400 shrink-0 mr-1" />
            <CustomSelect
              options={roomTypeOptions}
              value={filterRoomType}
              onChange={(val) => setFilterRoomType(val)}
              width="w-40 sm:w-48"
            />
            <CustomSelect
              options={RATING_OPTIONS}
              value={filterRating}
              onChange={(val) => setFilterRating(val)}
              width="w-32 sm:w-40"
            />
          </div>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Panel className="col-span-2 md:col-span-1 flex flex-col items-center justify-center text-center">
          <p className="text-4xl font-display font-semibold text-yellow-500">
            {avgRating ?? "-"}
          </p>
          {avgRating && <div className="mt-1"><StarDisplay rating={Math.round(avgRating)} /></div>}
          <p className="text-xs text-charcoal-400 mt-2">คะแนนเฉลี่ย</p>
        </Panel>
        <Panel className="flex flex-col items-center justify-center text-center">
          <p className="text-3xl font-display font-semibold text-forest-600">{reviews.length}</p>
          <p className="text-xs text-charcoal-500 mt-2">รีวิวทั้งหมด</p>
        </Panel>
        <Panel className="col-span-2 flex flex-col justify-center gap-2">
          {ratingCounts.map(({ star, count }) => (
            <div key={star} className="flex items-center gap-2">
              <span className="text-xs text-charcoal-500 w-4 text-right">
                {star}
              </span>
              <Star
                size={11}
                className="fill-yellow-400 text-yellow-400 flex-shrink-0"
              />
              <div className="flex-1 h-1.5 bg-charcoal-50 rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-400 rounded-full transition-all"
                  style={{
                    width:
                      reviews.length > 0
                        ? `${Math.round((count / reviews.length) * 100)}%`
                        : "0%",
                  }}
                />
              </div>
              <span className="text-xs text-charcoal-400 w-5 text-right">
                {count}
              </span>
            </div>
          ))}
        </Panel>
      </div>

      <Panel className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-charcoal-100 flex flex-wrap gap-3 items-center bg-cream-50/50">
          <div className="relative flex-1 min-w-48">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-400"
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อ, อีเมล, ห้อง, ความคิดเห็น..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-charcoal-200 rounded-xl focus:outline-none focus:border-forest-400 transition-colors bg-white"
            />
          </div>
          <span className="text-xs text-charcoal-400 font-medium">
            พบ {filtered.length} รายการ
          </span>
        </div>

        <div className="divide-y divide-charcoal-50">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse bg-charcoal-50 rounded-xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <EmptyState
                title="ไม่มีรีวิว"
                description="ไม่พบรีวิวในขณะนี้"
              />
            </div>
          ) : (
            filtered.map((r: any) => (
              <div key={r.review_id} className="p-5 hover:bg-cream-50/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  {/* Reviewer Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    {r.image_profile ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveMediaUrl(r.image_profile)}
                        alt={r.first_name}
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-charcoal-100"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-forest-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-forest-700">
                          {r.first_name?.[0]}
                          {r.last_name?.[0]}
                        </span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-medium text-charcoal-900 text-sm">
                        {r.first_name} {r.last_name}
                      </p>
                      <p className="text-xs text-charcoal-400">{r.email}</p>
                    </div>
                  </div>

                  {/* Room + Rating */}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-medium text-charcoal-700">
                      {r.room_name}
                    </p>
                    <p className="text-xs text-charcoal-400">{r.type_name}</p>
                    <div className="flex justify-end mt-1">
                      <StarDisplay rating={Number(r.rating)} />
                    </div>
                  </div>
                </div>

                {/* Comment */}
                {r.comment && (
                  <p className="mt-3 text-sm text-charcoal-700 bg-white rounded-xl border border-charcoal-100 px-4 py-3 leading-relaxed shadow-sm">
                    "{r.comment}"
                  </p>
                )}

                {/* Footer */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-charcoal-400">
                    <span>
                      เข้าพัก{" "}
                      {r.check_in
                        ? new Date(r.check_in).toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "short",
                            year: "2-digit",
                          })
                        : "-"}{" "}
                      –{" "}
                      {r.check_out
                        ? new Date(r.check_out).toLocaleDateString("th-TH", {
                            day: "numeric",
                            month: "short",
                            year: "2-digit",
                          })
                        : "-"}
                    </span>
                    <span>
                      รีวิวเมื่อ{" "}
                      {new Date(r.review_date).toLocaleDateString("th-TH", {
                        day: "numeric",
                        month: "short",
                        year: "2-digit",
                      })}
                    </span>
                  </div>
                  <button
                    onClick={() => setDeleteTargetId(r.review_id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-rose-500 hover:text-rose-700 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 size={14} /> ลบ
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Modal
        open={deleteTargetId !== null}
        title="ยืนยันการลบรีวิว"
        onClose={() => setDeleteTargetId(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteTargetId(null)}
              className="px-4 py-2 text-sm font-medium text-charcoal-600 hover:bg-charcoal-50 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-all disabled:opacity-50 cursor-pointer"
            >
              {isDeleting ? "กำลังลบ..." : "ลบรีวิว"}
            </button>
          </>
        }
      >
        <p className="text-sm text-charcoal-600 leading-relaxed">
          คุณแน่ใจหรือไม่ว่าต้องการลบรีวิวนี้? การดำเนินการนี้ไม่สามารถย้อนกลับได้
        </p>
      </Modal>
    </div>
  );
}

