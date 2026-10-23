'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Menu, X, User, LogOut, ChevronDown, CalendarDays } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { resolveAvatarUrl } from '@/lib/avatar';
import Image from 'next/image';

const NAV_LINKS = [
  { href: '/', label: 'หน้าแรก' },
  { href: '/rooms', label: 'ห้องพัก' },
  { href: '/kayaks', label: 'เรือ' },
  { href: '/promotions', label: 'โปรโมชั่น' },
];

const WAVE_BORDER = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='44' height='8' viewBox='0 0 44 8'%3E%3Cpath d='M0 4 Q11 0 22 4 T44 4' fill='none' stroke='%23BFD3C4' stroke-width='1.2'/%3E%3C/svg%3E\")",
  backgroundRepeat: 'repeat-x',
  backgroundPosition: 'bottom',
  backgroundSize: '44px 8px',
} as const;

// แถบเมนูนำทางหลักด้านบนสำหรับทั้งเดสก์ท็อปและมือถือ
export default function Navbar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [subnavStuck, setSubnavStuck] = useState(false);

  useEffect(() => {
    // อัปเดตสถานะเมื่อแถบเมนูย่อยของหน้าห้องพักติดขอบบนจอ
    const handleSubnavSticky = (e: Event) => {
      const customEvent = e as CustomEvent<{ isStuck: boolean }>;
      setSubnavStuck(Boolean(customEvent.detail?.isStuck));
      if (customEvent.detail?.isStuck) setDropdownOpen(false);
    };
    window.addEventListener('room-subnav-sticky', handleSubnavSticky);
    return () => {
      window.removeEventListener('room-subnav-sticky', handleSubnavSticky);
    };
  }, []);

  const { user, isAuthenticated, logout, loading } = useAuth();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarSrc = useMemo(() => resolveAvatarUrl(user?.avatar), [user?.avatar]);

  const profileHref = useMemo(() => {
    if (!user) return '/dashboard';
    if (user.role === 'admin') return '/admin/profile';
    if (user.role === 'room_staff') return '/staff/rooms/profile';
    if (user.role === 'boat_staff') return '/staff/boats/profile';
    return '/dashboard';
  }, [user]);

  // ตรวจสอบว่าลิงก์เมนูตรงกับหน้าปัจจุบันหรือไม่
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  useEffect(() => {
    setAvatarLoadError(false);
  }, [avatarSrc]);

  useEffect(() => {
    // ปิดเมนูผู้ใช้เมื่อคลิกนอกพื้นที่ดรอปดาวน์
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const [, setScrollY] = useState(0);

  useEffect(() => {
    // ตรวจจับการเลื่อนหน้าจอเพื่อเปลี่ยนพื้นหลังแถบเมนู
    const onScroll = () => {
      setScrollY(window.scrollY);
      setScrolled(window.scrollY > 12);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // ออกจากระบบและพากลับไปยังหน้าแรก
  const handleLogout = () => {
    logout();
    router.push('/');
    setDropdownOpen(false);
  };

  if (pathname.startsWith('/admin') || pathname.startsWith('/staff')) {
    return null;
  }

  const isHomePage = pathname === '/';
  const isRoomDetailPage = /^\/rooms\/[^/]+$/.test(pathname);
  const showSolidNav = scrolled || !isHomePage;

  return (
    <>
      <nav
        aria-hidden={isRoomDetailPage && subnavStuck ? true : undefined}
        inert={isRoomDetailPage && subnavStuck ? true : undefined}
        className={`fixed left-0 right-0 top-0 z-50 ${
          isRoomDetailPage ? 'will-change-transform' : 'transition-all duration-300'
        } ${
          showSolidNav
            ? 'bg-cream-100/95 shadow-[0_2px_10px_rgba(18,60,48,0.08)] backdrop-blur-md'
            : 'bg-transparent'
        }`}
        style={{
          ...WAVE_BORDER,
          transform: isRoomDetailPage ? 'translateY(var(--navbar-translate-y, 0px))' : undefined,
        }}
      >
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="group flex items-center gap-2.5">
              <div className="overflow-hidden rounded-full border-2 border-forest-800/10 transition-transform duration-300 group-hover:scale-105">
                <Image
                  src="https://res.cloudinary.com/chbkkmxt/image/upload/v1790154452/walai-booking/walai_logo.jpg"
                  alt="Logo Walai"
                  width={40}
                  height={40}
                  className="h-10 w-10 object-cover"
                  priority
                />
              </div>
            </Link>

            <div className="hidden items-center gap-1 md:flex">
              {NAV_LINKS.map((link) => {
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative rounded-full px-4 py-2 font-medium transition-colors duration-200 ${
                      active
                        ? 'bg-forest-50 text-forest-800'
                        : 'text-charcoal-600 hover:bg-forest-50/60 hover:text-forest-800'
                    }`}
                  >
                    {link.label}
                    <span
                      className={`absolute -bottom-1 left-4 right-4 h-[2px] origin-left rounded-full bg-bamboo-400 transition-transform duration-250 ${
                        active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                      }`}
                    />
                  </Link>
                );
              })}
            </div>

            <div className="hidden items-center gap-3 md:flex">
              {loading ? (
                <div className="flex animate-pulse items-center gap-3 px-4 py-2">
                  <div className="h-8 w-8 rounded-full bg-stone-200" />
                  <div className="h-4 w-20 rounded bg-stone-200" />
                </div>
              ) : isAuthenticated && user ? (
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    aria-label="เมนูผู้ใช้"
                    aria-expanded={dropdownOpen}
                    aria-haspopup="true"
                    className="flex items-center gap-2 rounded-xl px-3 py-2 transition-colors duration-200 hover:bg-forest-50"
                  >
                    {avatarSrc && !avatarLoadError ? (
                      <img
                        src={avatarSrc}
                        alt={`${user.first_name} ${user.last_name}`}
                        className="h-8 w-8 rounded-full object-cover ring-2 ring-bamboo-400/50"
                        onError={() => setAvatarLoadError(true)}
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-forest-100">
                        <User size={16} className="text-forest-700" />
                      </div>
                    )}
                    <span className="max-w-[120px] truncate font-medium text-charcoal">
                      {user.first_name} {user.last_name}
                    </span>
                    <ChevronDown
                      size={16}
                      className="text-charcoal-400 transition-transform duration-200"
                      style={{
                        transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    />
                  </button>
                  {dropdownOpen && (
                    <div className="animate-dropdown absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-stone-200/60 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.08)]">
                      <div className="flex items-center gap-3 border-b border-stone-100 bg-stone-50/50 px-4 py-4">
                        {avatarSrc && !avatarLoadError ? (
                          <img
                            src={avatarSrc}
                            alt={`${user.first_name} ${user.last_name}`}
                            className="h-10 w-10 rounded-full object-cover shadow-xs ring-2 ring-white"
                            onError={() => setAvatarLoadError(true)}
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-forest-100 shadow-xs ring-2 ring-white">
                            <User size={18} className="text-forest-700" />
                          </div>
                        )}
                        <div className="flex min-w-0 flex-col">
                          <p className="truncate text-sm font-bold text-forest-900">
                            {user.first_name} {user.last_name}
                          </p>
                          <p className="truncate text-xs text-charcoal-400">{user.email}</p>
                        </div>
                      </div>

                      <div className="p-1.5">
                        {user.role === 'customer' && (
                          <Link
                            href="/dashboard?tab=bookings"
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-charcoal-600 transition-colors hover:bg-forest-50 hover:text-forest-800"
                            onClick={() => setDropdownOpen(false)}
                          >
                            <CalendarDays size={16} /> การจองของฉัน
                          </Link>
                        )}
                        <Link
                          href={profileHref}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-charcoal-600 transition-colors hover:bg-forest-50 hover:text-forest-800"
                          onClick={() => setDropdownOpen(false)}
                        >
                          <User size={16} /> ข้อมูลส่วนตัว
                        </Link>

                        {(user.role === 'admin' || user.role === 'room_staff' || user.role === 'boat_staff') && (
                          <div className="my-1.5 border-t border-stone-100" />
                        )}

                        {user.role === 'admin' && (
                          <Link
                            href="/admin"
                            className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-forest-700 transition-colors hover:bg-forest-50"
                            onClick={() => setDropdownOpen(false)}
                          >
                            แผงควบคุม Admin
                          </Link>
                        )}
                        {user.role === 'room_staff' && (
                          <>
                            <Link
                              href="/staff/rooms/dashboard"
                              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-forest-700 transition-colors hover:bg-forest-50"
                              onClick={() => setDropdownOpen(false)}
                            >
                              แดชบอร์ดห้องพัก
                            </Link>
                            <Link
                              href="/admin/reviews"
                              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-forest-700 transition-colors hover:bg-forest-50"
                              onClick={() => setDropdownOpen(false)}
                            >
                              รีวิวจากผู้เข้าพัก
                            </Link>
                            <Link
                              href="/admin/stats"
                              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-forest-700 transition-colors hover:bg-forest-50"
                              onClick={() => setDropdownOpen(false)}
                            >
                              รายงานสถิติ
                            </Link>
                          </>
                        )}
                        {user.role === 'boat_staff' && (
                          <>
                            <Link
                              href="/staff/boats/dashboard"
                              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-forest-700 transition-colors hover:bg-forest-50"
                              onClick={() => setDropdownOpen(false)}
                            >
                              แดชบอร์ดเรือ
                            </Link>
                            <Link
                              href="/staff/boats/boat-hours"
                              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-forest-700 transition-colors hover:bg-forest-50"
                              onClick={() => setDropdownOpen(false)}
                            >
                              เวลาทำการเรือ
                            </Link>
                            <Link
                              href="/admin/stats"
                              className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-forest-700 transition-colors hover:bg-forest-50"
                              onClick={() => setDropdownOpen(false)}
                            >
                              รายงานสถิติ
                            </Link>
                          </>
                        )}

                        <div className="my-1.5 border-t border-stone-100" />
                        <button
                          onClick={handleLogout}
                          className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
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
                    className="px-4 py-2 font-medium text-charcoal-600 transition-colors hover:text-forest-800"
                  >
                    เข้าสู่ระบบ
                  </Link>
                  <Link href="/auth/register" className="btn-primary px-5 py-2 text-sm">
                    สมัครสมาชิก
                  </Link>
                </>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 md:hidden">
              <Link
                href="/rooms"
                className={`relative px-1 py-1 text-xs transition-colors sm:px-1.5 sm:text-sm ${
                  isActive('/rooms')
                    ? 'font-bold text-forest-900'
                    : 'font-medium text-charcoal-600 hover:text-forest-800'
                }`}
              >
                ห้องพัก
                {isActive('/rooms') && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-forest-800" />
                )}
              </Link>
              <Link
                href="/kayaks"
                className={`relative px-1 py-1 text-xs transition-colors sm:px-1.5 sm:text-sm ${
                  isActive('/kayaks')
                    ? 'font-bold text-forest-900'
                    : 'font-medium text-charcoal-600 hover:text-forest-800'
                }`}
              >
                เรือ
                {isActive('/kayaks') && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-forest-800" />
                )}
              </Link>
              <Link
                href="/promotions"
                className={`relative px-1 py-1 text-xs transition-colors sm:px-1.5 sm:text-sm ${
                  isActive('/promotions')
                    ? 'font-bold text-forest-900'
                    : 'font-medium text-charcoal-600 hover:text-forest-800'
                }`}
              >
                โปรโมชั่น
                {isActive('/promotions') && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-forest-800" />
                )}
              </Link>

              <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label={isOpen ? 'ปิดเมนู' : 'เปิดเมนู'}
                aria-expanded={isOpen}
                className="ml-0.5 rounded-lg p-1.5 text-charcoal transition-colors hover:bg-forest-50"
              >
                {isOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="เมนูหลัก"
          className="fixed inset-0 z-[49] bg-forest-950/20 backdrop-blur-xs md:hidden"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="animate-mobile-menu absolute top-18 w-full space-y-1 rounded-b-3xl bg-cream-100 px-4 py-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsOpen(false);
            }}
          >
            {NAV_LINKS.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block rounded-xl px-4 py-3 font-medium transition-colors ${
                    active ? 'bg-forest-50 text-forest-800' : 'text-charcoal hover:bg-forest-50'
                  }`}
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </Link>
              );
            })}

            {loading ? (
              <div className="flex justify-center py-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-stone-200 border-t-forest-600" />
              </div>
            ) : isAuthenticated ? (
              <>
                <div className="my-2 border-t border-stone-200" />
                <Link
                  href={profileHref}
                  className="block rounded-xl px-4 py-3 font-medium text-charcoal transition-colors hover:bg-forest-50"
                  onClick={() => setIsOpen(false)}
                >
                  โปรไฟล์ของฉัน
                </Link>
                {user?.role === 'customer' && (
                  <Link
                    href="/dashboard?tab=bookings"
                    className="block rounded-xl px-4 py-3 font-medium text-charcoal transition-colors hover:bg-forest-50"
                    onClick={() => setIsOpen(false)}
                  >
                    การจองของฉัน
                  </Link>
                )}
                {(user?.role === 'admin' || user?.role === 'room_staff' || user?.role === 'boat_staff') && (
                  <Link
                    href={
                      user.role === 'admin'
                        ? '/admin'
                        : user.role === 'room_staff'
                          ? '/staff/rooms/dashboard'
                          : '/staff/boats/dashboard'
                    }
                    className="block rounded-xl bg-forest-50 px-4 py-3 font-medium text-forest-700 transition-colors hover:bg-forest-100"
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
                  className="w-full rounded-xl px-4 py-3 text-left font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  ออกจากระบบ
                </button>
              </>
            ) : (
              <>
                <div className="my-2 border-t border-stone-200" />
                <Link
                  href="/auth/login"
                  className="block rounded-xl px-4 py-3 font-medium text-charcoal transition-colors hover:bg-forest-50"
                  onClick={() => setIsOpen(false)}
                >
                  เข้าสู่ระบบ
                </Link>
                <Link
                  href="/auth/register"
                  className="block rounded-xl bg-forest-800 px-4 py-3 text-center font-medium text-cream-100 transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  สมัครสมาชิก
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
