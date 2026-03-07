'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

// กำหนด option ของ auth guard เพื่อควบคุมว่าแต่ละหน้าต้อง login ไหม รับ role อะไรได้บ้าง และควร redirect ไปไหน
type GuardOptions = {
  /** roles allowed to access this page. Empty = any authenticated user */
  allowedRoles?: string[];
  /** if true, redirect authenticated users away (for login/register pages) */
  guestOnly?: boolean;
  /** where to redirect unauthenticated users (default: /auth/login) */
  redirectTo?: string;
};

/**
 * Centralised auth guard hook.
 * Returns { ready: boolean } — render nothing until ready=true to prevent flash.
 */
// hook กลางสำหรับป้องกันการเข้าถึงหน้าโดยอิงจากสถานะ login และ role ของผู้ใช้ พร้อมแก้ปัญหา hydration ของ Zustand
export function useAuthGuard(options: GuardOptions = {}) {
  const { allowedRoles = [], guestOnly = false, redirectTo = '/auth/login' } = options;
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Wait one tick for Zustand to rehydrate from localStorage
    const timer = setTimeout(() => {
      if (guestOnly) {
        // Pages like /auth/login — redirect away if already logged in
        if (isAuthenticated && user) {
          const role = user.role;
          if (role === 'admin') router.replace('/admin');
          else if (role === 'room_staff') router.replace('/staff/rooms/dashboard');
          else if (role === 'boat_staff') router.replace('/staff/boats/dashboard');
          else router.replace('/dashboard');
          return;
        }
        setReady(true);
        return;
      }

      // Protected pages
      if (!isAuthenticated || !user) {
        router.replace(redirectTo);
        return;
      }

      // Role check
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        // Redirect to proper dashboard based on role
        if (user.role === 'customer') router.replace('/dashboard');
        else if (user.role === 'room_staff') router.replace('/staff/rooms/dashboard');
        else if (user.role === 'boat_staff') router.replace('/staff/boats/dashboard');
        else router.replace('/');
        return;
      }

      setReady(true);
    }, 0);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user]);

  return { ready, user, isAuthenticated };
}
