import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { formatDateTimeInAppTz } from '../../../utils/dateUtils';
import { UserAvatar } from '../../../components/UserAvatar';
import { auditApi } from '../api/auditApi';

/* ───────────────────── Types ───────────────────── */

interface AuditRow {
  auditId: number;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  userId: number | null;
  userEmail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: string | null;
  requestMethod: string | null;
  requestPath: string | null;
  createdAt: string;
}

const EVENT_TYPES = ['login', 'logout', 'login_failure', 'view', 'search', 'create', 'update', 'delete', 'export', 'upload'] as const;

type SortCol = 'createdAt' | 'eventType' | 'entityType' | 'entityId' | 'userEmail' | 'ipAddress' | 'details';

/* ───────────────────── Helpers ───────────────────── */

function useDebouncedValue<T>(value: T, delay: number): T {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const h = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(h);
  }, [value, delay]);
  return deb;
}

/** Badge colour per event type */
function eventBadge(eventType: string) {
  const map: Record<string, string> = {
    login: 'bg-success',
    logout: 'bg-secondary',
    login_failure: 'bg-danger',
    create: 'bg-primary',
    update: 'bg-info',
    delete: 'bg-danger',
    view: 'bg-light text-dark border',
    search: 'bg-light text-dark border',
    export: 'bg-warning text-dark',
    upload: 'bg-primary',
  };
  return map[eventType] ?? 'bg-secondary';
}

/* ───────────────────── Component ───────────────────── */

const PAGE_SIZES = [10, 25, 50, 100];

export default function AuditList() {
  const { timeZone } = useAppSettings();

  const [data, setData] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 350);
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userEmailFilter, setUserEmailFilter] = useState('');
  const debouncedEntityType = useDebouncedValue(entityTypeFilter, 350);
  const debouncedUserEmail = useDebouncedValue(userEmailFilter, 350);
  const [sortBy, setSortBy] = useState<SortCol>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const allIdsOnPage = data.map((r) => r.auditId);
  const allChecked = data.length > 0 && allIdsOnPage.every((id) => selectedIds.has(id));
  const someChecked = allIdsOnPage.some((id) => selectedIds.has(id));

  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(() => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setLoading(true);

    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      sortBy,
      sortOrder,
    });
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (eventTypeFilter) params.set('eventType', eventTypeFilter);
    if (debouncedEntityType) params.set('entityType', debouncedEntityType);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (debouncedUserEmail) params.set('userEmail', debouncedUserEmail);

    api
      .get<{ success: boolean; data: AuditRow[]; total: number }>(
        `/api/audit?${params.toString()}`,
        { signal: ac.signal }
      )
      .then((res) => {
        setData(res.data);
        setTotal(res.total);
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') {
          setData([]);
          setTotal(0);
        }
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, debouncedSearch, eventTypeFilter, debouncedEntityType, dateFrom, dateTo, debouncedUserEmail, sortBy, sortOrder]);

  useEffect(() => {
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize, sortBy, sortOrder, eventTypeFilter, debouncedEntityType, dateFrom, dateTo, debouncedUserEmail]);

  const handleSort = (col: SortCol) => {
    if (sortBy === col) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder(col === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const sortIcon = (col: SortCol) => {
    if (sortBy !== col) return 'bi bi-arrow-down-up text-muted opacity-25';
    return sortOrder === 'asc' ? 'bi bi-sort-up' : 'bi bi-sort-down';
  };

  const toggleAll = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        allIdsOnPage.forEach((id) => next.delete(id));
      } else {
        allIdsOnPage.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showTo = Math.min(page * pageSize, total);

  function pageButtons(): (number | '...')[] {
    const maxVisible = 5;
    const pages: (number | '...')[] = [];
    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }

  const exportParams = () => ({
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    eventType: eventTypeFilter || undefined,
    entityType: debouncedEntityType || undefined,
    userEmail: debouncedUserEmail || undefined,
    search: debouncedSearch || undefined,
    sortBy,
    sortOrder,
  });

  const [csvLoading, setCsvLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const handleExportCsv = () => {
    setCsvLoading(true);
    const params = exportParams();
    const filename = `audit-log-${params.dateFrom ?? 'export'}-to-${params.dateTo ?? 'export'}.csv`;
    auditApi.downloadExportCsv(params, filename).catch(() => {}).finally(() => setCsvLoading(false));
  };
  const handleExportPdf = () => {
    setPdfLoading(true);
    const params = exportParams();
    const filename = `audit-log-${params.dateFrom ?? 'export'}-to-${params.dateTo ?? 'export'}.pdf`;
    auditApi.downloadExportPdf(params, filename).catch(() => {}).finally(() => setPdfLoading(false));
  };

  return (
    <div className="container-fluid">
      <div className="py-3 d-flex align-items-center justify-content-between">
        <div>
          <h4 className="fw-semibold mb-1">Audit Log</h4>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item"><a href="/">Dashboard</a></li>
              <li className="breadcrumb-item active">Audit Log</li>
            </ol>
          </nav>
        </div>
      </div>

      <div className="card">
        <div className="card-header d-flex align-items-center justify-content-between flex-wrap gap-2">
          <h5 className="card-title mb-0">Audit Entries</h5>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary"
              onClick={handleExportCsv}
              disabled={csvLoading}
            >
              {csvLoading ? <span className="spinner-border spinner-border-sm me-1" role="status" /> : <i className="bi bi-download me-1" />}
              Export CSV
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary"
              onClick={handleExportPdf}
              disabled={pdfLoading}
            >
              {pdfLoading ? <span className="spinner-border spinner-border-sm me-1" role="status" /> : <i className="bi bi-file-pdf me-1" />}
              Export PDF
            </button>
            <Link to="/settings/cron-jobs" className="btn btn-sm btn-outline-secondary" title="Create a cron job with task type 'Send audit report' to email this report on a schedule">
              <i className="bi bi-clock-history me-1"></i>Schedule report
            </Link>
          </div>
        </div>

        <div className="card-body">
          <div className="row g-2 mb-3">
            <div className="col-12">
              <span className="small fw-medium text-muted me-2">Filters:</span>
              <select
                className="form-select form-select-sm d-inline-block"
                style={{ width: 'auto', minWidth: 100 }}
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
              >
                <option value="">All events</option>
                {EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <input
                type="text"
                className="form-control form-control-sm d-inline-block ms-2"
                style={{ width: 120 }}
                placeholder="Entity type"
                value={entityTypeFilter}
                onChange={(e) => setEntityTypeFilter(e.target.value)}
              />
              <input
                type="date"
                className="form-control form-control-sm d-inline-block ms-2"
                style={{ width: 140 }}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="small text-muted mx-1">to</span>
              <input
                type="date"
                className="form-control form-control-sm d-inline-block"
                style={{ width: 140 }}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
              <input
                type="text"
                className="form-control form-control-sm d-inline-block ms-2"
                style={{ width: 160 }}
                placeholder="User email"
                value={userEmailFilter}
                onChange={(e) => setUserEmailFilter(e.target.value)}
              />
            </div>
          </div>
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
                placeholder="Search across fields"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="alert alert-primary py-2 d-flex align-items-center gap-2 mb-3">
              <i className="bi bi-check2-square"></i>
              <span className="small fw-medium">{selectedIds.size} row{selectedIds.size !== 1 ? 's' : ''} selected</span>
              <button
                type="button"
                className="btn btn-sm btn-outline-primary ms-auto"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear selection
              </button>
            </div>
          )}

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
                      />
                    </div>
                  </th>
                  {([
                    ['createdAt', 'Time'],
                    ['eventType', 'Event'],
                    ['entityType', 'Entity Type'],
                    ['entityId', 'Entity ID'],
                    ['userEmail', 'User'],
                    ['ipAddress', 'IP Address'],
                    ['details', 'Details'],
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
                  <th className="text-nowrap">Client / Request</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={9} className="text-center py-4 text-muted">
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && data.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-4 text-muted">
                      No audit entries found.
                    </td>
                  </tr>
                )}
                {!loading &&
                  data.map((a) => {
                    const checked = selectedIds.has(a.auditId);
                    const expanded = expandedId === a.auditId;
                    const hasExtra = (a.userAgent || a.requestPath || a.requestMethod);
                    return (
                      <React.Fragment key={a.auditId}>
                        <tr className={checked ? 'table-primary' : ''}>
                          <td>
                            <div className="d-flex align-items-center gap-1">
                              <div className="form-check mb-0">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleOne(a.auditId)}
                                />
                              </div>
                              {hasExtra && (
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-0 text-muted"
                                  title={expanded ? 'Collapse' : 'Show client & request'}
                                  onClick={() => setExpandedId(expanded ? null : a.auditId)}
                                >
                                  <i className={`bi bi-chevron-${expanded ? 'up' : 'down'}`} />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="text-nowrap small">
                            {formatDateTimeInAppTz(a.createdAt, timeZone)}
                          </td>
                          <td>
                            <span className={`badge ${eventBadge(a.eventType)}`}>
                              {a.eventType}
                            </span>
                          </td>
                          <td>{a.entityType ?? <span className="text-muted">-</span>}</td>
                          <td className="small">{a.entityId ?? <span className="text-muted">-</span>}</td>
                          <td>
                            {a.userId != null ? (
                              <div className="d-flex align-items-center gap-2">
                                <UserAvatar userId={a.userId} name={a.userEmail} size={32} />
                                <span>{a.userEmail ?? `User #${a.userId}`}</span>
                              </div>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                          <td className="small text-muted">{a.ipAddress ?? '-'}</td>
                          <td className="small text-muted" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.details ?? '-'}
                          </td>
                          <td className="small">
                            {a.userAgent ? (
                              <span title={a.userAgent} style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>
                                {a.userAgent}
                              </span>
                            ) : (a.requestMethod || a.requestPath) ? (
                              <span className="text-muted" title={[a.requestMethod, a.requestPath].filter(Boolean).join(' ')}>
                                {a.requestMethod} {a.requestPath ? (a.requestPath.length > 30 ? a.requestPath.slice(0, 30) + '…' : a.requestPath) : ''}
                              </span>
                            ) : (
                              <span className="text-muted">-</span>
                            )}
                          </td>
                        </tr>
                        {expanded && hasExtra && (
                          <tr key={`${a.auditId}-exp`} className="bg-light">
                            <td colSpan={9} className="small py-2">
                              {a.userAgent && (
                                <div className="mb-1">
                                      <strong>User-Agent:</strong> <span className="text-break">{a.userAgent}</span>
                                </div>
                              )}
                              {(a.requestMethod || a.requestPath) && (
                                <div>
                                      <strong>Request:</strong> {a.requestMethod ?? ''} {a.requestPath ?? ''}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {!loading && (
            <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 gap-2">
              <div className="small text-muted">
                Showing {showFrom} to {showTo} of {total.toLocaleString()} entries
              </div>

              <nav>
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>
                      Previous
                    </button>
                  </li>
                  {pageButtons().map((p, i) =>
                    p === '...' ? (
                      <li key={`dots-${i}`} className="page-item disabled">
                        <span className="page-link">&hellip;</span>
                      </li>
                    ) : (
                      <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
                        <button className="page-link" onClick={() => setPage(p as number)}>
                          {p}
                        </button>
                      </li>
                    )
                  )}
                  <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                    <button className="page-link" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                      Next
                    </button>
                  </li>
                </ul>
              </nav>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
