import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api/client';
import { getLastActivityAt, subscribe } from '../utils/activityTracker';
import { formatTimeAgo, formatDateTime, locationFromUserAgent } from '../utils/timeAgo';

interface SessionRow {
  sessionId: string;
  userAgent: string;
  ipAddress: string;
  lastActivityAt: string;
  createdAt: string;
  isCurrent: boolean;
}

function useLastActivityLabel(): string {
  const [ts, setTs] = useState(getLastActivityAt);
  useEffect(() => {
    const unsub = subscribe(() => setTs(getLastActivityAt()));
    return unsub;
  }, []);
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(interval);
  }, []);
  const label = ts ? formatTimeAgo(Date.now() - ts) : '—';
  return label;
}

export function FooterActivity() {
  const lastActivityLabel = useLastActivityLabel();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [otherCount, setOtherCount] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revokingIds, setRevokingIds] = useState<Set<string>>(new Set());

  const loadSessions = useCallback(() => {
    setLoading(true);
    api
      .get<{ success: boolean; sessions: SessionRow[] }>('/api/auth/sessions')
      .then((res) => {
        if (res?.success && Array.isArray(res.sessions)) {
          setSessions(res.sessions);
          const other = res.sessions.filter((s) => !s.isCurrent);
          setOtherCount(other.length);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSessions();
    const interval = setInterval(loadSessions, 60 * 1000);
    return () => clearInterval(interval);
  }, [loadSessions]);

  const openDetails = () => {
    setShowDetails(true);
    loadSessions();
  };

  const handleRevoke = (sessionId: string) => {
    setRevokingIds((prev) => new Set(prev).add(sessionId));
    setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
    setOtherCount((prev) => Math.max(0, prev - 1));
    api
      .post(`/api/auth/sessions/${encodeURIComponent(sessionId)}/revoke`, {})
      .then(() => loadSessions())
      .catch(() => loadSessions())
      .finally(() => {
        setRevokingIds((prev) => {
          const next = new Set(prev);
          next.delete(sessionId);
          return next;
        });
      });
  };

  const visibleSessions = sessions.filter((s) => !revokingIds.has(s.sessionId));

  const modalEl = showDetails && typeof document !== 'undefined' && (
    <div
      className="modal show d-block"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 1050,
        overflow: 'auto',
      }}
      aria-modal
      role="dialog"
      aria-labelledby="activity-modal-title"
      onClick={() => setShowDetails(false)}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-lg"
        style={{ margin: '1.75rem auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content">
          <div className="modal-header">
            <h5 id="activity-modal-title" className="modal-title">
              Account activity &amp; locations
            </h5>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={() => setShowDetails(false)}
            />
          </div>
          <div className="modal-body">
            <p className="text-muted small mb-3">
              Devices and locations where your account is currently signed in (active in the last 30 minutes).
            </p>
            {loading && visibleSessions.length === 0 ? (
              <p className="text-muted small">Loading…</p>
            ) : visibleSessions.length === 0 ? (
              <p className="text-muted small">No active sessions to show.</p>
            ) : (
              <div className="table-responsive">
                <table className="table table-sm table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Device type</th>
                      <th>IP Address</th>
                      <th>Last activity</th>
                      <th>Date &amp; time</th>
                      <th className="text-end">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSessions.map((s) => (
                      <tr key={s.sessionId}>
                        <td>
                          <span className="fw-medium">{locationFromUserAgent(s.userAgent || '')}</span>
                          {s.isCurrent && (
                            <span className="badge text-bg-primary ms-2">This device</span>
                          )}
                        </td>
                        <td>{s.ipAddress || '—'}</td>
                        <td>{formatTimeAgo(Date.now() - new Date(s.lastActivityAt).getTime())}</td>
                        <td>{formatDateTime(s.lastActivityAt)}</td>
                        <td className="text-end">
                          {!s.isCurrent && (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleRevoke(s.sessionId)}
                            >
                              Sign out
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-end gap-2 gap-md-3">
        <span className="text-nowrap">Last account activity: {lastActivityLabel}</span>
        {otherCount > 0 && (
          <span className="text-nowrap">
            Currently being used in {otherCount} other location{otherCount !== 1 ? 's' : ''}.{' '}
          </span>
        )}
        <button
          type="button"
          className="btn btn-link link-primary p-0 align-baseline small text-decoration-underline"
          onClick={openDetails}
        >
          Details
        </button>
      </div>

      {modalEl && createPortal(modalEl, document.body)}
    </>
  );
}
