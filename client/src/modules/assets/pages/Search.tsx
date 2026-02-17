import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { UserAvatarWithName } from '../../../components/UserAvatar';
import { SearchableSelect } from '../../../components/SearchableSelect';

interface AssetRow {
  assetId: number;
  assetTag: string;
  primaryFileId?: number | null;
  categoryName: string | null;
  status: string;
  currentAssignedToUserId?: number | null;
  assignedToUserName: string | null;
  locationName: string | null;
}

interface MasterOption {
  categoryId?: number;
  locationId?: number;
  userId?: number;
  categoryName?: string;
  categoryCode?: string;
  locationName?: string;
  locationCode?: string;
  name?: string;
}

interface UserAssignmentRow {
  assignmentId: number;
  assetId: number;
  assetTag: string;
  categoryName: string | null;
  assignedToUserName: string;
  assignedByUserName: string;
  assignedAt: string;
  dueReturnDate: string | null;
  returnedAt: string | null;
  returnedByUserName: string | null;
  notes: string | null;
  assignmentType: string;
}

const STATUS_OPTIONS = ['AVAILABLE', 'ISSUED', 'UNDER_REPAIR', 'SCRAPPED', 'LOST'];

export default function Search() {
  const { user } = useAuth();
  const isAdmin = user?.permissions?.includes('DASH.VIEW_ADMIN') || user?.permissions?.includes('ASSET.EDIT');
  const canViewAssignmentHistory = user?.permissions?.includes('ASSIGN.VIEW_HISTORY');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [assignedToUserId, setAssignedToUserId] = useState('');
  const [myAssetsOnly, setMyAssetsOnly] = useState(false);
  const [data, setData] = useState<AssetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const pageSize = 20;

  const [categories, setCategories] = useState<MasterOption[]>([]);
  const [locations, setLocations] = useState<MasterOption[]>([]);
  const [users, setUsers] = useState<MasterOption[]>([]);
  const [userHistory, setUserHistory] = useState<UserAssignmentRow[]>([]);
  const [userHistoryLoading, setUserHistoryLoading] = useState(false);

  const runSearch = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (q.trim()) params.set('q', q.trim());
    if (search.trim()) params.set('search', search.trim());
    if (status) params.set('status', status);
    if (categoryId) params.set('categoryId', categoryId);
    if (locationId) params.set('locationId', locationId);
    if (isAdmin && assignedToUserId) params.set('assignedToUserId', assignedToUserId);
    if (!isAdmin && myAssetsOnly && user?.userId) params.set('assignedToUserId', String(user.userId));
    api.get<{ success: boolean; data: AssetRow[]; total: number }>(`/api/assets?${params}`)
      .then((res) => {
        setData(res.data);
        setTotal(res.total);
      })
      .catch(() => { setData([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [page, pageSize, q, search, status, categoryId, locationId, assignedToUserId, myAssetsOnly, isAdmin, user?.userId]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  useEffect(() => {
    api.get<{ success: boolean; data: MasterOption[] }>('/api/masters/categories?pageSize=500').then((r) => setCategories(Array.isArray(r.data) ? r.data : [])).catch(() => setCategories([]));
    api.get<{ success: boolean; data: MasterOption[] }>('/api/masters/locations?pageSize=500').then((r) => setLocations(Array.isArray(r.data) ? r.data : [])).catch(() => setLocations([]));
    if (isAdmin) api.get<{ success: boolean; data: { userId: number; name: string }[] }>('/api/users').then((r) => setUsers(Array.isArray(r.data) ? r.data : [])).catch(() => setUsers([]));
  }, [isAdmin]);

  useEffect(() => {
    if (!canViewAssignmentHistory || !assignedToUserId) {
      setUserHistory([]);
      return;
    }
    setUserHistoryLoading(true);
    api.get<{ success: boolean; data: UserAssignmentRow[] }>(`/api/assignments/history/by-user?userId=${assignedToUserId}`)
      .then((res) => setUserHistory(Array.isArray(res.data) ? res.data : []))
      .catch(() => setUserHistory([]))
      .finally(() => setUserHistoryLoading(false));
  }, [canViewAssignmentHistory, assignedToUserId]);

  const selectedUserName = assignedToUserId && users.length ? (users.find((u) => String(u.userId) === assignedToUserId)?.name ?? 'User') : '';

  return (
    <div className="container-fluid">
      <h4 className="mb-4">Assets Search</h4>
      <div className="card mb-4">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-3">
              <label className="form-label small">Full-text search (description, tags, etc.)</label>
              <input className="form-control form-control-sm" placeholder="Keywords..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Tag / Serial</label>
              <input className="form-control form-control-sm" placeholder="Tag or serial" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Status</label>
              <SearchableSelect
                size="sm"
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                value={status}
                onChange={(v) => setStatus(String(v))}
                placeholder="All"
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Category</label>
              <SearchableSelect
                size="sm"
                options={categories.map((c) => ({ value: c.categoryId!, label: c.categoryName ?? c.categoryCode ?? '' }))}
                value={categoryId}
                onChange={(v) => setCategoryId(String(v))}
                placeholder="All"
              />
            </div>
            <div className="col-md-2">
              <label className="form-label small">Location</label>
              <SearchableSelect
                size="sm"
                options={locations.map((l) => ({ value: l.locationId!, label: l.locationName ?? l.locationCode ?? '' }))}
                value={locationId}
                onChange={(v) => setLocationId(String(v))}
                placeholder="All"
              />
            </div>
            {isAdmin && (
              <div className="col-md-2">
                <label className="form-label small">Assigned to</label>
                <SearchableSelect
                  size="sm"
                  options={users.map((u) => ({ value: u.userId ?? 0, label: u.name ?? '' }))}
                  value={assignedToUserId}
                  onChange={(v) => setAssignedToUserId(String(v))}
                  placeholder="All"
                />
              </div>
            )}
            {!isAdmin && (
              <div className="col-md-2 d-flex align-items-end">
                <div className="form-check">
                  <input type="checkbox" className="form-check-input" id="myOnly" checked={myAssetsOnly} onChange={(e) => setMyAssetsOnly(e.target.checked)} />
                  <label className="form-check-label small" htmlFor="myOnly">My assets only</label>
                </div>
              </div>
            )}
            <div className="col-md-1 d-flex align-items-end">
              <button type="button" className="btn btn-primary btn-sm w-100" onClick={() => setPage(1)}>Search</button>
            </div>
          </div>
        </div>
      </div>

      {canViewAssignmentHistory && isAdmin && assignedToUserId && (
        <div className="card mb-4">
          <div className="card-header">
            <h6 className="mb-0">Transactions &amp; summary for {selectedUserName}</h6>
          </div>
          <div className="card-body p-0">
            {userHistoryLoading ? (
              <p className="p-4 text-muted mb-0">Loading history…</p>
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table table-sm table-hover mb-0">
                    <thead>
                      <tr>
                        <th>Asset</th>
                        <th>Category</th>
                        <th>Issued At</th>
                        <th>Issued By</th>
                        <th>Returned At</th>
                        <th>Returned By</th>
                        <th>Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userHistory.map((row) => (
                        <tr key={row.assignmentId}>
                          <td><Link to={`/assets/${row.assetId}`}>{row.assetTag}</Link></td>
                          <td>{row.categoryName ?? '—'}</td>
<td>{row.assignedAt}</td>
                        <td>{row.assignedByUserName}</td>
                        <td>{row.returnedAt ?? '—'}</td>
                          <td>{row.returnedByUserName ?? '—'}</td>
                          <td><span className="badge bg-secondary">{row.assignmentType ?? 'ISSUE'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!userHistoryLoading && userHistory.length > 0 && (() => {
                  const currentWithUser = userHistory.filter((r) => !r.returnedAt);
                  return (
                    <div className="p-3 border-top bg-light">
                      <h6 className="mb-2 small text-muted">Summary</h6>
                      <div className="d-flex flex-wrap gap-4">
                        <div>
                          <span className="fw-bold">{userHistory.length}</span>
                          <span className="text-muted small ms-1">total transactions (issued / transferred / returned)</span>
                        </div>
                        <div>
                          <span className="fw-bold text-primary">{currentWithUser.length}</span>
                          <span className="text-muted small ms-1">assets currently with this user</span>
                          {currentWithUser.length > 0 && (
                            <span className="small ms-2">
                              —{' '}
                              {currentWithUser.map((r, i) => (
                                <span key={r.assignmentId}>
                                  {i > 0 && ', '}
                                  <Link to={`/assets/${r.assetId}`}>{r.assetTag}</Link>
                                </span>
                              ))}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
            {!userHistoryLoading && userHistory.length === 0 && (
              <p className="p-4 text-muted mb-0">No assignment history for this user.</p>
            )}
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
                  <th>Assigned To</th>
                  <th>Location</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={6} className="text-center py-4 text-muted">Loading...</td></tr>}
                {!loading && data.map((a) => (
                  <tr key={a.assetId}>
                    <td><Link to={`/assets/${a.assetId}`}>{a.assetTag}</Link></td>
                    <td>{a.categoryName ?? '-'}</td>
                    <td><span className="badge bg-secondary">{a.status}</span></td>
                    <td>
                    {a.currentAssignedToUserId != null && a.assignedToUserName ? (
                      <UserAvatarWithName userId={a.currentAssignedToUserId} name={a.assignedToUserName} size={28} />
                    ) : (
                      a.assignedToUserName ?? '—'
                    )}
                  </td>
                    <td>{a.locationName ?? '-'}</td>
                    <td><Link to={`/assets/${a.assetId}`} className="btn btn-sm btn-outline-primary">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && data.length === 0 && <p className="p-4 text-muted mb-0">No assets match your search.</p>}
          {!loading && total > 0 && (
            <div className="d-flex justify-content-between align-items-center p-3 border-top">
              <span className="small text-muted">Total: {total}</span>
              <div>
                <button type="button" className="btn btn-sm btn-outline-secondary me-1" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span className="mx-2">Page {page}</span>
                <button type="button" className="btn btn-sm btn-outline-secondary ms-1" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
