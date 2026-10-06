"use client";
// src/app/admin/layout.tsx
import AdminShell from '@/components/admin/AdminShell';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready } = useAuthGuard({ allowedRoles: ['admin'] });

  if (!ready) return null;
  return <AdminShell>{children}</AdminShell>;
}
