/**
 * Floating chat widget - full-featured compact chat panel.
 * Draggable icon with unread badge, conversation list with search,
 * and thread view with all chat features: status ticks, reply, react,
 * forward, star, pin, delete, AI improve.
 * Styling matches the app's topbar via CSS variables.
 */
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useChatUnread } from '../contexts/ChatUnreadContext';
import { useChatSocketContext, type PresenceStatus } from '../contexts/ChatSocketContext';
import { UserAvatar } from './UserAvatar';
import {
  getChatSettings,
  getFloatingChatPosition,
  setFloatingChatPosition,
  playChatSound,
} from '../utils/chatSettings';

/* ──────────────── Constants ──────────────── */
const PANEL_WIDTH = 380;
const PANEL_HEIGHT = 520;
const MESSAGE_LIMIT = 30;
const BUTTON_SIZE = 56;
const DRAG_THRESHOLD = 5;
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

/* ──────────────── Types ──────────────── */
interface ConvRow {
  userId: number;
  name: string;
  email: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount?: number;
}

interface ChatReaction { emoji: string; count: number; you: boolean; }

interface MsgRow {
  messageId: number;
  senderUserId: number;
  receiverUserId: number;
  messageText: string;
  sentAt: string;
  senderName: string;
  deliveredAt: string | null;
  readAt: string | null;
  replyToMessageId?: number | null;
  replyToPreview?: string | null;
  replyToSenderName?: string | null;
  reactions?: ChatReaction[];
  isStarred?: boolean;
  isPinned?: boolean;
  isDeleted?: boolean;
  attachmentFileId?: number | null;
  attachmentFileName?: string | null;
}

interface UserOption { userId: number; name: string; email: string; }

/* ──────────────── Helpers ──────────────── */
function getByKey(obj: Record<string, unknown>, ...keys: string[]): unknown {
  const lower = new Set(keys.map((k) => k.toLowerCase()));
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && lower.has(k.toLowerCase())) return v;
  }
  return undefined;
}

function normalizeMsg(m: Record<string, unknown>): MsgRow {
  const rawReactions = (getByKey(m, 'reactions') ?? m.reactions) as unknown;
  const reactions: ChatReaction[] | undefined = Array.isArray(rawReactions)
    ? rawReactions.map((r: Record<string, unknown>) => ({
        emoji: String(getByKey(r, 'emoji', 'Emoji') ?? r.emoji ?? '').trim(),
        count: Number(getByKey(r, 'count', 'Count') ?? r.count ?? 0) || 1,
        you: getByKey(r, 'you', 'You') === true || r.you === true,
      })).filter((r) => r.emoji.length > 0)
    : undefined;
  const rawFileId = getByKey(m, 'attachmentFileId', 'AttachmentFileID', 'AttachmentFileId') ?? null;
  const attachmentFileId = rawFileId != null ? Number(rawFileId) : null;
  return {
    messageId: Number(getByKey(m, 'messageId', 'MessageID') ?? 0),
    senderUserId: Number(getByKey(m, 'senderUserId', 'SenderUserID') ?? 0),
    receiverUserId: Number(getByKey(m, 'receiverUserId', 'ReceiverUserID') ?? 0),
    messageText: String(getByKey(m, 'messageText', 'MessageText') ?? ''),
    sentAt: String(getByKey(m, 'sentAt', 'SentAt') ?? ''),
    senderName: String(getByKey(m, 'senderName', 'SenderName') ?? ''),
    deliveredAt: (getByKey(m, 'deliveredAt', 'DeliveredAt') ?? null) as string | null,
    readAt: (getByKey(m, 'readAt', 'ReadAt') ?? null) as string | null,
    replyToMessageId: (getByKey(m, 'replyToMessageId', 'ReplyToMessageID') ?? null) as number | null | undefined,
    replyToPreview: (getByKey(m, 'replyToPreview', 'ReplyToPreview') ?? null) as string | null | undefined,
    replyToSenderName: (getByKey(m, 'replyToSenderName', 'ReplyToSenderName') ?? null) as string | null | undefined,
    reactions: reactions && reactions.length > 0 ? reactions : undefined,
    isStarred: (getByKey(m, 'isStarred', 'IsStarred') ?? false) as boolean | undefined,
    isPinned: (getByKey(m, 'isPinned', 'IsPinned') ?? false) as boolean | undefined,
    isDeleted: (getByKey(m, 'isDeleted', 'IsDeleted') ?? false) as boolean | undefined,
    attachmentFileId: attachmentFileId && !Number.isNaN(attachmentFileId) ? attachmentFileId : null,
    attachmentFileName: (getByKey(m, 'attachmentFileName', 'AttachmentFileName') ?? null) as string | null | undefined,
  };
}

function formatTime(iso: string): string {
  const d = new Date(iso.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function formatInfoTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(String(iso).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatListTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function clampPosition(x: number, y: number) {
  return {
    x: Math.max(0, Math.min(window.innerWidth - BUTTON_SIZE, x)),
    y: Math.max(0, Math.min(window.innerHeight - BUTTON_SIZE, y)),
  };
}

/* ──────────────── Sub-components ──────────────── */
function PresenceDot({ status }: { status: PresenceStatus | undefined }) {
  const s = status ?? 'offline';
  const color = s === 'online' ? '#198754' : s === 'away' ? '#ffc107' : '#6c757d';
  return (
    <span
      style={{
        width: 8, height: 8, borderRadius: '50%', backgroundColor: color,
        border: '2px solid var(--bs-body-bg, #fff)', display: 'inline-block', flexShrink: 0,
      }}
    />
  );
}

function MessageStatusTicks({ deliveredAt, readAt }: { deliveredAt: string | null; readAt: string | null }) {
  const color = readAt ? '#53bdeb' : '#8696a0';
  return (
    <span className="ms-1" style={{ color, fontSize: '0.65rem' }} title={readAt ? 'Read' : deliveredAt ? 'Delivered' : 'Sent'}>
      {readAt || deliveredAt ? '✓✓' : '✓'}
    </span>
  );
}

/* ──────────────── Component ──────────────── */
export function FloatingChatWidget() {
  const { user } = useAuth();
  const location = useLocation();
  const { totalUnreadCount, refetch: refetchUnread, clearReactionUnread } = useChatUnread();
  const { presence, registerMessageHandler, registerDeliveredHandler, registerReadHandler } = useChatSocketContext();

  /* ── Preferences ── */
  const [enabled, setEnabled] = useState(() => getChatSettings().floatingWidgetEnabled);
  useEffect(() => {
    const onSettingsChange = () => setEnabled(getChatSettings().floatingWidgetEnabled);
    window.addEventListener('chat-settings-changed', onSettingsChange);
    return () => window.removeEventListener('chat-settings-changed', onSettingsChange);
  }, []);

  /* ── UI state ── */
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const saved = getFloatingChatPosition();
    if (saved) return clampPosition(saved.x, saved.y);
    return clampPosition(window.innerWidth - BUTTON_SIZE - 24, window.innerHeight - BUTTON_SIZE - 24);
  });
  const [searchQuery, setSearchQuery] = useState('');

  /* ── Conversations ── */
  const [conversations, setConversations] = useState<ConvRow[]>([]);
  const [unreadByUserId, setUnreadByUserId] = useState<Record<number, number>>({});
  const [users, setUsers] = useState<UserOption[]>([]);

  /* ── Thread state ── */
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  /* ── Message action state ── */
  const [messageMenuId, setMessageMenuId] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<MsgRow | null>(null);
  const [forwardMessageId, setForwardMessageId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<{ messageId: number; isSender: boolean } | null>(null);
  const [messageInfoId, setMessageInfoId] = useState<number | null>(null);

  /* ── AI Improve state ── */
  const [improveModal, setImproveModal] = useState<{ original: string; improved: string } | null>(null);
  const [improveLoading, setImproveLoading] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);

  /* ── Refs ── */
  const dragRef = useRef<{ startX: number; startY: number; posX: number; posY: number } | null>(null);
  const didDragRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedUserIdRef = useRef<number | null>(null);
  const isOpenRef = useRef(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const myId = user?.userId;
  selectedUserIdRef.current = selectedUserId;
  isOpenRef.current = isOpen;

  /* ────────────────────────────────────────────
   * Data loading
   * ──────────────────────────────────────────── */
  const loadConversations = useCallback(() => {
    api.get<{ success: boolean; data: ConvRow[] }>('/api/chat/conversations')
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : [];
        setConversations(list);
        const viewingId = isOpenRef.current ? selectedUserIdRef.current : null;
        setUnreadByUserId(() => {
          const next: Record<number, number> = {};
          list.forEach((c) => {
            // Skip user we're actively viewing - mark-read may not have been processed yet
            if (c.userId === viewingId) return;
            const n = Number(c.unreadCount ?? 0);
            if (n > 0) next[c.userId] = n;
          });
          return next;
        });
      })
      .catch(() => setConversations([]));
  }, []);

  const loadUsers = useCallback(() => {
    api.get<{ success: boolean; data: UserOption[] }>('/api/chat/users')
      .then((res) => setUsers(res.data ?? []))
      .catch(() => setUsers([]));
  }, []);

  const loadMessages = useCallback((partnerId: number) => {
    setLoadingMessages(true);
    setMessages([]);
    api.get<{ success: boolean; data: unknown[] }>(`/api/chat/messages?with=${partnerId}&limit=${MESSAGE_LIMIT}`)
      .then((res) => {
        const raw = Array.isArray(res?.data) ? res.data : [];
        setMessages(raw.map((m) => normalizeMsg(m as Record<string, unknown>)));
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }, []);

  const fetchMessages = useCallback(() => {
    if (!selectedUserId) return;
    api.get<{ success: boolean; data: unknown[] }>(`/api/chat/messages?with=${selectedUserId}&limit=${MESSAGE_LIMIT}`)
      .then((res) => {
        const raw = Array.isArray(res?.data) ? res.data : [];
        setMessages(raw.map((m) => normalizeMsg(m as Record<string, unknown>)));
      })
      .catch(() => {});
  }, [selectedUserId]);

  useEffect(() => {
    if (!user) return;
    loadConversations();
    loadUsers();
  }, [user, loadConversations, loadUsers]);

  useEffect(() => {
    if (!user || !selectedUserId) { setMessages([]); setSendError(null); setReplyingTo(null); setMessageMenuId(null); return; }
    loadMessages(selectedUserId);
    api.post('/api/chat/mark-read', { withUserId: selectedUserId }).catch(() => {});
    refetchUnread();
    setUnreadByUserId((prev) => { if (!prev[selectedUserId]) return prev; const next = { ...prev }; delete next[selectedUserId]; return next; });
    clearReactionUnread(selectedUserId);
  }, [user, selectedUserId, loadMessages, refetchUnread, clearReactionUnread]);

  useEffect(() => {
    if (isOpen && selectedUserId && user) {
      loadMessages(selectedUserId);
      loadConversations();
      api.post('/api/chat/mark-read', { withUserId: selectedUserId }).catch(() => {});
      refetchUnread();
      setUnreadByUserId((prev) => { if (!prev[selectedUserId]) return prev; const next = { ...prev }; delete next[selectedUserId]; return next; });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useLayoutEffect(() => {
    const el = messagesAreaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loadingMessages]);

  useEffect(() => {
    if (selectedUserId && !loadingMessages) inputRef.current?.focus();
  }, [selectedUserId, loadingMessages]);

  /* Close menu on outside click */
  useEffect(() => {
    if (messageMenuId == null) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMessageMenuId(null);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [messageMenuId]);

  /* ────────────────────────────────────────────
   * Socket: incoming messages + delivered/read updates
   * ──────────────────────────────────────────── */
  useEffect(() => {
    if (!myId) return;
    const handler = (payload: {
      senderUserId: number; receiverUserId: number; messageId: number;
      messageText: string; sentAt: string; senderName: string;
    }) => {
      const curSel = selectedUserIdRef.current;
      const curOpen = isOpenRef.current;
      const isForMe = payload.receiverUserId === myId && payload.senderUserId !== myId;
      const isByMe = payload.senderUserId === myId;
      const isForThread = curSel != null && (payload.senderUserId === curSel || payload.receiverUserId === curSel);

      if (isForThread) {
        setMessages((prev) => {
          if (prev.some((m) => m.messageId === payload.messageId)) return prev;
          return [...prev, {
            messageId: payload.messageId, senderUserId: payload.senderUserId,
            receiverUserId: payload.receiverUserId, messageText: payload.messageText,
            sentAt: payload.sentAt, senderName: payload.senderName,
            deliveredAt: null, readAt: null,
          }];
        });
      }

      if (isForMe) {
        api.post('/api/chat/mark-delivered', { withUserId: payload.senderUserId, messageIds: [payload.messageId] }).catch(() => {});
        if (curSel === payload.senderUserId && curOpen) {
          api.post('/api/chat/mark-read', { withUserId: payload.senderUserId, messageIds: [payload.messageId] })
            .catch(() => {}).finally(() => refetchUnread());
        } else {
          setUnreadByUserId((prev) => ({ ...prev, [payload.senderUserId]: (prev[payload.senderUserId] ?? 0) + 1 }));
          refetchUnread();
          const s = getChatSettings();
          if (s.soundEnabled) playChatSound();
        }
      }
      if (isForMe || isByMe) loadConversations();
    };
    const unreg = registerMessageHandler(handler);
    return unreg;
  }, [myId, refetchUnread, loadConversations, registerMessageHandler]);

  useEffect(() => {
    const onDelivered = (payload: { messageIds: number[]; deliveredAt: string }) => {
      const ids = new Set((payload.messageIds || []).map(Number));
      setMessages((prev) => prev.map((m) => ids.has(m.messageId) ? { ...m, deliveredAt: payload.deliveredAt } : m));
    };
    const unreg = registerDeliveredHandler(onDelivered);
    return unreg;
  }, [registerDeliveredHandler]);

  useEffect(() => {
    const onRead = (payload: { messageIds: number[]; readAt: string }) => {
      const ids = new Set((payload.messageIds || []).map(Number));
      setMessages((prev) => prev.map((m) => ids.has(m.messageId) ? { ...m, readAt: payload.readAt } : m));
    };
    const unreg = registerReadHandler(onRead);
    return unreg;
  }, [registerReadHandler]);

  /* ────────────────────────────────────────────
   * Send message (supports reply)
   * ──────────────────────────────────────────── */
  const handleSend = useCallback((textOverride?: string) => {
    const text = (textOverride ?? inputText).trim();
    if (!myId || !selectedUserId || !text || sending) return;
    setSendError(null);
    setSending(true);
    const body: Record<string, unknown> = { toUserId: selectedUserId, text };
    if (replyingTo?.messageId) body.replyToMessageId = replyingTo.messageId;
    api.post<{ success: boolean; data: Record<string, unknown> }>('/api/chat/send', body)
      .then((res) => {
        const data = res?.data;
        if (data) {
          const msg = normalizeMsg(data);
          setMessages((prev) => prev.some((m) => m.messageId === msg.messageId) ? prev : [...prev, msg]);
        }
        setInputText('');
        setReplyingTo(null);
        loadConversations();
      })
      .catch((err) => setSendError(err instanceof Error ? err.message : 'Failed to send'))
      .finally(() => setSending(false));
  }, [myId, selectedUserId, inputText, sending, loadConversations, replyingTo]);

  /* ────────────────────────────────────────────
   * Message actions
   * ──────────────────────────────────────────── */
  const handleReply = useCallback((msg: MsgRow) => {
    setReplyingTo(msg);
    setMessageMenuId(null);
    inputRef.current?.focus();
  }, []);

  const handleReact = useCallback((messageId: number, emoji: string) => {
    api.post(`/api/chat/message/${messageId}/react`, { emoji }).then(() => fetchMessages()).catch(() => {});
    setMessageMenuId(null);
  }, [fetchMessages]);

  const handleRemoveReaction = useCallback((messageId: number) => {
    api.delete(`/api/chat/message/${messageId}/react`).then(() => fetchMessages()).catch(() => {});
    setMessageMenuId(null);
  }, [fetchMessages]);

  const handleForwardClick = useCallback((messageId: number) => {
    setForwardMessageId(messageId);
    setMessageMenuId(null);
  }, []);

  const handleForwardToUser = useCallback((toUserId: number) => {
    if (forwardMessageId == null) return;
    api.post(`/api/chat/message/${forwardMessageId}/forward`, { toUserId })
      .then(() => { fetchMessages(); loadConversations(); setForwardMessageId(null); }).catch(() => {});
  }, [forwardMessageId, fetchMessages, loadConversations]);

  const handleStar = useCallback((messageId: number, starred: boolean) => {
    (starred ? api.delete(`/api/chat/message/${messageId}/star`) : api.post(`/api/chat/message/${messageId}/star`))
      .then(() => fetchMessages()).catch(() => {});
    setMessageMenuId(null);
  }, [fetchMessages]);

  const handlePin = useCallback((messageId: number, pinned: boolean) => {
    (pinned ? api.delete(`/api/chat/message/${messageId}/pin`) : api.post(`/api/chat/message/${messageId}/pin`))
      .then(() => fetchMessages()).catch(() => {});
    setMessageMenuId(null);
  }, [fetchMessages]);

  const openDeleteConfirm = useCallback((msg: MsgRow) => {
    setDeleteConfirmId({ messageId: msg.messageId, isSender: msg.senderUserId === myId });
    setMessageMenuId(null);
  }, [myId]);

  const handleDelete = useCallback((messageId: number, forEveryone: boolean) => {
    api.post(`/api/chat/message/${messageId}/delete`, { forEveryone })
      .then(() => { fetchMessages(); setDeleteConfirmId(null); }).catch(() => {});
  }, [fetchMessages]);

  /* ────────────────────────────────────────────
   * AI Improve
   * ──────────────────────────────────────────── */
  const openImproveModal = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    setImproveError(null);
    setImproveModal({ original: text, improved: '' });
    setImproveLoading(true);
    const serviceCode = getChatSettings().aiServiceCode?.trim() || undefined;
    api.post<{ success: boolean; data: { improved: string } }>('/api/chat/improve', { text, serviceCode })
      .then((res) => {
        const improved = (res as { data?: { improved?: string } }).data?.improved ?? '';
        setImproveModal((m) => m ? { ...m, improved } : null);
      })
      .catch((err) => setImproveError(err instanceof Error ? err.message : 'Failed to improve'))
      .finally(() => setImproveLoading(false));
  }, [inputText]);

  const improveGetMore = useCallback(() => {
    const text = improveModal?.original ?? '';
    if (!text) return;
    setImproveError(null);
    setImproveLoading(true);
    const variant = improveModal?.improved ? 'friendly' : 'professional';
    const serviceCode = getChatSettings().aiServiceCode?.trim() || undefined;
    api.post<{ success: boolean; data: { improved: string } }>('/api/chat/improve', { text, variant, serviceCode })
      .then((res) => {
        const improved = (res as { data?: { improved?: string } }).data?.improved ?? '';
        setImproveModal((m) => m ? { ...m, improved } : null);
      })
      .catch((err) => setImproveError(err instanceof Error ? err.message : 'Failed to improve'))
      .finally(() => setImproveLoading(false));
  }, [improveModal]);

  const applyImprove = useCallback((improved: string) => {
    setInputText(improved);
    setImproveModal(null);
    setImproveError(null);
    inputRef.current?.focus();
  }, []);

  const sendImproved = useCallback((improved: string) => {
    setImproveModal(null);
    setImproveError(null);
    handleSend(improved);
  }, [handleSend]);

  /* ────────────────────────────────────────────
   * Drag handling (mouse + touch)
   * ──────────────────────────────────────────── */
  const onDragStart = useCallback((clientX: number, clientY: number) => {
    if (isOpen) return;
    didDragRef.current = false;
    dragRef.current = { startX: clientX, startY: clientY, posX: position.x, posY: position.y };
  }, [isOpen, position]);

  useEffect(() => {
    const onMove = (cx: number, cy: number) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = cx - d.startX, dy = cy - d.startY;
      if (!didDragRef.current && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) didDragRef.current = true;
      if (didDragRef.current) setPosition(clampPosition(d.posX + dx, d.posY + dy));
    };
    const onEnd = () => {
      if (dragRef.current) {
        if (didDragRef.current) setPosition((p) => { setFloatingChatPosition(p); return p; });
        dragRef.current = null;
      }
    };
    const mm = (e: MouseEvent) => onMove(e.clientX, e.clientY);
    const tm = (e: TouchEvent) => { if (e.touches.length === 1) onMove(e.touches[0].clientX, e.touches[0].clientY); };
    window.addEventListener('mousemove', mm);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', tm, { passive: true });
    window.addEventListener('touchend', onEnd);
    return () => { window.removeEventListener('mousemove', mm); window.removeEventListener('mouseup', onEnd); window.removeEventListener('touchmove', tm); window.removeEventListener('touchend', onEnd); };
  }, []);

  useEffect(() => {
    const onResize = () => setPosition((p) => clampPosition(p.x, p.y));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onButtonClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (didDragRef.current) { didDragRef.current = false; return; }
    setIsOpen((open) => { if (!open) loadConversations(); return !open; });
  }, [loadConversations]);

  const handleSelectUser = useCallback((userId: number) => {
    setSelectedUserId(userId);
    setInputText('');
    setSendError(null);
    setReplyingTo(null);
    setMessageMenuId(null);
    setMessageInfoId(null);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedUserId(null);
    setMessages([]);
    setSendError(null);
    setReplyingTo(null);
    setMessageMenuId(null);
    setMessageInfoId(null);
    loadConversations();
  }, [loadConversations]);

  /* ────────────────────────────────────────────
   * Hide conditions
   * ──────────────────────────────────────────── */
  const onChatPage = location.pathname === '/chat';
  if (!user || !enabled || onChatPage) return null;

  const selectedConv = conversations.find((c) => c.userId === selectedUserId);

  const panelRight = Math.max(16, window.innerWidth - position.x - BUTTON_SIZE - PANEL_WIDTH + 20);
  const panelBottom = Math.max(16, window.innerHeight - position.y - BUTTON_SIZE + 8);

  const searchLower = searchQuery.trim().toLowerCase();
  const filteredConversations = searchLower
    ? conversations.filter((c) => c.name.toLowerCase().includes(searchLower) || (c.email && c.email.toLowerCase().includes(searchLower)))
    : conversations;

  return (
    <>
      {/* ── Draggable floating button ── */}
      <div
        role="button"
        tabIndex={0}
        aria-label={isOpen ? 'Minimize chat' : `${totalUnreadCount > 0 ? `${totalUnreadCount} unread. ` : ''}Open chat`}
        style={{
          position: 'fixed',
          left: position.x,
          top: position.y,
          width: BUTTON_SIZE,
          height: BUTTON_SIZE,
          borderRadius: '50%',
          background: 'var(--ins-topbar-bg, #252630)',
          color: 'var(--ins-topbar-item-color, #6c757d)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isOpen ? 'pointer' : 'grab',
          zIndex: 1060,
          border: '2px solid var(--ins-topbar-item-hover-color, #1ab394)',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none',
          transition: didDragRef.current ? 'none' : 'box-shadow 0.2s',
        }}
        onMouseDown={(e) => { if (e.button === 0) onDragStart(e.clientX, e.clientY); }}
        onTouchStart={(e) => { if (e.touches.length === 1) onDragStart(e.touches[0].clientX, e.touches[0].clientY); }}
        onClick={onButtonClick}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen((o) => { if (!o) loadConversations(); return !o; }); } }}
      >
        <i className={isOpen ? 'ti ti-x fs-20' : 'ti ti-message-circle fs-20'} style={{ lineHeight: 1 }} />
        {!isOpen && totalUnreadCount > 0 && (
          <span
            style={{
              position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20,
              borderRadius: 10, background: '#dc3545', color: '#fff', fontSize: 11,
              fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 5px', border: '2px solid var(--bs-body-bg, #fff)', lineHeight: 1,
            }}
          >
            {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
          </span>
        )}
      </div>

      {/* ── Chat panel ── */}
      {isOpen && (
        <div
          className="card shadow-lg border overflow-hidden"
          style={{
            position: 'fixed',
            bottom: Math.max(16, panelBottom),
            right: Math.max(16, Math.min(window.innerWidth - PANEL_WIDTH - 16, panelRight)),
            width: PANEL_WIDTH,
            height: PANEL_HEIGHT,
            maxWidth: 'calc(100vw - 32px)',
            maxHeight: 'calc(100vh - 100px)',
            zIndex: 1059,
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 12,
          }}
        >
          {/* Header - matches topbar */}
          <div
            className="d-flex align-items-center justify-content-between py-2 px-3 flex-shrink-0"
            style={{ background: 'var(--ins-topbar-bg, #252630)', color: 'var(--ins-topbar-item-color, #adb5bd)', borderRadius: '12px 12px 0 0' }}
          >
            {selectedUserId ? (
              <div className="d-flex align-items-center gap-2 min-w-0">
                <button type="button" className="btn btn-sm p-0" style={{ color: 'inherit' }} onClick={handleBack} aria-label="Back">
                  <i className="ti ti-arrow-left fs-18" />
                </button>
                <UserAvatar userId={selectedUserId} name={selectedConv?.name ?? ''} size={28} />
                <div className="d-flex align-items-center gap-1 min-w-0">
                  <span className="fw-semibold small text-truncate" style={{ color: 'var(--ins-topbar-item-hover-color, #fff)' }}>{selectedConv?.name ?? `User #${selectedUserId}`}</span>
                  <PresenceDot status={presence[selectedUserId]} />
                </div>
              </div>
            ) : (
              <span className="fw-semibold" style={{ color: 'var(--ins-topbar-item-hover-color, #fff)' }}>Messages</span>
            )}
            <div className="d-flex align-items-center gap-1 flex-shrink-0">
              <Link
                to={selectedUserId ? `/chat?with=${selectedUserId}` : '/chat'}
                className="btn btn-sm p-1 opacity-75"
                title="Open full chat"
                style={{ lineHeight: 1, color: 'inherit' }}
              >
                <i className="ti ti-external-link fs-16" />
              </Link>
              <button
                type="button"
                className="btn btn-sm p-1 opacity-75"
                aria-label="Minimize"
                onClick={() => setIsOpen(false)}
                style={{ lineHeight: 1, color: 'inherit' }}
              >
                <i className="ti ti-minus fs-16" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="d-flex flex-column flex-grow-1 overflow-hidden position-relative" style={{ minHeight: 0 }}>
            {!selectedUserId ? (
              /* ── Conversation list with search ── */
              <div className="d-flex flex-column flex-grow-1 overflow-hidden" style={{ minHeight: 0 }}>
                {/* Search bar */}
                <div className="px-3 py-2 border-bottom flex-shrink-0">
                  <div className="input-group input-group-sm">
                    <span className="input-group-text bg-transparent border-end-0"><i className="ti ti-search text-muted" style={{ fontSize: 14 }} /></span>
                    <input
                      type="text"
                      className="form-control border-start-0 ps-0"
                      placeholder="Search conversations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {searchQuery && (
                      <button type="button" className="btn btn-outline-secondary border-start-0 py-0 px-1" onClick={() => setSearchQuery('')} aria-label="Clear search">
                        <i className="ti ti-x" style={{ fontSize: 13 }} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex-grow-1 overflow-auto" style={{ minHeight: 0 }}>
                  {filteredConversations.length === 0 ? (
                    <div className="p-4 text-muted small text-center">
                      {searchQuery ? (
                        <>No conversations matching &ldquo;{searchQuery}&rdquo;</>
                      ) : (
                        <>
                          <i className="ti ti-message-circle-off d-block mb-2" style={{ fontSize: 32 }} />
                          No conversations yet.<br />
                          <Link to="/chat" className="text-primary text-decoration-none">Open full chat</Link> to start one.
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="list-group list-group-flush">
                      {filteredConversations.map((c) => {
                        const unread = unreadByUserId[c.userId] ?? 0;
                        return (
                          <button
                            key={c.userId}
                            type="button"
                            className="list-group-item list-group-item-action d-flex align-items-center gap-2 text-start py-2 px-3 border-0"
                            onClick={() => handleSelectUser(c.userId)}
                          >
                            <span className="position-relative flex-shrink-0">
                              <UserAvatar userId={c.userId} name={c.name} size={36} />
                              <span className="position-absolute" style={{ bottom: -1, right: -1 }}>
                                <PresenceDot status={presence[c.userId]} />
                              </span>
                            </span>
                            <div className="min-w-0 flex-grow-1">
                              <div className="d-flex align-items-center justify-content-between">
                                <span className={`text-truncate small ${unread > 0 ? 'fw-bold' : 'fw-semibold'}`}>{c.name}</span>
                                {c.lastMessageAt && (
                                  <span className="text-muted flex-shrink-0" style={{ fontSize: 11 }}>{formatListTime(c.lastMessageAt)}</span>
                                )}
                              </div>
                              <div className="d-flex align-items-center justify-content-between">
                                <span className={`text-truncate ${unread > 0 ? 'text-body' : 'text-muted'}`} style={{ fontSize: 12 }}>
                                  {c.lastMessagePreview || 'No messages'}
                                </span>
                                {unread > 0 && (
                                  <span className="badge bg-danger rounded-pill ms-1 flex-shrink-0" style={{ fontSize: 10, minWidth: 18 }}>{unread > 99 ? '99+' : unread}</span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ── Thread view ── */
              <>
                {/* Messages area */}
                <div ref={messagesAreaRef} className="flex-grow-1 overflow-auto px-2 py-2" style={{ minHeight: 0 }}>
                  {loadingMessages ? (
                    <div className="text-center text-muted small py-4">
                      <span className="spinner-border spinner-border-sm me-1" role="status" />Loading messages...
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center text-muted small py-4">No messages yet. Say hello!</div>
                  ) : (
                    messages.map((m) => {
                      const isMe = m.senderUserId === myId;
                      const hasReactions = m.reactions && m.reactions.length > 0;
                      return (
                        <div
                          key={m.messageId}
                          className={`d-flex mb-2 ${isMe ? 'justify-content-end' : 'justify-content-start'}`}
                          style={{ marginBottom: hasReactions ? 18 : undefined }}
                        >
                          <div
                            className="rounded-3 px-2 py-1 small position-relative"
                            style={{
                              maxWidth: '85%',
                              backgroundColor: m.isDeleted ? 'var(--bs-tertiary-bg, #f5f5f5)' : isMe ? 'var(--bs-primary, #0d6efd)' : 'var(--bs-tertiary-bg, #f0f0f0)',
                              color: m.isDeleted ? 'var(--bs-secondary-color, #6c757d)' : isMe ? '#fff' : 'var(--bs-body-color)',
                              wordBreak: 'break-word',
                              opacity: m.isDeleted ? 0.7 : 1,
                            }}
                          >
                            {/* Reply preview */}
                            {m.replyToPreview && !m.isDeleted && (
                              <div className="border-start border-2 border-primary ps-2 mb-1" style={{ fontSize: 10 }}>
                                <div className="fw-semibold" style={{ opacity: 0.8 }}>{m.replyToSenderName ?? 'Unknown'}</div>
                                <div className="text-truncate" style={{ maxWidth: 200, opacity: 0.7 }}>{m.replyToPreview}</div>
                              </div>
                            )}

                            {!isMe && !m.isDeleted && (
                              <div style={{ fontSize: 10, opacity: 0.7, fontWeight: 600 }}>{m.senderName}</div>
                            )}

                            <div className="text-break" style={{ whiteSpace: 'pre-wrap' }}>
                              {m.isDeleted ? (
                                <em><i className="ti ti-ban me-1" style={{ fontSize: 11 }} />This message was deleted</em>
                              ) : (
                                m.messageText || (m.attachmentFileName ? `📎 ${m.attachmentFileName}` : '[Attachment]')
                              )}
                            </div>

                            {/* Footer: time + status ticks + star/pin + menu */}
                            <div className="d-flex align-items-center justify-content-end gap-1" style={{ fontSize: 10, opacity: 0.6, marginTop: 1 }}>
                              {m.isPinned && <i className="ti ti-pin-filled text-primary" title="Pinned" style={{ fontSize: 10, opacity: 1 }} />}
                              {m.isStarred && <i className="ti ti-star-filled text-warning" title="Starred" style={{ fontSize: 10, opacity: 1 }} />}
                              <span>{formatTime(m.sentAt)}</span>
                              {isMe && !m.isDeleted && (
                                <MessageStatusTicks deliveredAt={m.deliveredAt} readAt={m.readAt} />
                              )}
                              {!m.isDeleted && (
                                <button
                                  type="button"
                                  className="btn btn-link p-0 text-body-secondary"
                                  style={{ fontSize: 10, lineHeight: 1, opacity: 0.7, color: isMe ? '#fff' : undefined }}
                                  onClick={() => setMessageMenuId((id) => id === m.messageId ? null : m.messageId)}
                                  title="More"
                                >
                                  <i className="ti ti-dots-vertical" />
                                </button>
                              )}
                            </div>

                            {/* Message info popover */}
                            {messageInfoId === m.messageId && isMe && (
                              <div className="position-absolute bg-white rounded-3 shadow-lg p-2 small border" style={{ zIndex: 15, bottom: '100%', [isMe ? 'right' : 'left']: 0, marginBottom: 4, minWidth: 180 }}>
                                <div className="d-flex justify-content-between py-1 gap-3"><span className="text-muted">Sent</span><span className="text-nowrap">{formatInfoTime(m.sentAt)}</span></div>
                                <div className="d-flex justify-content-between py-1 gap-3"><span className="text-muted">Delivered</span><span className="text-nowrap">{formatInfoTime(m.deliveredAt)}</span></div>
                                <div className="d-flex justify-content-between py-1 gap-3"><span className="text-muted">Read</span><span className="text-nowrap">{formatInfoTime(m.readAt)}</span></div>
                                <button type="button" className="btn btn-sm btn-outline-secondary w-100 mt-1" onClick={() => setMessageInfoId(null)}>Close</button>
                              </div>
                            )}

                            {/* Context menu */}
                            {messageMenuId === m.messageId && (
                              <div
                                ref={menuRef}
                                className="position-absolute rounded-3 shadow-lg border overflow-hidden"
                                style={{
                                  zIndex: 25, minWidth: 170,
                                  background: 'var(--bs-body-bg, #fff)',
                                  color: 'var(--bs-body-color)',
                                  [isMe ? 'right' : 'left']: 0,
                                  bottom: '100%', marginBottom: 4,
                                }}
                              >
                                <div className="p-2 pb-1">
                                  {/* Quick emoji reactions */}
                                  <div className="d-flex flex-wrap gap-1 justify-content-center mb-1">
                                    {QUICK_EMOJIS.map((emoji) => (
                                      <button key={emoji} type="button" className="btn btn-sm btn-outline-secondary rounded-circle p-0 d-flex align-items-center justify-content-center" style={{ width: 30, height: 30, fontSize: '0.95rem' }} onClick={() => handleReact(m.messageId, emoji)} title={`React ${emoji}`}>{emoji}</button>
                                    ))}
                                  </div>
                                  <hr className="my-1" />
                                  <button type="button" className="btn btn-sm btn-link text-start w-100 d-flex align-items-center gap-2 py-1 rounded text-body" onClick={() => handleReply(m)}>
                                    <i className="ti ti-arrow-back-up" style={{ fontSize: 14 }} /> <span style={{ fontSize: 12 }}>Reply</span>
                                  </button>
                                  <button type="button" className="btn btn-sm btn-link text-start w-100 d-flex align-items-center gap-2 py-1 rounded text-body" onClick={() => handleForwardClick(m.messageId)}>
                                    <i className="ti ti-share" style={{ fontSize: 14 }} /> <span style={{ fontSize: 12 }}>Forward</span>
                                  </button>
                                  <button type="button" className="btn btn-sm btn-link text-start w-100 d-flex align-items-center gap-2 py-1 rounded text-body" onClick={() => handleStar(m.messageId, !!m.isStarred)}>
                                    <i className={m.isStarred ? 'ti ti-star-filled text-warning' : 'ti ti-star'} style={{ fontSize: 14 }} /> <span style={{ fontSize: 12 }}>{m.isStarred ? 'Unstar' : 'Star'}</span>
                                  </button>
                                  <button type="button" className="btn btn-sm btn-link text-start w-100 d-flex align-items-center gap-2 py-1 rounded text-body" onClick={() => handlePin(m.messageId, !!m.isPinned)}>
                                    <i className={m.isPinned ? 'ti ti-pin-filled' : 'ti ti-pin'} style={{ fontSize: 14 }} /> <span style={{ fontSize: 12 }}>{m.isPinned ? 'Unpin' : 'Pin'}</span>
                                  </button>
                                  {isMe && (
                                    <button type="button" className="btn btn-sm btn-link text-start w-100 d-flex align-items-center gap-2 py-1 rounded" onClick={() => setMessageInfoId((id) => id === m.messageId ? null : m.messageId)}>
                                      <i className="ti ti-info-circle text-muted" style={{ fontSize: 14 }} /> <span style={{ fontSize: 12 }}>Info</span>
                                    </button>
                                  )}
                                  <hr className="my-1" />
                                  <button type="button" className="btn btn-sm btn-link text-start w-100 d-flex align-items-center gap-2 py-1 rounded text-danger" onClick={() => openDeleteConfirm(m)}>
                                    <i className="ti ti-trash" style={{ fontSize: 14 }} /> <span style={{ fontSize: 12 }}>Delete</span>
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Reactions display */}
                            {hasReactions && (
                              <div className="position-absolute d-flex flex-wrap" style={{ bottom: -12, [isMe ? 'right' : 'left']: 4, zIndex: 2 }}>
                                {m.reactions!.map((r, idx) => (
                                  <button
                                    key={`${r.emoji}-${idx}`}
                                    type="button"
                                    className="border-0 rounded-pill d-inline-flex align-items-center shadow-sm"
                                    style={{
                                      fontSize: '0.8rem', cursor: 'pointer', padding: '1px 5px',
                                      marginRight: 2,
                                      backgroundColor: r.you ? 'var(--bs-primary-bg-subtle, #e0eaff)' : 'rgba(255,255,255,0.95)',
                                      border: r.you ? '1px solid var(--bs-primary)' : '1px solid rgba(0,0,0,0.06)',
                                    }}
                                    onClick={(e) => { e.stopPropagation(); r.you ? handleRemoveReaction(m.messageId) : handleReact(m.messageId, r.emoji); }}
                                    title={r.you ? 'Remove reaction' : `React with ${r.emoji}`}
                                  >
                                    <span aria-hidden>{r.emoji}</span>
                                    {r.count > 1 && <span className="text-body-secondary ms-0" style={{ fontSize: '0.6rem' }}>{r.count}</span>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Send error */}
                {sendError && (
                  <div className="px-2 pb-1">
                    <div className="alert alert-danger py-1 px-2 mb-0 small d-flex align-items-center gap-1">
                      <i className="ti ti-alert-circle" />
                      <span className="text-truncate">{sendError}</span>
                      <button type="button" className="btn-close btn-close-sm ms-auto" onClick={() => setSendError(null)} aria-label="Dismiss" />
                    </div>
                  </div>
                )}

                {/* Reply bar */}
                {replyingTo && (
                  <div className="px-2 pt-1 flex-shrink-0">
                    <div className="d-flex align-items-center gap-2 p-2 rounded border-start border-3 border-primary" style={{ background: 'var(--bs-tertiary-bg, #f0f0f0)', fontSize: 12 }}>
                      <div className="min-w-0 flex-grow-1">
                        <div className="fw-semibold text-primary">Replying to {replyingTo.senderName}</div>
                        <div className="text-body-secondary text-truncate" style={{ maxWidth: 260 }}>{replyingTo.messageText || '[Attachment]'}</div>
                      </div>
                      <button type="button" className="btn btn-sm btn-outline-secondary p-0 px-1" onClick={() => setReplyingTo(null)} aria-label="Cancel reply">
                        <i className="ti ti-x" style={{ fontSize: 12 }} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Input area */}
                <div className="border-top p-2 flex-shrink-0">
                  <div className="input-group input-group-sm">
                    <input
                      ref={inputRef}
                      type="text"
                      className="form-control"
                      placeholder="Type a message..."
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                      disabled={sending}
                    />
                    <button
                      type="button"
                      className="btn btn-outline-primary"
                      onClick={openImproveModal}
                      disabled={sending || !inputText.trim() || improveLoading || improveModal != null}
                      title="Improve message with AI"
                      aria-label="Improve message with AI"
                      style={{ lineHeight: 1 }}
                    >
                      {improveLoading ? <span className="spinner-border spinner-border-sm" style={{ width: 14, height: 14 }} /> : <i className="ti ti-sparkles" />}
                    </button>
                    <button type="button" className="btn btn-primary" onClick={() => handleSend()} disabled={sending || !inputText.trim()} aria-label="Send">
                      {sending ? <span className="spinner-border spinner-border-sm" role="status" /> : <i className="ti ti-send" />}
                    </button>
                  </div>
                </div>

                {/* ── Overlay modals ── */}
                {/* AI Improve */}
                {improveModal != null && (
                  <div className="position-absolute top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center p-2" style={{ zIndex: 30, background: 'rgba(0,0,0,0.2)', borderRadius: 12 }} onClick={() => { setImproveModal(null); setImproveError(null); }}>
                    <div className="rounded-3 shadow p-3 w-100" style={{ maxWidth: 340, background: 'var(--bs-body-bg, #fff)', color: 'var(--bs-body-color)' }} onClick={(e) => e.stopPropagation()}>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="fw-semibold d-flex align-items-center gap-1 small"><i className="ti ti-sparkles text-primary" /> Improve message</span>
                        <button type="button" className="btn btn-sm btn-link text-body-secondary p-0" onClick={() => { setImproveModal(null); setImproveError(null); }} aria-label="Close"><i className="ti ti-x" /></button>
                      </div>
                      {improveError && <div className="alert alert-danger py-1 px-2 mb-2 small">{improveError}</div>}
                      <div className="mb-2">
                        <div className="text-muted mb-1" style={{ fontSize: 11 }}>Original</div>
                        <div className="p-2 rounded small" style={{ background: 'var(--bs-tertiary-bg, #f0f0f0)', maxHeight: 60, overflow: 'auto' }}>{improveModal.original}</div>
                      </div>
                      {improveLoading ? (
                        <div className="d-flex align-items-center gap-2 py-2 text-muted"><span className="spinner-border spinner-border-sm" /><span className="small">Improving…</span></div>
                      ) : improveModal.improved ? (
                        <>
                          <div className="mb-2">
                            <div className="text-muted mb-1" style={{ fontSize: 11 }}>Improved</div>
                            <div className="p-2 rounded small" style={{ background: 'rgba(25,135,84,0.1)', border: '1px solid rgba(25,135,84,0.25)', maxHeight: 80, overflow: 'auto' }}>{improveModal.improved}</div>
                          </div>
                          <div className="d-flex flex-wrap gap-1">
                            <button type="button" className="btn btn-primary btn-sm d-flex align-items-center gap-1" onClick={() => sendImproved(improveModal.improved)} disabled={sending}><i className="ti ti-send-2" style={{ fontSize: 12 }} /><span style={{ fontSize: 12 }}>Send</span></button>
                            <button type="button" className="btn btn-outline-secondary btn-sm" style={{ fontSize: 12 }} onClick={() => applyImprove(improveModal.improved)}>Use this</button>
                            <button type="button" className="btn btn-outline-secondary btn-sm" style={{ fontSize: 12 }} onClick={improveGetMore}>Another</button>
                            <button type="button" className="btn btn-outline-secondary btn-sm" style={{ fontSize: 12 }} onClick={() => { setImproveModal(null); setImproveError(null); }}>Cancel</button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Forward dialog */}
                {forwardMessageId != null && (
                  <div className="position-absolute top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center p-2" style={{ zIndex: 30, background: 'rgba(0,0,0,0.2)', borderRadius: 12 }} onClick={() => setForwardMessageId(null)}>
                    <div className="rounded-3 shadow p-3 w-100" style={{ maxWidth: 320, background: 'var(--bs-body-bg, #fff)', color: 'var(--bs-body-color)' }} onClick={(e) => e.stopPropagation()}>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <span className="fw-semibold small">Forward to</span>
                        <button type="button" className="btn btn-sm btn-link text-body-secondary p-0" onClick={() => setForwardMessageId(null)}><i className="ti ti-x" /></button>
                      </div>
                      <div className="list-group list-group-flush" style={{ maxHeight: 240, overflowY: 'auto' }}>
                        {users.filter((u) => u.userId !== myId).map((u) => (
                          <button key={u.userId} type="button" className="list-group-item list-group-item-action d-flex align-items-center gap-2 py-1 px-2 small" onClick={() => handleForwardToUser(u.userId)}>
                            <UserAvatar userId={u.userId} name={u.name} size={24} />
                            <span className="text-truncate">{u.name}</span>
                            {u.userId === selectedUserId && <span className="badge bg-primary ms-auto" style={{ fontSize: 9 }}>Current</span>}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Delete confirmation */}
                {deleteConfirmId != null && (
                  <div className="position-absolute top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center p-2" style={{ zIndex: 30, background: 'rgba(0,0,0,0.2)', borderRadius: 12 }} onClick={() => setDeleteConfirmId(null)}>
                    <div className="rounded-3 shadow p-3 w-100" style={{ maxWidth: 280, background: 'var(--bs-body-bg, #fff)', color: 'var(--bs-body-color)' }} onClick={(e) => e.stopPropagation()}>
                      <div className="fw-semibold mb-2 small">Delete message?</div>
                      <div className="d-flex flex-column gap-2">
                        <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => handleDelete(deleteConfirmId.messageId, false)}>Delete for me</button>
                        {deleteConfirmId.isSender && (
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(deleteConfirmId.messageId, true)}>Delete for everyone</button>
                        )}
                        <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
