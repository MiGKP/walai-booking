'use client';

import { CalendarDays } from 'lucide-react';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import Link from 'next/link';
import MyBookingsPanel from '@/components/dashboard/MyBookingsPanel';

const CARD = 'rounded-2xl border border-stone-200/80 bg-white shadow-[0_1px_2px_rgba(18,60,48,0.02),0_8px_24px_-8px_rgba(18,60,48,0.08)] p-5 sm:p-6';

export default function BookingsPage() {
  const { ready, user } = useAuthGuard();

  return (
    <div className="min-h-screen bg-cream-100 pt-20 pb-12">
      <div className="container mx-auto max-w-4xl px-4">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-forest-50 text-forest-700"><CalendarDays size={18} /></span>
          <div>
            <h1 className="font-sans text-[24px] font-semibold leading-tight text-forest-900 sm:text-[28px]">การจองของฉัน</h1>
            <p className="text-[12.5px] text-charcoal-400">
              ประวัติและสถานะการจองทั้งหมด{user ? ` · ${user.first_name || ''} ${user.last_name || ''}` : ''}
            </p>
          </div>
        </div>

        {/* Nav Tabs */}
        <div className="mb-6 flex w-fit gap-1 rounded-xl bg-stone-100 p-1">
          <Link href="/dashboard" className="rounded-lg px-4 py-2 text-[13px] font-semibold text-charcoal-500 transition-colors hover:text-forest-900">โปรไฟล์</Link>
          <Link href="/dashboard/bookings" className="rounded-lg bg-white px-4 py-2 text-[13px] font-semibold text-forest-900 shadow-sm">การจองของฉัน</Link>
        </div>

        <section className={CARD}>
          <MyBookingsPanel ready={ready} />
        </section>
      </div>
    </div>
  );
}
