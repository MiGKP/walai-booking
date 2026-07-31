// src/app/admin/layout.tsx
import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)]" style={{ backgroundColor: 'var(--color-stone-100)' }}>
      {/* Sidebar แสดงผลทางซ้ายสำหรับทุกหน้าใต้ /admin */}
      <AdminSidebar />

      {/* พื้นที่แสดงเนื้อหาของแต่ละหน้าย่อย */}
      <main className="flex-1 max-w-7xl px-4 md:px-8 py-8 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}