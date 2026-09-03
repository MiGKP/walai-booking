"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X, User, LogOut, ChevronDown, Star } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { resolveAvatarUrl } from "@/lib/avatar";
import toast from "react-hot-toast";
import Image from "next/image";

const NAV_LINKS = [
  { href: "/", label: "หน้าแรก" },
  { href: "/rooms", label: "ห้องพัก" },
  { href: "/kayaks", label: "เรือคายัค" },
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
  const { user, isAuthenticated, logout } = useAuth();
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
    toast.success("ออกจากระบบเรียบร้อย");
    router.push("/");
    setDropdownOpen(false);
  };

  if (pathname.startsWith("/admin") || pathname.startsWith("/staff")) {
    return null;
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-cream-100/95 backdrop-blur-md shadow-[0_2px_10px_rgba(18,60,48,0.08)]"
          : "bg-cream-100/80 backdrop-blur-sm"
      }`}
      style={WAVE_BORDER}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="transition-transform duration-300 group-hover:scale-105">
              <Image
                src="/images/logo_walai.png"
                alt="Logo Walai"
                width={40}
                height={40}
                className="object-contain"
                priority
              />
            </div>
            <span className="font-display text-xl font-semibold text-forest-800 tracking-tight">
              วลัย
            </span>
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
            {isAuthenticated && user ? (
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
                    className="animate-dropdown absolute right-0 mt-2 w-56 bg-cream-100 rounded-3xl overflow-hidden"
                    style={{
                      border: "1px solid var(--color-stone-200)",
                      boxShadow: "0 10px 28px rgba(18,60,48,0.10)",
                    }}
                  >
                    <div
                      className="h-1"
                      style={{
                        background:
                          "linear-gradient(90deg, var(--color-forest-800, #123C30), var(--color-bamboo-400, #C9A876))",
                      }}
                    />
                    <div
                      className="px-4 py-3"
                      style={{
                        borderBottom: "1px solid var(--color-stone-200)",
                      }}
                    >
                      <p className="text-sm font-semibold text-charcoal truncate">
                        {user.first_name} {user.last_name}
                      </p>
                      <p className="text-xs text-charcoal-400 truncate">
                        {user.email}
                      </p>
                    </div>
                    <Link
                      href="/dashboard"
                      className="flex items-center gap-2 px-4 py-3 text-sm text-charcoal hover:bg-forest-50 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <User size={16} /> โปรไฟล์ของฉัน
                    </Link>
                    <Link
                      href="/dashboard/bookings"
                      className="flex items-center gap-2 px-4 py-3 text-sm text-charcoal hover:bg-forest-50 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      การจองของฉัน
                    </Link>
                    <Link
                      href="/reviews"
                      className="flex items-center gap-2 px-4 py-3 text-sm text-charcoal hover:bg-forest-50 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <Star size={16} /> รีวิวของฉัน
                    </Link>

                    {(user.role === "admin" ||
                      user.role === "room_staff" ||
                      user.role === "boat_staff") && (
                      <div style={{ borderTop: "1px solid var(--color-stone-200)" }} />
                    )}

                    {user.role === "admin" && (
                      <>
                        <Link
                          href="/admin"
                          className="flex items-center gap-2 px-4 py-3 text-sm text-forest-700 hover:bg-forest-50 transition-colors"
                          onClick={() => setDropdownOpen(false)}
                        >
                          แผงควบคุม Admin
                        </Link>
                        <Link
                          href="/admin/stats"
                          className="flex items-center gap-2 px-4 py-3 text-sm text-forest-700 hover:bg-forest-50 transition-colors"
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
                          className="flex items-center gap-2 px-4 py-3 text-sm text-forest-700 hover:bg-forest-50 transition-colors"
                          onClick={() => setDropdownOpen(false)}
                        >
                          แดชบอร์ดห้องพัก
                        </Link>
                        <Link
                          href="/admin/reviews"
                          className="flex items-center gap-2 px-4 py-3 text-sm text-forest-700 hover:bg-forest-50 transition-colors"
                          onClick={() => setDropdownOpen(false)}
                        >
                          รีวิวจากผู้เข้าพัก
                        </Link>
                        <Link
                          href="/admin/stats"
                          className="flex items-center gap-2 px-4 py-3 text-sm text-forest-700 hover:bg-forest-50 transition-colors"
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
                          className="flex items-center gap-2 px-4 py-3 text-sm text-forest-700 hover:bg-forest-50 transition-colors"
                          onClick={() => setDropdownOpen(false)}
                        >
                          แดชบอร์ดเรือ
                        </Link>
                        <Link
                          href="/admin/boat-hours"
                          className="flex items-center gap-2 px-4 py-3 text-sm text-forest-700 hover:bg-forest-50 transition-colors"
                          onClick={() => setDropdownOpen(false)}
                        >
                          เวลาทำการเรือ
                        </Link>
                        <Link
                          href="/admin/stats"
                          className="flex items-center gap-2 px-4 py-3 text-sm text-forest-700 hover:bg-forest-50 transition-colors"
                          onClick={() => setDropdownOpen(false)}
                        >
                          รายงานสถิติ
                        </Link>
                      </>
                    )}

                    <div style={{ borderTop: "1px solid var(--color-stone-200)" }} />
                    <button
                      onClick={handleLogout}
                      className="flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 w-full transition-colors"
                    >
                      <LogOut size={16} /> ออกจากระบบ
                    </button>
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

      {/* Mobile Menu */}
      {isOpen && (
        <div
          className="animate-mobile-menu md:hidden bg-cream-100 px-4 py-4 space-y-1 rounded-b-3xl"
          style={{ borderTop: "1px solid var(--color-stone-200)" }}
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

          {isAuthenticated ? (
            <>
              <div className="my-2" style={{ borderTop: "1px solid var(--color-stone-200)" }} />
              <Link
                href="/dashboard"
                className="block py-3 px-4 rounded-xl text-charcoal hover:bg-forest-50 font-medium transition-colors"
                onClick={() => setIsOpen(false)}
              >
                โปรไฟล์ของฉัน
              </Link>
              <Link
                href="/dashboard/bookings"
                className="block py-3 px-4 rounded-xl text-charcoal hover:bg-forest-50 font-medium transition-colors"
                onClick={() => setIsOpen(false)}
              >
                การจองของฉัน
              </Link>
              <Link
                href="/reviews"
                className="block py-3 px-4 rounded-xl text-charcoal hover:bg-forest-50 font-medium transition-colors"
                onClick={() => setIsOpen(false)}
              >
                รีวิวของฉัน
              </Link>
              <button
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
              <div className="my-2" style={{ borderTop: "1px solid var(--color-stone-200)" }} />
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
      )}
    </nav>
  );
}