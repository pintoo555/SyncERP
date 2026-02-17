import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';
import LoginAvatar, { computeGaze, type GazeState } from '../../../components/LoginAvatar';
import './Login.css';

/** Company images for login panel – one random image per page load */
const COMPANY_IMAGES: string[] = Array.from({ length: 60 }, (_, i) => `img (${i + 1}).jpg`);

function getRandomCompanyImageUrl(): string {
  const name = COMPANY_IMAGES[Math.floor(Math.random() * COMPANY_IMAGES.length)];
  return `/images/company/${encodeURIComponent(name)}`;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [gaze, setGaze] = useState<GazeState | null>(null);
  const [eyesCovered, setEyesCovered] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [sideImageUrl] = useState<string>(() => getRandomCompanyImageUrl());
  const emailRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!emailFocused) {
      setGaze(null);
      return;
    }
    const id = requestAnimationFrame(() => {
      setGaze(computeGaze(emailRef.current, avatarRef.current));
    });
    return () => cancelAnimationFrame(id);
  }, [email, emailFocused]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      if (rememberMe) {
        try { localStorage.setItem('synchronics_remember', '1'); } catch (_) {}
      } else {
        try { localStorage.removeItem('synchronics_remember'); } catch (_) {}
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-box d-flex align-items-center">
      <div className="container-xxl">
        <div className="row align-items-center justify-content-center">
          <div className="col-xl-10">
            <div className="card rounded-4">
              <div className="row justify-content-between g-0">
                <div className="col-lg-6">
                  <div className="card-body auth-form-animated">
                    <LoginAvatar
                      ref={avatarRef}
                      gaze={gaze}
                      eyesCovered={eyesCovered}
                      emailFocused={emailFocused}
                    />
                    <div className="auth-brand text-center mb-4">
                      <Link to="/" className="logo-dark">
                        <img src="/images/logo-black.png" alt="Synchronics" height="32" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <span className="d-none fw-bold fs-4">Synchronics</span>
                      </Link>
                      <Link to="/" className="logo-light">
                        <img src="/images/logo.png" alt="Synchronics" height="32" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <span className="d-none fw-bold fs-4">Synchronics</span>
                      </Link>
                      <h4 className="fw-bold mt-4">Welcome back</h4>
                      <p className="text-muted w-lg-75 mx-auto">Sign in with your email and password to continue.</p>
                    </div>

                    <form onSubmit={handleSubmit}>
                      {error && (
                        <div className="auth-form-group alert alert-danger py-2 small mb-3" role="alert">
                          {error}
                        </div>
                      )}
                      <div className="auth-form-group auth-input-wrap">
                        <span className="auth-input-icon" aria-hidden><i className="ti ti-mail" /></span>
                        <input
                          ref={emailRef}
                          type="text"
                          id="userEmail"
                          placeholder=" "
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          onFocus={() => setEmailFocused(true)}
                          onBlur={() => setEmailFocused(false)}
                          required
                          autoComplete="username"
                        />
                        <label htmlFor="userEmail" className="auth-floating-label">Email address</label>
                        <span className="auth-underline" aria-hidden />
                      </div>

                      <div className="auth-form-group auth-input-wrap">
                        <span className="auth-input-icon" aria-hidden><i className="ti ti-lock-password" /></span>
                        <input
                          type="password"
                          id="userPassword"
                          placeholder=" "
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onFocus={() => setEyesCovered(true)}
                          onBlur={() => setEyesCovered(false)}
                          required
                          autoComplete="current-password"
                        />
                        <label htmlFor="userPassword" className="auth-floating-label">Password</label>
                        <span className="auth-underline" aria-hidden />
                      </div>

                      <div className="auth-remember-row d-flex justify-content-between align-items-center mb-3">
                        <div className="form-check">
                          <input
                            className="form-check-input form-check-input-light fs-14"
                            type="checkbox"
                            id="rememberMe"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                          />
                          <label className="form-check-label" htmlFor="rememberMe">Keep me signed in</label>
                        </div>
                      </div>

                      <div className="d-grid">
                        <button type="submit" className="auth-btn-submit btn btn-primary fw-semibold py-2" disabled={loading}>
                          {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                      </div>
                    </form>

                    <p className="auth-footer-line text-center text-muted mt-4 mb-0">
                      &copy; {new Date().getFullYear()} <span className="fw-semibold">Synchronics ERP</span>
                    </p>
                  </div>
                </div>

                <div className="col-lg-6 d-none d-lg-block">
                  <div
                    className="h-100 position-relative card-side-img rounded-end-4 rounded-end rounded-0 overflow-hidden bg-dark"
                    style={{ minHeight: 320 }}
                  >
                    <img
                      src={sideImageUrl}
                      alt=""
                      className="position-absolute top-0 start-0 w-100 h-100 object-fit-cover"
                      style={{ objectFit: 'cover' }}
                      onError={(e) => {
                        const t = e.target as HTMLImageElement;
                        t.onerror = null;
                        if (t.src.includes('/company/')) {
                          t.src = '/images/auth.jpg';
                        } else {
                          t.src = '/images/user-bg-pattern.svg';
                        }
                      }}
                    />
                    <div className="p-4 card-img-overlay rounded-4 rounded-start-0 auth-overlay d-flex align-items-end justify-content-center" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
