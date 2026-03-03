'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/authStore';

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
          else if (role === 'room_staff') router.replace('/admin/rooms');
          else if (role === 'boat_staff') router.replace('/admin/boats');
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
        // Member trying to access admin pages
        if (user.role === 'customer') router.replace('/dashboard');
        else router.replace('/');
        return;
      }

      setReady(true);
    }, 0);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user]);

  return { ready, user, isAuthenticated };
}
