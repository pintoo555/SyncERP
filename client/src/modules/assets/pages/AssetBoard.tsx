import { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { useKanbanSocket } from '../../../hooks/useKanbanSocket';
import { KanbanToasts, type KanbanToast } from '../../../components/KanbanToasts';

const COLUMNS: { key: string; label: string; bg: string }[] = [
  { key: 'AVAILABLE', label: 'Available', bg: 'bg-success bg-opacity-10' },
  { key: 'ISSUED', label: 'Issued', bg: 'bg-primary bg-opacity-10' },
  { key: 'UNDER_REPAIR', label: 'Under repair', bg: 'bg-warning bg-opacity-10' },
  { key: 'SCRAPPED', label: 'Scrapped', bg: 'bg-secondary bg-opacity-10' },
  { key: 'LOST', label: 'Lost', bg: 'bg-danger bg-opacity-10' },
];

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Available',
  ISSUED: 'Issued',
  UNDER_REPAIR: 'Under repair',
  SCRAPPED: 'Scrapped',
  LOST: 'Lost',
};

const COLUMN_ORDER_KEY = 'asset-kanban-order';

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

interface AssetCard {
  assetId: number;
  assetTag: string;
  categoryName: string | null;
  status: string;
  assignedToUserName: string | null;
  locationName: string | null;
}

export default function AssetBoard() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<AssetCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [moving, setMoving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<KanbanToast[]>([]);
  const [activeAssetId, setActiveAssetId] = useState<number | null>(null);
  const activityTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [columnOrder, setColumnOrder] = useState<Record<string, number[]>>(() => {
    try {
      const s = localStorage.getItem(COLUMN_ORDER_KEY);
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  });

  const canChangeStatus = user?.permissions?.includes('ASSET.CHANGE_STATUS');

  const loadAssets = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<{ success: boolean; data: AssetCard[]; total: number }>('/api/assets?pageSize=500')
      .then((res) => setAssets(res.data ?? []))
      .catch(() => { setAssets([]); setError('Failed to load assets'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAssets(); }, [loadAssets]);

  useEffect(() => () => {
    if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
  }, []);

  const setCardActive = useCallback((assetId: number) => {
    if (activityTimeoutRef.current) clearTimeout(activityTimeoutRef.current);
    setActiveAssetId(assetId);
    activityTimeoutRef.current = setTimeout(() => {
      setActiveAssetId(null);
      activityTimeoutRef.current = null;
    }, 2500);
  }, []);

  const addToast = useCallback((text: string) => {
    const id = Date.now();
    setToasts((prev) => [...prev.slice(-4), { id, text }]);
  }, []);

  const { emitAssetOrder } = useKanbanSocket({
    onNewAsset: useCallback((payload: import('../../../hooks/useKanbanSocket').NewAssetPayload) => {
      loadAssets();
      addToast(`New asset ${payload.assetTag} added by ${payload.addedByName}`);
    }, [loadAssets, addToast]),
    onAssetChanged: useCallback((payload: import('../../../hooks/useKanbanSocket').AssetChangedPayload) => {
      const hasUpdate = payload.status != null || payload.assignedToUserName !== undefined || payload.assignedToUserId !== undefined;
      if (!hasUpdate) return;
      setAssets((prev) => {
        const a = prev.find((x) => x.assetId === payload.assetId);
        if (!a) return prev;
        const next = prev.map((asset) =>
          asset.assetId === payload.assetId
            ? {
                ...asset,
                ...(payload.status != null && { status: payload.status }),
                ...(payload.assignedToUserId !== undefined && { assignedToUserName: payload.assignedToUserName ?? null }),
              }
            : asset
        );
        const label = payload.status != null ? STATUS_LABELS[payload.status] ?? payload.status : 'reassigned';
        const msg =
          payload.assignedToUserName != null && payload.assignedToUserName !== ''
            ? `Asset ${a.assetTag} → ${payload.assignedToUserName} by ${payload.userName ?? 'someone'}`
            : `Asset ${a.assetTag} → ${label} by ${payload.userName ?? 'someone'}`;
        addToast(msg);
        return next;
      });
      setCardActive(payload.assetId);
    }, [addToast, setCardActive]),
    onAssetOrderChanged: useCallback((payload: import('../../../hooks/useKanbanSocket').KanbanOrderPayload) => {
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

  const assetsByStatus = COLUMNS.reduce<Record<string, AssetCard[]>>((acc, col) => {
    acc[col.key] = assets.filter((a) => a.status === col.key);
    return acc;
  }, {});

  const orderedAssetsByStatus = COLUMNS.reduce<Record<string, AssetCard[]>>((acc, col) => {
    const list = assetsByStatus[col.key] ?? [];
    const order = columnOrder[col.key];
    acc[col.key] = order?.length ? sortByOrder(list, order, (a) => a.assetId) : list;
    return acc;
  }, {});

  const handleDragStart = (e: React.DragEvent, assetId: number, status: string) => {
    if (!canChangeStatus) { e.preventDefault(); return; }
    e.dataTransfer.setData('application/json', JSON.stringify({ assetId, status }));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = canChangeStatus ? 'move' : 'none';
  };

  const changeStatus = useCallback((payload: { assetId: number; status: string }, newStatus: string) => {
    if (payload.status === newStatus) return;
    setMoving(payload.assetId);
    setError(null);
    api.patch(`/api/assets/${payload.assetId}/status`, { status: newStatus })
      .then(() => {
        setAssets((prev) =>
          prev.map((a) => (a.assetId === payload.assetId ? { ...a, status: newStatus } : a))
        );
        setCardActive(payload.assetId);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to update status'))
      .finally(() => setMoving(null));
  }, []);

  const handleDropOnColumn = (e: React.DragEvent, newStatus: string) => {
    e.preventDefault();
    if (!canChangeStatus) return;
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as { assetId: number; status: string };
      changeStatus(payload, newStatus);
    } catch {
      // ignore
    }
  };

  const handleDropOnCard = (e: React.DragEvent, targetAssetId: number, targetColumnKey: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!canChangeStatus) return;
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    let payload: { assetId: number; status: string };
    try {
      payload = JSON.parse(raw);
    } catch {
      return;
    }
    if (payload.assetId === targetAssetId) return;
    if (payload.status === targetColumnKey) {
      const list = assetsByStatus[targetColumnKey] ?? [];
      const baseOrder = columnOrder[targetColumnKey] ?? [];
      const order = [...baseOrder];
      for (const a of list) {
        if (!order.includes(a.assetId)) order.push(a.assetId);
      }
      const idx = order.indexOf(payload.assetId);
      const targetIdx = order.indexOf(targetAssetId);
      if (idx === -1 || targetIdx === -1) return;
      const newOrder = order.filter((id) => id !== payload.assetId);
      const insertAt = newOrder.indexOf(targetAssetId);
      newOrder.splice(insertAt, 0, payload.assetId);
      const next = { ...columnOrder, [targetColumnKey]: newOrder };
      setColumnOrder(next);
      try {
        localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      emitAssetOrder(targetColumnKey, newOrder);
    } else {
      changeStatus(payload, targetColumnKey);
    }
  };

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <h4 className="mb-0">Assets – Asset Board</h4>
        <Link to="/assets" className="btn btn-sm btn-outline-secondary">List view</Link>
      </div>
      {error && <div className="alert alert-danger py-2 small mb-2">{error}</div>}
      {loading ? (
        <div className="text-muted py-5">Loading assets...</div>
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
                <span className="badge bg-secondary ms-2">{orderedAssetsByStatus[col.key]?.length ?? 0}</span>
              </div>
              <div className="p-2 d-flex flex-column gap-2" style={{ minHeight: 320 }}>
                {(orderedAssetsByStatus[col.key] ?? []).map((a) => (
                  <div
                    key={a.assetId}
                    draggable={canChangeStatus}
                    onDragStart={(e) => handleDragStart(e, a.assetId, a.status)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnCard(e, a.assetId, col.key)}
                    className={`card shadow-sm border position-relative ${activeAssetId === a.assetId ? 'kanban-card-activity' : ''}`}
                    style={{ opacity: moving === a.assetId ? 0.6 : 1, cursor: canChangeStatus ? 'grab' : 'default' }}
                    title={activeAssetId === a.assetId ? 'Recent activity' : undefined}
                  >
                    {activeAssetId === a.assetId && <span className="kanban-activity-dot" aria-hidden />}
                    <div className="card-body p-2">
                      <Link to={`/assets/${a.assetId}`} className="text-decoration-none fw-semibold d-block text-dark">
                        {a.assetTag}
                      </Link>
                      <div className="small text-muted">{a.categoryName ?? '—'}</div>
                      {a.assignedToUserName && (
                        <div className="small text-muted">Assigned: {a.assignedToUserName}</div>
                      )}
                      {a.locationName && (
                        <div className="small text-muted">{a.locationName}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {!canChangeStatus && !loading && <p className="small text-muted mt-2">You need ASSET.CHANGE_STATUS to move cards.</p>}
      <KanbanToasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
