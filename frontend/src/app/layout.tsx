'use client';

import './globals.css';
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { AuthProvider } from '@/hooks/useAuth';
import { usePathname } from 'next/navigation';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {

  const pathname = usePathname();

  const hideLayout =
    pathname === "/auth/login" ||
    pathname === "/auth/register";

  return (
    <html lang="th">
      <head>
        <title>สวนวลัยรุกขเวช — ที่พักลอยน้ำ</title>

        <meta
          name="description"
          content="สวนวลัยรุกขเวช ที่พักลอยน้ำสุดพิเศษท่ามกลางธรรมชาติ พร้อมกิจกรรมเรือคายัค จ.มหาสารคาม"
        />

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1"
        />

        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>

      <body className="bg-cream-100 text-charcoal antialiased">
        <AuthProvider>

          {!hideLayout && <Navbar />}

          <main>{children}</main>

          {!hideLayout && <Footer />}

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
      </body>
    </html>
  );
}