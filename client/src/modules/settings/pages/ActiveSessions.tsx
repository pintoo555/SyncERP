import { useEffect, useState, useCallback, useMemo } from 'react';
import { api } from '../../../api/client';
import { formatTimeAgo, formatDateTime, locationFromUserAgent } from '../../../utils/timeAgo';
import { UserAvatar } from '../../../components/UserAvatar';

/* ───────────────────── Types ───────────────────── */

interface SessionRow {
  sessionId: string;
  userId: number;
  userName: string;
  userEmail: string;
  userAgent: string;
  ipAddress: string;
  lastActivityAt: string;
  createdAt: string;
}

type SortCol = 'userName' | 'userEmail' | 'device' | 'ipAddress' | 'lastActivityAt' | 'createdAt';

/* ───────────────────── Helpers ───────────────────── */

function useDebouncedValue<T>(value: T, delay: number): T {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return deb;
}

/** Derive a comparable value for a given column */
function getSortValue(row: SessionRow, col: SortCol): string | number {
  switch (col) {
    case 'userName': return (row.userName || '').toLowerCase();
    case 'userEmail': return (row.userEmail || '').toLowerCase();
    case 'device': return locationFromUserAgent(row.userAgent || '').toLowerCase();
    case 'ipAddress': return (row.ipAddress || '');
    case 'lastActivityAt': return new Date(row.lastActivityAt).getTime();
    case 'createdAt': return new Date(row.createdAt).getTime();
    default: return '';
  }
}

/* ───────────────────── Component ───────────────────── */

const PAGE_SIZES = [10, 25, 50, 100];

export default function ActiveSessions() {
  /* Data state */
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /* Selection */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [revoking, setRevoking] = useState(false);

  /* Controls */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [sortBy, setSortBy] = useState<SortCol>('lastActivityAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  /* ───────── Fetch ───────── */
  const loadSessions = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<{ success: boolean; sessions: SessionRow[] }>('/api/auth/sessions/admin')
      .then((res) => {
        if (res?.success && Array.isArray(res.sessions)) {
          setSessions(res.sessions);
          setSelectedIds(new Set());
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load sessions'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 60 * 1000);
    return () => clearInterval(interval);
  }, [loadSessions]);

  /* ───────── Client-side filter, sort, paginate ───────── */
  const filtered = useMemo(() => {
    if (!debouncedSearch) return sessions;
    const q = debouncedSearch.toLowerCase();
    return sessions.filter(
      (s) =>
        (s.userName || '').toLowerCase().includes(q) ||
        (s.userEmail || '').toLowerCase().includes(q) ||
        locationFromUserAgent(s.userAgent || '').toLowerCase().includes(q) ||
        (s.ipAddress || '').toLowerCase().includes(q)
    );
  }, [sessions, debouncedSearch]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const va = getSortValue(a, sortBy);
      const vb = getSortValue(b, sortBy);
      if (va < vb) return sortOrder === 'asc' ? -1 : 1;
      if (va > vb) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortBy, sortOrder]);

  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
  const safePage = Math.min(page, totalPages);
  const showFrom = totalFiltered === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const showTo = Math.min(safePage * pageSize, totalFiltered);
  const pageData = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  /* Reset to page 1 when search, pageSize, or sort changes */
  useEffect(() => { setPage(1); }, [debouncedSearch, pageSize, sortBy, sortOrder]);

  /* ───────── Sort handler ───────── */
  const handleSort = (col: SortCol) => {
    if (sortBy === col) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder(col === 'lastActivityAt' || col === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const sortIcon = (col: SortCol) => {
    if (sortBy !== col) return 'bi bi-arrow-down-up text-muted opacity-25';
    return sortOrder === 'asc' ? 'bi bi-sort-up' : 'bi bi-sort-down';
  };

  /* ───────── Selection handlers ───────── */
  const pageIds = pageData.map((s) => s.sessionId);
  const allChecked = pageData.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const someChecked = pageIds.some((id) => selectedIds.has(id));

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleOne = (sessionId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  /* ───────── Revoke handlers ───────── */
  const revokeOne = (sessionId: string) => {
    setRevoking(true);
    api
      .post<{ success: boolean; revoked: number }>('/api/auth/sessions/revoke-bulk', { sessionIds: [sessionId] })
      .then(() => loadSessions())
      .catch(() => loadSessions())
      .finally(() => setRevoking(false));
  };

  const revokeSelected = () => {
    if (selectedIds.size === 0) return;
    setRevoking(true);
    api
      .post<{ success: boolean; revoked: number }>('/api/auth/sessions/revoke-bulk', {
        sessionIds: [...selectedIds],
      })
      .then(() => loadSessions())
      .catch(() => loadSessions())
      .finally(() => setRevoking(false));
  };

  /* ───────── Pagination buttons ───────── */
  function pageButtons(): (number | '...')[] {
    const maxVisible = 5;
    const pages: (number | '...')[] = [];
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }

  /* ───────── Render ───────── */
  return (
    <div className="container-fluid">
      {/* Breadcrumb */}
      <div className="py-3 d-flex align-items-center justify-content-between">
        <div>
          <h4 className="fw-semibold mb-1">Active Sessions</h4>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item"><a href="/">Dashboard</a></li>
              <li className="breadcrumb-item"><a href="/settings">Settings</a></li>
              <li className="breadcrumb-item active">Active Sessions</li>
            </ol>
          </nav>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Card */}
      <div className="card">
        <div className="card-header d-flex align-items-center justify-content-between">
          <h5 className="card-title mb-0">Logged-in Users</h5>
          <div className="d-flex gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={loadSessions}
              disabled={loading}
            >
              <i className="bi bi-arrow-clockwise me-1"></i>Refresh
            </button>
          </div>
        </div>

        <div className="card-body">
          <p className="text-muted small mb-3">
            All active sessions (active in the last 30 minutes). Sign out a user to force them to the login page on that device.
          </p>

          {/* Top controls: entries dropdown + search */}
          <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
            <div className="d-flex align-items-center gap-2">
              <label className="text-nowrap small mb-0">Show</label>
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <label className="text-nowrap small mb-0">entries</label>
            </div>

            <div className="d-flex align-items-center gap-2">
              <label className="text-nowrap small mb-0">Search:</label>
              <input
                type="search"
                className="form-control form-control-sm"
                style={{ width: 200 }}
                placeholder=""
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Selection info bar */}
          {selectedIds.size > 0 && (
            <div className="alert alert-primary py-2 d-flex align-items-center gap-2 mb-3">
              <i className="bi bi-check2-square"></i>
              <span className="small fw-medium">
                {selectedIds.size} session{selectedIds.size !== 1 ? 's' : ''} selected
              </span>
              <button
                type="button"
                className="btn btn-sm btn-danger ms-auto"
                disabled={revoking}
                onClick={revokeSelected}
              >
                {revoking ? 'Signing out…' : `Sign out ${selectedIds.size} selected`}
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear
              </button>
            </div>
          )}

          {/* Table */}
          <div className="table-responsive">
            <table className="table table-striped table-hover table-centered mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 40 }}>
                    <div className="form-check mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => {
                          if (el) el.indeterminate = someChecked && !allChecked;
                        }}
                        onChange={toggleAll}
                        aria-label="Select all"
                      />
                    </div>
                  </th>
                  {([
                    ['userName', 'User'],
                    ['device', 'Device Type'],
                    ['ipAddress', 'IP Address'],
                    ['lastActivityAt', 'Last Activity'],
                    ['createdAt', 'Session Started'],
                  ] as [SortCol, string][]).map(([col, label]) => (
                    <th
                      key={col}
                      role="button"
                      className="user-select-none"
                      onClick={() => handleSort(col)}
                    >
                      <span className="d-flex align-items-center gap-1">
                        {label}
                        <i className={sortIcon(col)} style={{ fontSize: '0.75rem' }}></i>
                      </span>
                    </th>
                  ))}
                  <th className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && pageData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      {debouncedSearch ? 'No sessions matching your search.' : 'No active sessions.'}
                    </td>
                  </tr>
                )}
                {!loading &&
                  pageData.map((s) => {
                    const checked = selectedIds.has(s.sessionId);
                    return (
                      <tr key={s.sessionId} className={checked ? 'table-primary' : ''}>
                        <td>
                          <div className="form-check mb-0">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleOne(s.sessionId)}
                              aria-label={`Select ${s.userName}`}
                            />
                          </div>
                        </td>
                        <td>
                          <div className="d-flex align-items-center gap-2">
                            <UserAvatar userId={s.userId} name={s.userName} size={32} />
                            <div>
                              <span className="fw-medium">{s.userName || '—'}</span>
                              {s.userEmail && (
                                <div className="small text-muted">{s.userEmail}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>{locationFromUserAgent(s.userAgent || '')}</td>
                        <td className="small">{s.ipAddress || '—'}</td>
                        <td className="text-nowrap small">
                          {formatTimeAgo(Date.now() - new Date(s.lastActivityAt).getTime())}
                        </td>
                        <td className="text-nowrap small">
                          {formatDateTime(s.createdAt)}
                        </td>
                        <td className="text-end">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            disabled={revoking}
                            onClick={() => revokeOne(s.sessionId)}
                          >
                            Sign out
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Bottom: showing info + pagination */}
          {!loading && (
            <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
              <div className="small text-muted">
                {totalFiltered === 0
                  ? 'No entries'
                  : `Showing ${showFrom} to ${showTo} of ${totalFiltered} entries`}
                {debouncedSearch && sessions.length !== totalFiltered && (
                  <span> (filtered from {sessions.length} total)</span>
                )}
              </div>

              {totalPages > 1 && (
                <nav>
                  <ul className="pagination pagination-sm mb-0">
                    <li className={`page-item ${safePage <= 1 ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage((p) => p - 1)}
                        disabled={safePage <= 1}
                      >
                        Previous
                      </button>
                    </li>
                    {pageButtons().map((p, i) =>
                      p === '...' ? (
                        <li key={`dots-${i}`} className="page-item disabled">
                          <span className="page-link">&hellip;</span>
                        </li>
                      ) : (
                        <li key={p} className={`page-item ${p === safePage ? 'active' : ''}`}>
                          <button className="page-link" onClick={() => setPage(p as number)}>
                            {p}
                          </button>
                        </li>
                      )
                    )}
                    <li className={`page-item ${safePage >= totalPages ? 'disabled' : ''}`}>
                      <button
                        className="page-link"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={safePage >= totalPages}
                      >
                        Next
                      </button>
                    </li>
                  </ul>
                </nav>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
