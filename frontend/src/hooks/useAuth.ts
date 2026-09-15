'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import api from '@/lib/api';

export interface AuthUser {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  avatar?: string;
  phone?: string;
  line_id?: string;
  facebook?: string;
  address?: string;
  auth_provider?: string;
  has_password?: boolean;
}

const getStoredToken = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  return localStorage.getItem('token');
};

const setStoredToken = (token: string | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (token) {
    localStorage.setItem('token', token);
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    return;
  }

  localStorage.removeItem('token');
  delete api.defaults.headers.common.Authorization;
};

export const storeAuthToken = (token: string) => {
  setStoredToken(token);
};

export const clearAuthToken = () => {
  setStoredToken(null);
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  refreshProfile: () => Promise<AuthUser | null>;
  login: (token: string) => Promise<AuthUser | null>;
  logout: () => void;
  updateUser: (user: Partial<AuthUser>) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    const token = getStoredToken();

    if (!token) {
      setUser(null);
      setLoading(false);
      return null;
    }

    setStoredToken(token);

    try {
      const res = await api.get('/auth/profile');
      const nextUser = res.data.data as AuthUser;
      setUser(nextUser);
      return nextUser;
    } catch {
      clearAuthToken();
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (token: string) => {
    storeAuthToken(token);
    setLoading(true);
    return refreshProfile();
  }, [refreshProfile]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const logout = useCallback(() => {
    clearAuthToken();
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedUser: Partial<AuthUser>) => {
    setUser((currentUser) => (currentUser ? { ...currentUser, ...updatedUser } : null));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      refreshProfile,
      login,
      logout,
      updateUser,
    }),
    [loading, login, logout, refreshProfile, updateUser, user]
  );

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
