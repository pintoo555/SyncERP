import { useState, useEffect } from 'react';
import { api } from '../../../api/client';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { TIMEZONE_OPTIONS, DEFAULT_TIMEZONE } from '../../../data/timezones';

export default function GeneralSettings() {
  const { timeZone, refetch } = useAppSettings();
  const [selectedTz, setSelectedTz] = useState(timeZone || DEFAULT_TIMEZONE);
  useEffect(() => {
    if (timeZone) setSelectedTz(timeZone);
  }, [timeZone]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSave = () => {
    setSaving(true);
    setMsg(null);
    api
      .put<{ success: boolean; timeZone?: string }>('/api/settings/app', { timeZone: selectedTz })
      .then(() => {
        setMsg({ type: 'success', text: 'Settings saved. Timezone is now applied to Audit Log and all date/time display.' });
        refetch();
      })
      .catch((e) => setMsg({ type: 'error', text: e?.message ?? 'Failed to save' }))
      .finally(() => setSaving(false));
  };

  return (
    <div className="container-fluid">
      <h4 className="mb-4">General Settings</h4>
      {msg && (
        <div className={`alert alert-${msg.type} alert-dismissible fade show`} role="alert">
          {msg.text}
          <button type="button" className="btn-close" onClick={() => setMsg(null)} aria-label="Close" />
        </div>
      )}
      <div className="card">
        <div className="card-header">Timezone</div>
        <div className="card-body">
          <p className="text-muted small">
            All times in the app (Audit Log, reports, tickets, etc.) are shown in the selected timezone. Default: Kolkata, West Bengal (GMT+5:30).
          </p>
          <div className="row align-items-end">
            <div className="col-md-6">
              <label className="form-label">Time zone</label>
              <select
                className="form-select"
                value={selectedTz}
                onChange={(e) => setSelectedTz(e.target.value)}
              >
                {TIMEZONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-6">
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
