'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api, { getApiErrorMessage } from '@/lib/api';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import BoatAddonSection from '@/components/booking/BoatAddonSection';

interface BookingRoom {
  booking_room_id: number;
  room_name: string;
  room_number: string;
  status?: string;
}

interface RoomBooking {
  status: string;
  rooms: BookingRoom[];
}

function RoomAddonContent(): React.ReactElement {
  const { ready } = useAuthGuard({ allowedRoles: ['customer'] });
  const params = useSearchParams();
  const bookingId = Number(params.get('room_booking_id'));
  const [booking, setBooking] = useState<RoomBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!Number.isInteger(bookingId) || bookingId < 1) {
      setError('ไม่พบรหัสการจองห้องพัก');
      setLoading(false);
      return;
    }
    let active = true;
    api.get(`/bookings/${bookingId}`).then(({ data }) => {
      if (active) setBooking(data.data);
    }).catch((err: unknown) => {
      if (active) setError(getApiErrorMessage(err, 'โหลดการจองห้องพักไม่สำเร็จ'));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready, bookingId]);

  return (
    <div className="min-h-screen bg-cream-100 px-4 pb-16 pt-24">
      <div className="mx-auto max-w-3xl space-y-5">
        <Link href="/dashboard" className="text-sm font-semibold text-forest-800">กลับไปการจองของฉัน</Link>
        <h1 className="font-display text-2xl text-forest-900">จองเรือด้วยสิทธิ์ห้องพัก</h1>
        {!ready || loading ? <p className="text-sm text-charcoal-500">กำลังโหลดสิทธิ์...</p> : error ? <p className="text-sm text-red-600">{error}</p> : booking && ['pending', 'paid', 'approved'].includes(booking.status) ? (
          <>
            <p className="text-sm text-charcoal-600">เลือกสิทธิ์ของแต่ละห้องและรอบเวลาที่ต้องการ บริการฟรีไม่ต้องชำระแยก ส่วนบริการที่มีค่าใช้จ่ายจะเพิ่มในบิลห้องพัก</p>
            {booking.rooms.filter(room => !['checked_out', 'cancelled', 'rejected'].includes(room.status ?? '')).map((room) => (
              <section key={room.booking_room_id} className="rounded-2xl border border-stone-200 bg-white p-5">
                <h2 className="mb-3 text-base font-semibold text-forest-900">{room.room_name} · ห้อง {room.room_number}</h2>
                <BoatAddonSection bookingRoomId={room.booking_room_id} roomBookingStatus={booking.status} allowBooking />
              </section>
            ))}
            {booking.status === 'pending' && <Link href={`/payment?booking_type=room&booking_id=${bookingId}`} className="btn-primary inline-block">ดำเนินการชำระค่าห้องพัก</Link>}
          </>
        ) : <p className="text-sm text-charcoal-500">การจองห้องพักนี้ไม่สามารถใช้สิทธิ์เรือได้แล้ว</p>}
      </div>
    </div>
  );
}

export default function RoomAddonPage(): React.ReactElement {
  return <Suspense fallback={<div className="min-h-screen bg-cream-100 pt-24 text-center">กำลังโหลด...</div>}><RoomAddonContent /></Suspense>;
}
