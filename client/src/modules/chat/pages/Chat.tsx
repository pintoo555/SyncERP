import { useEffect, useLayoutEffect, useState, useCallback, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { useChatSocketContext, type PresenceStatus, type ChatReactionPayload } from '../../../contexts/ChatSocketContext';
import { useChatUnread } from '../../../contexts/ChatUnreadContext';
import { UserAvatar } from '../../../components/UserAvatar';
import { getChatSettings, setChatSettings, playChatSound, getChatFavourites, toggleChatFavourite } from '../../../utils/chatSettings';

const CHAT_EMOJIS = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘', '😗', '😋', '😛', '😜', '🤪', '😎',
  '🤩', '🥳', '😢', '😭', '😤', '😡', '🤬', '👍', '👎', '👏', '🙌', '👋', '🤝', '🙏', '❤️', '🧡', '💛', '💚', '💙', '💜',
  '🖤', '🤍', '🤎', '💕', '💖', '💗', '💘', '💝', '😺', '😸', '😻', '😼', '😽', '🔥', '⭐', '✨', '💫', '✅', '❌', '❗', '❓',
];

interface ConversationRow {
  userId: number;
  name: string;
  email: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount?: number;
}

interface ChatMessageReaction {
  emoji: string;
  count: number;
  you: boolean;
}

interface ChatMessageRow {
  messageId: number;
  senderUserId: number;
  receiverUserId: number;
  messageText: string;
  sentAt: string;
  deliveredAt: string | null;
  readAt: string | null;
  senderName: string;
  receiverName: string;
  attachmentFileId?: number | null;
  attachmentFileName?: string | null;
  attachmentMimeType?: string | null;
  attachmentAccessToken?: string | null;
  replyToMessageId?: number | null;
  replyToPreview?: string | null;
  replyToSenderName?: string | null;
  reactions?: ChatMessageReaction[];
  isStarred?: boolean;
  isPinned?: boolean;
  isDeleted?: boolean;
}

interface UserOption {
  userId: number;
  name: string;
  email: string;
}

/** Single file in the upload queue with progress and status. */
interface ChatUploadItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
}

/** Get value from object by key (case-insensitive); SQL Server driver may return lowercase keys. */
function getByKey(obj: Record<string, unknown>, ...keys: string[]): unknown {
  const lowerKeys = new Set(keys.map((k) => k.toLowerCase()));
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && lowerKeys.has(k.toLowerCase())) return v;
  }
  return undefined;
}

/** Normalize API message to ChatMessageRow (handles camelCase, PascalCase, or lowercase from server). */
function normalizeMessageRow(m: Record<string, unknown> & { messageId?: number; MessageID?: number }): ChatMessageRow {
  const messageId = (m.messageId ?? m.MessageID ?? getByKey(m, 'messageId') ?? 0) as number;
  const rawFileId = getByKey(m, 'attachmentFileId', 'AttachmentFileID', 'AttachmentFileId') ?? m.attachmentFileId ?? m.AttachmentFileID ?? m.AttachmentFileId ?? null;
  const attachmentFileId = rawFileId != null ? Number(rawFileId) : null;
  const attachmentFileName = (getByKey(m, 'attachmentFileName', 'AttachmentFileName') ?? m.attachmentFileName ?? m.AttachmentFileName ?? null) as string | null | undefined;
  const attachmentMimeType = (getByKey(m, 'attachmentMimeType', 'AttachmentMimeType') ?? m.attachmentMimeType ?? m.AttachmentMimeType ?? null) as string | null | undefined;
  const attachmentAccessToken = (getByKey(m, 'attachmentAccessToken', 'AttachmentAccessToken', 'AccessToken') ?? m.attachmentAccessToken ?? m.AttachmentAccessToken ?? null) as string | null | undefined;
  const replyToMessageId = (getByKey(m, 'replyToMessageId', 'ReplyToMessageID') ?? m.replyToMessageId) as number | null | undefined;
  const replyToPreview = (getByKey(m, 'replyToPreview', 'ReplyToPreview') ?? m.replyToPreview) as string | null | undefined;
  const replyToSenderName = (getByKey(m, 'replyToSenderName', 'ReplyToSenderName') ?? m.replyToSenderName) as string | null | undefined;
  const rawReactions = (getByKey(m, 'reactions') ?? m.reactions) as unknown;
  const reactions: ChatMessageReaction[] | undefined = Array.isArray(rawReactions)
    ? rawReactions.map((r: Record<string, unknown>) => ({
        emoji: String(getByKey(r, 'emoji', 'Emoji') ?? r.emoji ?? r.Emoji ?? '').trim(),
        count: Number(getByKey(r, 'count', 'Count') ?? r.count ?? r.Count ?? 0) || 1,
        you: getByKey(r, 'you', 'You') === true || r.you === true || r.You === true,
      })).filter((r) => r.emoji.length > 0)
    : undefined;
  const isStarred = (getByKey(m, 'isStarred', 'IsStarred') ?? m.isStarred) as boolean | undefined;
  const isPinned = (getByKey(m, 'isPinned', 'IsPinned') ?? m.isPinned) as boolean | undefined;
  const isDeleted = (getByKey(m, 'isDeleted', 'IsDeleted') ?? m.isDeleted) as boolean | undefined;
  return {
    messageId,
    senderUserId: (m.senderUserId ?? m.SenderUserID) as number,
    receiverUserId: (m.receiverUserId ?? m.ReceiverUserID) as number,
    messageText: (m.messageText ?? m.MessageText ?? '') as string,
    sentAt: (m.sentAt ?? m.SentAt ?? '') as string,
    deliveredAt: (m.deliveredAt ?? m.DeliveredAt ?? null) as string | null,
    readAt: (m.readAt ?? m.ReadAt ?? null) as string | null,
    senderName: (m.senderName ?? m.SenderName ?? '') as string,
    receiverName: (m.receiverName ?? m.ReceiverName ?? '') as string,
    attachmentFileId: attachmentFileId && !Number.isNaN(attachmentFileId) ? attachmentFileId : null,
    attachmentFileName: attachmentFileName ?? undefined,
    attachmentMimeType: attachmentMimeType ?? undefined,
    attachmentAccessToken: attachmentAccessToken ?? undefined,
    replyToMessageId: replyToMessageId != null && !Number.isNaN(Number(replyToMessageId)) ? Number(replyToMessageId) : undefined,
    replyToPreview: replyToPreview ?? undefined,
    replyToSenderName: replyToSenderName ?? undefined,
    reactions: Array.isArray(reactions) ? reactions : undefined,
    isStarred: isStarred === true,
    isPinned: isPinned === true,
    isDeleted: isDeleted === true,
  };
}

/** Normalize DB datetime string (e.g. "2025-02-11 14:30:00") for Date parsing */
function parseChatDate(iso: string | null | undefined): Date | null {
  if (iso == null || String(iso).trim() === '') return null;
  const s = String(iso).trim().replace(' ', 'T');
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatMessageTime(iso: string): string {
  const d = parseChatDate(iso);
  if (!d) return '—';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today.getTime() - msgDate.getTime()) / (24 * 60 * 60 * 1000));
  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 0) return timeStr;
  if (diffDays === 1) return `Yesterday ${timeStr}`;
  if (diffDays < 7) return d.toLocaleDateString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** Full date and time for message info popover */
function formatMessageInfoTime(iso: string | null | undefined): string {
  const d = parseChatDate(iso ?? '');
  if (!d) return '—';
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatListTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getDateLabel(iso: string, prevIso: string | null): string | null {
  const d = new Date(iso);
  const prev = prevIso ? new Date(prevIso) : null;
  if (!prev || prev.toDateString() !== d.toDateString()) {
    const now = new Date();
    const today = now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000).toDateString();
    if (d.toDateString() === today) return 'Today';
    if (d.toDateString() === yesterday) return 'Yesterday';
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
  }
  return null;
}

function PresenceDot({ status }: { status: PresenceStatus | undefined }) {
  const s = status ?? 'offline';
  const color = s === 'online' ? '#198754' : s === 'away' ? '#ffc107' : '#dc3545';
  const label = s === 'online' ? 'Online' : s === 'away' ? 'Away' : 'Offline';
  return (
    <span
      className="rounded-circle border border-2 border-white"
      style={{ width: 10, height: 10, backgroundColor: color, display: 'inline-block', flexShrink: 0 }}
      title={label}
      aria-label={label}
    />
  );
}

/** WhatsApp-style ticks: one = sent, two grey = delivered, two blue = read */
function MessageStatusTicks({ deliveredAt, readAt }: { deliveredAt: string | null; readAt: string | null }) {
  const color = readAt ? '#53bdeb' : deliveredAt ? '#8696a0' : '#8696a0';
  return (
    <span className="ms-1" style={{ color }} title={readAt ? 'Read' : deliveredAt ? 'Delivered' : 'Sent'}>
      {readAt ? (
        <span className="d-inline-flex align-items-baseline"><span style={{ transform: 'scale(0.85)' }}>✓✓</span></span>
      ) : deliveredAt ? (
        <span className="d-inline-flex align-items-baseline"><span style={{ transform: 'scale(0.85)' }}>✓✓</span></span>
      ) : (
        <span className="d-inline-flex align-items-baseline"><span style={{ transform: 'scale(0.85)' }}>✓</span></span>
      )}
    </span>
  );
}

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessageRow[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [listFilter, setListFilter] = useState<'all' | 'unread' | 'favourites'>('all');
  const [favouriteUserIds, setFavouriteUserIds] = useState<Set<number>>(new Set());
  const [unreadByUserId, setUnreadByUserId] = useState<Record<number, number>>({});
  const [inChatSearchOpen, setInChatSearchOpen] = useState(false);
  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [inChatSearchMatchIndex, setInChatSearchMatchIndex] = useState(0);
  const messageRowRefsMap = useRef<Map<number, HTMLDivElement | null>>(new Map());
  const [settings, setSettings] = useState(getChatSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [messageInfoId, setMessageInfoId] = useState<number | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'preview'>('idle');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [uploadQueue, setUploadQueue] = useState<ChatUploadItem[]>([]);
  const [replyingTo, setReplyingTo] = useState<ChatMessageRow | null>(null);
  const [messageMenuId, setMessageMenuId] = useState<number | null>(null);
  const [forwardMessageId, setForwardMessageId] = useState<number | null>(null);
  const [deleteConfirmMessageId, setDeleteConfirmMessageId] = useState<{ messageId: number; isSender: boolean } | null>(null);
  const [improveModal, setImproveModal] = useState<{ original: string; improved: string } | null>(null);
  const [improveLoading, setImproveLoading] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);
  const [aiModels, setAiModels] = useState<Array<{ serviceCode: string; displayName: string }>>([]);
  const [menuOpenUpward, setMenuOpenUpward] = useState(false);
  const messageMenuAnchorRef = useRef<HTMLDivElement | null>(null);
  const uploadAbortRef = useRef<Map<string, AbortController>>(new Map());
  const uploadStartedRef = useRef<Set<string>>(new Set());
  const [voicePreviewUrl, setVoicePreviewUrl] = useState<string>('');
  const [requestingMic, setRequestingMic] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingStartRef = useRef<number>(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const uploadingAttachment = uploadQueue.some((i) => i.status === 'uploading' || i.status === 'pending');

  useEffect(() => {
    if (messageInfoId == null) return;
    const close = () => setMessageInfoId(null);
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.chat-message-info-popover') && !t.closest('button[aria-label="Message info"]')) close();
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [messageInfoId]);

  useEffect(() => {
    if (messageMenuId == null) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.chat-message') && !t.closest('[aria-label="More"]')) setMessageMenuId(null);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [messageMenuId]);

  useLayoutEffect(() => {
    if (messageMenuId == null) return;
    const el = messageMenuAnchorRef.current;
    if (!el) {
      setMenuOpenUpward(false);
      return;
    }
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setMenuOpenUpward(spaceBelow < 260);
  }, [messageMenuId]);

  useEffect(() => {
    if (!showEmojiPicker) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.chat-emoji-picker') && !t.closest('button[aria-label="Insert emoji"]')) setShowEmojiPicker(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [showEmojiPicker]);

  const insertEmoji = useCallback((emoji: string) => {
    const ta = inputRef.current;
    setInputText((prev) => {
      if (ta) {
        const start = ta.selectionStart ?? prev.length;
        const end = ta.selectionEnd ?? prev.length;
        const before = prev.slice(0, start);
        const after = prev.slice(end);
        const next = before + emoji + after;
        setTimeout(() => {
          ta.focus();
          const newPos = start + emoji.length;
          ta.setSelectionRange(newPos, newPos);
        }, 0);
        return next;
      }
      return prev + emoji;
    });
  }, []);


  const { refetch: refetchUnread, clearReactionUnread, reactionUnreadByUserId } = useChatUnread();

  const loadConversations = useCallback(() => {
    api.get<{ success: boolean; data: ConversationRow[] }>('/api/chat/conversations')
      .then((res) => {
        const list = res.data ?? [];
        setConversations(list);
        setUnreadByUserId((prev) => {
          const next = { ...prev };
          list.forEach((c) => {
            const n = Number(c.unreadCount ?? 0);
            if (n > 0) next[c.userId] = Math.max(n, next[c.userId] ?? 0);
          });
          return next;
        });
        refetchUnread();
      })
      .catch(() => setConversations([]));
  }, [refetchUnread]);

  const loadUsers = useCallback(() => {
    api.get<{ success: boolean; data: UserOption[] }>('/api/chat/users')
      .then((res) => setUsers(res.data ?? []))
      .catch(() => setUsers([]));
  }, []);

  const loadAiModels = useCallback(() => {
    api.get<{ success: boolean; data: Array<{ serviceCode: string; displayName: string }> }>('/api/chat/ai-models')
      .then((res) => setAiModels(res.data ?? []))
      .catch(() => setAiModels([]));
  }, []);

  useEffect(() => {
    if (showSettings) loadAiModels();
  }, [showSettings, loadAiModels]);

  useEffect(() => {
    if (!user) return;
    loadConversations();
    loadUsers();
  }, [user, loadConversations, loadUsers]);

  // When opened from topbar chat dropdown with ?with=userId, select that user
  useEffect(() => {
    const withParam = searchParams.get('with');
    const uid = withParam ? parseInt(withParam, 10) : NaN;
    if (user && !Number.isNaN(uid) && uid > 0) {
      setSelectedUserId(uid);
      setMobileView('chat');
    }
  }, [user, searchParams]);

  const refetchMessages = useCallback(() => {
    if (!user || !selectedUserId) return;
    setLoadingMessages(true);
    api.get<{ success: boolean; data?: ChatMessageRow[] }>(`/api/chat/messages?with=${selectedUserId}`)
      .then((res) => {
        const raw = res as { data?: unknown[]; success?: boolean };
        const arr = Array.isArray(raw?.data) ? raw.data : (res.data ?? []);
        const list = arr.map((m) => normalizeMessageRow(m as Record<string, unknown>));
        // Merge with current state so messages added via socket are not lost if API response was in flight
        setMessages((prev) => {
          const byId = new Map<number, ChatMessageRow>();
          list.forEach((m) => byId.set(m.messageId, m));
          prev.forEach((m) => {
            if (!byId.has(m.messageId)) byId.set(m.messageId, m);
          });
          const merged = Array.from(byId.values()).sort(
            (a, b) => (parseChatDate(a.sentAt)?.getTime() ?? 0) - (parseChatDate(b.sentAt)?.getTime() ?? 0)
          );
          return merged;
        });
        api.post('/api/chat/mark-read', { withUserId: selectedUserId })
          .catch(() => {})
          .finally(() => refetchUnread());
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }, [user, selectedUserId, refetchUnread]);

  useEffect(() => {
    if (user?.userId != null) {
      setFavouriteUserIds(new Set(getChatFavourites(user.userId)));
    }
  }, [user?.userId]);

  // When conversation changes (e.g. from notification click or sidebar): clear old messages and load the selected one
  useEffect(() => {
    if (!user || !selectedUserId) {
      setMessages([]);
      return;
    }
    setSendError(null);
    setMessageInfoId(null);
    setMessages([]);
    setLoadingMessages(true);
    refetchMessages();
  }, [user, selectedUserId, refetchMessages]);

  useLayoutEffect(() => {
    if (messages.length === 0) return;
    const el = messagesAreaRef.current;
    if (!el) return;
    const setBottom = () => {
      el.scrollTop = el.scrollHeight;
    };
    setBottom();
    const raf = requestAnimationFrame(() => {
      setBottom();
      requestAnimationFrame(setBottom);
    });
    return () => cancelAnimationFrame(raf);
  }, [messages, loadingMessages]);

  useLayoutEffect(() => {
    if (!loadingMessages && selectedUserId && messages.length > 0) {
      inputRef.current?.focus();
    }
  }, [loadingMessages, selectedUserId, messages.length]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      mediaRecorderRef.current?.state === 'recording' && mediaRecorderRef.current?.stop();
      recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
      recordingStreamRef.current = null;
      mediaRecorderRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      inputRef.current?.focus();
      clearReactionUnread(selectedUserId);
      setUnreadByUserId((prev) => {
        if (prev[selectedUserId] == null) return prev;
        const next = { ...prev };
        delete next[selectedUserId];
        return next;
      });
    }
  }, [selectedUserId, clearReactionUnread]);

  const handleIncomingMessage = useCallback((payload: Record<string, unknown> & {
    senderUserId?: number;
    receiverUserId?: number;
    messageId?: number;
    senderName?: string;
    messageText?: string;
    sentAt?: string;
    attachmentFileId?: number;
    attachmentFileName?: string;
    attachmentMimeType?: string;
  }) => {
    try {
      // Normalize payload (server/socket may send camelCase or PascalCase)
      const senderUserId = Number(getByKey(payload, 'senderUserId', 'SenderUserID') ?? payload.senderUserId ?? 0);
      const receiverUserId = Number(getByKey(payload, 'receiverUserId', 'ReceiverUserID') ?? payload.receiverUserId ?? 0);
      const messageId = Number(getByKey(payload, 'messageId', 'MessageID') ?? payload.messageId ?? 0);
      const senderName = String(getByKey(payload, 'senderName', 'SenderName') ?? payload.senderName ?? '');
      const messageText = String(getByKey(payload, 'messageText', 'MessageText') ?? payload.messageText ?? '');
      const sentAt = String(getByKey(payload, 'sentAt', 'SentAt') ?? payload.sentAt ?? '');
      const normalizedPayload = {
        senderUserId,
        receiverUserId,
        messageId,
        senderName,
        messageText,
        sentAt,
        attachmentFileId: payload.attachmentFileId ?? getByKey(payload, 'attachmentFileId', 'AttachmentFileID'),
        attachmentFileName: payload.attachmentFileName ?? getByKey(payload, 'attachmentFileName', 'AttachmentFileName'),
        attachmentMimeType: payload.attachmentMimeType ?? getByKey(payload, 'attachmentMimeType', 'AttachmentMimeType'),
      };

      const isForMe = receiverUserId === user?.userId;
      const isForCurrentConversation =
        selectedUserId !== null &&
        (senderUserId === selectedUserId || receiverUserId === selectedUserId);
      const viewingSender = isForCurrentConversation && senderUserId === selectedUserId;

      if (isForCurrentConversation && messageId > 0) {
        const fullRow = normalizeMessageRow({
          ...normalizedPayload,
          deliveredAt: null,
          readAt: null,
          receiverName: '',
        });
        setMessages((prev) => {
          if (prev.some((m) => m.messageId === fullRow.messageId)) return prev;
          return [...prev, fullRow];
        });
        const isAttachmentWithoutData =
          (messageText === '[Attachment]' || messageText === '') &&
          !(fullRow.attachmentFileId != null && fullRow.attachmentFileId > 0);
        if (isAttachmentWithoutData && selectedUserId != null) {
          setTimeout(() => refetchMessages(), 400);
        }
      }

      if (isForMe && senderUserId !== user?.userId) {
        api.post('/api/chat/mark-delivered', { withUserId: senderUserId, messageIds: [messageId] }).catch(() => {});
        if (viewingSender) {
          api.post('/api/chat/mark-read', { withUserId: senderUserId, messageIds: [messageId] })
            .catch(() => {})
            .finally(() => refetchUnread());
          const nowIso = new Date().toISOString().slice(0, 19).replace('T', ' ');
          setMessages((prev) =>
            prev.map((m) =>
              m.messageId === messageId ? { ...m, deliveredAt: nowIso, readAt: nowIso } : m
            )
          );
        }
      }

      if (isForMe && senderUserId !== user?.userId) {
        const shouldCountUnread = document.hidden || selectedUserId !== senderUserId;
        if (shouldCountUnread) {
          setUnreadByUserId((prev) => ({
            ...prev,
            [senderUserId]: (prev[senderUserId] ?? 0) + 1,
          }));
        }
        const s = getChatSettings();
        if (s.soundEnabled) playChatSound();
        if (s.notifyEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted' && document.hidden) {
          try {
            const n = new Notification(senderName, { body: messageText, tag: `chat-${senderUserId}` });
            n.onclick = () => {
              window.focus();
              navigate(`/chat?with=${senderUserId}`, { replace: false });
            };
          } catch {
            // ignore
          }
        }
      }

      if (senderUserId !== user?.userId) loadConversations();
    } catch (err) {
      console.warn('Chat handleIncomingMessage error:', err);
    }
  }, [selectedUserId, user?.userId, loadConversations, refetchUnread, refetchMessages, navigate]);

  const handleMessagesDelivered = useCallback((payload: { messageIds: number[]; deliveredAt: string }) => {
    const ids = new Set((payload.messageIds || []).map((id) => Number(id)));
    setMessages((prev) =>
      prev.map((m) => (ids.has(Number(m.messageId)) ? { ...m, deliveredAt: payload.deliveredAt } : m))
    );
  }, []);
  const handleMessagesRead = useCallback((payload: { messageIds: number[]; readAt: string }) => {
    const ids = new Set((payload.messageIds || []).map((id) => Number(id)));
    setMessages((prev) =>
      prev.map((m) => (ids.has(Number(m.messageId)) ? { ...m, readAt: payload.readAt } : m))
    );
  }, []);

  const {
    presence,
    registerMessageHandler,
    registerDeliveredHandler,
    registerReadHandler,
    registerReactionHandler,
  } = useChatSocketContext();

  const [reactionToasts, setReactionToasts] = useState<{ id: number; reactorName: string; emoji: string }[]>([]);
  const reactionToastIdRef = useRef(0);

  const handleIncomingReaction = useCallback(
    (payload: ChatReactionPayload) => {
      if (!user?.userId) return;
      const isForCurrentChat =
        selectedUserId !== null &&
        (payload.senderUserId === selectedUserId || payload.receiverUserId === selectedUserId);
      if (isForCurrentChat) {
        setMessages((prev) =>
          prev.map((m) =>
            m.messageId === payload.messageId ? { ...m, reactions: payload.reactions } : m
          )
        );
      }
      if (payload.added && (payload.receiverUserId === user.userId || payload.senderUserId === user.userId)) {
        const isViewingThatChat =
          selectedUserId === payload.senderUserId || selectedUserId === payload.receiverUserId;
        if (!isViewingThatChat) refetchUnread();
        const id = ++reactionToastIdRef.current;
        setReactionToasts((prev) => [...prev, { id, reactorName: payload.reactorName, emoji: payload.reactions?.[0]?.emoji ?? '👍' }]);
        setTimeout(() => setReactionToasts((t) => t.filter((x) => x.id !== id)), 4000);
      }
    },
    [user?.userId, selectedUserId, refetchUnread]
  );

  useEffect(() => {
    if (!user) return;
    const unregisterMessage = registerMessageHandler(handleIncomingMessage);
    const unregisterDelivered = registerDeliveredHandler(handleMessagesDelivered);
    const unregisterRead = registerReadHandler(handleMessagesRead);
    const unregisterReaction = registerReactionHandler(handleIncomingReaction);
    return () => {
      unregisterMessage();
      unregisterDelivered();
      unregisterRead();
      unregisterReaction();
    };
  }, [user, handleIncomingMessage, handleMessagesDelivered, handleMessagesRead, handleIncomingReaction, registerMessageHandler, registerDeliveredHandler, registerReadHandler, registerReactionHandler]);

  const sendMessage = useCallback((opts?: { text?: string; attachmentFileId?: number; replyToMessageId?: number }) => {
    const text = (opts?.text ?? inputText).trim();
    const attachmentFileId = opts?.attachmentFileId;
    const replyToMessageId = opts?.replyToMessageId ?? replyingTo?.messageId;
    if (!selectedUserId || sending) return;
    if (!text && (attachmentFileId == null || attachmentFileId === 0)) return;
    setSendError(null);
    setSending(true);
    api.post<{ success: boolean; data: ChatMessageRow }>('/api/chat/send', {
      toUserId: selectedUserId,
      text: text || (attachmentFileId ? '[Attachment]' : ''),
      ...(attachmentFileId != null && attachmentFileId > 0 ? { attachmentFileId } : {}),
      ...(replyToMessageId != null && replyToMessageId > 0 ? { replyToMessageId } : {}),
    })
      .then((res) => {
        const raw = res.data;
        if (raw) setMessages((prev) => [...prev, normalizeMessageRow(raw as unknown as Record<string, unknown>)]);
        setInputText('');
        setReplyingTo(null);
        setRecordedBlob(null);
        setRecordingState('idle');
        loadConversations();
      })
      .catch((err) => setSendError(err instanceof Error ? err.message : 'Failed to send message'))
      .finally(() => setSending(false));
  }, [selectedUserId, inputText, sending, loadConversations, replyingTo]);

  const openImproveModal = useCallback(() => {
    const text = inputText.trim();
    if (!text) return;
    setImproveError(null);
    setImproveModal({ original: text, improved: '' });
    setImproveLoading(true);
    const serviceCode = settings.aiServiceCode?.trim() || undefined;
    api.post<{ success: boolean; data: { improved: string } }>('/api/chat/improve', { text, serviceCode })
      .then((res) => {
        const improved = (res as { data?: { improved?: string } }).data?.improved ?? '';
        setImproveModal((m) => m ? { ...m, improved } : null);
      })
      .catch((err) => setImproveError(err instanceof Error ? err.message : 'Failed to improve'))
      .finally(() => setImproveLoading(false));
  }, [inputText, settings.aiServiceCode]);

  const improveGetMore = useCallback(() => {
    const text = improveModal?.original ?? '';
    if (!text) return;
    setImproveError(null);
    setImproveLoading(true);
    const variant = improveModal?.improved ? 'friendly' : 'professional';
    const serviceCode = settings.aiServiceCode?.trim() || undefined;
    api.post<{ success: boolean; data: { improved: string } }>('/api/chat/improve', { text, variant, serviceCode })
      .then((res) => {
        const improved = (res as { data?: { improved?: string } }).data?.improved ?? '';
        setImproveModal((m) => m ? { ...m, improved } : null);
      })
      .catch((err) => setImproveError(err instanceof Error ? err.message : 'Failed to improve'))
      .finally(() => setImproveLoading(false));
  }, [improveModal, settings.aiServiceCode]);

  const applyImprove = useCallback((improved: string) => {
    setInputText(improved);
    setImproveModal(null);
    setImproveError(null);
    inputRef.current?.focus();
  }, []);

  const sendImproved = useCallback((improved: string) => {
    sendMessage({ text: improved, replyToMessageId: replyingTo?.messageId });
    setImproveModal(null);
    setImproveError(null);
  }, [sendMessage, replyingTo?.messageId]);

  const startRecording = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (recordingState !== 'idle' || requestingMic) return;
    setSendError(null);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      const isSecure = typeof window !== 'undefined' && window.isSecureContext;
      const hint = !isSecure && typeof window !== 'undefined'
        ? `Open this page via HTTPS or http://localhost (e.g. http://localhost:${window.location.port || '3000'}) to use the microphone.`
        : 'Use HTTPS or http://localhost and a modern browser (Chrome, Firefox, Edge).';
      setSendError(`Microphone not available. ${hint}`);
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setSendError('Voice recording not supported in this browser. Try Chrome or Firefox.');
      return;
    }
    setRequestingMic(true);
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        setRequestingMic(false);
        recordingStreamRef.current = stream;
        recordingStartRef.current = Date.now();
        setRecordedDuration(0);
        const timer = setInterval(() => setRecordedDuration(Math.floor((Date.now() - recordingStartRef.current) / 1000)), 1000);
        recordingTimerRef.current = timer;
        const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mime });
          setRecordedBlob(blob);
          setRecordingState('preview');
        };
        recorder.start(100);
        setRecordingState('recording');
      })
      .catch((err) => {
        setRequestingMic(false);
        const msg = err instanceof Error ? err.message : String(err);
        setSendError(msg || 'Microphone access denied. Allow mic in browser and try again.');
        console.error('Voice recording error:', err);
      });
  }, [recordingState, requestingMic]);

  const stopRecording = useCallback(() => {
    if (recordingState !== 'recording') return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    recordingStreamRef.current?.getTracks().forEach((t) => t.stop());
    recordingStreamRef.current = null;
    mediaRecorderRef.current = null;
  }, [recordingState]);

  const cancelRecording = useCallback(() => {
    setRecordedBlob(null);
    setRecordingState('idle');
    setRecordedDuration(0);
  }, []);

  useEffect(() => {
    if (recordingState === 'preview' && recordedBlob) {
      const url = URL.createObjectURL(recordedBlob);
      setVoicePreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
        setVoicePreviewUrl('');
      };
    }
    setVoicePreviewUrl('');
    return undefined;
  }, [recordingState, recordedBlob]);

  const sendVoiceMessage = useCallback(() => {
    if (!recordedBlob || !selectedUserId || sending) return;
    setSendError(null);
    setSending(true);
    const form = new FormData();
    const ext = recordedBlob.type.includes('webm') ? 'webm' : 'ogg';
    form.append('file', recordedBlob, `voice-${Date.now()}.${ext}`);
    api.upload<{ success: boolean; data: { fileId: number } }>('/api/chat/upload', form)
      .then((res) => {
        const fileId = res.data?.fileId;
        if (fileId) sendMessage({ text: '', attachmentFileId: fileId });
        else setSendError('Upload failed');
      })
      .catch((err) => setSendError(err instanceof Error ? err.message : 'Upload failed'))
      .finally(() => setSending(false));
  }, [recordedBlob, selectedUserId, sending, sendMessage]);

  const updateUploadItem = useCallback((id: string, patch: Partial<ChatUploadItem>) => {
    setUploadQueue((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, []);

  const removeUploadItem = useCallback((id: string) => {
    uploadAbortRef.current.delete(id);
    uploadStartedRef.current.delete(id);
    setUploadQueue((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const cancelUpload = useCallback((id: string) => {
    uploadAbortRef.current.get(id)?.abort();
    removeUploadItem(id);
  }, [removeUploadItem]);

  const startOneUpload = useCallback(
    (item: ChatUploadItem) => {
      if (!selectedUserId || sending) return;
      const { id, file } = item;
      if (uploadStartedRef.current.has(id)) return;
      uploadStartedRef.current.add(id);
      const controller = new AbortController();
      uploadAbortRef.current.set(id, controller);
      updateUploadItem(id, { status: 'uploading', progress: 0 });

      const form = new FormData();
      form.append('file', file);
      setSendError(null);

      api
        .uploadWithProgress<{ success?: boolean; data?: { fileId?: number }; fileId?: number }>(
          '/api/chat/upload',
          form,
          {
            onProgress: (percent) => updateUploadItem(id, { progress: percent }),
            signal: controller.signal,
          }
        )
        .then((res) => {
          const data = (res as { data?: { fileId?: number }; fileId?: number }).data ?? res;
          const fileId =
            typeof data === 'object' && data !== null && 'fileId' in data
              ? Number((data as { fileId?: number }).fileId)
              : Number((res as { fileId?: number }).fileId);
          if (fileId && !Number.isNaN(fileId)) {
            sendMessage({ text: '', attachmentFileId: fileId });
            updateUploadItem(id, { status: 'done', progress: 100 });
            setTimeout(() => removeUploadItem(id), 1400);
          } else {
            updateUploadItem(id, { status: 'error', error: 'No file ID returned' });
          }
        })
        .catch((err) => {
          if ((err as Error)?.name === 'AbortError') return;
          const msg = err instanceof Error ? err.message : String(err);
          updateUploadItem(id, { status: 'error', error: msg || 'Upload failed' });
          setSendError(msg || 'Upload failed. Check file type and size.');
        });
    },
    [selectedUserId, sending, sendMessage, updateUploadItem, removeUploadItem]
  );

  const enqueueFiles = useCallback(
    (files: FileList | File[]) => {
      if (!selectedUserId || sending) return;
      const list = Array.from(files);
      if (list.length === 0) return;
      const newItems: ChatUploadItem[] = list.map((file) => ({
        id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        progress: 0,
        status: 'pending',
      }));
      setUploadQueue((prev) => [...prev, ...newItems]);
    },
    [selectedUserId, sending]
  );

  useEffect(() => {
    const pending = uploadQueue.filter((i) => i.status === 'pending' && !uploadStartedRef.current.has(i.id));
    pending.forEach((item) => startOneUpload(item));
  }, [uploadQueue, startOneUpload]);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files?.length) enqueueFiles(files);
      e.target.value = '';
    },
    [enqueueFiles]
  );

  const handleCameraCapture = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) enqueueFiles([file]);
      e.target.value = '';
    },
    [enqueueFiles]
  );

  // Use token when present (unguessable); fallback to fileId for legacy messages. Relative path so cookies are sent.
  const attachmentUrl = (m: { attachmentFileId?: number | null; attachmentAccessToken?: string | null }) =>
    `/api/chat/attachment/${m.attachmentAccessToken || m.attachmentFileId}`;

  const fetchMessages = useCallback(() => {
    if (selectedUserId == null) return;
    api.get<{ success: boolean; data?: ChatMessageRow[] }>(`/api/chat/messages?with=${selectedUserId}`).then((res) => {
      const list = Array.isArray(res.data) ? res.data : [];
      setMessages(list.map((r) => normalizeMessageRow(r as unknown as Record<string, unknown>)));
    }).catch(() => {});
  }, [selectedUserId]);

  const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
  const handleReply = useCallback((msg: ChatMessageRow) => {
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
    api.post(`/api/chat/message/${forwardMessageId}/forward`, { toUserId }).then(() => { fetchMessages(); loadConversations(); setForwardMessageId(null); }).catch(() => {});
  }, [forwardMessageId, fetchMessages, loadConversations]);
  const handleDelete = useCallback((messageId: number, forEveryone: boolean) => {
    api.post(`/api/chat/message/${messageId}/delete`, { forEveryone }).then(() => { fetchMessages(); setDeleteConfirmMessageId(null); }).catch(() => {});
    setMessageMenuId(null);
  }, [fetchMessages]);
  const openDeleteConfirm = useCallback((msg: ChatMessageRow) => {
    setDeleteConfirmMessageId({ messageId: msg.messageId, isSender: msg.senderUserId === user?.userId });
    setMessageMenuId(null);
  }, [user?.userId]);
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
  const handleDownload = useCallback((m: ChatMessageRow) => {
    if (!m.attachmentFileId) return;
    const url = attachmentUrl(m);
    const a = document.createElement('a');
    a.href = url;
    a.download = m.attachmentFileName || 'attachment';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setMessageMenuId(null);
  }, []);

  const selectedConversation = selectedUserId != null
    ? conversations.find((c) => c.userId === selectedUserId)
    : null;
  const selectedUserFromList = selectedUserId != null ? users.find((u) => u.userId === selectedUserId) : null;
  const selectedName = selectedConversation?.name ?? selectedUserFromList?.name ?? 'User';
  const selectedEmail = selectedConversation?.email ?? selectedUserFromList?.email ?? '';

  const searchLower = sidebarSearch.trim().toLowerCase();
  const bySearch = searchLower
    ? (list: typeof conversations) =>
        list.filter((c) => c.name.toLowerCase().includes(searchLower) || (c.email && c.email.toLowerCase().includes(searchLower)) || (c.lastMessagePreview && c.lastMessagePreview.toLowerCase().includes(searchLower)))
    : (list: typeof conversations) => list;
  const byFilter = (() => {
    if (listFilter === 'unread') {
      return (list: typeof conversations) =>
        list.filter((c) => (unreadByUserId[c.userId] ?? 0) > 0 || (reactionUnreadByUserId[c.userId] ?? 0) > 0);
    }
    if (listFilter === 'favourites') {
      return (list: typeof conversations) => list.filter((c) => favouriteUserIds.has(c.userId));
    }
    return (list: typeof conversations) => list;
  })();
  const filteredConversations = bySearch(byFilter(conversations));
  const otherUsers = users.filter((u) => u.userId !== user?.userId);
  const filteredUsers = searchLower
    ? otherUsers.filter((u) => u.name.toLowerCase().includes(searchLower) || (u.email && u.email.toLowerCase().includes(searchLower)))
    : otherUsers;
  const usersWithoutConversation = listFilter === 'all' ? filteredUsers.filter((u) => !conversations.some((c) => c.userId === u.userId)) : [];
  const handleToggleFavourite = useCallback((partnerId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user?.userId) return;
    const nowStarred = toggleChatFavourite(user.userId, partnerId);
    setFavouriteUserIds((prev) => {
      const next = new Set(prev);
      if (nowStarred) next.add(partnerId);
      else next.delete(partnerId);
      return next;
    });
  }, [user?.userId]);

  const handleSelectUser = useCallback((userId: number) => {
    setSelectedUserId(userId);
    setSendError(null);
    setMobileView('chat');
  }, []);

  const handleBackToList = useCallback(() => {
    setMobileView('list');
  }, []);

  const inChatSearchLower = inChatSearchQuery.trim().toLowerCase();
  const inChatMatchIndexes = inChatSearchLower
    ? messages
        .map((m, i) => {
          const text = [m.messageText, m.replyToPreview, m.attachmentFileName].filter(Boolean).join(' ').toLowerCase();
          return text.includes(inChatSearchLower) ? i : -1;
        })
        .filter((i) => i >= 0)
    : [];
  const inChatMatchCount = inChatMatchIndexes.length;
  const inChatCurrentMatchIndex = inChatMatchCount > 0 ? Math.min(inChatSearchMatchIndex, inChatMatchCount - 1) : -1;
  const inChatCurrentMessageIndex = inChatCurrentMatchIndex >= 0 ? inChatMatchIndexes[inChatCurrentMatchIndex] : -1;
  const scrollToSearchMatch = useCallback((index: number) => {
    if (index < 0) return;
    const messageId = messages[index]?.messageId;
    if (messageId == null) return;
    const el = messageRowRefsMap.current.get(messageId);
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [messages]);
  const handleInChatSearchPrev = useCallback(() => {
    if (inChatMatchCount <= 0) return;
    const next = inChatCurrentMatchIndex <= 0 ? inChatMatchCount - 1 : inChatCurrentMatchIndex - 1;
    setInChatSearchMatchIndex(next);
    scrollToSearchMatch(inChatMatchIndexes[next]);
  }, [inChatMatchCount, inChatCurrentMatchIndex, inChatMatchIndexes, scrollToSearchMatch]);
  const handleInChatSearchNext = useCallback(() => {
    if (inChatMatchCount <= 0) return;
    const next = inChatCurrentMatchIndex >= inChatMatchCount - 1 ? 0 : inChatCurrentMatchIndex + 1;
    setInChatSearchMatchIndex(next);
    scrollToSearchMatch(inChatMatchIndexes[next]);
  }, [inChatMatchCount, inChatCurrentMatchIndex, inChatMatchIndexes, scrollToSearchMatch]);
  const openInChatSearch = useCallback(() => {
    setInChatSearchOpen(true);
    setInChatSearchQuery('');
    setInChatSearchMatchIndex(0);
  }, []);
  const closeInChatSearch = useCallback(() => {
    setInChatSearchOpen(false);
    setInChatSearchQuery('');
  }, []);

  useLayoutEffect(() => {
    if (inChatSearchOpen && inChatCurrentMessageIndex >= 0 && messages[inChatCurrentMessageIndex]) {
      const msg = messages[inChatCurrentMessageIndex];
      const el = messageRowRefsMap.current.get(msg.messageId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [inChatSearchOpen, inChatCurrentMessageIndex, messages]);

  function highlightSearchText(text: string, query: string): React.ReactNode {
    if (!query.trim()) return text;
    const lower = text.toLowerCase();
    const q = query.trim().toLowerCase();
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let idx = lower.indexOf(q);
    while (idx !== -1) {
      parts.push(text.slice(lastIndex, idx));
      parts.push(<mark key={idx} className="bg-warning bg-opacity-50 rounded px-0">{text.slice(idx, idx + q.length)}</mark>);
      lastIndex = idx + q.length;
      idx = lower.indexOf(q, lastIndex);
    }
    parts.push(text.slice(lastIndex));
    return parts;
  }

  // Guard: avoid rendering with null user (e.g. brief auth race) and avoid crash on user! below
  if (!user) {
    return (
      <div className="container-fluid py-5">
        <div className="text-center text-muted">Loading...</div>
      </div>
    );
  }

  return (
    <div className="container-fluid chat-page-wrapper">
      <div
        className={`outlook-box chat-responsive ${mobileView === 'chat' ? 'chat-mobile-show-chat' : 'chat-mobile-show-list'}`}
      >
        {/* ═══════ Left sidebar – user/conversation list ═══════ */}
        <div className="chat-sidebar outlook-left-menu outlook-left-menu-lg flex-shrink-0">
          <div className="card h-100 mb-0 border-end-0 rounded-end-0">
            <div className="card-header p-3 border-light card-bg d-block flex-shrink-0">
              <div className="d-flex gap-2 align-items-center">
                <div className="app-search flex-grow-1 position-relative">
                  <input
                    type="search"
                    className="form-control bg-light-subtle border-light py-2"
                    placeholder="Search chats and contacts..."
                    value={sidebarSearch}
                    onChange={(e) => setSidebarSearch(e.target.value)}
                    aria-label="Search all chats"
                  />
                  <i className="ti ti-search app-search-icon text-muted" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
                </div>
                <button
                  type="button"
                  className="btn btn-dark btn-icon"
                  onClick={() => setShowSettings((s) => !s)}
                  title="Chat settings"
                  aria-label="Chat settings"
                >
                  <i className="ti ti-settings fs-xl" />
                </button>
              </div>
              <div className="d-flex gap-1 mt-2 flex-wrap">
                {(['all', 'unread', 'favourites'] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    className={`btn btn-sm ${listFilter === key ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setListFilter(key)}
                  >
                    {key === 'all' && <><i className="ti ti-message-circle me-1" /> All</>}
                    {key === 'unread' && <><i className="ti ti-mail me-1" /> Unread</>}
                    {key === 'favourites' && <><i className="ti ti-star me-1" /> Favourites</>}
                  </button>
                ))}
              </div>
              {showSettings && (
                <div className="mt-2 p-2 border rounded bg-white shadow-sm">
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="chat-sound"
                      checked={settings.soundEnabled}
                      onChange={(e) => {
                        setChatSettings({ soundEnabled: e.target.checked });
                        setSettings((s) => ({ ...s, soundEnabled: e.target.checked }));
                      }}
                    />
                    <label className="form-check-label small" htmlFor="chat-sound">Play sound on new message</label>
                  </div>
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="chat-notify"
                      checked={settings.notifyEnabled}
                      onChange={async (e) => {
                        const v = e.target.checked;
                        if (v && typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission();
                        setChatSettings({ notifyEnabled: v });
                        setSettings((s) => ({ ...s, notifyEnabled: v }));
                      }}
                    />
                    <label className="form-check-label small" htmlFor="chat-notify">Browser notifications</label>
                  </div>
                  <div className="mt-2">
                    <label className="form-label small mb-1">AI model for Improve</label>
                    <select
                      className="form-select form-select-sm"
                      value={settings.aiServiceCode}
                      onChange={(e) => {
                        const v = e.target.value;
                        setChatSettings({ aiServiceCode: v });
                        setSettings((s) => ({ ...s, aiServiceCode: v }));
                      }}
                    >
                      <option value="">Default (first available)</option>
                      {aiModels.map((m) => (
                        <option key={m.serviceCode} value={m.serviceCode}>
                          {m.displayName || m.serviceCode}
                        </option>
                      ))}
                    </select>
                    <small className="text-muted">Select which AI to use for the Improve button. Configure models in Settings &gt; AI Config.</small>
                  </div>
                </div>
              )}
            </div>
            <div className="card-body p-2 overflow-auto flex-grow-1" style={{ minHeight: 0 }}>
              <div className="list-group list-group-flush chat-list">
                {filteredConversations.map((c) => (
                  <button
                    key={c.userId}
                    type="button"
                    className={`list-group-item list-group-item-action d-flex gap-2 justify-content-between text-start ${selectedUserId === c.userId ? 'active' : ''}`}
                    onClick={() => handleSelectUser(c.userId)}
                  >
                    <span className="d-flex justify-content-start align-items-center gap-2 overflow-hidden">
                      <span className="avatar avatar-sm flex-shrink-0 position-relative">
                        <UserAvatar userId={c.userId} name={c.name} size={32} />
                        <span className="position-absolute bottom-0 end-0"><PresenceDot status={presence[Number(c.userId)]} /></span>
                      </span>
                      <span className="overflow-hidden">
                        <span className="text-nowrap fw-semibold fs-base mb-0 lh-base d-block text-truncate">{c.name}</span>
                        <span className="text-muted d-block fs-xs mb-0 text-truncate">
                          {c.lastMessagePreview || c.email || '—'}
                        </span>
                      </span>
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 flex-shrink-0 text-warning"
                        onClick={(e) => handleToggleFavourite(c.userId, e)}
                        title={favouriteUserIds.has(c.userId) ? 'Remove from favourites' : 'Add to favourites'}
                        aria-label={favouriteUserIds.has(c.userId) ? 'Remove from favourites' : 'Add to favourites'}
                      >
                        <i className={favouriteUserIds.has(c.userId) ? 'ti ti-star-filled' : 'ti ti-star'} />
                      </button>
                    </span>
                    <span className="d-flex flex-column gap-1 justify-content-center flex-shrink-0 align-items-end">
                      {c.lastMessageAt && <span className="text-muted fs-xs">{formatListTime(c.lastMessageAt)}</span>}
                      {(unreadByUserId[c.userId] ?? 0) > 0 && (
                        <span className="badge text-bg-primary fs-xxs">{unreadByUserId[c.userId]}</span>
                      )}
                      {(reactionUnreadByUserId[c.userId] ?? 0) > 0 && (
                        <span className="text-primary small" style={{ fontSize: '0.7rem' }}>
                          {(reactionUnreadByUserId[c.userId] ?? 0) === 1 ? '1 reaction' : `${reactionUnreadByUserId[c.userId]} reactions`}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
                {usersWithoutConversation.map((u) => (
                  <button
                    key={u.userId}
                    type="button"
                    className={`list-group-item list-group-item-action d-flex gap-2 justify-content-between text-start ${selectedUserId === u.userId ? 'active' : ''}`}
                    onClick={() => handleSelectUser(u.userId)}
                  >
                    <span className="d-flex justify-content-start align-items-center gap-2 overflow-hidden">
                      <span className="avatar avatar-sm flex-shrink-0">
                        <UserAvatar userId={u.userId} name={u.name} size={32} />
                      </span>
                      <span className="overflow-hidden">
                        <span className="text-nowrap fw-semibold fs-base mb-0 lh-base d-block text-truncate">{u.name}</span>
                        <span className="text-muted d-block fs-xs mb-0 text-truncate">{u.email || 'Start chat'}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
              {filteredConversations.length === 0 && usersWithoutConversation.length === 0 && (
                <div className="p-3 text-center text-muted small">
                  {sidebarSearch ? 'No matches.' : listFilter === 'unread' ? 'No unread chats.' : listFilter === 'favourites' ? 'No favourite chats. Star a chat to add it here.' : 'No users to chat with.'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ═══════ Main chat area – pure flexbox: header → messages (scroll) → footer ═══════ */}
        <div className="chat-main-card card h-100 mb-0 rounded-start-0 flex-grow-1 d-flex flex-column min-w-0 overflow-hidden position-relative">
          {selectedUserId ? (
            <>
              {/* ── Chat header ── */}
              <div className="card-header card-bg d-flex align-items-center gap-2 flex-shrink-0 chat-card-header">
                <div className="d-lg-none d-inline-flex flex-shrink-0">
                  <button
                    className="btn btn-default btn-icon"
                    type="button"
                    onClick={handleBackToList}
                    aria-label="Back to chat list"
                  >
                    <i className="ti ti-arrow-left fs-lg" />
                  </button>
                </div>
                <UserAvatar userId={selectedUserId} name={selectedName} size={36} className="d-none d-sm-inline-flex flex-shrink-0" />
                <div className="flex-grow-1 min-w-0 overflow-hidden">
                  <h5 className="mb-0 lh-tight fs-6 text-truncate" title={selectedName}>
                    <span className="text-dark">{selectedName}</span>
                  </h5>
                  <p className="mb-0 lh-tight text-muted small text-truncate">
                    {presence[Number(selectedUserId)] === 'online' && <span className="ti ti-circle-filled text-success me-1" />}
                    {presence[Number(selectedUserId)] === 'online' ? 'Active' : presence[Number(selectedUserId)] === 'away' ? 'Away' : 'Offline'}
                  </p>
                </div>
                <div className="d-flex align-items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    className="btn btn-default btn-icon"
                    onClick={openInChatSearch}
                    title="Search in conversation"
                    aria-label="Search in conversation"
                  >
                    <i className="ti ti-search fs-lg" />
                  </button>
                  <div className="dropdown">
                    <button type="button" className="btn btn-default btn-icon" data-bs-toggle="dropdown" aria-expanded="false" title="More">
                      <i className="ti ti-dots-vertical fs-lg" />
                    </button>
                    <ul className="dropdown-menu dropdown-menu-end">
                      <li><span className="dropdown-item-text small text-muted">{selectedEmail}</span></li>
                    </ul>
                  </div>
                </div>
              </div>

              {inChatSearchOpen && (
                <div className="chat-inchat-search d-flex align-items-center gap-2 px-3 py-2 bg-body-secondary border-bottom flex-shrink-0">
                  <span className="text-muted" aria-hidden><i className="ti ti-search" /></span>
                  <input
                    type="search"
                    className="form-control form-control-sm flex-grow-1"
                    placeholder="Search in this chat..."
                    value={inChatSearchQuery}
                    onChange={(e) => { setInChatSearchQuery(e.target.value); setInChatSearchMatchIndex(0); }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') closeInChatSearch();
                      if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) handleInChatSearchPrev(); else handleInChatSearchNext(); }
                    }}
                    autoFocus
                    aria-label="Search in conversation"
                  />
                  {inChatSearchLower && (
                    <span className="text-muted small text-nowrap">
                      {inChatMatchCount > 0 ? `${inChatCurrentMatchIndex + 1} of ${inChatMatchCount}` : 'No results'}
                    </span>
                  )}
                  <div className="d-flex gap-1">
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={handleInChatSearchPrev}
                      disabled={inChatMatchCount <= 0}
                      title="Previous match"
                      aria-label="Previous match"
                    >
                      <i className="ti ti-chevron-up" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={handleInChatSearchNext}
                      disabled={inChatMatchCount <= 0}
                      title="Next match"
                      aria-label="Next match"
                    >
                      <i className="ti ti-chevron-down" />
                    </button>
                  </div>
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={closeInChatSearch} title="Close search" aria-label="Close search">
                    <i className="ti ti-x" />
                  </button>
                </div>
              )}

              {/* ── Reaction toasts (someone reacted when you were on another view) ── */}
              {reactionToasts.length > 0 && (
                <div className="position-absolute top-0 start-0 end-0 d-flex flex-column align-items-center gap-1 pt-2 px-2" style={{ zIndex: 15, pointerEvents: 'none' }}>
                  {reactionToasts.map((t) => (
                    <div key={t.id} className="shadow-sm bg-white border rounded-pill px-3 py-2 d-inline-flex align-items-center gap-2" style={{ fontSize: '0.9rem' }}>
                      <span style={{ fontSize: '1.1rem' }}>{t.emoji}</span>
                      <span><strong>{t.reactorName}</strong> reacted to your message</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Messages area (flex-grow, scrollable, fills remaining space) ── */}
              <div ref={messagesAreaRef} className="chat-messages-area flex-grow-1 overflow-auto px-3 py-2 position-relative" style={{ minHeight: 0 }}>
                {loadingMessages ? (
                  <div className="d-flex align-items-center justify-content-center py-5">
                    <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading…</span></div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="d-flex flex-column align-items-center justify-content-center py-5 text-muted">
                    <span className="fs-1 mb-2 opacity-50">💬</span>
                    <p className="mb-0">No messages yet. Say hello!</p>
                  </div>
                ) : (
                  <>
                    {!inChatSearchLower && (() => {
                      const pinnedMessage = messages.find((m) => m.isPinned);
                      if (!pinnedMessage) return null;
                      const preview = pinnedMessage.messageText?.trim() || (pinnedMessage.attachmentFileId ? (pinnedMessage.attachmentFileName || 'Attachment') : '');
                      return (
                        <div
                          className="d-flex align-items-center gap-2 p-2 rounded mb-2 bg-body-secondary border border-opacity-25"
                          style={{ flexShrink: 0 }}
                        >
                          <i className="ti ti-pin-filled text-primary flex-shrink-0" style={{ fontSize: '1.1rem' }} />
                          <div className="min-w-0 flex-grow-1">
                            <div className="small fw-semibold text-body-secondary">Pinned message</div>
                            <div className="small text-truncate" title={preview}>{preview || '—'}</div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary flex-shrink-0"
                            onClick={() => {
                              const el = messageRowRefsMap.current.get(pinnedMessage.messageId);
                              el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }}
                            title="Go to message"
                          >
                            <i className="ti ti-arrow-down" />
                          </button>
                        </div>
                      );
                    })()}
                    {(inChatSearchLower ? messages.filter((m) => [m.messageText, m.replyToPreview, m.attachmentFileName].filter(Boolean).join(' ').toLowerCase().includes(inChatSearchLower)) : messages).map((m) => {
                      const originalIndex = messages.findIndex((x) => x.messageId === m.messageId);
                      const isMe = m.senderUserId === user.userId;
                      const prevSentAt = originalIndex > 0 ? messages[originalIndex - 1].sentAt : null;
                      const dateLabel = getDateLabel(m.sentAt, prevSentAt);
                      const isCurrentSearchMatch = inChatCurrentMessageIndex >= 0 && messages[inChatCurrentMessageIndex]?.messageId === m.messageId;
                      return (
                        <div
                          key={m.messageId}
                          ref={(el) => {
                            if (el) messageRowRefsMap.current.set(m.messageId, el);
                          }}
                          style={isCurrentSearchMatch ? { backgroundColor: 'var(--bs-warning-bg-subtle)', borderRadius: 8 } : undefined}
                        >
                          {dateLabel && (
                            <div className="text-center my-2">
                              <span className="badge bg-light text-dark border fw-normal">{dateLabel}</span>
                            </div>
                          )}
                          <div className={`d-flex align-items-end gap-2 my-2 chat-item ${isMe ? 'justify-content-end' : ''}`}>
                            {!isMe && (
                              <UserAvatar userId={m.senderUserId} name={m.senderName} size={32} className="chat-msg-avatar rounded-circle flex-shrink-0" />
                            )}
                            <div ref={messageMenuId === m.messageId ? (el) => { messageMenuAnchorRef.current = el; } : undefined} style={{ position: 'relative', maxWidth: '95%', minWidth: 'min(120px, 40%)' }} className={isMe ? 'order-first' : ''}>
                              <div className={`chat-message position-relative ${m.isDeleted ? 'opacity-75' : ''}`} style={{ padding: '10px 14px', borderRadius: 18, boxShadow: '0 1px 2px rgba(0,0,0,0.08)', ...(isMe ? { backgroundColor: '#d4edda', borderTopRightRadius: 4 } : { backgroundColor: '#e8eaf6', border: '1px solid #c5cae9', borderTopLeftRadius: 4 }) }}>
                                {m.replyToPreview && (
                                  <div className="border-start border-2 border-primary ps-2 mb-1 small text-body-secondary">
                                    <div className="fw-semibold">{m.replyToSenderName ?? 'Unknown'}</div>
                                    <div className="text-truncate" style={{ maxWidth: 220 }}>{inChatSearchLower ? highlightSearchText(m.replyToPreview, inChatSearchQuery) : m.replyToPreview}</div>
                                  </div>
                                )}
                                {m.attachmentFileId && !m.isDeleted ? (
                                  <>
                                    {m.attachmentMimeType?.startsWith('audio/') ? (
                                      <div className="mb-1">
                                        <audio controls src={attachmentUrl(m)} preload="metadata" style={{ maxWidth: '100%', minWidth: 240 }} />
                                      </div>
                                    ) : m.attachmentMimeType?.startsWith('video/') ? (
                                      <div className="mb-1">
                                        <video
                                          controls
                                          src={attachmentUrl(m)}
                                          preload="metadata"
                                          style={{ maxWidth: '100%', maxHeight: 320, borderRadius: 8 }}
                                          className="rounded"
                                        />
                                      </div>
                                    ) : m.attachmentMimeType?.startsWith('image/') ? (
                                      <div className="mb-1">
                                        <img
                                          src={attachmentUrl(m)}
                                          alt={m.attachmentFileName || 'Image'}
                                          style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 8 }}
                                          loading="lazy"
                                          onError={(e) => {
                                            const el = e.currentTarget;
                                            el.style.display = 'none';
                                            const link = document.createElement('a');
                                            link.href = attachmentUrl(m);
                                            link.target = '_blank';
                                            link.rel = 'noopener noreferrer';
                                            link.className = 'text-primary d-inline-flex align-items-center gap-1';
                                            link.innerHTML = '<i class="ti ti-file"></i> ' + (m.attachmentFileName || 'Open attachment');
                                            el.parentNode?.appendChild(link);
                                          }}
                                        />
                                      </div>
                                    ) : (
                                      <div className="mb-1">
                                        <a href={attachmentUrl(m)} target="_blank" rel="noopener noreferrer" className="text-primary d-inline-flex align-items-center gap-1">
                                          <i className="ti ti-file" />
                                          {inChatSearchLower && m.attachmentFileName ? highlightSearchText(m.attachmentFileName, inChatSearchQuery) : (m.attachmentFileName || 'Attachment')}
                                        </a>
                                      </div>
                                    )}
                                    {m.messageText && m.messageText !== '[Attachment]' && (
                                      <div className="text-break mt-1" style={{ wordBreak: 'break-word' }}>{inChatSearchLower ? highlightSearchText(m.messageText, inChatSearchQuery) : m.messageText}</div>
                                    )}
                                  </>
                                    ) : (
                                  <div className="text-break" style={{ wordBreak: 'break-word' }}>{inChatSearchLower ? highlightSearchText(m.messageText, inChatSearchQuery) : m.messageText}</div>
                                )}
                                {m.reactions && m.reactions.length > 0 && (
                                  <div
                                    className="position-absolute d-flex align-items-center gap-0 flex-wrap"
                                    style={{
                                      bottom: 2,
                                      ...(isMe ? { right: 8, left: 'auto' } : { left: 8, right: 'auto' }),
                                      zIndex: 2,
                                      maxWidth: '70%',
                                    }}
                                  >
                                    {m.reactions.map((r, idx) => (
                                      <button
                                        key={`${r.emoji}-${idx}`}
                                        type="button"
                                        className="border-0 rounded-pill d-inline-flex align-items-center shadow-sm text-decoration-none"
                                        style={{
                                          fontSize: '0.95rem',
                                          cursor: 'pointer',
                                          padding: '2px 8px',
                                          marginRight: 2,
                                          marginBottom: 2,
                                          backgroundColor: 'rgba(255,255,255,0.95)',
                                          boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                          border: '1px solid rgba(0,0,0,0.06)',
                                          ...(r.you ? { borderColor: 'var(--bs-primary)', backgroundColor: 'var(--bs-primary-bg-subtle)' } : {}),
                                        }}
                                        onClick={(e) => { e.stopPropagation(); r.you ? handleRemoveReaction(m.messageId) : handleReact(m.messageId, r.emoji); }}
                                        title={r.you ? 'Remove reaction' : `React with ${r.emoji}`}
                                      >
                                        <span aria-hidden>{r.emoji}</span>
                                        {r.count > 1 && <span className="text-body-secondary ms-0" style={{ fontSize: '0.7rem' }}>{r.count}</span>}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <div className="text-muted d-flex align-items-center gap-1 flex-wrap" style={{ fontSize: '0.7rem', marginTop: 6, marginBottom: 2, paddingBottom: m.reactions?.length ? 20 : 0 }}>
                                  <i className="ti ti-clock" />
                                  {formatMessageTime(m.sentAt)}
                                  {m.isPinned && <i className="ti ti-pin-filled text-primary" title="Pinned" />}
                                  {m.isStarred && <i className="ti ti-star-filled text-warning" title="Starred" />}
                                  {isMe && !m.isDeleted && (
                                    <>
                                      <MessageStatusTicks deliveredAt={m.deliveredAt} readAt={m.readAt} />
                                      <button type="button" className="btn btn-link p-0 ms-1 text-muted" style={{ minWidth: 16, fontSize: '0.7rem' }} onClick={() => setMessageInfoId((id) => (id === m.messageId ? null : m.messageId))} title="Message info" aria-label="Message info"><i className="ti ti-info-circle" /></button>
                                    </>
                                  )}
                                  <button type="button" className="btn btn-link p-0 ms-auto text-body-secondary" style={{ fontSize: '0.75rem' }} onClick={() => setMessageMenuId((id) => (id === m.messageId ? null : m.messageId))} title="More" aria-label="More"><i className="ti ti-dots-vertical" /></button>
                                </div>
                              </div>
                              {messageMenuId === m.messageId && (
                                <div
                                  className="position-absolute rounded-3 shadow-lg bg-white border overflow-hidden"
                                  style={{
                                    zIndex: 25,
                                    minWidth: 200,
                                    [isMe ? 'right' : 'left']: 0,
                                    ...(menuOpenUpward ? { bottom: '100%', marginBottom: 6 } : { top: '100%', marginTop: 6 }),
                                    boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                                  }}
                                >
                                  <div className="p-2 pb-1">
                                    <div className="d-flex flex-wrap gap-1 justify-content-center mb-2">
                                      {QUICK_EMOJIS.map((emoji) => (
                                        <button key={emoji} type="button" className="btn btn-sm btn-outline-secondary rounded-circle p-2 d-flex align-items-center justify-content-center" style={{ width: 36, height: 36, fontSize: '1.2rem' }} onClick={() => handleReact(m.messageId, emoji)} title={`React ${emoji}`}>{emoji}</button>
                                      ))}
                                    </div>
                                    <div className="dropdown-divider my-1" />
                                    <button type="button" className="btn btn-sm btn-link text-start w-100 d-flex align-items-center gap-2 py-2 rounded" onClick={() => handleReply(m)}><i className="ti ti-arrow-back-up" /> Reply</button>
                                    <button type="button" className="btn btn-sm btn-link text-start w-100 d-flex align-items-center gap-2 py-2 rounded" onClick={() => handleForwardClick(m.messageId)}><i className="ti ti-share" /> Forward</button>
                                    {m.attachmentFileId && <button type="button" className="btn btn-sm btn-link text-start w-100 d-flex align-items-center gap-2 py-2 rounded" onClick={() => handleDownload(m)}><i className="ti ti-download" /> Download</button>}
                                    <button type="button" className="btn btn-sm btn-link text-start w-100 d-flex align-items-center gap-2 py-2 rounded" onClick={() => handleStar(m.messageId, !!m.isStarred)}><i className={m.isStarred ? 'ti ti-star-filled text-warning' : 'ti ti-star'} /> {m.isStarred ? 'Unstar' : 'Star'}</button>
                                    <button type="button" className="btn btn-sm btn-link text-start w-100 d-flex align-items-center gap-2 py-2 rounded" onClick={() => handlePin(m.messageId, !!m.isPinned)}><i className={m.isPinned ? 'ti ti-pin-filled' : 'ti ti-pin'} /> {m.isPinned ? 'Unpin' : 'Pin'}</button>
                                    <button type="button" className="btn btn-sm btn-link text-start w-100 d-flex align-items-center gap-2 py-2 rounded text-danger" onClick={() => openDeleteConfirm(m)}><i className="ti ti-trash" /> Delete</button>
                                  </div>
                                </div>
                              )}
                              {messageInfoId === m.messageId && (
                                <div className="chat-message-info-popover position-absolute overflow-visible" style={{ zIndex: 10, [isMe ? 'right' : 'left']: 0 }}>
                                  <div className="rounded-3 overflow-hidden bg-white shadow mt-1 p-2 small" style={{ minWidth: 200, maxWidth: '90vw' }}>
                                    <div className="d-flex justify-content-between py-1 gap-3"><span className="text-muted">Sent</span><span className="text-nowrap">{formatMessageInfoTime(m.sentAt)}</span></div>
                                    <div className="d-flex justify-content-between py-1 gap-3"><span className="text-muted">Delivered</span><span className="text-nowrap">{formatMessageInfoTime(m.deliveredAt ?? undefined)}</span></div>
                                    <div className="d-flex justify-content-between py-1 gap-3"><span className="text-muted">Read</span><span className="text-nowrap">{formatMessageInfoTime(m.readAt ?? undefined)}</span></div>
                                    <button type="button" className="btn btn-sm btn-outline-secondary w-100 mt-1" onClick={() => setMessageInfoId(null)}>Close</button>
                                  </div>
                                </div>
                              )}
                            </div>
                            {isMe && (
                              <UserAvatar userId={user.userId} name={user.name} size={32} className="chat-msg-avatar rounded-circle flex-shrink-0" />
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* ── Input footer (flex-shrink-0: always at bottom) ── */}
              <div className="chat-input-footer flex-shrink-0 p-2 bg-body-secondary border-top">
                {sendError && <div className="text-danger small mb-1">{sendError}</div>}
                {showEmojiPicker && (
                  <div ref={emojiPickerRef} className="mb-2 p-2 rounded bg-white border shadow d-flex flex-wrap gap-1 chat-emoji-picker" style={{ maxHeight: 130, overflow: 'auto' }}>
                    {CHAT_EMOJIS.map((emoji, idx) => (
                      <button key={idx} type="button" className="btn btn-sm btn-outline-light border-0 p-1 rounded" style={{ fontSize: '1.1rem' }} onClick={() => insertEmoji(emoji)} title={emoji} aria-label={`Insert ${emoji}`}>{emoji}</button>
                    ))}
                  </div>
                )}
                {recordingState === 'preview' && recordedBlob ? (
                  <div className="d-flex align-items-center gap-2 flex-wrap p-2 rounded bg-light">
                    <audio key="preview" controls src={voicePreviewUrl} style={{ maxWidth: 200, height: 36 }} />
                    <span className="text-muted small">{recordedDuration}s</span>
                    <button type="button" className="btn btn-primary btn-sm" onClick={sendVoiceMessage} disabled={sending} title="Send voice message">
                      Send
                    </button>
                    <button type="button" className="btn btn-outline-secondary btn-sm" onClick={cancelRecording} disabled={sending} title="Cancel">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    {uploadQueue.length > 0 && (
                      <div className="chat-upload-tray mb-2 p-2 rounded-3 bg-light border border-light-subtle">
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <i className="ti ti-cloud-upload text-primary" style={{ fontSize: '1rem' }} />
                          <span className="small fw-semibold text-body-secondary">Uploading {uploadQueue.filter((u) => u.status === 'uploading' || u.status === 'pending').length} file(s)</span>
                        </div>
                        <div className="d-flex flex-column gap-2" style={{ maxHeight: 160, overflowY: 'auto' }}>
                          {uploadQueue.map((item) => (
                            <div
                              key={item.id}
                              className="d-flex align-items-center gap-2 p-2 rounded-2 bg-white border border-light shadow-sm"
                              style={{ minHeight: 44 }}
                            >
                              <span className="flex-shrink-0 text-body-secondary">
                                {item.file.type.startsWith('video/') ? (
                                  <i className="ti ti-video" style={{ fontSize: '1.25rem' }} />
                                ) : item.file.type.startsWith('audio/') ? (
                                  <i className="ti ti-music" style={{ fontSize: '1.25rem' }} />
                                ) : item.file.type.startsWith('image/') ? (
                                  <i className="ti ti-photo" style={{ fontSize: '1.25rem' }} />
                                ) : (
                                  <i className="ti ti-file" style={{ fontSize: '1.25rem' }} />
                                )}
                              </span>
                              <div className="min-width-0 flex-grow-1">
                                <div className="d-flex align-items-center gap-2">
                                  <span className="small text-truncate fw-medium" title={item.file.name}>
                                    {item.file.name}
                                  </span>
                                  <span className="small text-body-tertiary flex-shrink-0">
                                    {item.file.size >= 1024 * 1024
                                      ? `${(item.file.size / (1024 * 1024)).toFixed(1)} MB`
                                      : item.file.size >= 1024
                                        ? `${(item.file.size / 1024).toFixed(1)} KB`
                                        : `${item.file.size} B`}
                                  </span>
                                </div>
                                {item.status === 'uploading' || item.status === 'pending' ? (
                                  <div className="progress mt-1" style={{ height: 6, backgroundColor: 'var(--bs-light)' }}>
                                    <div
                                      className="progress-bar progress-bar-striped progress-bar-animated bg-primary"
                                      role="progressbar"
                                      style={{ width: `${item.progress}%` }}
                                      aria-valuenow={item.progress}
                                      aria-valuemin={0}
                                      aria-valuemax={100}
                                    />
                                  </div>
                                ) : item.status === 'done' ? (
                                  <div className="small text-success mt-0">
                                    <i className="ti ti-check me-1" /> Sent
                                  </div>
                                ) : (
                                  <div className="small text-danger mt-0">
                                    {item.error || 'Failed'}
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                className="btn btn-sm btn-link text-body-secondary p-1 flex-shrink-0"
                                onClick={() => cancelUpload(item.id)}
                                title={item.status === 'uploading' || item.status === 'pending' ? 'Cancel upload' : 'Remove'}
                                aria-label={item.status === 'uploading' || item.status === 'pending' ? 'Cancel upload' : 'Remove'}
                              >
                                <i className={item.status === 'uploading' || item.status === 'pending' ? 'ti ti-x' : 'ti ti-x'} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {replyingTo && (
                      <div className="d-flex align-items-center gap-2 mb-2 p-2 rounded bg-light border-start border-3 border-primary">
                        <div className="min-width-0 flex-grow-1">
                          <div className="small fw-semibold text-primary">Replying to {replyingTo.senderName}</div>
                          <div className="small text-body-secondary text-truncate" style={{ maxWidth: 280 }}>{replyingTo.replyToPreview ?? replyingTo.messageText ?? '[Attachment]'}</div>
                        </div>
                        <button type="button" className="btn btn-sm btn-outline-secondary p-1" onClick={() => setReplyingTo(null)} title="Cancel reply" aria-label="Cancel reply"><i className="ti ti-x" /></button>
                      </div>
                    )}
                    <div className="d-flex gap-1 align-items-end flex-wrap">
                      <button type="button" className="btn btn-default btn-icon flex-shrink-0 chat-emoji-btn" onClick={() => setShowEmojiPicker((v) => !v)} title="Insert emoji" aria-label="Insert emoji">
                        <span style={{ fontSize: '1.15rem' }}>😊</span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*,video/*,audio/*,application/pdf"
                        multiple
                        className="d-none"
                        onChange={handleFileSelect}
                        aria-label="Attach file"
                      />
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="d-none"
                        onChange={handleCameraCapture}
                        aria-label="Take photo"
                      />
                      <button type="button" className="btn btn-default btn-icon flex-shrink-0" onClick={() => fileInputRef.current?.click()} disabled={sending} title="Attach file" aria-label="Attach file">
                        <i className="ti ti-paperclip" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-default btn-icon flex-shrink-0 d-md-none"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={sending}
                        title="Take photo"
                        aria-label="Take photo"
                      >
                        <i className="ti ti-camera" />
                      </button>
                      {recordingState === 'idle' ? (
                        <button type="button" className="btn btn-default btn-icon flex-shrink-0" onClick={(e) => startRecording(e)} disabled={sending || requestingMic} title="Record voice message" aria-label="Record voice message">
                          {requestingMic ? <span className="small">Mic…</span> : <i className="ti ti-microphone" />}
                        </button>
                      ) : (
                        <button type="button" className="btn btn-danger btn-icon flex-shrink-0 d-flex align-items-center gap-1" onClick={stopRecording} title="Stop recording" aria-label="Stop recording">
                          <i className="ti ti-square" />
                          <span className="small">{recordedDuration}s</span>
                        </button>
                      )}
                      <div className="flex-grow-1 min-width-0">
                        <textarea
                          ref={inputRef}
                          className="form-control form-control-sm bg-light-subtle border-light chat-input-textarea"
                          placeholder="Type a message..."
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                          rows={1}
                          style={{ resize: 'none', maxHeight: 80, overflow: 'auto' }}
                          aria-label="Message"
                        />
                      </div>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm flex-shrink-0 d-flex align-items-center gap-1"
                        onClick={openImproveModal}
                        disabled={sending || !inputText.trim() || improveLoading || improveModal != null}
                        title="Improve message with AI"
                        aria-label="Improve message with AI"
                      >
                        {improveLoading ? (
                          <span className="spinner-border spinner-border-sm" style={{ width: 16, height: 16 }} />
                        ) : (
                          <>
                            <i className="ti ti-sparkles" />
                            <span>AI</span>
                          </>
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm flex-shrink-0"
                        onClick={() => sendMessage()}
                        disabled={sending || !inputText.trim()}
                        title="Send"
                      >
                        <span className="d-none d-md-inline me-1">Send</span>
                        <i className="ti ti-send-2" />
                      </button>
                    </div>
                    {(sending || uploadingAttachment) && (
                      <div className="text-muted small mt-1">
                        {uploadingAttachment ? 'Uploading…' : 'Sending…'}
                      </div>
                    )}
                  </>
                )}
              </div>

              {improveModal != null && (
                <div className="position-absolute top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center p-3 bg-dark bg-opacity-25" style={{ zIndex: 30 }} onClick={() => { setImproveModal(null); setImproveError(null); }}>
                  <div className="bg-white rounded-3 shadow p-3 w-100" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="fw-semibold d-flex align-items-center gap-2">
                        <i className="ti ti-sparkles text-primary" />
                        Improve message
                      </span>
                      <button type="button" className="btn btn-sm btn-link text-body-secondary" onClick={() => { setImproveModal(null); setImproveError(null); }} aria-label="Close">
                        <i className="ti ti-x" />
                      </button>
                    </div>
                    {improveError && (
                      <div className="alert alert-danger py-2 mb-2 small">{improveError}</div>
                    )}
                    <div className="mb-2">
                      <div className="small text-muted mb-1">Original</div>
                      <div className="p-2 rounded bg-light small">{improveModal.original}</div>
                    </div>
                    {improveLoading ? (
                      <div className="d-flex align-items-center gap-2 py-3 text-muted">
                        <span className="spinner-border spinner-border-sm" />
                        <span className="small">Improving your message…</span>
                      </div>
                    ) : improveModal.improved ? (
                      <>
                        <div className="mb-3">
                          <div className="small text-muted mb-1">Improved</div>
                          <div className="p-2 rounded bg-success bg-opacity-10 border border-success border-opacity-25 small">{improveModal.improved}</div>
                        </div>
                        <div className="d-flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm d-flex align-items-center gap-1"
                            onClick={() => sendImproved(improveModal.improved)}
                            disabled={sending}
                          >
                            <i className="ti ti-send-2" />
                            Send
                          </button>
                          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => applyImprove(improveModal.improved)}>
                            Use this
                          </button>
                          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={improveGetMore}>
                            Get another option
                          </button>
                          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setImproveModal(null); setImproveError(null); }}>
                            Cancel
                          </button>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              )}

              {forwardMessageId != null && (
                <div className="position-absolute top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center p-3 bg-dark bg-opacity-25" style={{ zIndex: 30 }} onClick={() => setForwardMessageId(null)}>
                  <div className="bg-white rounded-3 shadow p-3 w-100" style={{ maxWidth: 320 }} onClick={(e) => e.stopPropagation()}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <span className="fw-semibold">Forward to</span>
                      <button type="button" className="btn btn-sm btn-link text-body-secondary" onClick={() => setForwardMessageId(null)}><i className="ti ti-x" /></button>
                    </div>
                    <div className="list-group list-group-flush" style={{ maxHeight: 240, overflowY: 'auto' }}>
                      {users.filter((u) => u.userId !== user?.userId).map((u) => (
                        <button key={u.userId} type="button" className="list-group-item list-group-item-action d-flex align-items-center gap-2" onClick={() => handleForwardToUser(u.userId)}>
                          <UserAvatar userId={u.userId} name={u.name} size={28} className="rounded-circle" />
                          <span>{u.name}</span>
                          {u.userId === selectedUserId && <span className="badge bg-primary">Current chat</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {deleteConfirmMessageId != null && (
                <div className="position-absolute top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center p-3 bg-dark bg-opacity-25" style={{ zIndex: 30 }} onClick={() => setDeleteConfirmMessageId(null)}>
                  <div className="bg-white rounded-3 shadow p-3 w-100" style={{ maxWidth: 320 }} onClick={(e) => e.stopPropagation()}>
                    <div className="fw-semibold mb-2">Delete message?</div>
                    <div className="d-flex flex-column gap-2">
                      <button type="button" className="btn btn-outline-danger" onClick={() => handleDelete(deleteConfirmMessageId.messageId, false)}>Delete for me</button>
                      {deleteConfirmMessageId.isSender && <button type="button" className="btn btn-danger" onClick={() => handleDelete(deleteConfirmMessageId.messageId, true)}>Delete for everyone</button>}
                      <button type="button" className="btn btn-outline-secondary" onClick={() => setDeleteConfirmMessageId(null)}>Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="card-body d-flex flex-column align-items-center justify-content-center flex-grow-1 text-muted p-4">
              <span className="display-4 mb-3 opacity-50">💬</span>
              <h5 className="fw-semibold text-dark mb-2">Select a conversation</h5>
              <p className="text-center mb-0">Choose someone from the list or search to start chatting.</p>
              <button
                type="button"
                className="btn btn-primary mt-3 d-lg-none"
                onClick={handleBackToList}
              >
                <i className="ti ti-users me-1"></i>View Contacts
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
