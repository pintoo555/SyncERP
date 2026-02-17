/**
 * Webmail UI - Inspinia Mailbox layout (https://chuibility.github.io/inspinia/mailbox.html)
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { getChatSettings } from '../../../utils/chatSettings';
import { useEmailUnread } from '../../../contexts/EmailUnreadContext';

interface MailFolder {
  name: string;
  path: string;
  flags: string[];
  exists?: number;
  unseen?: number;
}

interface MailEnvelope {
  date?: string;
  subject?: string;
  from?: Array<{ address?: string; name?: string }>;
  to?: Array<{ address?: string; name?: string }>;
  cc?: Array<{ address?: string; name?: string }>;
}

interface MailMessageHeader {
  uid: number;
  seq?: number;
  envelope: MailEnvelope;
  flags: string[];
  hasAttachments?: boolean;
}

interface MailMessageBody {
  uid: number;
  envelope?: MailEnvelope;
  text: string | null;
  html: string | null;
  attachments: Array<{ filename: string; contentType: string; size: number; index: number }>;
}

function formatDate(d: string | undefined): string {
  if (!d) return '';
  const date = new Date(d);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const diff = (now.getTime() - date.getTime()) / 86400000;
  if (diff < 7) return date.toLocaleDateString(undefined, { weekday: 'short' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
}

function formatDateTime(d: string | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function fromLine(envelope: MailEnvelope): string {
  const from = envelope?.from?.[0];
  if (!from) return '—';
  return from.name || from.address || '—';
}

function formatAddresses(arr: Array<{ address?: string; name?: string }> | undefined): string {
  if (!arr?.length) return '—';
  return arr.map((a) => (a.name ? `${a.name} <${a.address || ''}>` : a.address || '')).filter(Boolean).join(', ');
}

function getReplyTo(envelope: MailEnvelope): string {
  const from = envelope?.from?.[0];
  return from?.address || '';
}

function getReplySubject(subject: string | undefined): string {
  const s = (subject || '(No subject)').trim();
  if (/^re:\s*/i.test(s)) return s;
  return `Re: ${s}`;
}

function getForwardSubject(subject: string | undefined): string {
  const s = (subject || '(No subject)').trim();
  if (/^fwd:\s*/i.test(s)) return s;
  return `Fwd: ${s}`;
}

function buildQuotedText(envelope: MailEnvelope, bodyText: string | null): string {
  const from = formatAddresses(envelope.from);
  const date = formatDateTime(envelope.date);
  const subject = envelope.subject || '(No subject)';
  return `\n\n--- Original Message ---\nFrom: ${from}\nDate: ${date}\nSubject: ${subject}\n\n${bodyText || ''}`;
}

function getFolderIcon(path: string): string {
  const p = path.toLowerCase();
  if (p === 'inbox') return 'ti-inbox';
  if (p.includes('sent')) return 'ti-send';
  if (p.includes('trash')) return 'ti-trash';
  if (p.includes('draft')) return 'ti-file';
  if (p.includes('junk') || p.includes('spam')) return 'ti-alert-circle';
  return 'ti-folder';
}

function formatSize(bytes: number | undefined): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) return 'ti-photo';
  if (ext === 'pdf') return 'ti-file-type-pdf';
  if (['doc', 'docx', 'rtf', 'odt'].includes(ext)) return 'ti-file-type-doc';
  if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'ti-file-spreadsheet';
  if (['ppt', 'pptx', 'odp'].includes(ext)) return 'ti-file-type-ppt';
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'ti-file-zip';
  if (['mp3', 'wav', 'ogg', 'flac', 'aac', 'wma'].includes(ext)) return 'ti-music';
  if (['mp4', 'avi', 'mov', 'mkv', 'webm', 'wmv'].includes(ext)) return 'ti-movie';
  if (['txt', 'log', 'md'].includes(ext)) return 'ti-file-text';
  if (['js', 'ts', 'py', 'java', 'cpp', 'c', 'html', 'css', 'json', 'xml'].includes(ext)) return 'ti-file-code';
  return 'ti-file';
}

export default function EmailApp() {
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [selectedPath, setSelectedPath] = useState<string>('INBOX');
  const [messages, setMessages] = useState<MailMessageHeader[]>([]);
  const [total, setTotal] = useState(0);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [messageBody, setMessageBody] = useState<MailMessageBody | null>(null);
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingBody, setLoadingBody] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeCc, setComposeCc] = useState('');
  const [composeBcc, setComposeBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [sending, setSending] = useState(false);
  const [noCredentials, setNoCredentials] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState(false);
  const [selectedUids, setSelectedUids] = useState<Set<number>>(new Set());
  const [composeAttachments, setComposeAttachments] = useState<Array<{ file: File; id: string }>>([]);
  const [composeDragOver, setComposeDragOver] = useState(false);
  const [improveModal, setImproveModal] = useState<{ original: string; improved: string } | null>(null);
  const [improveLoading, setImproveLoading] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const messagesRef = useRef<MailMessageHeader[]>([]);
  messagesRef.current = messages;
  const selectAllRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const PAGE_SIZE = 50;
  const { refetch: refetchEmailUnread } = useEmailUnread();

  const loadFolders = useCallback(() => {
    setLoadingFolders(true);
    setError(null);
    setNoCredentials(false);
    api.get<{ success: boolean; data: MailFolder[] }>('/api/mailbox/folders')
      .then((res) => {
        setFolders(res.data ?? []);
        refetchEmailUnread();
      })
      .catch((e) => {
        const msg = e?.message ?? 'Failed to load folders';
        setError(msg);
        if (msg.includes('not configured') || msg.includes('Mailbox')) setNoCredentials(true);
      })
      .finally(() => setLoadingFolders(false));
  }, [refetchEmailUnread]);

  const loadMessages = useCallback((pageNum: number = 1, append: boolean = false) => {
    if (!selectedPath) return;
    const pathEnc = encodeURIComponent(selectedPath);
    if (!append) setLoadingMessages(true);
    else setLoadingMore(true);
    return api.get<{ success: boolean; data: MailMessageHeader[]; total: number }>(`/api/mailbox/folders/${pathEnc}/messages?page=${pageNum}&limit=${PAGE_SIZE}`)
      .then((res) => {
        const newMsgs = res.data ?? [];
        if (append) {
          setMessages((prev) => [...prev, ...newMsgs]);
        } else {
          setMessages(newMsgs);
        }
        setTotal(res.total ?? 0);
        setHasMore(newMsgs.length >= PAGE_SIZE);
      })
      .catch((e) => setError(e?.message ?? 'Failed to load messages'))
      .finally(() => { setLoadingMessages(false); setLoadingMore(false); });
  }, [selectedPath]);

  useEffect(() => {
    loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    if (!selectedPath) return;
    setSelectedUid(null);
    setMessageBody(null);
    setSelectedUids(new Set());
    setPage(1);
    setHasMore(true);
    setSearchMode(false);
    setSearchQuery('');
    loadMessages(1, false);
  }, [selectedPath, loadMessages]);

  useEffect(() => {
    if (!selectedPath || selectedUid == null) return;
    let cancelled = false;
    setLoadingBody(true);
    setError(null);
    const pathEnc = encodeURIComponent(selectedPath);
    const uid = selectedUid;
    const sel = messagesRef.current.find((m) => m.uid === uid);
    const seqParam = sel?.seq != null ? `?seq=${sel.seq}` : '';
    api.get<{ success?: boolean; data?: MailMessageBody }>(`/api/mailbox/folders/${pathEnc}/messages/${uid}${seqParam}`)
      .then((res) => {
        if (cancelled) return;
        const body = res && typeof res === 'object' && 'data' in res ? res.data : res;
        setMessageBody((body && typeof body === 'object') ? (body as MailMessageBody) : null);
        const msg = messagesRef.current.find((m) => m.uid === uid);
        if (msg && !msg.flags?.includes('\\Seen')) {
          setMessages((prev) => prev.map((m) =>
            m.uid === uid ? { ...m, flags: [...(m.flags || []), '\\Seen'] } : m
          ));
          loadFolders();
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'Failed to load message');
      })
      .finally(() => {
        if (!cancelled) setLoadingBody(false);
      });
    return () => { cancelled = true; };
  }, [selectedPath, selectedUid]);

  const markAllRead = () => {
    const pathEnc = encodeURIComponent(selectedPath);
    setActionLoading('markAll');
    api.post(`/api/mailbox/folders/${pathEnc}/mark-all-read`)
      .then(() => {
        setPage(1); setHasMore(true); loadMessages(1, false);
        loadFolders();
      })
      .catch((e) => setError(e?.message ?? 'Failed'))
      .finally(() => setActionLoading(null));
  };

  const markMessageRead = (uid: number, read: boolean) => {
    const pathEnc = encodeURIComponent(selectedPath);
    setActionLoading(String(uid));
    api.put(`/api/mailbox/folders/${pathEnc}/messages/${uid}/read`, { read })
      .then(() => {
        setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, flags: read ? [...(m.flags || []), '\\Seen'] : (m.flags || []).filter((f) => f !== '\\Seen') } : m)));
        loadFolders();
      })
      .catch((e) => setError(e?.message ?? 'Failed'))
      .finally(() => setActionLoading(null));
  };

  const toggleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedUids(new Set(filteredMessages.map((m) => m.uid)));
    } else {
      setSelectedUids(new Set());
    }
  };

  const bulkMarkRead = (read: boolean) => {
    const uids = Array.from(selectedUids);
    if (!uids.length) return;
    const pathEnc = encodeURIComponent(selectedPath);
    setActionLoading('bulk');
    api.post(`/api/mailbox/folders/${pathEnc}/mark-read`, { uids, read })
      .then(() => {
        setMessages((prev) =>
          prev.map((m) =>
            selectedUids.has(m.uid)
              ? { ...m, flags: read ? [...(m.flags || []), '\\Seen'] : (m.flags || []).filter((f) => f !== '\\Seen') }
              : m
          )
        );
        setSelectedUids(new Set());
        loadFolders();
      })
      .catch((e) => setError(e?.message ?? 'Failed'))
      .finally(() => setActionLoading(null));
  };

  const addComposeAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setComposeAttachments((prev) => [
      ...prev,
      ...Array.from(files).map((f) => ({ file: f, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` })),
    ]);
    e.target.value = '';
  };

  const removeComposeAttachment = (id: string) => {
    setComposeAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const openReply = (envelope: MailEnvelope) => {
    const quoted = buildQuotedText(envelope, messageBody?.text ?? null);
    setComposeTo(getReplyTo(envelope));
    setComposeCc('');
    setComposeBcc('');
    setShowCc(false);
    setShowBcc(false);
    setComposeSubject(getReplySubject(envelope?.subject));
    setComposeBody(quoted);
    setComposeAttachments([]);
    setComposeOpen(true);
  };

  const openReplyAll = (envelope: MailEnvelope) => {
    const quoted = buildQuotedText(envelope, messageBody?.text ?? null);
    const sender = getReplyTo(envelope);
    const allTo = (envelope.to || []).map((a) => a.address || '').filter(Boolean);
    const allCc = (envelope.cc || []).map((a) => a.address || '').filter(Boolean);
    const ccList = [...allTo, ...allCc].filter((addr) => addr.toLowerCase() !== sender.toLowerCase());
    setComposeTo(sender);
    setComposeCc(ccList.join(', '));
    setComposeBcc('');
    setShowCc(ccList.length > 0);
    setShowBcc(false);
    setComposeSubject(getReplySubject(envelope?.subject));
    setComposeBody(quoted);
    setComposeAttachments([]);
    setComposeOpen(true);
  };

  const openForward = (envelope: MailEnvelope) => {
    const quoted = buildQuotedText(envelope, messageBody?.text ?? null);
    setComposeTo('');
    setComposeCc('');
    setComposeBcc('');
    setShowCc(false);
    setShowBcc(false);
    setComposeSubject(getForwardSubject(envelope?.subject));
    setComposeBody(quoted);
    setComposeAttachments([]);
    setComposeOpen(true);
  };

  const deleteMessage = (uid: number) => {
    const pathEnc = encodeURIComponent(selectedPath);
    setActionLoading('delete');
    api.post(`/api/mailbox/folders/${pathEnc}/delete`, { uids: [uid] })
      .then(() => {
        setSelectedUid(null);
        setMessageBody(null);
        setPage(1); setHasMore(true); loadMessages(1, false);
        loadFolders();
      })
      .catch((e) => setError(e?.message ?? 'Delete failed'))
      .finally(() => setActionLoading(null));
  };

  const bulkDelete = () => {
    const uids = Array.from(selectedUids);
    if (!uids.length) return;
    const pathEnc = encodeURIComponent(selectedPath);
    setActionLoading('bulkDelete');
    api.post(`/api/mailbox/folders/${pathEnc}/delete`, { uids })
      .then(() => {
        setSelectedUids(new Set());
        setPage(1); setHasMore(true); loadMessages(1, false);
        loadFolders();
      })
      .catch((e) => setError(e?.message ?? 'Delete failed'))
      .finally(() => setActionLoading(null));
  };

  const toggleStar = (uid: number, currentlyFlagged: boolean) => {
    const pathEnc = encodeURIComponent(selectedPath);
    api.put(`/api/mailbox/folders/${pathEnc}/messages/${uid}/flag`, { flag: '\\Flagged', add: !currentlyFlagged })
      .then(() => {
        setMessages((prev) =>
          prev.map((m) =>
            m.uid === uid
              ? { ...m, flags: !currentlyFlagged ? [...(m.flags || []), '\\Flagged'] : (m.flags || []).filter((f) => f !== '\\Flagged') }
              : m
          )
        );
      })
      .catch((e) => setError(e?.message ?? 'Failed to toggle star'));
  };

  const handleDownloadAttachment = async (uid: number, index: number, filename: string) => {
    const pathEnc = encodeURIComponent(selectedPath);
    try {
      const response = await fetch(`/api/mailbox/folders/${pathEnc}/messages/${uid}/attachments/${index}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to download attachment');
    }
  };

  const handleComposeDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setComposeDragOver(false);
    const files = e.dataTransfer?.files;
    if (!files?.length) return;
    setComposeAttachments((prev) => [
      ...prev,
      ...Array.from(files).map((f) => ({ file: f, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` })),
    ]);
  };

  const performSearch = () => {
    const q = searchQuery.trim();
    if (!q) {
      clearSearch();
      return;
    }
    setSearchMode(true);
    setSelectedUid(null);
    setMessageBody(null);
    setSelectedUids(new Set());
    setLoadingMessages(true);
    const pathEnc = encodeURIComponent(selectedPath);
    api.get<{ success: boolean; data: MailMessageHeader[]; total: number }>(`/api/mailbox/folders/${pathEnc}/search?q=${encodeURIComponent(q)}&limit=100`)
      .then((res) => {
        setMessages(res.data ?? []);
        setTotal(res.total ?? 0);
        setHasMore(false); // search results are not paginated
      })
      .catch((e) => setError(e?.message ?? 'Search failed'))
      .finally(() => setLoadingMessages(false));
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchMode(false);
    setPage(1);
    setHasMore(true);
    loadMessages(1, false);
  };

  const archiveMessage = (uid: number) => {
    const pathEnc = encodeURIComponent(selectedPath);
    setActionLoading('archive');
    api.post(`/api/mailbox/folders/${pathEnc}/archive`, { uids: [uid] })
      .then(() => {
        setSelectedUid(null);
        setMessageBody(null);
        loadMessages(1, false);
        loadFolders();
      })
      .catch((e) => setError(e?.message ?? 'Archive failed'))
      .finally(() => setActionLoading(null));
  };

  const bulkArchive = () => {
    const uids = Array.from(selectedUids);
    if (!uids.length) return;
    const pathEnc = encodeURIComponent(selectedPath);
    setActionLoading('bulkArchive');
    api.post(`/api/mailbox/folders/${pathEnc}/archive`, { uids })
      .then(() => {
        setSelectedUids(new Set());
        loadMessages(1, false);
        loadFolders();
      })
      .catch((e) => setError(e?.message ?? 'Archive failed'))
      .finally(() => setActionLoading(null));
  };

  const loadMoreMessages = useCallback(() => {
    if (loadingMore || !hasMore || searchMode) return;
    const nextPage = page + 1;
    setPage(nextPage);
    loadMessages(nextPage, true);
  }, [page, loadingMore, hasMore, searchMode, loadMessages]);

  const sendMail = async () => {
    if (!composeTo.trim()) return;
    setSending(true);
    setError(null);
    const formData = new FormData();
    formData.append('to', composeTo.trim());
    if (composeCc.trim()) formData.append('cc', composeCc.trim());
    if (composeBcc.trim()) formData.append('bcc', composeBcc.trim());
    formData.append('subject', composeSubject.trim() || '(No subject)');
    formData.append('text', composeBody.trim() || '');
    composeAttachments.forEach((a) => formData.append('attachments', a.file, a.file.name));
    api
      .upload<{ success: boolean; message?: string }>('/api/mailbox/send', formData)
      .then(() => {
        setComposeOpen(false);
        setComposeTo('');
        setComposeCc('');
        setComposeBcc('');
        setShowCc(false);
        setShowBcc(false);
        setComposeSubject('');
        setComposeBody('');
        setComposeAttachments([]);
        setPage(1); setHasMore(true);
        loadMessages(1, false);
        loadFolders();
      })
      .catch((e) => setError(e?.message ?? 'Send failed'))
      .finally(() => setSending(false));
  };

  const settings = getChatSettings();
  const openImproveModal = useCallback(() => {
    const text = composeBody.trim();
    if (!text) return;
    setImproveError(null);
    setImproveModal({ original: text, improved: '' });
    setImproveLoading(true);
    const serviceCode = settings.aiServiceCode?.trim() || undefined;
    api.post<{ success: boolean; data: { improved: string } }>('/api/ai/improve', { text, serviceCode, context: 'email' })
      .then((res) => {
        const improved = (res as { data?: { improved?: string } }).data?.improved ?? '';
        setImproveModal((m) => m ? { ...m, improved } : null);
      })
      .catch((err) => setImproveError(err instanceof Error ? err.message : 'Failed to improve'))
      .finally(() => setImproveLoading(false));
  }, [composeBody, settings.aiServiceCode]);

  const improveGetMore = useCallback(() => {
    const text = improveModal?.original ?? '';
    if (!text) return;
    setImproveError(null);
    setImproveLoading(true);
    const variant = improveModal?.improved ? 'friendly' : 'professional';
    const serviceCode = settings.aiServiceCode?.trim() || undefined;
    api.post<{ success: boolean; data: { improved: string } }>('/api/ai/improve', { text, variant, serviceCode, context: 'email' })
      .then((res) => {
        const improved = (res as { data?: { improved?: string } }).data?.improved ?? '';
        setImproveModal((m) => m ? { ...m, improved } : null);
      })
      .catch((err) => setImproveError(err instanceof Error ? err.message : 'Failed to improve'))
      .finally(() => setImproveLoading(false));
  }, [improveModal, settings.aiServiceCode]);

  const applyImprove = useCallback((improved: string) => {
    setComposeBody(improved);
    setImproveModal(null);
    setImproveError(null);
  }, []);

  const selectedMsg = messages.find((m) => m.uid === selectedUid);
  const isUnread = (m: MailMessageHeader) => !m.flags?.includes('\\Seen');
  const displayEnvelope = messageBody?.envelope || selectedMsg?.envelope;
  const unreadCount = messages.filter(isUnread).length;
  const filteredMessages = messages; // search is now server-side

  useEffect(() => {
    const el = selectAllRef.current;
    if (el && filteredMessages.length > 0) {
      el.indeterminate = selectedUids.size > 0 && selectedUids.size < filteredMessages.length;
    }
  }, [selectedUids.size, filteredMessages.length]);

  // Infinite scroll observer
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loadingMore || searchMode) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMoreMessages();
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, searchMode, loadMoreMessages]);

  if (noCredentials) {
    return (
      <div className="container-fluid py-4">
        <div className="card">
          <div className="card-body text-center py-5">
            <i className="ti ti-mail-off fs-1 text-muted mb-3 d-block" />
            <h5>Mailbox not configured</h5>
            <p className="text-muted mb-4">Save your email account in Email Settings to use webmail.</p>
            <Link to="/emails/settings" className="btn btn-primary">Open Email Settings</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mailbox-page">
      {error && (
        <div className="alert alert-danger alert-dismissible fade show mb-3" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close" />
        </div>
      )}

      <div className="mailbox-layout">
        {/* Left sidebar - Inspinia style */}
        <aside className="mailbox-sidebar">
          <button type="button" className="btn btn-primary w-100 mb-3" onClick={() => { setComposeTo(''); setComposeCc(''); setComposeBcc(''); setShowCc(false); setShowBcc(false); setComposeSubject(''); setComposeBody(''); setComposeAttachments([]); setComposeOpen(true); }}>
            Compose Mail
          </button>

          <h5 className="text-muted text-uppercase small fw-semibold mb-2 mt-4">Folders</h5>
          <nav className="nav flex-column mailbox-nav">
            {loadingFolders ? (
              <div className="py-2 text-muted small">Loading…</div>
            ) : (
              folders.map((f) => (
                <button
                  key={f.path}
                  type="button"
                  className={`nav-link mailbox-folder ${selectedPath === f.path ? 'active' : ''}`}
                  onClick={() => setSelectedPath(f.path)}
                >
                  <i className={`ti ${getFolderIcon(f.path)} me-2`} />
                  {f.path === 'INBOX' ? 'Inbox' : f.path.toUpperCase().includes('SENT') ? 'Sent' : f.path.toUpperCase().includes('TRASH') ? 'Trash' : f.path.toUpperCase().includes('DRAFT') ? 'Drafts' : f.path.toUpperCase().includes('JUNK') || f.path.toUpperCase().includes('SPAM') ? 'Junk' : f.name}
                  {f.unseen != null && f.unseen > 0 && <span className="badge bg-primary ms-2">{f.unseen}</span>}
                </button>
              ))
            )}
          </nav>

          <h5 className="text-muted text-uppercase small fw-semibold mb-2 mt-4">Categories</h5>
          <nav className="nav flex-column mailbox-nav">
            <span className="nav-link text-muted small">Work</span>
            <span className="nav-link text-muted small">Documents</span>
            <span className="nav-link text-muted small">Social</span>
            <span className="nav-link text-muted small">Advertising</span>
            <span className="nav-link text-muted small">Clients</span>
          </nav>

          <h5 className="text-muted text-uppercase small fw-semibold mb-2 mt-4">Labels</h5>
          <nav className="nav flex-column mailbox-nav">
            <span className="nav-link text-muted small">Family</span>
            <span className="nav-link text-muted small">Work</span>
            <span className="nav-link text-muted small">Home</span>
            <span className="nav-link text-muted small">Children</span>
            <span className="nav-link text-muted small">Holidays</span>
            <span className="nav-link text-muted small">Music</span>
            <span className="nav-link text-muted small">Photography</span>
            <span className="nav-link text-muted small">Film</span>
          </nav>

        </aside>

        {/* Main content - Inspinia ibox style */}
        <main className="mailbox-main">
          {/* Search bar */}
          <div className="mb-3">
            <div className="input-group" style={{ maxWidth: 560 }}>
              <span className="input-group-text bg-white border-end-0">
                <i className="ti ti-search text-muted" />
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Search emails (sender, subject, content)... press Enter"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') performSearch(); }}
              />
              {searchQuery && (
                <button className="btn btn-outline-secondary" type="button" onClick={clearSearch} title="Clear search">
                  <i className="ti ti-x" />
                </button>
              )}
              <button className="btn btn-primary" type="button" onClick={performSearch} title="Search">
                <i className="ti ti-search" />
              </button>
            </div>
            {searchMode && (
              <div className="text-muted small mt-1">
                <i className="ti ti-info-circle me-1" />
                {total} result{total !== 1 ? 's' : ''} found {total > filteredMessages.length ? `(showing ${filteredMessages.length})` : ''}
                {' '}<button className="btn btn-link btn-sm p-0 text-primary" onClick={clearSearch}>Clear search</button>
              </div>
            )}
          </div>

          {selectedUid != null ? (
            /* Email detail view – show when selected, even while body is loading */
            <div className="card mailbox-detail-card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setSelectedUid(null); setMessageBody(null); }}>
                  <i className="ti ti-arrow-left me-1" />
                  Back
                </button>
                {displayEnvelope && (
                  <div className="d-flex gap-2">
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => openReply(displayEnvelope)}>
                      <i className="ti ti-arrow-back-up me-1" />
                      Reply
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openReplyAll(displayEnvelope)}>
                      <i className="ti ti-arrow-back-up me-1" />
                      Reply All
                    </button>
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openForward(displayEnvelope)}>
                      <i className="ti ti-arrow-forward-up me-1" />
                      Forward
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => archiveMessage(selectedUid)}
                      disabled={actionLoading === 'archive'}
                    >
                      {actionLoading === 'archive' ? (
                        <span className="spinner-border spinner-border-sm" />
                      ) : (
                        <><i className="ti ti-archive me-1" />Archive</>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => deleteMessage(selectedUid)}
                      disabled={actionLoading === 'delete'}
                    >
                      {actionLoading === 'delete' ? (
                        <span className="spinner-border spinner-border-sm" />
                      ) : (
                        <><i className="ti ti-trash me-1" />Delete</>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => markMessageRead(selectedUid, !isUnread(selectedMsg!))}
                      disabled={!!actionLoading}
                    >
                      {actionLoading === String(selectedUid) ? (
                        <span className="spinner-border spinner-border-sm" />
                      ) : isUnread(selectedMsg!) ? (
                        <><i className="ti ti-mail-opened me-1" />Mark read</>
                      ) : (
                        <><i className="ti ti-mail me-1" />Mark unread</>
                      )}
                    </button>
                  </div>
                )}
              </div>
              <div className="card-body">
                {selectedMsg && displayEnvelope && (
                  <>
                    <h4 className="mb-4">{(displayEnvelope.subject) || '(No subject)'}</h4>
                    <table className="table table-borderless table-sm mb-4">
                      <tbody>
                        <tr>
                          <td className="text-muted" style={{ width: 80 }}>From:</td>
                          <td>{formatAddresses(displayEnvelope.from)}</td>
                        </tr>
                        <tr>
                          <td className="text-muted">To:</td>
                          <td>{formatAddresses(displayEnvelope.to)}</td>
                        </tr>
                        {displayEnvelope.cc?.length ? (
                          <tr>
                            <td className="text-muted">Cc:</td>
                            <td>{formatAddresses(displayEnvelope.cc)}</td>
                          </tr>
                        ) : null}
                        <tr>
                          <td className="text-muted">Date:</td>
                          <td>{formatDateTime(displayEnvelope.date)}</td>
                        </tr>
                      </tbody>
                    </table>
                    <hr />
                    <div className="mailbox-body">
                      {loadingBody ? (
                        <div className="text-muted py-4"><span className="spinner-border spinner-border-sm me-2" />Loading…</div>
                      ) : messageBody ? (
                        <>
                          {messageBody.html ? (
                            <div className="email-html-body small" dangerouslySetInnerHTML={{ __html: messageBody.html }} />
                          ) : (
                            <pre className="mb-0 small" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{messageBody.text || '—'}</pre>
                          )}
                          {messageBody.attachments?.length > 0 && (
                            <div className="mt-4 pt-3 border-top">
                              <h6 className="mb-3">
                                <i className="ti ti-paperclip me-2" />
                                {messageBody.attachments.length} Attachment{messageBody.attachments.length > 1 ? 's' : ''}
                              </h6>
                              <div className="row g-2">
                                {messageBody.attachments.map((att) => (
                                  <div key={att.index} className="col-12 col-sm-6 col-md-4">
                                    <div
                                      className="border rounded-3 p-3 d-flex align-items-center gap-3 h-100"
                                      style={{ background: '#f8f9fa', transition: 'box-shadow 0.15s', cursor: 'pointer' }}
                                      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)')}
                                      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
                                      onClick={() => handleDownloadAttachment(messageBody.uid, att.index, att.filename)}
                                    >
                                      <div className="rounded-2 d-flex align-items-center justify-content-center" style={{ width: 44, height: 44, background: '#e9ecef', flexShrink: 0 }}>
                                        <i className={`ti ${getFileIcon(att.filename)} fs-4`} style={{ color: '#6c757d' }} />
                                      </div>
                                      <div className="flex-grow-1 overflow-hidden">
                                        <div className="text-truncate small fw-semibold" title={att.filename}>{att.filename}</div>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                          {att.size > 0 ? formatSize(att.size) : att.contentType}
                                        </div>
                                      </div>
                                      <i className="ti ti-download text-primary" style={{ fontSize: '1.1rem', flexShrink: 0 }} />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-muted py-4">Could not load message body.</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Inbox list - Inspinia table */
            <div className="card mailbox-list-card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div className="d-flex align-items-center gap-3">
                  <h2 className="h5 mb-0 fw-semibold">
                    {selectedPath === 'INBOX' ? 'Inbox' : selectedPath} ({total})
                  </h2>
                  {filteredMessages.length > 0 && (
                    <div className="form-check mb-0">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        className="form-check-input"
                        id="selectAllEmails"
                        checked={selectedUids.size > 0 && selectedUids.size === filteredMessages.length}
                        onChange={toggleSelectAll}
                      />
                      <label className="form-check-label small text-muted" htmlFor="selectAllEmails">Select all</label>
                    </div>
                  )}
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  {selectedUids.size > 0 && (
                    <>
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => bulkMarkRead(true)} disabled={!!actionLoading}>
                        {actionLoading === 'bulk' ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="ti ti-mail-opened me-1" />}
                        Mark read ({selectedUids.size})
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => bulkMarkRead(false)} disabled={!!actionLoading}>
                        Mark unread
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={bulkArchive} disabled={!!actionLoading}>
                        {actionLoading === 'bulkArchive' ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="ti ti-archive me-1" />}
                        Archive ({selectedUids.size})
                      </button>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={bulkDelete} disabled={!!actionLoading}>
                        {actionLoading === 'bulkDelete' ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="ti ti-trash me-1" />}
                        Delete ({selectedUids.size})
                      </button>
                    </>
                  )}
                  {messages.length > 0 && unreadCount > 0 && selectedUids.size === 0 && (
                    <button type="button" className="btn btn-sm btn-outline-primary" onClick={markAllRead} disabled={!!actionLoading}>
                      {actionLoading === 'markAll' ? <span className="spinner-border spinner-border-sm me-1" /> : <i className="ti ti-mail-opened me-1" />}
                      Mark all read
                    </button>
                  )}
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setPage(1); setHasMore(true); loadMessages(1, false); }}>
                    <i className="ti ti-refresh me-1" />
                    Refresh
                  </button>
                </div>
              </div>
              <div className="card-body p-0">
                {loadingMessages ? (
                  <div className="text-center py-5 text-muted"><span className="spinner-border spinner-border-sm me-2" />Loading messages…</div>
                ) : filteredMessages.length === 0 ? (
                  <div className="text-center py-5 text-muted">No messages in this folder.</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-hover mb-0 mailbox-table">
                      <thead className="table-light">
                        <tr>
                          <th style={{ width: 36 }} />
                          <th style={{ width: 28 }} />
                          <th style={{ width: '30%' }}>From</th>
                          <th>Subject</th>
                          <th style={{ width: 28 }} />
                          <th className="text-end" style={{ width: '10%' }}>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMessages.map((m) => {
                          const isFlagged = m.flags?.includes('\\Flagged');
                          return (
                            <tr
                              key={m.uid}
                              className={`mailbox-row ${isUnread(m) ? 'mailbox-row-unread' : ''}`}
                              onClick={() => setSelectedUid(m.uid)}
                              style={{ cursor: 'pointer' }}
                            >
                              <td style={{ width: 36 }} className="align-middle" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className="form-check-input"
                                  checked={selectedUids.has(m.uid)}
                                  onChange={() => setSelectedUids((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(m.uid)) next.delete(m.uid);
                                    else next.add(m.uid);
                                    return next;
                                  })}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td style={{ width: 28 }} className="align-middle px-0 text-center" onClick={(e) => { e.stopPropagation(); toggleStar(m.uid, !!isFlagged); }}>
                                <i className={`ti ti-star${isFlagged ? '-filled' : ''}`} style={{ color: isFlagged ? '#f0ad4e' : '#ccc', cursor: 'pointer', fontSize: '1rem' }} />
                              </td>
                              <td className="mailbox-from" style={{ width: '30%' }}>
                                <span className={isUnread(m) ? 'fw-semibold' : ''}>{fromLine(m.envelope)}</span>
                              </td>
                              <td className="mailbox-subject">
                                <span className={isUnread(m) ? 'fw-semibold' : 'text-muted'}>{(m.envelope?.subject) || '(No subject)'}</span>
                              </td>
                              <td style={{ width: 28 }} className="align-middle px-0 text-center text-muted">
                                {m.hasAttachments && <i className="ti ti-paperclip" title="Has attachments" />}
                              </td>
                              <td className="mailbox-date text-muted text-end" style={{ width: '10%' }}>
                                {formatDate(m.envelope?.date)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {/* Infinite scroll sentinel */}
                    {hasMore && !searchMode && (
                      <div ref={sentinelRef} className="text-center py-3">
                        {loadingMore ? (
                          <><span className="spinner-border spinner-border-sm me-2" />Loading more…</>
                        ) : (
                          <span className="text-muted small">Scroll for more</span>
                        )}
                      </div>
                    )}
                    {!hasMore && filteredMessages.length > 0 && (
                      <div className="text-center py-2 text-muted small">
                        Showing all {filteredMessages.length} of {total} messages
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Compose modal */}
      {composeOpen && (
        <div className="modal show d-block" tabIndex={-1} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Compose Mail</h5>
                <button type="button" className="btn-close" onClick={() => setComposeOpen(false)} aria-label="Close" />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <div className="d-flex align-items-center gap-2">
                    <label className="form-label mb-0" style={{ minWidth: 36 }}>To</label>
                    <input type="email" className="form-control" placeholder="recipient@example.com" value={composeTo} onChange={(e) => setComposeTo(e.target.value)} />
                    {!showCc && <button type="button" className="btn btn-sm btn-link text-muted p-0" onClick={() => setShowCc(true)}>CC</button>}
                    {!showBcc && <button type="button" className="btn btn-sm btn-link text-muted p-0" onClick={() => setShowBcc(true)}>BCC</button>}
                  </div>
                </div>
                {showCc && (
                  <div className="mb-3">
                    <div className="d-flex align-items-center gap-2">
                      <label className="form-label mb-0" style={{ minWidth: 36 }}>CC</label>
                      <input type="email" className="form-control" placeholder="cc@example.com" value={composeCc} onChange={(e) => setComposeCc(e.target.value)} />
                    </div>
                  </div>
                )}
                {showBcc && (
                  <div className="mb-3">
                    <div className="d-flex align-items-center gap-2">
                      <label className="form-label mb-0" style={{ minWidth: 36 }}>BCC</label>
                      <input type="email" className="form-control" placeholder="bcc@example.com" value={composeBcc} onChange={(e) => setComposeBcc(e.target.value)} />
                    </div>
                  </div>
                )}
                <div className="mb-3">
                  <label className="form-label">Subject</label>
                  <input type="text" className="form-control" placeholder="Subject" value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} />
                </div>
                <div className="mb-3">
                  <label className="form-label">Attachments</label>
                  <input ref={fileInputRef} type="file" className="d-none" multiple onChange={addComposeAttachment} />
                  {/* Drop zone */}
                  <div
                    className={`rounded-3 text-center py-3 px-3 ${composeDragOver ? 'bg-primary bg-opacity-10' : ''}`}
                    style={{
                      border: `2px dashed ${composeDragOver ? '#0d6efd' : '#dee2e6'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setComposeDragOver(true); }}
                    onDragLeave={() => setComposeDragOver(false)}
                    onDrop={handleComposeDrop}
                  >
                    <i className={`ti ti-cloud-upload fs-2 d-block mb-1 ${composeDragOver ? 'text-primary' : 'text-muted'}`} />
                    <div className="small text-muted">
                      {composeDragOver ? (
                        <span className="text-primary fw-medium">Drop files here</span>
                      ) : (
                        <>Drag & drop files here, or <span className="text-primary fw-medium">browse</span></>
                      )}
                    </div>
                  </div>
                  {/* File cards */}
                  {composeAttachments.length > 0 && (
                    <div className="mt-2 d-flex flex-column gap-2">
                      {composeAttachments.map((a) => (
                        <div
                          key={a.id}
                          className="d-flex align-items-center gap-3 border rounded-3 p-2 ps-3"
                          style={{ background: '#f8f9fa', transition: 'background 0.15s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#e9ecef')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#f8f9fa')}
                        >
                          <div className="rounded-2 d-flex align-items-center justify-content-center" style={{ width: 36, height: 36, background: '#dee2e6', flexShrink: 0 }}>
                            <i className={`ti ${getFileIcon(a.file.name)}`} style={{ fontSize: '1.1rem', color: '#495057' }} />
                          </div>
                          <div className="flex-grow-1 overflow-hidden">
                            <div className="text-truncate small fw-medium" title={a.file.name}>{a.file.name}</div>
                            <div className="text-muted" style={{ fontSize: '0.7rem' }}>{formatSize(a.file.size)}</div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost text-danger p-1 d-flex align-items-center"
                            onClick={() => removeComposeAttachment(a.id)}
                            title="Remove"
                            style={{ lineHeight: 1 }}
                          >
                            <i className="ti ti-x fs-5" />
                          </button>
                        </div>
                      ))}
                      <div className="text-muted small">
                        {composeAttachments.length} file{composeAttachments.length > 1 ? 's' : ''} ({formatSize(composeAttachments.reduce((s, a) => s + a.file.size, 0))})
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="d-flex align-items-center justify-content-between mb-1">
                    <label className="form-label mb-0">Message</label>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm d-flex align-items-center gap-1"
                      onClick={openImproveModal}
                      disabled={sending || !composeBody.trim() || improveLoading || improveModal != null}
                      title="Improve message with AI"
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
                  </div>
                  <textarea className="form-control" rows={10} value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder="Write your message…" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setComposeOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={sendMail} disabled={sending || !composeTo.trim()}>
                  {sending ? <><span className="spinner-border spinner-border-sm me-2" />Sending…</> : <><i className="ti ti-send me-2" />Send</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Improve modal (for compose) */}
      {composeOpen && improveModal != null && (
        <div className="position-fixed top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center p-3 bg-dark bg-opacity-25" style={{ zIndex: 1060 }} onClick={() => { setImproveModal(null); setImproveError(null); }}>
          <div className="bg-white rounded-3 shadow p-3 w-100" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="fw-semibold d-flex align-items-center gap-2">
                <i className="ti ti-sparkles text-primary" />
                Improve email
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
              <div className="p-2 rounded bg-light small" style={{ maxHeight: 120, overflowY: 'auto' }}>{improveModal.original}</div>
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
                  <div className="p-2 rounded bg-success bg-opacity-10 border border-success border-opacity-25 small" style={{ maxHeight: 180, overflowY: 'auto' }}>{improveModal.improved}</div>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => applyImprove(improveModal.improved)}>
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
    </div>
  );
}
