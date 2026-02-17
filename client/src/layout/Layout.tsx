import { useState, useMemo, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useChatUnread } from '../contexts/ChatUnreadContext';
import { useEmailUnread } from '../contexts/EmailUnreadContext';
import { useHealthAlerts } from '../contexts/HealthAlertsContext';
import { useUserSettings } from '../contexts/UserSettingsContext';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../api/client';
import { FooterActivity } from '../components/FooterActivity';
import LockScreenView, { isLocked, setLocked } from '../components/LockScreen';
import IdleLockPreferencesModal from '../components/IdleLockPreferencesModal';
import { MENU_ROOT, filterMenuByPermission } from '../config/menuConfig';
import { getTablerIconClass } from '../config/tablerIcons';

interface ConversationRow {
  userId: number;
  name: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount?: number;
}

function formatDropdownTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Icon and color for health alert by metric */
function getHealthAlertIcon(metric: string, status: string): { icon: string; bg: string; iconColor: string } {
  const isActive = status === 'active';
  const base = isActive ? { bg: 'bg-danger bg-opacity-15', iconColor: 'text-danger' } : { bg: 'bg-secondary bg-opacity-10', iconColor: 'text-secondary' };
  const icons: Record<string, string> = {
    cpu: 'ti-cpu',
    memory: 'ti-device-desktop-analytics',
    disk: 'ti-database',
  };
  return { ...base, icon: icons[metric?.toLowerCase()] || 'ti-alert-triangle' };
}

declare global {
  interface Window {
    Simplebar?: new (el: HTMLElement) => { unMount: () => void };
    bootstrap?: typeof import('bootstrap');
  }
}

function Avatar({ userId, name }: { userId: number; name: string }) {
  const src = `/user-photos/${userId}.jpg`;
  return (
    <img
      src={src}
      alt={name}
      width={32}
      height={32}
      className="rounded-circle flex-shrink-0"
      style={{ objectFit: 'cover' }}
      onError={(e) => {
        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle fill="%236c757d" cx="20" cy="20" r="20"/><text x="20" y="24" text-anchor="middle" fill="white" font-size="14">?</text></svg>';
      }}
    />
  );
}

const BASE_TITLE = 'Synchronics ERP';

export default function Layout() {
  const { user, logout } = useAuth();
  const { totalUnreadCount, refetch: refetchUnread } = useChatUnread();
  const { unreadCount: emailUnreadCount } = useEmailUnread();
  const healthAlerts = useHealthAlerts();
  const { idleLockMinutes } = useUserSettings();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [locked, setLockedState] = useState(() => isLocked());
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [chatConversations, setChatConversations] = useState<ConversationRow[]>([]);
  const [chatDropdownLoading, setChatDropdownLoading] = useState(false);
  const chatDropdownRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const simplebarInstanceRef = useRef<InstanceType<NonNullable<typeof window.Simplebar>> | null>(null);

  // Browser tab title: show unread count with red-dot style when there are unread chats (re-apply on route change so it wins after child pages unmount)
  useEffect(() => {
    document.title = totalUnreadCount > 0 ? `● ${totalUnreadCount} ${BASE_TITLE}` : BASE_TITLE;
  }, [totalUnreadCount, location.pathname]);

  const menuItems = useMemo(
    () => filterMenuByPermission(MENU_ROOT, user?.permissions),
    [user?.permissions]
  );
  // Sync expanded state with current path and open parent collapses
  useEffect(() => {
    const path = location.pathname;
    const open = new Set<string>();
    MENU_ROOT.forEach((item) => {
      if (item.children?.length) {
        const hasActive = item.children.some((c) => c.path && (path === c.path || path.startsWith(c.path + '/')));
        if (hasActive) open.add(item.key);
      }
    });
    setExpandedKeys((prev) => (prev.size === 0 ? open : new Set([...prev, ...open])));
  }, [location.pathname]);

  // Init Bootstrap dropdowns for dynamically rendered topbar (React)
  useEffect(() => {
    const bootstrap = window.bootstrap;
    if (!bootstrap) return;
    document.querySelectorAll('.app-topbar [data-bs-toggle="dropdown"]').forEach((el) => {
      try {
        bootstrap.Dropdown.getOrCreateInstance(el);
      } catch (_) {}
    });
  }, [user]);

  // When chat dropdown opens, fetch conversations for the messages list
  useEffect(() => {
    const el = chatDropdownRef.current;
    if (!el || !user) return;
    const onShow = () => {
      setChatDropdownLoading(true);
      api
        .get<{ success: boolean; data: ConversationRow[] }>('/api/chat/conversations')
        .then((res) => {
          if (Array.isArray(res?.data)) setChatConversations(res.data);
        })
        .catch(() => setChatConversations([]))
        .finally(() => setChatDropdownLoading(false));
    };
    el.addEventListener('show.bs.dropdown', onShow);
    return () => el.removeEventListener('show.bs.dropdown', onShow);
  }, [user]);

  // After React has rendered, activate only the current link and its parents (single active item)
  useEffect(() => {
    const bootstrap = window.bootstrap;
    if (!bootstrap) return;
    const sideNav = document.querySelector('.side-nav');
    if (!sideNav) return;
    const path = location.pathname;
    // Find the matching link and which collapses should stay open (ancestors of it)
    let matchingLink: Element | null = null;
    const collapsesToKeepOpen = new Set<Element>();
    sideNav.querySelectorAll('a.side-nav-link[href]').forEach((link) => {
      const href = (link as HTMLAnchorElement).getAttribute('href') || '';
      const isMatch = path === href || (href !== '/' && path.startsWith(href));
      if (isMatch) {
        matchingLink = link;
        let el: Element | null = link.closest('li');
        while (el && el !== sideNav) {
          const collapse = el.querySelector(':scope > .collapse');
          if (collapse) collapsesToKeepOpen.add(collapse);
          el = el.parentElement?.closest('li') || null;
        }
      }
    });
    // Clear all active state
    sideNav.querySelectorAll('a.side-nav-link, li.active').forEach((el) => el.classList.remove('active'));
    // Hide only collapses that are NOT ancestors of the current path (so the open parent menu stays open)
    sideNav.querySelectorAll('.collapse.show').forEach((el) => {
      if (collapsesToKeepOpen.has(el)) return;
      try {
        const inst = bootstrap.Collapse.getInstance(el);
        if (inst) inst.hide();
      } catch (_) {}
    });
    // Set active on the matching link and its parent chain (so submenu + parent menu both look active), and show their collapses
    if (matchingLink) {
      (matchingLink as HTMLElement).classList.add('active');
      let el: Element | null = (matchingLink as HTMLElement).closest('li');
      while (el && el !== sideNav) {
        el.classList.add('active');
        const parentLink = el.querySelector(':scope > a.side-nav-link');
        if (parentLink) parentLink.classList.add('active');
        const collapse = el.querySelector(':scope > .collapse');
        if (collapse && collapse.id) {
          try {
            bootstrap.Collapse.getOrCreateInstance(collapse, { toggle: false }).show();
          } catch (_) {}
        }
        el = el.parentElement?.closest('li') || null;
      }
    }
  }, [location.pathname]);

  // Init Simplebar on sidebar scroll area (theme uses data-simplebar)
  useEffect(() => {
    const el = scrollbarRef.current;
    if (!el || !window.Simplebar) return;
    try {
      simplebarInstanceRef.current = new window.Simplebar(el);
    } catch (_) {}
    return () => {
      try {
        simplebarInstanceRef.current?.unMount();
        simplebarInstanceRef.current = null;
      } catch (_) {}
    };
  }, []);

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleSidebar = () => setSidebarOpen((o) => !o);
  const closeSidebar = () => setSidebarOpen(false);
  // Inspinia: sidebar-enable + backdrop only for offcanvas (mobile overlay). Desktop: only toggle data-sidenav-size (no modal effect).
  useEffect(() => {
    const html = document.documentElement;
    const isOffcanvas = html.getAttribute('data-sidenav-size') === 'offcanvas';
    if (isOffcanvas) {
      html.classList.toggle('sidebar-enable', sidebarOpen);
    } else {
      html.classList.remove('sidebar-enable');
      // Desktop: green button toggles between default (expanded) and condensed (collapsed icon-only)
      html.setAttribute('data-sidenav-size', sidebarOpen ? 'condensed' : 'default');
    }
  }, [sidebarOpen]);

  // Auto-lock after idle: when not locked and user has idleLockMinutes > 0, run a timer reset on activity
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (locked || !user || idleLockMinutes <= 0) return;
    const ms = idleLockMinutes * 60 * 1000;
    const scheduleLock = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setLocked(true);
        setLockedState(true);
      }, ms);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'] as const;
    scheduleLock();
    events.forEach((ev) => window.addEventListener(ev, scheduleLock));
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, scheduleLock));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    };
  }, [locked, user, idleLockMinutes]);

  if (locked && user) {
    return (
      <LockScreenView
        userName={user.name}
        userId={user.userId}
        onUnlock={() => setLockedState(false)}
        onSignOut={handleLogout}
      />
    );
  }

  return (
    <div className="wrapper">
      {/* Sidenav - Inspinia structure */}
      <div className="sidenav-menu">
        <Link to="/" className="logo">
          <span className="logo logo-light">
            <span className="logo-lg">
              <img src="/images/logo.png" alt="Synchronics" onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; (t.nextElementSibling as HTMLElement)?.classList.remove('d-none'); }} />
              <span className="d-none fw-bold align-middle">Synchronics</span>
            </span>
            <span className="logo-sm">
              <img src="/images/logo-sm.png" alt="S" onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; (t.nextElementSibling as HTMLElement)?.classList.remove('d-none'); }} />
              <span className="d-none fw-bold">S</span>
            </span>
          </span>
          <span className="logo logo-dark">
            <span className="logo-lg">
              <img src="/images/logo-black.png" alt="Synchronics" onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; (t.nextElementSibling as HTMLElement)?.classList.remove('d-none'); }} />
              <span className="d-none fw-bold align-middle">Synchronics</span>
            </span>
            <span className="logo-sm">
              <img src="/images/logo-sm.png" alt="S" onError={(e) => { const t = e.target as HTMLImageElement; t.style.display = 'none'; (t.nextElementSibling as HTMLElement)?.classList.remove('d-none'); }} />
              <span className="d-none fw-bold">S</span>
            </span>
          </span>
        </Link>

        <button type="button" className="button-close-offcanvas btn btn-link d-lg-none" onClick={closeSidebar} aria-label="Close menu">
          <i className="ti ti-x align-middle" />
        </button>

        <div className="scrollbar" data-simplebar ref={scrollbarRef}>
          <ul className="side-nav">
            {menuItems.map((item) => {
              if (item.children?.length) {
                const isExpanded = expandedKeys.has(item.key);
                const collapseId = `sidebar-${item.key}`;
                const showEmailBadge = item.key === 'emails' && emailUnreadCount > 0;
                return (
                  <li key={item.key} className="side-nav-item">
                    <a
                      href={`#${collapseId}`}
                      data-bs-toggle="collapse"
                      aria-expanded={isExpanded}
                      aria-controls={collapseId}
                      className="side-nav-link"
                      onClick={(e) => { e.preventDefault(); toggleExpanded(item.key); }}
                    >
                      <span className="menu-icon"><i className={getTablerIconClass(item.icon)} /></span>
                      <span className="menu-text">{item.label}</span>
                      {showEmailBadge && (
                        <span className="badge rounded-pill text-bg-danger ms-auto" style={{ fontSize: '0.7rem' }}>
                          {emailUnreadCount > 99 ? '99+' : emailUnreadCount}
                        </span>
                      )}
                      <span className="menu-arrow" />
                    </a>
                    <div className={`collapse ${isExpanded ? 'show' : ''}`} id={collapseId}>
                      <ul className="sub-menu">
                        {item.children.map((child) => (
                          <li key={child.key} className="side-nav-item">
                            {child.path && (
                              <Link
                                to={child.path}
                                className={`side-nav-link ${location.pathname === child.path ? 'active' : ''}`}
                              >
                                <span className="menu-icon"><i className={getTablerIconClass(child.icon)} /></span>
                                <span className="menu-text">{child.label}</span>
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                );
              }
              if (item.path) {
                const showChatBadge = item.key === 'chat' && totalUnreadCount > 0;
                return (
                  <li key={item.key} className="side-nav-item">
                    <Link
                      to={item.path}
                      className={`side-nav-link ${location.pathname === item.path ? 'active' : ''}`}
                    >
                      <span className="menu-icon"><i className={getTablerIconClass(item.icon)} /></span>
                      <span className="menu-text">{item.label}</span>
                      {showChatBadge && (
                        <span className="badge rounded-pill text-bg-danger ms-auto" style={{ fontSize: '0.7rem' }}>
                          {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              }
              return null;
            })}
          </ul>
        </div>
      </div>

      {/* Topbar - Inspinia structure */}
      <header className="app-topbar">
        <div className="container-fluid topbar-menu">
          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="sidenav-toggle-button btn btn-primary btn-icon"
              onClick={toggleSidebar}
              aria-label="Toggle sidebar"
            >
              <i className="ti ti-menu-4 fs-22" />
            </button>
            <h5 className="mb-0 d-none d-md-block">Synchronics ERP</h5>
          </div>
          <div className="d-flex align-items-center gap-1 gap-sm-2">
            {user && (
              <>
                {/* Notifications dropdown (health alerts) */}
                <div className="topbar-item dropdown">
                  <a
                    className="topbar-link dropdown-toggle drop-arrow-none px-2 position-relative d-flex align-items-center justify-content-center"
                    href="#!"
                    data-bs-toggle="dropdown"
                    data-bs-offset="0,12"
                    aria-expanded="false"
                    aria-label={healthAlerts?.activeCount ? `${healthAlerts.activeCount} health alerts` : 'Notifications'}
                    onClick={(e) => e.preventDefault()}
                    style={{ width: 40, height: 40 }}
                    title="Health Alerts"
                  >
                    <i className={`ti fs-20 ${healthAlerts?.activeCount ? 'ti-bell-filled text-danger' : 'ti-bell'}`} />
                    {healthAlerts && healthAlerts.activeCount > 0 && (
                      <span className="topbar-badge badge rounded-pill bg-danger border border-2 border-body">
                        {healthAlerts.activeCount > 99 ? '99+' : healthAlerts.activeCount}
                      </span>
                    )}
                  </a>
                  <div className="dropdown-menu dropdown-menu-end py-0" style={{ minWidth: 320, maxWidth: 360 }}>
                    <div className="dropdown-header noti-title d-flex align-items-center justify-content-between">
                      <h6 className="mb-0 d-flex align-items-center gap-2">
                        <span className="rounded-2 bg-danger bg-opacity-15 d-inline-flex align-items-center justify-content-center" style={{ width: 28, height: 28 }}>
                          <i className="ti ti-alert-triangle text-danger fs-16" />
                        </span>
                        Health Alerts
                      </h6>
                      {healthAlerts && healthAlerts.activeCount > 0 && (
                        <span className="badge bg-danger rounded-pill">{healthAlerts.activeCount}</span>
                      )}
                    </div>
                    <div className="dropdown-divider mb-0" />
                    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                      {!healthAlerts ? (
                        <div className="p-3 text-center text-muted small">Loading...</div>
                      ) : healthAlerts.alerts.length === 0 ? (
                        <div className="p-3 text-center text-muted small">No alerts.</div>
                      ) : (
                        healthAlerts.alerts.map((a) => {
                          const { icon, bg, iconColor } = getHealthAlertIcon(a.metric, a.status);
                          return (
                            <div
                              key={a.id}
                              className={`dropdown-item py-2 px-3 text-body border-0 d-flex align-items-start gap-2 ${a.status === 'acknowledged' ? 'opacity-75' : ''}`}
                            >
                              <div className={`rounded-2 d-flex align-items-center justify-content-center flex-shrink-0 ${bg}`} style={{ width: 36, height: 36 }}>
                                <i className={`ti ${icon} fs-18 ${iconColor}`} />
                              </div>
                              <div className="min-w-0 flex-grow-1">
                                <div className="small text-muted mb-0">{formatDropdownTime(a.createdAt)}</div>
                                <div className="small fw-medium">{a.message}</div>
                                {a.status === 'acknowledged' && (
                                  <span className="badge bg-secondary rounded-pill mt-1" style={{ fontSize: 10 }}>Acknowledged</span>
                                )}
                              </div>
                              {a.status === 'active' && (
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary flex-shrink-0"
                                  onClick={async () => {
                                    await healthAlerts.acknowledge(a.id);
                                  }}
                                >
                                  Ack
                                </button>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                    {healthAlerts && healthAlerts.activeCount > 0 && (
                      <>
                        <div className="dropdown-divider mb-0" />
                        <div className="p-2 border-top">
                          <button
                            type="button"
                            className="btn btn-sm btn-link text-primary w-100 text-decoration-none"
                            onClick={async () => { await healthAlerts.acknowledgeAll(); }}
                          >
                            Acknowledge all
                          </button>
                          <Link
                            to="/health"
                            className="btn btn-sm btn-primary w-100 mt-1"
                            onClick={() => {
                              const bs = window.bootstrap;
                              if (bs) {
                                const dd = document.querySelector('.topbar-item.dropdown .dropdown-menu.show');
                                if (dd) {
                                  const toggle = dd.previousElementSibling;
                                  if (toggle) bs.Dropdown.getOrCreateInstance(toggle).hide();
                                }
                              }
                            }}
                          >
                            View Health
                          </Link>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Theme toggle (day / night mode) */}
                <button
                  type="button"
                  className="topbar-link btn btn-link px-2 d-flex align-items-center justify-content-center"
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  style={{ width: 40, height: 40 }}
                  title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                >
                  {theme === 'dark' ? <i className="ti ti-sun fs-20" /> : <i className="ti ti-moon fs-20" />}
                </button>

                {/* Email - link to inbox with unread badge */}
                <div className="topbar-item">
                  <Link
                    to="/emails"
                    className="topbar-link px-2 position-relative d-flex align-items-center justify-content-center text-decoration-none"
                    style={{ width: 40, height: 40 }}
                    title={emailUnreadCount > 0 ? `${emailUnreadCount} unread emails` : 'Emails'}
                    aria-label={emailUnreadCount > 0 ? `${emailUnreadCount} unread emails` : 'Emails'}
                  >
                    <i className="ti ti-mail fs-20" />
                    {emailUnreadCount > 0 && (
                      <span className="topbar-badge badge rounded-pill bg-danger border border-2 border-body">
                        {emailUnreadCount > 99 ? '99+' : emailUnreadCount}
                      </span>
                    )}
                  </Link>
                </div>

                {/* Chat: Inspinia-style dropdown with messages + Mark all as read */}
                <div className="topbar-item dropdown" ref={chatDropdownRef}>
                  <a
                    className="topbar-link dropdown-toggle drop-arrow-none px-2 position-relative d-flex align-items-center justify-content-center"
                    href="#!"
                    data-bs-toggle="dropdown"
                    data-bs-offset="0,12"
                    aria-expanded="false"
                    aria-label={totalUnreadCount > 0 ? `${totalUnreadCount} unread messages` : 'Chat'}
                    onClick={(e) => e.preventDefault()}
                    style={{ width: 40, height: 40 }}
                    title="Messages"
                  >
                    <i className="ti ti-message-circle fs-20" />
                    {totalUnreadCount > 0 && (
                      <span className="topbar-badge badge rounded-pill bg-danger border border-2 border-body">
                        {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                      </span>
                    )}
                  </a>
                  <div className="dropdown-menu dropdown-menu-end py-0" style={{ minWidth: 320, maxWidth: 360 }}>
                    <div className="dropdown-header noti-title d-flex align-items-center justify-content-between">
                      <h6 className="mb-0">Messages</h6>
                      {totalUnreadCount > 0 && (
                        <span className="badge bg-danger rounded-pill">{totalUnreadCount}</span>
                      )}
                    </div>
                    <div className="dropdown-divider mb-0" />
                    <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                      {chatDropdownLoading ? (
                        <div className="p-3 text-center text-muted small">Loading...</div>
                      ) : chatConversations.length === 0 ? (
                        <div className="p-3 text-center text-muted small">No conversations yet.</div>
                      ) : (
                        chatConversations.map((c) => (
                          <Link
                            key={c.userId}
                            to={`/chat?with=${c.userId}`}
                            className="dropdown-item py-2 px-3 text-decoration-none text-body d-flex align-items-start gap-2 border-0"
                            onClick={() => {
                              const bs = window.bootstrap;
                              if (bs && chatDropdownRef.current) {
                                const toggle = chatDropdownRef.current.querySelector('[data-bs-toggle="dropdown"]');
                                if (toggle) bs.Dropdown.getOrCreateInstance(toggle).hide();
                              }
                            }}
                          >
                            <img
                              src={`/user-photos/${c.userId}.jpg`}
                              alt=""
                              width={36}
                              height={36}
                              className="rounded-circle flex-shrink-0"
                              style={{ objectFit: 'cover' }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><circle fill="%236c757d" cx="18" cy="18" r="18"/><text x="18" y="22" text-anchor="middle" fill="white" font-size="14">?</text></svg>';
                              }}
                            />
                            <div className="min-w-0 flex-grow-1">
                              <div className="d-flex align-items-center justify-content-between gap-1">
                                <span className="fw-semibold text-truncate">{c.name}</span>
                                <span className="text-muted small flex-shrink-0">{formatDropdownTime(c.lastMessageAt)}</span>
                              </div>
                              <div className="text-muted small text-truncate">
                                {c.lastMessagePreview || 'No messages yet'}
                              </div>
                              {c.unreadCount != null && c.unreadCount > 0 && (
                                <span className="badge bg-danger rounded-pill mt-1" style={{ fontSize: 10 }}>{c.unreadCount}</span>
                              )}
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                    <div className="dropdown-divider mb-0" />
                    <div className="p-2 border-top">
                      <button
                        type="button"
                        className="btn btn-sm btn-link text-primary w-100 text-decoration-none"
                        onClick={async () => {
                          const withUnread = chatConversations.filter((c) => (c.unreadCount ?? 0) > 0);
                          for (const c of withUnread) {
                            try {
                              await api.post('/api/chat/mark-read', { withUserId: c.userId });
                            } catch (_) {}
                          }
                          refetchUnread();
                          setChatConversations((prev) => prev.map((p) => ({ ...p, unreadCount: 0 })));
                          const bs = window.bootstrap;
                          if (bs && chatDropdownRef.current) {
                            const toggle = chatDropdownRef.current.querySelector('[data-bs-toggle="dropdown"]');
                            if (toggle) bs.Dropdown.getOrCreateInstance(toggle).hide();
                          }
                        }}
                        disabled={totalUnreadCount === 0 || chatDropdownLoading}
                      >
                        Mark all as read
                      </button>
                      <Link
                        to="/chat"
                        className="btn btn-sm btn-primary w-100 mt-1"
                        onClick={() => {
                          const bs = window.bootstrap;
                          if (bs && chatDropdownRef.current) {
                            const toggle = chatDropdownRef.current.querySelector('[data-bs-toggle="dropdown"]');
                            if (toggle) bs.Dropdown.getOrCreateInstance(toggle).hide();
                          }
                        }}
                      >
                        Open Chat
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="topbar-item nav-user">
                <div className="dropdown">
                  <a
                    className="topbar-link dropdown-toggle drop-arrow-none px-2 d-flex align-items-center gap-2"
                    href="#!"
                    data-bs-toggle="dropdown"
                    data-bs-offset="0,16"
                    aria-expanded="false"
                    onClick={(e) => e.preventDefault()}
                  >
                    <Avatar userId={user.userId} name={user.name} />
                    <div className="d-none d-lg-flex align-items-center gap-1">
                      <span className="fw-medium">{user.name}</span>
                      <i className="ti ti-chevron-down align-middle" />
                    </div>
                  </a>
                  <div className="dropdown-menu dropdown-menu-end">
                    <div className="dropdown-header noti-title">
                      <h6 className="text-overflow m-0">{user.name}</h6>
                    </div>
                    <div className="dropdown-divider" />
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => setShowPreferencesModal(true)}
                    >
                      <i className="ti ti-settings me-2 fs-17 align-middle" />
                      <span className="align-middle">Preferences</span>
                    </button>
                    <button
                      type="button"
                      className="dropdown-item"
                      onClick={() => {
                        setLocked(true);
                        setLockedState(true);
                      }}
                    >
                      <i className="ti ti-lock me-2 fs-17 align-middle" />
                      <span className="align-middle">Lock Screen</span>
                    </button>
                    <button type="button" className="dropdown-item text-danger fw-semibold" onClick={handleLogout}>
                      <i className="ti ti-logout-2 me-2 fs-17 align-middle" />
                      <span className="align-middle">Log out</span>
                    </button>
                  </div>
                </div>
              </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="content-page">
        <Outlet />
        <footer className="footer">
          <div className="container-fluid">
            <div className="row align-items-center">
              <div className="col text-start text-muted small">
                © {new Date().getFullYear()} Synchronics ERP
              </div>
              <div className="col-auto text-end text-muted small">
                <FooterActivity />
              </div>
            </div>
          </div>
        </footer>
      </div>

      {/* Backdrop only in offcanvas (mobile) so desktop green button doesn’t add a modal overlay */}
      {sidebarOpen && typeof document !== 'undefined' && document.documentElement.getAttribute('data-sidenav-size') === 'offcanvas' && (
        <div
          className="offcanvas-backdrop fade show"
          style={{ position: 'fixed', inset: 0, zIndex: 1004, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onClick={closeSidebar}
          onKeyDown={(e) => e.key === 'Escape' && closeSidebar()}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
        />
      )}

      <IdleLockPreferencesModal show={showPreferencesModal} onClose={() => setShowPreferencesModal(false)} />
    </div>
  );
}
