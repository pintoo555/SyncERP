import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { api, getSocketUrl } from '../api/client';

export type PresenceStatus = 'online' | 'away' | 'offline';

export interface ChatMessagePayload {
  messageId: number;
  senderUserId: number;
  receiverUserId: number;
  senderName: string;
  messageText: string;
  sentAt: string;
}

export type MessagesDeliveredPayload = { messageIds: number[]; deliveredAt: string };
export type MessagesReadPayload = { messageIds: number[]; readAt: string };

export function useChatSocket(
  onMessage: (payload: ChatMessagePayload) => void,
  options?: {
    onMessagesDelivered?: (payload: MessagesDeliveredPayload) => void;
    onMessagesRead?: (payload: MessagesReadPayload) => void;
    /** When false, do not fetch socket-token or connect (use when user is not logged in). */
    enabled?: boolean;
  }
) {
  const socketRef = useRef<Socket | null>(null);
  const onMessageRef = useRef(onMessage);
  const onDeliveredRef = useRef(options?.onMessagesDelivered);
  const onReadRef = useRef(options?.onMessagesRead);
  onMessageRef.current = onMessage;
  onDeliveredRef.current = options?.onMessagesDelivered;
  onReadRef.current = options?.onMessagesRead;

  const [presence, setPresence] = useState<Record<number, PresenceStatus>>({});
  const awayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled) return;
    let mounted = true;
    api.get<{ success: boolean; token: string }>('/api/auth/socket-token')
      .then((res) => {
        if (!mounted || !res.token) return;
        const baseUrl = getSocketUrl();
        const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}/realtime` : '/realtime';
        const socket = io(url, {
          path: '/socket.io',
          auth: { token: res.token },
          transports: ['websocket', 'polling'],
          reconnection: true,
        });
        socketRef.current = socket;

        socket.on('chat:message', (payload: ChatMessagePayload) => {
          onMessageRef.current?.(payload);
        });
        socket.on('chat:messages-delivered', (payload: MessagesDeliveredPayload) => {
          const fn = onDeliveredRef.current;
          if (fn) fn(payload);
        });
        socket.on('chat:messages-read', (payload: MessagesReadPayload) => {
          const fn = onReadRef.current;
          if (fn) fn(payload);
        });

        socket.on('presence:list', (payload: { onlineUserIds?: number[]; awayUserIds?: number[] }) => {
          const online = new Set(payload.onlineUserIds ?? []);
          const away = new Set(payload.awayUserIds ?? []);
          setPresence((prev) => {
            const next = { ...prev };
            online.forEach((id) => { next[id] = away.has(id) ? 'away' : 'online'; });
            away.forEach((id) => { if (online.has(id)) next[id] = 'away'; });
            return next;
          });
        });
        socket.on('user:online', (payload: { userId: number }) => {
          setPresence((prev) => (prev[payload.userId] === 'online' ? prev : { ...prev, [payload.userId]: 'online' }));
        });
        socket.on('user:away', (payload: { userId: number }) => {
          setPresence((prev) => (prev[payload.userId] === 'away' ? prev : { ...prev, [payload.userId]: 'away' }));
        });
        socket.on('user:offline', (payload: { userId: number }) => {
          setPresence((prev) => (prev[payload.userId] === 'offline' ? prev : { ...prev, [payload.userId]: 'offline' }));
        });

        const handleVisibility = () => {
          if (document.visibilityState === 'hidden') {
            awayTimerRef.current = setTimeout(() => {
              socket.emit('presence:away');
            }, 2 * 60 * 1000);
          } else {
            if (awayTimerRef.current) {
              clearTimeout(awayTimerRef.current);
              awayTimerRef.current = null;
            }
            socket.emit('presence:online');
          }
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
          document.removeEventListener('visibilitychange', handleVisibility);
          if (awayTimerRef.current) clearTimeout(awayTimerRef.current);
        };
      })
      .catch(() => {});

    return () => {
      mounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [enabled]);

  return { presence };
}
