"use client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { ready } = useAuthGuard({ allowedRoles: ['room_staff'] });

  if (!ready) return null;
  return (
    <div className="flex min-h-screen bg-stone-50">
      {/* ใช้ Sidebar ตัวเดียวกับ Admin */}
      <AdminSidebar />

      {/* เนื้อหาหลักของหน้า Staff */}
      <main className="flex-1 p-6 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}