/**
 * Per-user mailbox credentials for webmail (hMailServer IMAP/SMTP).
 * User saves email + password and server details here.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';

interface Credentials {
  email: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
}

const defaultForm: Credentials & { password: string } = {
  email: '',
  password: '',
  imapHost: 'localhost',
  imapPort: 143,
  imapSecure: false,
  smtpHost: 'localhost',
  smtpPort: 587,
  smtpSecure: false,
};

export default function MailboxSettings() {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get<{ success: boolean; data: Credentials | null }>('/api/mailbox/credentials')
      .then((res) => {
        if (res.data) {
          setForm((f) => ({
            ...f,
            email: res.data!.email,
            imapHost: res.data!.imapHost,
            imapPort: res.data!.imapPort,
            imapSecure: res.data!.imapSecure,
            smtpHost: res.data!.smtpHost,
            smtpPort: res.data!.smtpPort,
            smtpSecure: res.data!.smtpSecure,
            password: '', // never returned from API
          }));
        }
      })
      .catch((e) => setError(e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!form.email.trim()) {
      setError('Email is required');
      return;
    }
    if (!form.password) {
      setError('Password is required to save (or update) credentials');
      return;
    }
    setSaving(true);
    api.put('/api/mailbox/credentials', form)
      .then(() => {
        setSuccess(true);
        setForm((f) => ({ ...f, password: '' }));
      })
      .catch((e) => setError(e?.message ?? 'Failed to save'))
      .finally(() => setSaving(false));
  };

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="text-center text-muted py-5">Loading…</div>
      </div>
    );
  }

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="mb-1 fw-bold">
            <i className="ti ti-mail me-2 text-primary" />
            Email account (webmail)
          </h4>
          <p className="text-muted mb-0 small">
            Configure your hMailServer mailbox. Match SSL to your server: port 143 = IMAP without SSL; port 993 = IMAP with SSL. Port 587 = SMTP usually no SSL; 465 = SMTP with SSL.
          </p>
        </div>
        <Link to="/emails" className="btn btn-outline-primary btn-sm">
          <i className="ti ti-inbox me-1" />
          Open Inbox
        </Link>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close" />
        </div>
      )}
      {success && (
        <div className="alert alert-success alert-dismissible fade show">
          Settings saved. You can use the Emails menu to open your inbox.
          <button type="button" className="btn-close" onClick={() => setSuccess(false)} aria-label="Close" />
        </div>
      )}

      <div className="card border-0 shadow-sm">
        <div className="card-header bg-transparent border-bottom py-3">
          <h5 className="mb-0 fw-semibold">Account &amp; servers</h5>
        </div>
        <div className="card-body">
          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-12">
                <label className="form-label">Email address</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="you@yourdomain.com"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value.trim() }))}
                  required
                />
              </div>
              <div className="col-12">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder={form.imapHost ? 'Leave blank to keep current' : 'Mailbox password'}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
                <div className="form-text">Required when saving or updating. Not shown after save.</div>
              </div>
              <div className="col-12"><hr className="my-2" /><h6 className="text-muted">IMAP (incoming)</h6></div>
              <div className="col-md-6">
                <label className="form-label">IMAP host</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="localhost or mail.example.com"
                  value={form.imapHost}
                  onChange={(e) => setForm((f) => ({ ...f, imapHost: e.target.value }))}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Port</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.imapPort}
                  onChange={(e) => setForm((f) => ({ ...f, imapPort: parseInt(e.target.value, 10) || 143 }))}
                />
              </div>
              <div className="col-md-3 d-flex align-items-end pb-2">
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="imapSecure"
                    checked={form.imapSecure}
                    onChange={(e) => setForm((f) => ({ ...f, imapSecure: e.target.checked }))}
                  />
                  <label className="form-check-label" htmlFor="imapSecure">SSL/TLS</label>
                </div>
              </div>
              <div className="col-12"><h6 className="text-muted">SMTP (outgoing)</h6></div>
              <div className="col-md-6">
                <label className="form-label">SMTP host</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="localhost or mail.example.com"
                  value={form.smtpHost}
                  onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))}
                />
              </div>
              <div className="col-md-3">
                <label className="form-label">Port</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.smtpPort}
                  onChange={(e) => setForm((f) => ({ ...f, smtpPort: parseInt(e.target.value, 10) || 587 }))}
                />
              </div>
              <div className="col-md-3 d-flex align-items-end pb-2">
                <div className="form-check">
                  <input
                    type="checkbox"
                    className="form-check-input"
                    id="smtpSecure"
                    checked={form.smtpSecure}
                    onChange={(e) => setForm((f) => ({ ...f, smtpSecure: e.target.checked }))}
                  />
                  <label className="form-check-label" htmlFor="smtpSecure">SSL/TLS</label>
                </div>
              </div>
            </div>
            <div className="mt-4">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Saving…' : 'Save settings'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
