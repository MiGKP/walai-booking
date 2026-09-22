import './globals.css';
import AppShell from '@/components/layout/AppShell';
import { Pridi, Sarabun } from 'next/font/google';

// โหลด Pridi (display/heading) + Sarabun (body) ผ่าน next/font
// เพื่อได้ font preloading อัตโนมัติ ลด FOUT และปรับปรุง LCP
const pridi = Pridi({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-pridi',
  display: 'swap',
});

const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-sarabun',
  display: 'swap',
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="th" className={`${pridi.variable} ${sarabun.variable}`}>
      <head>
        <title>สวนวลัยรุกขเวช — ที่พักลอยน้ำ</title>
        <meta
          name="description"
          content="สวนวลัยรุกขเวช ที่พักลอยน้ำสุดพิเศษท่ามกลางธรรมชาติ พร้อมกิจกรรมเรือคายัค จ.มหาสารคาม"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/images/logo_walai.png" type="image/png" />
      </head>
      <body className="bg-cream-100 text-charcoal antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
