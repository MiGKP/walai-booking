"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X, User, LogOut, ChevronDown, Star, Ticket } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { resolveAvatarUrl } from "@/lib/avatar";
import Image from "next/image";

const NAV_LINKS = [
  { href: "/", label: "หน้าแรก" },
  { href: "/rooms", label: "ห้องพัก" },
  { href: "/kayaks", label: "เรือคายัค" },
  { href: "/promotions", label: "โปรโมชั่น" },
];

// เส้นระลอกน้ำบางๆ แทนเส้นขอบล่างธรรมดา — ให้ความรู้สึก "ลอยน้ำ"
const WAVE_BORDER = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='8' viewBox='0 0 44 8'%3E%3Cpath d='M0 4 Q11 0 22 4 T44 4' fill='none' stroke='%23BFD3C4' stroke-width='1.2'/%3E%3C/svg%3E\")",
  backgroundRepeat: "repeat-x",
  backgroundPosition: "bottom",
  backgroundSize: "44px 8px",
} as const;

export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user, isAuthenticated, logout, loading } = useAuth();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarSrc = useMemo(
    () => resolveAvatarUrl(user?.avatar),
    [user?.avatar],
  );

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [avatarSrc]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen)
      document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    logout();
    router.push("/");
    setDropdownOpen(false);
  };

  if (pathname.startsWith("/admin") || pathname.startsWith("/staff")) {
    return null;
  }

  const isHomePage = pathname === "/";
  const showSolidNav = scrolled || !isHomePage;

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        showSolidNav
          ? "bg-cream-100/95 backdrop-blur-md shadow-[0_2px_10px_rgba(18,60,48,0.08)]"
          : "bg-transparent"
      }`}
      style={WAVE_BORDER}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="transition-transform duration-300 group-hover:scale-105 rounded-full overflow-hidden border-2 border-forest-800/10">
              <Image
                src="https://res.cloudinary.com/chbkkmxt/image/upload/v1790154452/walai-booking/walai_logo.jpg"
                alt="Logo Walai"
                width={40}
                height={40}
                className="object-cover w-10 h-10"
                priority
              />
            </div>
          </Link>



          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-4 py-2 rounded-full font-medium transition-colors duration-200 ${
                    active
                      ? "text-forest-800 bg-forest-50"
                      : "text-charcoal-600 hover:text-forest-800 hover:bg-forest-50/60"
                  }`}
                >
                  {link.label}
                  <span
                    className={`absolute -bottom-1 left-4 right-4 h-[2px] rounded-full bg-bamboo-400 transition-transform duration-250 origin-left ${
                      active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </Link>
              );
            })}
          </div>

          {/* Auth */}
          <div className="hidden md:flex items-center gap-3">
            {loading ? (
              <div className="flex items-center gap-3 animate-pulse px-4 py-2">
                <div className="w-8 h-8 rounded-full bg-stone-200"></div>
                <div className="w-20 h-4 rounded bg-stone-200"></div>
              </div>
            ) : isAuthenticated && user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  aria-label="เมนูผู้ใช้"
                  aria-expanded={dropdownOpen}
                  aria-haspopup="true"
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-forest-50 transition-colors duration-200"
                >
                  {avatarSrc && !avatarLoadError ? (
                    <img
                      src={avatarSrc}
                      alt={`${user.first_name} ${user.last_name}`}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-bamboo-400/50"
                      onError={() => setAvatarLoadError(true)}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-forest-100 flex items-center justify-center">
                      <User size={16} className="text-forest-700" />
                    </div>
                  )}
                  <span className="font-medium text-charcoal max-w-[120px] truncate">
                    {user.first_name} {user.last_name}
                  </span>
                  <ChevronDown
                    size={16}
                    className="text-charcoal-400 transition-transform duration-200"
                    style={{
                      transform: dropdownOpen
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                    }}
                  />
                </button>
                {dropdownOpen && (
                  <div
                    className="animate-dropdown absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-stone-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.08)] overflow-hidden"
                  >
                    {/* Header */}
                    <div className="flex items-center gap-3 px-4 py-4 border-b border-stone-100 bg-stone-50/50">
                      {avatarSrc && !avatarLoadError ? (
                        <img
                          src={avatarSrc}
                          alt={`${user.first_name} ${user.last_name}`}
                          className="w-10 h-10 rounded-full object-cover ring-2 ring-white shadow-sm"
                          onError={() => setAvatarLoadError(true)}
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-forest-100 flex items-center justify-center ring-2 ring-white shadow-sm">
                          <User size={18} className="text-forest-700" />
                        </div>
                      )}
                      <div className="flex flex-col min-w-0">
                        <p className="text-sm font-bold text-forest-900 truncate">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs text-charcoal-400 truncate">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    <div className="p-1.5">
                      <Link
                        href="/dashboard"
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-charcoal-600 hover:text-forest-800 hover:bg-forest-50 transition-colors"
                        onClick={() => setDropdownOpen(false)}
                      >
                        <User size={16} /> โปรไฟล์ของฉัน
                      </Link>

                      {(user.role === "admin" ||
                        user.role === "room_staff" ||
                        user.role === "boat_staff") && (
                        <div className="my-1.5 border-t border-stone-100" />
                      )}

                      {user.role === "admin" && (
                        <>
                          <Link
                            href="/admin"
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-forest-700 hover:bg-forest-50 transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            แผงควบคุม Admin
                          </Link>
                          <Link
                            href="/admin/stats"
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-forest-700 hover:bg-forest-50 transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            รายงานสถิติ
                          </Link>
                        </>
                      )}
                      {user.role === "room_staff" && (
                        <>
                          <Link
                            href="/staff/rooms/dashboard"
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-forest-700 hover:bg-forest-50 transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            แดชบอร์ดห้องพัก
                          </Link>
                          <Link
                            href="/admin/reviews"
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-forest-700 hover:bg-forest-50 transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            รีวิวจากผู้เข้าพัก
                          </Link>
                          <Link
                            href="/admin/stats"
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-forest-700 hover:bg-forest-50 transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            รายงานสถิติ
                          </Link>
                        </>
                      )}
                      {user.role === "boat_staff" && (
                        <>
                          <Link
                            href="/staff/boats/dashboard"
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-forest-700 hover:bg-forest-50 transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            แดชบอร์ดเรือ
                          </Link>
                          <Link
                            href="/admin/boat-hours"
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-forest-700 hover:bg-forest-50 transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            เวลาทำการเรือ
                          </Link>
                          <Link
                            href="/admin/stats"
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-forest-700 hover:bg-forest-50 transition-colors"
                            onClick={() => setDropdownOpen(false)}
                          >
                            รายงานสถิติ
                          </Link>
                        </>
                      )}

                      <div className="my-1.5 border-t border-stone-100" />
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors"
                      >
                        <LogOut size={16} /> ออกจากระบบ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-charcoal-600 hover:text-forest-800 font-medium transition-colors px-4 py-2"
                >
                  เข้าสู่ระบบ
                </Link>
                <Link
                  href="/auth/register"
                  className="btn-primary text-sm py-2 px-5"
                >
                  สมัครสมาชิก
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            aria-label={isOpen ? "ปิดเมนู" : "เปิดเมนู"}
            aria-expanded={isOpen}
            className="md:hidden p-2 rounded-lg text-charcoal hover:bg-forest-50 transition-colors"
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay / Focus Trap */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="เมนูหลัก"
          className="fixed inset-0 z-40 md:hidden bg-forest-950/20 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="animate-mobile-menu w-full bg-cream-100 px-4 py-4 space-y-1 rounded-b-3xl absolute top-[4.5rem] shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
          >
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block py-3 px-4 rounded-xl font-medium transition-colors ${
                    active
                      ? "bg-forest-50 text-forest-800"
                      : "text-charcoal hover:bg-forest-50"
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}

            {loading ? (
              <div className="py-4 flex justify-center">
                <div className="w-6 h-6 border-2 border-stone-200 border-t-forest-600 rounded-full animate-spin"></div>
              </div>
            ) : isAuthenticated ? (
              <>
                <div className="my-2 border-t border-stone-200" />
                <Link
                  href="/dashboard"
                  className="block py-3 px-4 rounded-xl text-charcoal hover:bg-forest-50 font-medium transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  โปรไฟล์ของฉัน
                </Link>
                {/* ถ้าเป็นพนักงาน ให้แสดงเมนูสำหรับ staff/admin ใน mobile ด้วย */}
                {(user?.role === 'admin' || user?.role === 'room_staff' || user?.role === 'boat_staff') && (
                  <Link
                    href={user.role === 'admin' ? '/admin/dashboard' : '/staff/dashboard'}
                    className="block py-3 px-4 rounded-xl text-forest-700 bg-forest-50 hover:bg-forest-100 font-medium transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    แผงควบคุมเจ้าหน้าที่
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => {
                    handleLogout();
                    setIsOpen(false);
                  }}
                  className="w-full text-left py-3 px-4 rounded-xl text-red-600 hover:bg-red-50 font-medium transition-colors"
                >
                  ออกจากระบบ
                </button>
              </>
            ) : (
              <>
                <div className="my-2 border-t border-stone-200" />
                <Link
                  href="/auth/login"
                  className="block py-3 px-4 rounded-xl text-charcoal hover:bg-forest-50 font-medium transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  เข้าสู่ระบบ
                </Link>
                <Link
                  href="/auth/register"
                  className="block py-3 px-4 rounded-xl bg-forest-800 text-cream-100 font-medium text-center transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  สมัครสมาชิก
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
