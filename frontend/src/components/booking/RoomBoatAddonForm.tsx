'use client';

import { useEffect, useState } from 'react';
import api, { getApiErrorMessage } from '@/lib/api';
import { fetchKayakRounds, type KayakRound } from '@/lib/booking-calendar';
import { formatTimeRange, todayISO } from '@/lib/date';
import { canBookRoomBoatAddon, createRoomBoatAddon, type RoomBoatAddonInfo } from '@/lib/room-boat-addon';
import { isBoatSlotBookable, type BoatDayHours } from '@/lib/boat-time-policy';
import toast from 'react-hot-toast';

interface BoatType {
  id: number;
  name: string;
  capacity: number;
}

interface Props {
  bookingRoomId: number;
  info: RoomBoatAddonInfo;
  onCreated: () => void | Promise<void>;
}

export default function RoomBoatAddonForm({ bookingRoomId, info, onCreated }: Props): React.ReactElement | null {
  const today = todayISO();
  const firstDate = info.valid_from && info.valid_from > today ? info.valid_from : today;
  const eligible = canBookRoomBoatAddon(info, today);
  const [date, setDate] = useState(firstDate);
  const [boats, setBoats] = useState<BoatType[]>([]);
  const [boatId, setBoatId] = useState('');
  const [passengers, setPassengers] = useState(1);
  const [rounds, setRounds] = useState<KayakRound[]>([]);
  const [roundId, setRoundId] = useState('');
  const [roundsLoading, setRoundsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [boatHours, setBoatHours] = useState<BoatDayHours[]>([]);

  useEffect(() => {
    if (!eligible) return;
    let active = true;
    api.get('/kayaks').then(({ data }) => {
      if (active) setBoats(Array.isArray(data?.data) ? data.data : []);
    }).catch((error: unknown) => toast.error(getApiErrorMessage(error, 'โหลดประเภทเรือไม่สำเร็จ')));
    api.get('/settings/boat-hours').then(({ data }) => {
      if (active) setBoatHours(Array.isArray(data?.data) ? data.data : []);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [eligible]);

  useEffect(() => {
    if (!eligible || !boatId || !date) return;
    let active = true;
    setRounds([]);
    setRoundId('');
    setRoundsLoading(true);
    fetchKayakRounds({ kayakId: Number(boatId), bookingDate: date }).then((next) => {
      if (active) setRounds(next);
    }).catch((error: unknown) => {
      if (active) toast.error(getApiErrorMessage(error, 'โหลดรอบเรือไม่สำเร็จ'));
    }).finally(() => { if (active) setRoundsLoading(false); });
    return () => { active = false; };
  }, [eligible, boatId, date]);

  if (!eligible) return null;
  const selectedBoat = boats.find((boat) => boat.id === Number(boatId));
  const boatCount = Math.ceil(passengers / Math.max(1, Number(selectedBoat?.capacity ?? 1)));
  const maxPassengers = Number(selectedBoat?.capacity ?? 1) * Number(info.balance);
  const selectedRound = rounds.find((round) => round.boat_round_id === Number(roundId));
  const selectedDayHours = boatHours.find((hours) => hours.day_of_week === new Date(`${date}T12:00:00+07:00`).getUTCDay());
  const advanceMinutes = selectedDayHours?.advance_booking_minutes ?? boatHours[0]?.advance_booking_minutes ?? 60;
  const availableRound = !!selectedRound?.available && selectedRound.remaining >= boatCount
    && isBoatSlotBookable(date, selectedRound.start_time, selectedRound.end_time, selectedDayHours, advanceMinutes);

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!selectedBoat || !availableRound || boatCount > info.balance || date < firstDate || date > (info.valid_to ?? '')) {
      toast.error('กรุณาเลือกวันที่ ประเภทเรือ และรอบที่มีสิทธิ์เพียงพอ');
      return;
    }
    if (!selectedRound || !isBoatSlotBookable(date, selectedRound.start_time, selectedRound.end_time, selectedDayHours, advanceMinutes)) {
      toast.error('รอบที่เลือกใกล้เวลาออกเรือเกินไปหรืออยู่นอกเวลาทำการ กรุณาเลือกรอบใหม่');
      return;
    }
    setSubmitting(true);
    try {
      await createRoomBoatAddon(bookingRoomId, { boat_type_id: Number(boatId), boat_round_id: Number(roundId), booking_date: date, num_passengers: passengers });
      toast.success('จองรอบเรือด้วยสิทธิ์ห้องพักสำเร็จ');
      setRoundId('');
      await onCreated();
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, 'จองเรือเสริมไม่สำเร็จ'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mb-3 space-y-3 border-b border-stone-200 pb-4">
      <p className="text-sm font-semibold text-forest-900">
        เหลือ {info.balance} สิทธิ์ · {info.mode === 'free' ? 'บริการเรือฟรี' : `เพิ่มในบิลห้อง ฿${Number(info.unit_price).toLocaleString()} ต่อสิทธิ์`}
      </p>
      <p className="text-xs text-charcoal-500">ใช้ได้เฉพาะวันพักระหว่างวันเช็คอินและเช็คเอาต์ 1 สิทธิ์ต่อเรือ 1 ลำ</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-charcoal-600">วันที่ใช้บริการ
          <input type="date" className="input-field mt-1" value={date} min={firstDate} max={info.valid_to ?? undefined} onChange={(event) => { setDate(event.target.value); setRoundId(''); }} required />
        </label>
        <label className="text-xs font-semibold text-charcoal-600">ประเภทเรือ
          <select className="input-field mt-1" value={boatId} onChange={(event) => { setBoatId(event.target.value); setRoundId(''); setPassengers(1); }} required>
            <option value="">เลือกประเภทเรือ</option>
            {boats.map((boat) => <option key={boat.id} value={boat.id}>{boat.name} ({boat.capacity} ที่นั่ง)</option>)}
          </select>
        </label>
        <label className="text-xs font-semibold text-charcoal-600">จำนวนผู้โดยสาร
          <input type="number" className="input-field mt-1" value={passengers} min={1} max={maxPassengers} disabled={!selectedBoat} onChange={(event) => { setPassengers(Math.max(1, Math.min(maxPassengers, Math.floor(Number(event.target.value) || 1)))); setRoundId(''); }} required />
        </label>
        <label className="text-xs font-semibold text-charcoal-600">รอบเวลา
          <select className="input-field mt-1" value={roundId} onChange={(event) => setRoundId(event.target.value)} disabled={!boatId || roundsLoading} required>
            <option value="">{roundsLoading ? 'กำลังโหลดรอบ...' : 'เลือกรอบเวลา'}</option>
            {rounds.map((round) => <option key={round.boat_round_id} value={round.boat_round_id} disabled={!round.available || round.remaining < boatCount || !isBoatSlotBookable(date, round.start_time, round.end_time, selectedDayHours, advanceMinutes)}>{formatTimeRange(round.start_time, round.end_time)} · เหลือ {round.remaining} ลำ</option>)}
          </select>
        </label>
      </div>
      {info.mode === 'paid' && <p className="text-xs text-charcoal-600">เพิ่มค่าบริการ ฿{(Number(info.unit_price) * boatCount).toLocaleString()} ในยอดชำระห้องพัก</p>}
      <button type="submit" className="btn-primary text-sm disabled:opacity-50" disabled={submitting || roundsLoading || !availableRound}>{submitting ? 'กำลังจอง...' : 'จองรอบเรือด้วยสิทธิ์นี้'}</button>
    </form>
  );
}
