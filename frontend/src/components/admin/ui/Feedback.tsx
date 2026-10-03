import type { ReactNode } from "react";
import { Inbox } from "lucide-react";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

const BADGE: Record<BadgeTone, string> = {
  success: "bg-forest-50 text-forest-700",
  warning: "bg-bamboo-50 text-bamboo-700",
  danger: "bg-rose-50 text-rose-700",
  info: "bg-lagoon-50 text-lagoon-700",
  neutral: "bg-charcoal-50 text-charcoal-500",
};

const DOT: Record<BadgeTone, string> = {
  success: "bg-forest-500",
  warning: "bg-bamboo-400",
  danger: "bg-rose-500",
  info: "bg-lagoon-500",
  neutral: "bg-charcoal-300",
};

export function StatusBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }): React.ReactElement {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${BADGE[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
      {children}
    </span>
  );
}

/** แปลงสถานะการจอง (CHECK constraint) เป็นป้ายสี + ข้อความไทย */
export function BookingStatusBadge({ status }: { status: string }): React.ReactElement {
  const map: Record<string, { tone: BadgeTone; label: string }> = {
    pending: { tone: "neutral", label: "ยังไม่ชำระเงิน" },
    paid: { tone: "info", label: "รอตรวจสอบสลิป" },
    approved: { tone: "success", label: "อนุมัติแล้ว" },
    rejected: { tone: "danger", label: "ปฏิเสธ" },
    cancelled: { tone: "neutral", label: "ยกเลิก" },
    checked_out: { tone: "warning", label: "เช็คเอาต์แล้ว" },
  };
  const s = map[status] ?? { tone: "neutral" as BadgeTone, label: status };
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <Inbox className="h-10 w-10 stroke-[1.25] text-charcoal-300" />
      <p className="text-sm font-semibold text-charcoal-600">{title}</p>
      {description && <p className="max-w-sm text-xs text-charcoal-400">{description}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }): React.ReactElement {
  return <div className={`animate-pulse rounded-lg bg-charcoal-100 ${className}`} />;
}
