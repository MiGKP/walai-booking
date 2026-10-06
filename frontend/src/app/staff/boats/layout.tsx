"use client";
import AdminShell from "@/components/admin/AdminShell";
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function BoatStaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready } = useAuthGuard({ allowedRoles: ['boat_staff', 'admin'] });
  if (!ready) return null;
  return <AdminShell>{children}</AdminShell>;
}
