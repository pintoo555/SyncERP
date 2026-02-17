/**
 * App theme (light/dark). Applied only when user is logged in, from their saved preference.
 * Auth pages (login, etc.) always use light theme and are not affected by this setting.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useUserSettings } from '../contexts/UserSettingsContext';

export type Theme = 'light' | 'dark';

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.setAttribute('data-bs-theme', theme);
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { theme: userTheme, loading: userSettingsLoading, refetch: refetchUserSettings } = useUserSettings();
  const [theme, setThemeState] = useState<Theme>('light');

  // When not logged in (auth pages): always use light theme so login/signup are not affected
  useEffect(() => {
    if (!user) {
      setThemeState('light');
      applyTheme('light');
    }
  }, [user]);

  // When user is logged in and their saved theme has loaded, apply it
  useEffect(() => {
    if (!user || userSettingsLoading) return;
    if (userTheme === 'dark' || userTheme === 'light') {
      setThemeState(userTheme);
      applyTheme(userTheme);
    }
  }, [user, userSettingsLoading, userTheme]);

  // Apply theme whenever it changes (logged-in app only; auth already forced to light above)
  useEffect(() => {
    if (user) applyTheme(theme);
  }, [user, theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    if (user) {
      applyTheme(t);
      api.put('/api/settings/user', { theme: t }).then(() => refetchUserSettings()).catch(() => {});
    }
  }, [user, refetchUserSettings]);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
  }, [theme, setTheme]);

  return (
    <ThemeContext.Provider value={{ theme: user ? theme : 'light', setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
