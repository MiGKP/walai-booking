"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  Anchor,
  CreditCard,
  CheckCircle,
  PlusCircle,
  Home,
  Sailboat,
  BarChart3,
  MessageSquare,
  Building2,
  Clock,
  UserCheck,
  Tag,
  LayoutDashboard,
  Calendar,
  Menu,
  X,
  ExternalLink,
  User,
  LogOut,
  ChevronDown,
  MapPin,
} from "lucide-react";

interface MenuItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

interface MenuGroup {
  title: string;
  icon: React.ReactNode;
  items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
  {
    title: "ข้อมูลสวนและรายงาน",
    icon: <Building2 size={18} />,
    items: [
      {
        label: "สถานที่หลัก & ชำระเงิน",
        path: "/admin/site-info",
        icon: <Building2 size={16} />,
      },
      {
        label: "จุดบริการห้องพัก",
        path: "/admin/rooms/location",
        icon: <MapPin size={16} />,
      },
      {
        label: "จุดบริการเรือ",
        path: "/admin/boats/location",
        icon: <Anchor size={16} />,
      },
      { label: "สถิติ", path: "/admin/stats", icon: <BarChart3 size={16} /> },
    ],
  },
  {
    title: "คนและโปรโมชั่น",
    icon: <Users size={18} />,
    items: [
      { label: "พนักงาน", path: "/admin/staff", icon: <Users size={16} /> },
      {
        label: "สมาชิก",
        path: "/admin/members",
        icon: <UserCheck size={16} />,
      },
      {
        label: "โปรโมชั่น",
        path: "/admin/promotions",
        icon: <Tag size={16} />,
      },
      {
        label: "รีวิว",
        path: "/admin/reviews",
        icon: <MessageSquare size={16} />,
      },
    ],
  },
  {
    title: "ห้องพัก",
    icon: <Home size={18} />,
    items: [
      {
        label: "ประเภทห้องพัก",
        path: "/admin/rooms/types",
        icon: <Home size={16} />,
      },
      {
        label: "สิ่งอำนวยความสะดวก",
        path: "/admin/rooms/amenities",
        icon: <CheckCircle size={16} />,
      },
      {
        label: "หมายเลขห้อง",
        path: "/admin/rooms/single",
        icon: <PlusCircle size={16} />,
      },
      {
        label: "แดชบอร์ดจองห้อง",
        path: "/admin/rooms/dashboard",
        icon: <CreditCard size={16} />,
      },
    ],
  },
  {
    title: "เรือคายัค",
    icon: <Anchor size={18} />,
    items: [
      {
        label: "ประเภทเรือ",
        path: "/admin/boats/types",
        icon: <Anchor size={16} />,
      },
      {
        label: "รอบเวลา",
        path: "/admin/boats/rounds",
        icon: <Sailboat size={16} />,
      },
      {
        label: "เวลาทำการ",
        path: "/admin/boat-hours",
        icon: <Clock size={16} />,
      },
      {
        label: "แดชบอร์ดจองเรือ",
        path: "/admin/boats/dashboard",
        icon: <CreditCard size={16} />,
      },
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();

  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const activeGroup = menuGroups.find((g) =>
      g.items.some((item) => item.path === pathname),
    );
    return activeGroup ? [activeGroup.title] : ["ข้อมูลสวนและรายงาน"];
  });

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    );
  };

  const navContent = (
    <div className="flex flex-col h-full py-5 px-3.5">
      {/* Brand / Logo */}
      <div className="px-3 mb-5">
        <h2 className="font-display font-semibold text-base text-forest-800">
          สวนวลัยรุกขเวช
        </h2>
        <p className="text-[11px] text-charcoal-400">ระบบจัดการผู้ดูแลระบบ</p>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
        {/* Dashboard Main Link */}
        <Link
          href="/admin"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            pathname === "/admin"
              ? "bg-forest-800 text-cream-100 shadow-sm"
              : "text-charcoal-600 hover:bg-stone-200/50"
          }`}
        >
          <LayoutDashboard size={18} />
          <span>ภาพรวม (Dashboard)</span>
        </Link>

        <Link
          href="/admin/calendar"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
            pathname === "/admin/calendar"
              ? "bg-forest-800 text-cream-100 shadow-sm"
              : "text-charcoal-600 hover:bg-stone-200/50"
          }`}
        >
          <Calendar size={18} />
          <span>ปฏิทินการจอง</span>
        </Link>

        {/* Accordion Groups */}
        {menuGroups.map((group) => {
          const isOpen = openGroups.includes(group.title);
          const hasActiveChild = group.items.some(
            (item) => item.path === pathname,
          );

          return (
            <div
              key={group.title}
              className="rounded-xl overflow-hidden transition-all"
            >
              {/* Header เมนูหลัก (กดเพื่อพับ/กาง) */}
              <button
                type="button"
                onClick={() => toggleGroup(group.title)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                  hasActiveChild
                    ? "text-forest-800 bg-forest-800/5"
                    : "text-charcoal-600 hover:bg-stone-200/50"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={
                      hasActiveChild ? "text-forest-800" : "text-charcoal-400"
                    }
                  >
                    {group.icon}
                  </span>
                  <span>{group.title}</span>
                </div>
                <ChevronDown
                  size={15}
                  className={`text-charcoal-400 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Sub-items (เมนูย่อย) */}
              {isOpen && (
                <div className="pl-4 pr-1 py-1 space-y-0.5 border-l-2 border-stone-200 ml-5 my-1">
                  {group.items.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                          isActive
                            ? "bg-forest-800/10 text-forest-800 font-bold"
                            : "text-charcoal-500 hover:text-forest-800 hover:bg-stone-100"
                        }`}
                      >
                        <span
                          className={
                            isActive ? "text-forest-800" : "text-charcoal-400"
                          }
                        >
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ส่วนท้าย Sidebar */}
      <div className="pt-3 border-t border-stone-200/80 space-y-2 mt-2">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium text-charcoal-600 hover:bg-stone-200/50 border border-stone-200 bg-white/40"
        >
          <ExternalLink size={15} />
          <span>ดูหน้าเว็บจริง (Live Site)</span>
        </a>

        <div className="bg-white/80 border border-stone-200/80 rounded-xl p-2.5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-forest-800 text-cream-100 flex items-center justify-center font-bold text-xs shrink-0">
              {user?.first_name?.[0]?.toUpperCase() || "A"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-forest-800 truncate">
                {user?.first_name
                  ? `${user.first_name} ${user.last_name || ""}`
                  : "ผู้ใช้แอดมิน"}
              </p>
              <p className="text-[10px] text-charcoal-400 truncate">
                {user?.email || "admin@walai.com"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1 pt-1.5 border-t border-stone-100">
            <Link
              href="/admin/profile"
              onClick={() => setMobileOpen(false)}
              className="flex items-center justify-center gap-1 py-1 text-[11px] font-medium text-charcoal-600 hover:text-forest-800 hover:bg-stone-100 rounded-lg transition-colors"
            >
              <User size={13} />
              <span>โปรไฟล์</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                logout?.();
              }}
              className="flex items-center justify-center gap-1 py-1 text-[11px] font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
            >
              <LogOut size={13} />
              <span>ออกระบบ</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="lg:hidden fixed top-3 left-3 z-40">
        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-xl bg-cream-100 border border-stone-200 shadow-sm text-forest-800"
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <aside className="hidden lg:block w-60 bg-cream-100 border-r border-stone-200/80 h-screen sticky top-0 shrink-0">
        {navContent}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-30 flex">
          <div
            className="fixed inset-0 bg-forest-900/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-60 max-w-[80%] bg-cream-100 h-full shadow-2xl z-40">
            {navContent}
          </aside>
        </div>
      )}
    </>
  );
}