import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { useKanbanSocket } from '../../../hooks/useKanbanSocket';
import { KanbanToasts, type KanbanToast } from '../../../components/KanbanToasts';

const COLUMNS: { key: string; label: string; bg: string }[] = [
  { key: 'OPEN', label: 'Open', bg: 'bg-light' },
  { key: 'IN_PROGRESS', label: 'In progress', bg: 'bg-info bg-opacity-10' },
  { key: 'ON_HOLD', label: 'On hold', bg: 'bg-warning bg-opacity-10' },
  { key: 'RESOLVED', label: 'Resolved', bg: 'bg-success bg-opacity-10' },
  { key: 'CLOSED', label: 'Closed', bg: 'bg-secondary bg-opacity-10' },
];

const STATUS_LABELS: Record<string, string> = {
  OPEN: 'Open',
  IN_PROGRESS: 'In progress',
  ON_HOLD: 'On hold',
  RESOLVED: 'Resolved',
  CLOSED: 'Closed',
  DELETED: 'Removed',
};

const COLUMN_ORDER_KEY = 'ticket-kanban-order';

function sortByOrder<T>(items: T[], order: number[], getId: (t: T) => number): T[] {
  if (!order.length) return items;
  return [...items].sort((a, b) => {
    const ia = order.indexOf(getId(a));
    const ib = order.indexOf(getId(b));
    if (ia === -1 && ib === -1) return 0;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

interface TicketCard {
  ticketId: number;
  assetId: number;
  assetTag: string;
  ticketNumber: string;
  subject: string;
  status: string;
  reportedByUserName: string | null;
  reportedAt: string;
}

export default function TicketBoard() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<TicketCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<KanbanToast[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<number | null>(null);
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [columnOrder, setColumnOrder] = useState<Record<string, number[]>>(() => {
    try {
      const s = localStorage.getItem(COLUMN_ORDER_KEY);
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  });

  const canEdit = user?.permissions?.includes('TICKET.EDIT');
  const canMove = canEdit; // Resolved/Closed can still be moved by API (e.g. reopen)

  const loadTickets = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<{ success: boolean; data: TicketCard[]; total: number }>('/api/tickets?pageSize=500')
      .then((res) => setTickets(res.data ?? []))
      .catch(() => { setTickets([]); setError('Failed to load tickets'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  useEffect(() => () => {
    if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
  }, []);

  const addToast = useCallback((text: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev.slice(-4), { id, text }]);
  }, []);

  const setCardActive = useCallback((ticketId: number) => {
    if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
    setActiveTicketId(ticketId);
    activityTimeoutRef.current = setTimeout(() => {
      setActiveTicketId(null);
      activityTimeoutRef.current = null;
    }, 2500);
  }, []);

  const { emitTicketOrder } = useKanbanSocket({
    onTicketChanged: useCallback((payload: import('../../../hooks/useKanbanSocket').TicketChangedPayload) => {
      if (payload.status === 'DELETED') {
        setTickets((prev) => {
          const t = prev.find((x) => x.ticketId === payload.ticketId);
          addToast(t ? `Ticket ${t.ticketNumber} removed by ${payload.userName ?? 'someone'}` : `Ticket removed by ${payload.userName ?? 'someone'}`);
          return prev.filter((x) => x.ticketId !== payload.ticketId);
        });
        return;
      }
      if (payload.status) {
        const status = payload.status;
        setTickets((prev) => {
          const next = prev.map((t) =>
            t.ticketId === payload.ticketId ? { ...t, status } : t
          );
          const t = prev.find((x) => x.ticketId === payload.ticketId);
          const label = STATUS_LABELS[status] ?? status;
          addToast(t ? `Ticket ${t.ticketNumber} → ${label} by ${payload.userName ?? 'someone'}` : `Ticket updated → ${label} by ${payload.userName ?? 'someone'}`);
          return next;
        });
        setCardActive(payload.ticketId);
      }
    }, [addToast, setCardActive]),
    onTicketOrderChanged: useCallback((payload: import('../../../hooks/useKanbanSocket').KanbanOrderPayload) => {
      setColumnOrder((prev) => {
        const next = { ...prev, [payload.columnKey]: payload.order };
        try {
          localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    }, []),
  });

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const ticketsByStatus = COLUMNS.reduce<Record<string, TicketCard[]>>((acc, col) => {
    acc[col.key] = tickets.filter((t) => t.status === col.key);
    return acc;
  }, {});

  const orderedTicketsByStatus = COLUMNS.reduce<Record<string, TicketCard[]>>((acc, col) => {
    const list = ticketsByStatus[col.key] ?? [];
    const order = columnOrder[col.key];
    acc[col.key] = order?.length ? sortByOrder(list, order, (t) => t.ticketId) : list;
    return acc;
  }, {});

  const handleDragStart = (e: React.DragEvent, ticketId: number, status: string) => {
    if (!canMove) { e.preventDefault(); return; }
    e.dataTransfer.setData('application/json', JSON.stringify({ ticketId, status }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = canMove ? 'move' : 'none';
  };

  const changeStatus = useCallback((payload: { ticketId: number; status: string }, newStatus: string) => {
    if (payload.status === newStatus) return;
    setMoving(payload.ticketId);
    setError(null);
    api.put(`/api/tickets/${payload.ticketId}`, { status: newStatus })
      .then(() => {
        setTickets((prev) =>
          prev.map((t) => (t.ticketId === payload.ticketId ? { ...t, status: newStatus } : t))
        );
        setCardActive(payload.ticketId);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to update ticket'))
      .finally(() => setMoving(null));
  }, []);

  const handleDropOnColumn = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (!canMove) return;
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as { ticketId: number; status: string };
      changeStatus(payload, newStatus);
    } catch {
      // ignore
    }
  };

  const handleDropOnCard = (e: React.DragEvent, targetTicketId: number, targetColumnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canMove) return;
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    let payload: { ticketId: number; status: string };
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (payload.ticketId === targetTicketId) return;
    if (payload.status === targetColumnKey) {
      const list = ticketsByStatus[targetColumnKey] ?? [];
      const baseOrder = columnOrder[targetColumnKey] ?? [];
      const order = [...baseOrder];
      for (const t of list) {
        if (!order.includes(t.ticketId)) order.push(t.ticketId);
      }
      const idx = order.indexOf(payload.ticketId);
      const targetIdx = order.indexOf(targetTicketId);
      if (idx === -1 || targetIdx === -1) return;
      const newOrder = order.filter((id) => id !== payload.ticketId);
      const insertAt = newOrder.indexOf(targetTicketId);
      newOrder.splice(insertAt, 0, payload.ticketId);
      const next = { ...columnOrder, [targetColumnKey]: newOrder };
      setColumnOrder(next);
      try {
        localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      emitTicketOrder(targetColumnKey, newOrder);
    } else {
      changeStatus(payload, targetColumnKey);
    }
  };

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <h4 className="mb-0">Assets Tickets Board</h4>
        <Link to="/assets/tickets" className="btn btn-sm btn-outline-secondary">List view</Link>
      </div>
      {error && <div className="alert alert-danger py-2 small mb-2">{error}</div>}
      {loading ? (
        <div className="text-muted py-5">Loading tickets...</div>
      ) : (
        <div className="d-flex gap-2 overflow-auto pb-2" style={{ minHeight: 400 }}>
          {COLUMNS.map((col) => (
            <div
              key={col.key}
              className={`flex-shrink-0 rounded border ${col.bg}`}
              style={{ width: 280, minHeight: 360 }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnColumn(e, col.key)}
            >
              <div className="p-2 border-bottom bg-white bg-opacity-50 rounded-top">
                <strong>{col.label}</strong>
                <span className="badge bg-secondary ms-2">{orderedTicketsByStatus[col.key]?.length ?? 0}</span>
              </div>
              <div className="p-2 d-flex flex-column gap-2" style={{ minHeight: 320 }}>
                {(orderedTicketsByStatus[col.key] ?? []).map((t) => (
                  <div
                    key={t.ticketId}
                    draggable={canMove}
                    onDragStart={(e) => handleDragStart(e, t.ticketId, t.status)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnCard(e, t.ticketId, col.key)}
                    className={`card shadow-sm border position-relative ${activeTicketId === t.ticketId ? 'kanban-card-activity' : ''}`}
                    style={{ opacity: moving === t.ticketId ? 0.6 : 1, cursor: canMove ? 'grab' : 'default' }}
                    title={activeTicketId === t.ticketId ? 'Recent activity' : undefined}
                  >
                    {activeTicketId === t.ticketId && <span className="kanban-activity-dot" aria-hidden />}
                    <div className="card-body p-2">
                      <Link to={`/tickets/${t.ticketId}`} className="text-decoration-none fw-semibold d-block text-dark" onClick={(e) => canMove && e.stopPropagation()}>
                        {t.ticketNumber}
                      </Link>
                      <div className="small text-truncate" title={t.subject}>{t.subject}</div>
                      <div className="small text-muted">
                        <Link to={`/assets/${t.assetId}`} className="text-muted">{t.assetTag}</Link>
                        {t.reportedByUserName && ` · ${t.reportedByUserName}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {!canEdit && !loading && <p className="small text-muted mt-2">You need TICKET.EDIT to move cards.</p>}
      <KanbanToasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
