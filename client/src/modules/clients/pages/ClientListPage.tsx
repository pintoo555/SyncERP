/**
 * Client list page with search, filters, pagination, and quick actions.
 * Inspinia-style layout matching HRMS employee list pattern.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as clientsApi from '../api/clientsApi';
import type { Client, Industry } from '../types';
import { CLIENT_TYPES } from '../types';
import { formatIndianNumber } from '../../../utils/formatIndian';

export default function ClientListPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [industryId, setIndustryId] = useState<string>('');
  const [clientType, setClientType] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [blacklistFilter, setBlacklistFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [sortBy, setSortBy] = useState('clientName');
  const [sortDir, setSortDir] = useState('ASC');

  const [industries, setIndustries] = useState<Industry[]>([]);

  useEffect(() => {
    clientsApi.listIndustries().then(res => setIndustries(res.data || [])).catch(() => {});
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    clientsApi.listClients({
      search: search.trim() || undefined,
      industryId: industryId ? Number(industryId) : undefined,
      clientType: clientType || undefined,
      isActive: statusFilter === 'active' ? 1 : statusFilter === 'inactive' ? 0 : undefined,
      isBlacklisted: blacklistFilter === 'yes' ? 1 : blacklistFilter === 'no' ? 0 : undefined,
      page, pageSize, sortBy, sortDir,
    })
      .then(res => { setClients(res.data || []); setTotal(res.total || 0); })
      .catch(e => setError(e?.message ?? 'Failed to load clients'))
      .finally(() => setLoading(false));
  }, [search, industryId, clientType, statusFilter, blacklistFilter, page, pageSize, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);

  const hasActiveFilters = useMemo(() => (
    search.trim() !== '' || industryId !== '' || clientType !== '' || statusFilter !== 'active' || blacklistFilter !== ''
  ), [search, industryId, clientType, statusFilter, blacklistFilter]);

  const clearFilters = useCallback(() => {
    setSearch(''); setIndustryId(''); setClientType(''); setStatusFilter('active'); setBlacklistFilter(''); setPage(1);
  }, []);

  const totalPages = Math.ceil(total / pageSize);

  const handleStatusToggle = async (c: Client) => {
    try { await clientsApi.patchClientStatus(c.id, { isActive: !c.isActive }); load(); }
    catch (e: any) { setError(e?.message ?? 'Failed to update status'); }
  };

  const handleBlacklistToggle = async (c: Client) => {
    try { await clientsApi.patchClientStatus(c.id, { isBlacklisted: !c.isBlacklisted }); load(); }
    catch (e: any) { setError(e?.message ?? 'Failed to update blacklist'); }
  };

  const handleSort = (col: string) => {
    if (sortBy === col) { setSortDir(d => d === 'ASC' ? 'DESC' : 'ASC'); }
    else { setSortBy(col); setSortDir('ASC'); }
  };

  const SortTh = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort(col)}>
      {children}
      {sortBy === col && <i className={`ti ti-chevron-${sortDir === 'ASC' ? 'up' : 'down'} ms-1 small`} />}
    </th>
  );

  return (
    <div className="container-fluid py-4">
      {/* Page Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="mb-1 fw-bold">
            <i className="ti ti-address-book me-2 text-primary" />
            Clients
          </h4>
          <p className="text-muted mb-0 small">Manage client master records. Search by name, code, GST number, or display name.</p>
        </div>
        <Link to="/clients/create" className="btn btn-primary btn-sm">
          <i className="ti ti-plus me-1" /> New Client
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="ti ti-alert-circle me-2" />{error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close" />
        </div>
      )}

      {/* Filters Card */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-transparent border-bottom py-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <h5 className="mb-0 fw-semibold">
            <i className="ti ti-filter me-2 text-primary" />
            Search & Filters
          </h5>
          {hasActiveFilters && (
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearFilters}>
              <i className="ti ti-x me-1" /> Clear all
            </button>
          )}
        </div>
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-3 col-lg-2">
              <label className="form-label small mb-1 fw-semibold">Search</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-end-0"><i className="ti ti-search text-muted" /></span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Name, code, GST..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && load()}
                />
              </div>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small mb-1 fw-semibold">Industry</label>
              <select className="form-select form-select-sm" value={industryId} onChange={e => { setIndustryId(e.target.value); setPage(1); }}>
                <option value="">All industries</option>
                {industries.filter(i => i.isActive).map(i => (
                  <option key={i.id} value={i.id}>{i.industryName}</option>
                ))}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small mb-1 fw-semibold">Type</label>
              <select className="form-select form-select-sm" value={clientType} onChange={e => { setClientType(e.target.value); setPage(1); }}>
                <option value="">All types</option>
                {CLIENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small mb-1 fw-semibold">Status</label>
              <select className="form-select form-select-sm" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="">All</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>
            <div className="col-6 col-md-2">
              <label className="form-label small mb-1 fw-semibold">Blacklisted</label>
              <select className="form-select form-select-sm" value={blacklistFilter} onChange={e => { setBlacklistFilter(e.target.value); setPage(1); }}>
                <option value="">All</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div className="col-12 col-md-auto">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => { setPage(1); load(); }}>
                <i className="ti ti-search me-1" />Apply
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="card border-0 shadow-sm">
        <div className="card-header bg-transparent border-bottom py-2 px-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
          <span className="small text-muted fw-semibold">
            {loading ? 'Loading...' : (
              <>
                <i className="ti ti-address-book me-1" />
                <strong>{total}</strong> client{total !== 1 ? 's' : ''} found
              </>
            )}
          </span>
        </div>
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <SortTh col="clientCode">Code</SortTh>
                  <SortTh col="clientName">Name</SortTh>
                  <SortTh col="clientType">Type</SortTh>
                  <SortTh col="industryName">Industry</SortTh>
                  <th>GST</th>
                  <SortTh col="creditLimit">Credit Limit</SortTh>
                  <th className="text-center">Status</th>
                  <th style={{ width: 140 }} className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={8} className="text-center py-5 text-muted">
                    <div className="spinner-border spinner-border-sm me-2" />Loading clients...
                  </td></tr>
                )}
                {!loading && clients.length === 0 && (
                  <tr><td colSpan={8} className="text-center py-5 text-muted">
                    <i className="ti ti-mood-empty fs-3 d-block mb-2" />
                    No clients found. Try adjusting filters or search.
                  </td></tr>
                )}
                {!loading && clients.map(c => (
                  <tr key={c.id} className={c.isMerged ? 'table-secondary' : ''}>
                    <td><code className="small">{c.clientCode}</code></td>
                    <td>
                      <Link to={`/clients/${c.id}`} className="fw-semibold text-body text-decoration-none">
                        {c.clientName}
                      </Link>
                      {c.clientDisplayName && c.clientDisplayName !== c.clientName && (
                        <div className="text-muted small">{c.clientDisplayName}</div>
                      )}
                      {c.isMerged && <span className="badge bg-secondary bg-opacity-10 text-secondary ms-1">Merged</span>}
                    </td>
                    <td><span className="badge bg-primary bg-opacity-10 text-primary">{c.clientType}</span></td>
                    <td className="text-muted small">{c.industryName || '—'}</td>
                    <td className="text-muted small">{c.gstNumber || '—'}</td>
                    <td className="small fw-semibold">{formatIndianNumber(c.creditLimit)}</td>
                    <td className="text-center">
                      {c.isActive
                        ? <span className="badge bg-success bg-opacity-10 text-success">Active</span>
                        : <span className="badge bg-secondary bg-opacity-10 text-secondary">Inactive</span>}
                      {c.isBlacklisted && <span className="badge bg-danger bg-opacity-10 text-danger ms-1">Blacklisted</span>}
                    </td>
                    <td className="text-end">
                      <div className="btn-group btn-group-sm">
                        <button className="btn btn-outline-primary" onClick={() => navigate(`/clients/${c.id}`)} title="View">
                          <i className="ti ti-eye" />
                        </button>
                        <button className="btn btn-outline-secondary" onClick={() => navigate(`/clients/${c.id}/edit`)} title="Edit" disabled={c.isMerged}>
                          <i className="ti ti-pencil" />
                        </button>
                        <button
                          className={`btn ${c.isActive ? 'btn-outline-warning' : 'btn-outline-success'}`}
                          onClick={() => handleStatusToggle(c)}
                          title={c.isActive ? 'Deactivate' : 'Activate'}
                        >
                          <i className={`ti ${c.isActive ? 'ti-ban' : 'ti-check'}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="card-footer bg-transparent d-flex flex-wrap justify-content-between align-items-center gap-2 py-2">
            <span className="text-muted small">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </span>
            <nav>
              <ul className="pagination pagination-sm mb-0">
                <li className={`page-item ${page <= 1 ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage(p => p - 1)}><i className="ti ti-chevron-left" /></button>
                </li>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  if (p > totalPages) return null;
                  return (
                    <li key={p} className={`page-item ${p === page ? 'active' : ''}`}>
                      <button className="page-link" onClick={() => setPage(p)}>{p}</button>
                    </li>
                  );
                })}
                <li className={`page-item ${page >= totalPages ? 'disabled' : ''}`}>
                  <button className="page-link" onClick={() => setPage(p => p + 1)}><i className="ti ti-chevron-right" /></button>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}
