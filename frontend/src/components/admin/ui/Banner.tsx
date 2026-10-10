"use client";

import { useState, useEffect, useRef, useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import {
  getNotifySnapshot,
  notify,
  subscribeNotify,
  type NotifyKind,
  type NotifyMessage,
} from "@/lib/admin-notify";

/**
 * ระยะเวลาแสดงผลที่เหมาะสม:
 * - success: 3.5 วินาที
 * - error: 5.0 วินาที
 * - info: 4.0 วินาที
 */
const DEFAULT_DURATIONS: Record<NotifyKind, number> = {
  success: 3500,
  error: 5000,
  info: 4000,
};

const KIND_CONFIG: Record<
  NotifyKind,
  {
    border: string;
    iconBg: string;
    icon: React.ReactNode;
  }
> = {
  success: {
    border: "border-forest-200/80 shadow-forest-950/8",
    iconBg: "bg-forest-50 text-forest-700 border border-forest-200/60",
    icon: <CheckCircle2 size={16} className="stroke-[2.2]" />,
  },
  error: {
    border: "border-rose-200/80 shadow-rose-950/8",
    iconBg: "bg-rose-50 text-rose-600 border border-rose-200/60",
    icon: <AlertCircle size={16} className="stroke-[2.2]" />,
  },
  info: {
    border: "border-lagoon-200/80 shadow-lagoon-950/8",
    iconBg: "bg-lagoon-50 text-lagoon-700 border border-lagoon-200/60",
    icon: <Info size={16} className="stroke-[2.2]" />,
  },
};

interface BannerProps {
  kind: NotifyKind;
  message: string;
  onClose?: () => void;
}

/** Component สำหรับกรณีเรียกใช้เฉพาะจุด */
export function Banner({ kind, message, onClose }: BannerProps): React.ReactElement {
  const config = KIND_CONFIG[kind];
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-2xl border bg-white/95 px-4 py-3 text-sm font-medium shadow-md ${config.border}`}
    >
      <span className="mt-0.5 shrink-0">{config.icon}</span>
      <p className="flex-1 leading-relaxed text-charcoal-900">{message}</p>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดการแจ้งเตือน"
          className="shrink-0 rounded-md p-0.5 text-charcoal-400 hover:text-charcoal-700 transition-colors cursor-pointer"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
}

/** Floating Toast Component สไตล์มินิมอล ลอยเหนือทุกอย่างแบบเรียบหรู */
function FloatingToast({ msg }: { msg: NotifyMessage }): React.ReactElement {
  const totalDuration = msg.duration ?? DEFAULT_DURATIONS[msg.kind];
  const [isExiting, setIsExiting] = useState(false);
  const remainingRef = useRef<number>(totalDuration);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const config = KIND_CONFIG[msg.kind];

  const handleClose = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsExiting(true);
    setTimeout(() => {
      notify.dismiss();
    }, 180);
  };

  const startTimer = (duration: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => {
      handleClose();
    }, duration);
  };

  useEffect(() => {
    setIsExiting(false);
    remainingRef.current = totalDuration;
    startTimer(totalDuration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [msg.id, totalDuration]);

  // หยุดเวลานับถอยหลังเมื่อเอาเมาส์ชี้ และนับต่อเมื่อเลื่อนเมาส์ออก
  const handleMouseEnter = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      const elapsed = Date.now() - startTimeRef.current;
      remainingRef.current = Math.max(0, remainingRef.current - elapsed);
    }
  };

  const handleMouseLeave = () => {
    if (remainingRef.current > 0 && !isExiting) {
      startTimer(remainingRef.current);
    }
  };

  return (
    <div
      role={msg.kind === "error" ? "alert" : "status"}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`pointer-events-auto relative w-full sm:w-auto min-w-[280px] max-w-md rounded-2xl border bg-white/95 backdrop-blur-md px-4 py-2.5 shadow-xl transition-all duration-200 ease-out ${config.border} ${
        isExiting
          ? "opacity-0 -translate-y-2 scale-95"
          : "opacity-100 translate-y-0 scale-100 animate-in fade-in slide-in-from-top-3 duration-200"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Soft Minimal Icon */}
        <div
          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${config.iconBg}`}
        >
          {config.icon}
        </div>

        {/* Message */}
        <p className="flex-1 min-w-0 text-xs sm:text-sm font-medium text-charcoal-800 leading-snug break-words">
          {msg.message}
        </p>

        {/* Minimal Close Button */}
        <button
          type="button"
          onClick={handleClose}
          aria-label="ปิดการแจ้งเตือน"
          className="p-1 rounded-lg text-charcoal-400 hover:text-charcoal-700 hover:bg-cream-100/70 transition-colors cursor-pointer shrink-0 -mr-1"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/** แบนเนอร์แจ้งเตือนกลางของแอดมิน — Floating Toast มินิมอล ลอยเหนือทุกอย่าง */
export function NotifyBanner(): React.ReactElement | null {
  const msg = useSyncExternalStore(subscribeNotify, getNotifySnapshot, () => null);
  if (!msg) return null;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none flex flex-col items-center w-full px-4 max-w-lg">
      <FloatingToast key={msg.id} msg={msg} />
    </div>
  );
}
