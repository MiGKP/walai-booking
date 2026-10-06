"use client";

import { useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  getNotifySnapshot,
  notify,
  subscribeNotify,
  type NotifyKind,
} from "@/lib/admin-notify";

const KIND_STYLES: Record<NotifyKind, string> = {
  success: "border-forest-200 bg-forest-50 text-forest-800",
  error: "border-rose-200 bg-rose-50 text-rose-700",
  info: "border-lagoon-200 bg-lagoon-50 text-lagoon-800",
};

const KIND_ICON: Record<NotifyKind, React.ReactNode> = {
  success: <CheckCircle2 size={18} />,
  error: <AlertCircle size={18} />,
  info: <Info size={18} />,
};

interface BannerProps {
  kind: NotifyKind;
  message: string;
  onClose?: () => void;
}

export function Banner({ kind, message, onClose }: BannerProps): React.ReactElement {
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium ${KIND_STYLES[kind]}`}
    >
      <span className="mt-0.5 shrink-0">{KIND_ICON[kind]}</span>
      <p className="flex-1 leading-relaxed">{message}</p>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดการแจ้งเตือน"
          className="shrink-0 rounded-md p-0.5 opacity-60 transition-opacity hover:opacity-100"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

/** แบนเนอร์แจ้งเตือนกลางของแอดมิน — วางครั้งเดียวใน layout */
export function NotifyBanner(): React.ReactElement | null {
  const msg = useSyncExternalStore(subscribeNotify, getNotifySnapshot, () => null);
  if (!msg) return null;
  return <Banner kind={msg.kind} message={msg.message} onClose={notify.dismiss} />;
}
