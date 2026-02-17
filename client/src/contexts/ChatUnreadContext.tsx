import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useChatSocketContext } from './ChatSocketContext';
import { getChatSettings, playChatSound } from '../utils/chatSettings';
import type { ChatReactionPayload } from './ChatSocketContext';

type ChatUnreadContextValue = {
  unreadCount: number;
  totalUnreadCount: number;
  reactionUnreadByUserId: Record<number, number>;
  setUnreadCount: (n: number) => void;
  refetch: () => void;
  incrementReactionUnread: (userId: number) => void;
  clearReactionUnread: (userId: number) => void;
};

const ChatUnreadContext = createContext<ChatUnreadContextValue | null>(null);

export function ChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { registerMessageHandler, registerReactionHandler } = useChatSocketContext();
  const [unreadCount, setUnreadCount] = useState(0);
  const [reactionUnreadByUserId, setReactionUnreadByUserId] = useState<Record<number, number>>({});

  const totalUnreadCount = useMemo(
    () => unreadCount + Object.values(reactionUnreadByUserId).reduce((a, b) => a + b, 0),
    [unreadCount, reactionUnreadByUserId]
  );

  const incrementReactionUnread = useCallback((userId: number) => {
    setReactionUnreadByUserId((prev) => ({ ...prev, [userId]: (prev[userId] ?? 0) + 1 }));
  }, []);

  const clearReactionUnread = useCallback((userId: number) => {
    setReactionUnreadByUserId((prev) => {
      if (prev[userId] == null) return prev;
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }, []);

  const refetch = useCallback(() => {
    if (!user) return;
    api
      .get<{ success: boolean; count: number }>('/api/chat/unread-count')
      .then((res) => {
        if (res?.success && typeof res.count === 'number') {
          setUnreadCount(res.count);
        }
      })
      .catch(() => {});
  }, [user]);

  // When a chat message arrives (any page or tab in background): update badge/title, and optionally beep + browser notification
  useEffect(() => {
    if (!user) return;
    const myId = Number(user.userId);
    const onMessage = (payload: { senderUserId: number; receiverUserId: number; senderName: string; messageText: string }) => {
      const isForMe = payload.receiverUserId === myId && payload.senderUserId !== myId;
      if (!isForMe) return;
      const onChatPage = location.pathname === '/chat';
      // Use document.hasFocus() so we also detect when the browser window is behind other apps
      const windowFocused = document.hasFocus();
      // When chat page is focused, it handles mark-read + refetch after the server processes it.
      // Calling refetch() here would race with mark-read and return a stale count.
      if (onChatPage && windowFocused) return;
      refetch();
      const settings = getChatSettings();
      if (settings.soundEnabled) playChatSound();
      // Show browser notification when window not focused OR tab is hidden
      if (settings.notifyEnabled && !windowFocused && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const senderUserId = payload.senderUserId;
          const n = new Notification(payload.senderName, { body: payload.messageText, tag: `chat-${senderUserId}` });
          n.onclick = () => {
            window.focus();
            navigate(`/chat?with=${senderUserId}`, { replace: false });
          };
        } catch {
          // ignore
        }
      }
    };
    const unregister = registerMessageHandler(onMessage);
    return unregister;
  }, [user, location.pathname, refetch, registerMessageHandler, navigate]);

  // When someone reacts to your message (any page): increment reaction unread so header badge and chat list update
  useEffect(() => {
    if (!user?.userId) return;
    const myId = Number(user.userId);
    const onReaction = (payload: ChatReactionPayload) => {
      if (!payload.added) return;
      const isMyMessage = payload.senderUserId === myId || payload.receiverUserId === myId;
      if (isMyMessage && payload.reactorUserId !== myId) {
        incrementReactionUnread(payload.reactorUserId);
      }
    };
    const unregister = registerReactionHandler(onReaction);
    return unregister;
  }, [user?.userId, incrementReactionUnread, registerReactionHandler]);

  useEffect(() => {
    if (loading || !user) {
      setUnreadCount(0);
      return;
    }
    refetch();
  }, [user, loading, refetch]);

  useEffect(() => {
    if (!user) return;
    const onFocus = () => refetch();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [user, refetch]);

  const value: ChatUnreadContextValue = {
    unreadCount,
    totalUnreadCount,
    reactionUnreadByUserId,
    setUnreadCount,
    refetch,
    incrementReactionUnread,
    clearReactionUnread,
  };

  return (
    <ChatUnreadContext.Provider value={value}>
      {children}
    </ChatUnreadContext.Provider>
  );
}

export function useChatUnread(): ChatUnreadContextValue {
  const ctx = useContext(ChatUnreadContext);
  if (!ctx) {
    return {
      unreadCount: 0,
      totalUnreadCount: 0,
      reactionUnreadByUserId: {},
      setUnreadCount: () => {},
      refetch: () => {},
      incrementReactionUnread: () => {},
      clearReactionUnread: () => {},
    };
  }
  return ctx;
}
