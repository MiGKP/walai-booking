"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";

export interface CustomSelectOption {
  value: string | number;
  label: string;
}

export interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string | number;
  onChange: (val: any) => void;
  placeholder?: string;
  width?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  align?: "left" | "right";
  disabled?: boolean;
  prefix?: React.ReactNode;
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = "เลือก...",
  width = "w-full",
  className = "",
  buttonClassName,
  menuClassName = "",
  align = "left",
  disabled = false,
  prefix,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const defaultBtnClass =
    "w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-cream-50/80 hover:bg-white border border-cream-300 hover:border-forest-300 rounded-xl text-xs font-semibold text-charcoal-700 transition-all focus:outline-none focus:ring-2 focus:ring-forest-500/20 shadow-xs";

  return (
    <div className={`relative ${width} ${className}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          if (!disabled) setIsOpen(!isOpen);
        }}
        className={buttonClassName || defaultBtnClass}
      >
        <span className="flex items-center gap-1.5 truncate text-left">
          {prefix}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-charcoal-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-forest-800" : ""
          }`}
        />
      </button>

      {isOpen && !disabled && (
        <div
          className={`absolute ${
            align === "right" ? "right-0" : "left-0"
          } top-full mt-1.5 w-full min-w-max bg-white border border-cream-200/90 rounded-2xl shadow-xl z-50 overflow-hidden py-1 max-h-56 overflow-y-auto animate-in fade-in duration-150 ${menuClassName}`}
        >
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2 text-xs font-medium transition-colors flex items-center justify-between gap-3 ${
                  isSelected
                    ? "bg-forest-50 text-forest-900 font-bold"
                    : "text-charcoal-600 hover:bg-cream-100 hover:text-charcoal-900"
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-forest-800 shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
