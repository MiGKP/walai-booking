"use client";

import React, { useState, useEffect, useRef, Suspense } from "react";
import {
  DoorClosed,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  Search,
  Save,
  Layers,
  Sparkles,
  Home,
  Zap,
  CheckCircle2,
  LayoutGrid,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast from "react-hot-toast";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface DraftRoom {
  room_number: string;
  room_type_id: number;
}

// Custom Dropdown Component
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
    (opt) => String(opt.value) === String(value)
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
        className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 transition-all focus:outline-none focus:ring-1 focus:ring-[#0b3b2c] shadow-2xs cursor-pointer"
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          className={`text-stone-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-[#0b3b2c]" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[180px] bg-white border border-stone-200 rounded-xl shadow-lg z-50 overflow-hidden py-1 max-h-56 overflow-y-auto animate-in fade-in duration-150">
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
                className={`w-full text-left px-3.5 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                  isSelected
                    ? "bg-emerald-50 text-emerald-900 font-bold"
                    : "text-stone-600 hover:bg-stone-100/80 hover:text-stone-900 font-medium"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0b3b2c] shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SingleRoomsPageContent() {
  const { ready } = useAuthGuard({ allowedRoles: ["admin"] });
  const searchParams = useSearchParams();
  const typeIdFromQuery = searchParams.get("type_id");
  const appliedQueryTypeRef = useRef<string | null>(null);

  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [singleRooms, setSingleRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // States สำหรับ ค้นหา และ กรองข้อมูล
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "available" | "occupied" | "maintenance"
  >("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // States สำหรับ Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage, setItemsPerPage] = useState<number>(10);

  // States สำหรับการ Sorting
  const [sortColumn, setSortColumn] = useState<"room_number" | "type_name" | "status">("room_number");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Form & Inline Editing
  const formRef = useRef<HTMLFormElement>(null);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [roomTypeIdInput, setRoomTypeIdInput] = useState("");
  const [roomNumberInput, setRoomNumberInput] = useState("");
  const [statusInput, setStatusInput] = useState("available");

  // States สำหรับ Auto-run & Smart Mapping
  const [startNumInput, setStartNumInput] = useState<number | "">(1);
  const [quantityInput, setQuantityInput] = useState<number | "">(1);
  const [currentPrefix, setCurrentPrefix] = useState<string>("");
  const [draftRooms, setDraftRooms] = useState<DraftRoom[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    number: string;
  } | null>(null);

  useEffect(() => {
    if (!ready) return;
    fetchData();
  }, [ready]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, typeFilter, itemsPerPage]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rtRes, srRes] = await Promise.all([
        api.get("/rooms"),
        api.get("/rooms/single/all"),
      ]);
      setRoomTypes(rtRes.data?.data || []);
      setSingleRooms(srRes.data?.data || []);
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setEditingRoomId(null);
    setRoomTypeIdInput("");
    setRoomNumberInput("");
    setStatusInput("available");
    setStartNumInput(1);
    setQuantityInput(1);
    setCurrentPrefix("");
    setDraftRooms([]);
  };

  const handleEditClick = (sr: any) => {
    setEditingRoomId(sr.room_id);
    const selectedTypeId = String(sr.room_type_id || sr.type_id || sr.room_type?.id || "");
    setRoomTypeIdInput(selectedTypeId);
    setRoomNumberInput(sr.room_number);
    setStatusInput(sr.status);
    setDraftRooms([]);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleRoomTypeChange = async (typeId: string): Promise<void> => {
    setRoomTypeIdInput(typeId);
    if (!editingRoomId) {
      if (!typeId) {
        setCurrentPrefix("");
        return;
      }
      try {
        const res = await api.get(
          `/rooms/single/next-number?room_type_id=${typeId}`,
        );
        if (res.data?.success && res.data?.data) {
          setStartNumInput(res.data.data.next_number);
          setCurrentPrefix(res.data.data.prefix || "");
        }
      } catch {
        // Fallback
      }
    }
  };

  // จากหน้าประเภท: ?type_id= → เลือกประเภท + ฟิลเตอร์ + ดึงโซน/เลขถัดไป
  useEffect(() => {
    if (loading || !ready || !typeIdFromQuery) return;
    if (appliedQueryTypeRef.current === typeIdFromQuery) return;

    const exists = roomTypes.some(
      (rt) => String(rt.id || rt.room_type_id) === String(typeIdFromQuery),
    );
    if (!exists) return;

    appliedQueryTypeRef.current = typeIdFromQuery;
    setTypeFilter(String(typeIdFromQuery));
    void handleRoomTypeChange(String(typeIdFromQuery));
    // Query apply on entry only; intentional omit of handleRoomTypeChange from deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, ready, typeIdFromQuery, roomTypes]);

  const handleGenerateDrafts = () => {
    if (!roomTypeIdInput) {
      toast.error("กรุณาเลือกประเภทห้องหลัก");
      return;
    }

    const startNum = Number(startNumInput) || 1;
    const qty = Number(quantityInput) || 1;

    const pendingNumbers = Array.from(
      { length: qty },
      (_, i) => `${currentPrefix}${startNum + i}`
    );

    const existingNumbers = new Set(
      singleRooms.map((sr) => String(sr.room_number).toLowerCase())
    );

    const duplicates = pendingNumbers.filter((num) =>
      existingNumbers.has(num.toLowerCase())
    );

    if (duplicates.length > 0) {
      toast.error(`มีหมายเลขห้องซ้ำในระบบ: ${duplicates.join(", ")}`);
      return;
    }

    const generatedDrafts: DraftRoom[] = pendingNumbers.map((num) => ({
      room_number: num,
      room_type_id: Number(roomTypeIdInput),
    }));

    setDraftRooms(generatedDrafts);
    toast.success(`สร้างผังห้องพักตัวอย่างสำเร็จ ${qty} ห้อง`);
  };

  const handleUpdateDraftType = (roomNumber: string, newTypeId: number) => {
    setDraftRooms((prev) =>
      prev.map((item) =>
        item.room_number === roomNumber
          ? { ...item, room_type_id: newTypeId }
          : item
      )
    );
  };

  const handleSaveBatchDrafts = async () => {
    if (draftRooms.length === 0) return;

    setSubmitting(true);
    try {
      await api.post("/rooms/single/batch", { rooms: draftRooms });
      toast.success(`บันทึกห้องพักทั้งหมด ${draftRooms.length} ห้อง สำเร็จ`);
      handleResetForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "บันทึกไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingRoomId) {
      setSubmitting(true);
      try {
        const trimmedNum = roomNumberInput.trim();
        if (!trimmedNum) {
          toast.error("กรุณาระบุหมายเลขห้องพัก");
          setSubmitting(false);
          return;
        }

        if (!roomTypeIdInput) {
          toast.error("กรุณาเลือกประเภทห้องพัก");
          setSubmitting(false);
          return;
        }

        const isDuplicate = singleRooms.some(
          (sr) =>
            sr.room_number.toLowerCase() === trimmedNum.toLowerCase() &&
            sr.room_id !== editingRoomId,
        );

        if (isDuplicate) {
          toast.error(`หมายเลขห้อง "${trimmedNum}" มีอยู่ในระบบแล้ว`);
          setSubmitting(false);
          return;
        }

        await api.put(`/rooms/single/${editingRoomId}`, {
          room_number: trimmedNum,
          room_type_id: Number(roomTypeIdInput),
          status: statusInput,
        });
        toast.success("แก้ไขห้องพักสำเร็จ");
        handleResetForm();
        fetchData();
      } catch (err: any) {
        toast.error(err.response?.data?.message || "ทำรายการไม่สำเร็จ");
      } finally {
        setSubmitting(false);
      }
    } else {
      handleGenerateDrafts();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/rooms/single/${deleteTarget.id}`);
      toast.success("ลบห้องพักสำเร็จ");
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "ลบไม่สำเร็จ");
    }
  };

  const handleSort = (column: "room_number" | "type_name" | "status") => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const filteredAndSortedRooms = singleRooms
    .filter((sr) => {
      const matchesSearch = sr.room_number
        ?.toLowerCase()
        .includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ? true : sr.status === statusFilter;
      const typeIdStr = String(sr.room_type_id || sr.type_id || sr.room_type?.id || "");
      const matchesType =
        typeFilter === "all" ? true : typeIdStr === typeFilter;
      return matchesSearch && matchesStatus && matchesType;
    })
    .sort((a, b) => {
      let valA = a[sortColumn] || "";
      let valB = b[sortColumn] || "";

      const res = String(valA).localeCompare(String(valB), undefined, {
        numeric: true,
        sensitivity: "base",
      });

      return sortDirection === "asc" ? res : -res;
    });

  const totalItems = filteredAndSortedRooms.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const displayedRooms = filteredAndSortedRooms.slice(startIndex, endIndex);

  const roomTypeFormOptions = [
    { value: "", label: "เลือกประเภทห้องพัก..." },
    ...roomTypes.map((rt: any) => ({
      value: String(rt.id || rt.room_type_id || ""),
      label: rt.type_name,
    })),
  ];

  const typeFilterOptions = [
    { value: "all", label: "ทุกประเภทห้อง" },
    ...roomTypes.map((rt: any) => ({
      value: String(rt.id || rt.room_type_id || ""),
      label: rt.type_name,
    })),
  ];

  const itemsPerPageOptions = [
    { value: 10, label: "10 รายการ / หน้า" },
    { value: 20, label: "20 รายการ / หน้า" },
    { value: 50, label: "50 รายการ / หน้า" },
  ];

  if (!ready) return null;

  return (
    <div className="w-full min-h-screen flex flex-col font-sans space-y-6 pb-12 text-stone-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-stone-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0b3b2c]/10 text-[#0b3b2c] rounded-xl">
              <DoorClosed size={20} />
            </span>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-[#0b3b2c] tracking-tight">
              จัดการห้องพัก (รายห้อง)
            </h1>
          </div>
          <p className="text-stone-500 mt-1 text-xs md:text-sm">
            เพิ่มและแก้ไขหมายเลขห้องพักรายห้องในระบบสวนวลัยรุกขเวช
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-white rounded-xl border border-stone-200/80 shadow-xs flex items-center gap-3 w-fit">
            <div className="w-8 h-8 rounded-lg bg-[#0b3b2c]/10 flex items-center justify-center text-[#0b3b2c]">
              <Home size={18} />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-stone-400 block leading-tight">
                จำนวนห้องพักทั้งหมด
              </span>
              <span className="text-xs font-bold text-[#0b3b2c]">
                {singleRooms.length} ห้อง
              </span>
            </div>
          </div>
        </div>
      </div>



      {/* FORM AUTO-GENERATE & EDITING */}
      <form
        ref={formRef}
        onSubmit={handleSubmitForm}
        className={`bg-white p-4 rounded-2xl border transition-all duration-300 space-y-4 ${
          editingRoomId
            ? "border-amber-400 ring-2 ring-amber-400/20 shadow-md"
            : "border-stone-200/80 shadow-xs"
        }`}
      >
        <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
          <span className="text-xs font-bold text-[#0b3b2c] flex items-center gap-1.5">
            {editingRoomId ? (
              <Edit2 size={16} className="text-amber-600" />
            ) : (
              <Zap size={16} className="text-[#0b3b2c]" />
            )}
            {editingRoomId
              ? "แก้ไขข้อมูลห้องพัก"
              : "สร้างผังห้องพักอัจฉริยะ (Hybrid Smart Mapping)"}
          </span>

          {editingRoomId && (
            <button
              type="button"
              onClick={handleResetForm}
              className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
            >
              ยกเลิกการแก้ไข
            </button>
          )}
        </div>

        {!editingRoomId && currentPrefix && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50/80 px-3 py-2 text-xs text-[#0b3b2c]">
            <span className="font-bold">โซน {currentPrefix}</span>
            <span className="text-stone-400">·</span>
            <span className="font-semibold tabular-nums">
              เลขถัดไป {currentPrefix}
              {startNumInput === "" ? 1 : startNumInput}
            </span>
            <span className="text-[11px] font-normal text-stone-500">
              (ต่อจากเลขเดิมในโซนนี้)
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className={editingRoomId ? "md:col-span-3" : "md:col-span-4"}>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              {editingRoomId ? "ประเภทห้องพัก" : "ประเภทห้องหลัก (Default)"}{" "}
              <span className="text-rose-500">*</span>
            </label>
            <CustomSelect
              options={roomTypeFormOptions}
              value={roomTypeIdInput}
              onChange={(val) => handleRoomTypeChange(String(val))}
              placeholder="เลือกประเภทห้องพัก..."
            />
          </div>

          {!editingRoomId ? (
            <>
              {/* เริ่มที่ห้องหมายเลข */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  เริ่มที่ห้องหมายเลข
                </label>
                <input
                  type="text"
                  required
                  value={startNumInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setStartNumInput("");
                    } else {
                      const parsed = parseInt(val, 10);
                      setStartNumInput(isNaN(parsed) ? "" : parsed);
                    }
                  }}
                  onBlur={() => {
                    if (startNumInput === "" || Number(startNumInput) < 1) {
                      setStartNumInput(1);
                    }
                  }}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0b3b2c]"
                />
              </div>

              {/* ช่องจำนวนห้องพร้อมปุ่ม +/- */}
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  จำนวนห้อง <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const current = Number(quantityInput) || 1;
                      if (current > 1) setQuantityInput(current - 1);
                    }}
                    className="p-2 bg-stone-100 hover:bg-stone-200 border border-r-0 border-stone-200 rounded-l-xl text-stone-600 transition-colors cursor-pointer"
                    title="ลดจำนวน"
                  >
                    <Minus size={14} />
                  </button>

                  <input
                    type="text"
                    required
                    value={quantityInput}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        setQuantityInput("");
                      } else {
                        const parsed = parseInt(val, 10);
                        if (!isNaN(parsed)) {
                          setQuantityInput(Math.min(100, Math.max(1, parsed)));
                        }
                      }
                    }}
                    onBlur={() => {
                      if (quantityInput === "" || Number(quantityInput) < 1) {
                        setQuantityInput(1);
                      }
                    }}
                    className="w-full text-center py-2 bg-stone-50 border-y border-stone-200 text-xs font-bold text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0b3b2c]"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const current = Number(quantityInput) || 0;
                      if (current < 100) setQuantityInput(current + 1);
                    }}
                    className="p-2 bg-stone-100 hover:bg-stone-200 border border-l-0 border-stone-200 rounded-r-xl text-stone-600 transition-colors cursor-pointer"
                    title="เพิ่มจำนวน"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  หมายเลขห้องพัก <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={roomNumberInput}
                  onChange={(e) => setRoomNumberInput(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0b3b2c]"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  สถานะการใช้งาน
                </label>
                
                {statusInput === "occupied" ? (
                  <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    มีผู้เข้าพักอยู่ (ล็อกสถานะ)
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setStatusInput((prev) =>
                        prev === "available" ? "maintenance" : "available"
                      )
                    }
                    className={`w-full px-3 py-1.5 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                      statusInput === "available"
                        ? "bg-emerald-50/80 border-emerald-300 text-emerald-800 hover:bg-emerald-100/70"
                        : "bg-rose-50/80 border-rose-300 text-rose-800 hover:bg-rose-100/70"
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          statusInput === "available"
                            ? "bg-emerald-500"
                            : "bg-rose-500"
                        }`}
                      />
                      {statusInput === "available" ? "พร้อมใช้งาน (ว่าง)" : "ปิดปรับปรุง"}
                    </span>

                    {statusInput === "available" ? (
                      <ToggleRight size={22} className="text-emerald-600" />
                    ) : (
                      <ToggleLeft size={22} className="text-rose-500" />
                    )}
                  </button>
                )}
              </div>
            </>
          )}

          <div className="md:col-span-2 flex items-center gap-2">
            {!editingRoomId ? (
              <button
                type="button"
                onClick={handleGenerateDrafts}
                className="w-full py-2 px-3 bg-stone-800 hover:bg-stone-900 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LayoutGrid size={14} />
                <span>สร้างผังตัวอย่าง</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>บันทึกการแก้ไข</span>
              </button>
            )}
          </div>
        </div>

        {/* VISUAL PREVIEW & MAPPING GRID */}
        {draftRooms.length > 0 && !editingRoomId && (
          <div className="mt-4 pt-4 border-t border-stone-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-[#0b3b2c] flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-emerald-600" />
                  พรีวิวผังห้องพัก ({draftRooms.length} ห้อง)
                </h4>
                <p className="text-[11px] text-stone-500">
                  ระบบตั้งค่าประเภทหลักให้อัตโนมัติ สามารถกดเปลี่ยนประเภทเฉพาะบางห้องได้ทันที
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraftRooms([])}
                  className="px-3 py-1.5 text-[11px] font-bold text-stone-600 hover:bg-stone-100 border border-stone-200 rounded-lg transition-all"
                >
                  ล้างผังตัวอย่าง
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveBatchDrafts}
                  className="px-4 py-1.5 bg-[#0b3b2c] hover:bg-[#07271d] text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>บันทึกห้องพักทั้งหมด</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-72 overflow-y-auto p-1 bg-stone-50/70 rounded-xl border border-stone-200/60">
              {draftRooms.map((draft) => (
                <div
                  key={draft.room_number}
                  className="p-2.5 bg-white border border-stone-200/80 rounded-xl shadow-2xs flex flex-col gap-1.5 hover:border-[#0b3b2c]/40 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-[#0b3b2c]">
                      {draft.room_number}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  </div>

                  <CustomSelect
                    options={roomTypes.map((rt: any) => ({
                      value: Number(rt.id || rt.room_type_id || 0),
                      label: rt.type_name,
                    }))}
                    value={draft.room_type_id}
                    onChange={(newVal) =>
                      handleUpdateDraftType(draft.room_number, Number(newVal))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </form>

      {/* TABLE LIST & CONTROLS BAR */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-3 flex-1">
            <div className="relative w-full sm:flex-1">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
              />
              <input
                type="text"
                placeholder="ค้นหาหมายเลขห้อง..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200/80 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0b3b2c]"
              />
            </div>

            {roomTypes.length > 0 && (
              <CustomSelect
                options={typeFilterOptions}
                value={typeFilter}
                onChange={(val) => setTypeFilter(String(val))}
                width="w-full sm:w-52"
              />
            )}
          </div>

          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl border border-stone-200/80 overflow-x-auto text-xs shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === "all"
                  ? "bg-white text-stone-800 shadow-xs"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              ทั้งหมด ({singleRooms.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("available")}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === "available"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              ว่าง ({singleRooms.filter((a) => a.status === "available").length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("occupied")}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === "occupied"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-amber-700 hover:bg-amber-50"
              }`}
            >
              มีผู้เข้าพัก (
              {singleRooms.filter((a) => a.status === "occupied").length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("maintenance")}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                statusFilter === "maintenance"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-rose-700 hover:bg-rose-50"
              }`}
            >
              ปิดปรับปรุง (
              {singleRooms.filter((a) => a.status === "maintenance").length})
            </button>
          </div>
        </div>

        {/* Table Container พร้อม Scrollable & Sticky Header */}
        <div className="bg-white border border-stone-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 bg-stone-50/80 border-b border-stone-200/80 flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm md:text-base flex items-center gap-2">
              <DoorClosed size={16} className="text-[#0b3b2c]" />
              รายการห้องพักย่อย
            </h3>
            <span className="px-2.5 py-0.5 bg-stone-200/70 text-stone-700 rounded-full text-[11px] font-bold">
              {filteredAndSortedRooms.length} รายการ
            </span>
          </div>

          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-stone-100 border-b border-stone-200/80 text-[11px] font-bold text-stone-500 uppercase tracking-wider select-none sticky top-0 z-10 shadow-2xs">
                <tr>
                  <th className="px-5 py-3.5 w-16 text-center bg-stone-100">ลำดับ</th>
                  
                  <th 
                    onClick={() => handleSort("room_number")}
                    className="px-5 py-3.5 cursor-pointer hover:bg-stone-200/50 transition-colors bg-stone-100"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>หมายเลขห้อง</span>
                      {sortColumn === "room_number" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp size={13} className="text-[#0b3b2c]" />
                        ) : (
                          <ArrowDown size={13} className="text-[#0b3b2c]" />
                        )
                      ) : (
                        <ArrowUpDown size={13} className="text-stone-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  <th 
                    onClick={() => handleSort("type_name")}
                    className="px-4 py-3.5 cursor-pointer hover:bg-stone-200/50 transition-colors bg-stone-100"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>ประเภทห้อง</span>
                      {sortColumn === "type_name" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp size={13} className="text-[#0b3b2c]" />
                        ) : (
                          <ArrowDown size={13} className="text-[#0b3b2c]" />
                        )
                      ) : (
                        <ArrowUpDown size={13} className="text-stone-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  <th 
                    onClick={() => handleSort("status")}
                    className="px-4 py-3.5 cursor-pointer hover:bg-stone-200/50 transition-colors bg-stone-100"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>สถานะ</span>
                      {sortColumn === "status" ? (
                        sortDirection === "asc" ? (
                          <ArrowUp size={13} className="text-[#0b3b2c]" />
                        ) : (
                          <ArrowDown size={13} className="text-[#0b3b2c]" />
                        )
                      ) : (
                        <ArrowUpDown size={13} className="text-stone-400 opacity-60" />
                      )}
                    </div>
                  </th>

                  <th className="px-4 py-3.5 text-center bg-stone-100">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs text-stone-700">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-stone-400">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#0b3b2c] border-t-transparent mb-2" />
                      <p className="text-xs font-medium text-stone-500">
                        กำลังโหลดข้อมูล...
                      </p>
                    </td>
                  </tr>
                ) : displayedRooms.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-stone-400">
                      <DoorClosed
                        size={36}
                        className="mx-auto mb-2 text-stone-300 stroke-[1.5]"
                      />
                      <p className="text-sm font-semibold text-stone-600">
                        ไม่พบข้อมูลห้องพัก
                      </p>
                    </td>
                  </tr>
                ) : (
                  displayedRooms.map((sr: any, index: number) => (
                    <tr
                      key={sr.room_id}
                      className="hover:bg-stone-50/80 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-center font-bold text-stone-400">
                        {startIndex + index + 1}.
                      </td>
                      <td className="px-5 py-3.5 font-bold text-stone-900">
                        {sr.room_number}
                      </td>
                      <td className="px-4 py-3.5 text-stone-600 font-medium">
                        {sr.type_name}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            sr.status === "available"
                              ? "bg-emerald-100 text-emerald-800"
                              : sr.status === "occupied"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {sr.status === "available"
                            ? "ว่าง"
                            : sr.status === "occupied"
                            ? "มีผู้เข้าพัก"
                            : "ปิดปรับปรุง"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditClick(sr)}
                            className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title="แก้ไข"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                id: sr.room_id,
                                number: sr.room_number,
                              })
                            }
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="ลบ"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* BAR แสดง PAGINATION CONTROL */}
          {totalItems > 0 && (
            <div className="p-3.5 bg-stone-50/80 border-t border-stone-200/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600">
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <span className="font-medium">
                  แสดง <span className="font-bold text-stone-800">{totalItems > 0 ? startIndex + 1 : 0}</span> ถึง{" "}
                  <span className="font-bold text-stone-800">{endIndex}</span> จาก{" "}
                  <span className="font-bold text-stone-800">{totalItems}</span> รายการ
                </span>

                <CustomSelect
                  options={itemsPerPageOptions}
                  value={itemsPerPage}
                  onChange={(val) => setItemsPerPage(Number(val))}
                  width="w-36"
                />
              </div>

              {/* ปุ่มเปลี่ยนหน้า */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  className="p-1.5 bg-white border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-white transition-all cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft size={16} />
                </button>

                <div className="px-3 py-1 font-bold text-stone-700 text-xs">
                  หน้า {currentPage} / {totalPages}
                </div>

                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  className="p-1.5 bg-white border border-stone-200 rounded-lg text-stone-600 hover:bg-stone-100 disabled:opacity-40 disabled:hover:bg-white transition-all cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                  title="หน้าถัดไป"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pop-up ยืนยันการลบ */}
      {deleteTarget && (
        <div
          className="fixed inset-0 bg-stone-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4 transition-all animate-in fade-in duration-150"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-stone-100 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-stone-800">
                ยืนยันการลบห้องพัก
              </h3>
              <p className="text-xs text-stone-500 leading-relaxed">
                คุณแน่ใจหรือไม่ว่าต้องการลบห้องพักหมายเลข{" "}
                <span className="font-bold text-stone-800">
                  "{deleteTarget.number}"
                </span>
                ? การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="inline-flex items-center gap-1 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              >
                ลบห้องพัก
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SingleRoomsPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#0b3b2c]" />
        </div>
      }
    >
      <SingleRoomsPageContent />
    </Suspense>
  );
}