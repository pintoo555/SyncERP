import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';

export interface User {
  userId: number;
  name: string;
  email: string;
  departmentId: number | null;
  departmentName?: string | null;
  roles: { code: string; name: string }[];
  permissions: string[];
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.get<{ success: boolean; user: User }>('/api/auth/me');
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    await api.post<{ success: boolean }>('/api/auth/login', { email, password });
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {}
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
