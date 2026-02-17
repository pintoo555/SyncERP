import { useEffect, useState, useCallback } from 'react';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';

interface ApiConfigRow {
  configId: number;
  serviceCode: string;
  displayName: string;
  apiKey: string | null;
  baseUrl: string | null;
  extraConfig: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const emptyForm = {
  serviceCode: '',
  displayName: '',
  apiKey: '',
  baseUrl: '',
  extraConfig: '',
  isActive: true,
};

export default function AIConfig() {
  const { user } = useAuth();
  const [list, setList] = useState<ApiConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saveLoading, setSaveLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; ok: boolean; message: string } | null>(null);

  const canCreate = user?.permissions?.includes('AI_CONFIG.CREATE');
  const canEdit = user?.permissions?.includes('AI_CONFIG.EDIT');
  const canDelete = user?.permissions?.includes('AI_CONFIG.DELETE');
  const canView = user?.permissions?.includes('AI_CONFIG.VIEW');

  const loadList = useCallback(() => {
    setLoading(true);
    setError(null);
    api.get<{ success: boolean; data: ApiConfigRow[] }>('/api/ai-config')
      .then((res) => setList(res.data ?? []))
      .catch((e) => setError(e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row: ApiConfigRow) => {
    setEditingId(row.configId);
    setModalOpen(true);
    setForm({ ...emptyForm, serviceCode: row.serviceCode, displayName: row.displayName });
    api.get<{ success: boolean; data: ApiConfigRow }>(`/api/ai-config/${row.configId}`)
      .then((res) => {
        const d = res.data;
        if (d) setForm({
          serviceCode: d.serviceCode,
          displayName: d.displayName,
          apiKey: d.apiKey ?? '',
          baseUrl: d.baseUrl ?? '',
          extraConfig: d.extraConfig ?? '',
          isActive: d.isActive,
        });
      })
      .catch(() => setError('Failed to load config for edit'));
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.displayName.trim()) return;
    if (!editingId && !form.serviceCode.trim()) return;
    setSaveLoading(true);
    const payload = {
      serviceCode: form.serviceCode.trim(),
      displayName: form.displayName.trim(),
      apiKey: form.apiKey.trim() || null,
      baseUrl: form.baseUrl.trim() || null,
      extraConfig: form.extraConfig.trim() || null,
      isActive: form.isActive,
    };
    if (editingId) {
      api.put(`/api/ai-config/${editingId}`, payload)
        .then(() => { loadList(); closeModal(); })
        .catch((e) => setError(e?.message ?? 'Update failed'))
        .finally(() => setSaveLoading(false));
    } else {
      api.post('/api/ai-config', payload)
        .then(() => { loadList(); closeModal(); })
        .catch((e) => setError(e?.message ?? 'Create failed'))
        .finally(() => setSaveLoading(false));
    }
  };

  const handleDelete = (configId: number) => {
    setSaveLoading(true);
    api.delete(`/api/ai-config/${configId}`)
      .then(() => { loadList(); setDeleteConfirmId(null); })
      .catch((e) => setError(e?.message ?? 'Delete failed'))
      .finally(() => setSaveLoading(false));
  };

  const handleTest = (configId: number) => {
    setTestingId(configId);
    setTestResult(null);
    setError(null);
    api.post<{ success?: boolean; message?: string; error?: string }>(`/api/ai-config/${configId}/test`)
      .then((res) => {
        const ok = res.success === true;
        const message = ok ? (res.message ?? 'API connection successful') : (res.error ?? 'Test failed');
        setTestResult({ id: configId, ok, message });
        if (!ok) setError(message);
      })
      .catch((e) => {
        const msg = e?.message ?? 'Test failed';
        setTestResult({ id: configId, ok: false, message: msg });
        setError(msg);
      })
      .finally(() => setTestingId(null));
  };

  return (
    <div className="p-4">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h4 className="fw-semibold mb-0"><i className="ti ti-key me-2 text-primary" />API Configuration</h4>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Add service
          </button>
        )}
      </div>
      <p className="text-muted small">
        Manage API keys and endpoints for external services — AI providers (OpenAI, Claude), GST verification (GSTZen), and more. Keys are stored securely and masked in the list. Use service codes like <code>OPENAI</code>, <code>GSTZEN</code>, etc.
      </p>
      {error && (
        <div className="alert alert-danger py-2" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status"><span className="visually-hidden">Loading…</span></div>
        </div>
      ) : list.length === 0 ? (
        <div className="card">
          <div className="card-body text-center py-5 text-muted">
            <p className="mb-0">No API configs yet. Add a service to get started.</p>
            {canCreate && (
              <button type="button" className="btn btn-outline-primary mt-3" onClick={openCreate}>Add service</button>
            )}
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Code</th>
                  <th>API Key</th>
                  <th>Base URL</th>
                  <th>Status</th>
                  {(canEdit || canDelete || canView) && <th className="text-end">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((row) => (
                  <tr key={row.configId}>
                    <td>{row.displayName}</td>
                    <td><code className="small">{row.serviceCode}</code></td>
                    <td className="small">{row.apiKey ? (row.apiKey.startsWith('••••') ? row.apiKey : '••••••••') : '—'}</td>
                    <td className="small text-muted">{row.baseUrl || '—'}</td>
                    <td>
                      <span className={`badge ${row.isActive ? 'bg-success' : 'bg-secondary'}`}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {testResult?.id === row.configId && (
                        <span className={`ms-2 small ${testResult.ok ? 'text-success' : 'text-danger'}`}>
                          {testResult.ok ? '✓' : '✗'} {testResult.message}
                        </span>
                      )}
                    </td>
                    {(canEdit || canDelete || canView) && (
                      <td className="text-end">
                        {row.apiKey && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary me-1"
                            onClick={() => handleTest(row.configId)}
                            disabled={testingId !== null}
                            title="Test API connection"
                          >
                            {testingId === row.configId ? (
                              <span className="spinner-border spinner-border-sm" style={{ width: 16, height: 16 }} />
                            ) : (
                              'Test'
                            )}
                          </button>
                        )}
                        {canEdit && (
                          <button type="button" className="btn btn-sm btn-outline-secondary me-1" onClick={() => openEdit(row)}>Edit</button>
                        )}
                        {canDelete && (
                          deleteConfirmId === row.configId ? (
                            <span>
                              <button type="button" className="btn btn-sm btn-danger me-1" onClick={() => handleDelete(row.configId)}>Confirm</button>
                              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setDeleteConfirmId(null)}>Cancel</button>
                            </span>
                          ) : (
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setDeleteConfirmId(row.configId)}>Delete</button>
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
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,.5)' }} aria-modal role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <form onSubmit={handleSubmit}>
                <div className="modal-header">
                  <h5 className="modal-title">{editingId ? 'Edit service' : 'Add service'}</h5>
                  <button type="button" className="btn-close" onClick={closeModal} aria-label="Close" />
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label">Service code <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. OPENAI, CLAUDE, GEMINI"
                      value={form.serviceCode}
                      onChange={(e) => setForm((f) => ({ ...f, serviceCode: e.target.value.toUpperCase().replace(/\s/g, '') }))}
                      required
                      disabled={!!editingId}
                      maxLength={50}
                    />
                    {editingId && <small className="text-muted">Code cannot be changed after creation.</small>}
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Display name <span className="text-danger">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. OpenAI GPT-4"
                      value={form.displayName}
                      onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                      required
                      maxLength={200}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">API key / Private key</label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="Leave blank to keep existing"
                      value={form.apiKey}
                      onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                    />
                    {editingId && <small className="text-muted">Leave blank to keep the current key.</small>}
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Base URL (optional)</label>
                    <input
                      type="url"
                      className="form-control"
                      placeholder="https://api.example.com"
                      value={form.baseUrl}
                      onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                      maxLength={500}
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Extra config (JSON, optional)</label>
                    <textarea
                      className="form-control font-monospace small"
                      rows={3}
                      placeholder='{"model": "gpt-4", "region": "us-east-1"}'
                      value={form.extraConfig}
                      onChange={(e) => setForm((f) => ({ ...f, extraConfig: e.target.value }))}
                    />
                  </div>
                  <div className="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id="ai-config-active"
                      checked={form.isActive}
                      onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                    />
                    <label className="form-check-label" htmlFor="ai-config-active">Active</label>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-outline-secondary" onClick={closeModal}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saveLoading}>
                    {saveLoading ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                    {editingId ? 'Update' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
