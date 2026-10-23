'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { consumePostLoginRedirect, setPostLoginRedirect } from '@/lib/auth-redirect';

type GuardOptions = {
  allowedRoles?: string[];
  guestOnly?: boolean;
  redirectTo?: string;
  skipRedirect?: boolean;
};

// ตรวจสอบสิทธิ์การเข้าถึงหน้าตามสถานะการเข้าสู่ระบบและบทบาทของผู้ใช้
export function useAuthGuard(options: GuardOptions = {}) {
  const { allowedRoles = [], guestOnly = false, redirectTo = '/auth/login', skipRedirect = false } = options;
  const router = useRouter();
  const { isAuthenticated, user, loading } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (skipRedirect) {
      setReady(true);
      return;
    }

    if (guestOnly) {
      if (isAuthenticated && user) {
        const role = user.role;
        if (role === 'admin') router.replace('/admin');
        else if (role === 'room_staff') router.replace('/staff/rooms/dashboard');
        else if (role === 'boat_staff') router.replace('/staff/boats/dashboard');
        else router.replace('/');
        return;
      }

      setReady(true);
      return;
    }

    if (!isAuthenticated || !user) {
      router.replace(redirectTo);
      return;
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      if (user.role === 'customer') router.replace('/dashboard');
      else if (user.role === 'admin') router.replace('/admin/profile');
      else if (user.role === 'room_staff') router.replace('/staff/rooms/profile');
      else if (user.role === 'boat_staff') router.replace('/staff/boats/profile');
      else router.replace('/');
      return;
    }

    setReady(true);
  }, [allowedRoles, guestOnly, isAuthenticated, loading, redirectTo, router, user, skipRedirect]);

  return { ready, user, isAuthenticated };
}
