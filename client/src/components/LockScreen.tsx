/**
 * Lock screen view (Inspinia-style). Shown when user clicks "Lock Screen" in topbar.
 * User enters password to unlock or "Not you? Return to Sign in" to log out.
 */

import { useState } from 'react';
import { api } from '../api/client';

const LOCK_STORAGE_KEY = 'synchronics_locked';

export function isLocked(): boolean {
  try {
    return sessionStorage.getItem(LOCK_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setLocked(value: boolean): void {
  try {
    if (value) sessionStorage.setItem(LOCK_STORAGE_KEY, '1');
    else sessionStorage.removeItem(LOCK_STORAGE_KEY);
  } catch (_) {}
}

interface LockScreenViewProps {
  userName: string;
  userId: number;
  onUnlock: () => void;
  onSignOut: () => void;
}

function LockAvatar({ userId, name }: { userId: number; name: string }) {
  const src = `/user-photos/${userId}.jpg`;
  return (
    <img
      src={src}
      alt={name}
      width={80}
      height={80}
      className="rounded-circle flex-shrink-0"
      style={{ objectFit: 'cover' }}
      onError={(e) => {
        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle fill="%236c757d" cx="40" cy="40" r="40"/><text x="40" y="48" text-anchor="middle" fill="white" font-size="24">?</text></svg>';
      }}
    />
  );
}

export default function LockScreenView({ userName, userId, onUnlock, onSignOut }: LockScreenViewProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password.trim()) {
      setError('Enter your password');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post<{ success: boolean; valid: boolean }>('/api/auth/verify-password', { password });
      if (res?.valid) {
        setLocked(false);
        onUnlock();
      } else {
        setError('Incorrect password');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    setLocked(false);
    onSignOut();
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-body-secondary">
      <div className="auth-box w-100">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-sm-10 col-md-8 col-lg-5">
              <div className="card shadow-sm rounded-4 overflow-hidden">
                <div className="card-body p-4 p-sm-5 text-center">
                  <div className="mb-4">
                    <LockAvatar userId={userId} name={userName} />
                  </div>
                  <h4 className="fw-bold mb-1">Lock Screen</h4>
                  <p className="text-muted small mb-4">This screen is locked. Enter your password to continue.</p>
                  <p className="fw-semibold text-body mb-3">{userName}</p>
                  <form onSubmit={handleUnlock}>
                    {error && (
                      <div className="alert alert-danger py-2 small mb-3" role="alert">
                        {error}
                      </div>
                    )}
                    <div className="mb-3 text-start">
                      <label htmlFor="lockPassword" className="form-label">Password <span className="text-danger">*</span></label>
                      <input
                        type="password"
                        className="form-control form-control-lg"
                        id="lockPassword"
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoFocus
                        autoComplete="current-password"
                        disabled={loading}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary btn-lg w-100 mb-3" disabled={loading}>
                      {loading ? 'Unlocking…' : 'Unlock'}
                    </button>
                  </form>
                  <p className="mb-0 small text-muted">
                    Not you?{' '}
                    <button type="button" className="btn btn-link btn-sm p-0 align-baseline text-primary" onClick={handleSignOut}>
                      Return to Sign in
                    </button>
                  </p>
                </div>
              </div>
              <p className="text-center text-muted small mt-4">© {new Date().getFullYear()} Synchronics ERP</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
