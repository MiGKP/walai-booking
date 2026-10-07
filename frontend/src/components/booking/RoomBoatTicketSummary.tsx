import Link from 'next/link';
import { formatThaiDate } from '@/lib/date';
import type { BoatTicketSummary } from '@/lib/room-boat-addon';

interface RoomBoatTicketSummaryProps {
  summary?: BoatTicketSummary | null;
  bookingId?: number;
  bookingStatus: string;
  hasTickets?: boolean;
}

export default function RoomBoatTicketSummary({ summary, bookingId, bookingStatus, hasTickets = false }: RoomBoatTicketSummaryProps): React.ReactElement | null {
  const active = ['pending', 'paid', 'approved'].includes(bookingStatus);
  if (summary ? summary.total_tickets <= 0 : !hasTickets || !active) return null;
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' });
  const hasDates = !!summary?.valid_from && !!summary?.valid_to && summary.valid_from <= summary.valid_to;
  const expired = hasDates && summary!.valid_to! < today;
  const canReserve = active && (summary ? (summary.bookable_tickets ?? summary.remaining_tickets) > 0 && hasDates && !expired
    && (summary.free_tickets > 0 || bookingStatus === 'pending') : hasTickets);

  return (
    <section className="rounded-xl border border-forest-200 bg-cream-50 p-4 text-left">
      <h3 className="text-sm font-semibold text-forest-900">สิทธิ์เรือจากโปรโมชั่นห้องพัก</h3>
      {summary ? (
        <div className="mt-2 space-y-2 text-xs leading-relaxed text-charcoal-600">
          <p className="font-semibold text-forest-800">{`ได้รับ ${summary.total_tickets} สิทธิ์ · จองรอบแล้ว ${summary.used_tickets} สิทธิ์ · คงเหลือ ${summary.remaining_tickets} สิทธิ์`}</p>
          <p>{[summary.free_tickets > 0 ? `ฟรี ${summary.free_tickets} สิทธิ์` : '', summary.paid_tickets > 0 ? `มีค่าใช้จ่าย ${summary.paid_tickets} สิทธิ์` : ''].filter(Boolean).join(' · ')}</p>
          {summary.paid_tickets > 0 && <p>สิทธิ์แบบมีค่าใช้จ่ายคิดราคาเมื่อจองรอบเรือ รวมในยอดค่าห้องพัก และต้องเลือกก่อนชำระค่าห้อง</p>}
          <p>1 สิทธิ์ = เรือ 1 ลำ 1 รอบ · จำนวนผู้โดยสารขึ้นอยู่กับความจุของประเภทเรือที่เลือก</p>
          {hasDates ? <p>ใช้ได้ {formatThaiDate(summary.valid_from!)} – {formatThaiDate(summary.valid_to!)} (ไม่รวมวันเช็คอินและวันเช็คเอาต์)</p>
            : <p className="text-bamboo-800">ไม่มีวันใช้สิทธิ์ระหว่างการเข้าพัก เพราะไม่รวมวันเช็คอินและวันเช็คเอาต์ การพัก 1 คืนจึงใช้สิทธิ์เรือนี้ไม่ได้</p>}
          {!active ? <p>การจองห้องพักสิ้นสุดแล้ว ไม่สามารถจองรอบเรือเพิ่มได้</p>
            : expired ? <p>พ้นช่วงวันที่ใช้สิทธิ์แล้ว ไม่สามารถจองรอบเรือเพิ่มได้</p>
              : summary.remaining_tickets === 0 ? <p>จองรอบเรือครบตามสิทธิ์แล้ว ดูรอบที่จองไว้ในรายละเอียดการจอง</p>
                : summary.bookable_tickets === 0 ? <p>มีสิทธิ์คงเหลือ แต่เงื่อนไขของห้องพักหรือการชำระเงินไม่อนุญาตให้ใช้สิทธิ์เหล่านี้ จึงไม่สามารถจองรอบเพิ่มได้</p> : null}
        </div>
      ) : <p className="mt-2 text-xs leading-relaxed text-charcoal-600">เลือกห้องเพื่อดูจำนวนสิทธิ์ เงื่อนไขราคา และวันที่ใช้สิทธิ์ก่อนจองรอบเรือ</p>}
      {canReserve && bookingId && <Link href={`/kayaks/room-addon?room_booking_id=${bookingId}`} className="mt-3 inline-flex rounded-lg bg-forest-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-forest-800">เลือกสิทธิ์และจองรอบเรือ</Link>}
    </section>
  );
}
