"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Search,
  Sparkles,
  Save,
  AlertTriangle,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { EmptyState } from "@/components/admin/ui";

export interface Amenity {
  id: number;
  name: string;
  status: boolean;
}

const ITEMS_PER_PAGE = 10;

export default function AmenitiesPage() {
  const { ready } = useAuthGuard({ allowedRoles: ["admin", "room_staff"] });

  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const [editingAmenityId, setEditingAmenityId] = useState<number | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [statusInput, setStatusInput] = useState(true);

  const formRef = useRef<HTMLFormElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<Amenity | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    if (!ready) return;
    fetchAmenities();
  }, [ready]);

  // เมื่อเปลี่ยน search หรือ statusFilter ให้รีเซ็ตกลับหน้าแรกเสมอ
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const fetchAmenities = async () => {
    setLoading(true);
    try {
      const res = await api.get("/rooms/amenities/all");
      setAmenities(res.data?.data || []);
    } catch {
      notify.error("ไม่สามารถโหลดข้อมูลสิ่งอำนวยความสะดวกได้");
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
    setTimeout(() => {
      nameInputRef.current?.focus();
    }, 150);
  };

  const handleSubmitForm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nameInput.trim()) {
      notify.error("กรุณากรอกชื่อสิ่งอำนวยความสะดวก");
      nameInputRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      if (editingAmenityId) {
        await api.put(`/rooms/amenity/${editingAmenityId}`, {
          name: nameInput.trim(),
          status: statusInput,
        });
        notify.success("อัปเดตสิ่งอำนวยความสะดวกเรียบร้อย");
      } else {
        await api.post("/rooms/amenity", {
          name: nameInput.trim(),
          status: statusInput,
        });
        notify.success("เพิ่มสิ่งอำนวยความสะดวกสำเร็จ");
      }
      handleResetForm();
      fetchAmenities();
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "ทำรายการไม่สำเร็จ"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (item: Amenity) => {
    try {
      const newStatus = !item.status;
      await api.patch(`/rooms/amenity/${item.id}/status`, {
        status: newStatus,
      });

      setAmenities((prev) =>
        prev.map((a) => (a.id === item.id ? { ...a, status: newStatus } : a)),
      );

      notify.success(
        `เปลี่ยนสถานะเป็น ${newStatus ? "เปิด" : "ปิด"}ใช้งาน เรียบร้อย`,
      );
    } catch (err: unknown) {
      console.error("Toggle error:", err);
      notify.error(getApiErrorMessage(err, "ไม่สามารถเปลี่ยนสถานะได้"));
      fetchAmenities();
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/rooms/amenity/${deleteTarget.id}`);
      notify.success("ลบสิ่งอำนวยความสะดวกเรียบร้อยแล้ว");
      // หากกำลังแก้ไขตัวที่ถูกลบอยู่ ให้รีเซ็ตฟอร์มด้วย
      if (editingAmenityId === deleteTarget.id) {
        handleResetForm();
      }
      setDeleteTarget(null);
      fetchAmenities();
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "ลบไม่สำเร็จ"));
    }
  };

  const activeCount = useMemo(
    () => amenities.filter((a) => a.status).length,
    [amenities]
  );
  const inactiveCount = useMemo(
    () => amenities.filter((a) => !a.status).length,
    [amenities]
  );

  const filteredAmenities = useMemo(() => {
    return amenities.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesStatus =
        statusFilter === "all"
          ? true
          : statusFilter === "active"
          ? item.status === true
          : item.status === false;
      return matchesSearch && matchesStatus;
    });
  }, [amenities, search, statusFilter]);

  const totalPages = Math.ceil(filteredAmenities.length / ITEMS_PER_PAGE) || 1;

  const paginatedAmenities = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAmenities.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAmenities, currentPage]);

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-800/10 shrink-0">
                <Sparkles size={20} className="stroke-[2.2]" />
              </span>
              <div>
                <h1 className="font-display text-2xl lg:text-3xl font-bold text-forest-900 tracking-tight">
                  จัดการสิ่งอำนวยความสะดวก
                </h1>
              </div>
            </div>
          </div>

          {/* Quick Info Badge */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="px-3.5 py-2 bg-cream-50/80 rounded-2xl border border-cream-300 shadow-2xs flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-forest-100 flex items-center justify-center text-forest-800">
                <Sparkles size={16} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-charcoal-400 block leading-tight">
                  สิ่งอำนวยความสะดวกทั้งหมด
                </span>
                <span className="text-xs font-bold text-forest-900 font-mono">
                  {amenities.length} รายการ
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* FORM: Card Form สำหรับเพิ่ม/แก้ไขสิ่งอำนวยความสะดวก (สไตล์เดียวกับ /admin/boats/rounds) */}
      <form
        ref={formRef}
        onSubmit={handleSubmitForm}
        className={`bg-white p-5 sm:p-6 rounded-3xl border transition-all duration-300 space-y-4 shadow-panel ${
          editingAmenityId
            ? "border-forest-600 ring-2 ring-forest-600/20"
            : "border-cream-200/90"
        }`}
      >
        <div className="flex items-center justify-between border-b border-cream-200/80 pb-3">
          <span className="text-sm font-bold text-forest-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-forest-800" />
            {editingAmenityId ? (
              <span className="flex items-center gap-1.5 text-forest-800">
                <Edit2 size={16} />
                แก้ไขข้อมูลสิ่งอำนวยความสะดวก
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Plus size={16} />
                เพิ่มสิ่งอำนวยความสะดวกใหม่
              </span>
            )}
          </span>
          {editingAmenityId && (
            <button
              type="button"
              onClick={handleResetForm}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 hover:underline cursor-pointer"
            >
              ยกเลิกการแก้ไข
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end">
          {/* 1. ชื่อสิ่งอำนวยความสะดวก */}
          <div className="md:col-span-7">
            <label className="block text-xs font-bold text-charcoal-700 mb-1">
              ชื่อสิ่งอำนวยความสะดวก <span className="text-rose-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              required
              placeholder="เช่น เครื่องปรับอากาศ, เครื่องทำน้ำอุ่น, ตู้เย็น..."
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-cream-50/60 border border-cream-300 rounded-xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
            />
          </div>

          {/* 2. สถานะการใช้งาน */}
          <div className="md:col-span-3">
            <label className="block text-xs font-bold text-charcoal-700 mb-1">
              สถานะการใช้งาน
            </label>
            <div className="flex items-center h-[38px] px-3.5 bg-cream-50/60 border border-cream-300 rounded-xl shadow-2xs">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none w-full">
                <input
                  type="checkbox"
                  checked={statusInput}
                  onChange={(e) => setStatusInput(e.target.checked)}
                  className="w-4 h-4 text-forest-800 rounded border-cream-300 focus:ring-forest-800 accent-forest-800 cursor-pointer"
                />
                <span className="text-xs font-bold text-charcoal-700">
                  {statusInput ? "เปิดใช้งาน (พร้อมเลือก)" : "ปิดใช้งาน (ซ่อน)"}
                </span>
              </label>
            </div>
          </div>

          {/* 3. ปุ่มบันทึก/เพิ่ม */}
          <div className="md:col-span-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 bg-forest-800 hover:bg-forest-900 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98 disabled:opacity-60"
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

      {/* Table & Filter Section */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/90 overflow-hidden flex flex-col min-h-[660px]">
        {/* Header & Filter Controls */}
        <div className="pb-4 mb-4 border-b border-cream-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-forest-800" />
            <h2 className="text-base font-bold text-forest-900">
              รายการสิ่งอำนวยความสะดวกทั้งหมด
            </h2>
            <span className="px-2.5 py-0.5 bg-forest-50 text-forest-800 border border-forest-200 rounded-full text-xs font-bold">
              {filteredAmenities.length}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search
                size={16}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400"
              />
              <input
                type="text"
                placeholder="ค้นหาชื่อสิ่งอำนวยความสะดวก..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-cream-50/70 border border-cream-300 rounded-2xl text-xs font-medium text-charcoal-800 placeholder-charcoal-400 focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 transition-all shadow-2xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal-400 hover:text-charcoal-600 text-xs p-0.5 rounded-full hover:bg-cream-200 cursor-pointer"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 rounded-2xl border border-cream-300 bg-cream-50/80 p-1 shrink-0">
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "all"
                    ? "bg-white text-forest-900 shadow-2xs"
                    : "text-charcoal-500 hover:text-charcoal-800"
                }`}
              >
                <span>ทั้งหมด</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                    statusFilter === "all"
                      ? "bg-forest-100 text-forest-800"
                      : "bg-cream-200/80 text-charcoal-500"
                  }`}
                >
                  {amenities.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("active")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "active"
                    ? "bg-white text-forest-800 shadow-2xs"
                    : "text-charcoal-500 hover:text-forest-800"
                }`}
              >
                <span>เปิดใช้งาน</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                    statusFilter === "active"
                      ? "bg-forest-100 text-forest-800"
                      : "bg-cream-200/80 text-charcoal-500"
                  }`}
                >
                  {activeCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter("inactive")}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "inactive"
                    ? "bg-white text-rose-700 shadow-2xs"
                    : "text-charcoal-500 hover:text-rose-700"
                }`}
              >
                <span>ปิดใช้งาน</span>
                <span
                  className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                    statusFilter === "inactive"
                      ? "bg-rose-100 text-rose-700"
                      : "bg-cream-200/80 text-charcoal-500"
                  }`}
                >
                  {inactiveCount}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Table Area (Flex-1 to fill space consistently) */}
        <div className="flex-1 overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-cream-50/80 border-b border-cream-200 text-xs font-bold text-charcoal-600 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">ชื่อสิ่งอำนวยความสะดวก</th>
                <th className="px-4 py-3.5">สถานะการใช้งาน</th>
                <th className="px-4 py-3.5 text-center w-28">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream-100 text-xs text-charcoal-700">
              {loading ? (
                <tr>
                  <td colSpan={3} className="py-24 text-center text-charcoal-400">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-forest-800 border-t-transparent mb-3" />
                    <p className="text-xs font-medium text-charcoal-500">
                      กำลังโหลดข้อมูลสิ่งอำนวยความสะดวก...
                    </p>
                  </td>
                </tr>
              ) : filteredAmenities.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-12">
                    <EmptyState
                      title="ไม่พบข้อมูลสิ่งอำนวยความสะดวก"
                      description={
                        search
                          ? "ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ"
                          : "ยังไม่มีสิ่งอำนวยความสะดวกในระบบ พิมพ์ชื่อด้านบนแล้วกดเพิ่มรายการได้ทันที"
                      }
                    />
                  </td>
                </tr>
              ) : (
                paginatedAmenities.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-cream-50/50 transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-forest-50 border border-forest-100 flex items-center justify-center text-forest-800 shrink-0">
                          <Sparkles size={15} />
                        </div>
                        <span className="font-bold text-charcoal-900 text-sm">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(item)}
                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                          item.status
                            ? "bg-forest-50 text-forest-800 border-forest-200 hover:bg-forest-100"
                            : "bg-cream-200 text-charcoal-600 border-cream-300 hover:bg-cream-300"
                        }`}
                        title="คลิกเพื่อเปิด/ปิดการใช้งาน"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            item.status ? "bg-forest-600" : "bg-charcoal-400"
                          }`}
                        />
                        {item.status ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleEditClick(item)}
                          className="p-1.5 text-charcoal-500 hover:text-amber-800 hover:bg-amber-50/80 rounded-xl transition-all cursor-pointer"
                          title="แก้ไขข้อมูล"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(item)}
                          className="p-1.5 text-charcoal-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                          title="ลบรายการ"
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

        {/* Pagination Footer */}
        {!loading && filteredAmenities.length > 0 && (
          <div className="mt-auto flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-cream-200/80 text-xs text-charcoal-500">
            <span>
              แสดง{" "}
              <strong className="text-forest-950 font-mono font-bold">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}
              </strong>{" "}
              -{" "}
              <strong className="text-forest-950 font-mono font-bold">
                {Math.min(currentPage * ITEMS_PER_PAGE, filteredAmenities.length)}
              </strong>{" "}
              จากทั้งหมด{" "}
              <strong className="text-forest-950 font-mono font-bold">
                {filteredAmenities.length}
              </strong>{" "}
              รายการ
            </span>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-xl border border-cream-300 bg-white text-charcoal-700 disabled:opacity-40 hover:bg-cream-50 transition-colors shadow-2xs cursor-pointer disabled:cursor-not-allowed"
                  title="หน้าก่อนหน้า"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-3 py-1 text-xs font-bold text-forest-900 font-mono bg-cream-100/70 border border-cream-200 rounded-xl">
                  {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded-xl border border-cream-300 bg-white text-charcoal-700 disabled:opacity-40 hover:bg-cream-50 transition-colors shadow-2xs cursor-pointer disabled:cursor-not-allowed"
                  title="หน้าถัดไป"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal: Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl border border-cream-200/90 p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-charcoal-900">
                ยืนยันการลบสิ่งอำนวยความสะดวก
              </h3>
              <p className="text-xs text-charcoal-500 mt-1.5 leading-relaxed">
                คุณแน่ใจหรือไม่ที่จะลบ{" "}
                <strong className="text-forest-900 font-bold">
                  &quot;{deleteTarget.name}&quot;
                </strong>
                ? <br />
                การดำเนินการนี้ไม่สามารถย้อนกลับได้
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-2.5 px-4 bg-cream-100 hover:bg-cream-200 text-charcoal-700 text-xs font-bold rounded-2xl transition-all cursor-pointer border border-cream-200 shadow-2xs"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-2xl transition-all shadow-xs cursor-pointer"
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
