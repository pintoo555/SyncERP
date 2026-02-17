/**
 * Client 360 view page with tabs: Overview, Contacts, Addresses, Relationships, Groups, Aliases.
 * Inspinia-style layout with cards, badges, and clean typography.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, Link } from 'react-router-dom';
import * as clientsApi from '../api/clientsApi';
import type { Client360Data, Client, Relationship, ContactRemark } from '../types';
import { BEHAVIOR_TAG_OPTIONS } from '../types';
import MergeClientModal from '../components/MergeClientModal';
import LinkRelationshipModal from '../components/LinkRelationshipModal';
import { formatIndianNumber } from '../../../utils/formatIndian';

type Tab = 'overview' | 'contacts' | 'addresses' | 'relationships' | 'groups' | 'aliases';

const TAB_CONFIG: { key: Tab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'ti-layout-dashboard' },
  { key: 'contacts', label: 'Contacts', icon: 'ti-address-book' },
  { key: 'addresses', label: 'Addresses', icon: 'ti-map-pin' },
  { key: 'relationships', label: 'Relationships', icon: 'ti-link' },
  { key: 'groups', label: 'Groups', icon: 'ti-users-group' },
  { key: 'aliases', label: 'Aliases', icon: 'ti-history' },
];

const AVATAR_COLORS = ['#3b7ddd', '#6f42c1', '#e83e8c', '#fd7e14', '#20c997', '#0dcaf0', '#6610f2', '#d63384'];

const ROLE_COLORS: Record<string, string> = {
  Commercial: '#3b7ddd', Technical: '#6f42c1', Dispatch: '#fd7e14',
  Accounting: '#20c997', Purchase: '#e83e8c', Sales: '#0dcaf0',
  Management: '#6610f2', Legal: '#dc3545', Quality: '#198754',
  HR: '#d63384', IT: '#0d6efd', Operations: '#ffc107',
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0]?.[0] || '?').toUpperCase();
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function ClientViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const clientId = Number(id);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Client360Data | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [includeMerged, setIncludeMerged] = useState(false);
  const [includeGroup, setIncludeGroup] = useState(false);
  const [aliases, setAliases] = useState<Relationship[]>([]);

  const [showMerge, setShowMerge] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [allClients, setAllClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);

  // Call confirmation modal
  const [callModal, setCallModal] = useState<{ name: string; number: string } | null>(null);
  const [callCopied, setCallCopied] = useState(false);

  // Contact detail / remarks modal state
  const [detailContact, setDetailContact] = useState<any>(null);
  const [viewRemarks, setViewRemarks] = useState<ContactRemark[]>([]);
  const [viewRemarksLoading, setViewRemarksLoading] = useState(false);
  const [viewNewRemark, setViewNewRemark] = useState('');
  const [viewNewRemarkTags, setViewNewRemarkTags] = useState<Set<string>>(new Set());
  const [viewNewRemarkFlagged, setViewNewRemarkFlagged] = useState(false);
  const [viewRemarkSaving, setViewRemarkSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    clientsApi.get360ByClient(clientId, { includeMerged, includeGroup })
      .then(res => setData(res.data))
      .catch(e => setError(e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [clientId, includeMerged, includeGroup]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    clientsApi.getAliases(clientId).then(res => setAliases(res.data || [])).catch(() => {});
  }, [clientId]);

  const loadAllClients = () => {
    if (allClients.length > 0) return;
    clientsApi.listClients({ pageSize: 200, isActive: 1 }).then(res => setAllClients(res.data || [])).catch(() => {});
  };

  const handleMerge = async (targetClientId: number, remarks: string) => {
    try { setSaving(true); await clientsApi.mergeClient(clientId, { targetClientId, remarks }); setShowMerge(false); load(); }
    catch (e: any) { setError(e?.message ?? 'Merge failed'); }
    finally { setSaving(false); }
  };

  const handleLink = async (otherClientId: number, relationshipType: string, effectiveFrom: string, remarks: string) => {
    try { setSaving(true); await clientsApi.linkClient(clientId, { otherClientId, relationshipType, effectiveFrom, remarks }); setShowLink(false); load(); clientsApi.getAliases(clientId).then(res => setAliases(res.data || [])).catch(() => {}); }
    catch (e: any) { setError(e?.message ?? 'Link failed'); }
    finally { setSaving(false); }
  };

  /* ─── Contact Detail / Remarks Handlers ─── */
  const openViewContactDetail = async (ct: any) => {
    setDetailContact(ct);
    setViewRemarksLoading(true);
    setViewNewRemark('');
    setViewNewRemarkTags(new Set());
    setViewNewRemarkFlagged(false);
    try {
      const res = await clientsApi.listContactRemarks(clientId, ct.id);
      setViewRemarks(res.data || []);
    } catch { setViewRemarks([]); }
    finally { setViewRemarksLoading(false); }
  };

  const closeViewContactDetail = () => {
    setDetailContact(null);
    setViewRemarks([]);
    setViewNewRemark('');
    setViewNewRemarkTags(new Set());
    setViewNewRemarkFlagged(false);
  };

  const handleViewAddRemark = async () => {
    if (!detailContact || !viewNewRemark.trim()) return;
    setViewRemarkSaving(true);
    try {
      await clientsApi.createContactRemark(clientId, detailContact.id, {
        remarkText: viewNewRemark.trim(),
        behaviorTags: viewNewRemarkTags.size > 0 ? Array.from(viewNewRemarkTags).join(',') : undefined,
        isFlagged: viewNewRemarkFlagged,
      });
      const res = await clientsApi.listContactRemarks(clientId, detailContact.id);
      setViewRemarks(res.data || []);
      setViewNewRemark('');
      setViewNewRemarkTags(new Set());
      setViewNewRemarkFlagged(false);
    } catch { /* error handling already in API */ }
    finally { setViewRemarkSaving(false); }
  };

  const handleViewDeleteRemark = async (remarkId: number) => {
    if (!detailContact) return;
    try {
      await clientsApi.deleteContactRemark(clientId, detailContact.id, remarkId);
      setViewRemarks(prev => prev.filter(r => r.id !== remarkId));
    } catch { /* ignore */ }
  };

  const toggleViewBehaviorTag = (tag: string) => {
    setViewNewRemarkTags(prev => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag); else next.add(tag);
      return next;
    });
  };

  /* ─── Call Confirmation ─── */
  const stripToDigits = (phone: string): string => {
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.startsWith('91') && digits.length > 10) return digits.slice(digits.length - 10);
    if (digits.length > 10) return digits.slice(digits.length - 10);
    return digits;
  };

  const openCallModal = (name: string, number: string) => {
    setCallCopied(false);
    setCallModal({ name, number });
  };

  const confirmCall = async () => {
    if (!callModal) return;
    const plain = stripToDigits(callModal.number);
    const dialStr = `dial:0${plain}`;
    try {
      await navigator.clipboard.writeText(dialStr);
      setCallCopied(true);
      setTimeout(() => { setCallModal(null); setCallCopied(false); }, 1500);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = dialStr;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCallCopied(true);
      setTimeout(() => { setCallModal(null); setCallCopied(false); }, 1500);
    }
  };

  if (loading) {
    return (
      <div className="container-fluid py-5 text-center text-muted">
        <div className="spinner-border spinner-border-sm me-2" /> Loading client details...
      </div>
    );
  }
  if (!data) {
    return (
      <div className="container-fluid py-5 text-center text-muted">
        <i className="ti ti-alert-circle me-2" />Client not found.
      </div>
    );
  }

  const c = data.client;

  return (
    <div className="container-fluid py-4">
      {/* Page Header */}
      <div className="d-flex flex-wrap align-items-start justify-content-between gap-3 mb-4">
        <div className="d-flex align-items-start">
          <button className="btn btn-outline-secondary btn-sm me-3 mt-1" onClick={() => navigate('/clients')}>
            <i className="ti ti-arrow-left me-1" /> Back
          </button>
          <div>
            <h4 className="mb-1 fw-bold">
              <i className="ti ti-building me-2 text-primary" />
              {c.clientDisplayName || c.clientName}
              <code className="ms-2 small text-muted fw-normal">{c.clientCode}</code>
            </h4>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <span className="badge bg-primary bg-opacity-10 text-primary">{c.clientType}</span>
              {c.industryName && <span className="badge bg-light text-dark border">{c.industryName}</span>}
              {c.isActive
                ? <span className="badge bg-success bg-opacity-10 text-success">Active</span>
                : <span className="badge bg-secondary bg-opacity-10 text-secondary">Inactive</span>}
              {c.isBlacklisted && <span className="badge bg-danger bg-opacity-10 text-danger">Blacklisted</span>}
              {c.isMerged && <span className="badge bg-warning bg-opacity-10 text-warning">Merged</span>}
              {c.gstVerified && <span className="badge bg-success"><i className="ti ti-shield-check me-1" />GST Verified</span>}
            </div>
          </div>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link to={`/clients/${c.id}/edit`} className="btn btn-outline-primary btn-sm">
            <i className="ti ti-pencil me-1" /> Edit
          </Link>
          <button className="btn btn-outline-warning btn-sm" onClick={() => { loadAllClients(); setShowMerge(true); }} disabled={c.isMerged}>
            <i className="ti ti-git-merge me-1" /> Merge
          </button>
          <button className="btn btn-outline-info btn-sm" onClick={() => { loadAllClients(); setShowLink(true); }}>
            <i className="ti ti-link me-1" /> Link
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          <i className="ti ti-alert-circle me-2" />{error}
          <button className="btn-close" onClick={() => setError(null)} />
        </div>
      )}

      {c.isMerged && (
        <div className="alert alert-warning d-flex align-items-center">
          <i className="ti ti-git-merge me-2 fs-5" />
          <div>This client has been merged into <Link to={`/clients/${c.mergedIntoClientId}`} className="fw-semibold">{c.mergedIntoClientName}</Link>.</div>
        </div>
      )}

      {/* 360 Toggle Options */}
      <div className="d-flex gap-3 mb-3">
        <div className="form-check form-switch">
          <input className="form-check-input" type="checkbox" checked={includeMerged} onChange={e => setIncludeMerged(e.target.checked)} id="incMerged" />
          <label className="form-check-label small" htmlFor="incMerged">Include Merged Clients</label>
        </div>
        <div className="form-check form-switch">
          <input className="form-check-input" type="checkbox" checked={includeGroup} onChange={e => setIncludeGroup(e.target.checked)} id="incGroup" />
          <label className="form-check-label small" htmlFor="incGroup">Include Group Members</label>
        </div>
      </div>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-4">
        {TAB_CONFIG.map(t => (
          <li className="nav-item" key={t.key}>
            <button className={`nav-link ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              <i className={`ti ${t.icon} me-1`} />
              {t.label}
              {t.key === 'contacts' && <span className="badge bg-primary bg-opacity-10 text-primary ms-1">{data.contacts.length}</span>}
              {t.key === 'addresses' && <span className="badge bg-primary bg-opacity-10 text-primary ms-1">{data.addresses.length}</span>}
              {t.key === 'relationships' && <span className="badge bg-primary bg-opacity-10 text-primary ms-1">{data.relationships.length}</span>}
              {t.key === 'groups' && <span className="badge bg-primary bg-opacity-10 text-primary ms-1">{data.groupMemberships.length}</span>}
              {t.key === 'aliases' && <span className="badge bg-primary bg-opacity-10 text-primary ms-1">{aliases.length}</span>}
            </button>
          </li>
        ))}
      </ul>

      {/* ── Overview Tab ── */}
      {tab === 'overview' && (
        <div className="row g-4">
          {/* Details Card */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-transparent border-bottom py-3">
                <h5 className="mb-0 fw-semibold"><i className="ti ti-id me-2 text-primary" />Client Details</h5>
              </div>
              <div className="card-body p-0">
                <table className="table table-sm mb-0">
                  <tbody>
                    <tr><td className="text-muted ps-3" style={{ width: '40%' }}>Client Name</td><td className="fw-semibold">{c.clientName}</td></tr>
                    {c.clientDisplayName && <tr><td className="text-muted ps-3">Display Name</td><td>{c.clientDisplayName}</td></tr>}
                    <tr><td className="text-muted ps-3">Type</td><td><span className="badge bg-primary bg-opacity-10 text-primary">{c.clientType}</span></td></tr>
                    <tr><td className="text-muted ps-3">Industry</td><td>{c.industryName || <span className="text-muted">—</span>}</td></tr>
                    <tr>
                      <td className="text-muted ps-3">Status</td>
                      <td>
                        {c.isActive ? <span className="badge bg-success bg-opacity-10 text-success">Active</span> : <span className="badge bg-secondary bg-opacity-10 text-secondary">Inactive</span>}
                        {c.isBlacklisted && <span className="badge bg-danger bg-opacity-10 text-danger ms-1">Blacklisted</span>}
                      </td>
                    </tr>
                    <tr><td className="text-muted ps-3">Created</td><td className="small">{c.createdOn ? new Date(c.createdOn).toLocaleDateString('en-IN') : '—'}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Compliance & Financial Card */}
          <div className="col-lg-6">
            <div className="card border-0 shadow-sm h-100">
              <div className="card-header bg-transparent border-bottom py-3">
                <h5 className="mb-0 fw-semibold"><i className="ti ti-certificate me-2 text-primary" />Compliance & Financial</h5>
              </div>
              <div className="card-body p-0">
                <table className="table table-sm mb-0">
                  <tbody>
                    <tr><td className="text-muted ps-3" style={{ width: '40%' }}>GST Number</td><td className="fw-semibold">{c.gstNumber || <span className="text-muted fw-normal">—</span>}</td></tr>
                    <tr><td className="text-muted ps-3">PAN Number</td><td>{c.panNumber || <span className="text-muted">—</span>}</td></tr>
                    <tr><td className="text-muted ps-3">IEC Code</td><td>{c.iecCode || <span className="text-muted">—</span>}</td></tr>
                    <tr><td className="text-muted ps-3">MSME Number</td><td>{c.msmeNumber || <span className="text-muted">—</span>}</td></tr>
                    <tr><td className="text-muted ps-3">Currency</td><td>{c.currencyCode}</td></tr>
                    <tr><td className="text-muted ps-3">Credit Limit</td><td className="fw-bold text-success">{formatIndianNumber(c.creditLimit)}</td></tr>
                    <tr><td className="text-muted ps-3">Credit Days</td><td>{c.creditDays}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Quick Stats Row */}
          <div className="col-12">
            <div className="row g-3">
              <div className="col-md-3">
                <div className="card border-0 shadow-sm text-center py-3">
                  <div className="fs-4 fw-bold text-primary">{data.contacts.filter(ct => ct.isActive).length}</div>
                  <div className="text-muted small">Active Contacts</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-0 shadow-sm text-center py-3">
                  <div className="fs-4 fw-bold text-primary">{data.addresses.filter(a => a.isActive).length}</div>
                  <div className="text-muted small">Active Addresses</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-0 shadow-sm text-center py-3">
                  <div className="fs-4 fw-bold text-primary">{data.relationships.length}</div>
                  <div className="text-muted small">Relationships</div>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card border-0 shadow-sm text-center py-3">
                  <div className="fs-4 fw-bold text-primary">{data.groupMemberships.length}</div>
                  <div className="text-muted small">Group Memberships</div>
                </div>
              </div>
            </div>
          </div>

          {/* Merged From Clients */}
          {data.mergedFromClients.length > 0 && (
            <div className="col-12">
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-transparent border-bottom py-3">
                  <h5 className="mb-0 fw-semibold"><i className="ti ti-git-merge me-2 text-warning" />Merged From Clients</h5>
                </div>
                <div className="card-body p-0">
                  <div className="table-responsive">
                    <table className="table table-hover table-sm align-middle mb-0">
                      <thead className="table-light"><tr><th>Code</th><th>Name</th><th>Type</th></tr></thead>
                      <tbody>
                        {data.mergedFromClients.map(mc => (
                          <tr key={mc.id}>
                            <td><code className="small">{mc.clientCode}</code></td>
                            <td><Link to={`/clients/${mc.id}`} className="fw-semibold text-body text-decoration-none">{mc.clientName}</Link></td>
                            <td><span className="badge bg-primary bg-opacity-10 text-primary">{mc.clientType}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Contacts Tab ── */}
      {tab === 'contacts' && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-transparent border-bottom py-3 d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-semibold"><i className="ti ti-address-book me-2 text-primary" />Contacts</h5>
            <Link to={`/clients/${c.id}/edit`} className="btn btn-sm btn-outline-primary">
              <i className="ti ti-pencil me-1" />Manage Contacts
            </Link>
          </div>
          <div className="card-body">
            {data.contacts.length === 0 && (
              <div className="text-center text-muted py-4">
                <i className="ti ti-user-off fs-3 d-block mb-2" />
                <span className="small">No contacts.</span>
              </div>
            )}
            {data.contacts.map(ct => {
              const roles = ((ct as any).contactRoles || '').split(',').filter(Boolean);
              return (
                <div key={ct.id} className={`card border mb-2 ${!ct.isActive ? 'opacity-50' : ''}`}>
                  <div className="card-body py-2 px-3">
                    <div className="d-flex align-items-start justify-content-between">
                      <div className="d-flex align-items-start gap-3 flex-grow-1">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                          style={{
                            width: 40, height: 40, backgroundColor: getAvatarColor(ct.contactName),
                            color: '#fff', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.5px',
                            cursor: 'pointer',
                          }}
                          onClick={() => openViewContactDetail(ct)}
                          title="View details & remarks"
                        >
                          {getInitials(ct.contactName)}
                        </div>
                        <div className="flex-grow-1">
                          <div className="d-flex align-items-center gap-2 mb-1">
                            <span className="fw-semibold small" role="button" onClick={() => openViewContactDetail(ct)}
                              style={{ cursor: 'pointer' }} title="View details & remarks">
                              {ct.contactName}
                            </span>
                            {ct.isPrimary && <span className="badge bg-warning bg-opacity-25 text-dark" style={{ fontSize: '0.6rem' }}><i className="ti ti-star-filled me-1" />Primary</span>}
                            {!ct.isActive && <span className="badge bg-secondary bg-opacity-10 text-secondary">Inactive</span>}
                          </div>
                          {roles.length > 0 && (
                            <div className="d-flex flex-wrap gap-1 mb-1">
                              {roles.map((role: string) => (
                                <span key={role} className="badge rounded-pill" style={{
                                  backgroundColor: (ROLE_COLORS[role] || '#6c757d') + '20',
                                  color: ROLE_COLORS[role] || '#6c757d',
                                  fontSize: '0.65rem', fontWeight: 600,
                                  border: `1px solid ${(ROLE_COLORS[role] || '#6c757d')}40`,
                                }}>
                                  {role}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="small text-muted">
                            {ct.designation && <span>{ct.designation}</span>}
                            {ct.designation && ct.department && <span className="mx-1">|</span>}
                            {ct.department && <span>{ct.department}</span>}
                          </div>
                          <div className="d-flex flex-wrap gap-3 small mt-1">
                            {ct.mobileNumber && (
                              <span role="button" className="text-primary" style={{ cursor: 'pointer' }}
                                onClick={() => openCallModal(ct.contactName, ct.mobileNumber!)}
                                title="Click to dial">
                                <i className="ti ti-phone me-1" />{ct.mobileNumber}
                              </span>
                            )}
                            {ct.email && <span><i className="ti ti-mail me-1 text-muted" />{ct.email}</span>}
                            {ct.whatsAppNumber && (
                              <span role="button" className="text-success" style={{ cursor: 'pointer' }}
                                onClick={() => openCallModal(ct.contactName, ct.whatsAppNumber!)}
                                title="Click to dial">
                                <i className="ti ti-brand-whatsapp me-1" />{ct.whatsAppNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button className="btn btn-sm btn-outline-secondary py-0 px-2" onClick={() => openViewContactDetail(ct)} title="Remarks & Details">
                        <i className="ti ti-message-dots" style={{ fontSize: '0.8rem' }} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Addresses Tab ── */}
      {tab === 'addresses' && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-transparent border-bottom py-3 d-flex justify-content-between align-items-center">
            <h5 className="mb-0 fw-semibold"><i className="ti ti-map-pin me-2 text-primary" />Addresses</h5>
            <Link to={`/clients/${c.id}/edit`} className="btn btn-sm btn-outline-primary">
              <i className="ti ti-pencil me-1" />Manage Addresses
            </Link>
          </div>
          <div className="card-body">
            {data.addresses.length === 0 && (
              <div className="text-center text-muted py-4">
                <i className="ti ti-map-pin-off fs-3 d-block mb-2" />
                <span className="small">No addresses.</span>
              </div>
            )}
            <div className="row g-3">
              {data.addresses.map(a => (
                <div key={a.id} className="col-md-6 col-lg-4">
                  <div className={`card border h-100 ${!a.isActive ? 'opacity-50' : ''}`}>
                    <div className="card-body">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <span className="badge bg-primary bg-opacity-10 text-primary">{a.addressType}</span>
                        <div>
                          {a.isDefault && <span className="badge bg-success bg-opacity-10 text-success"><i className="ti ti-check me-1" />Default</span>}
                          {!a.isActive && <span className="badge bg-secondary bg-opacity-10 text-secondary ms-1">Inactive</span>}
                        </div>
                      </div>
                      <p className="mb-1 small fw-semibold">{a.addressLine1}</p>
                      {a.addressLine2 && <p className="mb-1 small text-muted">{a.addressLine2}</p>}
                      <p className="mb-0 small text-muted">
                        {[a.city, a.stateName, a.countryName].filter(Boolean).join(', ')}
                        {a.pincode && <span className="fw-semibold"> — {a.pincode}</span>}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Relationships Tab ── */}
      {tab === 'relationships' && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-transparent border-bottom py-3">
            <h5 className="mb-0 fw-semibold"><i className="ti ti-link me-2 text-primary" />Relationships</h5>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light"><tr><th>From</th><th>Type</th><th>To</th><th>Effective Date</th><th>Remarks</th></tr></thead>
                <tbody>
                  {data.relationships.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4"><i className="ti ti-link-off fs-3 d-block mb-2" /><span className="small">No relationships.</span></td></tr>}
                  {data.relationships.map(r => (
                    <tr key={r.id}>
                      <td><Link to={`/clients/${r.parentClientId}`} className="fw-semibold text-body text-decoration-none">{r.parentClientName}</Link></td>
                      <td><span className="badge bg-info bg-opacity-10 text-info">{r.relationshipType}</span></td>
                      <td><Link to={`/clients/${r.childClientId}`} className="fw-semibold text-body text-decoration-none">{r.childClientName}</Link></td>
                      <td className="small">{r.effectiveFrom?.slice(0, 10)}{r.effectiveTo ? ` → ${r.effectiveTo.slice(0, 10)}` : ''}</td>
                      <td className="small text-muted">{r.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Groups Tab ── */}
      {tab === 'groups' && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-transparent border-bottom py-3">
            <h5 className="mb-0 fw-semibold"><i className="ti ti-users-group me-2 text-primary" />Group Memberships</h5>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light"><tr><th>Group</th><th>Role</th><th className="text-center">Status</th></tr></thead>
                <tbody>
                  {data.groupMemberships.length === 0 && <tr><td colSpan={3} className="text-center text-muted py-4"><i className="ti ti-users-minus fs-3 d-block mb-2" /><span className="small">Not a member of any group.</span></td></tr>}
                  {data.groupMemberships.map(gm => (
                    <tr key={gm.id}>
                      <td><Link to={`/clients/groups`} className="fw-semibold text-body text-decoration-none">Group #{gm.groupId}</Link></td>
                      <td><span className="badge bg-primary bg-opacity-10 text-primary">{gm.roleInGroup}</span></td>
                      <td className="text-center">
                        {gm.isActive
                          ? <span className="badge bg-success bg-opacity-10 text-success">Active</span>
                          : <span className="badge bg-secondary bg-opacity-10 text-secondary">Inactive</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── Aliases Tab ── */}
      {tab === 'aliases' && (
        <div className="card border-0 shadow-sm">
          <div className="card-header bg-transparent border-bottom py-3">
            <h5 className="mb-0 fw-semibold"><i className="ti ti-history me-2 text-primary" />Aliases / Name History</h5>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light"><tr><th>From</th><th>Type</th><th>To</th><th>Date</th><th>Remarks</th></tr></thead>
                <tbody>
                  {aliases.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4"><i className="ti ti-history-off fs-3 d-block mb-2" /><span className="small">No aliases or name history.</span></td></tr>}
                  {aliases.map(a => (
                    <tr key={a.id}>
                      <td><Link to={`/clients/${a.parentClientId}`} className="fw-semibold text-body text-decoration-none">{a.parentClientName}</Link></td>
                      <td><span className="badge bg-warning bg-opacity-10 text-warning">{a.relationshipType}</span></td>
                      <td><Link to={`/clients/${a.childClientId}`} className="fw-semibold text-body text-decoration-none">{a.childClientName}</Link></td>
                      <td className="small">{a.effectiveFrom?.slice(0, 10)}</td>
                      <td className="small text-muted">{a.remarks || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showMerge && (
        <MergeClientModal sourceClient={c} onConfirm={handleMerge} onCancel={() => setShowMerge(false)} saving={saving} clients={allClients} />
      )}
      {showLink && (
        <LinkRelationshipModal client={c} onConfirm={handleLink} onCancel={() => setShowLink(false)} saving={saving} clients={allClients} />
      )}

      {/* ═══ Contact Detail / Remarks Modal ═══ */}
      {detailContact && createPortal(
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,.5)', zIndex: 1060 }} onClick={(e) => { if (e.target === e.currentTarget) closeViewContactDetail(); }}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header py-2 bg-light">
                <div className="d-flex align-items-center gap-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{ width: 44, height: 44, backgroundColor: getAvatarColor(detailContact.contactName), color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}
                  >
                    {getInitials(detailContact.contactName)}
                  </div>
                  <div>
                    <h6 className="mb-0 fw-bold">{detailContact.contactName}</h6>
                    <div className="small text-muted">
                      {detailContact.designation}{detailContact.designation && detailContact.department ? ' | ' : ''}{detailContact.department}
                    </div>
                    {detailContact.contactRoles && (
                      <div className="d-flex flex-wrap gap-1 mt-1">
                        {detailContact.contactRoles.split(',').filter(Boolean).map((role: string) => (
                          <span key={role} className="badge rounded-pill" style={{
                            backgroundColor: (ROLE_COLORS[role] || '#6c757d') + '20',
                            color: ROLE_COLORS[role] || '#6c757d',
                            fontSize: '0.65rem', fontWeight: 600,
                            border: `1px solid ${(ROLE_COLORS[role] || '#6c757d')}40`,
                          }}>
                            {role}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button className="btn-close" onClick={closeViewContactDetail} />
              </div>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <div className="row g-2 mb-3">
                  {detailContact.mobileNumber && (
                    <div className="col-md-4">
                      <div className="small text-muted">Mobile</div>
                      <div className="small fw-semibold text-primary" role="button" style={{ cursor: 'pointer' }}
                        onClick={() => openCallModal(detailContact.contactName, detailContact.mobileNumber!)}>
                        <i className="ti ti-phone me-1" />{detailContact.mobileNumber}
                      </div>
                    </div>
                  )}
                  {detailContact.email && (
                    <div className="col-md-4"><div className="small text-muted">Email</div><div className="small fw-semibold"><i className="ti ti-mail me-1" />{detailContact.email}</div></div>
                  )}
                  {detailContact.whatsAppNumber && (
                    <div className="col-md-4">
                      <div className="small text-muted">WhatsApp</div>
                      <div className="small fw-semibold text-success" role="button" style={{ cursor: 'pointer' }}
                        onClick={() => openCallModal(detailContact.contactName, detailContact.whatsAppNumber!)}>
                        <i className="ti ti-brand-whatsapp me-1" />{detailContact.whatsAppNumber}
                      </div>
                    </div>
                  )}
                </div>
                <hr />

                <div className="mb-3">
                  <h6 className="fw-bold small mb-2"><i className="ti ti-message-plus me-1" />Add Remark / Review</h6>
                  <textarea
                    className="form-control form-control-sm mb-2"
                    rows={3}
                    placeholder="Write your remark about this contact..."
                    value={viewNewRemark}
                    onChange={(e) => setViewNewRemark(e.target.value)}
                    maxLength={2000}
                  />
                  <div className="mb-2">
                    <label className="form-label small text-muted mb-1">Behavior Tags</label>
                    <div className="d-flex flex-wrap gap-1">
                      {BEHAVIOR_TAG_OPTIONS.map(tag => {
                        const active = viewNewRemarkTags.has(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            className="btn btn-sm rounded-pill px-2 py-0"
                            style={{
                              backgroundColor: active ? '#6f42c1' : 'transparent',
                              color: active ? '#fff' : '#6f42c1',
                              border: '1.5px solid #6f42c1',
                              fontWeight: active ? 600 : 400,
                              fontSize: '0.72rem',
                              transition: 'all 0.15s',
                            }}
                            onClick={() => toggleViewBehaviorTag(tag)}
                          >
                            {active && <i className="ti ti-check me-1" style={{ fontSize: '0.6rem' }} />}
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="form-check">
                      <input className="form-check-input" type="checkbox" checked={viewNewRemarkFlagged} onChange={(e) => setViewNewRemarkFlagged(e.target.checked)} id="viewRemarkFlagged" />
                      <label className="form-check-label small" htmlFor="viewRemarkFlagged">
                        <i className="ti ti-flag-filled text-danger me-1" />Flag this contact
                      </label>
                    </div>
                    <button className="btn btn-sm btn-primary" onClick={handleViewAddRemark} disabled={viewRemarkSaving || !viewNewRemark.trim()}>
                      {viewRemarkSaving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : <><i className="ti ti-send me-1" />Submit Remark</>}
                    </button>
                  </div>
                </div>
                <hr />

                <h6 className="fw-bold small mb-2"><i className="ti ti-history me-1" />Remark History</h6>
                {viewRemarksLoading ? (
                  <div className="text-center py-3"><span className="spinner-border spinner-border-sm" /></div>
                ) : viewRemarks.length === 0 ? (
                  <div className="text-center text-muted py-3">
                    <i className="ti ti-message-off fs-2 d-block mb-1" />
                    <div className="small">No remarks yet. Be the first to add one.</div>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {viewRemarks.map(r => {
                      const behaviorTags = (r.behaviorTags || '').split(',').filter(Boolean);
                      return (
                        <div key={r.id} className={`card border ${r.isFlagged ? 'border-danger border-opacity-50' : ''}`}>
                          <div className="card-body py-2 px-3">
                            <div className="d-flex align-items-start justify-content-between">
                              <div className="d-flex align-items-center gap-2 mb-1">
                                <div
                                  className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                                  style={{ width: 28, height: 28, backgroundColor: getAvatarColor(r.createdByName || 'U'), color: '#fff', fontWeight: 700, fontSize: '0.65rem' }}
                                >
                                  {getInitials(r.createdByName || 'User')}
                                </div>
                                <div>
                                  <span className="fw-semibold small">{r.createdByName || 'System'}</span>
                                  <span className="text-muted small ms-2">{new Date(r.createdOn).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              </div>
                              <div className="d-flex align-items-center gap-1">
                                {r.isFlagged && <i className="ti ti-flag-filled text-danger" style={{ fontSize: '0.85rem' }} title="Flagged" />}
                                <button className="btn btn-sm text-muted py-0 px-1" onClick={() => handleViewDeleteRemark(r.id)} title="Remove"><i className="ti ti-trash" style={{ fontSize: '0.75rem' }} /></button>
                              </div>
                            </div>
                            <div className="small mt-1">{r.remarkText}</div>
                            {behaviorTags.length > 0 && (
                              <div className="d-flex flex-wrap gap-1 mt-2">
                                {behaviorTags.map(tag => (
                                  <span key={tag} className="badge rounded-pill" style={{
                                    backgroundColor: '#6f42c120', color: '#6f42c1',
                                    fontSize: '0.6rem', fontWeight: 600,
                                    border: '1px solid #6f42c140',
                                  }}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="modal-footer py-2">
                <button className="btn btn-sm btn-outline-secondary" onClick={closeViewContactDetail}>Close</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ═══ Call Confirmation Modal ═══ */}
      {callModal && createPortal(
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,.45)', zIndex: 1070 }} onClick={(e) => { if (e.target === e.currentTarget) setCallModal(null); }}>
          <div className="modal-dialog modal-sm modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-body text-center py-4">
                <div className="rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                  style={{ width: 56, height: 56, backgroundColor: '#3b7ddd20' }}>
                  <i className="ti ti-phone-call text-primary" style={{ fontSize: '1.6rem' }} />
                </div>
                <h6 className="fw-bold mb-1">Call {callModal.name}?</h6>
                <p className="small text-muted mb-3">{callModal.number}</p>
                {callCopied ? (
                  <div className="alert alert-success py-2 px-3 mb-0 small">
                    <i className="ti ti-check me-1" />Copied <strong>dial:0{stripToDigits(callModal.number)}</strong> to clipboard!
                  </div>
                ) : (
                  <div className="d-flex justify-content-center gap-2">
                    <button className="btn btn-sm btn-outline-secondary px-3" onClick={() => setCallModal(null)}>
                      Cancel
                    </button>
                    <button className="btn btn-sm btn-primary px-3" onClick={confirmCall}>
                      <i className="ti ti-phone me-1" />Yes, Call
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
