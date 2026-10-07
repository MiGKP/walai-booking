"use client";

import React, { useState, useEffect } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Loader2,
  Search,
  ToggleLeft,
  ToggleRight,
  Save,
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import {
  PageHeader,
  Panel,
  Modal,
  EmptyState,
  DataTable,
  FormField,
} from "@/components/admin/ui";

export interface Amenity {
  id: number;
  name: string;
  status: boolean;
}

export default function AmenitiesPage() {
  const { ready } = useAuthGuard({ allowedRoles: ["admin", "room_staff"] });

  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingAmenityId, setEditingAmenityId] = useState<number | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [statusInput, setStatusInput] = useState(true);

  const [deleteTarget, setDeleteTarget] = useState<Amenity | null>(null);

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

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
    setIsFormModalOpen(true);
  };

  const handleSubmitForm = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nameInput.trim()) {
      notify.error("กรุณากรอกชื่อสิ่งอำนวยความสะดวก");
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
      setIsFormModalOpen(false);
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
        `เปลี่ยนสถานะเป็น ${newStatus ? "เปิด" : "ปิด"} ใช้งานเรียบร้อย`,
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
      setDeleteTarget(null);
      fetchAmenities();
    } catch (err: unknown) {
      notify.error(getApiErrorMessage(err, "ลบไม่สำเร็จ"));
    }
  };

  const filteredAmenities = amenities.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
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
    <div className="space-y-6 pb-12">
      <PageHeader
        title="จัดการสิ่งอำนวยความสะดวก"
        badge={`${amenities.length} รายการ`}
        actions={
          <button
            onClick={() => {
              handleResetForm();
              setIsFormModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-900"
          >
            <Plus size={16} />
            เพิ่มสิ่งอำนวยความสะดวก
          </button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-charcoal-400" />
          <input
            type="text"
            placeholder="ค้นหาชื่อสิ่งอำนวยความสะดวก..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-charcoal-200 py-2 pl-10 pr-4 text-sm focus:border-forest-500 focus:outline-none focus:ring-1 focus:ring-forest-500"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-xl border border-charcoal-200 bg-charcoal-50 p-1">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === "all" ? "bg-white text-charcoal-800 shadow-sm" : "text-charcoal-500 hover:text-charcoal-800"
            }`}
          >
            ทั้งหมด
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("active")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === "active" ? "bg-white text-forest-700 shadow-sm" : "text-charcoal-500 hover:text-forest-700"
            }`}
          >
            เปิดใช้งาน
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("inactive")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              statusFilter === "inactive" ? "bg-white text-rose-700 shadow-sm" : "text-charcoal-500 hover:text-rose-700"
            }`}
          >
            ปิดใช้งาน
          </button>
        </div>
      </div>

      <Panel>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-charcoal-400">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            กำลังโหลดข้อมูล...
          </div>
        ) : (
          <DataTable
            columns={[
              {
                key: "name",
                header: "ชื่อสิ่งอำนวยความสะดวก",
                render: (row) => (
                  <span className="font-semibold text-charcoal-800">{row.name}</span>
                ),
              },
              {
                key: "status",
                header: "สถานะ",
                render: (row) => (
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(row)}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold transition-all ${
                      row.status
                        ? "bg-forest-50 text-forest-700 hover:bg-forest-100"
                        : "bg-charcoal-50 text-charcoal-600 hover:bg-charcoal-100"
                    }`}
                  >
                    {row.status ? (
                      <>
                        <ToggleRight size={14} className="text-forest-600" />
                        ใช้งานอยู่
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={14} className="text-charcoal-400" />
                        ปิดใช้งาน
                      </>
                    )}
                  </button>
                ),
              },
              {
                key: "actions",
                header: "",
                className: "w-24 text-right",
                render: (row) => (
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleEditClick(row)}
                      className="rounded-lg p-1.5 text-charcoal-400 transition hover:bg-charcoal-50 hover:text-forest-600"
                      title="แก้ไข"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(row)}
                      className="rounded-lg p-1.5 text-charcoal-400 transition hover:bg-rose-50 hover:text-rose-600"
                      title="ลบ"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ),
              },
            ]}
            rows={filteredAmenities}
            rowKey={(row) => row.id}
            empty={
              <EmptyState
                title="ไม่พบข้อมูลสิ่งอำนวยความสะดวก"
                description={search ? "ลองเปลี่ยนคำค้นหาหรือตัวกรองสถานะ" : "ยังไม่มีสิ่งอำนวยความสะดวกในระบบ"}
              />
            }
          />
        )}
      </Panel>

      <Modal
        open={isFormModalOpen}
        title={editingAmenityId ? "แก้ไขสิ่งอำนวยความสะดวก" : "เพิ่มสิ่งอำนวยความสะดวกใหม่"}
        onClose={() => setIsFormModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-charcoal-600 hover:bg-charcoal-50"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={() => handleSubmitForm()}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-900 disabled:opacity-50"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              <span>{editingAmenityId ? "บันทึกการแก้ไข" : "เพิ่มรายการ"}</span>
            </button>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmitForm();
          }}
          className="space-y-5 py-2"
        >
          <FormField label="ชื่อสิ่งอำนวยความสะดวก" required>
            <input
              type="text"
              required
              placeholder="เช่น เครื่องปรับอากาศ, เครื่องทำน้ำอุ่น..."
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full rounded-xl border border-charcoal-200 px-3 py-2 text-sm focus:border-forest-500 focus:outline-none focus:ring-1 focus:ring-forest-500"
            />
          </FormField>
          <label className="inline-flex cursor-pointer select-none items-center gap-2">
            <input
              type="checkbox"
              checked={statusInput}
              onChange={(e) => setStatusInput(e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-charcoal-300 text-forest-600 focus:ring-forest-500"
            />
            <span className="text-sm font-medium text-charcoal-700">เปิดใช้งาน</span>
          </label>
        </form>
      </Modal>

      <Modal
        open={!!deleteTarget}
        title="ยืนยันการลบสิ่งอำนวยความสะดวก"
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-charcoal-600 hover:bg-charcoal-50"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
            >
              ยืนยันการลบ
            </button>
          </>
        }
      >
        <p className="text-sm text-charcoal-500">
          คุณแน่ใจหรือไม่ที่จะลบ <strong>&quot;{deleteTarget?.name}&quot;</strong>?
          <br />
          การดำเนินการนี้ไม่สามารถย้อนกลับได้
        </p>
      </Modal>
    </div>
  );
}
