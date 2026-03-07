'use client';

import './globals.css';
import { Toaster } from 'react-hot-toast';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <title>วาลัย - ที่พักลอยน้ำ</title>
        <meta name="description" content="วาลัย ที่พักลอยน้ำสุดพิเศษ พร้อมกิจกรรมเรือคายัค" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
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
      </body>
    </html>
  );
}
