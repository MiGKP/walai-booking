import { redirect } from 'next/navigation';

// หน้าเวลาทำการเรือย้ายไปอยู่ใต้ /staff/boats เพื่อให้ทั้ง admin และ boat_staff เข้าถึงได้
export default function LegacyBoatHoursPage(): never {
  redirect('/staff/boats/boat-hours');
}
