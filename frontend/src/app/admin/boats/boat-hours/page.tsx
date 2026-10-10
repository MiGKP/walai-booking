import { redirect } from 'next/navigation';

// ส่งต่อไปยังหน้าตั้งค่าเวลาทำการเรือ
export default function AdminBoatsBoatHoursRedirect(): never {
  redirect('/staff/boats/boat-hours');
}
