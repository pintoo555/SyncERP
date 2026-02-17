import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { formatDateTimeInAppTz } from '../../../utils/dateUtils';
import { SearchableSelect } from '../../../components/SearchableSelect';

interface TicketRow {
  ticketId: number;
  assetId: number;
  assetTag: string;
  ticketNumber: string;
  subject: string;
  description: string | null;
  status: string;
  vendorId: number | null;
  vendorName: string | null;
  reportedByUserId: number | null;
  reportedByUserName: string | null;
  reportedAt: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  cost: number | null;
}

const STATUS_OPTIONS = ['', 'OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED'];

export default function TicketsList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const assetIdParam = searchParams.get('assetId');
  const statusParam = searchParams.get('status') ?? '';
  const pageParam = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));

  const [data, setData] = useState<TicketRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(pageParam);
  const [statusFilter, setStatusFilter] = useState(statusParam);
  const [assetIdFilter, setAssetIdFilter] = useState(assetIdParam ? parseInt(assetIdParam, 10) : ('' as number | ''));
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { timeZone } = useAppSettings();
  const pageSize = 20;

  const canCreate = user?.permissions?.includes('TICKET.CREATE');

  const loadList = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (statusFilter) params.set('status', statusFilter);
    if (assetIdFilter !== '') params.set('assetId', String(assetIdFilter));
    api.get<{ success: boolean; data: TicketRow[]; total: number }>(`/api/tickets?${params}`)
      .then((res) => {
        setData(res.data ?? []);
        setTotal(res.total ?? 0);
      })
      .catch(() => {
        setData([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, statusFilter, assetIdFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    next.set('page', String(page));
    if (statusFilter) next.set('status', statusFilter); else next.delete('status');
    if (assetIdFilter !== '') next.set('assetId', String(assetIdFilter)); else next.delete('assetId');
    setSearchParams(next, { replace: true });
  }, [page, statusFilter, assetIdFilter]);

  const applyFilters = () => {
    setPage(1);
    loadList();
  };

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4">
        <h4 className="mb-0">Assets Tickets</h4>
        {canCreate && (
          <Link to="/assets/tickets/new" className="btn btn-primary">
            New ticket
          </Link>
        )}
      </div>

      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label small mb-0">Status</label>
              <SearchableSelect
                size="sm"
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: s || 'All' }))}
                value={statusFilter}
                onChange={(v) => setStatusFilter(String(v))}
                placeholder="All"
                allowEmpty={false}
              />
            </div>
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
                  <th>Ticket #</th>
                  <th>Asset</th>
                  <th>Subject</th>
                  <th>Status</th>
                  <th>Reported by</th>
                  <th>Reported at</th>
                  <th>Resolved at</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="text-center py-4 text-muted">Loading...</td></tr>
                )}
                {!loading && data.length === 0 && (
                  <tr><td colSpan={7} className="text-center py-4 text-muted">No tickets found.</td></tr>
                )}
                {!loading && data.map((t) => (
                  <tr key={t.ticketId}>
                    <td>
                      <Link to={`/tickets/${t.ticketId}`} className="text-decoration-none fw-semibold">
                        {t.ticketNumber}
                      </Link>
                    </td>
                    <td>
                      <Link to={`/assets/${t.assetId}`} className="text-decoration-none">{t.assetTag}</Link>
                    </td>
                    <td>{t.subject}</td>
                    <td>
                      <span className={`badge ${t.status === 'CLOSED' || t.status === 'RESOLVED' ? 'bg-success' : 'bg-warning text-dark'}`}>
                        {t.status}
                      </span>
                    </td>
                    <td>{t.reportedByUserName ?? '—'}</td>
                    <td className="small">{t.reportedAt ? formatDateTimeInAppTz(t.reportedAt, timeZone) : '—'}</td>
                    <td className="small">{t.resolvedAt ? formatDateTimeInAppTz(t.resolvedAt, timeZone) : '—'}</td>
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
