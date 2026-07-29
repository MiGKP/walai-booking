import './globals.css';
import AppShell from '@/components/layout/AppShell';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="th">
      <head>
        <title>สวนวลัยรุกขเวช — ที่พักลอยน้ำ</title>
        <meta
          name="description"
          content="สวนวลัยรุกขเวช ที่พักลอยน้ำสุดพิเศษท่ามกลางธรรมชาติ พร้อมกิจกรรมเรือคายัค จ.มหาสารคาม"
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body className="bg-cream-100 text-charcoal antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
