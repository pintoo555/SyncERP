/**
 * Universal app settings (timezone, etc.) from the server.
 * Use for all date/time display and parsing so the app is consistent.
 */

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';

const DEFAULT_TIMEZONE = 'Asia/Kolkata';

type AppSettingsContextValue = {
  timeZone: string;
  loading: boolean;
  /** Call after saving timezone in General Settings so the app uses the new value. */
  refetch: () => Promise<void>;
};

const AppSettingsContext = createContext<AppSettingsContextValue>({
  timeZone: DEFAULT_TIMEZONE,
  loading: true,
  refetch: async () => {},
});

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [timeZone, setTimeZone] = useState(DEFAULT_TIMEZONE);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get<{ timeZone?: string }>('/api/settings/app');
      const tz = res?.timeZone?.trim();
      if (tz) setTimeZone(tz);
    } catch {
      setTimeZone(DEFAULT_TIMEZONE);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading || !user) {
      setTimeZone(DEFAULT_TIMEZONE);
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
    <AppSettingsContext.Provider value={{ timeZone, loading, refetch }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextValue {
  return useContext(AppSettingsContext);
}
