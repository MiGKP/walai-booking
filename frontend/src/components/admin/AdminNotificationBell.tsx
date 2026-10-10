"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell,
  RefreshCw,
  BedDouble,
  Sailboat,
  LogIn,
  LogOut,
  ChevronRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  Ship,
} from "lucide-react";
import { useAdminNotificationStore } from "@/hooks/useAdminNotificationStore";
import { useAuth } from "@/hooks/useAuth";

export default function AdminNotificationBell(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const { counts, recentItems, isLoading, fetchNotifications } = useAdminNotificationStore();

  // Polling notifications every 45 seconds & initial fetch
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(() => {
      fetchNotifications(true);
    }, 45000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close dropdown on outside click or ESC
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const hasUrgent = counts.total_urgent > 0;
  const totalTasks = counts.total_urgent + counts.today_checkins;

  // Determine primary link for room and boat review
  const roomReviewHref =
    user?.role === "room_staff"
      ? "/staff/rooms/dashboard?filter=has_slip"
      : "/admin/rooms?filter=has_slip";
  const boatReviewHref =
    user?.role === "boat_staff"
      ? "/staff/boats/dashboard?filter=has_slip"
      : "/admin/boats?filter=has_slip";
  const checkinHref =
    user?.role === "room_staff"
      ? "/staff/rooms/checkin"
      : "/admin/checkin";

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => {
          if (!isOpen) fetchNotifications(true);
          setIsOpen((prev) => !prev);
        }}
        aria-label="แจ้งเตือนงานค้าง"
        title="แจ้งเตือนงานค้าง"
        className={`relative flex items-center justify-center w-9 h-9 rounded-xl border transition-all duration-200 ${
          isOpen
            ? "bg-forest-800 text-cream-100 border-forest-800 shadow-xs"
            : "bg-white text-charcoal-600 border-stone-200/80 hover:bg-stone-50 hover:text-forest-800 hover:border-stone-300"
        }`}
      >
        <Bell size={18} className={hasUrgent ? "stroke-[2.2]" : "stroke-[1.8]"} />

        {/* Badge & Ping */}
        {hasUrgent && (
          <>
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs ring-2 ring-white">
              {counts.total_urgent > 99 ? "99+" : counts.total_urgent}
            </span>
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-rose-400 opacity-75 animate-ping pointer-events-none" />
          </>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white border border-stone-200 shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-stone-50/80 border-b border-stone-100">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-charcoal-700">การแจ้งเตือนงานค้าง</span>
              {totalTasks > 0 ? (
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[11px] font-bold">
                  {totalTasks} รายการ
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-medium">
                  เรียบร้อยทั้งหมด
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fetchNotifications(false)}
              disabled={isLoading}
              className="p-1 rounded-lg text-charcoal-400 hover:text-forest-800 hover:bg-stone-200/50 transition-colors disabled:opacity-50"
              title="รีเฟรชข้อมูล"
            >
              <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
            </button>
          </div>

          {/* Quick Action Counters */}
          <div className="p-3 grid grid-cols-2 gap-2 bg-stone-50/40 border-b border-stone-100">
            {(user?.role === "admin" || user?.role === "room_staff") && (
              <Link
                href={roomReviewHref}
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-stone-200/80 hover:border-forest-600 hover:bg-forest-50/30 transition-all group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                    <BedDouble size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-charcoal-600 truncate">สลิปห้องพัก</p>
                    <p className="text-xs font-bold text-charcoal-800">
                      {counts.room_slips} <span className="text-[10px] font-normal text-charcoal-400">รอตรวจ</span>
                    </p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-charcoal-300 group-hover:text-forest-700 transition-colors shrink-0" />
              </Link>
            )}

            {(user?.role === "admin" || user?.role === "boat_staff") && (
              <Link
                href={boatReviewHref}
                onClick={() => setIsOpen(false)}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-stone-200/80 hover:border-forest-600 hover:bg-forest-50/30 transition-all group"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                    <Sailboat size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-charcoal-600 truncate">สลิปจองเรือ</p>
                    <p className="text-xs font-bold text-charcoal-800">
                      {counts.boat_slips} <span className="text-[10px] font-normal text-charcoal-400">รอตรวจ</span>
                    </p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-charcoal-300 group-hover:text-forest-700 transition-colors shrink-0" />
              </Link>
            )}

            {(user?.role === "admin" || user?.role === "room_staff") && (
              <Link
                href={checkinHref}
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between p-2.5 rounded-xl bg-white border border-stone-200/80 hover:border-forest-600 hover:bg-forest-50/30 transition-all group ${
                  user?.role === "admin" ? "col-span-1" : "col-span-2"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                    <LogIn size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-charcoal-600">เช็คอินห้องพัก</p>
                    <p className="text-xs font-bold text-charcoal-800">
                      {counts.today_checkins}{" "}
                      <span className="text-[10px] font-normal text-charcoal-400">ห้อง</span>
                    </p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-charcoal-300 group-hover:text-forest-700 transition-colors shrink-0" />
              </Link>
            )}

            {(user?.role === "admin" || user?.role === "boat_staff") && (
              <Link
                href={user?.role === "boat_staff" ? "/staff/boats/checkin" : "/admin/boats/checkin"}
                onClick={() => setIsOpen(false)}
                className={`flex items-center justify-between p-2.5 rounded-xl bg-white border border-stone-200/80 hover:border-forest-600 hover:bg-forest-50/30 transition-all group ${
                  user?.role === "admin" ? "col-span-1" : "col-span-2"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                    <Ship size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium text-charcoal-600">เช็คอินท่าเรือ</p>
                    <p className="text-xs font-bold text-charcoal-800">
                      {counts.today_boat_checkins}{" "}
                      <span className="text-[10px] font-normal text-charcoal-400">คิว</span>
                    </p>
                  </div>
                </div>
                <ChevronRight size={14} className="text-charcoal-300 group-hover:text-forest-700 transition-colors shrink-0" />
              </Link>
            )}
          </div>

          {/* Recent Pending Slips Section */}
          <div className="max-h-64 overflow-y-auto divide-y divide-stone-100">
            {recentItems.length === 0 ? (
              <div className="py-8 px-4 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle2 size={20} />
                </div>
                <p className="text-xs font-semibold text-charcoal-700">ไม่มีสลิปรอตรวจสอบในขณะนี้</p>
                <p className="text-[11px] text-charcoal-400 mt-0.5">
                  เมื่อลูกค้าส่งหลักฐานการโอนเงิน ระบบจะแสดงแจ้งเตือนที่นี่ทันที
                </p>
              </div>
            ) : (
              recentItems.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-start gap-3 p-3 hover:bg-stone-50 transition-colors group"
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                      item.type === "room_slip"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-teal-100 text-teal-800"
                    }`}
                  >
                    {item.type === "room_slip" ? <BedDouble size={14} /> : <Sailboat size={14} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs font-semibold text-charcoal-800 truncate group-hover:text-forest-800">
                        {item.title}
                      </p>
                      <span className="text-xs font-bold text-forest-800 shrink-0">
                        ฿{item.amount?.toLocaleString()}
                      </span>
                    </div>

                    <p className="text-[11px] text-charcoal-600 truncate mt-0.5">
                      {item.customer_name} • {item.detail}
                    </p>

                    {item.time && (
                      <p className="text-[10px] text-charcoal-400 flex items-center gap-1 mt-1">
                        <Clock size={10} />
                        {new Date(item.time).toLocaleTimeString("th-TH", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        น.
                      </p>
                    )}
                  </div>
                </Link>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-stone-50 border-t border-stone-100 text-center">
            <Link
              href={user?.role === "boat_staff" ? boatReviewHref : roomReviewHref}
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center justify-center gap-1 text-xs font-medium text-forest-800 hover:underline"
            >
              <span>ไปที่หน้ารายการจอง</span>
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
