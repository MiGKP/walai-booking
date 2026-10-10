"use client";

import React, { useState, useEffect } from "react";
import { Plus, Trash2, Users, Sparkles, Check } from "lucide-react";

interface KidsPolicyEditorProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  helperText?: string;
}

type AgeMode = "range" | "plus" | "custom";

interface ParsedItem {
  id: string;
  mode: AgeMode;
  minAge: number;
  maxAge: number;
  plusAge: number;
  customTitle: string;
  title: string;
  detail: string;
}

const COMMON_SUGGESTIONS = [
  "เข้าพักฟรี (ใช้เตียงที่มีอยู่)",
  "คิดราคาเด็ก / เตียงเสริม",
  "คิดราคาผู้ใหญ่",
  "มีค่าบริการเตียงเสริม",
  "มีเปลเด็กให้บริการฟรี",
];

const RANGE_PRESETS = [
  { min: 0, max: 3, label: "0-3 ปี" },
  { min: 0, max: 5, label: "0-5 ปี" },
  { min: 6, max: 11, label: "6-11 ปี" },
  { min: 7, max: 12, label: "7-12 ปี" },
];

const PLUS_PRESETS = [12, 13, 16, 18];

function parseLine(line: string, index: number): ParsedItem {
  const parts = line.split(":");
  let title = parts[0]?.trim() || "";
  const detail = parts.slice(1).join(":").trim();

  // If no colon at all
  if (parts.length === 1 && !detail) {
    title = line.trim();
  }

  // Detect mode
  // 1. Range match: e.g. "เด็ก 0-5 ปี" or "0-5 ปี"
  const rangeMatch = title.match(/(?:เด็ก\s*)?(\d+)\s*(?:-|–|ถึง)\s*(\d+)\s*ปี/);
  if (rangeMatch) {
    const min = parseInt(rangeMatch[1], 10);
    const max = parseInt(rangeMatch[2], 10);
    return {
      id: `item-${index}-${Date.now()}-${Math.random()}`,
      mode: "range",
      minAge: isNaN(min) ? 0 : min,
      maxAge: isNaN(max) ? 5 : max,
      plusAge: 12,
      customTitle: "",
      title: `เด็ก ${min}-${max} ปี`,
      detail,
    };
  }

  // 2. Plus match: e.g. "12 ปีขึ้นไป" or "เด็ก 12 ปีขึ้นไป"
  const plusMatch = title.match(/(\d+)\s*ปีขึ้นไป/);
  if (plusMatch) {
    const plus = parseInt(plusMatch[1], 10);
    return {
      id: `item-${index}-${Date.now()}-${Math.random()}`,
      mode: "plus",
      minAge: 0,
      maxAge: 5,
      plusAge: isNaN(plus) ? 12 : plus,
      customTitle: "",
      title: `${plus} ปีขึ้นไป`,
      detail,
    };
  }

  // 3. Custom title
  return {
    id: `item-${index}-${Date.now()}-${Math.random()}`,
    mode: "custom",
    minAge: 0,
    maxAge: 5,
    plusAge: 12,
    customTitle: title,
    title,
    detail,
  };
}

function computeTitle(item: ParsedItem): string {
  if (item.mode === "range") {
    return `เด็ก ${item.minAge}-${item.maxAge} ปี`;
  }
  if (item.mode === "plus") {
    return `${item.plusAge} ปีขึ้นไป`;
  }
  return item.customTitle.trim();
}

export default function KidsPolicyEditor({
  value,
  onChange,
  label = "ข้อกำหนดเด็กและเตียงเสริม",
  helperText = "กำหนดช่วงอายุและเงื่อนไขการเข้าพักหรือเตียงเสริม โดยระบบจะนำไปจัดรูปแบบแสดงผลที่หน้าห้องพัก",
}: KidsPolicyEditorProps) {
  const [items, setItems] = useState<ParsedItem[]>([]);

  useEffect(() => {
    if (!value || !value.trim()) {
      setItems([]);
      return;
    }

    const lines = value.split("\n").filter((l) => l.trim().length > 0);
    setItems(lines.map((line, idx) => parseLine(line, idx)));
  }, [value]);

  const serializeAndNotify = (newItems: ParsedItem[]) => {
    setItems(newItems);
    const text = newItems
      .map((it) => {
        const title = computeTitle(it);
        if (!title && !it.detail) return "";
        if (!title) return it.detail;
        if (!it.detail) return title;
        return `${title}: ${it.detail}`;
      })
      .filter(Boolean)
      .join("\n");
    onChange(text);
  };

  const handleAdd = () => {
    const newItem: ParsedItem = {
      id: `item-${Date.now()}-${Math.random()}`,
      mode: "range",
      minAge: 0,
      maxAge: 5,
      plusAge: 12,
      customTitle: "",
      title: "เด็ก 0-5 ปี",
      detail: "เข้าพักฟรี (ใช้เตียงที่มีอยู่)",
    };
    serializeAndNotify([...items, newItem]);
  };

  const handleRemove = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    serializeAndNotify(updated);
  };

  const setItemMode = (index: number, mode: AgeMode) => {
    const updated = [...items];
    const item = { ...updated[index], mode };
    item.title = computeTitle(item);
    updated[index] = item;
    serializeAndNotify(updated);
  };

  const handleRangeChange = (index: number, minAge: number, maxAge: number) => {
    const updated = [...items];
    const item = { ...updated[index], minAge, maxAge, mode: "range" as const };
    item.title = computeTitle(item);
    updated[index] = item;
    serializeAndNotify(updated);
  };

  const handlePlusChange = (index: number, plusAge: number) => {
    const updated = [...items];
    const item = { ...updated[index], plusAge, mode: "plus" as const };
    item.title = computeTitle(item);
    updated[index] = item;
    serializeAndNotify(updated);
  };

  const handleCustomTitleChange = (index: number, customTitle: string) => {
    const updated = [...items];
    const item = { ...updated[index], customTitle, mode: "custom" as const };
    item.title = computeTitle(item);
    updated[index] = item;
    serializeAndNotify(updated);
  };

  const handleDetailChange = (index: number, detail: string) => {
    const updated = [...items];
    updated[index] = { ...updated[index], detail };
    serializeAndNotify(updated);
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-semibold text-charcoal-700">
            {label}
          </label>
          {helperText && (
            <p className="text-[11px] text-charcoal-400 mt-0.5">{helperText}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-forest-50 hover:bg-forest-100 text-forest-800 border border-forest-200 transition-all cursor-pointer shadow-2xs"
        >
          <Plus size={14} />
          <span>เพิ่มข้อกำหนด</span>
        </button>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-cream-300 bg-cream-50/50 p-6 text-center">
          <Users className="mx-auto h-8 w-8 text-charcoal-400 mb-2 opacity-60" />
          <p className="text-xs font-medium text-charcoal-600 mb-3">
            ยังไม่มีข้อกำหนดนโยบายเด็กและเตียงเสริม
          </p>
          <button
            type="button"
            onClick={handleAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-forest-800 hover:bg-forest-900 text-white transition-all cursor-pointer shadow-xs"
          >
            <Plus size={14} />
            <span>เพิ่มข้อกำหนดแรก</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => {
            const currentTitle = computeTitle(item);
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-cream-200/90 bg-white p-3.5 sm:p-4 shadow-2xs space-y-3 transition-all hover:border-cream-300"
              >
                {/* Header: Badge with number and title + Delete */}
                <div className="flex items-center justify-between pb-2 border-b border-cream-100">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-md bg-forest-800 text-white text-[11px] font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-xs font-bold text-forest-950">
                      ข้อที่ {index + 1}:{" "}
                      <span className="text-forest-700 font-semibold">
                        {currentTitle || "ยังไม่ระบุหัวข้อ"}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="p-1.5 text-charcoal-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                    title="ลบข้อนี้"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
                  {/* Left Column: Age Selector / Title (5 cols) */}
                  <div className="lg:col-span-5 space-y-2">
                    <span className="text-[11px] font-semibold text-charcoal-700 block">
                      ช่วงอายุ / หัวข้อ
                    </span>

                    {/* Mode segmented control */}
                    <div className="flex rounded-xl bg-cream-100/70 p-1 gap-1 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setItemMode(index, "range")}
                        className={`flex-1 py-1 px-2 rounded-lg transition-all text-center cursor-pointer ${
                          item.mode === "range"
                            ? "bg-white text-forest-900 shadow-2xs"
                            : "text-charcoal-500 hover:text-charcoal-800"
                        }`}
                      >
                        ช่วงอายุ
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemMode(index, "plus")}
                        className={`flex-1 py-1 px-2 rounded-lg transition-all text-center cursor-pointer ${
                          item.mode === "plus"
                            ? "bg-white text-forest-900 shadow-2xs"
                            : "text-charcoal-500 hover:text-charcoal-800"
                        }`}
                      >
                        ...ปีขึ้นไป
                      </button>
                      <button
                        type="button"
                        onClick={() => setItemMode(index, "custom")}
                        className={`flex-1 py-1 px-2 rounded-lg transition-all text-center cursor-pointer ${
                          item.mode === "custom"
                            ? "bg-white text-forest-900 shadow-2xs"
                            : "text-charcoal-500 hover:text-charcoal-800"
                        }`}
                      >
                        พิมพ์เอง
                      </button>
                    </div>

                    {/* Mode = Range */}
                    {item.mode === "range" && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-charcoal-600 font-medium">เด็ก</span>
                          <select
                            value={item.minAge}
                            onChange={(e) =>
                              handleRangeChange(
                                index,
                                Number(e.target.value),
                                item.maxAge
                              )
                            }
                            className="min-w-[68px] px-2.5 py-1.5 bg-cream-50/80 border border-cream-200 rounded-xl text-xs font-bold text-forest-900 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 cursor-pointer"
                          >
                            {Array.from({ length: 18 }, (_, i) => (
                              <option key={i} value={i}>
                                {i} ปี
                              </option>
                            ))}
                          </select>
                          <span className="text-xs text-charcoal-500 font-medium">ถึง</span>
                          <select
                            value={item.maxAge}
                            onChange={(e) =>
                              handleRangeChange(
                                index,
                                item.minAge,
                                Number(e.target.value)
                              )
                            }
                            className="min-w-[68px] px-2.5 py-1.5 bg-cream-50/80 border border-cream-200 rounded-xl text-xs font-bold text-forest-900 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 cursor-pointer"
                          >
                            {Array.from({ length: 18 }, (_, i) => (
                              <option key={i} value={i}>
                                {i} ปี
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] text-charcoal-400">ปุ่มลัด:</span>
                          {RANGE_PRESETS.map((p) => {
                            const isSelected =
                              item.minAge === p.min && item.maxAge === p.max;
                            return (
                              <button
                                key={p.label}
                                type="button"
                                onClick={() =>
                                  handleRangeChange(index, p.min, p.max)
                                }
                                className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-forest-50 border-forest-400 text-forest-800 font-bold"
                                    : "bg-white border-cream-200 text-charcoal-600 hover:border-cream-300"
                                }`}
                              >
                                {p.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Mode = Plus */}
                    {item.mode === "plus" && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <select
                            value={item.plusAge}
                            onChange={(e) =>
                              handlePlusChange(index, Number(e.target.value))
                            }
                            className="min-w-[76px] px-2.5 py-1.5 bg-cream-50/80 border border-cream-200 rounded-xl text-xs font-bold text-forest-900 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 cursor-pointer"
                          >
                            {Array.from({ length: 18 }, (_, i) => i + 1).map(
                              (age) => (
                                <option key={age} value={age}>
                                  {age} ปี
                                </option>
                              )
                            )}
                          </select>
                          <span className="text-xs text-charcoal-700 font-semibold">
                            ขึ้นไป
                          </span>
                        </div>

                        {/* Quick Presets */}
                        <div className="flex flex-wrap items-center gap-1">
                          <span className="text-[10px] text-charcoal-400">ปุ่มลัด:</span>
                          {PLUS_PRESETS.map((age) => {
                            const isSelected = item.plusAge === age;
                            return (
                              <button
                                key={age}
                                type="button"
                                onClick={() => handlePlusChange(index, age)}
                                className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer ${
                                  isSelected
                                    ? "bg-forest-50 border-forest-400 text-forest-800 font-bold"
                                    : "bg-white border-cream-200 text-charcoal-600 hover:border-cream-300"
                                }`}
                              >
                                {age} ปีขึ้นไป
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Mode = Custom */}
                    {item.mode === "custom" && (
                      <div>
                        <input
                          type="text"
                          value={item.customTitle}
                          onChange={(e) =>
                            handleCustomTitleChange(index, e.target.value)
                          }
                          placeholder="เช่น เด็กอายุต่ำกว่า 3 ปี, ทารกแรกเกิด"
                          className="w-full px-3 py-1.5 bg-cream-50/70 focus:bg-white border border-cream-200 rounded-xl text-xs font-medium text-charcoal-800 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20"
                        />
                      </div>
                    )}
                  </div>

                  {/* Right Column: Detail & Suggestion chips (7 cols) */}
                  <div className="lg:col-span-7 space-y-2">
                    <span className="text-[11px] font-semibold text-charcoal-700 block">
                      รายละเอียดเงื่อนไข / ค่าบริการ
                    </span>
                    <input
                      type="text"
                      value={item.detail}
                      onChange={(e) => handleDetailChange(index, e.target.value)}
                      placeholder="เช่น เข้าพักฟรี (ใช้เตียงที่มีอยู่)"
                      className="w-full px-3 py-2 bg-cream-50/70 focus:bg-white border border-cream-200 rounded-xl text-xs font-medium text-charcoal-800 focus:outline-hidden focus:ring-2 focus:ring-forest-800/20 transition-all shadow-2xs"
                    />

                    {/* Suggestion Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-charcoal-400 flex items-center gap-1">
                        <Sparkles size={11} className="text-forest-600" />
                        <span>ตัวเลือกด่วน:</span>
                      </span>
                      {COMMON_SUGGESTIONS.map((sug) => {
                        const isCurrent = item.detail === sug;
                        return (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => handleDetailChange(index, sug)}
                            className={`text-[10px] px-2 py-0.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                              isCurrent
                                ? "bg-forest-100/70 border-forest-300 text-forest-900 font-bold"
                                : "bg-cream-100/60 hover:bg-forest-50 hover:text-forest-800 border-cream-200/80 text-charcoal-600"
                            }`}
                          >
                            {isCurrent && <Check size={10} />}
                            <span>{sug}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Preview of formatted list */}
      {items.length > 0 && (
        <div className="rounded-xl bg-cream-50/60 border border-cream-200/80 p-3 space-y-1">
          <span className="text-[10px] font-bold text-forest-800 uppercase tracking-wide block">
            ตัวอย่างการแสดงผลบนหน้ารายละเอียดห้องพัก:
          </span>
          <ul className="list-disc list-outside ml-4 space-y-1 text-xs text-charcoal-600">
            {items.map((item, idx) => {
              const title = computeTitle(item);
              if (!title && !item.detail) return null;
              return (
                <li key={idx}>
                  {title && (
                    <span className="font-semibold text-charcoal-900">
                      {title}:{" "}
                    </span>
                  )}
                  <span>{item.detail}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
