'use client';

import './globals.css';
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { AuthProvider } from '@/hooks/useAuth';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <title>สวนวลัยรุกขเวช</title>
        <meta name="description" content="สวนวลัยรุกขเวช ที่พักลอยน้ำสุดพิเศษ พร้อมกิจกรรมเรือคายัค" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <AuthProvider>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { fontFamily: 'Sarabun, sans-serif', borderRadius: '12px' },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
