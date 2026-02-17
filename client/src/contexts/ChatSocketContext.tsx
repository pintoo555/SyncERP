import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, getSocketUrl } from '../api/client';
import { useAuth } from '../hooks/useAuth';

/** Connect to realtime socket when user is logged in so chat messages, badge, and notifications work on any page and when tab is in background. */

export type PresenceStatus = 'online' | 'away' | 'offline';

export interface ChatMessagePayload {
  messageId: number;
  senderUserId: number;
  receiverUserId: number;
  senderName: string;
  messageText: string;
  sentAt: string;
  /** Included when message has an attachment so receiver can render it */
  attachmentFileId?: number;
  attachmentFileName?: string;
  attachmentMimeType?: string;
  /** Unguessable token for attachment URL; use instead of fileId when present. */
  attachmentAccessToken?: string;
  replyToMessageId?: number;
  replyToPreview?: string;
  replyToSenderName?: string;
}

export type MessagesDeliveredPayload = { messageIds: number[]; deliveredAt: string };
export type MessagesReadPayload = { messageIds: number[]; readAt: string };

export interface ChatReactionPayload {
  messageId: number;
  senderUserId: number;
  receiverUserId: number;
  reactions: { emoji: string; count: number; you: boolean }[];
  reactorUserId: number;
  reactorName: string;
  added: boolean;
}

type MessageHandler = (payload: ChatMessagePayload) => void;
type DeliveredHandler = (payload: MessagesDeliveredPayload) => void;
type ReadHandler = (payload: MessagesReadPayload) => void;
type ReactionHandler = (payload: ChatReactionPayload) => void;

type ChatSocketContextValue = {
  presence: Record<number, PresenceStatus>;
  registerMessageHandler: (cb: MessageHandler) => () => void;
  registerDeliveredHandler: (cb: DeliveredHandler) => () => void;
  registerReadHandler: (cb: ReadHandler) => () => void;
  registerReactionHandler: (cb: ReactionHandler) => () => void;
};

const ChatSocketContext = createContext<ChatSocketContextValue | null>(null);

export function ChatSocketProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [presence, setPresence] = useState<Record<number, PresenceStatus>>({});
  const socketRef = useRef<Socket | null>(null);
  const messageHandlersRef = useRef<Set<MessageHandler>>(new Set());
  const deliveredHandlersRef = useRef<Set<DeliveredHandler>>(new Set());
  const readHandlersRef = useRef<Set<ReadHandler>>(new Set());
  const reactionHandlersRef = useRef<Set<ReactionHandler>>(new Set());
  const awayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const registerMessageHandler = useCallback((cb: MessageHandler) => {
    messageHandlersRef.current.add(cb);
    return () => {
      messageHandlersRef.current.delete(cb);
    };
  }, []);

  const registerDeliveredHandler = useCallback((cb: DeliveredHandler) => {
    deliveredHandlersRef.current.add(cb);
    return () => {
      deliveredHandlersRef.current.delete(cb);
    };
  }, []);

  const registerReadHandler = useCallback((cb: ReadHandler) => {
    readHandlersRef.current.add(cb);
    return () => {
      readHandlersRef.current.delete(cb);
    };
  }, []);

  const registerReactionHandler = useCallback((cb: ReactionHandler) => {
    reactionHandlersRef.current.add(cb);
    return () => {
      reactionHandlersRef.current.delete(cb);
    };
  }, []);

  useEffect(() => {
    if (loading || !user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setPresence({});
      }
      return;
    }

    let mounted = true;
    const connectSocket = (token: string) => {
      if (!mounted) return;
      const baseUrl = getSocketUrl();
      const url = baseUrl ? `${baseUrl.replace(/\/$/, '')}/realtime` : '/realtime';
      const socket = io(url, {
        path: '/socket.io',
        auth: { token },
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
      });
      socketRef.current = socket;

      socket.on('connect_error', (err) => {
        console.warn('Chat socket connect_error:', err.message);
      });

      const myId = Number(user.userId);
      setPresence((prev) => (prev[myId] === 'online' ? prev : { ...prev, [myId]: 'online' }));

        socket.on('chat:message', (payload: ChatMessagePayload) => {
          messageHandlersRef.current.forEach((fn) => {
            try {
              fn(payload);
            } catch (err) {
              console.warn('Chat message handler error:', err);
            }
          });
        });
        socket.on('chat:messages-delivered', (payload: MessagesDeliveredPayload) => {
          deliveredHandlersRef.current.forEach((fn) => {
            try {
              fn(payload);
            } catch (err) {
              console.warn('Chat delivered handler error:', err);
            }
          });
        });
        socket.on('chat:messages-read', (payload: MessagesReadPayload) => {
          readHandlersRef.current.forEach((fn) => {
            try {
              fn(payload);
            } catch (err) {
              console.warn('Chat read handler error:', err);
            }
          });
        });
        socket.on('chat:reaction', (payload: ChatReactionPayload) => {
          reactionHandlersRef.current.forEach((fn) => {
            try {
              fn(payload);
            } catch (err) {
              console.warn('Chat reaction handler error:', err);
            }
          });
        });

        socket.on('presence:list', (payload: unknown) => {
          const p = payload as { onlineUserIds?: unknown[]; awayUserIds?: unknown[] };
          const rawOnline = Array.isArray(p?.onlineUserIds) ? p.onlineUserIds : [];
          const rawAway = Array.isArray(p?.awayUserIds) ? p.awayUserIds : [];
          const online = new Set(rawOnline.map((id) => Number(id)).filter((n) => !Number.isNaN(n)));
          const away = new Set(rawAway.map((id) => Number(id)).filter((n) => !Number.isNaN(n)));
          setPresence(() => {
            const next: Record<number, PresenceStatus> = {};
            online.forEach((id) => {
              next[id] = away.has(id) ? 'away' : 'online';
            });
            away.forEach((id) => {
              if (online.has(id)) next[id] = 'away';
            });
            return next;
          });
        });
        socket.on('user:online', (payload: unknown) => {
          const id = Number((payload as { userId?: unknown })?.userId);
          if (Number.isNaN(id)) return;
          setPresence((prev) =>
            prev[id] === 'online' ? prev : { ...prev, [id]: 'online' }
          );
        });
        socket.on('user:away', (payload: unknown) => {
          const id = Number((payload as { userId?: unknown })?.userId);
          if (Number.isNaN(id)) return;
          setPresence((prev) =>
            prev[id] === 'away' ? prev : { ...prev, [id]: 'away' }
          );
        });
        socket.on('user:offline', (payload: unknown) => {
          const id = Number((payload as { userId?: unknown })?.userId);
          if (Number.isNaN(id)) return;
          setPresence((prev) =>
            prev[id] === 'offline' ? prev : { ...prev, [id]: 'offline' }
          );
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
      };

    const fetchTokenAndConnect = (retryCount = 0) => {
      if (!mounted) return;
      api
        .get<{ success: boolean; token: string }>('/api/auth/socket-token')
        .then((res) => {
          if (!mounted || !res?.token) return;
          connectSocket(res.token);
        })
        .catch((err) => {
          if (retryCount < 1 && mounted) {
            setTimeout(() => fetchTokenAndConnect(1), 2000);
          }
        });
    };
    const timer = setTimeout(() => fetchTokenAndConnect(), 300);

    return () => {
      mounted = false;
      clearTimeout(timer);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [user, loading]);

  const value: ChatSocketContextValue = {
    presence,
    registerMessageHandler,
    registerDeliveredHandler,
    registerReadHandler,
    registerReactionHandler,
  };

  return (
    <ChatSocketContext.Provider value={value}>
      {children}
    </ChatSocketContext.Provider>
  );
}

export function useChatSocketContext(): ChatSocketContextValue {
  const ctx = useContext(ChatSocketContext);
  if (!ctx) {
    return {
      presence: {},
      registerMessageHandler: () => () => {},
      registerDeliveredHandler: () => () => {},
      registerReadHandler: () => () => {},
      registerReactionHandler: () => () => {},
    };
  }
  return ctx;
}
