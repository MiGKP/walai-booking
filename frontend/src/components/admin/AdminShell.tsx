"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { NotifyBanner } from "@/components/admin/ui";

const SEGMENT_LABELS: Record<string, string> = {
  admin: "ผู้ดูแลระบบ",
  staff: "พนักงาน",
  rooms: "ห้องพัก",
  boats: "เรือ",
  dashboard: "แดชบอร์ด",
  calendar: "ปฏิทินการจอง",
  checkin: "เช็คอิน-เช็คเอาต์",
  single: "จัดการรายห้อง",
  types: "ประเภท",
  amenities: "สิ่งอำนวยความสะดวก",
  location: "จุดบริการ",
  rounds: "รอบเวลา",
  stats: "สถิติ",
  members: "สมาชิก",
  staffs: "พนักงาน",
  promotions: "โปรโมชั่น",
  reviews: "รีวิว",
  profile: "โปรไฟล์",
  "site-info": "สถานที่หลัก & ชำระเงิน",
  "boat-hours": "เวลาทำการเรือ",
  "bank-accounts": "บัญชีรับเงิน",
  contact: "ช่องทางติดต่อ",
  policies: "นโยบาย",
};

function useBreadcrumb(pathname: string | null): string[] {
  if (!pathname) return [];
  return pathname
    .split("/")
    .filter(Boolean)
    .map((seg) => SEGMENT_LABELS[seg] ?? seg);
}

/** เปลือกหน้าแอดมิน/พนักงาน: sidebar + breadcrumb + แบนเนอร์แจ้งเตือน + เนื้อหา (ใช้ทั้งโรล admin / room_staff / boat_staff) */
export default function AdminShell({ children }: { children: ReactNode }): React.ReactElement {
  const pathname = usePathname();
  const crumbs = useBreadcrumb(pathname);

  return (
    <div className="admin-theme flex min-h-screen min-w-[768px] bg-cream-100">
      <AdminSidebar />
      <div className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-7xl space-y-5 px-6 py-6 lg:px-8">
          <nav aria-label="breadcrumb" className="flex flex-wrap items-center gap-1 text-xs text-charcoal-400">
            {crumbs.map((c, i) => (
              <span key={`${c}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} />}
                <span className={i === crumbs.length - 1 ? "font-medium text-charcoal-600" : ""}>{c}</span>
              </span>
            ))}
          </nav>
          <NotifyBanner />
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
