"use client";

import React, { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast from "react-hot-toast";
import Link from "next/link";

export default function SingleRoomsPage() {
  const { ready } = useAuthGuard({ allowedRoles: ["admin"] });

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

  // Form & Inline Editing
  const formRef = useRef<HTMLFormElement>(null);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [roomTypeIdInput, setRoomTypeIdInput] = useState("");
  const [roomNumberInput, setRoomNumberInput] = useState("");
  const [statusInput, setStatusInput] = useState("available");

  // States สำหรับ Auto-run แบบสร้างครั้งละหลายห้อง
  const [prefixInput, setPrefixInput] = useState("L");
  const [startNumInput, setStartNumInput] = useState(1);
  const [quantityInput, setQuantityInput] = useState(1);

  const ZONE_OPTIONS = [
    { label: "โซนติดสระ/น้ำ (L)", value: "L" },
    { label: "โซนวิวสวน/ป่า (G)", value: "G" },
  ];

  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    number: string;
  } | null>(null);

  useEffect(() => {
    if (!ready) return;
    fetchData();
  }, [ready]);

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
    setPrefixInput("L");
    setStartNumInput(1);
    setQuantityInput(1);
  };

  const handleEditClick = (sr: any) => {
    setEditingRoomId(sr.room_id);
    setRoomTypeIdInput(String(sr.room_type_id));
    setRoomNumberInput(sr.room_number);
    setStatusInput(sr.status);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    try {
      if (editingRoomId) {
        // --- 1. กรณีแก้ไขห้องเดิม ---
        const trimmedNum = roomNumberInput.trim();
        if (!trimmedNum) {
          toast.error("กรุณาระบุหมายเลขห้องพัก");
          setSubmitting(false);
          return;
        }

        // เช็คว่า "ในประเภทห้องเดียวกัน" มีเลขห้องนี้แล้วหรือยัง (ยกเว้นตัวเอง)
        const isDuplicateInType = singleRooms.some(
          (sr) =>
            String(sr.room_type_id) === String(roomTypeIdInput) &&
            sr.room_number.toLowerCase() === trimmedNum.toLowerCase() &&
            sr.room_id !== editingRoomId
        );

        if (isDuplicateInType) {
          toast.error(
            `หมายเลขห้อง "${trimmedNum}" มีอยู่แล้วในประเภทห้องพักนี้`
          );
          setSubmitting(false);
          return;
        }

        await api.put(`/rooms/single/${editingRoomId}`, {
          room_number: trimmedNum,
          status: statusInput,
        });
        toast.success("แก้ไขห้องพักสำเร็จ");
      } else {
        // --- 2. กรณีสร้างใหม่ (Auto-Run) ---
        if (!roomTypeIdInput) {
          toast.error("กรุณาเลือกประเภทห้องพัก");
          setSubmitting(false);
          return;
        }

        const prefix = prefixInput.trim();
        const startNum = Number(startNumInput) || 1;
        const qty = Number(quantityInput) || 1;

        // คำนวณรายชื่อเลขห้องทั้งหมดที่จะถูกสร้าง
        const pendingNumbers = Array.from({ length: qty }, (_, i) => {
          return `${prefix}${startNum + i}`;
        });

        // ดึงเฉพาะห้องที่อยู่ใน "ประเภทห้องเดียวกัน" มาเช็ค
        const existingNumbersInType = new Set(
          singleRooms
            .filter((sr) => String(sr.room_type_id) === String(roomTypeIdInput))
            .map((sr) => String(sr.room_number).toLowerCase())
        );

        // ค้นหาเฉพาะเลขห้องที่ซ้ำในประเภทเดียวกัน
        const duplicates = pendingNumbers.filter((num) =>
          existingNumbersInType.has(num.toLowerCase())
        );

        if (duplicates.length > 0) {
          toast.error(
            `ไม่สามารถสร้างได้ เนื่องจากมีเลขห้องซ้ำในประเภทห้องนี้: ${duplicates.join(", ")}`
          );
          setSubmitting(false);
          return;
        }

        const payload = {
          room_type_id: Number(roomTypeIdInput),
          prefix: prefix,
          start_number: startNum,
          quantity: qty,
        };

        await api.post("/rooms/single/batch", payload);
        toast.success(`สร้างห้องพักสำเร็จ ${qty} ห้อง`);
      }
      handleResetForm();
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "ทำรายการไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  // ฟังก์ชันดึง Zone และ เลขถัดไปเมื่อผู้ใช้เลือกประเภทห้อง
  const handleRoomTypeChange = async (typeId: string) => {
    setRoomTypeIdInput(typeId);
    if (!typeId) return;

    try {
      const res = await api.get(
        `/rooms/single/next-number?room_type_id=${typeId}`
      );
      if (res.data?.success) {
        setPrefixInput(res.data.data.prefix || "L");
        setStartNumInput(res.data.data.next_number || 1);
      }
    } catch (error) {
      console.error("Failed to fetch next room number:", error);
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

  // Logic กรองข้อมูลตาม Search + Status + Type
  const filteredSingleRooms = singleRooms.filter((sr) => {
    const matchesSearch = sr.room_number
      ?.toLowerCase()
      .includes(search.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ? true : sr.status === statusFilter;
    const matchesType =
      typeFilter === "all" ? true : String(sr.room_type_id) === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  if (!ready) return null;

  return (
    <div className="w-full min-h-screen flex flex-col font-sans space-y-6 pb-12 text-stone-800">
      {/* Header & Page Title */}
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

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-stone-200/60 rounded-xl overflow-x-auto text-xs w-fit border border-stone-200/80">
        <Link
          href="/admin/rooms/types"
          className="px-4 py-2 rounded-lg font-medium text-stone-600 hover:text-stone-900 transition-all whitespace-nowrap flex items-center gap-1.5"
        >
          <Layers size={14} />
          ประเภทห้องพัก
        </Link>
        <Link
          href="/admin/rooms/single"
          className="px-4 py-2 rounded-lg font-bold bg-white text-[#0b3b2c] shadow-xs transition-all whitespace-nowrap flex items-center gap-1.5"
        >
          <DoorClosed size={14} />
          จัดการรายห้อง
        </Link>
        <Link
          href="/admin/rooms/amenities"
          className="px-4 py-2 rounded-lg font-medium text-stone-600 hover:text-stone-900 transition-all whitespace-nowrap flex items-center gap-1.5"
        >
          <Sparkles size={14} />
          สิ่งอำนวยความสะดวก
        </Link>
      </div>

      {/* FORM AUTO-GENERATE (เฉพาะโหมดรันเลขอัตโนมัติ) */}
      <form
        ref={formRef}
        onSubmit={handleSubmitForm}
        className={`bg-white p-4 rounded-2xl border transition-all duration-300 space-y-3 ${
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
              : "เพิ่มห้องพักอัตโนมัติ (Auto-Run)"}
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

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* เลือกประเภทห้องพัก */}
          <div className={editingRoomId ? "md:col-span-4" : "md:col-span-3"}>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              ประเภทห้องพัก{" "}
              {!editingRoomId && <span className="text-rose-500">*</span>}
            </label>
            <select
              disabled={!!editingRoomId}
              required={!editingRoomId}
              value={roomTypeIdInput}
              onChange={(e) => handleRoomTypeChange(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0b3b2c] disabled:opacity-60 disabled:bg-stone-100"
            >
              <option value="">เลือกประเภทห้อง...</option>
              {roomTypes.map((rt: any) => {
                const typeId = rt.id || rt.room_type_id;
                return (
                  <option key={typeId} value={typeId}>
                    {rt.type_name}
                  </option>
                );
              })}
            </select>
          </div>

          {!editingRoomId ? (
            <>
              {/* โซน (Zone) - เลือกจากตัวเลือกที่มีให้ */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  โซน (Zone) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={prefixInput}
                  onChange={(e) => setPrefixInput(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0b3b2c] cursor-pointer"
                >
                  {ZONE_OPTIONS.map((zone) => (
                    <option key={zone.value} value={zone.value}>
                      {zone.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* เริ่มต้นที่ลำดับ */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  เริ่มที่ลำดับ (อัตโนมัติ)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={startNumInput}
                  onChange={(e) => setStartNumInput(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0b3b2c]"
                />
              </div>

              {/* จำนวนห้อง */}
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  จำนวนห้อง <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={quantityInput}
                  onChange={(e) => setQuantityInput(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0b3b2c]"
                />
              </div>
            </>
          ) : (
            <>
              {/* แสดงฟิลด์แก้ไขเฉพาะตอนกดแก้ไขห้องย่อย */}
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
                  สถานะ
                </label>
                <select
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0b3b2c]"
                >
                  <option value="available">ว่าง</option>
                  <option value="occupied">มีผู้เข้าพัก</option>
                  <option value="maintenance">ปิดปรับปรุง</option>
                </select>
              </div>
            </>
          )}

          {/* ปุ่ม Submit */}
          <div className={editingRoomId ? "md:col-span-2" : "md:col-span-3"}>
            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-2 px-3 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                editingRoomId
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-[#0b3b2c] hover:bg-[#07271d]"
              }`}
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : editingRoomId ? (
                <Save size={14} />
              ) : (
                <Zap size={14} />
              )}
              <span>
                {editingRoomId
                  ? "บันทึกการแก้ไข"
                  : `สร้างรันเลข (${quantityInput} ห้อง)`}
              </span>
            </button>
          </div>
        </div>
      </form>

      {/* TABLE LIST & CONTROLS BAR */}
      <div className="space-y-3">
        {/* Search Box & Filters Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-3 flex-1">
            {/* Search Input */}
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

            {/* Filter by Room Type */}
            {roomTypes.length > 0 && (
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-white border border-stone-200/80 rounded-xl text-xs font-semibold text-stone-700 focus:outline-none focus:ring-1 focus:ring-[#0b3b2c] cursor-pointer"
              >
                <option value="all">ทุกประเภทห้อง</option>
                {roomTypes.map((rt: any) => {
                  const typeId = rt.id || rt.room_type_id;
                  return (
                    <option key={typeId} value={typeId}>
                      {rt.type_name}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Status Tabs */}
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
              ว่าง ({singleRooms.filter((a) => a.status === "available").length}
              )
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

        {/* Table Container */}
        <div className="bg-white border border-stone-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 bg-stone-50/80 border-b border-stone-200/80 flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm md:text-base flex items-center gap-2">
              <DoorClosed size={16} className="text-[#0b3b2c]" />
              รายการห้องพักย่อย
            </h3>
            <span className="px-2.5 py-0.5 bg-stone-200/70 text-stone-700 rounded-full text-[11px] font-bold">
              {filteredSingleRooms.length} รายการ
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-stone-100/70 border-b border-stone-200/80 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5 w-16 text-center">ลำดับ</th>
                  <th className="px-5 py-3.5">หมายเลขห้อง</th>
                  <th className="px-4 py-3.5">ประเภทห้อง</th>
                  <th className="px-4 py-3.5">สถานะ</th>
                  <th className="px-4 py-3.5 text-center">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs text-stone-700">
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-12 text-center text-stone-400"
                    >
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#0b3b2c] border-t-transparent mb-2" />
                      <p className="text-xs font-medium text-stone-500">
                        กำลังโหลดข้อมูล...
                      </p>
                    </td>
                  </tr>
                ) : filteredSingleRooms.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-12 text-center text-stone-400"
                    >
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
                  filteredSingleRooms.map((sr: any, index: number) => (
                    <tr
                      key={sr.room_id}
                      className="hover:bg-stone-50/80 transition-colors"
                    >
                      <td className="px-5 py-3.5 text-center font-bold text-stone-400">
                        {index + 1}.
                      </td>
                      <td className="px-5 py-3.5 font-bold text-stone-900">
                        {sr.room_number}
                      </td>
                      <td className="px-4 py-3.5 text-stone-600">
                        {sr.type_name}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            sr.status === "available"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                              : sr.status === "occupied"
                                ? "bg-amber-50 text-amber-700 border border-amber-200/60"
                                : sr.status === "maintenance"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                                  : "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {sr.status === "available"
                            ? "ว่าง"
                            : sr.status === "occupied"
                              ? "มีผู้เข้าพัก"
                              : sr.status === "maintenance"
                                ? "ปิดปรับปรุง"
                                : sr.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEditClick(sr)}
                            className="p-1.5 text-stone-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                            title="แก้ไข"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteTarget({
                                id: sr.room_id,
                                number: sr.room_number,
                              })
                            }
                            className="p-1.5 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                            title="ลบ"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL DELETE CONFIRMATION */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center space-y-4 shadow-2xl border border-stone-100">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                ยืนยันการลบห้องพัก
              </h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                คุณแน่ใจหรือไม่ที่จะลบห้อง "{deleteTarget.number}"? <br />
                การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold w-full cursor-pointer transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold w-full cursor-pointer transition-colors shadow-md"
              >
                ยืนยันการลบ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}