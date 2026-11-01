"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";

interface ChildAgeSelectProps {
  index: number;
  value: number | null;
  maxAge: number;
  hasError?: boolean;
  onChange: (age: number) => void;
}

// แสดงดรอปดาวน์สำหรับเลือกอายุของเด็กรายคนพร้อมแสดงสถานะแจ้งเตือนเมื่อยังไม่เลือก
export default function ChildAgeSelect({
  index,
  value,
  maxAge,
  hasError = false,
  onChange,
}: ChildAgeSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isSelected = value !== null;

  useEffect(() => {
    // ปิดดรอปดาวน์เลือกอายุเด็กเมื่อคลิกนอกพื้นที่คอมโพเนนต์
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      className={`relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs transition-all ${
        isOpen ? "z-30" : "z-10"
      } ${
        hasError && !isSelected
          ? "bg-rose-50/60 border-2 border-rose-400 ring-2 ring-rose-400/20"
          : isSelected
          ? "bg-white border border-cream-200 shadow-2xs"
          : "bg-cream-50/40 border border-cream-200"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-extrabold ${
            hasError && !isSelected
              ? "bg-rose-100 text-rose-700"
              : "bg-forest-800/10 text-forest-800"
          }`}
        >
          {index + 1}
        </span>
        <span className="text-xs font-semibold text-charcoal-700">
          คนที่ {index + 1}
        </span>
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            setIsOpen(!isOpen);
          }}
          className={`min-w-[100px] flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            isOpen
              ? "border-forest-800 ring-2 ring-forest-800/20 bg-white border"
              : hasError && !isSelected
              ? "border-rose-400 bg-white text-rose-600 border"
              : isSelected
              ? "bg-cream-50/60 border border-cream-200 hover:border-cream-300 text-forest-900"
              : "bg-white border border-cream-200 hover:border-cream-300 text-charcoal-500"
          }`}
        >
          <span className="truncate">
            {isSelected ? `${value} ปี` : "เลือกอายุ"}
          </span>
          <ChevronDown
            size={14}
            className={`shrink-0 transition-transform duration-200 ${
              isOpen
                ? "rotate-180 text-forest-800"
                : hasError && !isSelected
                ? "text-rose-500"
                : "text-charcoal-400"
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-32 bg-white border border-cream-200 rounded-xl shadow-lg z-50 overflow-hidden py-1 max-h-48 overflow-y-auto animate-in fade-in duration-150">
            {Array.from({ length: maxAge + 1 }, (_, a) => {
              const isItemActive = value === a;
              return (
                <button
                  key={a}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onChange(a);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer ${
                    isItemActive
                      ? "bg-forest-50 text-forest-800 font-bold"
                      : "text-charcoal-700 hover:bg-cream-50"
                  }`}
                >
                  <span>{a} ปี</span>
                  {isItemActive && (
                    <Check size={12} className="text-forest-800 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
