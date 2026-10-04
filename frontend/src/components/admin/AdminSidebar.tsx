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
  MessageSquare,
  Building2,
  Clock,
  UserCheck,
  Tag,
  LayoutDashboard,
  Calendar,
  Menu,
  ExternalLink,
  User,
  LogOut,
  ChevronDown,
  MapPin,
  LogIn,
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

// ปฏิทินการจองเป็นลิงก์ด้านบนของ sidebar อยู่แล้ว จึงไม่ต้องอยู่ในรายการนี้
const roomStaffAllowedPaths = [
  "/admin/rooms/location",
  "/admin/promotions",
  "/admin/reviews",
  "/admin/rooms/single",
  "/admin/rooms/amenities",
  "/admin/checkin",
];

const boatStaffAllowedPaths = [
  "/admin/boats/location",
  "/admin/boats/types",
  "/admin/boats/rounds",
];

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
        label: "แดชบอร์ดจองห้อง",
        path: "/admin/rooms",
        icon: <CreditCard size={16} />,
      },
      {
        label: "เช็คอิน-เช็คเอาต์",
        path: "/admin/checkin",
        icon: <LogIn size={16} />,
      },
      {
        label: "จัดการรายห้อง",
        path: "/admin/rooms/single",
        icon: <PlusCircle size={16} />,
      },
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
    ],
  },
  {
    title: "เรือ",
    icon: <Anchor size={18} />,
    items: [
      {
        label: "แดชบอร์ดจองเรือ",
        path: "/admin/boats",
        icon: <CreditCard size={16} />,
      },
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
    ],
  },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  // ฟังก์ชันแปลง Path จาก /admin เป็น /staff/... ตาม Role
  const resolvePath = (path: string) => {
    if (user?.role === "room_staff") {
      if (path === "/admin") return "/staff/rooms/dashboard";

      // ถ้า path มี /admin/rooms อยู่แล้ว ให้เปลี่ยนแค่ /admin เป็น /staff (เพื่อไม่ให้ซ้ำ)
      if (path.startsWith("/admin/rooms")) {
        return path.replace("/admin", "/staff");
      }
      // ถ้าเป็น path อื่นๆ เช่น /admin/calendar -> /staff/rooms/calendar
      if (path.startsWith("/admin")) {
        return path.replace("/admin", "/staff/rooms");
      }
    }

    if (user?.role === "boat_staff") {
      // หน้าภาพรวมของ boat_staff ชี้ไปที่แดชบอร์ดของระบบเรือ
      if (path === "/admin") return "/staff/boats/dashboard";
      // เมนู "แดชบอร์ดจองเรือ" (/admin/boats) เปลี่ยนเป็นหน้าจัดการการจองเรือแยกต่างหาก
      if (path === "/admin/boats") return "/staff/boats";
      if (path.startsWith("/admin/boats")) {
        return path.replace("/admin/boats", "/staff/boats");
      }
      return path.replace("/admin", "/staff/boats");
    }

    return path;
  };

  const dashboardHref = resolvePath("/admin");
  const calendarHref = resolvePath("/admin/calendar");
  const profileHref = resolvePath("/admin/profile");

  // กรองเมนูและแปลง Path ย่อยตามสิทธิ์ของ user role
  const filteredMenuGroups = menuGroups
    .map((group) => {
      let allowedItems = group.items;

      if (user?.role === "room_staff") {
        allowedItems = group.items.filter((item) =>
          roomStaffAllowedPaths.includes(item.path),
        );
      } else if (user?.role === "boat_staff") {
        allowedItems = group.items.filter((item) =>
          boatStaffAllowedPaths.includes(item.path),
        );
      }

      return {
        ...group,
        items: allowedItems.map((item) => ({
          ...item,
          path: resolvePath(item.path),
        })),
      };
    })
    .filter((group) => group.items.length > 0);

  // เปิดเฉพาะหมวดที่ตรงกับหน้าปัจจุบันเท่านั้น — ถ้าอยู่หน้าที่ไม่ได้อยู่ในหมวดไหนเลย (เช่น "ภาพรวม")
  // ให้ทุกหมวดยุบไว้หมด แทนที่จะกางหมวดใดหมวดหนึ่งขึ้นมาแบบเดาสุ่ม
  const [openGroups, setOpenGroups] = useState<string[]>(() => {
    const activeGroup = filteredMenuGroups.find((g) =>
      g.items.some((item) => item.path === pathname),
    );
    return activeGroup ? [activeGroup.title] : [];
  });

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title],
    );
  };

  const [isCollapsed, setIsCollapsed] = useState(false);

  const renderNavContent = (collapsed: boolean, isMobile: boolean = false) => (
    <div className={`flex flex-col h-full py-5 ${collapsed ? "px-2" : "px-3.5"}`}>
      {/* Brand / Logo */}
      <div className={`mb-5 flex items-center ${collapsed ? "justify-center px-0" : "justify-between px-3"}`}>
        {!collapsed && (
          <div className="min-w-0 pr-2">
            <h2 className="font-display font-semibold text-base text-forest-800 truncate">
              สวนวลัยรุกขเวช
            </h2>
          </div>
        )}
        {!isMobile && (
          <button
            onClick={() => setIsCollapsed(!collapsed)}
            className={`p-1.5 rounded-lg text-charcoal-500 hover:bg-stone-200/50 hover:text-forest-800 transition-colors shrink-0 ${collapsed ? '' : '-mr-2'}`}
            title={collapsed ? "ขยายเมนู" : "ย่อเมนู"}
          >
            <Menu size={18} />
          </button>
        )}
      </div>

      {/* Nav Links */}
      <nav className={`flex-1 overflow-y-auto space-y-1.5 custom-scrollbar ${collapsed ? "" : "pr-1"}`}>
        {/* Dashboard Main Link */}
        <Link
          href={dashboardHref}
          title={collapsed ? "ภาพรวม (Dashboard)" : undefined}
          className={`flex items-center ${collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2"} rounded-xl text-xs font-semibold transition-all ${
            pathname === dashboardHref
              ? "bg-forest-800 text-cream-100 shadow-sm"
              : "text-charcoal-600 hover:bg-stone-200/50"
          }`}
        >
          <LayoutDashboard size={18} className="shrink-0" />
          {!collapsed && <span>ภาพรวม (Dashboard)</span>}
        </Link>

        {/* Calendar Link */}
        <Link
          href={calendarHref}
          title={collapsed ? "ปฏิทินการจอง" : undefined}
          className={`flex items-center ${collapsed ? "justify-center px-0 py-2.5" : "gap-2.5 px-3 py-2"} rounded-xl text-xs font-semibold transition-all ${
            pathname === calendarHref
              ? "bg-forest-800 text-cream-100 shadow-sm"
              : "text-charcoal-600 hover:bg-stone-200/50"
          }`}
        >
          <Calendar size={18} className="shrink-0" />
          {!collapsed && <span>ปฏิทินการจอง</span>}
        </Link>

        {/* Accordion Groups */}
        {filteredMenuGroups.map((group) => {
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
                onClick={() => {
                  if (collapsed) {
                    setIsCollapsed(false);
                    if (!isOpen) toggleGroup(group.title);
                  } else {
                    toggleGroup(group.title);
                  }
                }}
                title={collapsed ? group.title : undefined}
                className={`w-full flex items-center ${collapsed ? "justify-center px-0 py-2.5" : "justify-between px-3 py-2"} text-xs font-semibold rounded-xl transition-all ${
                  hasActiveChild
                    ? "text-forest-800 bg-forest-800/5"
                    : "text-charcoal-600 hover:bg-stone-200/50"
                }`}
              >
                <div className={`flex items-center ${collapsed ? "" : "gap-2.5"}`}>
                  <span
                    className={`shrink-0 ${hasActiveChild ? "text-forest-800" : "text-charcoal-400"}`}
                  >
                    {group.icon}
                  </span>
                  {!collapsed && <span>{group.title}</span>}
                </div>
                {!collapsed && (
                  <ChevronDown
                    size={15}
                    className={`text-charcoal-400 transition-transform duration-200 shrink-0 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                )}
              </button>

              {/* Sub-items (เมนูย่อย) */}
              {isOpen && (
                <div className={collapsed ? "py-1 space-y-1 my-1 flex flex-col items-center" : "pl-4 pr-1 py-1 space-y-0.5 border-l-2 border-stone-200 ml-5 my-1"}>
                  {group.items.map((item) => {
                    const isActive = pathname === item.path;
                    return (
                      <Link
                        key={item.path}
                        href={item.path}
                                      title={collapsed ? item.label : undefined}
                        className={`flex items-center ${collapsed ? "justify-center p-2 rounded-xl" : "gap-2 px-2.5 py-1.5 rounded-lg"} text-xs transition-all ${
                          isActive
                            ? "bg-forest-800/10 text-forest-800 font-bold"
                            : "text-charcoal-500 hover:text-forest-800 hover:bg-stone-100"
                        }`}
                      >
                        <span
                          className={`shrink-0 ${isActive ? "text-forest-800" : "text-charcoal-400"}`}
                        >
                          {item.icon}
                        </span>
                        {!collapsed && <span>{item.label}</span>}
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
      <div className={`pt-3 border-t border-stone-200/80 space-y-2 mt-2 ${collapsed ? "flex flex-col items-center" : ""}`}>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? "ดูหน้าเว็บจริง (Live Site)" : undefined}
          className={`flex items-center ${collapsed ? "justify-center p-2" : "gap-2 px-3 py-1.5"} rounded-xl text-xs font-medium text-charcoal-600 hover:bg-stone-200/50 border border-stone-200 bg-white/40 w-full`}
        >
          <ExternalLink size={15} className="shrink-0" />
          {!collapsed && <span>ดูหน้าเว็บจริง</span>}
        </a>

        <div className={`bg-white/80 border border-stone-200/80 rounded-xl shadow-sm ${collapsed ? "p-1.5 w-full flex flex-col items-center" : "p-2.5 w-full"}`}>
          <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2"} mb-2`}>
            <div className="w-7 h-7 rounded-full bg-forest-800 text-cream-100 flex items-center justify-center font-bold text-xs shrink-0" title={collapsed ? user?.first_name || "ผู้ใช้ระบบ" : undefined}>
              {user?.first_name?.[0]?.toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-forest-800 truncate">
                  {user?.first_name ? `${user.first_name}` : "ผู้ใช้ระบบ"}
                </p>
                <p className="text-xs text-charcoal-400 truncate">
                  {user?.email || "user@walai.com"}
                </p>
              </div>
            )}
          </div>

          <div className={`${collapsed ? "flex flex-col gap-1 w-full" : "grid grid-cols-2 gap-1"} pt-1.5 border-t border-stone-100`}>
            <Link
              href={profileHref}
                  title={collapsed ? "โปรไฟล์" : undefined}
              className={`flex items-center justify-center ${collapsed ? "p-1.5" : "gap-1 py-1"} text-xs font-medium text-charcoal-600 hover:text-forest-800 hover:bg-stone-100 rounded-lg transition-colors`}
            >
              <User size={13} className="shrink-0" />
              {!collapsed && <span>โปรไฟล์</span>}
            </Link>

            <button
              type="button"
              onClick={() => logout?.()}
              title={collapsed ? "ออกระบบ" : undefined}
              className={`flex items-center justify-center ${collapsed ? "p-1.5" : "gap-1 py-1"} text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors`}
            >
              <LogOut size={13} className="shrink-0" />
              {!collapsed && <span>ออกระบบ</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <aside
      className={`block bg-white border-r border-charcoal-100 h-screen sticky top-0 shrink-0 transition-all duration-300 ease-in-out ${isCollapsed ? "w-20" : "w-60"}`}
    >
      {renderNavContent(isCollapsed, false)}
    </aside>
  );
}
