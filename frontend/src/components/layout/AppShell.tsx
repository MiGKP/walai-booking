'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { AuthProvider } from '@/hooks/useAuth';
import GlobalConfirmModal from '@/components/layout/GlobalConfirmModal';

interface AppShellProps {
  children: ReactNode;
}

const AUTH_PATHS_WITHOUT_CHROME = new Set([
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/callback',
]);

// หน้าที่เป็น task-flow เฉพาะทาง (เช่น ขั้นตอนชำระเงิน, หน้าโปรไฟล์/การจอง) ไม่ต้องมี Footer มารบกวน แต่ยังเก็บ Navbar ไว้เพื่อให้เมนูหลักใช้งานได้
const PATHS_WITHOUT_FOOTER = new Set(['/payment', '/dashboard']);

export default function AppShell({ children }: AppShellProps): ReactNode {
  const pathname = usePathname();

  const isAuthPage = AUTH_PATHS_WITHOUT_CHROME.has(pathname);
  const isAdminPage = pathname?.startsWith('/admin');

  const hideChrome = isAuthPage || isAdminPage;
  const hideFooter = hideChrome || PATHS_WITHOUT_FOOTER.has(pathname);

  return (
    <AuthProvider>
      {!hideChrome && <Navbar />}
      <main className="min-h-screen">{children}</main>
      {!hideFooter && <Footer />}
      
      {/* 🌟 ปรับ Toast ให้ทันสมัย สไตล์ Minimal Pill & ย้ายลงล่าง */}
      <Toaster
        position="bottom-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: "#ffffff",
            color: "#123C30",
            border: "1px solid #e7e5e4",
            borderRadius: "100px",
            fontSize: "13.5px",
            fontWeight: "600",
            padding: "12px 20px",
            boxShadow: "0 8px 30px rgba(0, 0, 0, 0.08)",
          },
          success: {
            iconTheme: {
              primary: "#059669",
              secondary: "#ffffff",
            },
          },
          error: {
            style: {
              background: "#fff1f2",
              color: "#be123c",
              border: "1px solid #fecdd3",
            },
            iconTheme: {
              primary: "#e11d48",
              secondary: "#ffffff",
            },
          },
        }}
      />
      <GlobalConfirmModal />
    </AuthProvider>
  );
}
