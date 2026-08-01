"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Trash2, PlusCircle, Edit2, X } from "lucide-react";
import api from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast from "react-hot-toast";
import Link from "next/link";

export default function AmenitiesPage() {
  const router = useRouter();
  const { ready } = useAuthGuard({ allowedRoles: ["admin"] });
  const [amenities, setAmenities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ name: "", icon: "" });
  const [editingAmenity, setEditingAmenity] = useState<any>(null);
  const [showEditModal, setShowEditModal] = useState(false);

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
      toast.error(
        "ไม่สามารถโหลดข้อมูลสิ่งอำนวยความสะดวกได้ (หรือยังไม่มี API)",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post("/rooms/amenity", form);
      toast.success("เพิ่มสิ่งอำนวยความสะดวกสำเร็จ");
      setForm({ name: "", icon: "" });
      fetchAmenities();
    } catch {
      toast.error("เพิ่มสิ่งอำนวยความสะดวกไม่สำเร็จ");
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`ต้องการลบ "${name}" ใช่หรือไม่?`)) return;
    try {
      await api.delete(`/rooms/amenity/${id}`);
      toast.success("ลบสำเร็จ");
      fetchAmenities();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "ลบไม่สำเร็จ");
    }
  };

  const openEditModal = (am: any) => {
    setEditingAmenity({ id: am.id, name: am.name });
    setShowEditModal(true);
  };

  const handleUpdateAmenity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAmenity) return;
    try {
      await api.put(`/rooms/amenity/${editingAmenity.id}`, {
        name: editingAmenity.name,
      });
      toast.success("แก้ไขสำเร็จ");
      setShowEditModal(false);
      setEditingAmenity(null);
      fetchAmenities();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "แก้ไขไม่สำเร็จ");
    }
  };

  return (
    <div className="w-full min-h-screen flex flex-col font-sans space-y-4 pb-10">
      {/* Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stone-200/80">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-[#0b3b2c] tracking-tight">
            จัดการสิ่งอำนวยความสะดวก
          </h1>
          <p className="text-stone-400 mt-0.5 text-xs md:text-sm">
            เพิ่มและบริหารจัดการสิ่งอำนวยความสะดวกในระบบสวนวลัยรุกขเวช
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 bg-white p-2 rounded-xl shadow-sm w-fit border border-gray-100">
        <Link
          href="/admin/rooms/types"
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          ประเภทห้องพัก
        </Link>
        <Link
          href="/admin/rooms/single"
          className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          จัดการรายห้อง
        </Link>
        <Link
          href="/admin/rooms/amenities"
          className="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-50 text-indigo-700"
        >
          สิ่งอำนวยความสะดวก
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Form */}
        <div className="card p-6 lg:col-span-1 h-fit">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <PlusCircle size={20} className="text-indigo-600" />
            เพิ่มสิ่งอำนวยความสะดวก
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ชื่อสิ่งอำนวยความสะดวก (เช่น Wi-Fi)
              </label>
              <input
                type="text"
                required
                className="input-field"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <button
              type="submit"
              className="btn-primary w-full mt-2 bg-indigo-600 hover:bg-indigo-700"
            >
              บันทึกข้อมูล
            </button>
          </form>
        </div>

        {/* Table */}
        <div className="lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100 font-bold text-gray-700">
              รายการสิ่งอำนวยความสะดวกทั้งหมด
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">
                      ไอดี
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">
                      ชื่อ
                    </th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">
                      สถานะ
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">
                      จัดการ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 bg-white">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-gray-500">
                        กำลังโหลด...
                      </td>
                    </tr>
                  ) : amenities.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-gray-500">
                        ยังไม่มีข้อมูล
                      </td>
                    </tr>
                  ) : (
                    amenities.map((am: any) => (
                      <tr
                        key={am.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          {am.id}
                        </td>
                        <td className="px-4 py-3 text-gray-900">{am.name}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-bold ${am.status ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                          >
                            {am.status ? "ใช้งานอยู่" : "ปิดใช้งาน"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(am)}
                              className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                              title="แก้ไข"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(am.id, am.name)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
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
      </div>

      {/* Edit Amenity Modal */}
      {showEditModal && editingAmenity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900">
                แก้ไขสิ่งอำนวยความสะดวก
              </h3>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingAmenity(null);
                }}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <form onSubmit={handleUpdateAmenity} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อสิ่งอำนวยความสะดวก
                </label>
                <input
                  type="text"
                  required
                  className="input-field"
                  value={editingAmenity.name}
                  onChange={(e) =>
                    setEditingAmenity({
                      ...editingAmenity,
                      name: e.target.value,
                    })
                  }
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingAmenity(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50 transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="flex-1 btn-primary bg-indigo-600 hover:bg-indigo-700"
                >
                  บันทึก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
