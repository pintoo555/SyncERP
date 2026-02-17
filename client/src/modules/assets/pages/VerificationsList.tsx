import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { formatDateTimeInAppTz } from '../../../utils/dateUtils';

interface VerificationRow {
  verificationId: number;
  assetId: number;
  assetTag: string;
  verifiedAt: string;
  verifiedByUserId: number;
  verifiedByUserName: string;
  locationId: number | null;
  locationName: string | null;
  notes: string | null;
  verifiedStatus: string | null;
}

export default function VerificationsList() {
  const { timeZone } = useAppSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const assetIdParam = searchParams.get('assetId');
  const pageParam = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  const [data, setData] = useState<VerificationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(pageParam);
  const [assetIdFilter, setAssetIdFilter] = useState(assetIdParam ? parseInt(assetIdParam, 10) : ('' as number | ''));
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  const loadList = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (assetIdFilter !== '') params.set('assetId', String(assetIdFilter));
    api.get<{ success: boolean; data: VerificationRow[]; total: number }>(`/api/verification?${params}`)
      .then((res) => {
        setData(res.data ?? []);
        setTotal(res.total ?? 0);
      })
      .catch(() => {
        setData([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, assetIdFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    if (assetIdFilter !== '') next.set('assetId', String(assetIdFilter));
    else next.delete('assetId');
    setSearchParams(next, { replace: true });
  }, [page, assetIdFilter]);

  const applyFilters = () => {
    setPage(1);
    loadList();
  };

  return (
    <div className="container-fluid">
      <h4 className="mb-4">Assets Verification</h4>

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label small mb-0">Asset ID</label>
              <input
                type="number"
                className="form-control form-control-sm"
                placeholder="Optional"
                value={assetIdFilter === '' ? '' : assetIdFilter}
                onChange={(e) => setAssetIdFilter(e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
                min={1}
              />
            </div>
            <div className="col-auto">
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={applyFilters}>
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Verified at</th>
                  <th>Asset</th>
                  <th>Verified by</th>
                  <th>Location</th>
                  <th>Notes</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={6} className="text-center py-4 text-muted">Loading...</td></tr>
                )}
                {!loading && data.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-4 text-muted">No verifications found.</td></tr>
                )}
                {!loading && data.map((v) => (
                  <tr key={v.verificationId}>
                    <td className="small">{formatDateTimeInAppTz(v.verifiedAt, timeZone)}</td>
                    <td>
                      <Link to={`/assets/${v.assetId}`} className="text-decoration-none">{v.assetTag}</Link>
                    </td>
                    <td>{v.verifiedByUserName}</td>
                    <td>{v.locationName ?? '—'}</td>
                    <td className="small text-muted">{v.notes ?? '—'}</td>
                    <td>{v.verifiedStatus ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && total > pageSize && (
            <div className="d-flex justify-content-between align-items-center p-3 border-top">
              <span className="small text-muted">Total: {total}</span>
              <div>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary me-1"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <span className="mx-2">Page {page}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary ms-1"
                  disabled={page * pageSize >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
