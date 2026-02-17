/**
 * Per-user settings (idle lock minutes, theme, etc.). Fetched from GET /api/settings/user.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';

export type UserTheme = 'light' | 'dark';

type UserSettingsContextValue = {
  /** Minutes of inactivity before auto-lock; 0 = disabled. */
  idleLockMinutes: number;
  /** User's saved theme (day/night). Applied on login. */
  theme: UserTheme;
  loading: boolean;
  refetch: () => Promise<void>;
};

const UserSettingsContext = createContext<UserSettingsContextValue>({
  idleLockMinutes: 0,
  theme: 'light',
  loading: true,
  refetch: async () => {},
});

export function UserSettingsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [idleLockMinutes, setIdleLockMinutes] = useState(0);
  const [theme, setTheme] = useState<UserTheme>('light');
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ idleLockMinutes?: number; theme?: UserTheme }>('/api/settings/user');
      const val = res?.idleLockMinutes;
      setIdleLockMinutes(typeof val === 'number' && val >= 0 ? Math.min(1440, val) : 0);
      setTheme(res?.theme === 'dark' ? 'dark' : 'light');
    } catch {
      setIdleLockMinutes(0);
      setTheme('light');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) {
      setIdleLockMinutes(0);
      setTheme('light');
      setLoading(!authLoading);
      return;
    }
    setLoading(true);
    fetchSettings();
  }, [user, authLoading, fetchSettings]);

  const refetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    await fetchSettings();
  }, [user, fetchSettings]);

  return (
    <UserSettingsContext.Provider value={{ idleLockMinutes, theme, loading, refetch }}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export function useUserSettings(): UserSettingsContextValue {
  return useContext(UserSettingsContext);
}
