"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X, User, LogOut, ChevronDown, Star, Ticket } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { resolveAvatarUrl } from "@/lib/avatar";
import toast from "react-hot-toast";
import Image from "next/image";

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

  /* Track scroll to add subtle shadow */
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

  // ซ่อน Navbar เฉพาะเมื่ออยู่ในหน้าระบบจัดการ (/admin หรือ /staff)
  // เพื่อให้ Navbar ยังคงแสดงผลปกติเมื่อ Admin/Staff ออกมาดูหน้าเว็บจริง
  if (pathname.startsWith("/admin") || pathname.startsWith("/staff")) {
    return null;
  }

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
        scrolled
          ? "bg-cream-100/95 backdrop-blur-md shadow-[0_1px_3px_rgba(18,60,48,0.06)]"
          : "bg-cream-100/80 backdrop-blur-sm"
      }`}
      style={{ borderBottom: "1px solid var(--color-stone-200)" }}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo 3D */}
          <Link href="/" className="flex items-center gap-2 group">
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
            {[
              { href: "/", label: "หน้าแรก" },
              { href: "/rooms", label: "ห้องพัก" },
              { href: "/kayaks", label: "เรือคายัค" },
              { href: "/promotions", label: "คูปอง" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="relative px-4 py-2 text-charcoal-600 hover:text-forest-800 font-medium transition-colors duration-200 group"
              >
                {link.label}
                <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-bamboo-400 scale-x-0 group-hover:scale-x-100 transition-transform duration-250 origin-left" />
              </Link>
            ))}
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
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-cream-200"
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
                    className="animate-dropdown absolute right-0 mt-2 w-52 bg-cream-100 rounded-2xl overflow-hidden"
                    style={{
                      border: "1px solid var(--color-stone-200)",
                      boxShadow: "0 8px 24px rgba(18,60,48,0.08)",
                    }}
                  >
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
                      href="/dashboard/coupons"
                      className="flex items-center gap-2 px-4 py-3 text-sm text-charcoal hover:bg-forest-50 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <Ticket size={16} /> คูปองของฉัน
                    </Link>
                    <Link
                      href="/reviews"
                      className="flex items-center gap-2 px-4 py-3 text-sm text-charcoal hover:bg-forest-50 transition-colors"
                      onClick={() => setDropdownOpen(false)}
                    >
                      <Star size={16} /> รีวิวของฉัน
                    </Link>
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
          className="animate-mobile-menu md:hidden bg-cream-100 px-4 py-4 space-y-1"
          style={{ borderTop: "1px solid var(--color-stone-200)" }}
        >
          <Link
            href="/"
            className="block py-3 px-4 rounded-xl text-charcoal hover:bg-forest-50 font-medium transition-colors"
            onClick={() => setIsOpen(false)}
          >
            หน้าแรก
          </Link>
          <Link
            href="/rooms"
            className="block py-3 px-4 rounded-xl text-charcoal hover:bg-forest-50 font-medium transition-colors"
            onClick={() => setIsOpen(false)}
          >
            ห้องพัก
          </Link>
          <Link
            href="/kayaks"
            className="block py-3 px-4 rounded-xl text-charcoal hover:bg-forest-50 font-medium transition-colors"
            onClick={() => setIsOpen(false)}
          >
            เรือคายัค
          </Link>
          <Link
            href="/promotions"
            className="block py-3 px-4 rounded-xl text-charcoal hover:bg-forest-50 font-medium transition-colors"
            onClick={() => setIsOpen(false)}
          >
            คูปอง
          </Link>
          {isAuthenticated ? (
            <>
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
                href="/dashboard/coupons"
                className="block py-3 px-4 rounded-xl text-charcoal hover:bg-forest-50 font-medium transition-colors"
                onClick={() => setIsOpen(false)}
              >
                คูปองของฉัน
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