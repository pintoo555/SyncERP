import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';

type EmailType = 'smtp' | 'api';
type ApiProvider = 'sendgrid' | 'mailgun' | 'custom';

interface EmailSettingRow {
  id: number;
  name: string;
  type: EmailType;
  isDefault: boolean;
  isActive: boolean;
  fromEmail: string;
  fromName: string | null;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUsername: string | null;
  smtpPassword: string | null;
  apiProvider: string | null;
  apiUrl: string | null;
  apiKey: string | null;
  apiDomain: string | null;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = {
  name: '',
  type: 'smtp' as EmailType,
  isDefault: false,
  isActive: true,
  fromEmail: '',
  fromName: '',
  smtpHost: '',
  smtpPort: 587,
  smtpSecure: false,
  smtpUsername: '',
  smtpPassword: '',
  apiProvider: 'sendgrid' as ApiProvider,
  apiUrl: '',
  apiKey: '',
  apiDomain: '',
};

export default function EmailSettings() {
  const { user } = useAuth();
  const [list, setList] = useState<EmailSettingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [testModalId, setTestModalId] = useState<number | null>(null);
  const [testTo, setTestTo] = useState('');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const canCreate = user?.permissions?.includes('EMAIL_SETTINGS.CREATE');
  const canEdit = user?.permissions?.includes('EMAIL_SETTINGS.EDIT');
  const canDelete = user?.permissions?.includes('EMAIL_SETTINGS.DELETE');

  const loadList = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<{ success: boolean; data: EmailSettingRow[] }>('/api/email-settings')
      .then((res) => setList(res.data ?? []))
      .catch((e) => setError(e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (row: EmailSettingRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      type: row.type as EmailType,
      isDefault: row.isDefault,
      isActive: row.isActive,
      fromEmail: row.fromEmail,
      fromName: row.fromName ?? '',
      smtpHost: row.smtpHost ?? '',
      smtpPort: row.smtpPort ?? 587,
      smtpSecure: row.smtpSecure,
      smtpUsername: row.smtpUsername ?? '',
      smtpPassword: '',
      apiProvider: (row.apiProvider as ApiProvider) ?? 'sendgrid',
      apiUrl: row.apiUrl ?? '',
      apiKey: '',
      apiDomain: row.apiDomain ?? '',
    });
    setModalOpen(true);
    api.get<{ success: boolean; data: EmailSettingRow }>(`/api/email-settings/${row.id}`)
      .then((res) => {
        const d = res.data;
        if (d) setForm((f) => ({
          ...f,
          name: d.name,
          type: d.type as EmailType,
          isDefault: d.isDefault,
          isActive: d.isActive,
          fromEmail: d.fromEmail,
          fromName: d.fromName ?? '',
          smtpHost: d.smtpHost ?? '',
          smtpPort: d.smtpPort ?? 587,
          smtpSecure: d.smtpSecure,
          smtpUsername: d.smtpUsername ?? '',
          smtpPassword: d.smtpPassword?.startsWith('••••') ? '' : (d.smtpPassword ?? ''),
          apiProvider: (d.apiProvider as ApiProvider) ?? 'sendgrid',
          apiUrl: d.apiUrl ?? '',
          apiKey: d.apiKey?.startsWith('••••') ? '' : (d.apiKey ?? ''),
          apiDomain: d.apiDomain ?? '',
        }));
      })
      .catch(() => setError('Failed to load for edit'));
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    if (!form.fromEmail.trim()) return;
    setSaveLoading(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      isDefault: form.isDefault,
      isActive: form.isActive,
      fromEmail: form.fromEmail.trim(),
      fromName: form.fromName.trim() || null,
      smtpHost: form.type === 'smtp' ? form.smtpHost.trim() || null : null,
      smtpPort: form.type === 'smtp' ? form.smtpPort : null,
      smtpSecure: form.type === 'smtp' ? form.smtpSecure : false,
      smtpUsername: form.type === 'smtp' ? form.smtpUsername.trim() || null : null,
      smtpPassword: form.type === 'smtp' && form.smtpPassword ? form.smtpPassword : null,
      apiProvider: form.type === 'api' ? form.apiProvider : null,
      apiUrl: form.type === 'api' ? form.apiUrl.trim() || null : null,
      apiKey: form.type === 'api' && form.apiKey ? form.apiKey : null,
      apiDomain: form.type === 'api' ? form.apiDomain.trim() || null : null,
    };
    if (editingId) {
      api.put(`/api/email-settings/${editingId}`, payload)
        .then(() => { loadList(); closeModal(); })
        .catch((e) => setError(e?.message ?? 'Update failed'))
        .finally(() => setSaveLoading(false));
    } else {
      api.post('/api/email-settings', payload)
        .then(() => { loadList(); closeModal(); })
        .catch((e) => setError(e?.message ?? 'Create failed'))
        .finally(() => setSaveLoading(false));
    }
  };

  const handleDelete = (id: number) => {
    setSaveLoading(true);
    api.delete(`/api/email-settings/${id}`)
      .then(() => { loadList(); setDeleteConfirmId(null); })
      .catch((e) => setError(e?.message ?? 'Delete failed'))
      .finally(() => setSaveLoading(false));
  };

  const handleSetDefault = (id: number) => {
    setSaveLoading(true);
    api.post<{ success: boolean; data: EmailSettingRow[] }>(`/api/email-settings/${id}/set-default`)
      .then((res) => { setList(res.data ?? []); })
      .catch((e) => setError(e?.message ?? 'Failed to set default'))
      .finally(() => setSaveLoading(false));
  };

  const handleSendTest = () => {
    if (!testModalId || !testTo.trim()) return;
    setTestSending(true);
    setTestResult(null);
    api.post(`/api/email-settings/${testModalId}/send-test`, { to: testTo.trim() })
      .then(() => { setTestResult('Sent successfully'); setTestTo(''); })
      .catch((e) => setTestResult(e?.message ?? 'Send failed'))
      .finally(() => setTestSending(false));
  };

  return (
    <div className="container-fluid py-3">
      <nav aria-label="breadcrumb" className="mb-2">
        <ol className="breadcrumb">
          <li className="breadcrumb-item"><Link to="/">Home</Link></li>
          <li className="breadcrumb-item"><Link to="/settings">Settings</Link></li>
          <li className="breadcrumb-item active" aria-current="page">Email Settings</li>
        </ol>
      </nav>
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h4 className="fw-semibold mb-0">Email Settings</h4>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Add email config
          </button>
        )}
      </div>
      <p className="text-muted small">
        Configure one or more email setups (SMTP or API). Set one as default so outgoing mail uses it unless specified otherwise. Use Send test to verify.
      </p>
      {error && (
        <div className="alert alert-danger py-2" role="alert">{error}</div>
      )}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading…</span></div>
        </div>
      ) : list.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5 text-muted">
            <p className="mb-0">No email configs yet. Add one to send mail (e.g. webmaster@..., parimal@...).</p>
            {canCreate && (
              <button type="button" className="btn btn-outline-primary mt-3" onClick={openCreate}>Add email config</button>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>From</th>
                  <th>Default</th>
                  <th>Status</th>
                  {(canEdit || canDelete) && <th className="text-end">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.id}>
                    <td>{row.name}</td>
                    <td><span className="badge bg-secondary">{row.type.toUpperCase()}</span></td>
                    <td className="small">{row.fromEmail}</td>
                    <td>
                      {row.isDefault ? (
                        <span className="badge bg-primary">Default</span>
                      ) : canEdit ? (
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => handleSetDefault(row.id)} disabled={saveLoading}>Set default</button>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <span className={`badge ${row.isActive ? 'bg-success' : 'bg-secondary'}`}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="text-end">
                        {canEdit && (
                          <>
                            <button type="button" className="btn btn-sm btn-outline-secondary me-1" onClick={() => openEdit(row)}>Edit</button>
                            <button type="button" className="btn btn-sm btn-outline-info me-1" onClick={() => { setTestModalId(row.id); setTestTo(''); setTestResult(null); }}>Send test</button>
                          </>
                        )}
                        {canDelete && (
                          deleteConfirmId === row.id ? (
                            <span>
                              <button type="button" className="btn btn-sm btn-danger me-1" onClick={() => handleDelete(row.id)}>Confirm</button>
                              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                            </span>
                          ) : (
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleteConfirmId(row.id)}>Delete</button>
                          )
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,.5)', zIndex: 1050 }} aria-modal role="dialog">
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content">
              <form onSubmit={handleSubmit}>
                <div className="modal-header">
                  <h5 className="modal-title">{editingId ? 'Edit email config' : 'Add email config'}</h5>
                  <button type="button" className="btn-close" onClick={closeModal} aria-label="Close" />
                </div>
                <div className="modal-body">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label">Name <span className="text-danger">*</span></label>
                      <input type="text" className="form-control" placeholder="e.g. Webmaster, Parimal" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required maxLength={200} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Type</label>
                      <select className="form-select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as EmailType }))}>
                        <option value="smtp">SMTP</option>
                        <option value="api">API (SendGrid, Mailgun, Custom)</option>
                      </select>
                    </div>
                    <div className="col-12">
                      <div className="form-check">
                        <input type="checkbox" className="form-check-input" id="em-default" checked={form.isDefault} onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))} />
                        <label className="form-check-label" htmlFor="em-default">Use as default (outgoing mail uses this unless specified)</label>
                      </div>
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">From email <span className="text-danger">*</span></label>
                      <input type="email" className="form-control" placeholder="webmaster@synchronics.co.in" value={form.fromEmail} onChange={(e) => setForm((f) => ({ ...f, fromEmail: e.target.value }))} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">From name</label>
                      <input type="text" className="form-control" placeholder="Synchronics" value={form.fromName} onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))} />
                    </div>
                  </div>

                  {form.type === 'smtp' && (
                    <div className="border-top pt-3 mt-3">
                      <h6 className="mb-2">SMTP</h6>
                      <div className="row g-3">
                        <div className="col-md-8">
                          <label className="form-label">Host</label>
                          <input type="text" className="form-control" placeholder="smtp.gmail.com" value={form.smtpHost} onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))} />
                        </div>
                        <div className="col-md-4">
                          <label className="form-label">Port</label>
                          <input type="number" className="form-control" placeholder="587" value={form.smtpPort} onChange={(e) => setForm((f) => ({ ...f, smtpPort: parseInt(e.target.value, 10) || 587 }))} />
                        </div>
                        <div className="col-12">
                          <div className="form-check">
                            <input type="checkbox" className="form-check-input" id="em-secure" checked={form.smtpSecure} onChange={(e) => setForm((f) => ({ ...f, smtpSecure: e.target.checked }))} />
                            <label className="form-check-label" htmlFor="em-secure">Use TLS/SSL (port 465)</label>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Username</label>
                          <input type="text" className="form-control" value={form.smtpUsername} onChange={(e) => setForm((f) => ({ ...f, smtpUsername: e.target.value }))} />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label">Password</label>
                          <input type="password" className="form-control" placeholder={editingId ? 'Leave blank to keep' : ''} value={form.smtpPassword} onChange={(e) => setForm((f) => ({ ...f, smtpPassword: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                  )}

                  {form.type === 'api' && (
                    <div className="border-top pt-3 mt-3">
                      <h6 className="mb-2">API</h6>
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label">Provider</label>
                          <select className="form-select" value={form.apiProvider} onChange={(e) => setForm((f) => ({ ...f, apiProvider: e.target.value as ApiProvider }))}>
                            <option value="sendgrid">SendGrid</option>
                            <option value="mailgun">Mailgun</option>
                            <option value="custom">Custom API</option>
                          </select>
                        </div>
                        {form.apiProvider === 'mailgun' && (
                          <div className="col-md-6">
                            <label className="form-label">Mailgun domain</label>
                            <input type="text" className="form-control" placeholder="mg.yourdomain.com" value={form.apiDomain} onChange={(e) => setForm((f) => ({ ...f, apiDomain: e.target.value }))} />
                          </div>
                        )}
                        {form.apiProvider === 'custom' && (
                          <div className="col-12">
                            <label className="form-label">API URL</label>
                            <input type="url" className="form-control" placeholder="https://your-api.com/send" value={form.apiUrl} onChange={(e) => setForm((f) => ({ ...f, apiUrl: e.target.value }))} />
                          </div>
                        )}
                        <div className="col-12">
                          <label className="form-label">API key</label>
                          <input type="password" className="form-control" placeholder={editingId ? 'Leave blank to keep' : ''} value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="form-check mt-3">
                    <input type="checkbox" className="form-check-input" id="em-active" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
                    <label className="form-check-label" htmlFor="em-active">Active</label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saveLoading}>
                    {saveLoading && <span className="spinner-border spinner-border-sm me-1" />}
                    {editingId ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {testModalId !== null && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,.5)', zIndex: 1060 }} aria-modal role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Send test email</h5>
                <button type="button" className="btn-close" onClick={() => { setTestModalId(null); setTestResult(null); }} aria-label="Close" />
              </div>
              <div className="modal-body">
                <label className="form-label">To (recipient email)</label>
                <input type="email" className="form-control" placeholder="you@example.com" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
                {testResult && (
                  <div className={`alert mt-2 py-2 ${testResult.startsWith('Sent') ? 'alert-success' : 'alert-danger'}`}>{testResult}</div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-secondary" onClick={() => setTestModalId(null)}>Close</button>
                <button type="button" className="btn btn-primary" onClick={handleSendTest} disabled={testSending || !testTo.trim()}>
                  {testSending ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                  Send test
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
