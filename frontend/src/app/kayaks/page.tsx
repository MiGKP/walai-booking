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
  MonthCursor,
  formatThaiDateLong,
  formatTimeRange,
  monthCursorFromISO,
  monthRangeISO,
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

const TYPE_LABELS: Record<string, string> = {
  single: 'เรือเดี่ยว',
  double: 'เรือคู่',
  tandem: 'เรือครอบครัว',
};

export default function KayaksPage(): React.ReactElement {
  const router = useRouter();
  const today = todayISO();

  const [boats, setBoats] = useState<BoatType[]>([]);
  const [boatsLoading, setBoatsLoading] = useState(true);
  const [selectedBoat, setSelectedBoat] = useState<BoatType | null>(null);

  const [cursor, setCursor] = useState<MonthCursor>(() => monthCursorFromISO(today));
  const [dayStatus, setDayStatus] = useState<Record<string, DayStatus>>({});
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [rounds, setRounds] = useState<KayakRound[]>([]);
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [selectedRoundId, setSelectedRoundId] = useState<number | null>(null);
  const [passengers, setPassengers] = useState(1);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    api
      .get('/kayaks')
      .then((res) => setBoats(Array.isArray(res.data?.data) ? res.data.data : []))
      .catch(() => toast.error('ไม่สามารถโหลดข้อมูลเรือได้'))
      .finally(() => setBoatsLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedBoat) {
      setDayStatus({});
      return;
    }

    let cancelled = false;
    const { start, end } = monthRangeISO(cursor);
    setCalendarLoading(true);

    fetchKayakCalendar({ kayakId: selectedBoat.id, start, end })
      .then((days) => {
        if (cancelled) return;
        setDayStatus((prev) => ({ ...prev, ...toKayakDayStatus(days) }));
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
  }, [selectedBoat, cursor]);

  useEffect(() => {
    if (!selectedBoat || !selectedDate) {
      setRounds([]);
      return;
    }

    let cancelled = false;
    setRoundsLoading(true);
    setSelectedRoundId(null);

    fetchKayakRounds({ kayakId: selectedBoat.id, bookingDate: selectedDate })
      .then((data) => {
        if (cancelled) return;
        setRounds(data);
      })
      .catch(() => {
        if (!cancelled) toast.error('ไม่สามารถโหลดรอบเวลาได้');
      })
      .finally(() => {
        if (!cancelled) setRoundsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedBoat, selectedDate]);

  const selectedRound = useMemo(
    () => rounds.find((round) => round.boat_round_id === selectedRoundId) ?? null,
    [rounds, selectedRoundId]
  );

  const handleSelectBoat = (boat: BoatType): void => {
    const next = selectedBoat?.id === boat.id ? null : boat;
    setSelectedBoat(next);
    setSelectedDate(null);
    setSelectedRoundId(null);
    setPassengers(1);
    setDayStatus({});
    if (next) setCursor(monthCursorFromISO(today));
  };

  const handleBooking = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (typeof window !== 'undefined' && !localStorage.getItem('token')) {
      toast.error('กรุณาเข้าสู่ระบบก่อน');
      router.push('/auth/login');
      return;
    }
    if (!selectedBoat || !selectedDate || !selectedRound) {
      toast.error('กรุณาเลือกเรือ วันที่ และรอบเวลา');
      return;
    }

    setBookingLoading(true);
    try {
      const res = await api.post('/kayaks/bookings', {
        kayak_id: selectedBoat.id,
        booking_date: selectedDate,
        boat_round_id: selectedRound.boat_round_id,
        num_passengers: passengers,
      });
      toast.success('จองเรือสำเร็จ!');
      router.push(`/payment?booking_type=kayak&booking_id=${res.data.data.boat_booking_id}`);
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
            เลือกเรือก่อน แล้วปฏิทินจะบอกว่าวันไหนยังมีรอบเหลือ วันที่ขีดฆ่าคือเต็มทุกรอบแล้ว
          </p>
        </div>
      </header>

      <div className="container mx-auto px-4 py-10 lg:py-14">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] lg:gap-12">
          <div className="space-y-10">
            <section>
              <div className="mb-5 flex items-baseline gap-3 border-b border-stone-200 pb-3">
                <span className="font-display text-sm text-bamboo-600">01</span>
                <h2 className="font-display text-lg text-forest-900">เลือกเรือ</h2>
              </div>

              {boatsLoading ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {[0, 1].map((index) => (
                    <div key={index} className="card animate-pulse p-4">
                      <div className="h-36 rounded-xl bg-stone-200" />
                      <div className="mt-4 h-4 w-2/5 rounded bg-stone-200" />
                      <div className="mt-2.5 h-3 w-4/5 rounded bg-stone-200" />
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
                    const isSelected = selectedBoat?.id === boat.id;
                    return (
                      <button
                        key={boat.id}
                        type="button"
                        onClick={() => handleSelectBoat(boat)}
                        disabled={!boat.is_available}
                        aria-pressed={isSelected}
                        className={`card overflow-hidden p-0 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
                          isSelected
                            ? 'border-forest-800 ring-1 ring-forest-800'
                            : 'hover:border-lagoon-300'
                        }`}
                      >
                        <div className="h-40 bg-stone-200">
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
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="truncate font-display text-base text-forest-900">
                                {boat.name}
                              </h3>
                              <p className="mt-0.5 text-xs text-charcoal-400">
                                {TYPE_LABELS[boat.type] || 'เรือ'}
                              </p>
                            </div>
                            <p className="shrink-0 text-right">
                              <span className="font-display text-base text-forest-900 tabular-nums">
                                ฿{Number(boat.price_per_hour).toLocaleString()}
                              </span>
                              <span className="block text-xs text-charcoal-400">ต่อรอบ</span>
                            </p>
                          </div>
                          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-charcoal-500">
                            {boat.description}
                          </p>
                          <p className="mt-3 flex items-center gap-1.5 text-sm text-charcoal-400">
                            <Users size={14} /> {boat.capacity} คน
                            {!boat.is_available && (
                              <span className="ml-auto text-charcoal-400">หมดชั่วคราว</span>
                            )}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <section aria-labelledby="step-date">
              <div className="mb-5 flex items-baseline gap-3 border-b border-stone-200 pb-3">
                <span className="font-display text-sm text-bamboo-600">02</span>
                <h2 id="step-date" className="font-display text-lg text-forest-900">
                  เลือกวันและรอบเวลา
                </h2>
              </div>

              {!selectedBoat ? (
                <p className="card px-6 py-16 text-center text-sm text-charcoal-400">
                  เลือกเรือด้านบนก่อน แล้วปฏิทินจะแสดงวันที่ยังว่าง
                </p>
              ) : (
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="card p-5">
                    <BookingCalendar
                      mode="single"
                      value={selectedDate}
                      onSelect={setSelectedDate}
                      cursor={cursor}
                      onCursorChange={setCursor}
                      dayStatus={dayStatus}
                      loading={calendarLoading}
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
                          {roundsLoading
                            ? 'กำลังตรวจสอบรอบว่าง...'
                            : `${rounds.filter((round) => round.available).length} รอบว่างจากทั้งหมด ${rounds.length} รอบ`}
                        </p>

                        <div className="mt-4 space-y-2">
                          {roundsLoading ? (
                            [0, 1, 2].map((index) => (
                              <div
                                key={index}
                                className="h-14 animate-pulse rounded-xl bg-stone-200"
                              />
                            ))
                          ) : rounds.length === 0 ? (
                            <p className="py-8 text-center text-sm text-charcoal-400">
                              วันนี้ไม่มีรอบให้บริการ
                            </p>
                          ) : (
                            rounds.map((round) => {
                              const isSelected = round.boat_round_id === selectedRoundId;
                              return (
                                <button
                                  key={round.boat_round_id}
                                  type="button"
                                  disabled={!round.available}
                                  aria-pressed={isSelected}
                                  onClick={() => setSelectedRoundId(round.boat_round_id)}
                                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                                    isSelected
                                      ? 'border-forest-800 bg-forest-50'
                                      : round.available
                                        ? 'border-stone-200 hover:border-lagoon-300'
                                        : 'cursor-not-allowed border-stone-200 opacity-50'
                                  }`}
                                >
                                  <span className="text-sm font-medium tabular-nums text-forest-900">
                                    {formatTimeRange(round.start_time, round.end_time)}
                                  </span>
                                  <span
                                    className={`text-xs ${
                                      !round.available
                                        ? 'text-charcoal-400'
                                        : round.remaining <= 2
                                          ? 'text-bamboo-600'
                                          : 'text-lagoon-700'
                                    }`}
                                  >
                                    {round.available ? `เหลือ ${round.remaining} ลำ` : 'เต็ม'}
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
              )}
            </section>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <form onSubmit={handleBooking} className="card p-5 sm:p-6">
              <h2 className="font-display text-lg text-forest-900">สรุปการจอง</h2>

              <dl className="mt-5 space-y-3 border-t border-stone-200 pt-5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal-400">เรือ</dt>
                  <dd className="text-right font-medium text-forest-900">
                    {selectedBoat?.name ?? '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal-400">วันที่</dt>
                  <dd className="text-right font-medium text-forest-900">
                    {selectedDate ? formatThaiDateLong(selectedDate) : '—'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-charcoal-400">รอบเวลา</dt>
                  <dd className="text-right font-medium tabular-nums text-forest-900">
                    {selectedRound
                      ? formatTimeRange(selectedRound.start_time, selectedRound.end_time)
                      : '—'}
                  </dd>
                </div>
              </dl>

              {selectedBoat && (
                <div className="mt-5 border-t border-stone-200 pt-5">
                  <label
                    htmlFor="passengers"
                    className="mb-1.5 block text-sm font-medium text-charcoal-600"
                  >
                    ผู้โดยสาร (สูงสุด {selectedBoat.capacity} คน)
                  </label>
                  <input
                    id="passengers"
                    type="number"
                    required
                    min={1}
                    max={selectedBoat.capacity}
                    className="input-field"
                    value={passengers}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (!Number.isFinite(value)) return;
                      setPassengers(Math.min(Math.max(value, 1), selectedBoat.capacity));
                    }}
                  />
                </div>
              )}

              {selectedBoat && (
                <div className="mt-5 flex items-baseline justify-between border-t border-stone-200 pt-5">
                  <span className="text-sm font-semibold text-forest-900">ราคารวม</span>
                  <span className="font-display text-xl tabular-nums text-forest-900">
                    ฿{Number(selectedBoat.price_per_hour).toLocaleString()}
                  </span>
                </div>
              )}

              <button
                type="submit"
                disabled={bookingLoading || !selectedBoat || !selectedDate || !selectedRound}
                className="btn-primary mt-5 w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bookingLoading ? 'กำลังจอง...' : 'ยืนยันการจองเรือ'}
              </button>
              <p className="mt-3 text-center text-xs text-charcoal-400">
                ยังไม่ตัดเงิน — ชำระเงินในขั้นตอนถัดไป
              </p>
            </form>
          </aside>
        </div>
      </div>
    </div>
  );
}
