'use client';

import { useState, useEffect } from 'react';
import { Clock, Anchor, LayoutDashboard, Trash2, Plus, ChevronDown, ChevronUp, Users, AlertCircle, Edit2, X } from 'lucide-react';
import api from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface RoundGroup {
  key: string;
  start_time: string;
  end_time: string;
  total_slots: number | null;
  entries: any[];
}

export default function BoatRoundsPage() {
  const { ready } = useAuthGuard({ allowedRoles: ['admin'] });
  const [boatTypes, setBoatTypes] = useState<any[]>([]);
  const [rounds, setRounds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ start_time: '', end_time: '', total_slots: '', selectedTypes: [] as number[], maxBookingPerType: {} as Record<number, string> });
  const [submitting, setSubmitting] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [addTypeModal, setAddTypeModal] = useState<{ key: string; start_time: string; end_time: string; total_slots: number | null } | null>(null);
  const [addTypeId, setAddTypeId] = useState('');
  const [addMaxBooking, setAddMaxBooking] = useState('');
  const [addingType, setAddingType] = useState(false);
  const [editGroupModal, setEditGroupModal] = useState<{ group: RoundGroup; start_time: string; end_time: string; total_slots: string } | null>(null);
  const [savingGroup, setSavingGroup] = useState(false);
  const [editEntryModal, setEditEntryModal] = useState<{ id: number; boat_type_id: number; max_booking: string; is_active: boolean } | null>(null);
  const [savingEntry, setSavingEntry] = useState(false);

  useEffect(() => {
    if (!ready) return;
    fetchData();
  }, [ready]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [btRes, rndRes] = await Promise.all([
        api.get('/kayaks/admin/types'),
        api.get('/kayaks/admin/schedule'),
      ]);
      setBoatTypes(btRes.data?.data || []);
      setRounds(rndRes.data?.data || []);
    } catch {
      toast.error('ไม่สามารถโหลดข้อมูลได้');
    } finally {
      setLoading(false);
    }
  };

  // Group rounds by start_time + end_time
  const groupedRounds: RoundGroup[] = (() => {
    const map = new Map<string, RoundGroup>();
    for (const r of rounds) {
      const key = `${r.start_time?.slice(0, 5)}_${r.end_time?.slice(0, 5)}`;
      if (!map.has(key)) {
        map.set(key, { key, start_time: r.start_time?.slice(0, 5), end_time: r.end_time?.slice(0, 5), total_slots: r.total_slots ?? null, entries: [] });
      }
      map.get(key)!.entries.push(r);
    }
    return Array.from(map.values()).sort((a, b) => a.start_time.localeCompare(b.start_time));
  })();

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleType = (id: number) => {
    setForm(prev => {
      const isSelected = prev.selectedTypes.includes(id);
      const newSelected = isSelected
        ? prev.selectedTypes.filter(t => t !== id)
        : [...prev.selectedTypes, id];
      const newMax = { ...prev.maxBookingPerType };
      if (!isSelected) delete newMax[id];
      return { ...prev, selectedTypes: newSelected, maxBookingPerType: newMax };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.selectedTypes.length === 0) { toast.error('กรุณาเลือกประเภทเรืออย่างน้อย 1 ประเภท'); return; }
    setSubmitting(true);
    try {
      await Promise.all(form.selectedTypes.map(typeId =>
        api.post('/kayaks/rounds', {
          boat_type_id: typeId,
          start_time: form.start_time,
          end_time: form.end_time,
          total_slots: form.total_slots ? Number(form.total_slots) : null,
          max_booking: form.maxBookingPerType[typeId] ? Number(form.maxBookingPerType[typeId]) : null,
        })
      ));
      toast.success('สร้างรอบเวลาสำเร็จ');
      setForm({ start_time: '', end_time: '', total_slots: '', selectedTypes: [], maxBookingPerType: {} });
      fetchData();
    } catch {
      toast.error('สร้างรอบเวลาไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async (id: number) => {
    if (!confirm('ต้องการลบประเภทเรือนี้ออกจากรอบใช่หรือไม่?')) return;
    try {
      await api.delete(`/kayaks/rounds/${id}`);
      toast.success('ลบสำเร็จ');
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'ลบไม่สำเร็จ');
    }
  };

  const handleDeleteGroup = async (group: RoundGroup) => {
    if (!confirm(`ต้องการลบรอบ ${group.start_time}–${group.end_time} ทั้งหมด (${group.entries.length} ประเภท) ใช่หรือไม่?`)) return;
    try {
      await Promise.all(group.entries.map(e => api.delete(`/kayaks/rounds/${e.boat_round_id}`)));
      toast.success('ลบรอบเวลาสำเร็จ');
      fetchData();
    } catch {
      toast.error('ลบไม่สำเร็จ');
    }
  };

  const openAddType = (group: RoundGroup) => {
    setAddTypeModal({ key: group.key, start_time: group.start_time, end_time: group.end_time, total_slots: group.total_slots });
    setAddTypeId('');
    setAddMaxBooking('');
  };

  const handleOpenEditGroup = (group: RoundGroup) => {
    setEditGroupModal({ group, start_time: group.start_time, end_time: group.end_time, total_slots: group.total_slots?.toString() ?? '' });
  };

  const handleUpdateGroup = async () => {
    if (!editGroupModal) return;
    setSavingGroup(true);
    try {
      await Promise.all(editGroupModal.group.entries.map(e =>
        api.put(`/kayaks/rounds/${e.boat_round_id}`, {
          boat_type_id: e.boat_type_id,
          start_time: editGroupModal.start_time,
          end_time: editGroupModal.end_time,
          total_slots: editGroupModal.total_slots ? Number(editGroupModal.total_slots) : null,
          max_booking: e.max_booking ?? null,
          is_active: e.is_active,
        })
      ));
      toast.success('อัปเดตรอบเวลาสำเร็จ');
      setEditGroupModal(null);
      fetchData();
    } catch {
      toast.error('อัปเดตไม่สำเร็จ');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleToggleActive = async (e: any) => {
    try {
      await api.put(`/kayaks/rounds/${e.boat_round_id}`, {
        boat_type_id: e.boat_type_id,
        start_time: e.start_time?.slice(0, 5),
        end_time: e.end_time?.slice(0, 5),
        total_slots: e.total_slots ?? null,
        max_booking: e.max_booking ?? null,
        is_active: !e.is_active,
      });
      toast.success(e.is_active ? 'ปิดรอบเวลาแล้ว' : 'เปิดรอบเวลาแล้ว');
      fetchData();
    } catch {
      toast.error('เปลี่ยนสถานะไม่สำเร็จ');
    }
  };

  const handleOpenEditEntry = (e: any) => {
    setEditEntryModal({
      id: e.boat_round_id,
      boat_type_id: e.boat_type_id,
      max_booking: e.max_booking?.toString() ?? '',
      is_active: e.is_active,
    });
  };

  const handleUpdateEntry = async () => {
    if (!editEntryModal) return;
    setSavingEntry(true);
    const entry = rounds.find(r => r.boat_round_id === editEntryModal.id);
    if (!entry) { setSavingEntry(false); return; }
    try {
      await api.put(`/kayaks/rounds/${editEntryModal.id}`, {
        boat_type_id: editEntryModal.boat_type_id,
        start_time: entry.start_time?.slice(0, 5),
        end_time: entry.end_time?.slice(0, 5),
        total_slots: entry.total_slots ?? null,
        max_booking: editEntryModal.max_booking ? Number(editEntryModal.max_booking) : null,
        is_active: editEntryModal.is_active,
      });
      toast.success('อัปเดตสำเร็จ');
      setEditEntryModal(null);
      fetchData();
    } catch {
      toast.error('อัปเดตไม่สำเร็จ');
    } finally {
      setSavingEntry(false);
    }
  };

  const handleAddType = async () => {
    if (!addTypeModal || !addTypeId) { toast.error('กรุณาเลือกประเภทเรือ'); return; }
    setAddingType(true);
    try {
      await api.post('/kayaks/rounds', {
        boat_type_id: Number(addTypeId),
        start_time: addTypeModal.start_time,
        end_time: addTypeModal.end_time,
        total_slots: addTypeModal.total_slots,
        max_booking: addMaxBooking ? Number(addMaxBooking) : null,
      });
      toast.success('เพิ่มประเภทเรือสำเร็จ');
      setAddTypeModal(null);
      fetchData();
    } catch {
      toast.error('เพิ่มประเภทเรือไม่สำเร็จ');
    } finally {
      setAddingType(false);
    }
  };

  if (!ready) return null;

  return (
    <div className="min-h-screen pt-16 bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">จัดการเรือและคายัค</h1>
          <p className="text-gray-500 mt-1">เพิ่มและจัดการรอบเวลาเรือ</p>
        </div>

        {/* Sub Navigation */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <Link href="/staff/boats/dashboard" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">
            <LayoutDashboard size={15} /> แดชบอร์ด
          </Link>
          <Link href="/admin/boats/types" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white text-gray-600 hover:bg-gray-100 border border-gray-200 transition-colors">
            <Anchor size={15} /> ประเภทเรือ
          </Link>
          <Link href="/admin/boats/rounds" className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-cyan-600 text-white shadow-sm">
            <Clock size={15} /> รอบเวลาเรือ
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Form */}
          <div className="card p-6 lg:col-span-1 h-fit">
            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock size={20} className="text-blue-600" /> สร้างรอบเวลา
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">เวลาเริ่ม</label>
                  <input type="time" required className="input-field" value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">เวลาสิ้นสุด</label>
                  <input type="time" required className="input-field" value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  ความจุท่า (ลำรวม/รอบ) <span className="text-gray-400 font-normal">ไม่ระบุ = ไม่จำกัด</span>
                </label>
                <input type="number" min="1" className="input-field" placeholder="เช่น 5" value={form.total_slots}
                  onChange={(e) => setForm({ ...form, total_slots: e.target.value })} />
                <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                  <AlertCircle size={11} /> นับรวมทุกประเภทในรอบนี้
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">เลือกประเภทเรือในรอบนี้</label>
                {boatTypes.length === 0 ? (
                  <p className="text-xs text-gray-400">ยังไม่มีประเภทเรือ</p>
                ) : (
                  <div className="space-y-2">
                    {boatTypes.map((bt: any) => (
                      <label key={bt.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${form.selectedTypes.includes(bt.id) ? 'border-cyan-400 bg-cyan-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input
                          type="checkbox"
                          checked={form.selectedTypes.includes(bt.id)}
                          onChange={() => toggleType(bt.id)}
                          className="w-4 h-4 text-cyan-600 rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{bt.name}</p>
                          <p className="text-xs text-gray-400 flex items-center gap-1"><Users size={10} /> {bt.capacity} ที่นั่ง · {bt.quantity} ลำ</p>
                          {form.selectedTypes.includes(bt.id) && (
                            <div className="mt-2">
                              <input
                                type="number"
                                min="1"
                                className="input-field w-full text-xs"
                                placeholder="จำกัดจองสูงสุด/รอบ (ไม่ระบุ = ไม่จำกัด)"
                                value={form.maxBookingPerType[bt.id] ?? ''}
                                onChange={(e) => setForm(prev => ({
                                  ...prev,
                                  maxBookingPerType: { ...prev.maxBookingPerType, [bt.id]: e.target.value },
                                }))}
                              />
                            </div>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'กำลังสร้าง...' : 'สร้างรอบเวลา'}
              </button>
            </form>
          </div>

          {/* Round Groups */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-800">รอบเวลาทั้งหมด</h2>
              <span className="text-sm text-gray-400">{groupedRounds.length} รอบ</span>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <div key={i} className="card p-4 animate-pulse h-20 bg-gray-100" />)}
              </div>
            ) : groupedRounds.length === 0 ? (
              <div className="card p-10 text-center text-gray-400">
                <Clock size={32} className="mx-auto mb-2 opacity-30" />
                <p>ยังไม่มีรอบเวลา</p>
              </div>
            ) : groupedRounds.map((group) => {
              const isExpanded = expandedKeys.has(group.key);
              return (
                <div key={group.key} className="card overflow-hidden">
                  {/* Group Header */}
                  <div className="flex items-center px-5 py-4 bg-white">
                    <button onClick={() => toggleExpand(group.key)} className="flex-1 flex items-center gap-3 text-left">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                        <Clock size={18} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-base">{group.start_time} – {group.end_time} น.</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {group.entries.length} ประเภทเรือ
                          {group.total_slots ? <span className="ml-2 text-orange-500">· ท่ารองรับ {group.total_slots} ลำรวม</span> : ''}
                        </p>
                      </div>
                      <div className="ml-2 flex gap-1 flex-wrap">
                        {group.entries.map((e: any) => {
                          const name = boatTypes.find(bt => bt.id === e.boat_type_id)?.name || `#${e.boat_type_id}`;
                          return (
                            <span key={e.boat_round_id} className="px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full text-xs font-medium">{name}</span>
                          );
                        })}
                      </div>
                    </button>
                    <div className="flex items-center gap-2 ml-2 shrink-0">
                      <button onClick={() => openAddType(group)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors">
                        <Plus size={13} /> เพิ่มเรือ
                      </button>
                      <button onClick={() => handleOpenEditGroup(group)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไขรอบ">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => handleDeleteGroup(group)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors" title="ลบรอบทั้งหมด">
                        <Trash2 size={15} />
                      </button>
                      <button onClick={() => toggleExpand(group.key)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded entries */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 divide-y divide-gray-50 bg-gray-50/50">
                      {group.entries.map((e: any) => {
                        const bt = boatTypes.find(b => b.id === e.boat_type_id);
                        return (
                          <div key={e.boat_round_id} className="flex items-center px-5 py-3 gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800">{bt?.name || `ID: ${e.boat_type_id}`}</p>
                              <p className="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                                <Users size={11} /> {bt?.capacity} ที่นั่ง · {bt?.quantity} ลำ
                                {e.max_booking
                                  ? <span className="text-blue-600 font-medium">· จำกัด {e.max_booking} จอง/รอบ</span>
                                  : <span className="text-gray-300">· ไม่จำกัดจอง/รอบ</span>
                                }
                              </p>
                            </div>
                            {/* Toggle is_active */}
                            <button
                              onClick={() => handleToggleActive(e)}
                              title={e.is_active ? 'คลิกเพื่อปิด' : 'คลิกเพื่อเปิด'}
                              className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none ${e.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                            >
                              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${e.is_active ? 'translate-x-[18px]' : 'translate-x-[3px]'}`} />
                            </button>
                            <span className={`text-xs font-medium w-6 ${e.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                              {e.is_active ? 'เปิด' : 'ปิด'}
                            </span>
                            <button onClick={() => handleOpenEditEntry(e)} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="แก้ไข max_booking">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDeleteEntry(e.boat_round_id)} className="p-1.5 text-red-400 hover:bg-red-100 rounded-lg transition-colors" title="ลบประเภทนี้ออกจากรอบ">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Edit Group Modal */}
        {editGroupModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">แก้ไขรอบเวลา</h3>
                <button onClick={() => setEditGroupModal(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">เวลาเริ่ม</label>
                    <input type="time" className="input-field" value={editGroupModal.start_time}
                      onChange={(e) => setEditGroupModal({ ...editGroupModal, start_time: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">เวลาสิ้นสุด</label>
                    <input type="time" className="input-field" value={editGroupModal.end_time}
                      onChange={(e) => setEditGroupModal({ ...editGroupModal, end_time: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    ความจุท่า (ลำรวม/รอบ) <span className="text-gray-400 font-normal">ไม่ระบุ = ไม่จำกัด</span>
                  </label>
                  <input type="number" min="1" className="input-field" placeholder="เช่น 5"
                    value={editGroupModal.total_slots}
                    onChange={(e) => setEditGroupModal({ ...editGroupModal, total_slots: e.target.value })} />
                  <p className="text-xs text-orange-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={11} /> นับรวมทุกประเภทในรอบนี้
                  </p>
                </div>
                <p className="text-xs text-gray-400">ประเภทเรือในรอบ: {editGroupModal.group.entries.length} ประเภท — จะอัปเดตทั้งหมด</p>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setEditGroupModal(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50">ยกเลิก</button>
                <button onClick={handleUpdateGroup} disabled={savingGroup} className="flex-1 btn-primary bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm">
                  {savingGroup ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Entry Modal */}
        {editEntryModal && (() => {
          const bt = boatTypes.find(b => b.id === editEntryModal.boat_type_id);
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">แก้ไขประเภทเรือในรอบ</h3>
                    <p className="text-sm text-gray-500 mt-0.5">{bt?.name}</p>
                  </div>
                  <button onClick={() => setEditEntryModal(null)} className="p-1 hover:bg-gray-100 rounded-lg">
                    <X size={18} className="text-gray-500" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      จำกัดจองสูงสุด/รอบ <span className="text-gray-400 font-normal">ไม่ระบุ = ไม่จำกัด</span>
                    </label>
                    <input
                      type="number" min="1" className="input-field"
                      placeholder="เช่น 5"
                      value={editEntryModal.max_booking}
                      onChange={(e) => setEditEntryModal({ ...editEntryModal, max_booking: e.target.value })}
                    />
                    <p className="text-xs text-blue-500 mt-1">จำนวนการจองสูงสุดสำหรับเรือประเภทนี้ในรอบนี้</p>
                  </div>
                  <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-xl">
                    <span className="text-sm font-medium text-gray-700">เปิดรับจอง</span>
                    <button
                      onClick={() => setEditEntryModal({ ...editEntryModal, is_active: !editEntryModal.is_active })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${editEntryModal.is_active ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${editEntryModal.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2 mt-5">
                  <button onClick={() => setEditEntryModal(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50">ยกเลิก</button>
                  <button onClick={handleUpdateEntry} disabled={savingEntry} className="flex-1 btn-primary bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm">
                    {savingEntry ? 'กำลังบันทึก...' : 'บันทึก'}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Add Type to Round Modal */}
        {addTypeModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-1">เพิ่มประเภทเรือในรอบ</h3>
              <p className="text-sm text-gray-500 mb-4">{addTypeModal.start_time} – {addTypeModal.end_time} น.</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทเรือ</label>
                  <select className="input-field" value={addTypeId} onChange={(e) => setAddTypeId(e.target.value)}>
                    <option value="">เลือกประเภทเรือ...</option>
                    {boatTypes.filter(bt => !rounds.some(r =>
                      r.start_time?.slice(0, 5) === addTypeModal.start_time &&
                      r.end_time?.slice(0, 5) === addTypeModal.end_time &&
                      r.boat_type_id === bt.id
                    )).map((bt: any) => (
                      <option key={bt.id} value={bt.id}>{bt.name} ({bt.capacity} ที่นั่ง)</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    จำกัดจองสูงสุด/รอบ <span className="text-gray-400 font-normal">ไม่ระบุ = ไม่จำกัด</span>
                  </label>
                  <input type="number" min="1" className="input-field" placeholder="เช่น 10" value={addMaxBooking}
                    onChange={(e) => setAddMaxBooking(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => setAddTypeModal(null)} className="flex-1 px-4 py-2 border border-gray-200 rounded-xl text-gray-600 text-sm hover:bg-gray-50">ยกเลิก</button>
                <button onClick={handleAddType} disabled={addingType || !addTypeId} className="flex-1 btn-primary bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm">
                  {addingType ? 'กำลังเพิ่ม...' : 'เพิ่มประเภทเรือ'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
