/**
 * Health alerts for topbar notifications. Fetches and exposes alerts for the current user.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api/client';

export interface HealthAlert {
  id: number;
  metric: string;
  message: string;
  value: number;
  thresholdPercent: number;
  diskPath: string | null;
  status: 'active' | 'acknowledged';
  acknowledgedAt: string | null;
  createdAt: string;
}

interface HealthAlertsState {
  alerts: HealthAlert[];
  activeCount: number;
  loading: boolean;
  refetch: () => void;
  acknowledge: (id: number) => Promise<void>;
  acknowledgeAll: () => Promise<void>;
}

const HealthAlertsContext = createContext<HealthAlertsState | null>(null);

export function HealthAlertsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<HealthAlert[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    if (!user) {
      setAlerts([]);
      setActiveCount(0);
      return;
    }
    setLoading(true);
    try {
      const res = await api.get<{ success: boolean; data: { alerts: HealthAlert[]; activeCount: number } }>('/api/health/alerts');
      if (res?.data?.alerts) {
        setAlerts(res.data.alerts);
        setActiveCount(res.data.activeCount ?? 0);
      }
    } catch {
      setAlerts([]);
      setActiveCount(0);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 30000);  // poll every 30s
    return () => clearInterval(iv);
  }, [fetchAlerts]);

  const acknowledge = useCallback(async (id: number) => {
    try {
      await api.post(`/api/health/alerts/${id}/acknowledge`);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: 'acknowledged' as const, acknowledgedAt: new Date().toISOString() } : a))
      );
      setActiveCount((c) => Math.max(0, c - 1));
    } catch (_) {}
  }, []);

  const acknowledgeAll = useCallback(async () => {
    try {
      await api.post('/api/health/alerts/acknowledge-all');
      setAlerts((prev) =>
        prev.map((a) => (a.status === 'active' ? { ...a, status: 'acknowledged' as const, acknowledgedAt: new Date().toISOString() } : a))
      );
      setActiveCount(0);
    } catch (_) {}
  }, []);

  const value: HealthAlertsState = {
    alerts,
    activeCount,
    loading,
    refetch: fetchAlerts,
    acknowledge,
    acknowledgeAll,
  };

  return (
    <HealthAlertsContext.Provider value={value}>
      {children}
    </HealthAlertsContext.Provider>
  );
}

export function useHealthAlerts(): HealthAlertsState | null {
  return useContext(HealthAlertsContext);
}
