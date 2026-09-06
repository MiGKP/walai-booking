'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import api, { getApiErrorMessage } from '@/lib/api';
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
import PromoPriceBreakdown from '@/components/booking/PromoPriceBreakdown';
import PromoCodeFields, {
  type PromoPreview,
} from '@/components/booking/PromoCodeFields';
import {
  MonthCursor,
  formatThaiDateLong,
  formatTimeRange,
  monthCursorFromISO,
  multiMonthRangeISO,
  todayISO,
} from '@/lib/date';

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

function normalizeSlotTime(value: string): string {
  const raw = String(value || '').trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  if (/^\d{2}:\d{2}:\d{2}/.test(raw)) return raw.slice(0, 8);
  return raw;
}

export default function KayaksPage(): React.ReactElement {
  const router = useRouter();
  const today = todayISO();

  const [boats, setBoats] = useState<BoatType[]>([]);
  const [boatsLoading, setBoatsLoading] = useState(true);

  const [cursor, setCursor] = useState<MonthCursor>(() => monthCursorFromISO(today));
  const [dayStatus, setDayStatus] = useState<Record<string, DayStatus>>({});
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [slots, setSlots] = useState<SharedSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlotKey, setSelectedSlotKey] = useState<string | null>(null);

  const [passengersByType, setPassengersByType] = useState<Record<number, number>>({});
  const [bookingLoading, setBookingLoading] = useState(false);
  const [promoIds, setPromoIds] = useState<number[]>([]);
  const [promoPreview, setPromoPreview] = useState<PromoPreview | null>(null);

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
        setDayStatus(mergeDayStatus(lists.map((days) => toKayakDayStatus(days))));
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
  }, [boats, cursor]);

  useEffect(() => {
    if (!selectedDate || boats.length === 0) {
      setSlots([]);
      return;
    }

    let cancelled = false;
    setSlotsLoading(true);
    setSelectedSlotKey(null);
    setPassengersByType({});

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

  const cartLines: KayakCartLine[] = useMemo(() => {
    return boats
      .map((boat) => {
        const numPassengers = Number(passengersByType[boat.id] || 0);
        if (numPassengers < 1) return null;
        return {
          boat_type_id: boat.id,
          name: boat.name,
          capacity: boat.capacity,
          price_per_hour: Number(boat.price_per_hour),
          num_passengers: numPassengers,
        };
      })
      .filter((line): line is KayakCartLine => line != null);
  }, [boats, passengersByType]);

  const totalPrice = cartTotal(cartLines);
  const totalPassengers = cartPassengerTotal(cartLines);
  const totalBoats = cartBoatTotal(cartLines);

  const handleSelectDate = (date: string | null): void => {
    setSelectedDate(date);
    setSelectedSlotKey(null);
    setPassengersByType({});
  };

  const handleSelectSlot = (key: string): void => {
    setSelectedSlotKey(key);
    setPassengersByType({});
  };

  const handlePassengersChange = (boatId: number, raw: number): void => {
    if (!Number.isFinite(raw) || raw < 0) return;
    setPassengersByType((prev) => {
      const next = { ...prev };
      if (raw < 1) {
        delete next[boatId];
      } else {
        next[boatId] = Math.min(raw, 50);
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
    if (cartLines.length === 0) {
      toast.error('กรุณาระบุผู้โดยสารอย่างน้อย 1 ประเภทเรือ');
      return;
    }
    const unavailable = cartLines.filter(
      (line) => selectedSlot.remainingByType[line.boat_type_id] == null
    );
    if (unavailable.length > 0) {
      toast.error(
        `ไม่มีรอบเวลานี้สำหรับ: ${unavailable.map((line) => line.name).join(', ')}`
      );
      return;
    }

    setBookingLoading(true);
    try {
      const res = await api.post('/kayaks/bookings', {
        booking_date: selectedDate,
        start_time: normalizeSlotTime(selectedSlot.start_time),
        end_time: normalizeSlotTime(selectedSlot.end_time),
        items: cartLines.map((line) => ({
          boat_type_id: line.boat_type_id,
          num_passengers: line.num_passengers,
        })),
        ...(promoIds.length > 0 ? { promotion_ids: promoIds } : {}),
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
    <div className="min-h-screen bg-cream-200 pt-16">
      <header className="border-b border-stone-200 bg-cream-100">
        <div className="container mx-auto px-4 py-14 lg:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-lagoon-600">
            กิจกรรมทางน้ำ
          </p>
          <h1 className="mt-3 max-w-2xl text-balance font-display text-4xl leading-tight text-forest-900 lg:text-5xl">
            พายชมลำน้ำ เลือกวันและรอบที่ยังว่าง
          </h1>
          <div className="mt-6 h-px w-24 bg-bamboo-400" />
          <p className="mt-6 max-w-xl text-charcoal-500">
            เลือกวันและรอบเวลาก่อน แล้วใส่จำนวนผู้โดยสารต่อประเภทเรือ — จ่ายครั้งเดียวรวมทุกประเภท
          </p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:gap-12">
          <div className="space-y-10">
            <section aria-labelledby="step-date">
              <div className="mb-5 flex items-baseline gap-3 border-b border-stone-200 pb-3">
                <span className="font-display text-sm text-bamboo-600">01</span>
                <h2 id="step-date" className="font-display text-lg text-forest-900">
                  เลือกวันและรอบเวลา
                </h2>
              </div>

              <div className="space-y-6">
                <div className="card p-4 sm:p-5">
                  <BookingCalendar
                    mode="single"
                    value={selectedDate}
                    onSelect={handleSelectDate}
                    cursor={cursor}
                    onCursorChange={setCursor}
                    dayStatus={dayStatus}
                    loading={calendarLoading || boatsLoading}
                    minISO={today}
                  />
                </div>

                <div className="card p-5">
                  {!selectedDate ? (
                    <p className="grid h-full place-items-center py-10 text-center text-sm text-charcoal-400">
                      เลือกวันในปฏิทินเพื่อดูรอบเวลา
                    </p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-forest-900">
                        {formatThaiDateLong(selectedDate)}
                      </p>
                      <p className="mt-0.5 text-xs text-charcoal-400">
                        {slotsLoading
                          ? 'กำลังตรวจสอบรอบว่าง...'
                          : `${slots.filter((slot) => slot.available).length} รอบว่างจากทั้งหมด ${slots.length} รอบ`}
                      </p>

                      <div className="mt-4 space-y-2">
                        {slotsLoading ? (
                          [0, 1, 2].map((index) => (
                            <div
                              key={index}
                              className="h-14 animate-pulse rounded-xl bg-stone-200"
                            />
                          ))
                        ) : slots.length === 0 ? (
                          <p className="py-8 text-center text-sm text-charcoal-400">
                            วันนี้ไม่มีรอบให้บริการ
                          </p>
                        ) : (
                          slots.map((slot) => {
                            const isSelected = slot.key === selectedSlotKey;
                            return (
                              <button
                                key={slot.key}
                                type="button"
                                disabled={!slot.available}
                                aria-pressed={isSelected}
                                onClick={() => handleSelectSlot(slot.key)}
                                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                                  isSelected
                                    ? 'border-forest-800 bg-forest-50'
                                    : slot.available
                                      ? 'border-stone-200 hover:border-lagoon-300'
                                      : 'cursor-not-allowed border-stone-200 opacity-50'
                                }`}
                              >
                                <span className="text-sm font-medium tabular-nums text-forest-900">
                                  {formatTimeRange(slot.start_time, slot.end_time)}
                                </span>
                                <span
                                  className={`text-xs ${
                                    !slot.available
                                      ? 'text-charcoal-400'
                                      : slot.remaining <= 2
                                        ? 'text-bamboo-600'
                                        : 'text-lagoon-700'
                                  }`}
                                >
                                  {slot.available ? `เหลืออย่างน้อย ${slot.remaining} ลำ` : 'เต็ม'}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>

            <section>
              <div className="mb-5 flex items-baseline gap-3 border-b border-stone-200 pb-3">
                <span className="font-display text-sm text-bamboo-600">02</span>
                <h2 className="font-display text-lg text-forest-900">จำนวนผู้โดยสารต่อประเภทเรือ</h2>
              </div>

              {!selectedSlot ? (
                <p className="card px-6 py-16 text-center text-sm text-charcoal-400">
                  เลือกรอบเวลาก่อน แล้วใส่จำนวนคนต่อประเภทเรือ
                </p>
              ) : boatsLoading ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {[0, 1].map((index) => (
                    <div key={index} className="card animate-pulse p-4">
                      <div className="h-28 rounded-xl bg-stone-200" />
                      <div className="mt-4 h-4 w-2/5 rounded bg-stone-200" />
                    </div>
                  ))}
                </div>
              ) : boats.length === 0 ? (
                <p className="card px-6 py-16 text-center text-sm text-charcoal-400">
                  ยังไม่มีเรือเปิดให้จอง
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {boats.map((boat) => {
                    const slotRemaining = selectedSlot.remainingByType[boat.id];
                    const hasRound = slotRemaining != null;
                    const remaining = hasRound ? Number(slotRemaining) : 0;
                    const passengers = passengersByType[boat.id] ?? 0;
                    const needed =
                      passengers > 0 ? boatsNeeded(passengers, boat.capacity) : 0;
                    const subtotal =
                      needed > 0
                        ? lineSubtotal(Number(boat.price_per_hour), needed)
                        : 0;
                    const disabled = !hasRound || remaining < 1;
                    return (
                      <div
                        key={boat.id}
                        className={`card overflow-hidden p-0 ${disabled ? 'opacity-60' : ''}`}
                      >
                        <div className="h-32 bg-stone-200">
                          {boat.image ? (
                            <img
                              src={resolveMediaUrl(boat.image)}
                              alt={boat.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center bg-lagoon-50 font-display text-sm text-lagoon-600">
                              {TYPE_LABELS[boat.type] || 'เรือ'}
                            </div>
                          )}
                        </div>
                        <div className="space-y-3 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate font-display text-base text-forest-900">
                                {boat.name}
                              </h3>
                              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-charcoal-400">
                                <Users size={12} /> {boat.capacity} ที่นั่ง/ลำ · ฿
                                {Number(boat.price_per_hour).toLocaleString()}/ลำ
                              </p>
                            </div>
                          </div>
                          {disabled ? (
                            <p className="text-sm text-charcoal-400">
                              {!hasRound
                                ? 'ไม่มีรอบเวลานี้สำหรับเรือประเภทนี้'
                                : 'เต็มในรอบนี้'}
                            </p>
                          ) : (
                            <>
                              <div>
                                <label
                                  htmlFor={`pax-${boat.id}`}
                                  className="mb-1.5 block text-sm font-medium text-charcoal-600"
                                >
                                  ผู้โดยสาร
                                  <span className="ml-2 font-normal text-charcoal-400">
                                    เหลือ {remaining} ลำ
                                  </span>
                                </label>
                                <input
                                  id={`pax-${boat.id}`}
                                  type="number"
                                  min={0}
                                  max={50}
                                  className="input-field"
                                  value={passengers}
                                  onChange={(event) =>
                                    handlePassengersChange(
                                      boat.id,
                                      Number(event.target.value)
                                    )
                                  }
                                />
                              </div>
                              {needed > 0 && (
                                <p className="text-sm text-forest-800">
                                  ต้องใช้ {needed} ลำ · ฿{subtotal.toLocaleString()}
                                </p>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {cartLines.length > 0 && (
                <div className="mt-5 rounded-2xl border border-forest-800/15 bg-forest-50/60 px-4 py-3 text-sm text-forest-900">
                  <p className="font-medium">รวมทุกประเภท</p>
                  <p className="mt-1 text-charcoal-600">
                    ผู้โดยสาร {totalPassengers} คน · เรือ {totalBoats} ลำ · ฿
                    {totalPrice.toLocaleString()}
                  </p>
                </div>
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <form onSubmit={handleBooking} className="card p-5 sm:p-6">
              <h2 className="font-display text-lg text-forest-900">สรุปการจอง</h2>

              <dl className="mt-5 space-y-3 border-t border-stone-200 pt-5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal-400">วันที่</dt>
                  <dd className="text-right font-medium text-forest-900">
                    {selectedDate ? formatThaiDateLong(selectedDate) : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal-400">รอบเวลา</dt>
                  <dd className="text-right font-medium tabular-nums text-forest-900">
                    {selectedSlot
                      ? formatTimeRange(selectedSlot.start_time, selectedSlot.end_time)
                      : '—'}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 space-y-2 border-t border-stone-200 pt-5">
                {cartLines.length === 0 ? (
                  <p className="text-sm text-charcoal-400">ยังไม่ได้ใส่จำนวนผู้โดยสาร</p>
                ) : (
                  cartLines.map((line) => {
                    const count = boatsNeeded(line.num_passengers, line.capacity);
                    const sub = lineSubtotal(line.price_per_hour, count);
                    return (
                      <div
                        key={line.boat_type_id}
                        className="flex items-start justify-between gap-3 text-sm"
                      >
                        <div>
                          <p className="font-medium text-forest-900">{line.name}</p>
                          <p className="text-xs text-charcoal-400">
                            {line.num_passengers} คน · {count} ลำ
                          </p>
                        </div>
                        <p className="tabular-nums text-forest-900">
                          ฿{sub.toLocaleString()}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {cartLines.length > 0 && (
                <dl className="mt-4 space-y-2 rounded-xl bg-forest-50/70 px-3 py-3 text-sm text-forest-900">
                  <div className="flex justify-between gap-3">
                    <dt className="text-charcoal-500">ผู้โดยสารทั้งหมด</dt>
                    <dd className="font-medium tabular-nums">{totalPassengers} คน</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-charcoal-500">เรือทั้งหมด</dt>
                    <dd className="font-medium tabular-nums">{totalBoats} ลำ</dd>
                  </div>
                </dl>
              )}

              {cartLines.length > 0 && (
                <div className="mt-5 space-y-3 border-t border-stone-200 pt-5">
                  <PromoCodeFields
                    basePrice={totalPrice}
                    nights={null}
                    onChange={(ids, next) => {
                      setPromoIds(ids);
                      setPromoPreview(next);
                    }}
                  />
                  <PromoPriceBreakdown
                    basePrice={totalPrice}
                    promo={
                      promoPreview
                        ? {
                            name: promoPreview.lines[0]?.name ?? '',
                            code: promoPreview.lines[0]?.code,
                            discount_amount: promoPreview.discount_amount,
                            final_price: promoPreview.final_price,
                          }
                        : null
                    }
                    lines={promoPreview?.lines}
                  />
                </div>
              )}

              <div className="mt-5 flex items-baseline justify-between border-t border-stone-200 pt-5">
                <span className="text-sm font-semibold text-forest-900">ราคารวม</span>
                <span className="font-display text-xl tabular-nums text-forest-900">
                  ฿{totalPrice.toLocaleString()}
                </span>
              </div>

              <button
                type="submit"
                disabled={
                  bookingLoading ||
                  !selectedDate ||
                  !selectedSlot ||
                  cartLines.length === 0
                }
                className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bookingLoading ? 'กำลังจอง...' : 'ยืนยันการจองเรือ'}
              </button>
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
