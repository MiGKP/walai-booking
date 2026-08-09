"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  MonthCursor,
  THAI_WEEKDAYS_SHORT,
  addDaysISO,
  buildMonthGrid,
  formatMonthLabel,
  formatThaiDateLong,
  monthCursorFromISO,
  nightsInRange,
  shiftMonth,
  todayISO,
} from "@/lib/date";

export type DayTone = "open" | "low" | "full";

export interface DayStatus {
  tone: DayTone;
  /** ข้อความอธิบายให้ screen reader และ tooltip เช่น "เหลือ 2 ห้อง" */
  hint?: string;
}

export interface DateRange {
  start: string;
  end: string;
}

interface BaseProps {
  cursor: MonthCursor;
  onCursorChange: (cursor: MonthCursor) => void;
  dayStatus?: Record<string, DayStatus>;
  loading?: boolean;
  minISO?: string;
  /** จำนวนเดือนที่เลื่อนไปข้างหน้าได้จากเดือนปัจจุบัน */
  maxMonthsAhead?: number;
  /** จำนวนเดือนที่แสดงพร้อมกัน (ค่าเริ่มต้น 2 — แก้ปัญหาเลือกข้ามเดือน) */
  visibleMonths?: 1 | 2;
  className?: string;
}

interface SingleModeProps extends BaseProps {
  mode: "single";
  value: string | null;
  onSelect: (iso: string) => void;
}

interface RangeModeProps extends BaseProps {
  mode: "range";
  value: DateRange | null;
  onSelect: (range: DateRange | null) => void;
}

type BookingCalendarProps = SingleModeProps | RangeModeProps;

const monthIndex = (cursor: MonthCursor): number =>
  cursor.year * 12 + cursor.month;

interface MonthPanelProps {
  cursor: MonthCursor;
  dayStatus?: Record<string, DayStatus>;
  loading: boolean;
  today: string;
  focusedISO: string;
  selectedStart: string | null;
  selectedEnd: string | null;
  rangeNights: Set<string>;
  mode: "single" | "range";
  singleValue: string | null;
  isDisabled: (iso: string) => boolean;
  onFocusDay: (iso: string) => void;
  onHoverDay: (iso: string | null) => void;
  onSelectDay: (iso: string) => void;
}

function MonthPanel({
  cursor,
  dayStatus,
  loading,
  today,
  focusedISO,
  selectedStart,
  selectedEnd,
  rangeNights,
  mode,
  singleValue,
  isDisabled,
  onFocusDay,
  onHoverDay,
  onSelectDay,
}: MonthPanelProps): React.ReactElement {
  const cells = useMemo(() => buildMonthGrid(cursor), [cursor]);

  return (
    <div className="min-w-0 flex-1">
      <p className="mb-2 text-center font-display text-base text-forest-900">
        {formatMonthLabel(cursor)}
      </p>

      <div className="grid grid-cols-7 mb-1">
        {THAI_WEEKDAYS_SHORT.map((label) => (
          <div
            key={`${cursor.year}-${cursor.month}-${label}`}
            className="text-center text-[11px] font-medium tracking-wide text-charcoal-400 py-1.5"
          >
            {label}
          </div>
        ))}
      </div>

      <div
        role="grid"
        aria-label={`ปฏิทิน ${formatMonthLabel(cursor)}`}
        aria-busy={loading}
        onMouseLeave={() => onHoverDay(null)}
        className={`grid grid-cols-7 gap-y-0.5 transition-opacity ${loading ? "opacity-45" : "opacity-100"}`}
      >
        {cells.map((iso, index) => {
          if (!iso) {
            return (
              <div
                key={`blank-${cursor.year}-${cursor.month}-${index}`}
                aria-hidden="true"
              />
            );
          }

          const status = dayStatus?.[iso];
          const disabled = isDisabled(iso);
          const isFull = status?.tone === "full";
          const isStart = iso === selectedStart;
          const isEnd = iso === selectedEnd;
          const inRange = mode === "range" && rangeNights.has(iso) && !isStart;
          const isSelected =
            isStart ||
            isEnd ||
            (mode === "single" && iso === singleValue);
          const isToday = iso === today;

          return (
            <div key={iso} role="gridcell" className="relative py-0.5">
              {inRange && !isEnd && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1 left-0 right-0 bg-lagoon-50"
                />
              )}
              {isStart && mode === "range" && selectedEnd && selectedEnd > iso && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1 left-1/2 right-0 bg-lagoon-50"
                />
              )}
              {isEnd && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1 left-0 right-1/2 bg-lagoon-50"
                />
              )}
              <button
                type="button"
                data-iso={iso}
                tabIndex={iso === focusedISO ? 0 : -1}
                disabled={disabled}
                aria-current={isToday ? "date" : undefined}
                aria-pressed={isSelected}
                aria-label={`${formatThaiDateLong(iso)}${status?.hint ? ` — ${status.hint}` : ""}`}
                title={status?.hint}
                onFocus={() => onFocusDay(iso)}
                onMouseEnter={() => onHoverDay(iso)}
                onClick={() => onSelectDay(iso)}
                className={[
                  "relative z-10 mx-auto flex h-9 w-9 sm:h-10 sm:w-10 flex-col items-center justify-center rounded-full text-sm tabular-nums transition-colors",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-lagoon-500 focus-visible:ring-offset-1",
                  isSelected
                    ? "bg-forest-800 text-cream-100 font-semibold"
                    : disabled
                      ? "text-charcoal-300 cursor-not-allowed"
                      : "text-charcoal-700 hover:bg-forest-50",
                  isFull && !isSelected
                    ? "line-through decoration-charcoal-300"
                    : "",
                  isToday && !isSelected
                    ? "ring-1 ring-inset ring-lagoon-300"
                    : "",
                ].join(" ")}
              >
                {Number(iso.slice(8, 10))}
                {status?.tone === "low" && !isSelected && !disabled && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1 h-1 w-1 rounded-full bg-bamboo-400"
                  />
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function BookingCalendar(
  props: BookingCalendarProps,
): React.ReactElement {
  const {
    cursor,
    onCursorChange,
    dayStatus,
    loading = false,
    maxMonthsAhead = 12,
    visibleMonths = 2,
    className = "",
  } = props;
  const today = todayISO();
  const minISO = props.minISO ?? today;
  const monthCount: 1 | 2 = visibleMonths === 1 ? 1 : 2;

  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const [hoveredISO, setHoveredISO] = useState<string | null>(null);
  const [focusedISO, setFocusedISO] = useState<string>(() => {
    if (props.mode === "single") return props.value ?? minISO;
    return props.value?.start ?? minISO;
  });

  const rootRef = useRef<HTMLDivElement>(null);
  const shouldRestoreFocus = useRef(false);

  const months = useMemo(() => {
    return Array.from({ length: monthCount }, (_, index) =>
      shiftMonth(cursor, index),
    );
  }, [cursor, monthCount]);

  const currentCursor = monthCursorFromISO(today);
  const canGoPrev = monthIndex(cursor) > monthIndex(monthCursorFromISO(minISO));
  const canGoNext =
    monthIndex(cursor) + (monthCount - 1) <
    monthIndex(currentCursor) + maxMonthsAhead;

  const rangeValue: DateRange | null =
    props.mode === "range" ? props.value : null;

  const previewRange = useMemo<DateRange | null>(() => {
    if (!pendingStart) return rangeValue;
    const other = hoveredISO ?? focusedISO;
    if (!other || other <= pendingStart) {
      return { start: pendingStart, end: addDaysISO(pendingStart, 1) };
    }
    return { start: pendingStart, end: other };
  }, [rangeValue, pendingStart, hoveredISO, focusedISO]);

  const rangeNights = useMemo<Set<string>>(() => {
    if (!previewRange) return new Set();
    return new Set(nightsInRange(previewRange.start, previewRange.end));
  }, [previewRange]);

  useEffect(() => {
    if (!shouldRestoreFocus.current) return;
    shouldRestoreFocus.current = false;
    const target = rootRef.current?.querySelector<HTMLButtonElement>(
      `button[data-iso="${focusedISO}"]`,
    );
    target?.focus();
  }, [focusedISO, cursor, monthCount]);

  const isDisabled = (iso: string): boolean => {
    if (iso < minISO) return true;
    if (props.mode === "range" && pendingStart) return false;
    return dayStatus?.[iso]?.tone === "full";
  };

  const handleSelect = (iso: string): void => {
    if (isDisabled(iso)) return;

    if (props.mode === "single") {
      props.onSelect(iso);
      return;
    }

    if (!pendingStart) {
      setPendingStart(iso);
      props.onSelect(null);
      return;
    }

    if (iso <= pendingStart) {
      setPendingStart(iso);
      return;
    }

    props.onSelect({ start: pendingStart, end: iso });
    setPendingStart(null);
    setHoveredISO(null);
  };

  const moveFocus = (deltaDays: number): void => {
    const next = addDaysISO(focusedISO, deltaDays);
    if (next < minISO) return;
    const nextCursor = monthCursorFromISO(next);
    if (monthIndex(nextCursor) > monthIndex(currentCursor) + maxMonthsAhead) {
      return;
    }

    shouldRestoreFocus.current = true;
    setFocusedISO(next);

    const left = monthIndex(cursor);
    const right = left + (monthCount - 1);
    const target = monthIndex(nextCursor);
    if (target < left) {
      onCursorChange(nextCursor);
    } else if (target > right) {
      onCursorChange(shiftMonth(nextCursor, -(monthCount - 1)));
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const delta = moves[event.key];
    if (delta !== undefined) {
      event.preventDefault();
      moveFocus(delta);
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      const step = event.key === "PageUp" ? -1 : 1;
      if (event.key === "PageUp" && !canGoPrev) return;
      if (event.key === "PageDown" && !canGoNext) return;
      shouldRestoreFocus.current = true;
      onCursorChange(shiftMonth(cursor, step));
      setFocusedISO(addDaysISO(focusedISO, step * 28));
    }
  };

  const selectedStart =
    props.mode === "range" ? (previewRange?.start ?? null) : props.value;
  const selectedEnd =
    props.mode === "range" ? (previewRange?.end ?? null) : null;

  return (
    <div
      ref={rootRef}
      className={`select-none ${className}`}
      onKeyDown={handleKeyDown}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onCursorChange(shiftMonth(cursor, -1))}
          disabled={!canGoPrev}
          aria-label="เดือนก่อนหน้า"
          className="w-9 h-9 grid place-items-center rounded-lg text-forest-800 hover:bg-forest-50 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <p aria-live="polite" className="text-xs sm:text-sm text-charcoal-400 text-center">
          {monthCount === 2
            ? `${formatMonthLabel(months[0])} · ${formatMonthLabel(months[1])}`
            : formatMonthLabel(cursor)}
        </p>
        <button
          type="button"
          onClick={() => onCursorChange(shiftMonth(cursor, 1))}
          disabled={!canGoNext}
          aria-label="เดือนถัดไป"
          className="w-9 h-9 grid place-items-center rounded-lg text-forest-800 hover:bg-forest-50 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <div
        className={
          monthCount === 2
            ? "flex flex-col gap-5 sm:flex-row sm:gap-4"
            : undefined
        }
      >
        {months.map((monthCursor, index) => (
          <MonthPanel
            key={`${monthCursor.year}-${monthCursor.month}`}
            cursor={monthCursor}
            dayStatus={dayStatus}
            loading={loading}
            today={today}
            focusedISO={focusedISO}
            selectedStart={selectedStart}
            selectedEnd={selectedEnd}
            rangeNights={rangeNights}
            mode={props.mode}
            singleValue={props.mode === "single" ? props.value : null}
            isDisabled={isDisabled}
            onFocusDay={setFocusedISO}
            onHoverDay={setHoveredISO}
            onSelectDay={handleSelect}
          />
        ))}
      </div>

      <div className="mt-4 border-t border-stone-100 pt-2.5">
        <div className="flex flex-wrap items-center justify-start gap-4 text-[12px] text-charcoal-500">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-forest-900" />
            <span>วันที่เลือก</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span>เหลือน้อย</span>
          </div>
          <div className="flex items-center gap-1.5 text-stone-400">
            <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
            <span className="line-through decoration-stone-400">เต็ม</span>
          </div>
        </div>
      </div>
    </div>
  );
}
