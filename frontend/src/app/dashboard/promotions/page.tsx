import { redirect } from 'next/navigation';

// หน้านี้ถูกยุบรวมเข้าไปอยู่ในหน้า /dashboard แท็บ "โปรโมชั่นของฉัน" แล้ว
export default function DashboardPromotionsPage(): never {
  redirect('/dashboard?tab=coupons');
}
