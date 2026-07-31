'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { AuthProvider } from '@/hooks/useAuth';

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

export default function AppShell({ children }: AppShellProps): ReactNode {
  const pathname = usePathname();

  // เช็คว่า path ปัจจุบันเป็นหน้า Auth หรือ เป็นหน้า Admin หรือไม่
  const isAuthPage = AUTH_PATHS_WITHOUT_CHROME.has(pathname);
  const isAdminPage = pathname?.startsWith('/admin');

  // ถ้าเป็นหน้า Auth หรือ Admin ให้ซ่อน Navbar และ Footer
  const hideChrome = isAuthPage || isAdminPage;

  return (
    <AuthProvider>
      {!hideChrome && <Navbar />}
      <main className="min-h-screen">{children}</main>
      {!hideChrome && <Footer />}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            fontFamily: 'Sarabun, sans-serif',
            borderRadius: '12px',
          },
        }}
      />
    </AuthProvider>
  );
}