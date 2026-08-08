"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  Search,
  ToggleLeft,
  ToggleRight,
  Save,
  Layers,
  DoorClosed,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";

export interface Amenity {
  id: number;
  name: string;
  status: boolean;
}

export default function AmenitiesPage() {
  const { ready } = useAuthGuard({ allowedRoles: ["admin"] });

  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const formRef = useRef<HTMLFormElement>(null);
  const [editingAmenityId, setEditingAmenityId] = useState<number | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [statusInput, setStatusInput] = useState(true);

  const [deleteTarget, setDeleteTarget] = useState<Amenity | null>(null);

  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");

  useEffect(() => {
    if (!ready) return;
    fetchAmenities();
  }, [ready]);

  const fetchAmenities = async () => {
    setLoading(true);
    try {
      const res = await api.get("/rooms/amenities/all");
      setAmenities(res.data?.data || []);
    } catch {
      toast.error("ไม่สามารถโหลดข้อมูลสิ่งอำนวยความสะดวกได้");
    } finally {
      setLoading(false);
    }
  };

  const handleResetForm = () => {
    setEditingAmenityId(null);
    setNameInput("");
    setStatusInput(true);
  };

  const handleEditClick = (item: Amenity) => {
    setEditingAmenityId(item.id);
    setNameInput(item.name);
    setStatusInput(item.status);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) {
      toast.error("กรุณากรอกชื่อสิ่งอำนวยความสะดวก");
      return;
    }

    setSubmitting(true);
    try {
      if (editingAmenityId) {
        await api.put(`/rooms/amenity/${editingAmenityId}`, {
          name: nameInput.trim(),
          status: statusInput,
        });
        toast.success("อัปเดตสิ่งอำนวยความสะดวกเรียบร้อย");
      } else {
        await api.post("/rooms/amenity", {
          name: nameInput.trim(),
          status: statusInput,
        });
        toast.success("เพิ่มสิ่งอำนวยความสะดวกสำเร็จ");
      }
      handleResetForm();
      fetchAmenities();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "ทำรายการไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: Amenity) => {
    try {
      // 1. คำนวณค่าสถานะใหม่เป็น Boolean
      const newStatus = !item.status;

      // 2. ส่ง Request โดยแนบ Body { status: newStatus } ไปด้วย
      await api.patch(`/rooms/amenity/${item.id}/status`, {
        status: newStatus,
      });

      // 3. อัปเดต State ในหน้า UI ทันที เพื่อความลื่นไหล
      setAmenities((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, status: newStatus } : a)),
      );

      toast.success(
        `เปลี่ยนสถานะเป็น ${newStatus ? "เปิด" : "ปิด"} ใช้งานเรียบร้อย`,
      );
    } catch (err: any) {
      console.error("Toggle error:", err);
      toast.error(err.response?.data?.message || "ไม่สามารถเปลี่ยนสถานะได้");
      // รีโหลดข้อมูลใหม่หากเกิดข้อผิดพลาดเพื่อคืนค่าเดิม
      fetchAmenities();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/rooms/amenity/${deleteTarget.id}`);
      toast.success("ลบสิ่งอำนวยความสะดวกเรียบร้อยแล้ว");
      setDeleteTarget(null);
      fetchAmenities();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "ลบไม่สำเร็จ");
    }
  };

  const filteredAmenities = amenities.filter((item) => {
    // กรองด้วยค้นหาชื่อ
    const matchesSearch = item.name
      .toLowerCase()
      .includes(search.toLowerCase());

    // กรองด้วยสถานะ
    const matchesStatus =
      statusFilter === "all"
        ? true
        : statusFilter === "active"
          ? item.status === true
          : item.status === false;

    return matchesSearch && matchesStatus;
  });

  if (!ready) return null;

  return (
    <div className="w-full min-h-screen flex flex-col font-sans space-y-6 pb-12 text-stone-800">

      {/* Header & Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-stone-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0b3b2c]/10 text-[#0b3b2c] rounded-xl">
              <Sparkles size={20} />
            </span>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-[#0b3b2c] tracking-tight">
              จัดการสิ่งอำนวยความสะดวก
            </h1>
          </div>
          <p className="text-stone-500 mt-1 text-xs md:text-sm">
            เพิ่มและบริหารจัดการสิ่งอำนวยความสะดวกในระบบ
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-2 bg-white rounded-xl border border-stone-200/80 shadow-xs flex items-center gap-3 w-fit">
            <div className="w-8 h-8 rounded-lg bg-[#0b3b2c]/10 flex items-center justify-center text-[#0b3b2c]">
              <Sparkles size={18} />
            </div>
            <div>
              <span className="text-[10px] font-semibold text-stone-400 block leading-tight">
                รายการทั้งหมด
              </span>
              <span className="text-xs font-bold text-[#0b3b2c]">
                {amenities.length} รายการ
              </span>
            </div>
          </div>
        </div>
      </div>


      {/* FORM CREATE / EDIT (โครงสร้างแนวนอนแบบไฟล์อ้างอิง) */}
      <form
        ref={formRef}
        onSubmit={handleSubmitForm}
        className={`bg-white p-4 rounded-2xl border transition-all duration-300 space-y-3 ${
          editingAmenityId
            ? "border-amber-400 ring-2 ring-amber-400/20 shadow-md"
            : "border-stone-200/80 shadow-xs"
        }`}
      >
        <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
          <span className="text-xs font-bold text-[#0b3b2c] flex items-center gap-1.5">
            {editingAmenityId ? (
              <Edit2 size={16} className="text-amber-600" />
            ) : (
              <Plus size={16} />
            )}
            {editingAmenityId
              ? "แก้ไขสิ่งอำนวยความสะดวก"
              : "เพิ่มสิ่งอำนวยความสะดวกใหม่"}
          </span>
          {editingAmenityId && (
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
          <div className="md:col-span-7">
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              ชื่อสิ่งอำนวยความสะดวก <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="เช่น เครื่องปรับอากาศ, เครื่องทำน้ำอุ่น..."
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0b3b2c]"
            />
          </div>

          <div className="md:col-span-2 flex items-center justify-center pb-2">
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={statusInput}
                onChange={(e) => setStatusInput(e.target.checked)}
                className="w-4 h-4 text-[#0b3b2c] rounded cursor-pointer"
              />
              <span className="text-xs font-bold text-stone-700">
                เปิดใช้งาน
              </span>
            </label>
          </div>

          <div className="md:col-span-3">
            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-2 px-3 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 ${
                editingAmenityId
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-[#0b3b2c] hover:bg-[#07271d]"
              }`}
            >
              {submitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : editingAmenityId ? (
                <Save size={14} />
              ) : (
                <Plus size={14} />
              )}
              <span>{editingAmenityId ? "บันทึกการแก้ไข" : "เพิ่มรายการ"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* TABLE LIST & SEARCH */}
      <div className="space-y-3">
        {/* Search Box & Status Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {/* ช่องค้นหา */}
          <div className="relative w-full sm:flex-1">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              type="text"
              placeholder="ค้นหาชื่อสิ่งอำนวยความสะดวก..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-stone-200/80 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#0b3b2c]"
            />
          </div>

          {/* ปุ่มตัวกรองสถานะ */}
          <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-xl border border-stone-200/80 w-full sm:w-auto shrink-0">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === "all"
                  ? "bg-white text-stone-800 shadow-xs"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              ทั้งหมด ({amenities.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === "active"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-emerald-700 hover:bg-emerald-50"
              }`}
            >
              เปิดใช้งาน ({amenities.filter((a) => a.status).length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("inactive")}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                statusFilter === "inactive"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "text-rose-700 hover:bg-rose-50"
              }`}
            >
              ปิดใช้งาน ({amenities.filter((a) => !a.status).length})
            </button>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
          <div className="p-4 bg-stone-50/80 border-b border-stone-200/80 flex items-center justify-between">
            <h3 className="font-bold text-stone-900 text-sm md:text-base flex items-center gap-2">
              <Sparkles size={16} className="text-[#0b3b2c]" />
              ตารางสิ่งอำนวยความสะดวก
            </h3>
            <span className="px-2.5 py-0.5 bg-stone-200/70 text-stone-700 rounded-full text-[11px] font-bold">
              {filteredAmenities.length} รายการ
            </span>
          </div>

          <div className="divide-y divide-stone-100">
            {loading ? (
              <div className="p-8 flex items-center justify-center gap-2 text-stone-400 text-xs">
                <Loader2 className="animate-spin" size={18} />
                กำลังโหลดข้อมูล...
              </div>
            ) : filteredAmenities.length > 0 ? (
              filteredAmenities.map((am, index) => (
                <div
                  key={am.id}
                  className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                    !am.status
                      ? "bg-stone-50/50 opacity-70"
                      : "hover:bg-stone-50/60"
                  }`}
                >
                  {/* ลำดับข้อ & ชื่อสิ่งอำนวยความสะดวก */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-stone-400 min-w-[24px]">
                      {index + 1}.
                    </span>
                    <span className="text-xs md:text-sm font-semibold text-stone-800">
                      {am.name}
                    </span>
                  </div>

                  {/* ปุ่มสถานะ & ปุ่มจัดการ (แก้ไข/ลบ) */}
                  <div className="flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(am)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer ${
                        am.status
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60 hover:bg-emerald-100"
                          : "bg-rose-50 text-rose-700 border border-rose-200/60 hover:bg-rose-100"
                      }`}
                    >
                      {am.status ? (
                        <>
                          <ToggleRight size={14} className="text-emerald-600" />
                          ใช้งานอยู่
                        </>
                      ) : (
                        <>
                          <ToggleLeft size={14} className="text-rose-500" />
                          ปิดใช้งาน
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-1 border-l border-stone-200 pl-2">
                      <button
                        type="button"
                        onClick={() => handleEditClick(am)}
                        className="p-1.5 text-stone-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition-all cursor-pointer"
                        title="แก้ไข"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(am)}
                        className="p-1.5 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer"
                        title="ลบ"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-xs text-stone-400">
                ไม่พบข้อมูลสิ่งอำนวยความสะดวก
              </div>
            )}
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
                ยืนยันการลบสิ่งอำนวยความสะดวก
              </h3>
              <p className="text-xs text-stone-500 mt-1 leading-relaxed">
                คุณแน่ใจหรือไม่ที่จะลบ "{deleteTarget.name}"? <br />
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
