/**
 * Modal for the current user to set "lock screen after idle" preference.
 * Available from the user dropdown (Preferences) so any user can change it without General Settings permission.
 */

import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useUserSettings } from '../contexts/UserSettingsContext';

const IDLE_LOCK_OPTIONS = [
  { value: 0, label: "Don't lock automatically" },
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
];

interface IdleLockPreferencesModalProps {
  show: boolean;
  onClose: () => void;
}

export default function IdleLockPreferencesModal({ show, onClose }: IdleLockPreferencesModalProps) {
  const { idleLockMinutes, refetch } = useUserSettings();
  const [selectedIdle, setSelectedIdle] = useState(idleLockMinutes);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setSelectedIdle(idleLockMinutes);
  }, [idleLockMinutes]);

  useEffect(() => {
    if (!show) setMsg(null);
  }, [show]);

  const handleSave = () => {
    setSaving(true);
    setMsg(null);
    api
      .put<{ success: boolean; idleLockMinutes: number }>('/api/settings/user', { idleLockMinutes: selectedIdle })
      .then(() => {
        setMsg({ type: 'success', text: 'Screen lock preference saved.' });
        refetch();
      })
      .catch((e) => setMsg({ type: 'error', text: e?.message ?? 'Failed to save' }))
      .finally(() => setSaving(false));
  };

  if (!show) return null;

  return (
    <div className="modal fade show d-block" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="idleLockModalTitle" style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}>
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title" id="idleLockModalTitle">Screen lock</h5>
            <button type="button" className="btn-close" onClick={onClose} aria-label="Close" />
          </div>
          <div className="modal-body">
            <p className="text-muted small mb-3">
              Lock the screen automatically after a period of inactivity. Choose &quot;Don&apos;t lock automatically&quot; to disable.
            </p>
            {msg && (
              <div className={`alert alert-${msg.type} py-2 small mb-3`} role="alert">
                {msg.text}
              </div>
            )}
            <label className="form-label">Lock screen after idle</label>
            <select
              className="form-select"
              value={selectedIdle}
              onChange={(e) => setSelectedIdle(Number(e.target.value))}
            >
              {IDLE_LOCK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
