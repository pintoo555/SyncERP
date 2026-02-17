/**
 * Health Alert Settings – configure thresholds and recipients for CPU, memory, disk alerts.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';

interface UserOption {
  userId: number;
  name: string;
}

interface Setting {
  id: number;
  metric: 'cpu' | 'memory' | 'disk';
  thresholdPercent: number;
  diskPath: string | null;
  enabled: boolean;
  recipientUserIds: number[];
}

const METRIC_LABELS: Record<string, string> = {
  cpu: 'CPU usage',
  memory: 'Memory usage',
  disk: 'Disk usage',
};

export default function HealthAlertSettings() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Partial<Setting>>({});

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [settingsRes, usersRes] = await Promise.all([
        api.get<{ success?: boolean; data?: Setting[] }>('/api/health/settings').catch((err) => {
          console.error('Failed to load settings:', err);
          const msg = err?.response?.status === 403
            ? 'Access denied. You need the HEALTH.SETTINGS permission (ADMIN role required).'
            : err?.response?.status === 401
            ? 'Not authenticated. Please log out and log back in.'
            : `Failed to load settings: ${err?.message || 'Unknown error'}`;
          throw new Error(msg);
        }),
        (async () => {
          try {
            return await api.get<{ success?: boolean; data?: Array<{ userId?: number; userid?: number; name?: string; Name?: string }> }>('/api/users');
          } catch {
            return await api.get<{ success?: boolean; data?: Array<{ userId?: number; userid?: number; name?: string; Name?: string }> }>('/api/health/users');
          }
        })(),
      ]);
      const settingsData = Array.isArray(settingsRes?.data) ? settingsRes.data : (Array.isArray(settingsRes) ? settingsRes : []);
      const rawUsers = Array.isArray(usersRes?.data) ? usersRes.data : (Array.isArray(usersRes) ? usersRes : []);
      const usersData: UserOption[] = rawUsers.map((u: { userId?: number; userid?: number; name?: string; Name?: string }) => ({
        userId: u.userId ?? u.userid ?? 0,
        name: String(u.name ?? u.Name ?? '').trim(),
      })).filter((u) => u.userId > 0 && u.name);
      setSettings(settingsData);
      setUsers(usersData);
      if (usersData.length === 0) {
        console.warn('Health Alert Settings: No users loaded. Raw response:', { usersRes, rawUsers, usersData });
      }
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    document.title = 'Health Alert Settings | Synchronics ERP';
    return () => { document.title = 'Synchronics ERP'; };
  }, []);

  const startAdd = () => {
    setEditingId(-1);
    setForm({ metric: 'cpu', thresholdPercent: 80, enabled: true, recipientUserIds: [], diskPath: null });
  };

  const startEdit = (s: Setting) => {
    setEditingId(s.id);
    setForm({ ...s });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({});
  };

  const save = async () => {
    if (!form.metric || form.thresholdPercent == null) return;
    setSaving(true);
    try {
      if (editingId === -1) {
        await api.post('/api/health/settings', {
          metric: form.metric,
          thresholdPercent: form.thresholdPercent,
          diskPath: form.diskPath || null,
          enabled: form.enabled !== false,
          recipientUserIds: form.recipientUserIds ?? [],
        });
      } else if (editingId != null && editingId > 0) {
        await api.put(`/api/health/settings/${editingId}`, {
          metric: form.metric,
          thresholdPercent: form.thresholdPercent,
          diskPath: form.diskPath,
          enabled: form.enabled,
          recipientUserIds: form.recipientUserIds,
        });
      }
      await load();
      cancelEdit();
    } catch (e) {
      setError((e as Error)?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Delete this alert rule?')) return;
    setSaving(true);
    try {
      await api.delete(`/api/health/settings/${id}`);
      await load();
      if (editingId === id) cancelEdit();
    } catch (e) {
      setError((e as Error)?.message ?? 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleRecipient = (userId: number) => {
    const current = form.recipientUserIds ?? [];
    const next = current.includes(userId)
      ? current.filter((u) => u !== userId)
      : [...current, userId];
    setForm((f) => ({ ...f, recipientUserIds: next }));
  };

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="d-flex align-items-center gap-2 text-muted">
          <span className="spinner-border spinner-border-sm" role="status" />
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h4 mb-1">Health Alert Settings</h1>
          <p className="text-muted small mb-0">Configure thresholds and who receives alerts when CPU, memory, or disk usage exceeds limits.</p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/health" className="btn btn-outline-secondary btn-sm">
            <i className="ti ti-arrow-left me-1" /> Back to Health
          </Link>
          {editingId === null ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={startAdd}>
              <i className="ti ti-plus me-1" /> Add rule
            </button>
          ) : (
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={cancelEdit}>
              Cancel
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close" />
        </div>
      )}

      {editingId != null && (
        <div className="card border shadow-sm mb-4">
          <div className="card-header">
            <h6 className="mb-0">{editingId === -1 ? 'New alert rule' : 'Edit alert rule'}</h6>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label small">Metric</label>
                <select
                  className="form-select form-select-sm"
                  value={form.metric ?? 'cpu'}
                  onChange={(e) => setForm((f) => ({ ...f, metric: e.target.value as 'cpu' | 'memory' | 'disk' }))}
                >
                  <option value="cpu">CPU usage</option>
                  <option value="memory">Memory usage</option>
                  <option value="disk">Disk usage</option>
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label small">Alert when usage exceeds (%)</label>
                <input
                  type="number"
                  className="form-control form-control-sm"
                  min={1}
                  max={100}
                  value={form.thresholdPercent ?? 80}
                  onChange={(e) => setForm((f) => ({ ...f, thresholdPercent: parseInt(e.target.value, 10) || 80 }))}
                />
              </div>
              {form.metric === 'disk' && (
                <div className="col-md-4">
                  <label className="form-label small">Disk path (optional – leave blank for any)</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="e.g. C:\"
                    value={form.diskPath ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, diskPath: e.target.value.trim() || null }))}
                  />
                </div>
              )}
              <div className="col-12">
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="enabled"
                    checked={form.enabled !== false}
                    onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  />
                  <label className="form-check-label small" htmlFor="enabled">Enabled</label>
                </div>
              </div>
              <div className="col-12">
                <label className="form-label small">Alert these users</label>
                <div className="border rounded p-2" style={{ maxHeight: 200, overflowY: 'auto' }}>
                  {users.length === 0 ? (
                    <div className="text-muted small">
                      <div>No users available.</div>
                      <div className="mt-2 small">
                        Check browser console for details. Make sure:
                        <ul className="ps-3 mb-0 mt-1">
                          <li>Users exist in the database with IsActive = 1</li>
                          <li>You have USERS.VIEW or HEALTH.SETTINGS permission</li>
                          <li>The server is running and migration 015 was executed</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    users.map((u) => (
                      <div key={u.userId} className="form-check">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          id={`user-${u.userId}`}
                          checked={(form.recipientUserIds ?? []).includes(u.userId)}
                          onChange={() => toggleRecipient(u.userId)}
                        />
                        <label className="form-check-label small" htmlFor={`user-${u.userId}`}>{u.name}</label>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div className="col-12">
                <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
                  {saving ? <span className="spinner-border spinner-border-sm me-1" role="status" /> : null}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="card border shadow-sm">
        <div className="card-header">
          <h6 className="mb-0">Alert rules</h6>
        </div>
        <div className="card-body p-0">
          {settings.length === 0 ? (
            <div className="p-4 text-center text-muted small">
              No alert rules. Add one to get notified when usage exceeds thresholds.
            </div>
          ) : (
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Threshold</th>
                  <th>Disk path</th>
                  <th>Status</th>
                  <th>Recipients</th>
                  <th style={{ width: 100 }} />
                </tr>
              </thead>
              <tbody>
                {settings.map((s) => (
                  <tr key={s.id}>
                    <td>{METRIC_LABELS[s.metric] ?? s.metric}</td>
                    <td>&gt; {s.thresholdPercent}%</td>
                    <td>{s.diskPath || '—'}</td>
                    <td>
                      <span className={`badge ${s.enabled ? 'bg-success' : 'bg-secondary'}`}>
                        {s.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>
                      {s.recipientUserIds?.length
                        ? users
                            .filter((u) => s.recipientUserIds.includes(u.userId))
                            .map((u) => u.name)
                            .join(', ')
                        : '—'}
                    </td>
                    <td>
                      <div className="btn-group btn-group-sm">
                        <button type="button" className="btn btn-outline-primary" onClick={() => startEdit(s)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-outline-danger" onClick={() => remove(s.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
