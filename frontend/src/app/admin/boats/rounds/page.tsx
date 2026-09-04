"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Ship,
  Clock,
  Plus,
  Minus,
  Edit2,
  Trash2,
  AlertTriangle,
  ChevronDown,
  Save,
  Loader2,
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import toast, { Toaster } from "react-hot-toast";

export interface BoatType {
  boat_type_id?: number;
  id?: number;
  type_name?: string;
  name?: string;
}

export interface BoatQuantityItem {
  boat_type_id: number;
  quantity: number;
  type_name?: string;
}

export interface BoatRound {
  boat_round_id: number;
  start_time: string;
  end_time: string;
  total_slots: number;
  max_booking?: number;
  is_active: boolean;
  boats?: BoatQuantityItem[];
  round_boats?: BoatQuantityItem[];
  boat_type_id?: number;
  type_name?: string;
}

interface AdminRoundRow extends BoatRound {
  round_boats?: BoatQuantityItem[];
}

function boatTypeKey(bt: BoatType): number | undefined {
  return bt.boat_type_id ?? bt.id;
}

function boatTypeLabel(bt: BoatType): string {
  return bt.type_name ?? bt.name ?? "";
}

// -------------------------------------------------------------
// 🕒 CUSTOM TIME PICKER COMPONENT (เวลาไทย 24 ชม.)
// -------------------------------------------------------------
interface ThaiTimePickerProps {
  label: string;
  value: string; // "15:00"
  onChange: (time: string) => void;
  required?: boolean;
}

const ThaiTimePicker: React.FC<ThaiTimePickerProps> = ({
  label,
  value,
  onChange,
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hourContainerRef = useRef<HTMLDivElement>(null);
  const minuteContainerRef = useRef<HTMLDivElement>(null);

  const [rawHours = "15", rawMinutes = "00"] = (value || "15:00").split(":");
  const hours = rawHours.padStart(2, "0");
  const minutes = rawMinutes.padStart(2, "0");

  const hourOptions = Array.from({ length: 24 }, (_, i) =>
    i.toString().padStart(2, "0")
  );
  const minuteOptions = Array.from({ length: 60 }, (_, i) =>
    i.toString().padStart(2, "0")
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        const selectedHourEl = hourContainerRef.current?.querySelector(
          '[data-selected="true"]'
        );
        const selectedMinuteEl = minuteContainerRef.current?.querySelector(
          '[data-selected="true"]'
        );

        selectedHourEl?.scrollIntoView({ block: "center" });
        selectedMinuteEl?.scrollIntoView({ block: "center" });
      }, 0);
    }
  }, [isOpen]);

  const handleSelectHour = (h: string) => {
    onChange(`${h}:${minutes}`);
  };

  const handleSelectMinute = (m: string) => {
    onChange(`${hours}:${m}`);
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="block text-[11px] font-bold text-stone-700 mb-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0b3b2c] flex items-center justify-between cursor-pointer"
      >
        <span>{value || "00:00"} น.</span>
        <Clock size={15} className="text-stone-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-white border border-stone-200 rounded-2xl shadow-xl z-50 p-2 text-stone-800 animate-in fade-in zoom-in-95 duration-150">
          <div className="text-[10px] font-bold text-stone-400 px-2 py-1 border-b border-stone-100 flex justify-between">
            <span>ชั่วโมง (00-23)</span>
            <span>นาที (00-59)</span>
          </div>

          <div className="grid grid-cols-2 gap-1 h-48 mt-1">
            <div
              ref={hourContainerRef}
              className="overflow-y-auto pr-1 space-y-0.5 scrollbar-thin"
            >
              {hourOptions.map((h) => {
                const isSelected = hours === h;
                return (
                  <button
                    key={`h-${h}`}
                    type="button"
                    data-selected={isSelected}
                    onClick={() => handleSelectHour(h)}
                    className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center ${
                      isSelected
                        ? "bg-[#0b3b2c] text-white"
                        : "hover:bg-stone-100 text-stone-700"
                    }`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>

            <div
              ref={minuteContainerRef}
              className="overflow-y-auto pl-1 space-y-0.5 border-l border-stone-100 scrollbar-thin"
            >
              {minuteOptions.map((m) => {
                const isSelected = minutes === m;
                return (
                  <button
                    key={`m-${m}`}
                    type="button"
                    data-selected={isSelected}
                    onClick={() => handleSelectMinute(m)}
                    className={`w-full py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer text-center ${
                      isSelected
                        ? "bg-[#0b3b2c] text-white"
                        : "hover:bg-stone-100 text-stone-700"
                    }`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="w-full mt-2 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-[11px] font-bold transition-colors cursor-pointer"
          >
            ตกลง ({value} น.)
          </button>
        </div>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// MAIN PAGE COMPONENT
// -------------------------------------------------------------
export default function BoatRoundsPage(): React.ReactElement | null {
  const { ready } = useAuthGuard({ allowedRoles: ["admin", "boat_staff"] });

  const [rounds, setRounds] = useState<BoatRound[]>([]);
  const [boatTypes, setBoatTypes] = useState<BoatType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const formRef = useRef<HTMLFormElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [editingRoundId, setEditingRoundId] = useState<number | null>(null);

  const [startTime, setStartTime] = useState("15:00");
  const [endTime, setEndTime] = useState("16:00");
  const [isActive, setIsActive] = useState<boolean>(true);

  // รองรับทั้ง number และ string (เพื่อปล่อยให้ช่องว่างเปล่าได้ชั่วคราวตอนกดลบ)
  const [selectedBoatsMap, setSelectedBoatsMap] = useState<
    Record<number, number | string>
  >({});
  const [isDropdownOpen, setIsDropdownOpen] = useState<boolean>(false);
  const [deleteRoundId, setDeleteRoundId] = useState<number | null>(null);

  const formatThaiDisplay = (timeStr?: string) => {
    if (!timeStr) return "-";
    const clean = timeStr.slice(0, 5);
    return `${clean} น.`;
  };

  const cleanTimeForBackend = (timeStr: string) => {
    if (!timeStr) return "";
    return timeStr
      .replace(/[^0-9:]/g, "")
      .slice(0, 5)
      .trim();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchData = async (): Promise<void> => {
    try {
      setLoading(true);

      const typesRes = await api.get("/kayaks/types");
      const typesPayload: unknown = typesRes.data;
      const boatTypesArray = Array.isArray(typesPayload)
        ? typesPayload
        : typesPayload &&
            typeof typesPayload === "object" &&
            Array.isArray((typesPayload as { data?: unknown }).data)
          ? (typesPayload as { data: BoatType[] }).data
          : typesPayload &&
              typeof typesPayload === "object" &&
              Array.isArray((typesPayload as { kayaks?: unknown }).kayaks)
            ? (typesPayload as { kayaks: BoatType[] }).kayaks
            : [];

      if (boatTypesArray.length > 0) setBoatTypes(boatTypesArray);

      const scheduleRes = await api.get("/kayaks/admin/schedule");
      const schedulePayload: unknown = scheduleRes.data;
      const roundsArray: AdminRoundRow[] = Array.isArray(schedulePayload)
        ? (schedulePayload as AdminRoundRow[])
        : schedulePayload &&
            typeof schedulePayload === "object" &&
            Array.isArray((schedulePayload as { data?: unknown }).data)
          ? ((schedulePayload as { data: AdminRoundRow[] }).data)
          : [];

      const formattedRounds = roundsArray.map((r) => ({
        ...r,
        boats:
          r.round_boats && r.round_boats.length > 0 ? r.round_boats : r.boats,
      }));

      setRounds(formattedRounds);
    } catch (error: unknown) {
      console.error("Fetch data error:", error);
      toast.error(getApiErrorMessage(error, "ไม่สามารถดึงข้อมูลได้"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    void fetchData();
  }, [ready]);

  const totalBoatCount = Object.values(selectedBoatsMap).reduce(
  (sum: number, qty) => sum + (Number(qty) || 0),
  0
);

  const handleToggleBoatType = (typeId: number) => {
    setSelectedBoatsMap((prev) => {
      const next = { ...prev };
      if (next[typeId] !== undefined) delete next[typeId];
      else next[typeId] = 1;
      return next;
    });
  };

  // เปลี่ยนรับได้ทั้ง number และ string
  const handleQuantityChange = (typeId: number, qty: number | string) => {
    setSelectedBoatsMap((prev) => ({ ...prev, [typeId]: qty }));
  };

  // ตรวจสอบเมื่อโฟกัสหลุดจากช่องพิมพ์ (OnBlur) หากเป็นค่าว่างหรือน้อยกว่า 1 ให้กลับเป็น 1
  const handleQuantityBlur = (typeId: number) => {
    setSelectedBoatsMap((prev) => {
      const currentVal = prev[typeId];
      const parsed = parseInt(String(currentVal), 10);
      return {
        ...prev,
        [typeId]: isNaN(parsed) || parsed < 1 ? 1 : parsed,
      };
    });
  };

  const handleResetForm = () => {
    setEditingRoundId(null);
    setStartTime("15:00");
    setEndTime("16:00");
    setIsActive(true);
    setSelectedBoatsMap({});
    setIsDropdownOpen(false);
  };

  const handleSubmitForm = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const selectedBoatEntries = Object.entries(selectedBoatsMap);

    if (selectedBoatEntries.length === 0) {
      toast.error("กรุณาเลือกประเภทเรืออย่างน้อย 1 ประเภท");
      return;
    }

    try {
      const boatsPayload = selectedBoatEntries.map(([id, qty]) => ({
        boat_type_id: Number(id),
        quantity: Math.max(1, Number(qty) || 1),
      }));

      const payload = {
        start_time: cleanTimeForBackend(startTime),
        end_time: cleanTimeForBackend(endTime),
        total_slots: totalBoatCount,
        is_active: isActive,
        boats: boatsPayload,
      };

      if (editingRoundId) {
        await api.put(`/kayaks/rounds/${editingRoundId}`, payload);
        toast.success("อัปเดตรอบเวลาเรียบร้อย");
      } else {
        await api.post("/kayaks/rounds", payload);
        toast.success("เพิ่มรอบเวลาสำเร็จ");
      }
      handleResetForm();
      await fetchData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "เกิดข้อผิดพลาดในการบันทึก"));
    }
  };

  const renderBoatChips = (round: BoatRound) => {
    if (round.boats && Array.isArray(round.boats) && round.boats.length > 0) {
      return round.boats.map((b, idx) => {
        const matchedType = boatTypes.find(
          (bt) => String(boatTypeKey(bt)) === String(b.boat_type_id)
        );

        const name =
          b.type_name ||
          (matchedType ? boatTypeLabel(matchedType) : "") ||
          `ประเภทเรือ ${b.boat_type_id}`;

        return (
          <span
            key={b.boat_type_id ?? idx}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-900 border border-emerald-200/80 rounded-lg text-xs font-semibold shadow-2xs"
          >
            <Ship size={13} className="text-[#0b3b2c]" />
            <span>{name}</span>
            <span className="px-1.5 py-0.5 bg-[#0b3b2c] text-white rounded-md text-[10px] font-bold">
              {b.quantity} ลำ
            </span>
          </span>
        );
      });
    }

    if (round.boat_type_id) {
      const matchedType = boatTypes.find(
        (bt) => String(boatTypeKey(bt)) === String(round.boat_type_id)
      );

      const name =
        round.type_name ||
        (matchedType ? boatTypeLabel(matchedType) : "") ||
        `ประเภทเรือ ${round.boat_type_id}`;

      const total = round.total_slots || round.max_booking || 1;

      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-900 border border-emerald-200/80 rounded-lg text-xs font-semibold shadow-2xs">
          <Ship size={13} className="text-[#0b3b2c]" />
          <span>{name}</span>
          <span className="px-1.5 py-0.5 bg-[#0b3b2c] text-white rounded-md text-[10px] font-bold">
            {total} ลำ
          </span>
        </span>
      );
    }

    return (
      <span className="text-stone-400 text-xs italic">ไม่มีข้อมูลเรือ</span>
    );
  };

  const handleEditClick = (round: BoatRound) => {
    setEditingRoundId(round.boat_round_id);
    setStartTime(round.start_time.slice(0, 5));
    setEndTime(round.end_time.slice(0, 5));
    setIsActive(round.is_active);

    const newMap: Record<number, number> = {};
    const boatList =
      round.boats && round.boats.length > 0 ? round.boats : round.round_boats;

    if (boatList && boatList.length > 0) {
      boatList.forEach((b) => {
        if (b.boat_type_id) {
          newMap[b.boat_type_id] = Number(b.quantity) || 1;
        }
      });
    } else if (round.boat_type_id) {
      newMap[round.boat_type_id] = round.total_slots || round.max_booking || 1;
    }

    setSelectedBoatsMap(newMap);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteRoundId) return;
    try {
      await api.delete(`/kayaks/rounds/${deleteRoundId}`);
      toast.success("ลบรอบเวลาเรียบร้อยแล้ว");
      setDeleteRoundId(null);
      await fetchData();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "เกิดข้อผิดพลาดในการลบ"));
    }
  };

  if (!ready) return null;

  return (
    <div className="w-full min-h-screen flex flex-col font-sans space-y-6 pb-12 text-stone-800">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-stone-200/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-[#0b3b2c]/10 text-[#0b3b2c] rounded-xl">
              <Clock size={20} />
            </span>
            <h1 className="font-display text-2xl md:text-3xl font-bold text-[#0b3b2c] tracking-tight">
              จัดการรอบเวลาพายเรือ
            </h1>
          </div>
          <p className="text-stone-500 mt-1 text-xs md:text-sm">
            รอบหนึ่งช่วงเวลา เลือกได้หลายประเภท — จำนวนลำคือเพดานจองในรอบนั้น
          </p>
        </div>

        <div className="px-3.5 py-2 bg-white rounded-xl border border-stone-200/80 shadow-xs flex items-center gap-3 w-fit">
          <div className="w-8 h-8 rounded-lg bg-[#0b3b2c]/10 flex items-center justify-center text-[#0b3b2c]">
            <Clock size={18} />
          </div>
          <div>
            <span className="text-[10px] font-semibold text-stone-400 block leading-tight">
              รอบเปิดบริการ
            </span>
            <span className="text-xs font-bold text-[#0b3b2c]">
              {rounds.length} รอบเวลา
            </span>
          </div>
        </div>
      </div>

      {/* 📥 FORM */}
      <form
        ref={formRef}
        onSubmit={handleSubmitForm}
        className={`bg-white p-4 rounded-2xl border transition-all duration-300 space-y-3 ${
          editingRoundId
            ? "border-amber-400 ring-2 ring-amber-400/20 shadow-md"
            : "border-stone-200/80 shadow-xs"
        }`}
      >
        <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
          <span className="text-xs font-bold text-[#0b3b2c] flex items-center gap-1.5">
            {editingRoundId ? (
              <Edit2 size={16} className="text-amber-600" />
            ) : (
              <Plus size={16} />
            )}
            {editingRoundId ? "แก้ไขข้อมูลรอบเวลา" : "เพิ่มรอบเวลาใหม่"}
          </span>
          {editingRoundId && (
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
          <div className="md:col-span-2">
            <ThaiTimePicker
              label="เวลาเริ่มต้น"
              value={startTime}
              onChange={setStartTime}
              required
            />
          </div>

          <div className="md:col-span-2">
            <ThaiTimePicker
              label="เวลาสิ้นสุด"
              value={endTime}
              onChange={setEndTime}
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              รวมโควตาในรอบนี้ (ลำ)
            </label>
            <input
              type="number"
              readOnly
              value={totalBoatCount}
              className="w-full px-3 py-2 bg-stone-100 border border-stone-200 rounded-xl text-xs font-bold text-stone-700 focus:outline-none cursor-not-allowed"
            />
          </div>

          {/* Dropdown ประเภทเรือ */}
          <div className="md:col-span-3 relative" ref={dropdownRef}>
            <label className="block text-[11px] font-bold text-stone-700 mb-1">
              ประเภทเรือ <span className="text-rose-500">*</span>
            </label>

            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-semibold text-stone-800 focus:bg-white flex items-center justify-between text-left cursor-pointer"
            >
              <span className="truncate">
                {Object.keys(selectedBoatsMap).length > 0
                  ? `เลือกแล้ว ${Object.keys(selectedBoatsMap).length} ประเภท (${totalBoatCount} ลำ)`
                  : "-- เลือกประเภทเรือ --"}
              </span>
              <ChevronDown size={14} className="text-stone-400 shrink-0 ml-1" />
            </button>

            {isDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-30 p-2 space-y-2 max-h-60 overflow-y-auto">
                {boatTypes.map((bt, index) => {
                  const id = boatTypeKey(bt);
                  const name = boatTypeLabel(bt);
                  if (id == null) return null;
                  const isSelected = selectedBoatsMap[id] !== undefined;
                  const rawQty = selectedBoatsMap[id] ?? 1;
                  const currentNum = Number(rawQty) || 0;

                  return (
                    <div
                      key={id ?? index}
                      className={`p-2 rounded-xl text-xs transition-colors border ${
                        isSelected
                          ? "bg-[#0b3b2c]/5 border-[#0b3b2c]/20"
                          : "bg-white border-stone-100 hover:bg-stone-50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 cursor-pointer flex-1 py-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleBoatType(id)}
                            className="w-4 h-4 text-[#0b3b2c] rounded cursor-pointer"
                          />
                          <span className="font-semibold text-stone-800 select-none">
                            {name}
                          </span>
                        </label>

                        {isSelected && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center border border-stone-200 rounded-lg bg-white overflow-hidden shadow-2xs">
                              {/* ปุ่มลด */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuantityChange(
                                    id,
                                    Math.max(1, currentNum - 1)
                                  );
                                }}
                                disabled={currentNum <= 1}
                                className="w-6 h-6 flex items-center justify-center text-stone-600 hover:bg-stone-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                              >
                                <Minus size={12} />
                              </button>

                              {/* ช่องพิมพ์จำนวน (อนุญาตให้ลบว่างได้) */}
                              <input
                                type="number"
                                min={1}
                                value={rawQty}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === "") {
                                    handleQuantityChange(id, "");
                                  } else {
                                    handleQuantityChange(
                                      id,
                                      parseInt(val, 10)
                                    );
                                  }
                                }}
                                onBlur={() => handleQuantityBlur(id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-10 text-center text-xs font-bold text-stone-800 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />

                              {/* ปุ่มเพิ่ม */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuantityChange(id, currentNum + 1);
                                }}
                                className="w-6 h-6 flex items-center justify-center text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                              >
                                <Plus size={12} />
                              </button>
                            </div>

                            <span className="text-[11px] font-semibold text-stone-500 select-none">
                              ลำ
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="md:col-span-1 flex items-center justify-center pb-2">
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-[#0b3b2c] rounded cursor-pointer"
              />
              <span className="text-xs font-bold text-stone-700">เปิด</span>
            </label>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className={`w-full py-2 px-3 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                editingRoundId
                  ? "bg-amber-600 hover:bg-amber-700"
                  : "bg-[#0b3b2c] hover:bg-[#07271d]"
              }`}
            >
              {editingRoundId ? <Save size={14} /> : <Plus size={14} />}
              <span>{editingRoundId ? "บันทึกการแก้ไข" : "เพิ่มรอบเวลา"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* 📋 TABLE LIST */}
      <div className="bg-white rounded-2xl border border-stone-200/80 shadow-xs overflow-hidden">
        <div className="p-4 bg-stone-50/80 border-b border-stone-200/80 flex items-center justify-between">
          <h3 className="font-bold text-stone-900 text-sm md:text-base flex items-center gap-2">
            <Clock size={16} className="text-[#0b3b2c]" />
            ตารางรอบเวลาจากฐานข้อมูล
          </h3>
        </div>

        <div className="divide-y divide-stone-100">
          {loading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-stone-400 text-xs">
              <Loader2 className="animate-spin" size={18} />
              กำลังโหลดข้อมูล...
            </div>
          ) : rounds.length > 0 ? (
            rounds.map((round, index) => (
              <div
                key={round.boat_round_id ?? index}
                className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                  !round.is_active
                    ? "bg-stone-50/50 opacity-70"
                    : "hover:bg-stone-50/60"
                }`}
              >
                <div className="flex items-center gap-3 min-w-[220px]">
                  <div className="flex items-center gap-2 text-sm md:text-base font-bold text-stone-900">
                    <Clock size={16} className="text-[#0b3b2c]" />
                    {formatThaiDisplay(round.start_time)} -{" "}
                    {formatThaiDisplay(round.end_time)}
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                      round.is_active
                        ? "bg-emerald-100/80 text-emerald-800 border-emerald-200/60"
                        : "bg-stone-100 text-stone-500 border-stone-200"
                    }`}
                  >
                    {round.is_active ? "เปิด" : "ปิด"}
                  </span>
                </div>

                <div className="flex-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-bold text-stone-400 mr-1 hidden lg:inline">
                    ประเภทเรือ:
                  </span>
                  {renderBoatChips(round)}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditClick(round)}
                    className="p-2 text-stone-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg cursor-pointer"
                    title="แก้ไข"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteRoundId(round.boat_round_id)}
                    className="p-2 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                    title="ลบ"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-xs text-stone-400">
              ไม่พบข้อมูลรอบเวลา
            </div>
          )}
        </div>
      </div>

      {/* MODAL DELETE */}
      {deleteRoundId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                ยืนยันการลบรอบเวลา
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                ต้องการลบรอบเวลานี้ใช่หรือไม่?
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteRoundId(null)}
                className="px-4 py-2 bg-stone-100 text-stone-700 rounded-xl text-xs font-bold w-full cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold w-full cursor-pointer"
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