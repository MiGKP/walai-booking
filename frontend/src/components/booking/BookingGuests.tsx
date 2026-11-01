'use client';

import React from 'react';
import { Minus, Plus, Users } from 'lucide-react';

export interface BookingGuestSelection {
  adults: number;
  childAges: Array<number | null>;
}

interface BookingGuestsProps extends BookingGuestSelection {
  capacities: number[];
  adultHint: string;
  childMaxAge: number;
  showAgeErrors?: boolean;
  onChange: (next: BookingGuestSelection) => void;
}

// แสดงส่วนเลือกจำนวนผู้ใหญ่และเด็กพร้อมระบุอายุเด็กแต่ละคนในหน้าจองห้องพัก
export default function BookingGuests({
  adults,
  childAges,
  capacities,
  adultHint,
  childMaxAge,
  showAgeErrors = false,
  onChange,
}: BookingGuestsProps): React.ReactElement {
  const totalCapacity = capacities.reduce((sum, capacity) => sum + capacity, 0);
  const standardRoom = capacities.length === 1 && totalCapacity <= 2 && adults <= 2;
  const buttonClass =
    'grid h-9 w-9 place-items-center rounded-full border border-cream-300 text-forest-800 transition-colors hover:bg-forest-50 focus-visible:outline-2 focus-visible:outline-forest-600 disabled:text-charcoal-300 disabled:hover:bg-white';

  // สร้างปุ่มบวกและลบสำหรับเพิ่มหรือลดจำนวนผู้เข้าพัก
  function counter(label: string, value: number, min: number, onCount: (next: number) => void): React.ReactElement {
    return (
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`ลด${label}`} disabled={value <= min} onClick={() => onCount(value - 1)} className={buttonClass}>
          <Minus size={16} />
        </button>
        <span className="min-w-6 text-center font-semibold tabular-nums text-forest-900" aria-live="polite">
          {value}
        </span>
        <button type="button" aria-label={`เพิ่ม${label}`} disabled={value >= 20} onClick={() => onCount(value + 1)} className={buttonClass}>
          <Plus size={16} />
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="booking-guests-heading" className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-xs sm:p-8">
      <h2 id="booking-guests-heading" className="mb-2 flex items-center gap-2 text-lg font-bold text-forest-900">
        <Users size={20} className="text-forest-600" /> ผู้เข้าพักในการจองนี้
      </h2>
      <p className="mb-5 text-sm text-charcoal-500">
        {standardRoom ? `ห้องมาตรฐาน พักได้ 1–${totalCapacity} ท่าน` : `${capacities.length} ห้อง · ความจุหลักรวม ${totalCapacity} ท่าน`} · ระบุจำนวนผู้เข้าพักจริง
      </p>
      <fieldset className="space-y-3">
        <legend className="sr-only">จำนวนผู้ใหญ่</legend>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-forest-900">ผู้ใหญ่</p>
            <p className="text-xs text-charcoal-500">{adultHint}</p>
          </div>
          {standardRoom ? (
            <div className="flex gap-2">
              {Array.from({ length: totalCapacity }, (_, index) => index + 1).map((count) => (
                <label
                  key={count}
                  className={`flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2 text-sm ${
                    adults === count ? 'border-forest-700 bg-forest-50 text-forest-900' : 'border-cream-300 text-charcoal-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="booking-adults"
                    value={count}
                    checked={adults === count}
                    onChange={() => onChange({ adults: count, childAges })}
                    className="accent-forest-800"
                  />
                  {count} ท่าน
                </label>
              ))}
            </div>
          ) : (
            counter('ผู้ใหญ่', adults, 1, (count) => onChange({ adults: count, childAges }))
          )}
        </div>
      </fieldset>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-cream-200 pt-5">
        <div>
          <p className="text-sm font-semibold text-forest-900">เด็ก (ถ้ามี)</p>
          <p className="text-xs text-charcoal-500">อายุ 0–{childMaxAge} ปี ณ วันเข้าพัก</p>
        </div>
        {counter('เด็ก', childAges.length, 0, (count) =>
          onChange({ adults, childAges: Array.from({ length: count }, (_, index) => childAges[index] ?? null) })
        )}
      </div>
      {childAges.length > 0 && (
        <div className="mt-4 space-y-3 rounded-2xl bg-cream-50 p-4">
          <p className="text-xs text-charcoal-600">
            ระบุอายุเด็กทุกคนเพื่อคำนวณความจุห้อง และเลือกเตียงเสริมในส่วนตัวเลือกเพิ่มเติมด้านล่าง ชำระค่าเตียงเสริมหน้าเคาน์เตอร์
          </p>
          {childAges.map((age, index) => (
            <div key={index} className="flex items-center justify-between gap-3">
              <label htmlFor={`booking-child-age-${index}`} className="text-sm text-forest-900">
                เด็กคนที่ {index + 1}
              </label>
              <select
                id={`booking-child-age-${index}`}
                aria-label={`อายุเด็กคนที่ ${index + 1}`}
                aria-invalid={showAgeErrors && age === null}
                value={age ?? ''}
                onChange={(event) => {
                  const next = [...childAges];
                  next[index] = event.target.value === '' ? null : Number(event.target.value);
                  onChange({ adults, childAges: next });
                }}
                className="input-field max-w-40 bg-white"
                required
              >
                <option value="">เลือกอายุ</option>
                {Array.from({ length: childMaxAge + 1 }, (_, value) => (
                  <option key={value} value={value}>
                    {value} ปี
                  </option>
                ))}
              </select>
            </div>
          ))}
          {showAgeErrors && childAges.some((age) => age === null) && (
            <p role="alert" className="text-sm text-red-600">
              กรุณาระบุอายุเด็กให้ครบทุกคน
            </p>
          )}
        </div>
      )}
    </section>
  );
}
