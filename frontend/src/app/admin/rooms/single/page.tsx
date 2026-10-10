"use client";

import React, { useState, useEffect, useRef, useMemo, Suspense } from "react";
import {
  DoorClosed,
  Edit2,
  Trash2,
  Loader2,
  Search,
  Save,
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
  ChevronsLeft,
  ChevronsRight,
  Plus,
  Minus,
  X,
  RotateCcw,
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { useSearchParams } from "next/navigation";
import { Modal, EmptyState } from "@/components/admin/ui";

interface DraftRoom {
  room_number: string;
  room_type_id: number;
}

// Custom Dropdown Component (ดีไซน์ละมุนสไตล์ Walai)
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

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
        className="w-full flex items-center justify-between gap-2 px-3.5 py-2 bg-cream-50/80 hover:bg-white border border-cream-300 hover:border-forest-300 rounded-2xl text-xs font-semibold text-charcoal-700 transition-all focus:outline-none focus:ring-2 focus:ring-forest-500/20 shadow-xs cursor-pointer"
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown
          size={14}
          className={`text-charcoal-400 shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-forest-800" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-full min-w-[180px] bg-white border border-cream-200/90 rounded-2xl shadow-xl z-50 overflow-hidden py-1 max-h-56 overflow-y-auto animate-in fade-in duration-150">
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
                    ? "bg-forest-50 text-forest-900 font-bold"
                    : "text-charcoal-600 hover:bg-cream-100 hover:text-charcoal-900 font-medium"
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-forest-800 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SingleRoomsPageContent() {
  const { ready } = useAuthGuard({ allowedRoles: ["admin", "room_staff"] });
  const searchParams = useSearchParams();
  const typeIdFromQuery = searchParams.get("type_id");
  const appliedQueryTypeRef = useRef<string | null>(null);

  const [roomTypes, setRoomTypes] = useState<any[]>([]);
  const [singleRooms, setSingleRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // States สำหรับ ค้นหา และ กรองข้อมูล
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "occupied" | "maintenance">("all");
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
      notify.error("ไม่สามารถโหลดข้อมูลได้");
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

  const fetchNextNumber = async (
    typeId: string,
    prefixOverride?: string,
  ): Promise<void> => {
    if (!typeId) {
      if (prefixOverride === undefined) setCurrentPrefix("");
      return;
    }
    try {
      const url =
        prefixOverride !== undefined
          ? `/rooms/single/next-number?room_type_id=${typeId}&prefix=${encodeURIComponent(prefixOverride)}`
          : `/rooms/single/next-number?room_type_id=${typeId}`;
      const res = await api.get(url);
      if (res.data?.success && res.data?.data) {
        setStartNumInput(res.data.data.next_number);
        if (prefixOverride === undefined) {
          setCurrentPrefix(res.data.data.prefix || "");
        }
      }
    } catch {
      // Fallback
    }
  };

  const handleRoomTypeChange = async (typeId: string): Promise<void> => {
    setRoomTypeIdInput(typeId);
    if (!editingRoomId) {
      await fetchNextNumber(typeId);
    }
  };

  const handlePrefixBlur = async (): Promise<void> => {
    if (!editingRoomId && roomTypeIdInput) {
      await fetchNextNumber(roomTypeIdInput, currentPrefix);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, ready, typeIdFromQuery, roomTypes]);

  const handleGenerateDrafts = () => {
    if (!roomTypeIdInput) {
      notify.error("กรุณาเลือกประเภทห้องหลัก");
      return;
    }

    const startNum = Number(startNumInput) || 1;
    const qty = Number(quantityInput) || 1;

    const pendingNumbers = Array.from(
      { length: qty },
      (_, i) => `${currentPrefix}${startNum + i}`,
    );

    const existingNumbers = new Set(
      singleRooms.map((sr) => String(sr.room_number).toLowerCase()),
    );

    const duplicates = pendingNumbers.filter((num) =>
      existingNumbers.has(num.toLowerCase()),
    );

    if (duplicates.length > 0) {
      notify.error(`มีหมายเลขห้องซ้ำในระบบ: ${duplicates.join(", ")}`);
      return;
    }

    const generatedDrafts: DraftRoom[] = pendingNumbers.map((num) => ({
      room_number: num,
      room_type_id: Number(roomTypeIdInput),
    }));

    setDraftRooms(generatedDrafts);
    notify.success(`สร้างผังห้องพักตัวอย่างสำเร็จ ${qty} ห้อง`);
  };

  const handleUpdateDraftType = (roomNumber: string, newTypeId: number) => {
    setDraftRooms((prev) =>
      prev.map((item) =>
        item.room_number === roomNumber ? { ...item, room_type_id: newTypeId } : item,
      ),
    );
  };

  const handleSaveBatchDrafts = async () => {
    if (draftRooms.length === 0) return;

    setSubmitting(true);
    try {
      await api.post("/rooms/single/batch", { rooms: draftRooms });
      notify.success(`บันทึกห้องพักทั้งหมด ${draftRooms.length} ห้อง สำเร็จ`);
      handleResetForm();
      fetchData();
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "บันทึกไม่สำเร็จ"));
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
          notify.error("กรุณาระบุหมายเลขห้องพัก");
          setSubmitting(false);
          return;
        }

        if (!roomTypeIdInput) {
          notify.error("กรุณาเลือกประเภทห้องพัก");
          setSubmitting(false);
          return;
        }

        const isDuplicate = singleRooms.some(
          (sr) =>
            sr.room_number.toLowerCase() === trimmedNum.toLowerCase() &&
            sr.room_id !== editingRoomId,
        );

        if (isDuplicate) {
          notify.error(`หมายเลขห้อง "${trimmedNum}" มีอยู่ในระบบแล้ว`);
          setSubmitting(false);
          return;
        }

        await api.put(`/rooms/single/${editingRoomId}`, {
          room_number: trimmedNum,
          room_type_id: Number(roomTypeIdInput),
          status: statusInput,
        });
        notify.success("แก้ไขห้องพักสำเร็จ");
        handleResetForm();
        fetchData();
      } catch (err: unknown) {
        notify.error(getApiErrorMessage(err, "ทำรายการไม่สำเร็จ"));
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
      notify.success("ลบห้องพักสำเร็จ");
      setDeleteTarget(null);
      fetchData();
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "ลบไม่สำเร็จ"));
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

  const filteredAndSortedRooms = useMemo(() => {
    return singleRooms
      .filter((sr) => {
        const matchesSearch = sr.room_number?.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === "all" ? true : sr.status === statusFilter;
        const typeIdStr = String(sr.room_type_id || sr.type_id || sr.room_type?.id || "");
        const matchesType = typeFilter === "all" ? true : typeIdStr === typeFilter;
        return matchesSearch && matchesStatus && matchesType;
      })
      .sort((a, b) => {
        const valA = a[sortColumn] || "";
        const valB = b[sortColumn] || "";

        const res = String(valA).localeCompare(String(valB), undefined, {
          numeric: true,
          sensitivity: "base",
        });

        return sortDirection === "asc" ? res : -res;
      });
  }, [singleRooms, search, statusFilter, typeFilter, sortColumn, sortDirection]);

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
    <div className="w-full min-h-screen flex flex-col font-sans space-y-6 pb-16 max-w-[1600px] mx-auto text-charcoal-800">
      {/* Top Header Card (Heading 1 Without Subtitle) */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 relative print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-800/10 shrink-0">
              <DoorClosed size={20} className="stroke-[2.2]" />
            </span>
            <h1 className="font-display text-2xl lg:text-3xl font-bold text-forest-900 tracking-tight">
              จัดการห้องพัก (รายห้อง)
            </h1>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <div className="px-3.5 py-2 bg-cream-50/80 rounded-2xl border border-cream-300 shadow-xs flex items-center gap-2.5">
              <span className="text-xs font-semibold text-charcoal-500">ห้องพักทั้งหมด:</span>
              <span className="text-xs font-bold text-forest-900 font-mono">
                {singleRooms.length} ห้อง
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Form Auto-generate & Editing */}
      <form
        ref={formRef}
        onSubmit={handleSubmitForm}
        className={`bg-white p-5 sm:p-6 rounded-3xl border transition-all duration-300 space-y-4 shadow-panel ${
          editingRoomId
            ? "border-amber-400 ring-2 ring-amber-400/20"
            : "border-cream-200/90"
        }`}
      >
        <div className="flex items-center justify-between border-b border-cream-200 pb-3">
          <span className="text-xs font-bold text-forest-900 flex items-center gap-2">
            {editingRoomId ? (
              <Edit2 size={16} className="text-amber-600" />
            ) : (
              <Zap size={16} className="text-forest-700" />
            )}
            <span className="font-display text-sm font-bold">
              {editingRoomId
                ? "แก้ไขข้อมูลห้องพัก"
                : "สร้างผังห้องพักอัจฉริยะ (Hybrid Smart Mapping)"}
            </span>
          </span>

          {editingRoomId ? (
            <button
              type="button"
              onClick={handleResetForm}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
            >
              ยกเลิกการแก้ไข
            </button>
          ) : (
            (roomTypeIdInput || currentPrefix || draftRooms.length > 0) && (
              <button
                type="button"
                onClick={handleResetForm}
                className="text-xs font-bold text-charcoal-500 hover:text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded-xl border border-cream-300 hover:border-rose-200 transition-all flex items-center gap-1 cursor-pointer"
                title="ล้างค่าทั้งหมดที่กรอกไว้ในส่วนนี้"
              >
                <RotateCcw size={12} />
                <span>ล้างการเลือกทั้งหมด</span>
              </button>
            )
          )}
        </div>

        {!editingRoomId && (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-forest-200 bg-forest-50/80 px-3.5 py-2 text-xs text-forest-900">
            {currentPrefix ? (
              <>
                <span className="font-bold">โซน {currentPrefix}</span>
                <span className="text-forest-300">·</span>
                <span className="font-semibold font-mono">
                  เลขถัดไป {currentPrefix}
                  {startNumInput === "" ? 1 : startNumInput}
                </span>
                <span className="text-xs font-normal text-charcoal-500">
                  (ต่อจากเลขเดิมในโซนนี้)
                </span>
              </>
            ) : (
              <>
                <span className="font-bold">ห้องตัวเลขล้วน (ไม่มี Prefix)</span>
                <span className="text-forest-300">·</span>
                <span className="font-semibold font-mono">
                  เลขถัดไป {startNumInput === "" ? 1 : startNumInput}
                </span>
                <span className="text-xs font-normal text-charcoal-500">
                  (สามารถพิมพ์ระบุ Prefix เช่น W, C ได้เอง)
                </span>
              </>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
          <div className={editingRoomId ? "md:col-span-4" : "md:col-span-3"}>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-charcoal-700">
                {editingRoomId ? "ประเภทห้องพัก" : "ประเภทห้องหลัก (Default)"}{" "}
                <span className="text-rose-500">*</span>
              </label>
              {roomTypeIdInput && (
                <button
                  type="button"
                  onClick={handleResetForm}
                  className="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                  title="ล้างค่าที่เลือกและรีเซ็ตฟอร์ม"
                >
                  <RotateCcw size={11} />
                  <span>ล้างการเลือก</span>
                </button>
              )}
            </div>
            <CustomSelect
              options={roomTypeFormOptions}
              value={roomTypeIdInput}
              onChange={(val) => handleRoomTypeChange(String(val))}
              placeholder="เลือกประเภทห้องพัก..."
            />
          </div>

          {!editingRoomId ? (
            <>
              {/* ช่องระบุหรือแก้ไขตัวอักษรนำหน้า (Prefix) */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-charcoal-700 mb-1.5 flex items-center justify-between">
                  <span>ตัวอักษรนำหน้า</span>
                  <span className="text-[10px] font-normal text-charcoal-400">ระบุเองได้</span>
                </label>
                <input
                  type="text"
                  placeholder="เช่น W, C, A"
                  value={currentPrefix}
                  onChange={(e) => setCurrentPrefix(e.target.value.toUpperCase())}
                  onBlur={handlePrefixBlur}
                  className="w-full px-3.5 py-2 bg-cream-50/80 focus:bg-white border border-cream-300 focus:border-forest-300 rounded-2xl text-xs font-bold text-charcoal-800 uppercase focus:outline-none focus:ring-2 focus:ring-forest-500/20"
                />
              </div>

              {/* เริ่มที่ห้องหมายเลข */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
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
                  className="w-full px-3.5 py-2 bg-cream-50/80 focus:bg-white border border-cream-300 focus:border-forest-300 rounded-2xl text-xs font-medium text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-500/20"
                />
              </div>

              {/* ช่องจำนวนห้องพร้อมปุ่ม +/- */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                  จำนวนห้อง <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      const current = Number(quantityInput) || 1;
                      if (current > 1) setQuantityInput(current - 1);
                    }}
                    className="p-2 bg-cream-100 hover:bg-cream-200 border border-r-0 border-cream-300 rounded-l-2xl text-charcoal-600 transition-colors cursor-pointer"
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
                    className="w-full text-center py-2 bg-cream-50/80 border-y border-cream-300 text-xs font-bold text-charcoal-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-500/20"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const current = Number(quantityInput) || 0;
                      if (current < 100) setQuantityInput(current + 1);
                    }}
                    className="p-2 bg-cream-100 hover:bg-cream-200 border border-l-0 border-cream-300 rounded-r-2xl text-charcoal-600 transition-colors cursor-pointer"
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
                <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                  หมายเลขห้องพัก <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={roomNumberInput}
                  onChange={(e) => setRoomNumberInput(e.target.value)}
                  className="w-full px-3.5 py-2 bg-cream-50/80 focus:bg-white border border-cream-300 focus:border-forest-300 rounded-2xl text-xs font-medium text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-forest-500/20"
                />
              </div>

              <div className="md:col-span-3">
                <label className="block text-xs font-bold text-charcoal-700 mb-1.5">
                  สถานะการใช้งาน
                </label>

                {statusInput === "occupied" ? (
                  <div className="px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-bold text-amber-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    มีผู้เข้าพักอยู่ (ล็อกสถานะ)
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setStatusInput((prev) =>
                        prev === "available" ? "maintenance" : "available",
                      )
                    }
                    className={`w-full px-3.5 py-2 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${
                      statusInput === "available"
                        ? "bg-forest-50/80 border-forest-200 text-forest-800 hover:bg-forest-100/70"
                        : "bg-rose-50/80 border-rose-200 text-rose-800 hover:bg-rose-100/70"
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          statusInput === "available" ? "bg-forest-500" : "bg-rose-500"
                        }`}
                      />
                      {statusInput === "available" ? "พร้อมใช้งาน (ว่าง)" : "ปิดปรับปรุง"}
                    </span>

                    {statusInput === "available" ? (
                      <ToggleRight size={22} className="text-forest-600" />
                    ) : (
                      <ToggleLeft size={22} className="text-rose-500" />
                    )}
                  </button>
                )}
              </div>
            </>
          )}

          <div className={!editingRoomId ? "md:col-span-3 flex items-center gap-2" : "md:col-span-2 flex items-center gap-2"}>
            {!editingRoomId ? (
              <>
                <button
                  type="button"
                  onClick={handleGenerateDrafts}
                  className="flex-1 py-2.5 px-3.5 bg-forest-800 hover:bg-forest-900 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                >
                  <LayoutGrid size={14} />
                  <span>สร้างผังตัวอย่าง</span>
                </button>
                {(roomTypeIdInput || currentPrefix || draftRooms.length > 0) && (
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="p-2.5 bg-cream-100 hover:bg-cream-200 text-charcoal-600 hover:text-rose-600 border border-cream-300 rounded-2xl transition-all cursor-pointer"
                    title="ล้างข้อมูลที่เลือกทั้งหมด"
                  >
                    <RotateCcw size={15} />
                  </button>
                )}
              </>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-3.5 bg-forest-800 hover:bg-forest-900 text-white rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 shadow-xs active:scale-95"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                <span>บันทึกการแก้ไข</span>
              </button>
            )}
          </div>
        </div>

        {/* Visual Preview & Mapping Grid */}
        {draftRooms.length > 0 && !editingRoomId && (
          <div className="mt-4 pt-4 border-t border-cream-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-forest-900 flex items-center gap-1.5">
                  <CheckCircle2 size={15} className="text-forest-700" />
                  พรีวิวผังห้องพัก ({draftRooms.length} ห้อง)
                </h4>
                <p className="text-xs text-charcoal-400 mt-0.5">
                  ระบบตั้งค่าประเภทหลักให้อัตโนมัติ สามารถเปลี่ยนประเภทเฉพาะบางห้องได้ทันที
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDraftRooms([])}
                  className="px-3.5 py-1.5 text-xs font-semibold text-charcoal-600 hover:text-charcoal-900 hover:bg-cream-100 border border-cream-300 rounded-xl transition-all"
                >
                  ล้างผังตัวอย่าง
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSaveBatchDrafts}
                  className="px-4 py-1.5 bg-forest-800 hover:bg-forest-900 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs disabled:opacity-60 cursor-pointer active:scale-95"
                >
                  {submitting ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  <span>บันทึกห้องพักทั้งหมด</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-72 overflow-y-auto p-2 bg-cream-50/60 rounded-2xl border border-cream-200">
              {draftRooms.map((draft) => (
                <div
                  key={draft.room_number}
                  className="p-3 bg-white border border-cream-200/90 rounded-2xl shadow-2xs flex flex-col gap-1.5 hover:border-forest-300 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-forest-900 font-mono">
                      {draft.room_number}
                    </span>
                    <span className="w-2 h-2 rounded-full bg-forest-500" />
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

      {/* Single-Row Filter & Controls Bar */}
      <div className="bg-white p-3.5 sm:p-4 rounded-3xl shadow-panel border border-cream-200/90 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Search & Type Filter */}
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
            {/* Search Input */}
            <div className="relative flex-1 sm:max-w-xs min-w-[180px]">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400 pointer-events-none"
              />
              <input
                type="text"
                placeholder="ค้นหาหมายเลขห้อง..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-cream-50/70 hover:bg-cream-50 focus:bg-white pl-10 pr-8 py-2 rounded-2xl border border-cream-300 focus:outline-none focus:ring-2 focus:ring-forest-500/20 text-xs font-medium text-charcoal-800 placeholder:text-charcoal-400 transition-all"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-600 p-0.5 rounded-full"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Room Type Dropdown */}
            {roomTypes.length > 0 && (
              <div className="flex items-center gap-1.5 bg-cream-50/80 pl-3 pr-1.5 py-1.5 rounded-2xl border border-cream-300 text-xs text-charcoal-700">
                <span className="font-medium text-charcoal-500 whitespace-nowrap">ประเภท:</span>
                <CustomSelect
                  options={typeFilterOptions}
                  value={typeFilter}
                  onChange={(val) => setTypeFilter(String(val))}
                  width="w-36 sm:w-44"
                />
                {typeFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setTypeFilter("all")}
                    className="p-1 text-charcoal-400 hover:text-rose-600 hover:bg-cream-200/60 rounded-lg transition-colors cursor-pointer"
                    title="ล้างตัวกรองประเภทห้อง"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Status Filter Tabs & Reset Button */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <div className="flex items-center gap-1 bg-cream-100 p-1 rounded-2xl overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(
                [
                  ["all", "ทั้งหมด", singleRooms.length],
                  ["available", "ว่าง", singleRooms.filter((a) => a.status === "available").length],
                  ["occupied", "มีผู้เข้าพัก", singleRooms.filter((a) => a.status === "occupied").length],
                  ["maintenance", "ปิดปรับปรุง", singleRooms.filter((a) => a.status === "maintenance").length],
                ] as const
              ).map(([val, label, count]) => {
                const active = statusFilter === val;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setStatusFilter(val as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                      active
                        ? "bg-white text-forest-900 shadow-sm font-bold"
                        : "text-charcoal-600 hover:text-charcoal-900 hover:bg-cream-200/60"
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        active ? "bg-forest-800 text-white" : "bg-cream-200 text-charcoal-700"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {(search || statusFilter !== "all" || typeFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setTypeFilter("all");
                }}
                className="flex items-center gap-1 text-xs text-charcoal-600 hover:text-charcoal-900 bg-cream-100 hover:bg-cream-200 px-3 py-2 rounded-2xl border border-cream-300/80 font-semibold transition-colors"
                title="ล้างตัวกรองทั้งหมด"
              >
                <RotateCcw size={13} />
                <span>รีเซ็ต</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Panel (Fixed consistent height with min-h-[660px]) */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/90 overflow-hidden flex flex-col min-h-[660px]">
        <div className="pb-4 mb-4 border-b border-cream-200/80 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-forest-800" />
            <h2 className="text-base font-bold text-forest-900">
              รายการห้องพักย่อยทั้งหมด
            </h2>
            <span className="px-2.5 py-0.5 bg-forest-50 text-forest-800 border border-forest-200 rounded-full text-xs font-bold font-mono">
              {filteredAndSortedRooms.length} รายการ
            </span>
          </div>
        </div>

        <div className="overflow-x-auto border border-cream-200/90 rounded-2xl shadow-2xs">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead className="bg-cream-50/80 border-b border-cream-200 text-charcoal-600 font-bold text-xs uppercase tracking-wider select-none shadow-2xs">
              <tr>
                <th className="px-5 py-3.5 w-16 text-center bg-cream-50/90">ลำดับ</th>

                <th
                  onClick={() => handleSort("room_number")}
                  className="px-5 py-3.5 cursor-pointer hover:bg-cream-100/70 transition-colors bg-cream-50/90 whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>หมายเลขห้อง</span>
                    {sortColumn === "room_number" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp size={13} className="text-forest-800" />
                      ) : (
                        <ArrowDown size={13} className="text-forest-800" />
                      )
                    ) : (
                      <ArrowUpDown size={13} className="text-charcoal-400 opacity-60" />
                    )}
                  </div>
                </th>

                <th
                  onClick={() => handleSort("type_name")}
                  className="px-4 py-3.5 cursor-pointer hover:bg-cream-100/70 transition-colors bg-cream-50/90 whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>ประเภทห้อง</span>
                    {sortColumn === "type_name" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp size={13} className="text-forest-800" />
                      ) : (
                        <ArrowDown size={13} className="text-forest-800" />
                      )
                    ) : (
                      <ArrowUpDown size={13} className="text-charcoal-400 opacity-60" />
                    )}
                  </div>
                </th>

                <th
                  onClick={() => handleSort("status")}
                  className="px-4 py-3.5 cursor-pointer hover:bg-cream-100/70 transition-colors bg-cream-50/90 whitespace-nowrap"
                >
                  <div className="flex items-center gap-1.5">
                    <span>สถานะ</span>
                    {sortColumn === "status" ? (
                      sortDirection === "asc" ? (
                        <ArrowUp size={13} className="text-forest-800" />
                      ) : (
                        <ArrowDown size={13} className="text-forest-800" />
                      )
                    ) : (
                      <ArrowUpDown size={13} className="text-charcoal-400 opacity-60" />
                    )}
                  </div>
                </th>

                <th className="px-5 py-3.5 text-center bg-cream-50/90 whitespace-nowrap">การจัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100 bg-white text-xs text-charcoal-700">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-charcoal-400">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="h-6 w-6 animate-spin text-forest-700" />
                      <p className="text-xs font-medium text-charcoal-500">กำลังโหลดข้อมูลห้องพัก...</p>
                    </div>
                  </td>
                </tr>
              ) : displayedRooms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12">
                    <EmptyState title="ไม่พบข้อมูลห้องพัก" />
                  </td>
                </tr>
              ) : (
                displayedRooms.map((sr: any, index: number) => (
                  <tr key={sr.room_id} className="hover:bg-cream-50/60 border-b border-cream-100/80 last:border-0 transition-colors">
                    <td className="px-5 py-3.5 text-center font-semibold text-charcoal-400 font-mono">
                      {startIndex + index + 1}.
                    </td>
                    <td className="px-5 py-3.5 font-bold text-forest-900 font-mono text-sm">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-cream-100 text-forest-900 border border-cream-200/80 font-bold">
                        {sr.room_number}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-charcoal-800 font-semibold">
                      {sr.type_name}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      {sr.status === "available" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border bg-forest-50 text-forest-800 border-forest-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-forest-500" />
                          พร้อมใช้งาน
                        </span>
                      ) : sr.status === "occupied" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border bg-amber-50 text-amber-800 border-amber-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          มีผู้เข้าพัก
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border bg-rose-50 text-rose-700 border-rose-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          ปิดปรับปรุง
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditClick(sr)}
                          className="p-1.5 text-charcoal-600 hover:text-forest-900 bg-cream-100/80 hover:bg-cream-200/80 border border-cream-200 rounded-xl transition-colors cursor-pointer"
                          title="แก้ไข"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setDeleteTarget({
                              id: sr.room_id,
                              number: sr.room_number,
                            })
                          }
                          className="p-1.5 text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 rounded-xl transition-colors cursor-pointer"
                          title="ลบ"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-auto border-t border-cream-200 text-xs text-charcoal-500">
            <span>
              แสดง{" "}
              <strong className="text-forest-950 font-mono">
                {totalItems > 0 ? startIndex + 1 : 0}
              </strong>{" "}
              ถึง{" "}
              <strong className="text-forest-950 font-mono">{endIndex}</strong> จาก{" "}
              <strong className="text-forest-950 font-mono">{totalItems}</strong> รายการ
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
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
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
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                className="p-1.5 bg-white border border-cream-300 rounded-xl text-charcoal-600 hover:bg-cream-100 disabled:opacity-40 transition-all cursor-pointer disabled:cursor-not-allowed shadow-2xs"
                title="หน้าถัดไป"
              >
                <ChevronRight size={14} />
              </button>
              <button
                type="button"
                disabled={currentPage === totalPages}
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

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        title="ยืนยันการลบห้องพัก"
        onClose={() => setDeleteTarget(null)}
        widthClass="max-w-sm"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="flex-1 px-4 py-2 text-xs font-semibold text-charcoal-700 bg-cream-100 hover:bg-cream-200 border border-cream-300 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              className="flex-1 inline-flex items-center justify-center gap-1 bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer active:scale-95"
            >
              ลบห้องพัก
            </button>
          </div>
        }
      >
        <p className="text-sm text-charcoal-600 leading-relaxed">
          คุณแน่ใจหรือไม่ว่าต้องการลบห้องพักหมายเลข{" "}
          <span className="font-bold text-forest-950 font-mono">
            "{deleteTarget?.number}"
          </span>
          ? การดำเนินการนี้ไม่สามารถย้อนกลับได้
        </p>
      </Modal>
    </div>
  );
}

export default function SingleRoomsPage(): React.ReactElement {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-forest-700" />
        </div>
      }
    >
      <SingleRoomsPageContent />
    </Suspense>
  );
}
