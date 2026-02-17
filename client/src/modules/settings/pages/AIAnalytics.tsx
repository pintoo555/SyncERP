/**
 * AI Analytics Dashboard: usage stats, top users by API calls, model breakdown, search.
 */

import { useEffect, useState, useCallback } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';

interface UsageStats {
  totalCalls: number;
  byUser: Array<{ userId: number; userName: string; callCount: number }>;
  byModel: Array<{ serviceCode: string; displayName: string; model: string; callCount: number }>;
  byFeature: Array<{ feature: string; callCount: number }>;
  recentLogs: Array<{
    logId: number;
    userId: number;
    userName: string;
    serviceCode: string | null;
    displayName: string | null;
    model: string | null;
    feature: string;
    requestedAt: string;
  }>;
}

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function AIAnalytics() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    serviceCode: '',
    model: '',
    feature: '',
    dateFrom: '',
    dateTo: '',
  });

  const loadStats = useCallback((currentFilters = filters) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (currentFilters.search.trim()) params.set('search', currentFilters.search.trim());
    if (currentFilters.serviceCode.trim()) params.set('serviceCode', currentFilters.serviceCode.trim());
    if (currentFilters.model.trim()) params.set('model', currentFilters.model.trim());
    if (currentFilters.feature.trim()) params.set('feature', currentFilters.feature.trim());
    if (currentFilters.dateFrom) params.set('dateFrom', currentFilters.dateFrom);
    if (currentFilters.dateTo) params.set('dateTo', currentFilters.dateTo);

    api.get<{ success: boolean; data: UsageStats }>(`/api/ai-analytics?${params.toString()}`)
      .then((res) => setStats(res.data ?? null))
      .catch((e) => setError(e?.message ?? 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadStats(filters); }, []);

  const canView = user?.permissions?.includes('AI_CONFIG.VIEW');

  if (!canView) {
    return (
      <div className="p-4">
        <div className="alert alert-warning">You do not have permission to view AI Analytics.</div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h4 className="fw-semibold mb-0">AI Analytics</h4>
      </div>
      <p className="text-muted small mb-4">
        View usage statistics for AI API calls across users, models, and features. Use the filters below to narrow down reports.
      </p>

      {error && (
        <div className="alert alert-danger py-2" role="alert">
          {error}
        </div>
      )}

      {/* Search & filters */}
      <div className="card mb-4">
        <div className="card-body">
          <h6 className="mb-3">Search & filters</h6>
          <div className="row g-2">
            <div className="col-md-3">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Search user, model, service..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              />
            </div>
            <div className="col-md-2">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Service code"
                value={filters.serviceCode}
                onChange={(e) => setFilters((f) => ({ ...f, serviceCode: e.target.value }))}
              />
            </div>
            <div className="col-md-2">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Model"
                value={filters.model}
                onChange={(e) => setFilters((f) => ({ ...f, model: e.target.value }))}
              />
            </div>
            <div className="col-md-2">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Feature"
                value={filters.feature}
                onChange={(e) => setFilters((f) => ({ ...f, feature: e.target.value }))}
              />
            </div>
            <div className="col-md-1">
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.dateFrom}
                onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
              />
            </div>
            <div className="col-md-1">
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.dateTo}
                onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
              />
            </div>
            <div className="col-md-1">
              <button type="button" className="btn btn-primary btn-sm w-100" onClick={() => loadStats(filters)} disabled={loading}>
                {loading ? <span className="spinner-border spinner-border-sm" /> : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {loading && !stats ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading…</span></div>
        </div>
      ) : stats ? (
        <>
          {/* Summary cards */}
          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body d-flex align-items-center gap-3">
                  <div className="rounded-circle bg-primary bg-opacity-10 p-3">
                    <i className="ti ti-api text-primary fs-3" />
                  </div>
                  <div>
                    <div className="text-muted small">Total API calls</div>
                    <div className="fs-4 fw-bold">{stats.totalCalls.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body d-flex align-items-center gap-3">
                  <div className="rounded-circle bg-success bg-opacity-10 p-3">
                    <i className="ti ti-users text-success fs-3" />
                  </div>
                  <div>
                    <div className="text-muted small">Active users</div>
                    <div className="fs-4 fw-bold">{stats.byUser.length}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-body d-flex align-items-center gap-3">
                  <div className="rounded-circle bg-info bg-opacity-10 p-3">
                    <i className="ti ti-cpu text-info fs-3" />
                  </div>
                  <div>
                    <div className="text-muted small">Models in use</div>
                    <div className="fs-4 fw-bold">{stats.byModel.length}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="row g-3">
            {/* Top users by API calls */}
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-transparent border-0 fw-semibold">Top users by API calls</div>
                <div className="card-body pt-0">
                  {stats.byUser.length === 0 ? (
                    <p className="text-muted small mb-0">No usage data.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm table-hover mb-0">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th className="text-end">Calls</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.byUser.map((r) => (
                            <tr key={r.userId}>
                              <td>{r.userName || `User #${r.userId}`}</td>
                              <td className="text-end fw-semibold">{r.callCount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Usage by model */}
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-transparent border-0 fw-semibold">Usage by model</div>
                <div className="card-body pt-0">
                  {stats.byModel.length === 0 ? (
                    <p className="text-muted small mb-0">No usage data.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm table-hover mb-0">
                        <thead>
                          <tr>
                            <th>Service / Model</th>
                            <th className="text-end">Calls</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.byModel.map((r, i) => (
                            <tr key={i}>
                              <td>
                                <span className="fw-medium">{r.displayName || r.serviceCode || '—'}</span>
                                {r.model && <span className="text-muted small ms-1">({r.model})</span>}
                              </td>
                              <td className="text-end fw-semibold">{r.callCount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* By feature */}
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-transparent border-0 fw-semibold">Usage by feature</div>
                <div className="card-body pt-0">
                  {stats.byFeature.length === 0 ? (
                    <p className="text-muted small mb-0">No usage data.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm table-hover mb-0">
                        <thead>
                          <tr>
                            <th>Feature</th>
                            <th className="text-end">Calls</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.byFeature.map((r) => (
                            <tr key={r.feature}>
                              <td><code>{r.feature}</code></td>
                              <td className="text-end fw-semibold">{r.callCount.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent logs */}
            <div className="col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-transparent border-0 fw-semibold">Recent API calls</div>
                <div className="card-body pt-0" style={{ maxHeight: 320, overflowY: 'auto' }}>
                  {stats.recentLogs.length === 0 ? (
                    <p className="text-muted small mb-0">No recent calls.</p>
                  ) : (
                    <div className="table-responsive">
                      <table className="table table-sm table-hover mb-0">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Model</th>
                            <th>Feature</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recentLogs.map((r) => (
                            <tr key={r.logId}>
                              <td className="small">{r.userName || `#${r.userId}`}</td>
                              <td className="small">{r.displayName || r.serviceCode || r.model || '—'}</td>
                              <td className="small"><code>{r.feature}</code></td>
                              <td className="small text-muted">{formatDateTime(r.requestedAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
