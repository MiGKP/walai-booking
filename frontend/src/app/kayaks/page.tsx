'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Anchor, Clock3, CreditCard, Minus, Plus, Sailboat, Ticket, Users } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { resolveMediaUrl } from '@/lib/avatar';
import toast from 'react-hot-toast';
import BookingCalendar, { DayStatus } from '@/components/booking/BookingCalendar';
import {
  KayakRound,
  fetchKayakCalendar,
  fetchKayakRounds,
  toKayakDayStatus,
} from '@/lib/booking-calendar';
import {
  boatsNeeded,
  cartBoatTotal,
  cartPassengerTotal,
  cartTotal,
  lineSubtotal,
  slotKey,
  type KayakCartLine,
} from '@/lib/kayak-cart';
import {
  MonthCursor,
  addDaysISO,
  formatThaiDateLong,
  formatTimeRange,
  monthCursorFromISO,
  multiMonthRangeISO,
  todayISO,
} from '@/lib/date';

const CARD = 'rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(18,60,48,0.02),0_8px_24px_-8px_rgba(18,60,48,0.08)] p-5 sm:p-6';

// รอบเรือทั้งหมดจบก่อน 18:00 น. — หลังเวลานี้ปิดรับจองสำหรับ "วันนี้" เพราะไม่มีรอบเหลือให้บริการแล้วจริงๆ
const BOOKING_CUTOFF_HOUR = 18;
const CLOSED_TODAY_HINT = `ปิดรับจองแล้ว (หมดรอบหลัง ${BOOKING_CUTOFF_HOUR}:00 น.)`;

function SectionHeading({ icon, title, hint }: { icon: React.ReactNode; title: string; hint?: string }): React.ReactElement {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-700">{icon}</span>
      <div className="min-w-0">
        <h2 className="font-sans text-base font-semibold text-forest-900">{title}</h2>
        {hint && <p className="text-xs text-charcoal-400">{hint}</p>}
      </div>
    </div>
  );
}

function Stepper({
  value,
  min = 0,
  max = 99,
  onChange,
  ariaLabel,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (next: number) => void;
  ariaLabel: string;
}): React.ReactElement {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = (raw: string): void => {
    const parsed = parseInt(raw, 10);
    const safe = isNaN(parsed) ? min : Math.min(max, Math.max(min, parsed));
    setDraft(String(safe));
    onChange(safe);
  };

  const btn = 'grid h-7 w-7 shrink-0 place-items-center rounded-full border border-stone-200 bg-white text-forest-800 transition-colors hover:border-forest-300 hover:bg-forest-50 disabled:border-stone-100 disabled:text-stone-300 disabled:hover:bg-white';
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label={`ลด${ariaLabel}`} className={btn}><Minus size={13} /></button>
      <input
        type="text"
        inputMode="numeric"
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
        onFocus={(e) => e.currentTarget.select()}
        aria-label={ariaLabel}
        className="h-7 w-9 rounded-md border border-stone-200 bg-white text-center text-sm font-bold tabular-nums text-forest-900 transition-colors focus:border-forest-400 focus:outline-none"
      />
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label={`เพิ่ม${ariaLabel}`} className={btn}><Plus size={13} /></button>
    </div>
  );
}

interface BoatType {
  id: number;
  name: string;
  description: string;
  type: string;
  capacity: number;
  price_per_hour: number;
  image?: string | null;
  is_available: boolean;
}

interface SharedSlot {
  key: string;
  start_time: string;
  end_time: string;
  remaining: number;
  available: boolean;
  /** Remaining boats for each type that has this time window; missing key = no round */
  remainingByType: Record<number, number>;
}

const TYPE_LABELS: Record<string, string> = {
  single: 'เรือเดี่ยว',
  double: 'เรือคู่',
  tandem: 'เรือครอบครัว',
};

function mergeDayStatus(dayMaps: Array<Record<string, DayStatus>>): Record<string, DayStatus> {
  const merged: Record<string, DayStatus> = {};
  const dates = new Set<string>();
  dayMaps.forEach((map) => Object.keys(map).forEach((d) => dates.add(d)));

  dates.forEach((date) => {
    const tones = dayMaps
      .map((map) => map[date]?.tone)
      .filter((tone): tone is DayStatus['tone'] => Boolean(tone));
    if (tones.length === 0) return;
    if (tones.some((tone) => tone === 'open')) {
      merged[date] = { tone: 'open', hint: 'มีรอบว่าง' };
    } else if (tones.some((tone) => tone === 'low')) {
      merged[date] = { tone: 'low', hint: 'เหลือน้อย' };
    } else {
      merged[date] = { tone: 'full', hint: 'เต็มทุกรอบ' };
    }
  });
  return merged;
}

function mergeSharedSlots(
  boatRoundLists: Array<{ boatId: number; rounds: KayakRound[] }>
): SharedSlot[] {
  const byKey = new Map<
    string,
    {
      start_time: string;
      end_time: string;
      remainingByType: Record<number, number>;
      anyAvailable: boolean;
    }
  >();

  boatRoundLists.forEach(({ boatId, rounds }) => {
    rounds.forEach((round) => {
      const key = slotKey(round.start_time, round.end_time);
      const prev = byKey.get(key) ?? {
        start_time: round.start_time,
        end_time: round.end_time,
        remainingByType: {},
        anyAvailable: false,
      };
      prev.remainingByType[boatId] =
        prev.remainingByType[boatId] == null
          ? round.remaining
          : Math.min(prev.remainingByType[boatId], round.remaining);
      prev.anyAvailable = prev.anyAvailable || round.available;
      byKey.set(key, prev);
    });
  });

  return Array.from(byKey.entries())
    .map(([key, value]) => {
      const remainings = Object.values(value.remainingByType);
      const remaining = remainings.length ? Math.min(...remainings) : 0;
      return {
        key,
        start_time: value.start_time,
        end_time: value.end_time,
        remaining,
        available: value.anyAvailable && remaining > 0,
        remainingByType: value.remainingByType,
      };
    })
    .sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
}

function slotFitsCart(slot: SharedSlot, lines: KayakCartLine[]): boolean {
  if (!slot.available) return false;
  return lines.every((line) => {
    const remaining = slot.remainingByType[line.boat_type_id];
    if (remaining == null) return false;
    // เช็คกับจำนวนเรือจริงที่จะใช้ (line.boat_count) ไม่ใช่แค่ค่าขั้นต่ำที่คำนวณอัตโนมัติ
    // เผื่อผู้ใช้ปรับเพิ่มจำนวนเรือเองเกินขั้นต่ำ
    return remaining >= line.boat_count;
  });
}

function normalizeSlotTime(value: string): string {
  const raw = String(value || '').trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  if (/^\d{2}:\d{2}:\d{2}/.test(raw)) return raw.slice(0, 8);
  return raw;
}

import { Suspense } from 'react';

function KayaksPageContent(): React.ReactElement {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const today = todayISO();
  
  // ดึงข้อมูลวันที่เข้าพักจาก query parameters (กรณีมาจากหน้า Payment Success)
  const roomBookingId = searchParams.get('room_booking_id');
  let promoCheckIn = searchParams.get('check_in');
  if (promoCheckIn === 'undefined' || promoCheckIn === 'null') promoCheckIn = null;
  let promoCheckOut = searchParams.get('check_out');
  if (promoCheckOut === 'undefined' || promoCheckOut === 'null') promoCheckOut = null;
  
  // หากมีวันเข้าพัก ให้บังคับเลือกได้แค่วันที่เช็คอิน ถึง วันก่อนเช็คเอาต์
  const isValidISO = (iso: string | null) => /^\d{4}-\d{2}-\d{2}$/.test(iso || "");
  const minAllowedISO = promoCheckIn && isValidISO(promoCheckIn) && promoCheckIn >= today ? promoCheckIn : today;
  let maxAllowedISO: string | undefined = undefined;
  if (promoCheckIn && promoCheckOut && isValidISO(promoCheckOut)) {
    const outDate = new Date(promoCheckOut);
    outDate.setDate(outDate.getDate() - 1);
    maxAllowedISO = outDate.toISOString().split('T')[0];
  }

  // วันนี้เกินตัดรอบการจองหรือยัง?
  const pastCutoffToday = new Date().getHours() >= BOOKING_CUTOFF_HOUR;

  const [boats, setBoats] = useState<BoatType[]>([]);
  const [boatsLoading, setBoatsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const [cursor, setCursor] = useState<MonthCursor>(() => monthCursorFromISO(minAllowedISO));
  const [dayStatus, setDayStatus] = useState<Record<string, DayStatus>>({});
  const [ticketBalance, setTicketBalance] = useState(0);

  useEffect(() => {
    if (user) {
      api.get('/kayaks/ticket-balance').then(res => setTicketBalance(res.data.balance || 0)).catch(() => {});
    }
  }, [user]);

  const [calendarLoading, setCalendarLoading] = useState(false);

  // ยังไม่กดอะไรก็โชว์รอบเรือ+เรือทั้งหมดของวันแรกที่จองได้ไปเลย ไม่ต้องรอผู้ใช้เลือกวันเอง
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    if (minAllowedISO === today && pastCutoffToday) return addDaysISO(today, 1);
    return minAllowedISO;
  });
  const [slots, setSlots] = useState<SharedSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);

  const [boatCountByType, setBoatCountByType] = useState<Record<number, number>>({});
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    api
      .get('/kayaks')
      .then((res) => setBoats(Array.isArray(res.data?.data) ? res.data.data : []))
      .catch(() => toast.error('ไม่สามารถโหลดข้อมูลเรือได้'))
      .finally(() => setBoatsLoading(false));
  }, []);

  useEffect(() => {
    if (boats.length === 0) {
      setDayStatus({});
      return;
    }

    let cancelled = false;
    const { start, end } = multiMonthRangeISO(cursor, 2);
    setCalendarLoading(true);

    Promise.all(
      boats.map((boat) => fetchKayakCalendar({ kayakId: boat.id, start, end }))
    )
      .then((lists) => {
        if (cancelled) return;
        const merged = mergeDayStatus(lists.map((days) => toKayakDayStatus(days)));
        // วันนี้หลัง 18:00 น. ถือว่าหมดรอบเสมอ ไม่ว่า backend จะรายงานว่ายังมีที่ว่างหรือไม่
        if (pastCutoffToday) {
          merged[today] = { tone: 'full', hint: CLOSED_TODAY_HINT };
        }
        setDayStatus(merged);
      })
      .catch(() => {
        if (!cancelled) toast.error('ไม่สามารถโหลดปฏิทินรอบเรือได้');
      })
      .finally(() => {
        if (!cancelled) setCalendarLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [boats, cursor, pastCutoffToday, today]);

  useEffect(() => {
    if (!selectedDate || boats.length === 0) {
      setSlots([]);
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    setSelectedSlotKey(null);
    setBoatCountByType({});
    

    Promise.all(
      boats.map((boat) =>
        fetchKayakRounds({ kayakId: boat.id, bookingDate: selectedDate }).then(
          (rounds) => ({ boatId: boat.id, rounds })
        )
      )
    )
      .then((lists) => {
        if (cancelled) return;
        setSlots(mergeSharedSlots(lists));
      })
      .catch(() => {
        if (!cancelled) toast.error('ไม่สามารถโหลดรอบเวลาได้');
      })
      .finally(() => {
        if (!cancelled) setSlotsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [boats, selectedDate]);

  const selectedSlot = useMemo(
    () => slots.find((slot) => slot.key === selectedSlotKey) ?? null,
    [slots, selectedSlotKey]
  );

  // เรือแต่ละประเภทเหลือมากสุดกี่ลำในวันนั้น (ดูจากทุกรอบรวมกัน) — ใช้ตัดสินใจได้โดยยังไม่ต้องเลือกรอบเวลาก่อน
  const maxRemainingByType = useMemo(() => {
    const map: Record<number, number> = {};
    boats.forEach((boat) => {
      const values = slots
        .map((slot) => slot.remainingByType[boat.id])
        .filter((v): v is number => v != null);
      map[boat.id] = values.length ? Math.max(...values) : 0;
    });
    return map;
  }, [boats, slots]);

  const hasAnyRoundByType = useMemo(() => {
    const map: Record<number, boolean> = {};
    boats.forEach((boat) => {
      map[boat.id] = slots.some((slot) => slot.remainingByType[boat.id] != null);
    });
    return map;
  }, [boats, slots]);

  // ตัวเลือกกรองประเภทเรือ — โชว์เฉพาะประเภทที่มีเรือจริงในระบบ
  const typeOptions = useMemo(() => Array.from(new Set(boats.map((boat) => boat.type))), [boats]);
  const filteredBoats = useMemo(
    () => (typeFilter === 'all' ? boats : boats.filter((boat) => boat.type === typeFilter)),
    [boats, typeFilter]
  );

  const cartLines: KayakCartLine[] = useMemo(() => {
    return boats
      .map((boat) => {
        const boatCount = Number(boatCountByType[boat.id] || 0);
        if (boatCount < 1) return null;
        
        return {
          boat_type_id: boat.id,
          name: boat.name,
          capacity: boat.capacity,
          price_per_hour: Number(boat.price_per_hour),
          num_passengers: boatCount, // ส่งแค่เพื่อ compatibility
          boat_count: boatCount,
          free_tickets_used: 0,
        };
      })
      .filter((line): line is KayakCartLine => line != null);
  }, [boats, boatCountByType, ticketBalance]);

  const totalPrice = cartTotal(cartLines);
  const totalPassengers = cartPassengerTotal(cartLines);
  const totalBoats = cartBoatTotal(cartLines);

  // ลบ useEffect ที่ล้างการเลือกรอบทิ้ง (Silent Deselection) เพื่อให้ผู้ใช้รู้ว่าทำไมถึงจองไม่ได้ แทนที่จะปิดการเลือกไปดื้อๆ

  const handleSelectDate = (date: string | null): void => {
    // กันไว้อีกชั้นเผื่อกดก่อนปฏิทินโหลดสถานะ "หมดรอบ" เสร็จ
    if (date === today && pastCutoffToday) {
      toast.error(CLOSED_TODAY_HINT);
      return;
    }
    setSelectedDate(date);
    setSelectedSlotKey(null);
    setBoatCountByType({});
    
  };

  const handleSelectSlot = (key: string): void => {
    setSelectedSlotKey(key);
  };

  const handleBoatCountChange = (boatId: number, raw: number): void => {
    if (!Number.isFinite(raw)) return;
    const nextCount = Math.max(0, raw);
    
    setBoatCountByType((prev) => {
      const next = { ...prev };
      if (nextCount === 0) {
        delete next[boatId];
      } else {
        next[boatId] = nextCount;
      }
      return next;
    });
  };



  const handleBooking = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      toast.error('กรุณาเข้าสู่ระบบก่อน');
      router.push('/auth/login');
      return;
    }
    if (!selectedDate || !selectedSlot) {
      toast.error('กรุณาเลือกวันที่และรอบเวลา');
      return;
    }
    if (selectedDate === today && pastCutoffToday) {
      toast.error(CLOSED_TODAY_HINT);
      return;
    }
    if (cartLines.length === 0) {
      toast.error('กรุณาระบุผู้โดยสารอย่างน้อย 1 ประเภทเรือ');
      return;
    }
    if (!slotFitsCart(selectedSlot, cartLines)) {
      toast.error('รอบเวลาที่เลือกมีเรือว่างไม่พอสำหรับจำนวนที่เลือกไว้ กรุณาเลือกรอบอื่น');
      return;
    }

    setBookingLoading(true);
    try {
      const res = await api.post('/kayaks/bookings', {
        booking_date: selectedDate,
        start_time: normalizeSlotTime(selectedSlot.start_time),
        end_time: normalizeSlotTime(selectedSlot.end_time),
        room_booking_id: roomBookingId || undefined,
        items: cartLines.map((line) => ({
          boat_type_id: line.boat_type_id,
          num_passengers: line.num_passengers,
          boat_count: line.boat_count,
          free_tickets_used: line.free_tickets_used,
        })),
      });
      toast.success('จองเรือสำเร็จ!');
      router.push(
        `/payment?booking_type=kayak&booking_id=${res.data.data.boat_booking_id}`
      );
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'จองเรือไม่สำเร็จ (อาจเต็มในรอบนี้)'));
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 pb-24 pt-4">
      <div className="container mx-auto px-4 pt-16 sm:pt-20">
        

        {pastCutoffToday && (
          <div className="mb-6 flex items-start gap-2.5 rounded-2xl border border-bamboo-200 bg-bamboo-50/70 px-4 py-3 text-xs font-medium text-bamboo-800">
            <Clock3 size={16} className="mt-0.5 shrink-0" />
            <p>วันนี้{CLOSED_TODAY_HINT.replace('ปิดรับจองแล้ว ', '')} — กรุณาเลือกวันถัดไปในปฏิทิน</p>
          </div>
        )}


        <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
          <div className="space-y-6">
            {/* วันที่ + จำนวนผู้โดยสารต่อประเภทเรือ อยู่ในกรอบเดียวกัน วางคู่กัน — ปฏิทินไม่ต้องกว้างเพราะจองทีละวัน */}
            <section className={CARD}>
              <SectionHeading
                icon={<Anchor size={16} />}
                title="เลือกวันที่ รอบเวลา และจำนวนผู้โดยสาร"
                hint={!selectedDate ? 'เลือกวันที่ต้องการพายเรือ' : formatThaiDateLong(selectedDate)}
              />

              <div className="mt-5 flex flex-col gap-5 lg:flex-row">
                <div className="w-full shrink-0 rounded-xl border border-stone-200 p-3 lg:w-[300px] lg:p-4">
                  <BookingCalendar
                    mode="single"
                    value={selectedDate}
                    onSelect={handleSelectDate}
                    cursor={cursor}
                    onCursorChange={setCursor}
                    dayStatus={dayStatus}
                    loading={calendarLoading || boatsLoading}
                    minISO={minAllowedISO}
                    maxISO={maxAllowedISO}
                    visibleMonths={1}
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-5">
                  {/* รอบเวลา — เลื่อนดูซ้ายขวาได้ เพราะมีไม่กี่รอบต่อวัน แสดงจำนวนเรือที่เหลือให้จองต่อรอบด้วย */}
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-charcoal-300">เลือกรอบเวลา</p>
                    {!selectedDate ? (
                      <p className="text-xs text-charcoal-400">เลือกวันที่ก่อน</p>
                    ) : slotsLoading ? (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {[0, 1, 2].map((i) => <div key={i} className="h-14 w-28 shrink-0 animate-pulse rounded-xl bg-stone-100" />)}
                      </div>
                    ) : slots.length === 0 ? (
                      <p className="text-xs text-charcoal-400">วันนี้ไม่มีรอบให้บริการ</p>
                    ) : (
                      <>
                        <div className="flex gap-2 overflow-x-auto pb-1">
                          {slots.map((slot) => {
                            const isSelected = slot.key === selectedSlotKey;
                            const fits = cartLines.length === 0 ? slot.available : slotFitsCart(slot, cartLines);
                            return (
                              <button
                                key={slot.key}
                                type="button"
                                disabled={!fits && !isSelected}
                                aria-pressed={isSelected}
                                onClick={() => handleSelectSlot(slot.key)}
                                className={`shrink-0 rounded-xl border px-4 py-2.5 text-left transition-colors ${
                                  isSelected
                                    ? fits ? 'border-forest-800 bg-forest-800 text-cream-100' : 'border-rose-500 bg-rose-50 text-rose-700'
                                    : fits
                                      ? 'border-stone-200 hover:border-forest-300 hover:bg-forest-50'
                                      : 'cursor-not-allowed border-stone-100 opacity-50'
                                }`}
                              >
                                <span className={`block text-xs font-semibold tabular-nums ${isSelected ? (fits ? 'text-cream-100' : 'text-rose-700') : 'text-forest-900'}`}>
                                  {formatTimeRange(slot.start_time, slot.end_time)}
                                </span>
                                <span className={`block text-xs ${isSelected ? (fits ? 'text-cream-200' : 'text-rose-600') : fits ? 'text-charcoal-400' : 'text-stone-400 line-through'}`}>
                                  {fits ? `เหลือ ${slot.remaining} ลำ` : !slot.available ? 'เต็ม' : 'เรือไม่พอ'}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {cartLines.length === 0 && (
                          <p className="mt-1.5 text-xs text-charcoal-400">ใส่จำนวนผู้โดยสารด้านล่างก่อน เพื่อกรองเฉพาะรอบที่มีเรือว่างพอ</p>
                        )}
                      </>
                    )}
                  </div>

                  <div>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-300">จำนวนผู้โดยสารต่อประเภทเรือ</p>
                    {typeOptions.length > 1 && (
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setTypeFilter('all')}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                            typeFilter === 'all'
                              ? 'border-forest-800 bg-forest-800 text-cream-100'
                              : 'border-stone-200 text-charcoal-500 hover:border-forest-300 hover:bg-forest-50'
                          }`}
                        >
                          ทุกประเภท
                        </button>
                        {typeOptions.map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setTypeFilter(type)}
                            className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                              typeFilter === type
                                ? 'border-forest-800 bg-forest-800 text-cream-100'
                                : 'border-stone-200 text-charcoal-500 hover:border-forest-300 hover:bg-forest-50'
                            }`}
                          >
                            {TYPE_LABELS[type] || type}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {!selectedDate ? (
                    <p className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-xs text-charcoal-400">
                      เลือกวันในปฏิทินก่อน แล้วใส่จำนวนคนต่อประเภทเรือ
                    </p>
                  ) : boatsLoading || slotsLoading ? (
                    <div className="space-y-2">
                      {[0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-stone-100" />)}
                    </div>
                  ) : boats.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-xs text-charcoal-400">
                      ยังไม่มีเรือเปิดให้จอง
                    </p>
                  ) : filteredBoats.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-stone-200 px-4 py-8 text-center text-xs text-charcoal-400">
                      ไม่มีเรือประเภทนี้
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {filteredBoats.map((boat) => {
                        const hasRound = hasAnyRoundByType[boat.id];
                        const remainingInSlot = selectedSlotKey 
                          ? slots.find(s => s.key === selectedSlotKey)?.remainingByType[boat.id] ?? 0
                          : maxRemainingByType[boat.id] ?? 0;
                        
                        const boatCount = boatCountByType[boat.id] || 0;
                        const disabled = !hasRound || remainingInSlot < 1;
                        
                        return (
                          <div
                            key={boat.id}
                            className={`overflow-hidden rounded-xl border transition-colors ${
                              disabled ? 'border-stone-100 bg-stone-50/50 opacity-60' : 'border-stone-200/80 bg-white'
                            }`}
                          >
                            <div className="flex flex-wrap gap-3 p-3">
                              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-lagoon-50">
                                {boat.image ? (
                                  <img src={resolveMediaUrl(boat.image)} alt={boat.name} className="h-full w-full object-cover" />
                                ) : (
                                  <div className="grid h-full w-full place-items-center text-lagoon-600">
                                    <Sailboat size={22} />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <span className="mb-1 inline-block rounded-full bg-lagoon-50 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-lagoon-700">
                                  {TYPE_LABELS[boat.type] || 'อื่นๆ'}
                                </span>
                                <p className="truncate text-sm font-semibold text-forest-900">{boat.name}</p>
                                {boat.description && (
                                  <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-charcoal-400">{boat.description}</p>
                                )}
                                <p className="mt-1 flex items-center gap-1 text-xs text-charcoal-500">
                                  <Users size={12} className="text-forest-400" />
                                  นั่งได้สูงสุด {boat.capacity} คน/ลำ · ฿{Number(boat.price_per_hour).toLocaleString()}/ลำ
                                  {disabled && ` · ${!hasRound ? 'ไม่มีรอบในวันนี้' : 'เต็ม'}`}
                                  {!disabled && (
                                    <span className="text-forest-600 font-medium ml-1">
                                      · {selectedSlotKey ? `รอบนี้เหลือ ${remainingInSlot} ลำ` : `เหลือสูงสุด ${remainingInSlot} ลำ/รอบ`}
                                    </span>
                                  )}
                                </p>
                              </div>

                              {!disabled && (
                                <div className="ml-auto flex shrink-0 flex-col items-end gap-2 text-right">
                                  <div>
                                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-charcoal-300">จำนวนลำ</p>
                                    <Stepper
                                      value={boatCount}
                                      min={0}
                                      max={remainingInSlot}
                                      ariaLabel={`จำนวนลำ ${boat.name}`}
                                      onChange={(v) => handleBoatCountChange(boat.id, v)}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              </div>
            </section>
          </div>

          {/* Booking summary sidebar */}
          <aside className="lg:sticky lg:top-24">
            <form onSubmit={handleBooking} className={CARD}>
              <SectionHeading icon={<CreditCard size={16} />} title="สรุปการจอง" />

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-stone-100 pt-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-300">วันที่</p>
                  <p className="mt-0.5 text-sm font-semibold text-forest-900">
                    {selectedDate ? formatThaiDateLong(selectedDate) : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-300">รอบเวลา</p>
                  <p className="mt-0.5 text-sm font-semibold tabular-nums text-forest-900">
                    {selectedSlot ? formatTimeRange(selectedSlot.start_time, selectedSlot.end_time) : '—'}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-2.5 border-t border-stone-100 pt-5">
                {cartLines.length === 0 ? (
                  <p className="text-xs text-charcoal-400">ยังไม่ได้ใส่จำนวนผู้โดยสาร</p>
                ) : (
                  cartLines.map((line) => {
                    const gross = lineSubtotal(line.price_per_hour, line.boat_count);
                    const discount = line.free_tickets_used * line.price_per_hour;
                    const sub = Math.max(0, gross - discount);
                    return (
                      <div key={line.boat_type_id} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-forest-900">{line.name}</p>
                          <p className="text-xs text-charcoal-400">
                            {line.boat_count} ลำ
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          {discount > 0 && (
                            <p className="text-xs text-stone-400 line-through">฿{gross.toLocaleString()}</p>
                          )}
                          <p className="text-sm font-bold tabular-nums text-forest-900">
                            ฿{sub.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {cartLines.length > 0 && (
                <div className="mt-4 space-y-1.5 rounded-xl bg-forest-50/70 px-3.5 py-3 text-xs text-forest-900">
                  <div className="flex justify-between">
                    <span className="text-charcoal-500">เรือทั้งหมด</span>
                    <span className="font-bold tabular-nums">{totalBoats} ลำ</span>
                  </div>
                </div>
              )}

              <div className="mt-5 flex items-center justify-between rounded-xl bg-forest-900 px-4 py-3.5">
                <span className="text-sm font-bold text-cream-100">ราคารวม</span>
                <span className="font-sans text-2xl font-extrabold leading-none text-cream-100">
                  ฿{totalPrice.toLocaleString()}
                </span>
              </div>

              {(() => {
                const isDateInvalid = !selectedDate || (selectedDate === today && pastCutoffToday);
                const hasNoCart = cartLines.length === 0;
                const hasNoSlot = !selectedSlot;
                const slotNotFit = selectedSlot && !slotFitsCart(selectedSlot, cartLines);
                const isDisabled = bookingLoading || isDateInvalid || hasNoSlot || hasNoCart || slotNotFit;
                
                let btnText = 'ยืนยันการจองเรือ';
                if (bookingLoading) btnText = 'กำลังจอง...';
                else if (isDateInvalid) btnText = 'กรุณาเลือกวันที่';
                else if (hasNoSlot) btnText = 'กรุณาเลือกรอบเวลา';
                else if (hasNoCart) btnText = 'กรุณาระบุจำนวนผู้โดยสาร';
                else if (slotNotFit) btnText = 'เรือในรอบที่เลือกไม่พอ';

                return (
                  <button
                    type="submit"
                    disabled={!!isDisabled}
                    className={`btn-primary mt-5 w-full disabled:cursor-not-allowed ${slotNotFit ? 'disabled:bg-rose-100 disabled:text-rose-600 disabled:opacity-100' : 'disabled:opacity-50'}`}
                  >
                    {btnText}
                  </button>
                );
              })()}
              <p className="mt-3 text-center text-xs text-charcoal-400">
                ยังไม่ตัดเงิน — ชำระเงินในขั้นตอนถัดไป (ครั้งเดียวทั้งกลุ่ม)
              </p>
            </form>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function KayaksPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <KayaksPageContent />
    </Suspense>
  );
}
