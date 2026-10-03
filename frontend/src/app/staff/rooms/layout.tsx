"use client";
import AdminShell from "@/components/admin/AdminShell";
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function RoomStaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready } = useAuthGuard({ allowedRoles: ['room_staff'] });

  if (!ready) return null;
  return <AdminShell>{children}</AdminShell>;
}
