"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X, Calendar } from "lucide-react";
import { toISODate, fromISODate } from "@/lib/date";

export interface CustomDatePickerProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
  buttonClassName?: string;
  showCalendarIcon?: boolean;
  allowClear?: boolean;
  min?: string;
  max?: string;
  align?: "left" | "right";
  disabled?: boolean;
}

const MONTH_NAMES = [
  "มกราคม",
  "กุมภาพันธ์",
  "มีนาคม",
  "เมษายน",
  "พฤษภาคม",
  "มิถุนายน",
  "กรกฎาคม",
  "สิงหาคม",
  "กันยายน",
  "ตุลาคม",
  "พฤศจิกายน",
  "ธันวาคม",
];

const WEEKDAY_NAMES = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];

export function CustomDatePicker({
  value,
  onChange,
  placeholder = "เลือกวันที่",
  className = "relative inline-block",
  buttonClassName,
  showCalendarIcon = false,
  allowClear = true,
  min,
  max,
  align = "left",
  disabled = false,
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  const selectedDate = value ? fromISODate(value) : null;
  const [viewDate, setViewDate] = useState(() => selectedDate || new Date());

  useEffect(() => {
    if (value) {
      setViewDate(fromISODate(value));
    }
  }, [value]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    setViewDate(new Date(year, month + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const formattedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    onChange(formattedDate);
    setIsOpen(false);
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
  };

  const isDisabled = (day: number) => {
    if (disabled) return true;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (min && dateStr < min) return true;
    if (max && dateStr > max) return true;
    return false;
  };

  const defaultBtnClass =
    "flex items-center justify-between w-[86px] sm:w-[94px] bg-cream-50/80 hover:bg-white px-2.5 py-1.5 rounded-xl border border-cream-300 hover:border-forest-300 text-xs font-mono text-charcoal-700 transition-all shadow-xs focus:outline-none focus:ring-2 focus:ring-forest-500/20";

  return (
    <div className={className} ref={datePickerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={buttonClassName || defaultBtnClass}
      >
        <span className="flex items-center gap-1.5 truncate text-left">
          {showCalendarIcon && <Calendar size={13} className="shrink-0 text-forest-700" />}
          <span className="truncate">
            {value
              ? fromISODate(value).toLocaleDateString("th-TH", {
                  day: "numeric",
                  month: "short",
                  year: "2-digit",
                })
              : placeholder}
          </span>
        </span>
        {value && allowClear && !disabled && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="hover:text-rose-600 text-charcoal-400 p-0.5 ml-1 shrink-0 transition-colors"
            title="ล้างค่า"
          >
            <X size={12} />
          </span>
        )}
      </button>

      {isOpen && !disabled && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } top-full mt-2 w-64 bg-white border border-cream-200/90 rounded-2xl shadow-xl z-50 p-3.5 animate-in fade-in zoom-in-95 duration-150`}
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-cream-200">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg hover:bg-cream-100 text-charcoal-600 transition-colors"
              title="เดือนก่อนหน้า"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-forest-900">
              {MONTH_NAMES[month]} {year + 543}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg hover:bg-cream-100 text-charcoal-600 transition-colors"
              title="เดือนถัดไป"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[11px] font-bold text-charcoal-400 mb-1">
            {WEEKDAY_NAMES.map((w, idx) => (
              <span key={w} className={idx === 0 ? "text-rose-500" : ""}>
                {w}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const selected = isSelected(day);
              const today = isToday(day);
              const disabledDay = isDisabled(day);

              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabledDay}
                  onClick={() => handleSelectDay(day)}
                  className={`h-7 w-7 rounded-xl text-xs font-medium flex items-center justify-center transition-all ${
                    disabledDay
                      ? "text-charcoal-300 cursor-not-allowed opacity-40"
                      : selected
                      ? "bg-forest-800 text-white font-bold shadow-xs scale-105"
                      : today
                      ? "bg-forest-50 text-forest-800 font-bold border border-forest-200"
                      : "text-charcoal-700 hover:bg-cream-100"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2.5 mt-2.5 border-t border-cream-200 text-xs">
            <button
              type="button"
              onClick={() => {
                const todayStr = toISODate(new Date());
                onChange(todayStr);
                setIsOpen(false);
              }}
              className="text-forest-800 font-bold hover:underline"
            >
              วันนี้
            </button>
            {allowClear && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                }}
                className="text-charcoal-400 hover:text-charcoal-600"
              >
                ล้างค่า
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
