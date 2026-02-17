import { useState, useEffect, useCallback, useRef } from 'react';

/** Use same base as API when set (e.g. VITE_API_URL=http://host:4000) so health check reaches backend. */
function getHealthUrl(): string {
  const base =
    typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL
      ? String(import.meta.env.VITE_API_URL).replace(/\/$/, '')
      : '';
  return base ? `${base}/ping` : '/ping';
}

const HEALTH_TIMEOUT_MS = 5000;
const HEALTH_RETRY_DELAY_MS = 3000;
const MAX_ATTEMPTS = 3;

export function ApiConnectivity({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'ok' | 'unreachable'>('checking');
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const mountedRef = useRef(true);

  const check = useCallback(async () => {
    setStatus('checking');
    setBannerDismissed(false);
    const url = getHealthUrl();

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      if (!mountedRef.current) return;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
      try {
        await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (mountedRef.current) setStatus('ok');
        return;
      } catch {
        clearTimeout(timeout);
        if (attempt < MAX_ATTEMPTS && mountedRef.current) {
          await new Promise((r) => setTimeout(r, HEALTH_RETRY_DELAY_MS));
        } else if (mountedRef.current) {
          setStatus('unreachable');
        }
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    check();
    return () => {
      mountedRef.current = false;
    };
  }, [check]);

  // Always render children (app is usable even without connectivity banner)
  return (
    <>
      {status === 'unreachable' && !bannerDismissed && (
        <div
          className="border-bottom bg-warning bg-opacity-15 border-warning shadow-sm"
          style={{ padding: '0.75rem 1rem' }}
          role="alert"
        >
          <div className="container-fluid d-flex flex-wrap align-items-center justify-content-between gap-2">
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <i className="ti ti-plug-off text-warning" style={{ fontSize: '1.1rem' }} />
              <span className="fw-semibold">Cannot connect to the API server.</span>
              <span className="small text-muted">
                Start both servers with <code className="bg-dark text-light px-1 rounded">npm run dev</code> from the project root
                (this runs the API on port 4000 + the client on port 3000).
              </span>
            </div>
            <div className="d-flex align-items-center gap-2">
              <button type="button" className="btn btn-sm btn-outline-warning" onClick={check}>
                Retry
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setBannerDismissed(true)}
                aria-label="Dismiss"
              >
                &times;
              </button>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
