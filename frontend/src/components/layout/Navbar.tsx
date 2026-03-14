'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Waves, Menu, X, User, LogOut, ChevronDown, Star } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { resolveAvatarUrl } from '@/lib/avatar';
import toast from 'react-hot-toast';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const { user, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const avatarSrc = useMemo(() => resolveAvatarUrl(user?.avatar), [user?.avatar]);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [avatarSrc]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [dropdownOpen]);

  const handleLogout = () => {
    logout();
    toast.success('ออกจากระบบเรียบร้อย');
    router.push('/');
    setDropdownOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-teal-700">
            <Waves size={28} className="text-teal-500" />
            วลัย
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-gray-600 hover:text-teal-600 font-medium transition-colors">หน้าแรก</Link>
            <Link href="/rooms" className="text-gray-600 hover:text-teal-600 font-medium transition-colors">ห้องพัก</Link>
            <Link href="/kayaks" className="text-gray-600 hover:text-teal-600 font-medium transition-colors">เรือคายัค</Link>
          </div>

          {/* Auth */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  {avatarSrc && !avatarLoadError ? (
                    <img src={avatarSrc} alt={`${user.first_name} ${user.last_name}`} className="w-8 h-8 rounded-full object-cover" onError={() => setAvatarLoadError(true)} />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center">
                      <User size={16} className="text-teal-600" />
                    </div>
                  )}
                  <span className="font-medium text-gray-700 max-w-[120px] truncate">{user.first_name} {user.last_name}</span>
                  <ChevronDown size={16} className="text-gray-400" />
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-50">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user.first_name} {user.last_name}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <Link href="/dashboard" className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setDropdownOpen(false)}>
                      <User size={16} /> โปรไฟล์ของฉัน
                    </Link>
                    <Link href="/dashboard/bookings" className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setDropdownOpen(false)}>
                      การจองของฉัน
                    </Link>
                    <Link href="/reviews" className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setDropdownOpen(false)}>
                      <Star size={16} /> รีวิวของฉัน
                    </Link>
                    {user.role === 'admin' && (
                      <>
                        <Link href="/admin" className="flex items-center gap-2 px-4 py-3 text-sm text-teal-600 hover:bg-teal-50" onClick={() => setDropdownOpen(false)}>
                          แผงควบคุม Admin
                        </Link>
                        <Link href="/admin/stats" className="flex items-center gap-2 px-4 py-3 text-sm text-teal-600 hover:bg-teal-50" onClick={() => setDropdownOpen(false)}>
                          รายงานสถิติ
                        </Link>
                      </>
                    )}
                    {user.role === 'room_staff' && (
                      <>
                        <Link href="/staff/rooms/dashboard" className="flex items-center gap-2 px-4 py-3 text-sm text-teal-600 hover:bg-teal-50" onClick={() => setDropdownOpen(false)}>
                          แดชบอร์ดห้องพัก
                        </Link>
                        <Link href="/admin/reviews" className="flex items-center gap-2 px-4 py-3 text-sm text-teal-600 hover:bg-teal-50" onClick={() => setDropdownOpen(false)}>
                          รีวิวจากผู้เข้าพัก
                        </Link>
                        <Link href="/admin/contact" className="flex items-center gap-2 px-4 py-3 text-sm text-teal-600 hover:bg-teal-50" onClick={() => setDropdownOpen(false)}>
                          ข้อมูลติดต่อ
                        </Link>
                        <Link href="/admin/stats" className="flex items-center gap-2 px-4 py-3 text-sm text-teal-600 hover:bg-teal-50" onClick={() => setDropdownOpen(false)}>
                          รายงานสถิติ
                        </Link>
                      </>
                    )}
                    {user.role === 'boat_staff' && (
                      <>
                        <Link href="/staff/boats/dashboard" className="flex items-center gap-2 px-4 py-3 text-sm text-teal-600 hover:bg-teal-50" onClick={() => setDropdownOpen(false)}>
                          แดชบอร์ดเรือ
                        </Link>
                        <Link href="/admin/boat-hours" className="flex items-center gap-2 px-4 py-3 text-sm text-teal-600 hover:bg-teal-50" onClick={() => setDropdownOpen(false)}>
                          เวลาทำการเรือ
                        </Link>
                        <Link href="/admin/contact" className="flex items-center gap-2 px-4 py-3 text-sm text-teal-600 hover:bg-teal-50" onClick={() => setDropdownOpen(false)}>
                          ข้อมูลติดต่อ
                        </Link>
                        <Link href="/admin/stats" className="flex items-center gap-2 px-4 py-3 text-sm text-teal-600 hover:bg-teal-50" onClick={() => setDropdownOpen(false)}>
                          รายงานสถิติ
                        </Link>
                      </>
                    )}
                    <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 w-full">
                      <LogOut size={16} /> ออกจากระบบ
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/auth/login" className="text-gray-600 hover:text-teal-600 font-medium transition-colors px-4 py-2">เข้าสู่ระบบ</Link>
                <Link href="/auth/register" className="btn-primary text-sm py-2 px-5">สมัครสมาชิก</Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setIsOpen(!isOpen)} className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-gray-100 px-4 py-4 space-y-2">
          <Link href="/" className="block py-3 px-4 rounded-xl text-gray-700 hover:bg-gray-50 font-medium" onClick={() => setIsOpen(false)}>หน้าแรก</Link>
          <Link href="/rooms" className="block py-3 px-4 rounded-xl text-gray-700 hover:bg-gray-50 font-medium" onClick={() => setIsOpen(false)}>ห้องพัก</Link>
          <Link href="/kayaks" className="block py-3 px-4 rounded-xl text-gray-700 hover:bg-gray-50 font-medium" onClick={() => setIsOpen(false)}>เรือคายัค</Link>
          {isAuthenticated ? (
            <>
              <Link href="/dashboard" className="block py-3 px-4 rounded-xl text-gray-700 hover:bg-gray-50 font-medium" onClick={() => setIsOpen(false)}>โปรไฟล์ของฉัน</Link>
              <Link href="/dashboard/bookings" className="block py-3 px-4 rounded-xl text-gray-700 hover:bg-gray-50 font-medium" onClick={() => setIsOpen(false)}>การจองของฉัน</Link>
              <Link href="/reviews" className="block py-3 px-4 rounded-xl text-gray-700 hover:bg-gray-50 font-medium" onClick={() => setIsOpen(false)}>รีวิวของฉัน</Link>
              <button onClick={() => { handleLogout(); setIsOpen(false); }} className="w-full text-left py-3 px-4 rounded-xl text-red-600 hover:bg-red-50 font-medium">ออกจากระบบ</button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="block py-3 px-4 rounded-xl text-gray-700 hover:bg-gray-50 font-medium" onClick={() => setIsOpen(false)}>เข้าสู่ระบบ</Link>
              <Link href="/auth/register" className="block py-3 px-4 rounded-xl bg-teal-600 text-white font-medium text-center" onClick={() => setIsOpen(false)}>สมัครสมาชิก</Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}
