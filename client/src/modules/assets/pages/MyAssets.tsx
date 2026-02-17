import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';

interface MyAssetRow {
  assetId: number;
  assetTag: string;
  categoryName: string | null;
  status: string;
  purchasePrice: number | null;
  warrantyExpiry: string | null;
  locationName: string | null;
}

export default function MyAssets() {
  const [data, setData] = useState<MyAssetRow[]>([]);
  const [summary, setSummary] = useState<{ totalPurchaseValue: number; warrantyExpiringCount: number; warrantyExpiredCount: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ success: boolean; data: MyAssetRow[]; total: number; summary: { totalPurchaseValue: number; warrantyExpiringCount: number; warrantyExpiredCount: number } }>('/api/my/assets')
      .then((res) => {
        setData(res.data);
        setSummary(res.summary ?? null);
      })
      .catch(() => { setData([]); setSummary(null); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container-fluid">
      <h4 className="mb-4">My Assets</h4>
      {summary != null && (
        <div className="row g-3 mb-4">
          <div className="col-md-4">
            <div className="card p-3">
              <h6 className="text-muted small">Total purchase value</h6>
              <h4 className="mb-0">{summary.totalPurchaseValue.toLocaleString()}</h4>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card p-3">
              <h6 className="text-muted small">Warranty expiring (30 days)</h6>
              <h4 className="mb-0">{summary.warrantyExpiringCount}</h4>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card p-3">
              <h6 className="text-muted small">Warranty expired</h6>
              <h4 className="mb-0">{summary.warrantyExpiredCount}</h4>
            </div>
          </div>
        </div>
      )}
      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Value</th>
                  <th>Warranty</th>
                  <th>Location</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={7} className="text-center py-4 text-muted">Loading...</td></tr>}
                {!loading && data.map((a) => (
                  <tr key={a.assetId}>
                    <td><Link to={`/assets/${a.assetId}`}>{a.assetTag}</Link></td>
                    <td>{a.categoryName ?? '-'}</td>
                    <td><span className="badge bg-secondary">{a.status}</span></td>
                    <td>{a.purchasePrice != null ? a.purchasePrice.toLocaleString() : '-'}</td>
                    <td>{a.warrantyExpiry ?? '-'}</td>
                    <td>{a.locationName ?? '-'}</td>
                    <td><Link to={`/assets/${a.assetId}`} className="btn btn-sm btn-outline-primary">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && data.length === 0 && <p className="p-4 text-muted mb-0">No assets assigned to you.</p>}
        </div>
      </div>
    </div>
  );
}
