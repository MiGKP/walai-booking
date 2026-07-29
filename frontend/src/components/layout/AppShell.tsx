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
  const hideChrome = AUTH_PATHS_WITHOUT_CHROME.has(pathname);

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
