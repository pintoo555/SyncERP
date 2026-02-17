/**
 * Cron Jobs Settings – create, edit, activate/deactivate scheduled tasks (send report, send WhatsApp).
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cronJobsApi, type CronJob, type TaskType, type CreateCronJobPayload, type UpdateCronJobPayload, type CronJobDashboardStats, type CronJobRun } from '../api/cronJobsApi';

const SCHEDULE_PRESETS: { label: string; value: string }[] = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Daily at 09:00', value: '0 9 * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Custom', value: '' },
];

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  send_report: 'Send report (email)',
  send_whatsapp: 'Send WhatsApp message',
  send_audit_report: 'Send audit report (email)',
};

function formatDate(s: string | null): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return d.toLocaleString();
  } catch {
    return s;
  }
}

function scheduleLabel(cronExpression: string): string {
  const preset = SCHEDULE_PRESETS.find((p) => p.value === cronExpression);
  return preset ? preset.label : cronExpression;
}

export default function CronJobsSettings() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [dashboard, setDashboard] = useState<CronJobDashboardStats | null>(null);
  const [history, setHistory] = useState<CronJobRun[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyJobId, setHistoryJobId] = useState<number | ''>('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<{
    name: string;
    taskType: TaskType;
    cronExpression: string;
    customCron: string;
    isActive: boolean;
    reportType: 'summary' | 'warranty' | 'assignments';
    recipientEmails: string;
    days: number;
    to: string;
    message: string;
    auditDateRange: 'last7' | 'last30' | 'custom';
    auditDateFrom: string;
    auditDateTo: string;
    auditFormat: 'pdf' | 'csv' | 'both';
  }>({
    name: '',
    taskType: 'send_report',
    cronExpression: '0 9 * * *',
    customCron: '',
    isActive: true,
    reportType: 'summary',
    recipientEmails: '',
    days: 30,
    to: '',
    message: '',
    auditDateRange: 'last7',
    auditDateFrom: '',
    auditDateTo: '',
    auditFormat: 'pdf',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await cronJobsApi.getList();
      const data = Array.isArray(res?.data) ? res.data : [];
      setJobs(data);
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to load cron jobs');
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    setDashboardLoading(true);
    try {
      const res = await cronJobsApi.getDashboard();
      setDashboard(res?.data ?? null);
    } catch {
      setDashboard(null);
    } finally {
      setDashboardLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await cronJobsApi.getHistory({
        jobId: historyJobId === '' ? undefined : historyJobId,
        page: historyPage,
        pageSize: 20,
        dateFrom: historyDateFrom || undefined,
        dateTo: historyDateTo || undefined,
      });
      setHistory(Array.isArray(res?.data) ? res.data : []);
      setHistoryTotal(res?.total ?? 0);
    } catch {
      setHistory([]);
      setHistoryTotal(0);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!loading) loadDashboard();
  }, [loading]);

  useEffect(() => {
    loadHistory();
  }, [historyPage, historyJobId, historyDateFrom, historyDateTo]);

  useEffect(() => {
    document.title = 'Cron Jobs | Synchronics ERP';
    return () => { document.title = 'Synchronics ERP'; };
  }, []);

  const startAdd = () => {
    setEditingId(-1);
    setForm({
      name: '',
      taskType: 'send_report',
      cronExpression: '0 9 * * *',
      customCron: '',
      isActive: true,
      reportType: 'summary',
      recipientEmails: '',
      days: 30,
      to: '',
      message: '',
      auditDateRange: 'last7',
      auditDateFrom: '',
      auditDateTo: '',
      auditFormat: 'pdf',
    });
  };

  const startEdit = (job: CronJob) => {
    setEditingId(job.id);
    const config = job.config;
    const reportType = config && 'reportType' in config ? config.reportType : 'summary';
    const recipientEmails = config && 'recipientEmails' in config ? (config.recipientEmails || []).join(', ') : '';
    const days = config && 'days' in config ? (config.days ?? 30) : 30;
    const to = config && 'to' in config ? config.to : '';
    const message = config && 'message' in config ? config.message : '';
    const auditDateRange = config && 'dateRange' in config ? (config.dateRange as 'last7' | 'last30' | 'custom') : 'last7';
    const auditDateFrom = config && 'dateFrom' in config ? (config.dateFrom as string) || '' : '';
    const auditDateTo = config && 'dateTo' in config ? (config.dateTo as string) || '' : '';
    const auditFormat = config && 'format' in config ? (config.format as 'pdf' | 'csv' | 'both') : 'pdf';
    setForm({
      name: job.name,
      taskType: job.taskType,
      cronExpression: job.cronExpression,
      customCron: SCHEDULE_PRESETS.some((p) => p.value === job.cronExpression) ? '' : job.cronExpression,
      isActive: job.isActive,
      reportType,
      recipientEmails,
      days,
      to,
      message,
      auditDateRange,
      auditDateFrom,
      auditDateTo,
      auditFormat,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const getEffectiveCron = () => {
    if (form.cronExpression === '' && form.customCron.trim()) return form.customCron.trim();
    return form.cronExpression;
  };

  const buildCreatePayload = (): CreateCronJobPayload => {
    const cronExpression = getEffectiveCron();
    const name = form.name.trim();
    const isActive = form.isActive;
    if (form.taskType === 'send_report') {
      const recipientEmails = form.recipientEmails.split(/[\n,;]/).map((e) => e.trim()).filter(Boolean);
      return { name, taskType: 'send_report', cronExpression, isActive, reportType: form.reportType, recipientEmails, days: form.days };
    }
    if (form.taskType === 'send_audit_report') {
      const recipientEmails = form.recipientEmails.split(/[\n,;]/).map((e) => e.trim()).filter(Boolean);
      return {
        name,
        taskType: 'send_audit_report',
        cronExpression,
        isActive,
        dateRange: form.auditDateRange,
        dateFrom: form.auditDateFrom || undefined,
        dateTo: form.auditDateTo || undefined,
        recipientEmails,
        format: form.auditFormat,
      };
    }
    return { name, taskType: 'send_whatsapp', cronExpression, isActive, to: form.to.trim(), message: form.message.trim() };
  };

  const buildUpdatePayload = (): UpdateCronJobPayload => {
    const cronExpression = getEffectiveCron();
    const payload: UpdateCronJobPayload = {
      name: form.name.trim(),
      taskType: form.taskType,
      cronExpression,
      isActive: form.isActive,
    };
    if (form.taskType === 'send_report') {
      const recipientEmails = form.recipientEmails.split(/[\n,;]/).map((e) => e.trim()).filter(Boolean);
      payload.reportType = form.reportType;
      payload.recipientEmails = recipientEmails;
      payload.days = form.days;
    } else if (form.taskType === 'send_audit_report') {
      const recipientEmails = form.recipientEmails.split(/[\n,;]/).map((e) => e.trim()).filter(Boolean);
      payload.recipientEmails = recipientEmails;
      payload.dateRange = form.auditDateRange;
      payload.dateFrom = form.auditDateFrom || undefined;
      payload.dateTo = form.auditDateTo || undefined;
      payload.format = form.auditFormat;
    } else {
      payload.to = form.to.trim();
      payload.message = form.message.trim();
    }
    return payload;
  };

  const save = async () => {
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }
    const cronExpression = getEffectiveCron();
    if (!cronExpression) {
      setError('Schedule is required (select a preset or enter a cron expression)');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (editingId === -1) {
        await cronJobsApi.create(buildCreatePayload());
      } else if (editingId != null && editingId > 0) {
        await cronJobsApi.update(editingId, buildUpdatePayload());
      }
      await load();
      loadDashboard();
      loadHistory();
      cancelEdit();
    } catch (e) {
      setError((e as Error)?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!window.confirm('Delete this cron job?')) return;
    setSaving(true);
    setError(null);
    try {
      await cronJobsApi.delete(id);
      await load();
      loadDashboard();
      loadHistory();
      if (editingId === id) cancelEdit();
    } catch (e) {
      setError((e as Error)?.message ?? 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (job: CronJob) => {
    setSaving(true);
    setError(null);
    try {
      await cronJobsApi.update(job.id, { isActive: !job.isActive });
      await load();
    } catch (e) {
      setError((e as Error)?.message ?? 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const runNow = async (id: number) => {
    setRunningId(id);
    setError(null);
    try {
      await cronJobsApi.runNow(id);
      await load();
      await loadDashboard();
      loadHistory();
    } catch (e) {
      setError((e as Error)?.message ?? 'Run failed');
    } finally {
      setRunningId(null);
    }
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
          <h1 className="h4 mb-1">Cron Jobs</h1>
          <p className="text-muted small mb-0">Schedule tasks to run automatically (e.g. send report by email, send WhatsApp message).</p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/settings" className="btn btn-outline-secondary btn-sm">
            <i className="ti ti-arrow-left me-1" /> Back to Settings
          </Link>
          {editingId === null ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={startAdd}>
              <i className="ti ti-plus me-1" /> Add job
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

      {/* Dashboard */}
      <div className="card border shadow-sm mb-4">
        <div className="card-header">
          <h6 className="mb-0">Dashboard</h6>
        </div>
        <div className="card-body">
          {dashboardLoading ? (
            <div className="text-muted small"><span className="spinner-border spinner-border-sm me-1" role="status" />Loading...</div>
          ) : dashboard ? (
            <>
              <div className="row g-3 mb-4">
                <div className="col-6 col-md-4 col-lg-2">
                  <div className="border rounded p-2 bg-light">
                    <div className="small text-muted">Total jobs</div>
                    <div className="h5 mb-0">{dashboard.totalJobs}</div>
                  </div>
                </div>
                <div className="col-6 col-md-4 col-lg-2">
                  <div className="border rounded p-2 bg-light">
                    <div className="small text-muted">Active</div>
                    <div className="h5 mb-0 text-success">{dashboard.activeJobs}</div>
                  </div>
                </div>
                <div className="col-6 col-md-4 col-lg-2">
                  <div className="border rounded p-2 bg-light">
                    <div className="small text-muted">Total runs</div>
                    <div className="h5 mb-0">{dashboard.totalRuns}</div>
                  </div>
                </div>
                <div className="col-6 col-md-4 col-lg-2">
                  <div className="border rounded p-2 bg-light">
                    <div className="small text-muted">Success</div>
                    <div className="h5 mb-0 text-success">{dashboard.successCount}</div>
                  </div>
                </div>
                <div className="col-6 col-md-4 col-lg-2">
                  <div className="border rounded p-2 bg-light">
                    <div className="small text-muted">Failed</div>
                    <div className="h5 mb-0 text-danger">{dashboard.failedCount}</div>
                  </div>
                </div>
                <div className="col-6 col-md-4 col-lg-2">
                  <div className="border rounded p-2 bg-light">
                    <div className="small text-muted">Last 24h / 7d</div>
                    <div className="h6 mb-0">{dashboard.runsLast24h} / {dashboard.runsLast7d}</div>
                  </div>
                </div>
              </div>
              {dashboard.runsByJob && dashboard.runsByJob.length > 0 && (
                <div>
                  <h6 className="small text-muted mb-2">Runs by job</h6>
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered mb-0">
                      <thead>
                        <tr>
                          <th>Job</th>
                          <th>Run count</th>
                          <th>Last run</th>
                          <th>Last status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dashboard.runsByJob.map((row) => (
                          <tr key={row.jobId}>
                            <td>{row.jobName}</td>
                            <td>{row.runCount}</td>
                            <td className="small">{formatDate(row.lastRunAt)}</td>
                            <td>
                              <span className={`badge ${row.lastStatus === 'success' ? 'bg-success' : row.lastStatus === 'failed' ? 'bg-danger' : 'bg-secondary'}`}>
                                {row.lastStatus ?? '—'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-muted small">No dashboard data.</div>
          )}
        </div>
      </div>

      {editingId != null && (
        <div className="card border shadow-sm mb-4">
          <div className="card-header">
            <h6 className="mb-0">{editingId === -1 ? 'New cron job' : 'Edit cron job'}</h6>
          </div>
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-6">
                <label className="form-label small">Name</label>
                <input
                  type="text"
                  className="form-control form-control-sm"
                  placeholder="e.g. Daily summary report"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label small">Task type</label>
                <select
                  className="form-select form-select-sm"
                  value={form.taskType}
                  onChange={(e) => setForm((f) => ({ ...f, taskType: e.target.value as TaskType }))}
                >
                  <option value="send_report">Send report (email)</option>
                  <option value="send_whatsapp">Send WhatsApp message</option>
                  <option value="send_audit_report">Send audit report (email)</option>
                </select>
              </div>
              <div className="col-md-6">
                <label className="form-label small">Schedule</label>
                <select
                  className="form-select form-select-sm"
                  value={form.cronExpression}
                  onChange={(e) => setForm((f) => ({ ...f, cronExpression: e.target.value }))}
                >
                  {SCHEDULE_PRESETS.map((p) => (
                    <option key={p.value || 'custom'} value={p.value}>{p.label}</option>
                  ))}
                </select>
                {(form.cronExpression === '' || form.customCron) && (
                  <input
                    type="text"
                    className="form-control form-control-sm mt-1"
                    placeholder="Cron expression (e.g. 0 9 * * * for daily 9am)"
                    value={form.customCron}
                    onChange={(e) => setForm((f) => ({ ...f, customCron: e.target.value }))}
                  />
                )}
              </div>
              <div className="col-md-6 d-flex align-items-end">
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="cron-active"
                    checked={form.isActive}
                    onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  />
                  <label className="form-check-label small" htmlFor="cron-active">Active</label>
                </div>
              </div>

              {form.taskType === 'send_report' && (
                <>
                  <div className="col-md-4">
                    <label className="form-label small">Report type</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.reportType}
                      onChange={(e) => setForm((f) => ({ ...f, reportType: e.target.value as 'summary' | 'warranty' | 'assignments' }))}
                    >
                      <option value="summary">Summary</option>
                      <option value="warranty">Warranty</option>
                      <option value="assignments">Assignments</option>
                    </select>
                  </div>
                  {form.reportType === 'assignments' && (
                    <div className="col-md-4">
                      <label className="form-label small">Last N days</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min={1}
                        max={365}
                        value={form.days}
                        onChange={(e) => setForm((f) => ({ ...f, days: parseInt(e.target.value, 10) || 30 }))}
                      />
                    </div>
                  )}
                  <div className="col-12">
                    <label className="form-label small">Recipient emails (comma- or newline-separated)</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      placeholder="user@example.com, other@example.com"
                      value={form.recipientEmails}
                      onChange={(e) => setForm((f) => ({ ...f, recipientEmails: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {form.taskType === 'send_audit_report' && (
                <>
                  <div className="col-md-4">
                    <label className="form-label small">Date range</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.auditDateRange}
                      onChange={(e) => setForm((f) => ({ ...f, auditDateRange: e.target.value as 'last7' | 'last30' | 'custom' }))}
                    >
                      <option value="last7">Last 7 days</option>
                      <option value="last30">Last 30 days</option>
                      <option value="custom">Custom (From/To)</option>
                    </select>
                  </div>
                  {form.auditDateRange === 'custom' && (
                    <>
                      <div className="col-md-4">
                        <label className="form-label small">From (YYYY-MM-DD)</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={form.auditDateFrom}
                          onChange={(e) => setForm((f) => ({ ...f, auditDateFrom: e.target.value }))}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label small">To (YYYY-MM-DD)</label>
                        <input
                          type="date"
                          className="form-control form-control-sm"
                          value={form.auditDateTo}
                          onChange={(e) => setForm((f) => ({ ...f, auditDateTo: e.target.value }))}
                        />
                      </div>
                    </>
                  )}
                  <div className="col-md-4">
                    <label className="form-label small">Format</label>
                    <select
                      className="form-select form-select-sm"
                      value={form.auditFormat}
                      onChange={(e) => setForm((f) => ({ ...f, auditFormat: e.target.value as 'pdf' | 'csv' | 'both' }))}
                    >
                      <option value="pdf">PDF</option>
                      <option value="csv">CSV</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Recipient emails (comma- or newline-separated)</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={2}
                      placeholder="user@example.com, other@example.com"
                      value={form.recipientEmails}
                      onChange={(e) => setForm((f) => ({ ...f, recipientEmails: e.target.value }))}
                    />
                  </div>
                </>
              )}

              {form.taskType === 'send_whatsapp' && (
                <>
                  <div className="col-md-6">
                    <label className="form-label small">To (phone with country code)</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="+919876543210"
                      value={form.to}
                      onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
                    />
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Message</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows={3}
                      placeholder="Message to send"
                      value={form.message}
                      onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                    />
                  </div>
                </>
              )}

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
          <h6 className="mb-0">Scheduled jobs</h6>
        </div>
        <div className="card-body p-0">
          {jobs.length === 0 ? (
            <div className="p-4 text-center text-muted small">
              No cron jobs. Add one to run tasks automatically (e.g. send report, send WhatsApp).
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Task</th>
                    <th>Schedule</th>
                    <th>Status</th>
                    <th>Last run</th>
                    <th>Next run</th>
                    <th style={{ width: 180 }} />
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id}>
                      <td>{job.name}</td>
                      <td>{TASK_TYPE_LABELS[job.taskType] ?? job.taskType}</td>
                      <td><code className="small">{scheduleLabel(job.cronExpression)}</code></td>
                      <td>
                        <span className={`badge ${job.isActive ? 'bg-success' : 'bg-secondary'}`}>
                          {job.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="small text-muted">{formatDate(job.lastRunAt)}</td>
                      <td className="small text-muted">{formatDate(job.nextRunAt)}</td>
                      <td>
                        <div className="btn-group btn-group-sm">
                          <button type="button" className="btn btn-outline-primary" onClick={() => startEdit(job)} title="Edit">
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-secondary"
                            onClick={() => toggleActive(job)}
                            disabled={saving}
                            title={job.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {job.isActive ? 'Off' : 'On'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-info"
                            onClick={() => runNow(job.id)}
                            disabled={runningId !== null}
                            title="Run now"
                          >
                            {runningId === job.id ? <span className="spinner-border spinner-border-sm" role="status" /> : 'Run'}
                          </button>
                          <button type="button" className="btn btn-outline-danger" onClick={() => remove(job.id)} title="Delete">
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Run history */}
      <div className="card border shadow-sm mt-4">
        <div className="card-header">
          <h6 className="mb-0">Run history</h6>
        </div>
        <div className="card-body">
          <div className="row g-2 mb-3">
            <div className="col-auto">
              <label className="form-label small mb-0 me-1">Job</label>
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={historyJobId === '' ? '' : historyJobId}
                onChange={(e) => { setHistoryJobId(e.target.value === '' ? '' : Number(e.target.value)); setHistoryPage(1); }}
              >
                <option value="">All</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>{j.name}</option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <label className="form-label small mb-0 me-1">From</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={historyDateFrom}
                onChange={(e) => { setHistoryDateFrom(e.target.value); setHistoryPage(1); }}
              />
            </div>
            <div className="col-auto">
              <label className="form-label small mb-0 me-1">To</label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={historyDateTo}
                onChange={(e) => { setHistoryDateTo(e.target.value); setHistoryPage(1); }}
              />
            </div>
            <div className="col-auto d-flex align-items-end">
              <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => loadHistory()}>
                Apply
              </button>
            </div>
          </div>
          {historyLoading ? (
            <div className="text-muted small"><span className="spinner-border spinner-border-sm me-1" role="status" />Loading history...</div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="table table-sm table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Run at</th>
                      <th>Status</th>
                      <th>Duration</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.length === 0 ? (
                      <tr><td colSpan={5} className="text-muted text-center py-3">No runs found.</td></tr>
                    ) : (
                      history.map((run) => (
                        <tr key={run.id}>
                          <td>{run.jobName ?? run.cronJobId}</td>
                          <td className="small">{formatDate(run.runAt)}</td>
                          <td>
                            <span className={`badge ${run.status === 'success' ? 'bg-success' : 'bg-danger'}`}>
                              {run.status}
                            </span>
                          </td>
                          <td className="small">{run.durationMs != null ? `${run.durationMs} ms` : '—'}</td>
                          <td className="small text-danger" style={{ maxWidth: 280 }} title={run.errorMessage ?? ''}>
                            {run.errorMessage ? (run.errorMessage.length > 60 ? run.errorMessage.slice(0, 60) + '…' : run.errorMessage) : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {historyTotal > 20 && (
                <div className="d-flex justify-content-between align-items-center mt-2">
                  <span className="small text-muted">
                    Showing {(historyPage - 1) * 20 + 1}–{Math.min(historyPage * 20, historyTotal)} of {historyTotal}
                  </span>
                  <div className="btn-group btn-group-sm">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={historyPage <= 1}
                      onClick={() => setHistoryPage((p) => p - 1)}
                    >
                      Previous
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      disabled={historyPage * 20 >= historyTotal}
                      onClick={() => setHistoryPage((p) => p + 1)}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
