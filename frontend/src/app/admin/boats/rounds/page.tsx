"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
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
  Check,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import api, { getApiErrorMessage } from "@/lib/api";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { notify } from "@/lib/admin-notify";
import { Modal, EmptyState } from "@/components/admin/ui";

export interface BoatType {
  boat_type_id?: number;
  id?: number;
  type_name?: string;
  name?: string;
  quantity?: number;
  is_active?: boolean;
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
// CUSTOM TIME PICKER COMPONENT (เวลาไทย 24 ชม. ดีไซน์ละมุน)
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
      <label className="block text-xs font-bold text-charcoal-700 mb-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3.5 py-2.5 bg-cream-50/60 border border-cream-300 rounded-xl text-xs font-bold text-charcoal-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-forest-800/20 focus:border-forest-800 flex items-center justify-between cursor-pointer transition-all shadow-2xs"
      >
        <span>{value || "00:00"} น.</span>
        <Clock size={15} className="text-charcoal-400 shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-60 bg-white border border-cream-200 rounded-2xl shadow-panel z-50 p-2.5 text-charcoal-800 animate-in fade-in zoom-in-95 duration-150">
          <div className="text-xs font-bold text-charcoal-400 px-2 py-1 border-b border-cream-100 flex justify-between">
            <span>ชั่วโมง (00-23)</span>
            <span>นาที (00-59)</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 h-48 mt-1.5">
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
                    className={`w-full py-1.5 rounded-xl text-xs font-bold font-mono transition-colors cursor-pointer text-center ${
                      isSelected
                        ? "bg-forest-800 text-white shadow-xs"
                        : "hover:bg-cream-100 text-charcoal-700"
                    }`}
                  >
                    {h}
                  </button>
                );
              })}
            </div>

            <div
              ref={minuteContainerRef}
              className="overflow-y-auto pl-1.5 space-y-0.5 border-l border-cream-100 scrollbar-thin"
            >
              {minuteOptions.map((m) => {
                const isSelected = minutes === m;
                return (
                  <button
                    key={`m-${m}`}
                    type="button"
                    data-selected={isSelected}
                    onClick={() => handleSelectMinute(m)}
                    className={`w-full py-1.5 rounded-xl text-xs font-bold font-mono transition-colors cursor-pointer text-center ${
                      isSelected
                        ? "bg-forest-800 text-white shadow-xs"
                        : "hover:bg-cream-100 text-charcoal-700"
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
            className="w-full mt-2.5 py-1.5 bg-cream-100 hover:bg-cream-200 text-charcoal-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
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

      const [typesRes, scheduleRes] = await Promise.all([
        api.get("/kayaks/admin/types").catch(() => api.get("/kayaks/types")),
        api.get("/kayaks/admin/schedule"),
      ]);

      const typesPayload: unknown = typesRes.data;
      const boatTypesArray: BoatType[] = Array.isArray(typesPayload)
        ? typesPayload
        : typesPayload &&
            typeof typesPayload === "object" &&
            Array.isArray((typesPayload as { data?: unknown }).data)
          ? ((typesPayload as { data: BoatType[] }).data)
          : typesPayload &&
              typeof typesPayload === "object" &&
              Array.isArray((typesPayload as { kayaks?: unknown }).kayaks)
            ? ((typesPayload as { kayaks: BoatType[] }).kayaks)
            : [];

      if (boatTypesArray.length > 0) setBoatTypes(boatTypesArray);

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
      notify.error(getApiErrorMessage(error, "ไม่สามารถดึงข้อมูลได้"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    void fetchData();
  }, [ready]);

  // รวมโควตาเรือที่เลือกในฟอร์มปัจจุบัน
  const totalBoatCount = useMemo(() => {
    return Object.values(selectedBoatsMap).reduce(
      (sum: number, qty) => sum + (Number(qty) || 0),
      0
    );
  }, [selectedBoatsMap]);

  // สถิติรอบเวลา
  const activeRoundsCount = useMemo(
    () => rounds.filter((r) => r.is_active).length,
    [rounds]
  );
  const inactiveRoundsCount = useMemo(
    () => rounds.filter((r) => !r.is_active).length,
    [rounds]
  );

  // จำนวนเรือจริงทั้งหมดในระบบ (Physical Fleet) จากฐานข้อมูล
  const totalFleetBoats = useMemo(() => {
    return boatTypes.reduce((sum, bt) => sum + (Number(bt.quantity) || 0), 0);
  }, [boatTypes]);

  // Pagination (10 items per page)
  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState<number>(1);
  const totalPages = Math.ceil(rounds.length / ITEMS_PER_PAGE) || 1;

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedRounds = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return rounds.slice(start, start + ITEMS_PER_PAGE);
  }, [rounds, currentPage]);

  const handleToggleBoatType = (typeId: number) => {
    setSelectedBoatsMap((prev) => {
      const next = { ...prev };
      if (next[typeId] !== undefined) {
        delete next[typeId];
      } else {
        next[typeId] = 1;
      }
      return next;
    });
  };

  const handleQuantityChange = (typeId: number, qty: number | string) => {
    setSelectedBoatsMap((prev) => ({ ...prev, [typeId]: qty }));
  };

  const handleQuantityBlur = (typeId: number, maxFleet?: number) => {
    setSelectedBoatsMap((prev) => {
      const currentVal = prev[typeId];
      const parsed = parseInt(String(currentVal), 10);
      let finalVal = isNaN(parsed) || parsed < 1 ? 1 : parsed;
      if (maxFleet && maxFleet > 0 && finalVal > maxFleet) {
        finalVal = maxFleet;
      }
      return {
        ...prev,
        [typeId]: finalVal,
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
      notify.error("กรุณาเลือกประเภทเรืออย่างน้อย 1 ประเภท");
      return;
    }

    // ตรวจสอบตรรกะ: ห้ามใส่จำนวนเกินกว่าจำนวนเรือจริงที่มีในระบบ
    for (const [idStr, qtyRaw] of selectedBoatEntries) {
      const typeId = Number(idStr);
      const qty = Number(qtyRaw) || 1;
      const matched = boatTypes.find((bt) => boatTypeKey(bt) === typeId);
      const maxFleet = Number(matched?.quantity) || 0;
      if (maxFleet > 0 && qty > maxFleet) {
        notify.error(
          `ประเภทเรือ "${boatTypeLabel(matched!)}" มีในระบบทั้งหมด ${maxFleet} ลำ (ไม่สามารถกำหนด ${qty} ลำได้)`
        );
        return;
      }
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
        notify.success("อัปเดตรอบเวลาเรียบร้อย");
      } else {
        await api.post("/kayaks/rounds", payload);
        notify.success("เพิ่มรอบเวลาสำเร็จ");
      }
      handleResetForm();
      await fetchData();
    } catch (error: unknown) {
      notify.error(getApiErrorMessage(error, "เกิดข้อผิดพลาดในการบันทึก"));
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cream-100 text-charcoal-800 border border-cream-200/90 rounded-xl text-xs font-semibold shadow-2xs"
          >
            <Ship size={13} className="text-forest-700" />
            <span>{name}</span>
            <span className="px-1.5 py-0.5 bg-forest-800 text-white rounded-md text-xs font-bold font-mono">
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
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-cream-100 text-charcoal-800 border border-cream-200/90 rounded-xl text-xs font-semibold shadow-2xs">
          <Ship size={13} className="text-forest-700" />
          <span>{name}</span>
          <span className="px-1.5 py-0.5 bg-forest-800 text-white rounded-md text-xs font-bold font-mono">
            {total} ลำ
          </span>
        </span>
      );
    }

    return (
      <span className="text-charcoal-400 text-xs italic">ไม่มีข้อมูลเรือ</span>
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
      notify.success("ลบรอบเวลาเรียบร้อยแล้ว");
      setDeleteRoundId(null);
      await fetchData();
    } catch (error: unknown) {
      notify.error(getApiErrorMessage(error, "เกิดข้อผิดพลาดในการลบ"));
      setDeleteRoundId(null);
    }
  };

  if (!ready) return null;

  return (
    <div className="space-y-6 pb-16 max-w-[1600px] mx-auto">
      {/* Top Header Card (สไตล์ละมุนแบบหน้า /admin/checkin) */}
      <div className="bg-white rounded-3xl p-6 shadow-panel border border-cream-200/80 relative">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-2xl bg-forest-800 text-white flex items-center justify-center shadow-md shadow-forest-800/10 shrink-0">
                <Clock size={20} className="stroke-[2.2]" />
              </span>
              <div>
                <h1 className="font-display text-2xl lg:text-3xl font-bold text-forest-900 tracking-tight">
                  จัดการรอบเวลาพายเรือ
                </h1>
              </div>
            </div>
          </div>

          {/* Quick Info Badge */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="px-3.5 py-2 bg-cream-50/80 rounded-2xl border border-cream-300 shadow-2xs flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-forest-100 flex items-center justify-center text-forest-800">
                <Clock size={16} />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-charcoal-400 block leading-tight">
                  รอบเปิดบริการ
                </span>
                <span className="text-xs font-bold text-forest-900 font-mono">
                  {rounds.length} รอบเวลา
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Overview Stat Cards (KPI Summary สไตล์ละมุนแบบหน้า /admin/checkin) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Card 1: Total Rounds */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-forest-700 uppercase tracking-wider">
                รอบเวลาทั้งหมด
              </p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight font-mono">
                {rounds.length}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">
                  รอบ
                </span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400">รอบที่ตั้งค่าในระบบ</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-forest-50 text-forest-800 border border-forest-100 flex items-center justify-center shrink-0">
              <Clock size={20} />
            </div>
          </div>
        </div>

        {/* Card 2: Active Rounds */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-forest-700 uppercase tracking-wider">
                เปิดให้บริการ
              </p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight font-mono">
                {activeRoundsCount}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">
                  รอบ
                </span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400">พร้อมรับการจองเรือ</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center shrink-0">
              <Check size={20} />
            </div>
          </div>
        </div>

        {/* Card 3: Inactive Rounds */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-charcoal-600 uppercase tracking-wider">
                ปิดชั่วคราว
              </p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-charcoal-700 tracking-tight font-mono">
                {inactiveRoundsCount}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">
                  รอบ
                </span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400">งดรับการจองชั่วคราว</p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-charcoal-50 text-charcoal-600 border border-charcoal-200 flex items-center justify-center shrink-0">
              <X size={20} />
            </div>
          </div>
        </div>

        {/* Card 4: Total Physical Fleet (เรือจริงในระบบทั้งหมด) */}
        <div className="relative p-4 sm:p-5 rounded-3xl bg-white border border-cream-200/90 shadow-panel">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-forest-700 uppercase tracking-wider">
                เรือจริงในระบบทั้งหมด
              </p>
              <p className="mt-1.5 font-display text-3xl sm:text-4xl font-bold text-forest-950 tracking-tight font-mono">
                {totalFleetBoats}
                <span className="text-xs sm:text-sm font-normal text-charcoal-400 ml-1.5 font-sans">
                  ลำ
                </span>
              </p>
              <p className="mt-1 text-[11px] text-charcoal-400">
                รวม {boatTypes.length} ประเภทเรือที่มีในรีสอร์ท
              </p>
            </div>
            <div className="w-11 h-11 rounded-2xl bg-forest-50 text-forest-800 border border-forest-100 flex items-center justify-center shrink-0">
              <Ship size={20} />
            </div>
          </div>
        </div>
      </div>

      {/* FORM: Card Form สำหรับเพิ่ม/แก้ไขรอบเวลา (จัดลำดับฟิลด์อย่างมีตรรกะ) */}
      <form
        ref={formRef}
        onSubmit={handleSubmitForm}
        className={`bg-white p-5 sm:p-6 rounded-3xl border transition-all duration-300 space-y-4 shadow-panel ${
          editingRoundId
            ? "border-forest-600 ring-2 ring-forest-600/20"
            : "border-cream-200/90"
        }`}
      >
        <div className="flex items-center justify-between border-b border-cream-200/80 pb-3">
          <span className="text-sm font-bold text-forest-900 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-forest-800" />
            {editingRoundId ? (
              <span className="flex items-center gap-1.5 text-forest-800">
                <Edit2 size={16} />
                แก้ไขข้อมูลรอบเวลา
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Plus size={16} />
                เพิ่มรอบเวลาใหม่
              </span>
            )}
          </span>
          {editingRoundId && (
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
          {/* 1. เวลาเริ่มต้น */}
          <div className="md:col-span-2">
            <ThaiTimePicker
              label="เวลาเริ่มต้น"
              value={startTime}
              onChange={setStartTime}
              required
            />
          </div>

          {/* 2. เวลาสิ้นสุด */}
          <div className="md:col-span-2">
            <ThaiTimePicker
              label="เวลาสิ้นสุด"
              value={endTime}
              onChange={setEndTime}
              required
            />
          </div>

          {/* 3. ประเภทเรือ (เลือกประเภทและจำนวนเรือ ไม่เกินเรือจริงในระบบ) */}
          <div className="md:col-span-3 relative" ref={dropdownRef}>
            <label className="block text-xs font-bold text-charcoal-700 mb-1">
              ประเภทเรือ <span className="text-rose-500">*</span>
            </label>

            <button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="w-full px-3.5 py-2.5 bg-cream-50/60 border border-cream-300 rounded-xl text-xs font-semibold text-charcoal-800 focus:bg-white flex items-center justify-between text-left cursor-pointer transition-all shadow-2xs"
            >
              <span className="truncate">
                {Object.keys(selectedBoatsMap).length > 0
                  ? `เลือกแล้ว ${Object.keys(selectedBoatsMap).length} ประเภท (${totalBoatCount} ลำ)`
                  : "-- เลือกประเภทเรือ --"}
              </span>
              <ChevronDown size={14} className="text-charcoal-400 shrink-0 ml-1" />
            </button>

            {isDropdownOpen && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-cream-200 rounded-2xl shadow-panel z-30 p-2.5 space-y-2 max-h-64 overflow-y-auto">
                {boatTypes.map((bt, index) => {
                  const id = boatTypeKey(bt);
                  const name = boatTypeLabel(bt);
                  if (id == null) return null;
                  const maxFleet = Number(bt.quantity) || 0;
                  const isSelected = selectedBoatsMap[id] !== undefined;
                  const rawQty = selectedBoatsMap[id] ?? 1;
                  const currentNum = Number(rawQty) || 0;

                  return (
                    <div
                      key={id ?? index}
                      className={`p-2.5 rounded-xl text-xs transition-colors border ${
                        isSelected
                          ? "bg-forest-50/80 border-forest-200"
                          : "bg-white border-cream-200/70 hover:bg-cream-50/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 cursor-pointer flex-1 py-0.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleBoatType(id)}
                            className="w-4 h-4 text-forest-800 rounded border-cream-300 focus:ring-forest-800 accent-forest-800 cursor-pointer"
                          />
                          <div className="flex flex-col select-none">
                            <span className="font-semibold text-charcoal-800">
                              {name}
                            </span>
                            <span className="text-[10px] text-charcoal-400">
                              (มีในระบบทั้งหมด {maxFleet > 0 ? `${maxFleet} ลำ` : "ไม่จำกัด"})
                            </span>
                          </div>
                        </label>

                        {isSelected && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <div className="flex items-center border border-cream-300 rounded-lg bg-white overflow-hidden shadow-2xs">
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
                                className="w-6 h-6 flex items-center justify-center text-charcoal-600 hover:bg-cream-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                              >
                                <Minus size={12} />
                              </button>

                              {/* ช่องพิมพ์จำนวน */}
                              <input
                                type="number"
                                min={1}
                                max={maxFleet > 0 ? maxFleet : undefined}
                                value={rawQty}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (val === "") {
                                    handleQuantityChange(id, "");
                                  } else {
                                    const parsed = parseInt(val, 10);
                                    if (isNaN(parsed)) {
                                      handleQuantityChange(id, "");
                                    } else if (maxFleet > 0 && parsed > maxFleet) {
                                      notify.info(`ประเภทเรือ "${name}" มีในระบบทั้งหมด ${maxFleet} ลำ`);
                                      handleQuantityChange(id, maxFleet);
                                    } else {
                                      handleQuantityChange(id, Math.max(1, parsed));
                                    }
                                  }
                                }}
                                onBlur={() => handleQuantityBlur(id, maxFleet)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-10 text-center text-xs font-bold text-charcoal-800 bg-transparent focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              />

                              {/* ปุ่มเพิ่ม */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (maxFleet > 0 && currentNum >= maxFleet) {
                                    notify.info(`ประเภทเรือ "${name}" มีในระบบทั้งหมด ${maxFleet} ลำ`);
                                    return;
                                  }
                                  handleQuantityChange(id, currentNum + 1);
                                }}
                                disabled={maxFleet > 0 && currentNum >= maxFleet}
                                className="w-6 h-6 flex items-center justify-center text-charcoal-600 hover:bg-cream-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                              >
                                <Plus size={12} />
                              </button>
                            </div>

                            <span className="text-xs font-semibold text-charcoal-500 select-none">
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

          {/* 4. รวมโควตาในรอบนี้ (ลำ) - ย้ายมาอยู่หลังประเภทเรือ ตามที่ผู้ใช้สั่ง */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-charcoal-700 mb-1">
              รวมโควตาในรอบนี้ (ลำ)
            </label>
            <input
              type="number"
              readOnly
              value={totalBoatCount}
              className="w-full px-3.5 py-2.5 bg-cream-100/70 border border-cream-300 rounded-xl text-xs font-bold text-forest-900 font-mono focus:outline-none cursor-not-allowed shadow-2xs"
            />
          </div>

          {/* 5. สวิตช์เปิด/ปิด */}
          <div className="md:col-span-1 flex items-center justify-center pb-2.5">
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 text-forest-800 rounded border-cream-300 focus:ring-forest-800 accent-forest-800 cursor-pointer"
              />
              <span className="text-xs font-bold text-charcoal-700">เปิด</span>
            </label>
          </div>

          {/* 6. ปุ่ม Submit */}
          <div className="md:col-span-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-forest-800 hover:bg-forest-900 text-white rounded-xl text-xs font-bold shadow-xs hover:shadow transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-98"
            >
              {editingRoundId ? <Save size={14} /> : <Plus size={14} />}
              <span>{editingRoundId ? "บันทึกการแก้ไข" : "เพิ่มรอบเวลา"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* TABLE LIST CARD */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-panel border border-cream-200/90 overflow-hidden flex flex-col">
        <div className="pb-4 mb-4 border-b border-cream-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full bg-forest-800" />
            <h2 className="text-base font-bold text-forest-900">
              ตารางรอบเวลาจากฐานข้อมูล
            </h2>
            <span className="px-2.5 py-0.5 bg-forest-50 text-forest-800 border border-forest-200 rounded-full text-xs font-bold font-mono">
              {rounds.length} รอบเวลา
            </span>
          </div>
        </div>

        <div className="divide-y divide-cream-100 border border-cream-200/90 rounded-2xl overflow-hidden shadow-2xs">
          {loading ? (
            <div className="py-16 text-center text-charcoal-400">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-forest-800 border-t-transparent mb-3" />
              <p className="text-xs font-medium text-charcoal-500">
                กำลังโหลดข้อมูลรอบเวลา...
              </p>
            </div>
          ) : paginatedRounds.length > 0 ? (
            paginatedRounds.map((round, index) => (
              <div
                key={round.boat_round_id ?? index}
                className={`p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-colors ${
                  !round.is_active
                    ? "bg-cream-50/30 opacity-75"
                    : "hover:bg-cream-50/50 bg-white"
                }`}
              >
                <div className="flex items-center gap-3 min-w-[220px]">
                  <div className="flex items-center gap-2 text-sm md:text-base font-bold text-forest-900 font-mono">
                    <Clock size={16} className="text-forest-800 shrink-0" />
                    <span>
                      {formatThaiDisplay(round.start_time)} -{" "}
                      {formatThaiDisplay(round.end_time)}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      round.is_active
                        ? "bg-forest-50 text-forest-800 border-forest-200"
                        : "bg-cream-200 text-charcoal-600 border-cream-300"
                    }`}
                  >
                    {round.is_active ? "เปิด" : "ปิด"}
                  </span>
                </div>

                <div className="flex-1 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-bold text-charcoal-400 mr-1 hidden lg:inline">
                    ประเภทเรือ:
                  </span>
                  {renderBoatChips(round)}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleEditClick(round)}
                    className="p-1.5 text-charcoal-500 hover:text-amber-800 hover:bg-amber-50/80 rounded-xl transition-all cursor-pointer"
                    title="แก้ไข"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteRoundId(round.boat_round_id)}
                    className="p-1.5 text-charcoal-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                    title="ลบ"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8">
              <EmptyState
                title="ไม่พบข้อมูลรอบเวลา"
                description="กรุณาเพิ่มรอบเวลาใหม่ในแบบฟอร์มด้านบน"
              />
            </div>
          )}
        </div>

        {/* Pagination Footer (สไตล์แบบหน้า /admin/checkin) */}
        {rounds.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between pt-4 mt-4 border-t border-cream-200 text-xs text-charcoal-500">
            <span>
              แสดง{" "}
              <strong className="text-forest-950 font-mono">
                {(currentPage - 1) * ITEMS_PER_PAGE + 1}
              </strong>{" "}
              -{" "}
              <strong className="text-forest-950 font-mono">
                {Math.min(currentPage * ITEMS_PER_PAGE, rounds.length)}
              </strong>{" "}
              จาก{" "}
              <strong className="text-forest-950 font-mono">
                {rounds.length}
              </strong>{" "}
              รายการ
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-cream-300 bg-white text-charcoal-700 disabled:opacity-40 hover:bg-cream-50 transition-colors shadow-2xs cursor-pointer disabled:cursor-not-allowed"
                title="หน้าก่อนหน้า"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2.5 py-1 text-xs font-bold text-forest-900 font-mono">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="p-1.5 rounded-lg border border-cream-300 bg-white text-charcoal-700 disabled:opacity-40 hover:bg-cream-50 transition-colors shadow-2xs cursor-pointer disabled:cursor-not-allowed"
                title="หน้าถัดไป"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: DELETE CONFIRM */}
      <Modal
        open={!!deleteRoundId}
        title="ยืนยันการลบรอบเวลา"
        onClose={() => setDeleteRoundId(null)}
        widthClass="max-w-sm"
      >
        <div className="text-center space-y-4 py-2">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
            <AlertTriangle size={24} />
          </div>
          <p className="text-xs text-charcoal-500">
            ต้องการลบรอบเวลานี้ใช่หรือไม่? การดำเนินการนี้ไม่สามารถยกเลิกได้
          </p>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setDeleteRoundId(null)}
              className="px-4 py-2.5 bg-cream-100 hover:bg-cream-200 text-charcoal-700 rounded-xl text-xs font-bold transition-colors w-full cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors w-full cursor-pointer"
            >
              ยืนยันการลบ
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
