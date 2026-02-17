import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { formatDateTimeInAppTz } from '../../../utils/dateUtils';
import { getChatSettings } from '../../../utils/chatSettings';
import { useBranch } from '../../../contexts/BranchContext';

interface UserOption {
  userId: number;
  name: string;
  email: string;
  departmentId: number | null;
  departmentName?: string | null;
  whatsAppNumber?: string | null;
  whatsAppVerifiedAt?: string | null;
  employeeCode?: string | null;
  mobile?: string | null;
  phone?: string | null;
}

interface ActivityRow {
  auditId: number;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  userId: number | null;
  userEmail: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  details: string | null;
  createdAt: string;
}

export default function HRMSUserSearch() {
  const { timeZone } = useAppSettings();
  const { currentBranch } = useBranch();
  const [users, setUsers] = useState<UserOption[]>([]);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [activityPage, setActivityPage] = useState(1);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 25;

  const [messageTargetUser, setMessageTargetUser] = useState<UserOption | null>(null);
  const [sendTestLoading, setSendTestLoading] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [improveModal, setImproveModal] = useState<{ original: string; improved: string } | null>(null);
  const [improveLoading, setImproveLoading] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);
  const [sendComposeLoading, setSendComposeLoading] = useState(false);
  const [messageSuccess, setMessageSuccess] = useState<string | null>(null);

  const loadUsers = useCallback(() => {
    setLoadingUsers(true);
    setError(null);
    const q = search.trim() ? `search=${encodeURIComponent(search.trim())}` : '';
    api.get<{ success: boolean; data: UserOption[] }>(`/api/hrms/users/search?${q}`)
      .then((res) => {
        setUsers(res.data ?? []);
        setError(null);
      })
      .catch((e) => {
        setUsers([]);
        setError(e?.message ?? 'Failed to load users. You may need HRMS.VIEW permission.');
      })
      .finally(() => setLoadingUsers(false));
  }, [search, currentBranch]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  useEffect(() => {
    if (selectedUserId == null) {
      setActivity([]);
      setActivityTotal(0);
      return;
    }
    setLoadingActivity(true);
    const params = new URLSearchParams({
      page: String(activityPage),
      pageSize: String(pageSize),
      userId: String(selectedUserId),
    });
    api.get<{ success: boolean; data: ActivityRow[]; total: number }>(`/api/hrms/users/activity?${params.toString()}`)
      .then((res) => {
        setActivity(res.data ?? []);
        setActivityTotal(res.total ?? 0);
      })
      .catch(() => {
        setActivity([]);
        setActivityTotal(0);
      })
      .finally(() => setLoadingActivity(false));
  }, [selectedUserId, activityPage]);

  const selectedUser = users.find((u) => u.userId === selectedUserId);

  const sendTestMessage = useCallback(() => {
    if (!messageTargetUser) return;
    setSendTestLoading(true);
    setMessageSuccess(null);
    api.post(`/api/hrms/employees/${messageTargetUser.userId}/whatsapp/send-test`, { message: 'Test message from HR.' })
      .then(() => setMessageSuccess('Test message sent.'))
      .catch((e) => setMessageSuccess((e as Error)?.message ?? 'Failed to send'))
      .finally(() => setSendTestLoading(false));
  }, [messageTargetUser]);

  const openImproveModal = useCallback(() => {
    const text = composeText.trim();
    if (!text || !messageTargetUser) return;
    setImproveError(null);
    setImproveModal({ original: text, improved: '' });
    setImproveLoading(true);
    const settings = getChatSettings();
    const serviceCode = settings.aiServiceCode?.trim() || undefined;
    api.post<{ success: boolean; data: { improved: string } }>('/api/chat/improve', { text, serviceCode })
      .then((res) => {
        const improved = (res as { data?: { improved?: string } }).data?.improved ?? '';
        setImproveModal((m) => m ? { ...m, improved } : null);
      })
      .catch((err) => setImproveError(err instanceof Error ? err.message : 'Failed to improve'))
      .finally(() => setImproveLoading(false));
  }, [composeText, messageTargetUser]);

  const improveGetMore = useCallback(() => {
    const text = improveModal?.original ?? '';
    if (!text || !messageTargetUser) return;
    setImproveError(null);
    setImproveLoading(true);
    const variant = improveModal?.improved ? 'friendly' : 'professional';
    const settings = getChatSettings();
    const serviceCode = settings.aiServiceCode?.trim() || undefined;
    api.post<{ success: boolean; data: { improved: string } }>('/api/chat/improve', { text, variant, serviceCode })
      .then((res) => {
        const improved = (res as { data?: { improved?: string } }).data?.improved ?? '';
        setImproveModal((m) => m ? { ...m, improved } : null);
      })
      .catch((err) => setImproveError(err instanceof Error ? err.message : 'Failed to improve'))
      .finally(() => setImproveLoading(false));
  }, [improveModal, messageTargetUser]);

  const sendComposeMessage = useCallback((message: string) => {
    if (!messageTargetUser || !message.trim()) return;
    setSendComposeLoading(true);
    setMessageSuccess(null);
    api.post(`/api/hrms/employees/${messageTargetUser.userId}/whatsapp/send-test`, { message: message.trim() })
      .then(() => {
        setMessageSuccess('Message sent.');
        setComposeText('');
        setImproveModal(null);
      })
      .catch((e) => setMessageSuccess((e as Error)?.message ?? 'Failed to send'))
      .finally(() => setSendComposeLoading(false));
  }, [messageTargetUser]);

  return (
    <div className="container-fluid">
      <h4 className="mb-4">User Search</h4>
      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close" />
        </div>
      )}
      <div className="card mb-3">
        <div className="card-body">
          <div className="row g-2 align-items-end">
            <div className="col-md-5">
              <label className="form-label small mb-0">Search users</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Name, email, employee code, mobile, phone, department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
              />
            </div>
            <div className="col-auto">
              <button type="button" className="btn btn-sm btn-primary" onClick={loadUsers}>Search</button>
            </div>
          </div>
          {loadingUsers && <p className="small text-muted mt-2 mb-0">Loading users...</p>}
          {!loadingUsers && users.length > 0 && (
            <div className="mt-3">
              <div className="table-responsive">
                <table className="table table-sm table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Department</th>
                      <th className="text-center">WhatsApp</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.userId}>
                        <td>{u.name}</td>
                        <td className="small">{u.email}</td>
                        <td className="small">{u.departmentName ?? '-'}</td>
                        <td className="text-center">
                          {u.whatsAppVerifiedAt ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-success d-inline-flex align-items-center gap-1"
                              title="WhatsApp verified – click to send message"
                              onClick={() => {
                                setMessageTargetUser(u);
                                setComposeText('');
                                setImproveModal(null);
                                setImproveError(null);
                                setMessageSuccess(null);
                              }}
                            >
                              <i className="ti ti-brand-whatsapp" />
                              <i className="ti ti-badge-check small" />
                              Verified
                            </button>
                          ) : u.whatsAppNumber ? (
                            <span className="badge bg-secondary">Not verified</span>
                          ) : (
                            <span className="text-muted small">—</span>
                          )}
                        </td>
                        <td>
                          <Link to={`/hrms/employees/${u.userId}`} className="btn btn-sm btn-outline-secondary">Profile</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label className="form-label small mb-1 mt-3">Select user to view activity</label>
              <select
                className="form-select form-select-sm"
                value={selectedUserId ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelectedUserId(v ? Number(v) : null);
                  setActivityPage(1);
                }}
              >
                <option value="">-- Select user --</option>
                {users.map((u) => (
                  <option key={u.userId} value={u.userId}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
      {selectedUser && (
        <div className="card">
          <div className="card-header d-flex align-items-center justify-content-between">
            <span>Activity: {selectedUser.name} ({selectedUser.email})</span>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Event</th>
                    <th>Entity</th>
                    <th>IP</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingActivity && (
                    <tr><td colSpan={5} className="text-center py-4 text-muted">Loading...</td></tr>
                  )}
                  {!loadingActivity && activity.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-4 text-muted">No activity found.</td></tr>
                  )}
                  {!loadingActivity && activity.map((a) => (
                    <tr key={a.auditId}>
                      <td className="small">{formatDateTimeInAppTz(a.createdAt, timeZone)}</td>
                      <td>{a.eventType}</td>
                      <td>{[a.entityType, a.entityId].filter(Boolean).join(' ') || '-'}</td>
                      <td className="small">{a.ipAddress ?? '-'}</td>
                      <td className="small text-muted">{a.details ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!loadingActivity && activityTotal > pageSize && (
              <div className="d-flex justify-content-between align-items-center p-3 border-top">
                <span className="small text-muted">Total: {activityTotal}</span>
                <div>
                  <button type="button" className="btn btn-sm btn-outline-secondary me-1" disabled={activityPage <= 1} onClick={() => setActivityPage((p) => p - 1)}>Previous</button>
                  <span className="mx-2">Page {activityPage}</span>
                  <button type="button" className="btn btn-sm btn-outline-secondary ms-1" disabled={activityPage * pageSize >= activityTotal} onClick={() => setActivityPage((p) => p + 1)}>Next</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {messageTargetUser && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} role="dialog" aria-modal="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">
                  <i className="ti ti-brand-whatsapp text-success me-2" />
                  Send WhatsApp to {messageTargetUser.name}
                </h5>
                <button type="button" className="btn-close" aria-label="Close" onClick={() => { setMessageTargetUser(null); setImproveModal(null); setMessageSuccess(null); }} />
              </div>
              <div className="modal-body">
                {messageSuccess && (
                  <div className={`alert py-2 mb-3 ${messageSuccess.startsWith('Test') || messageSuccess.startsWith('Message') ? 'alert-success' : 'alert-danger'}`}>
                    {messageSuccess}
                  </div>
                )}
                <div className="mb-3">
                  <button type="button" className="btn btn-outline-success btn-sm" onClick={sendTestMessage} disabled={sendTestLoading}>
                    {sendTestLoading ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                    Send test message
                  </button>
                </div>
                <hr />
                <label className="form-label small">Compose message (optional: improve with AI, then send)</label>
                <textarea
                  className="form-control form-control-sm mb-2"
                  rows={3}
                  placeholder="Type a message..."
                  value={composeText}
                  onChange={(e) => setComposeText(e.target.value)}
                  disabled={!!improveModal}
                />
                <div className="d-flex flex-wrap gap-2 align-items-center mb-2">
                  <button type="button" className="btn btn-sm btn-outline-primary" onClick={openImproveModal} disabled={!composeText.trim() || improveLoading || !!improveModal}>
                    {improveLoading ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                    Improve with AI
                  </button>
                </div>
                {improveModal != null && (
                  <div className="border rounded p-2 bg-light mb-2">
                    {improveError && <div className="alert alert-danger py-2 mb-2 small">{improveError}</div>}
                    <div className="small text-muted mb-1">Original:</div>
                    <div className="p-2 rounded bg-white small mb-2">{improveModal.original}</div>
                    {improveLoading ? (
                      <p className="small text-muted mb-0">Improving...</p>
                    ) : improveModal.improved ? (
                      <>
                        <div className="small text-muted mb-1">Improved:</div>
                        <div className="p-2 rounded bg-success bg-opacity-10 border border-success border-opacity-25 small mb-2">{improveModal.improved}</div>
                        <div className="d-flex gap-2 flex-wrap">
                          <button type="button" className="btn btn-success btn-sm" onClick={() => sendComposeMessage(improveModal.improved)} disabled={sendComposeLoading}>
                            {sendComposeLoading ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                            Send via WhatsApp
                          </button>
                          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={improveGetMore}>Get another variant</button>
                          <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setComposeText(improveModal.improved); setImproveModal(null); setImproveError(null); }}>Use as draft</button>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
                {!improveModal && composeText.trim() && (
                  <button type="button" className="btn btn-success btn-sm" onClick={() => sendComposeMessage(composeText)} disabled={sendComposeLoading}>
                    {sendComposeLoading ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                    Send via WhatsApp
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
