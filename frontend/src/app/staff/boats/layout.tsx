'use client';

import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function BoatStaffLayout({ children }: { children: React.ReactNode }) {
  const { ready } = useAuthGuard({ allowedRoles: ['boat_staff'] });

  if (!ready) return null;
  return <>{children}</>;
}