/**
 * Call Matrix – Search page. Filters, sortable table, pagination.
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { formatDateTimeInAppTz, getTodayLocalDateString } from '../../../utils/dateUtils';
import { callMatrixApi, type CallLogRow } from '../api/callMatrixApi';

const PAGE_SIZES = [10, 20, 50, 100];
function directionBadge(direction: string): string {
  if (/incoming/i.test(direction)) return 'bg-success';
  if (/outgoing/i.test(direction)) return 'bg-primary';
  return 'bg-secondary';
}

function formatDuration(sec: number | null): string {
  if (sec == null) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default function CallMatrixSearch() {
  const { timeZone } = useAppSettings();
  const [data, setData] = useState<CallLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dateFrom, setDateFrom] = useState(() => getTodayLocalDateString());
  const [dateTo, setDateTo] = useState(() => getTodayLocalDateString());
  const [callDirection, setCallDirection] = useState('');
  const [callType, setCallType] = useState('');
  const [fromNumber, setFromNumber] = useState('');
  const [toNumber, setToNumber] = useState('');
  const [minDurationSeconds, setMinDurationSeconds] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<string>('recordingStart');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [refresh, setRefresh] = useState(0);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(null);
    callMatrixApi
      .listCallLogs({
        page,
        pageSize,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        callDirection: callDirection || undefined,
        callType: callType || undefined,
        fromNumber: fromNumber.trim() || undefined,
        toNumber: toNumber.trim() || undefined,
        minDurationSeconds: minDurationSeconds === '' ? undefined : Number(minDurationSeconds),
        sortBy,
        sortOrder,
      })
      .then((res) => {
        setData(res.data);
        setTotal(res.total);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load call logs');
        setData([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, pageSize, dateFrom, dateTo, callDirection, callType, fromNumber, toNumber, minDurationSeconds, sortBy, sortOrder, refresh]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApply = () => {
    setPage(1);
    setRefresh((r) => r + 1);
  };

  const handleReset = () => {
    setDateFrom('');
    setDateTo('');
    setCallDirection('');
    setCallType('');
    setFromNumber('');
    setToNumber('');
    setMinDurationSeconds('');
    setPage(1);
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortOrder(col === 'recordingStart' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const sortIcon = (col: string) => {
    if (sortBy !== col) return 'bi bi-arrow-down-up text-muted opacity-25';
    return sortOrder === 'asc' ? 'bi bi-sort-up' : 'bi bi-sort-down';
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const showFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showTo = Math.min(page * pageSize, total);

  const pageButtons = (): (number | '...')[] => {
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
  };

  return (
    <div className="container-fluid">
      <div className="py-3 d-flex align-items-center justify-content-between">
        <div>
          <h4 className="fw-semibold mb-1">Call Matrix – Search</h4>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item"><Link to="/">Home</Link></li>
              <li className="breadcrumb-item"><Link to="/call-matrix">Call Matrix</Link></li>
              <li className="breadcrumb-item active">Search</li>
            </ol>
          </nav>
        </div>
        <Link to="/call-matrix" className="btn btn-outline-primary btn-sm">
          <i className="ti ti-dashboard me-1" /> Dashboard
        </Link>
      </div>

      <div className="card">
        <div className="card-header">
          <h5 className="card-title mb-0">Filters</h5>
        </div>
        <div className="card-body">
          <div className="row g-2 mb-3">
            <div className="col-md-2">
              <label className="form-label small mb-0">Date from</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-0">Date to</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-0">Direction</label>
              <select
                className="form-select form-select-sm"
                value={callDirection}
                onChange={(e) => setCallDirection(e.target.value)}
              >
                <option value="">All</option>
                <option value="Incoming">Incoming</option>
                <option value="Outgoing">Outgoing</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-0">Call type</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Any"
                value={callType}
                onChange={(e) => setCallType(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-0">From number</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Normalized"
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-0">To number</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Normalized"
                value={toNumber}
                onChange={(e) => setToNumber(e.target.value)}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-0">Min duration (sec)</label>
              <input
                type="number"
                className="form-control form-control-sm"
                min={0}
                placeholder="0"
                value={minDurationSeconds === '' ? '' : minDurationSeconds}
                onChange={(e) => {
                  const v = e.target.value;
                  setMinDurationSeconds(v === '' ? '' : Math.max(0, parseInt(v, 10) || 0));
                }}
              />
            </div>
          </div>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={handleApply}>
              Apply
            </button>
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handleReset}>
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-body p-0">
          {error && (
            <div className="alert alert-warning m-3 mb-0">
              <i className="ti ti-alert-triangle me-2" /> {error}
            </div>
          )}
          <div className="table-responsive">
            <table className="table table-striped table-hover table-centered mb-0">
              <thead className="table-light">
                <tr>
                  <th role="button" className="user-select-none" onClick={() => handleSort('recordingStart')}>
                    <span className="d-flex align-items-center gap-1">Date / Time <i className={sortIcon('recordingStart')} style={{ fontSize: '0.75rem' }} /></span>
                  </th>
                  <th role="button" className="user-select-none" onClick={() => handleSort('callDirection')}>
                    <span className="d-flex align-items-center gap-1">Direction <i className={sortIcon('callDirection')} style={{ fontSize: '0.75rem' }} /></span>
                  </th>
                  <th>Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th role="button" className="user-select-none" onClick={() => handleSort('callDurationSeconds')}>
                    <span className="d-flex align-items-center gap-1">Duration <i className={sortIcon('callDurationSeconds')} style={{ fontSize: '0.75rem' }} /></span>
                  </th>
                  <th>File</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">
                      <span className="spinner-border spinner-border-sm me-2" /> Loading…
                    </td>
                  </tr>
                )}
                {!loading && data.length === 0 && !error && (
                  <tr>
                    <td colSpan={7} className="text-center py-4 text-muted">No call logs found.</td>
                  </tr>
                )}
                {!loading &&
                  data.map((row) => (
                    <tr key={row.callLogId}>
                      <td className="text-nowrap small">
                        {formatDateTimeInAppTz(row.recordingStart, timeZone)}
                        {row.recordingEnd && (
                          <span className="text-muted d-block small">– {formatDateTimeInAppTz(row.recordingEnd, timeZone)}</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${directionBadge(row.callDirection)}`}>{row.callDirection || '—'}</span>
                      </td>
                      <td className="small">{row.callType || '—'}</td>
                      <td className="small">
                        {row.callFromNormalized || row.callFrom || '—'}
                      </td>
                      <td className="small">
                        {row.callToNormalized || row.callTo || '—'}
                      </td>
                      <td className="small">{formatDuration(row.callDurationSeconds)}</td>
                      <td className="small text-break" style={{ maxWidth: 200 }} title={row.fullFilePath || undefined}>
                        {row.fileName || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {!loading && (
            <div className="d-flex flex-wrap justify-content-between align-items-center p-3 gap-2 border-top">
              <div className="d-flex align-items-center gap-2">
                <label className="small mb-0">Show</label>
                <select
                  className="form-select form-select-sm"
                  style={{ width: 'auto' }}
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                >
                  {PAGE_SIZES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span className="small text-muted">entries</span>
              </div>
              <div className="small text-muted">
                Showing {showFrom} to {showTo} of {total.toLocaleString()}
              </div>
              <nav>
                <ul className="pagination pagination-sm mb-0">
                  <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                    <button type="button" className="page-link" onClick={() => setPage((p) => p - 1)} disabled={page <= 1}>Previous</button>
                  </li>
                  {pageButtons().map((p, i) =>
                    p === '...' ? (
                      <li key={`dots-${i}`} className="page-item disabled"><span className="page-link">&hellip;</span></li>
                    ) : (
                      <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
                        <button type="button" className="page-link" onClick={() => setPage(p as number)}>{p}</button>
                      </li>
                    )
                  )}
                  <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                    <button type="button" className="page-link" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>Next</button>
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
