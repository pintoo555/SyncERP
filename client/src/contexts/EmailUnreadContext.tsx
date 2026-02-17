import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';

type EmailUnreadContextValue = {
  unreadCount: number;
  refetch: () => void;
};

const EmailUnreadContext = createContext<EmailUnreadContextValue | null>(null);

export function EmailUnreadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refetch = useCallback(() => {
    if (!user) return;
    api
      .get<{ success: boolean; count: number }>('/api/mailbox/unread-count')
      .then((res) => {
        if (res?.success && typeof res.count === 'number') {
          setUnreadCount(res.count);
        }
      })
      .catch(() => setUnreadCount(0));
  }, [user]);

  useEffect(() => {
    refetch();
    const interval = setInterval(refetch, 60000); // Poll every 60 seconds
    return () => clearInterval(interval);
  }, [refetch]);

  const value: EmailUnreadContextValue = { unreadCount, refetch };

  return (
    <EmailUnreadContext.Provider value={value}>
      {children}
    </EmailUnreadContext.Provider>
  );
}

export function useEmailUnread(): EmailUnreadContextValue {
  const ctx = useContext(EmailUnreadContext);
  if (!ctx) {
    return { unreadCount: 0, refetch: () => {} };
  }
  return ctx;
}
