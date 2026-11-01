import './globals.css';
import AppShell from '@/components/layout/AppShell';
import { Prompt, Noto_Sans_Thai } from 'next/font/google';

const prompt = Prompt({
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-prompt',
  display: 'swap',
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-noto-thai',
  display: 'swap',
});

// โครงสร้างหลักของแอปพลิเคชันสำหรับกำหนดฟอนต์และส่วนหัวของหน้าเว็บ
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="th" className={`${prompt.variable} ${notoSansThai.variable}`}>
      <head>
        <title>สวนวลัยรุกขเวช — ที่พักลอยน้ำ</title>
        <meta
          name="description"
          content="สวนวลัยรุกขเวช ที่พักลอยน้ำสุดพิเศษท่ามกลางธรรมชาติ พร้อมกิจกรรมเรือ จ.มหาสารคาม"
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
