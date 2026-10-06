"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export default function NotFound(): React.ReactElement {
  const router = useRouter();

  const handleBack = (): void => {
    // ถ้าไม่มีประวัติการเปิดหน้าในแท็บนี้ (เช่น เปิดลิงก์ตรงมา) ให้กลับหน้าแรกแทน
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream-100 px-4 text-center">
      <p className="font-display text-7xl font-bold text-forest-800">404</p>
      <h1 className="mt-4 text-2xl font-bold text-charcoal">ไม่พบหน้านี้</h1>
      <p className="mt-2 max-w-md text-sm text-charcoal-400">
        หน้าที่คุณค้นหาไม่มีอยู่จริง หรืออาจถูกย้ายไปแล้ว
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={handleBack} className="btn-primary inline-flex items-center gap-2">
          <ArrowLeft size={16} aria-hidden="true" />
          ย้อนกลับ
        </button>
        <Link href="/" className="btn-secondary">
          กลับหน้าหลัก
        </Link>
      </div>
    </main>
  );
}
