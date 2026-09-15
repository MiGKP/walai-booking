'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS: ReadonlyArray<{ href: string; label: string }> = [
  { href: '/dashboard', label: 'โปรไฟล์' },
  { href: '/dashboard/bookings', label: 'การจองของฉัน' },
  { href: '/dashboard/coupons', label: 'คูปองของฉัน' },
];

export default function DashboardTabs(): React.ReactElement {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex w-fit flex-wrap gap-1 rounded-xl bg-stone-200/70 p-1">
      {TABS.map((tab) => {
        const active =
          tab.href === '/dashboard'
            ? pathname === '/dashboard'
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={
              active
                ? 'rounded-lg bg-cream-100 px-4 py-2 text-sm font-medium text-forest-900 shadow-sm'
                : 'rounded-lg px-4 py-2 text-sm font-medium text-charcoal-500 hover:text-forest-800'
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
