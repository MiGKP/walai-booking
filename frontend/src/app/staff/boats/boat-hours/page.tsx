import { redirect } from 'next/navigation';

// เวลาทำการเรือถูกรวมเข้ากับหน้าจุดบริการเรือ & ท่าเรือ เรียบร้อยแล้ว
export default function LegacyStaffBoatHoursPage(): never {
  redirect('/staff/boats/location');
}
