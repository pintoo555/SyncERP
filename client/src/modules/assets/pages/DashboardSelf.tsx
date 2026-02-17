import { useEffect, useState, useCallback } from 'react';
import { api } from '../../../api/client';
import { Link } from 'react-router-dom';
import { useRealtime, NewAssetPayload } from '../../../hooks/useRealtime';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface NewAssetToast {
  id: number;
  assetTag: string;
  addedByName: string;
}

interface MyAssetRow {
  assetId: number;
  assetTag: string;
  categoryName: string | null;
  status: string;
  purchasePrice: number | null;
  warrantyExpiry: string | null;
  locationName: string | null;
}
interface MyAssetsData {
  assets: MyAssetRow[];
  totalCount: number;
  totalPurchaseValue: number;
  warrantyExpiringCount: number;
  warrantyExpiredCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#198754',
  ISSUED: '#0d6efd',
  UNDER_REPAIR: '#fd7e14',
  SCRAPPED: '#6c757d',
  LOST: '#dc3545',
};

let toastId = 0;
const TOAST_AUTO_DISMISS_MS = 7000;

export default function DashboardSelf() {
  const [data, setData] = useState<MyAssetsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<NewAssetToast[]>([]);

  const load = useCallback(() => {
    api.get<{ success: boolean; data: MyAssetRow[]; total: number; summary: { totalPurchaseValue: number; warrantyExpiringCount: number; warrantyExpiredCount: number } }>('/api/my/assets')
      .then((res) => {
        const summary = res.summary ?? { totalPurchaseValue: 0, warrantyExpiringCount: 0, warrantyExpiredCount: 0 };
        setData({
          assets: res.data,
          totalCount: res.total,
          totalPurchaseValue: summary.totalPurchaseValue,
          warrantyExpiringCount: summary.warrantyExpiringCount,
          warrantyExpiredCount: summary.warrantyExpiredCount,
        });
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const addToast = useCallback((payload: NewAssetPayload) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, assetTag: payload.assetTag, addedByName: payload.addedByName }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_AUTO_DISMISS_MS);
  }, []);

  useRealtime({ onUpdate: load, onNewAsset: addToast });

  useEffect(() => {
    document.title = 'Assets Dashboard | Synchronics ERP';
    return () => { document.title = 'Synchronics ERP'; };
  }, []);

  if (loading && !data) return <div className="text-muted">Loading dashboard...</div>;
  if (!data) return <div className="alert alert-warning">Could not load dashboard.</div>;

  const statusCounts = data.assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});
  const chartData = Object.entries(statusCounts).map(([name, count]) => ({ name, value: count }));

  return (
    <div className="container-fluid">
      <h4 className="mb-4">Assets Dashboard</h4>
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card p-3">
            <h6 className="text-muted small">My Assets</h6>
            <h3 className="mb-0">{data.totalCount}</h3>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card p-3">
            <h6 className="text-muted small">Total Value</h6>
            <h3 className="mb-0">{data.totalPurchaseValue.toLocaleString()}</h3>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card p-3">
            <h6 className="text-muted small">Warranty Expiring (30d)</h6>
            <h3 className="mb-0">{data.warrantyExpiringCount}</h3>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card p-3">
            <h6 className="text-muted small">Warranty Expired</h6>
            <h3 className="mb-0">{data.warrantyExpiredCount}</h3>
          </div>
        </div>
      </div>
      <div className="row g-3 mb-4">
        {chartData.length > 0 && (
          <div className="col-md-5">
            <div className="card">
              <div className="card-header"><h6 className="mb-0">My assets by status</h6></div>
              <div className="card-body" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#6c757d'} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Assets assigned to me</h5>
          <Link to="/assets/my" className="btn btn-sm btn-primary">View all</Link>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Warranty</th>
                </tr>
              </thead>
              <tbody>
                {data.assets.slice(0, 10).map((a) => (
                  <tr key={a.assetId}>
                    <td><Link to={`/assets/${a.assetId}`}>{a.assetTag}</Link></td>
                    <td>{a.categoryName ?? '-'}</td>
                    <td><span className="badge bg-secondary">{a.status}</span></td>
                    <td>{a.locationName ?? '-'}</td>
                    <td>{a.warrantyExpiry ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.assets.length === 0 && <p className="p-4 text-muted mb-0">No assets assigned to you.</p>}
        </div>
      </div>

      {/* Bottom toasts: new asset added (realtime) */}
      <div className="position-fixed bottom-0 start-0 end-0 p-3 d-flex flex-column align-items-center gap-2" style={{ zIndex: 1050, pointerEvents: 'none' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="alert alert-info shadow-sm mb-0 py-2 px-3 d-flex align-items-center gap-2"
            style={{ minWidth: 280, maxWidth: 400 }}
          >
            <span className="small">
              <strong>New asset:</strong> {t.assetTag} added by <strong>{t.addedByName}</strong>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
