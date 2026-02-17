/**
 * User-level dashboard – Inspinia style
 * Welcome message, module cards, quick links.
 */

import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();

  useEffect(() => {
    document.title = 'Dashboard | Synchronics ERP';
    return () => { document.title = 'Synchronics ERP'; };
  }, []);

  const firstName = user?.name?.split(/\s+/)[0] || 'User';

  return (
    <div className="container-fluid py-4">
      <div className="row mb-4">
        <div className="col-12">
          <h1 className="h3 mb-1">Welcome, {firstName}</h1>
          <p className="text-muted mb-0">Here is what is happening with your modules today.</p>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <Link to="/emails" className="text-decoration-none">
            <div className="card border-0 shadow-sm h-100 hover-lift">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="rounded-circle bg-primary bg-opacity-10 p-3 me-3">
                    <i className="ti ti-mail text-primary fs-4" />
                  </div>
                  <div>
                    <h6 className="text-muted small mb-1">Emails</h6>
                    <h4 className="mb-0">Inbox</h4>
                    <span className="small text-muted">View messages</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-md-3">
          <Link to="/assets/dashboard" className="text-decoration-none">
            <div className="card border-0 shadow-sm h-100 hover-lift">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="rounded-circle bg-success bg-opacity-10 p-3 me-3">
                    <i className="ti ti-box-seam text-success fs-4" />
                  </div>
                  <div>
                    <h6 className="text-muted small mb-1">Assets</h6>
                    <h4 className="mb-0">Assets</h4>
                    <span className="small text-muted">View dashboard</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
        <div className="col-md-3">
          <Link to="/calendar" className="text-decoration-none">
            <div className="card border-0 shadow-sm h-100 hover-lift">
              <div className="card-body">
                <div className="d-flex align-items-center">
                  <div className="rounded-circle bg-info bg-opacity-10 p-3 me-3">
                    <i className="ti ti-calendar text-info fs-4" />
                  </div>
                  <div>
                    <h6 className="text-muted small mb-1">Calendar</h6>
                    <h4 className="mb-0">Events</h4>
                    <span className="small text-muted">View calendar</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-6">
          <div className="card border-0 shadow-sm">
            <div className="card-header bg-transparent border-0">
              <h5 className="mb-0">Quick Links</h5>
            </div>
            <div className="card-body">
              <div className="list-group list-group-flush">
                <Link to="/assets" className="list-group-item list-group-item-action border-0 px-0">
                  <i className="ti ti-box-seam me-2 text-muted" /> Assets
                </Link>
                <Link to="/assets/tickets" className="list-group-item list-group-item-action border-0 px-0">
                  <i className="ti ti-ticket me-2 text-muted" /> Tickets
                </Link>
                <Link to="/jobcard" className="list-group-item list-group-item-action border-0 px-0">
                  <i className="ti ti-clipboard-check me-2 text-muted" /> Job Cards
                </Link>
                <Link to="/worklogs" className="list-group-item list-group-item-action border-0 px-0">
                  <i className="ti ti-journal-text me-2 text-muted" /> Work Logs
                </Link>
                <Link to="/accounts" className="list-group-item list-group-item-action border-0 px-0">
                  <i className="ti ti-wallet me-2 text-muted" /> Accounts
                </Link>
                <Link to="/emails" className="list-group-item list-group-item-action border-0 px-0">
                  <i className="ti ti-mail me-2 text-muted" /> Emails
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .hover-lift:hover { transform: translateY(-2px); transition: transform 0.2s; }
      `}</style>
    </div>
  );
}
