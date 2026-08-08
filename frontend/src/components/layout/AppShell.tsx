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

  const isAuthPage = AUTH_PATHS_WITHOUT_CHROME.has(pathname);
  const isAdminPage = pathname?.startsWith('/admin');

  const hideChrome = isAuthPage || isAdminPage;

  return (
    <AuthProvider>
      {!hideChrome && <Navbar />}
      <main className="min-h-screen">{children}</main>
      {!hideChrome && <Footer />}
      
      {/* 🌟 ปรับเป็น top-center และแต่งสไตล์ตรงนี้ที่เดียว */}
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: "#0b3b2c",
            color: "#ffffff",
            borderRadius: "14px",
            fontSize: "13px",
            fontWeight: "600",
            padding: "12px 16px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15)",
          },
          success: {
            iconTheme: {
              primary: "#34d399",
              secondary: "#0b3b2c",
            },
          },
          error: {
            style: {
              background: "#881337",
              color: "#ffffff",
            },
            iconTheme: {
              primary: "#fb7185",
              secondary: "#881337",
            },
          },
        }}
      />
    </AuthProvider>
  );
}