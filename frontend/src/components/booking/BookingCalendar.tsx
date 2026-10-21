"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  MonthCursor,
  THAI_WEEKDAYS_SHORT,
  addDaysISO,
  buildMonthGrid,
  formatMonthLabel,
  formatThaiDate,
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
  /** Empty until the guest explicitly selects a check-out date. */
  end: string;
}

interface BaseProps {
  cursor: MonthCursor;
  onCursorChange: (cursor: MonthCursor) => void;
  dayStatus?: Record<string, DayStatus>;
  loading?: boolean;
  minISO?: string;
  maxISO?: string;
  /** จำนวนเดือนที่ยอมให้อนุญาตล่วงหน้า
  เริ่มจากเดือนปัจจุบัน */
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
  previewEnd?: string | null;
  rangeNights: Set<string>;
  mode: "single" | "range";
  singleValue: string | null;
  isDisabled: (iso: string) => boolean;
  onFocusDay: (iso: string) => void;
  onSelectDay: (iso: string) => void;
  onHoverDay?: (iso: string | null) => void;
  hideTitle?: boolean;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  canGoPrev?: boolean;
  canGoNext?: boolean;
}

function MonthPanel({
  cursor,
  dayStatus,
  loading,
  today,
  focusedISO,
  selectedStart,
  selectedEnd,
  previewEnd = null,
  rangeNights,
  mode,
  singleValue,
  isDisabled,
  onFocusDay,
  onSelectDay,
  onHoverDay,
  hideTitle = false,
  onPrevMonth,
  onNextMonth,
  canGoPrev,
  canGoNext,
}: MonthPanelProps): React.ReactElement {
  const cells = useMemo(() => buildMonthGrid(cursor), [cursor]);

  return (
    <div className="min-w-0 flex-1">
      {!hideTitle && (
        <div className="mb-2.5 flex items-center justify-between">
          {onPrevMonth ? (
            <button
              type="button"
              onClick={onPrevMonth}
              disabled={!canGoPrev}
              aria-label="เดือนก่อนหน้า"
              className="w-8 h-8 grid place-items-center rounded-full text-forest-800 hover:bg-forest-50 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
          ) : (
            <div className="w-8 h-8 shrink-0" />
          )}
          <p className="font-display text-sm sm:text-base font-bold text-forest-900 text-center flex-1">
            {formatMonthLabel(cursor)}
          </p>
  
          {onNextMonth ? (
            <button
              type="button"
              onClick={onNextMonth}
              disabled={!canGoNext}
              aria-label="เดือนถัดไป"
              className="w-8 h-8 grid place-items-center rounded-full text-forest-800 hover:bg-forest-50 disabled:opacity-20 disabled:hover:bg-transparent transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          ) : (
            <div className="w-8 h-8 shrink-0" />
          )}
        </div>
      )}

      <div className="grid grid-cols-7 mb-1 border-b border-stone-100 pb-1.5">
        {THAI_WEEKDAYS_SHORT.map((label) => (
          <div
            key={`${cursor.year}-${cursor.month}-${label}`}
            className="text-center text-xs font-semibold tracking-wide text-charcoal-400/80 py-1"
          >
            {label}
          </div>
        ))}
      </div>

      <div
        role="grid"
        aria-label={`ปฏิทิน ${formatMonthLabel(cursor)}`}
        aria-busy={loading}
        onMouseLeave={() => onHoverDay?.(null)}
        className={`grid grid-cols-7 gap-y-1 pt-1 transition-opacity ${loading ? "opacity-45" : "opacity-100"}`}
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
          const isHoverEnd = Boolean(!selectedEnd && previewEnd && iso === previewEnd);
          const effectiveEnd = selectedEnd || previewEnd;
          const inRange = mode === "range" && rangeNights.has(iso) && !isStart;
          const isSelected =
            isStart ||
            isEnd ||
            (mode === "single" && iso === singleValue);
          const isToday = iso === today;

          return (
            <div
              key={iso}
              role="gridcell"
              className="relative py-0.5"
              onMouseEnter={() => {
                if (!disabled && onHoverDay) {
                  onHoverDay(iso);
                }
              }}
            >
              {inRange && !isEnd && !isHoverEnd && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1 left-0 right-0 bg-forest-50"
                />
              )}
              {isStart && mode === "range" && effectiveEnd && effectiveEnd > iso && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1 left-1/2 right-0 bg-forest-50"
                />
              )}
              {(isEnd || isHoverEnd) && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-1 left-0 right-1/2 rounded-l-full bg-forest-50"
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
                onFocus={() => onFocusDay(iso)}
                onClick={() => onSelectDay(iso)}
                className={[
                  "relative z-10 mx-auto flex h-9 w-9 sm:h-10 sm:w-10 flex-col items-center justify-center rounded-full text-sm tabular-nums transition-all duration-150",
                  "focus:outline-hidden focus-visible:ring-2 focus-visible:ring-bamboo-400 focus-visible:ring-offset-1",
                  isSelected
                    ? "bg-forest-800 text-cream-100 font-semibold shadow-xs shadow-forest-800/30"
                    : isHoverEnd
                      ? "bg-forest-700 text-cream-100 font-semibold ring-2 ring-forest-600/40 shadow-xs"
                      : inRange
                        ? "text-forest-900 font-medium hover:bg-forest-100/70"
                        : disabled
                          ? "text-charcoal-300 cursor-not-allowed"
                          : "text-charcoal-700 hover:bg-forest-100/70",
                  isFull && !isSelected && !isHoverEnd
                    ? "line-through decoration-charcoal-300"
                    : "",
                  isToday && !isSelected && !isHoverEnd
                    ? "ring-1 ring-inset ring-bamboo-400"
                    : "",
                ].join(" ")}
              >
                {Number(iso.slice(8, 10))}
                {status?.tone === "low" && !isSelected && !isHoverEnd && !disabled && (
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
  const pendingStart = rangeValue?.start && !rangeValue.end ? rangeValue.start : null;

  const selectedStart =
    props.mode === "range" ? (rangeValue?.start || null) : props.value;
  const selectedEnd =
    props.mode === "range" ? (rangeValue?.end || null) : null;

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
    if (props.maxISO && iso > props.maxISO) return true;
    if (props.mode === "range" && pendingStart && iso > pendingStart) {
      // Checkout is not an occupied night: a sold-out checkout day is valid.
      return nightsInRange(pendingStart, iso).some(night => dayStatus?.[night]?.tone === "full");
    }
    return dayStatus?.[iso]?.tone === "full";
  };

  const previewEnd =
    props.mode === "range" &&
    pendingStart &&
    hoveredISO &&
    hoveredISO > pendingStart &&
    !isDisabled(hoveredISO)
      ? hoveredISO
      : null;

  const rangeNights = useMemo<Set<string>>(() => {
    const end = selectedEnd || previewEnd;
    if (!selectedStart || !end) return new Set();
    return new Set(nightsInRange(selectedStart, end));
  }, [selectedStart, selectedEnd, previewEnd]);

  const handleSelect = (iso: string): void => {
    if (isDisabled(iso)) return;

    if (props.mode === "single") {
      props.onSelect(iso);
      return;
    }

    setHoveredISO(null);

    if (!pendingStart) {
      props.onSelect({ start: iso, end: "" });
      return;
    }

    if (iso <= pendingStart) {
      props.onSelect({ start: iso, end: "" });
      return;
    }

    props.onSelect({ start: pendingStart, end: iso });
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

  return (
    <div
      ref={rootRef}
      className={`select-none ${className}`}
      onKeyDown={handleKeyDown}
      onMouseLeave={() => setHoveredISO(null)}
    >
      {props.mode === "range" && <div className="mb-4" aria-live="polite">
        <div className="grid grid-cols-2 gap-2">
          <div className={`rounded-xl border p-3 ${!selectedStart || selectedEnd ? 'border-stone-200 bg-stone-50' : 'border-forest-600 bg-forest-50'}`}>
            <p className="text-xs font-bold text-forest-800">1. วันเช็คอิน</p>
            <p className="mt-1 text-sm text-forest-900">{selectedStart ? formatThaiDate(selectedStart) : 'เลือกวันเข้าพัก'}</p>
          </div>
          <div className={`rounded-xl border p-3 ${pendingStart ? 'border-forest-600 bg-forest-50' : 'border-stone-200 bg-stone-50'}`}>
            <p className="text-xs font-bold text-forest-800">2. วันเช็คเอาต์</p>
            <p className="mt-1 text-sm text-forest-900">
              {selectedEnd ? (
                formatThaiDate(selectedEnd)
              ) : previewEnd ? (
                <span className="text-forest-700 font-medium">
                  {formatThaiDate(previewEnd)}{' '}
                  <span className="text-xs text-forest-600 font-normal">({rangeNights.size} คืน)</span>
                </span>
              ) : (
                'ยังไม่ได้เลือกวันออก'
              )}
            </p>
          </div>
        </div>
        <p className="mt-2 text-xs text-charcoal-500">
          {pendingStart
            ? previewEnd
              ? `คลิกเพื่อเลือกวันเช็คเอาต์ ${formatThaiDate(previewEnd)} (รวม ${rangeNights.size} คืน)`
              : 'เลือกวันเช็คเอาต์หลังวันเช็คอิน ห้องพักคิดเป็นรายคืน'
            : selectedEnd
              ? 'เลือกครบแล้ว · กดวันอื่นเพื่อเริ่มเลือกช่วงวันใหม่'
              : 'เริ่มจากเลือกวันเช็คอิน แล้วเลือกวันเช็คเอาต์'}
        </p>
      </div>}
      <div
        className={
          monthCount === 2
            ? "flex flex-col gap-5 divide-y divide-stone-100 sm:flex-row sm:gap-5 sm:divide-y-0 sm:divide-x"
            : undefined
        }
      >
        {months.map((monthCursor, index) => (
          <div
            key={`${monthCursor.year}-${monthCursor.month}`}
            className={
              monthCount === 2 && index === 1
                ? "pt-5 sm:pt-0 sm:pl-5"
                : undefined
            }
          >
            <MonthPanel
              cursor={monthCursor}
              dayStatus={dayStatus}
              loading={loading}
              today={today}
              focusedISO={focusedISO}
              selectedStart={selectedStart}
              selectedEnd={selectedEnd}
              previewEnd={previewEnd}
              rangeNights={rangeNights}
              mode={props.mode}
              singleValue={props.mode === "single" ? props.value : null}
              isDisabled={isDisabled}
              onFocusDay={setFocusedISO}
              onSelectDay={handleSelect}
              onHoverDay={setHoveredISO}
              hideTitle={false}
              onPrevMonth={index === 0 ? () => onCursorChange(shiftMonth(cursor, -1)) : undefined}
              onNextMonth={index === monthCount - 1 ? () => onCursorChange(shiftMonth(cursor, 1)) : undefined}
              canGoPrev={index === 0 ? canGoPrev : undefined}
              canGoNext={index === monthCount - 1 ? canGoNext : undefined}
            />
          </div>
        ))}
      </div>

      {/* <div className="mt-4 border-t border-stone-100 pt-3">
        <div className="flex flex-wrap items-center justify-start gap-4 text-xs text-charcoal-500">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-forest-800" />
            <span>วันที่เลือก</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-bamboo-400" />
            <span>เหลือน้อย</span>
          </div>
          <div className="flex items-center gap-1.5 text-charcoal-300">
            <span className="h-2.5 w-2.5 rounded-full bg-stone-300" />
            <span className="line-through decoration-stone-400">เต็ม</span>
          </div>
        </div>
      </div> */}
    </div>
  );
}
