/**
 * Realtime socket for calendar: connect when user is on /calendar and expose
 * a version bump so the Calendar page can refetch when any client creates/updates/deletes an event.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useLocation } from 'react-router-dom';
import { io, type Socket } from 'socket.io-client';
import { api, getSocketUrl } from '../api/client';
import { useAuth } from '../hooks/useAuth';

type CalendarSocketContextValue = {
  /** Increments when calendar:event-created/updated/deleted is received; use as dependency to refetch. */
  calendarEventVersion: number;
};

const CalendarSocketContext = createContext<CalendarSocketContextValue | null>(null);

export function CalendarSocketProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const onCalendarPage = location.pathname === '/calendar';
  const [calendarEventVersion, setCalendarEventVersion] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (loading || !user || !onCalendarPage) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    let mounted = true;
    const timer = setTimeout(() => {
      api
        .get<{ success: boolean; token: string }>('/api/auth/socket-token')
        .then((res) => {
          if (!mounted || !res?.token) return;
          const baseUrl = getSocketUrl();
          const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}/realtime` : '/realtime';
          const socket = io(url, {
            path: '/socket.io',
            auth: { token: res.token },
            transports: ['polling', 'websocket'],
            reconnection: true,
          });
          socketRef.current = socket;

          const bump = () => setCalendarEventVersion((v) => v + 1);
          socket.on('calendar:event-created', bump);
          socket.on('calendar:event-updated', bump);
          socket.on('calendar:event-deleted', bump);
        })
        .catch(() => {});
    }, 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user, loading, onCalendarPage]);

  const value: CalendarSocketContextValue = { calendarEventVersion };

  return (
    <CalendarSocketContext.Provider value={value}>
      {children}
    </CalendarSocketContext.Provider>
  );
}

export function useCalendarSocketContext(): CalendarSocketContextValue {
  const ctx = useContext(CalendarSocketContext);
  return ctx ?? { calendarEventVersion: 0 };
}
