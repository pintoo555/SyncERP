/**
 * Client edit page — single-page layout matching create page style.
 * GST verification, multi-address with country-cascaded states, phone inputs with flags,
 * inline address/contact management, GST Verified badge.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import * as clientsApi from '../api/clientsApi';
import type { GstVerifyResult } from '../api/clientsApi';
import type { Industry, Client, Address, Contact, ContactRemark } from '../types';
import { CLIENT_TYPES, ADDRESS_TYPES, BEHAVIOR_TAG_OPTIONS } from '../types';
import ContactForm from '../components/ContactForm';
import ContactDeactivateModal from '../components/ContactDeactivateModal';
import type { CountryPhoneOption } from '../../../components/PhoneInput';
import { api } from '../../../shared/api/baseClient';

/* ─── Types ─── */
interface GeoCountry { id: number; countryCode: string; countryName: string; phoneCode: string }
interface GeoState { id: number; countryId: number; stateName: string; stateCode: string }

type ContactFormData = {
  contactName: string; designation: string; department: string;
  mobileNumber: string; alternateNumber: string; email: string;
  whatsAppNumber: string; contactRoles: string; isPrimary: boolean;
};

const emptyContact = (): ContactFormData => ({
  contactName: '', designation: '', department: '',
  mobileNumber: '', alternateNumber: '', email: '',
  whatsAppNumber: '', contactRoles: '', isPrimary: false,
});

function contactFromRow(c: Contact): ContactFormData {
  return {
    contactName: c.contactName, designation: c.designation || '',
    department: c.department || '', mobileNumber: c.mobileNumber || '',
    alternateNumber: c.alternateNumber || '', email: c.email || '',
    whatsAppNumber: c.whatsAppNumber || '', contactRoles: c.contactRoles || '',
    isPrimary: c.isPrimary,
  };
}

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

function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  const base = 127397;
  return String.fromCodePoint(code.toUpperCase().charCodeAt(0) + base, code.toUpperCase().charCodeAt(1) + base);
}

/* ─── Address editing inline state ─── */
interface AddrEditState {
  id: number | null;
  addressType: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateId: number;
  countryId: number;
  pincode: string;
  isDefault: boolean;
}

const emptyAddr = (defaultCountryId = 0): AddrEditState => ({
  id: null, addressType: '', addressLine1: '', addressLine2: '',
  city: '', stateId: 0, countryId: defaultCountryId, pincode: '', isDefault: false,
});

function addrFromRow(a: Address): AddrEditState {
  return {
    id: a.id, addressType: a.addressType, addressLine1: a.addressLine1,
    addressLine2: a.addressLine2 || '', city: a.city || '',
    stateId: a.stateId || 0, countryId: a.countryId || 0,
    pincode: a.pincode || '', isDefault: a.isDefault,
  };
}

export default function ClientEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientId = Number(id);

  /* ─── State ─── */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [client, setClient] = useState<Client | null>(null);

  // All client fields in one object (matching create page)
  const [form, setForm] = useState({
    clientName: '', clientDisplayName: '', clientType: '', industryId: 0,
    gstNumber: '', panNumber: '', iecCode: '', msmeNumber: '',
    currencyCode: 'INR', creditLimit: 0, creditDays: 0,
    tradeName: '', gstType: '', gstRegistrationDate: '', companyStatus: '',
  });

  // GST
  const [gstVerifying, setGstVerifying] = useState(false);
  const [gstResult, setGstResult] = useState<GstVerifyResult | null>(null);
  const [gstVerifiedFromDb, setGstVerifiedFromDb] = useState(false);
  const [gstJustVerified, setGstJustVerified] = useState(false);

  // Reference data
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [countries, setCountries] = useState<GeoCountry[]>([]);
  const [allStates, setAllStates] = useState<GeoState[]>([]);

  // Addresses (from DB)
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [showAddrForm, setShowAddrForm] = useState(false);
  const [addrForm, setAddrForm] = useState<AddrEditState>(emptyAddr());

  // Contacts (from DB)
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactForm, setContactForm] = useState<ContactFormData>(emptyContact());
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [deactivateContact, setDeactivateContact] = useState<Contact | null>(null);

  // Call confirmation modal
  const [callModal, setCallModal] = useState<{ name: string; number: string } | null>(null);
  const [callCopied, setCallCopied] = useState(false);

  // Contact detail / remarks modal
  const [detailContact, setDetailContact] = useState<Contact | null>(null);
  const [remarks, setRemarks] = useState<ContactRemark[]>([]);
  const [remarksLoading, setRemarksLoading] = useState(false);
  const [newRemark, setNewRemark] = useState('');
  const [newRemarkTags, setNewRemarkTags] = useState<Set<string>>(new Set());
  const [newRemarkFlagged, setNewRemarkFlagged] = useState(false);
  const [remarkSaving, setRemarkSaving] = useState(false);

  /* ─── Computed ─── */
  const indiaId = useMemo(() => countries.find(c => c.countryCode === 'IN')?.id || 0, [countries]);

  const countryPhoneOptions: CountryPhoneOption[] = useMemo(() =>
    countries.map(c => ({ id: c.id, countryCode: c.countryCode, countryName: c.countryName, phoneCode: c.phoneCode || '+91' })),
    [countries]
  );

  const statesForCountry = useCallback((countryId: number) => {
    if (!countryId) return allStates;
    return allStates.filter(s => s.countryId === countryId);
  }, [allStates]);

  const isGstVerified = gstVerifiedFromDb || gstJustVerified;
  const isMerged = client?.isMerged ?? false;

  /* ─── Load ─── */
  useEffect(() => {
    if (!clientId) return;
    setLoading(true);
    Promise.all([
      clientsApi.getClient(clientId),
      clientsApi.listIndustries(),
      api.get<{ success: boolean; data: GeoState[] }>('/api/organization/states').catch(() => ({ data: [] as GeoState[] })),
      api.get<{ success: boolean; data: GeoCountry[] }>('/api/organization/countries').catch(() => ({ data: [] as GeoCountry[] })),
    ]).then(([clientRes, indRes, stateRes, countryRes]) => {
      const c = clientRes.data;
      setClient(c);
      setForm({
        clientName: c.clientName || '',
        clientDisplayName: c.clientDisplayName || '',
        clientType: c.clientType || '',
        industryId: c.industryId || 0,
        gstNumber: c.gstNumber || '',
        panNumber: c.panNumber || '',
        iecCode: c.iecCode || '',
        msmeNumber: c.msmeNumber || '',
        currencyCode: c.currencyCode || 'INR',
        creditLimit: c.creditLimit || 0,
        creditDays: c.creditDays || 0,
        tradeName: c.tradeName || '',
        gstType: c.gstType || '',
        gstRegistrationDate: c.gstRegistrationDate || '',
        companyStatus: c.companyStatus || '',
      });
      setGstVerifiedFromDb(!!c.gstVerified);
      setAddresses(c.addresses || []);
      setContacts(c.contacts || []);
      setIndustries(indRes.data || []);
      setAllStates((stateRes as any).data || []);
      setCountries((countryRes as any).data || []);

      if (searchParams.get('addContact') === '1') {
        setShowContactForm(true);
      }
    }).catch(e => setError(e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, [clientId, searchParams]);

  /* ─── Helpers ─── */
  const flashSuccess = (msg: string) => { setSuccess(msg); setError(null); setTimeout(() => setSuccess(null), 4000); };
  const flashError = (msg: string) => { setError(msg); setSuccess(null); };

  const setField = useCallback((field: string, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  /* ─── GST Verification ─── */
  const handleVerifyGst = async () => {
    const gstin = form.gstNumber.trim();
    if (!gstin || gstin.length < 15) { flashError('Please enter a valid 15-character GSTIN.'); return; }
    setGstVerifying(true); setError(null); setGstResult(null);
    try {
      const res = await clientsApi.verifyGst(gstin);
      const data = res.data;
      setGstResult(data);
      if (!data.valid) { flashError('GST number is invalid.'); return; }

      setGstJustVerified(true);
      const filled: string[] = [];

      if (data.legalName && !form.clientName) { setField('clientName', data.legalName); filled.push('Client Name'); }
      if (data.tradeName && data.tradeName !== data.legalName && !form.clientDisplayName) { setField('clientDisplayName', data.tradeName); filled.push('Display Name'); }
      if (data.pan && !form.panNumber) { setField('panNumber', data.pan); filled.push('PAN'); }
      if (data.tradeName) setField('tradeName', data.tradeName);
      if (data.gstType) setField('gstType', data.gstType);
      if (data.registrationDate) setField('gstRegistrationDate', data.registrationDate);
      if (data.companyStatus) setField('companyStatus', data.companyStatus);

      flashSuccess(`GST verified! ${filled.length > 0 ? 'Auto-filled: ' + filled.join(', ') + '.' : 'All fields already populated.'}`);
    } catch (e: any) { flashError(e?.message ?? 'GST verification failed'); }
    finally { setGstVerifying(false); }
  };

  /* ─── Save Client Details ─── */
  const handleSave = async () => {
    if (!client) return;
    const errs: Record<string, string> = {};
    if (!form.clientName.trim()) errs.clientName = 'Client name is required';
    if (!form.clientType) errs.clientType = 'Client type is required';
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true); setError(null); setSuccess(null);
    try {
      await clientsApi.updateClient(clientId, {
        clientName: form.clientName.trim(),
        clientDisplayName: form.clientDisplayName.trim() || undefined,
        clientType: form.clientType,
        industryId: form.industryId || undefined,
        gstNumber: form.gstNumber.trim() || undefined,
        panNumber: form.panNumber.trim() || undefined,
        iecCode: form.iecCode.trim() || undefined,
        msmeNumber: form.msmeNumber.trim() || undefined,
        currencyCode: form.currencyCode || 'INR',
        creditLimit: form.creditLimit || 0,
        creditDays: form.creditDays || 0,
      });
      flashSuccess('Client details saved successfully.');
    } catch (e: any) { flashError(e?.message ?? 'Failed to save'); }
    finally { setSaving(false); }
  };

  /* ─── Address CRUD ─── */
  const reloadAddresses = async () => {
    const res = await clientsApi.listAddresses(clientId);
    setAddresses(res.data || []);
  };

  const startAddAddr = () => { setAddrForm(emptyAddr(indiaId)); setShowAddrForm(true); };
  const startEditAddr = (a: Address) => { setAddrForm(addrFromRow(a)); setShowAddrForm(true); };
  const cancelAddr = () => { setShowAddrForm(false); setAddrForm(emptyAddr(indiaId)); };

  const handleSaveAddress = async () => {
    try {
      setSaving(true);
      const payload = {
        addressType: addrForm.addressType,
        addressLine1: addrForm.addressLine1,
        addressLine2: addrForm.addressLine2,
        city: addrForm.city,
        stateId: addrForm.stateId || undefined,
        countryId: addrForm.countryId || undefined,
        pincode: addrForm.pincode,
        isDefault: addrForm.isDefault,
      };
      if (addrForm.id) {
        await clientsApi.updateAddress(clientId, addrForm.id, payload);
        flashSuccess('Address updated.');
      } else {
        await clientsApi.createAddress(clientId, payload);
        flashSuccess('Address added.');
      }
      await reloadAddresses();
      cancelAddr();
    } catch (e: any) { flashError(e?.message ?? 'Failed to save address'); }
    finally { setSaving(false); }
  };

  const handleToggleAddr = async (a: Address, active: boolean) => {
    try {
      await clientsApi.toggleAddressStatus(clientId, a.id, active);
      await reloadAddresses();
    } catch (e: any) { flashError(e?.message ?? 'Failed'); }
  };

  /* ─── Contact CRUD ─── */
  const reloadContacts = async () => {
    const res = await clientsApi.listContacts(clientId);
    setContacts(res.data || []);
  };

  const startAddContact = () => { setEditingContactId(null); setContactForm(emptyContact()); setShowContactForm(true); };
  const startEditContact = (c: Contact) => { setEditingContactId(c.id); setContactForm(contactFromRow(c)); setShowContactForm(true); };
  const cancelContact = () => { setShowContactForm(false); setEditingContactId(null); setContactForm(emptyContact()); };

  const handleSaveContact = async () => {
    try {
      setSaving(true);
      if (editingContactId) {
        await clientsApi.updateContact(clientId, editingContactId, contactForm);
        flashSuccess('Contact updated.');
      } else {
        await clientsApi.createContact(clientId, contactForm);
        flashSuccess('Contact added.');
      }
      await reloadContacts();
      cancelContact();
    } catch (e: any) { flashError(e?.message ?? 'Failed to save contact'); }
    finally { setSaving(false); }
  };

  const handleDeactivateConfirm = async (replacedByContactId: number | null) => {
    if (!deactivateContact) return;
    try {
      setSaving(true);
      await clientsApi.deactivateContact(clientId, deactivateContact.id, { replacedByContactId: replacedByContactId ?? undefined });
      await reloadContacts();
      setDeactivateContact(null);
      flashSuccess('Contact deactivated.');
    } catch (e: any) { flashError(e?.message ?? 'Failed'); }
    finally { setSaving(false); }
  };

  /* ─── Contact Detail / Remarks ─── */
  const openContactDetail = async (c: Contact) => {
    setDetailContact(c);
    setRemarksLoading(true);
    setNewRemark('');
    setNewRemarkTags(new Set());
    setNewRemarkFlagged(false);
    try {
      const res = await clientsApi.listContactRemarks(clientId, c.id);
      setRemarks(res.data || []);
    } catch { setRemarks([]); }
    finally { setRemarksLoading(false); }
  };

  const closeContactDetail = () => {
    setDetailContact(null);
    setRemarks([]);
    setNewRemark('');
    setNewRemarkTags(new Set());
    setNewRemarkFlagged(false);
  };

  const handleAddRemark = async () => {
    if (!detailContact || !newRemark.trim()) return;
    setRemarkSaving(true);
    try {
      await clientsApi.createContactRemark(clientId, detailContact.id, {
        remarkText: newRemark.trim(),
        behaviorTags: newRemarkTags.size > 0 ? Array.from(newRemarkTags).join(',') : undefined,
        isFlagged: newRemarkFlagged,
      });
      const res = await clientsApi.listContactRemarks(clientId, detailContact.id);
      setRemarks(res.data || []);
      setNewRemark('');
      setNewRemarkTags(new Set());
      setNewRemarkFlagged(false);
    } catch (e: any) { flashError(e?.message ?? 'Failed to add remark'); }
    finally { setRemarkSaving(false); }
  };

  const handleDeleteRemark = async (remarkId: number) => {
    if (!detailContact) return;
    try {
      await clientsApi.deleteContactRemark(clientId, detailContact.id, remarkId);
      setRemarks(prev => prev.filter(r => r.id !== remarkId));
    } catch (e: any) { flashError(e?.message ?? 'Failed'); }
  };

  const toggleBehaviorTag = (tag: string) => {
    setNewRemarkTags(prev => {
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

  /* ─── Render: Address inline edit card ─── */
  const renderAddrEditForm = () => {
    const states = statesForCountry(addrForm.countryId);
    return (
      <div className="card border border-primary mb-3" style={{ backgroundColor: '#f8faff' }}>
        <div className="card-header bg-primary bg-opacity-10 py-2 d-flex align-items-center justify-content-between">
          <h6 className="mb-0 fw-semibold text-primary">
            <i className="ti ti-edit me-1" />{addrForm.id ? 'Edit Address' : 'New Address'}
          </h6>
          <button type="button" className="btn btn-sm btn-outline-secondary py-0 px-2" onClick={cancelAddr}>
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="card-body py-3">
          <div className="row g-2">
            <div className="col-md-3">
              <label className="form-label small mb-1">Type <span className="text-danger">*</span></label>
              <select className="form-select form-select-sm" value={addrForm.addressType}
                onChange={e => setAddrForm(p => ({ ...p, addressType: e.target.value }))}>
                <option value="">Select type...</option>
                {ADDRESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="col-md-9">
              <label className="form-label small mb-1">Address Line 1 <span className="text-danger">*</span></label>
              <input type="text" className="form-control form-control-sm" value={addrForm.addressLine1}
                onChange={e => setAddrForm(p => ({ ...p, addressLine1: e.target.value }))} maxLength={300} />
            </div>
            <div className="col-12">
              <label className="form-label small mb-1">Address Line 2</label>
              <input type="text" className="form-control form-control-sm" value={addrForm.addressLine2}
                onChange={e => setAddrForm(p => ({ ...p, addressLine2: e.target.value }))} maxLength={300} />
            </div>
            <div className="col-md-3">
              <label className="form-label small mb-1">City</label>
              <input type="text" className="form-control form-control-sm" value={addrForm.city}
                onChange={e => setAddrForm(p => ({ ...p, city: e.target.value }))} maxLength={100} />
            </div>
            <div className="col-md-3">
              <label className="form-label small mb-1">Country</label>
              <select className="form-select form-select-sm" value={addrForm.countryId}
                onChange={e => setAddrForm(p => ({ ...p, countryId: Number(e.target.value) || 0, stateId: 0 }))}>
                <option value="0">Select country...</option>
                {countries.map(c => (
                  <option key={c.id} value={c.id}>{countryCodeToFlag(c.countryCode)} {c.countryName}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small mb-1">State</label>
              <select className="form-select form-select-sm" value={addrForm.stateId}
                onChange={e => setAddrForm(p => ({ ...p, stateId: Number(e.target.value) || 0 }))}>
                <option value="0">Select state...</option>
                {states.map(s => <option key={s.id} value={s.id}>{s.stateName}</option>)}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label small mb-1">Pincode</label>
              <input type="text" className="form-control form-control-sm" value={addrForm.pincode}
                onChange={e => setAddrForm(p => ({ ...p, pincode: e.target.value }))} maxLength={10} />
            </div>
            <div className="col-md-1 d-flex align-items-end">
              <div className="form-check">
                <input className="form-check-input" type="checkbox" checked={addrForm.isDefault}
                  onChange={e => setAddrForm(p => ({ ...p, isDefault: e.target.checked }))} id="editAddrDefault" />
                <label className="form-check-label small" htmlFor="editAddrDefault">Default</label>
              </div>
            </div>
          </div>
          <div className="d-flex justify-content-end gap-2 mt-3">
            <button className="btn btn-sm btn-outline-secondary" onClick={cancelAddr}>Cancel</button>
            <button className="btn btn-sm btn-primary" onClick={handleSaveAddress}
              disabled={saving || !addrForm.addressLine1 || !addrForm.addressType}>
              {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</>
                : <><i className="ti ti-check me-1" />{addrForm.id ? 'Update' : 'Save'} Address</>}
            </button>
          </div>
        </div>
      </div>
    );
  };

  /* ─── Loading / Not Found ─── */
  if (loading) {
    return (
      <div className="container-fluid py-5 text-center text-muted">
        <div className="spinner-border spinner-border-sm me-2" /> Loading client details...
      </div>
    );
  }
  if (!client) {
    return (
      <div className="container-fluid py-5 text-center text-muted">
        <i className="ti ti-alert-circle me-2" />Client not found.
      </div>
    );
  }

  return (
    <div className="container-fluid py-4" style={{ maxWidth: 1100 }}>
      {/* ═══════════ PAGE HEADER ═══════════ */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div className="d-flex align-items-center">
          <button className="btn btn-outline-secondary btn-sm me-3" onClick={() => navigate(`/clients/${clientId}`)}>
            <i className="ti ti-arrow-left me-1" /> Back
          </button>
          <div>
            <h4 className="mb-0 fw-bold">
              <i className="ti ti-pencil me-2 text-primary" />
              Edit Client
              <code className="ms-2 small text-muted">{client.clientCode}</code>
              {isGstVerified && (
                <span className="badge bg-success ms-2 align-middle" style={{ fontSize: '0.65rem', verticalAlign: 'middle' }}>
                  <i className="ti ti-shield-check me-1" />GST Verified
                </span>
              )}
            </h4>
            <p className="text-muted mb-0 small">{client.clientName}</p>
          </div>
        </div>
        {!isMerged && (
          <button className="btn btn-success btn-sm px-4" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : <><i className="ti ti-device-floppy me-1" />Save Client</>}
          </button>
        )}
      </div>

      {isMerged && (
        <div className="alert alert-warning d-flex align-items-center">
          <i className="ti ti-git-merge me-2 fs-5" />
          <div>This client has been merged into <Link to={`/clients/${client.mergedIntoClientId}`} className="fw-semibold">{client.mergedIntoClientName}</Link>. Editing is disabled.</div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger alert-dismissible fade show d-flex align-items-start">
          <i className="ti ti-alert-circle me-2 mt-1" /><div className="flex-grow-1">{error}</div>
          <button type="button" className="btn-close" onClick={() => setError(null)} />
        </div>
      )}
      {success && (
        <div className="alert alert-success alert-dismissible fade show d-flex align-items-start">
          <i className="ti ti-circle-check me-2 mt-1" /><div className="flex-grow-1">{success}</div>
          <button type="button" className="btn-close" onClick={() => setSuccess(null)} />
        </div>
      )}

      {/* ═══════════ SECTION 1: GST VERIFICATION ═══════════ */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-primary bg-opacity-10 border-bottom-0 py-3 d-flex align-items-center justify-content-between">
          <h6 className="mb-0 fw-semibold text-primary">
            <i className="ti ti-shield-check me-2" />GST Verification
          </h6>
          {isGstVerified && (
            <span className="badge bg-success py-2 px-3">
              <i className="ti ti-circle-check me-1" />Verified
              {client.gstVerifiedOn && <span className="ms-1 opacity-75">({new Date(client.gstVerifiedOn).toLocaleDateString()})</span>}
            </span>
          )}
        </div>
        <div className="card-body">
          <div className="row align-items-end g-3">
            <div className="col-md-5">
              <label className="form-label small fw-semibold mb-1">GST Number (GSTIN)</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. 29AAFQQ9980M1ZQ"
                value={form.gstNumber}
                onChange={e => setField('gstNumber', e.target.value.toUpperCase())}
                maxLength={15}
                disabled={isMerged}
                style={{ letterSpacing: '2px', fontFamily: 'monospace', fontSize: '1rem' }}
              />
            </div>
            <div className="col-auto">
              {!isMerged && (
                <button type="button" className="btn btn-primary" onClick={handleVerifyGst}
                  disabled={gstVerifying || form.gstNumber.trim().length < 15}>
                  {gstVerifying
                    ? <><span className="spinner-border spinner-border-sm me-2" />Verifying...</>
                    : <><i className="ti ti-shield-check me-2" />Verify &amp; Auto-fill</>}
                </button>
              )}
            </div>
            {gstResult?.valid && !isGstVerified && (
              <div className="col-auto">
                <span className="badge bg-success py-2 px-3 fs-6">
                  <i className="ti ti-circle-check me-1" /> Verified
                </span>
              </div>
            )}
          </div>

          {/* GST Result Summary */}
          {gstResult?.valid && (
            <div className="mt-3 p-3 rounded border" style={{ backgroundColor: '#f0fdf4' }}>
              <div className="row g-2">
                <div className="col-md-4">
                  <div className="small text-muted">Legal Name</div>
                  <div className="fw-semibold">{gstResult.legalName}</div>
                </div>
                {gstResult.tradeName && gstResult.tradeName !== gstResult.legalName && (
                  <div className="col-md-4">
                    <div className="small text-muted">Trade Name</div>
                    <div className="fw-semibold">{gstResult.tradeName}</div>
                  </div>
                )}
                <div className="col-md-2">
                  <div className="small text-muted">Status</div>
                  <div className="fw-semibold">
                    <span className={`badge ${gstResult.companyStatus === 'Active' ? 'bg-success' : 'bg-warning'}`}>
                      {gstResult.companyStatus}
                    </span>
                  </div>
                </div>
                <div className="col-md-2">
                  <div className="small text-muted">GST Type</div>
                  <div className="fw-semibold">{gstResult.gstType}</div>
                </div>
                {gstResult.pan && (
                  <div className="col-md-2">
                    <div className="small text-muted">PAN</div>
                    <div className="fw-semibold font-monospace">{gstResult.pan}</div>
                  </div>
                )}
                {gstResult.registrationDate && (
                  <div className="col-md-2">
                    <div className="small text-muted">Reg. Date</div>
                    <div className="fw-semibold">{gstResult.registrationDate}</div>
                  </div>
                )}
                {gstResult.stateName && (
                  <div className="col-md-2">
                    <div className="small text-muted">State</div>
                    <div className="fw-semibold">{gstResult.stateName} ({gstResult.stateCode})</div>
                  </div>
                )}
              </div>
              <div className="small text-success mt-2">
                <i className="ti ti-info-circle me-1" />Details have been auto-filled below. Save to persist changes.
              </div>
            </div>
          )}

          {gstResult && !gstResult.valid && (
            <div className="alert alert-warning mt-3 mb-0 d-flex align-items-center">
              <i className="ti ti-alert-triangle me-2" />
              <span>GSTIN <code className="font-monospace">{gstResult.gstin}</code> is not valid in the GST registry.</span>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ SECTION 2: BASIC INFORMATION ═══════════ */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-transparent border-bottom py-3">
          <h6 className="mb-0 fw-semibold"><i className="ti ti-id me-2 text-primary" />Basic Information</h6>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Client Name (Legal Name) <span className="text-danger">*</span></label>
              <input type="text" className={`form-control form-control-sm ${fieldErrors.clientName ? 'is-invalid' : ''}`}
                value={form.clientName} onChange={e => setField('clientName', e.target.value)} maxLength={200} disabled={isMerged} />
              {fieldErrors.clientName && <div className="invalid-feedback">{fieldErrors.clientName}</div>}
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Trade / Display Name</label>
              <input type="text" className="form-control form-control-sm"
                value={form.clientDisplayName} onChange={e => setField('clientDisplayName', e.target.value)} maxLength={200}
                placeholder="Optional display name" disabled={isMerged} />
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Client Type <span className="text-danger">*</span></label>
              <select className={`form-select form-select-sm ${fieldErrors.clientType ? 'is-invalid' : ''}`}
                value={form.clientType} onChange={e => setField('clientType', e.target.value)} disabled={isMerged}>
                <option value="">Select type...</option>
                {CLIENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {fieldErrors.clientType && <div className="invalid-feedback">{fieldErrors.clientType}</div>}
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Industry</label>
              <select className="form-select form-select-sm" value={form.industryId}
                onChange={e => setField('industryId', Number(e.target.value) || 0)} disabled={isMerged}>
                <option value="0">Select industry...</option>
                {industries.filter(i => i.isActive).map(i => (
                  <option key={i.id} value={i.id}>{i.industryName} ({i.industryCategory})</option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Company Status</label>
              <input type="text" className="form-control form-control-sm"
                value={form.companyStatus} onChange={e => setField('companyStatus', e.target.value)} maxLength={50}
                placeholder="e.g. Active, Inactive" disabled={isMerged} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ SECTION 3: COMPLIANCE & FINANCIAL ═══════════ */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-transparent border-bottom py-3">
          <h6 className="mb-0 fw-semibold"><i className="ti ti-certificate me-2 text-primary" />Compliance &amp; Financial</h6>
        </div>
        <div className="card-body">
          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label small fw-semibold">PAN Number</label>
              <input type="text" className="form-control form-control-sm"
                value={form.panNumber} onChange={e => setField('panNumber', e.target.value.toUpperCase())} maxLength={20}
                placeholder="AAAAA9999A" style={{ letterSpacing: '1px', fontFamily: 'monospace' }} disabled={isMerged} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">IEC Code</label>
              <input type="text" className="form-control form-control-sm"
                value={form.iecCode} onChange={e => setField('iecCode', e.target.value)} maxLength={30} disabled={isMerged} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">MSME Number</label>
              <input type="text" className="form-control form-control-sm"
                value={form.msmeNumber} onChange={e => setField('msmeNumber', e.target.value)} maxLength={30} disabled={isMerged} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">GST Type</label>
              <input type="text" className="form-control form-control-sm"
                value={form.gstType} onChange={e => setField('gstType', e.target.value)} maxLength={50}
                placeholder="e.g. Regular, Composition" disabled={isMerged} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">GST Registration Date</label>
              <input type="date" className="form-control form-control-sm"
                value={form.gstRegistrationDate} onChange={e => setField('gstRegistrationDate', e.target.value)} disabled={isMerged} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Currency</label>
              <input type="text" className="form-control form-control-sm"
                value={form.currencyCode} onChange={e => setField('currencyCode', e.target.value.toUpperCase())} maxLength={10} disabled={isMerged} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Credit Limit</label>
              <input type="number" className="form-control form-control-sm"
                value={form.creditLimit} onChange={e => setField('creditLimit', Number(e.target.value) || 0)} min={0} step={0.01} disabled={isMerged} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Credit Days</label>
              <input type="number" className="form-control form-control-sm"
                value={form.creditDays} onChange={e => setField('creditDays', Number(e.target.value) || 0)} min={0} disabled={isMerged} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ SECTION 4: ADDRESSES ═══════════ */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-transparent border-bottom py-3 d-flex align-items-center justify-content-between">
          <h6 className="mb-0 fw-semibold">
            <i className="ti ti-map-pin me-2 text-primary" />
            Addresses
            <span className="badge bg-primary bg-opacity-10 text-primary ms-2">{addresses.filter(a => a.isActive).length}</span>
          </h6>
          {!isMerged && !showAddrForm && (
            <div className="btn-group btn-group-sm">
              <button type="button" className="btn btn-outline-primary" onClick={startAddAddr}>
                <i className="ti ti-plus me-1" />Add Address
              </button>
            </div>
          )}
        </div>
        <div className="card-body">
          {/* Inline address form */}
          {showAddrForm && renderAddrEditForm()}

          {/* Address list as cards */}
          {addresses.length === 0 && !showAddrForm && (
            <div className="text-center text-muted py-4">
              <i className="ti ti-map-pin-off fs-1 d-block mb-2" />
              <div className="small">No addresses yet. Click Add Address above.</div>
            </div>
          )}
          {addresses.map(a => (
            <div key={a.id} className={`card border mb-2 ${!a.isActive ? 'opacity-50' : ''}`}>
              <div className="card-body py-2 px-3">
                <div className="d-flex align-items-start justify-content-between">
                  <div className="flex-grow-1">
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="badge bg-primary bg-opacity-10 text-primary">{a.addressType}</span>
                      {a.isDefault && <span className="badge bg-success bg-opacity-10 text-success"><i className="ti ti-check me-1" />Default</span>}
                      {!a.isActive && <span className="badge bg-secondary bg-opacity-10 text-secondary">Inactive</span>}
                    </div>
                    <div className="small">
                      {a.addressLine1}
                      {a.addressLine2 && <>, {a.addressLine2}</>}
                    </div>
                    <div className="small text-muted">
                      {[a.city, a.stateName, a.countryName, a.pincode].filter(Boolean).join(', ') || 'No location details'}
                    </div>
                  </div>
                  {!isMerged && (
                    <div className="btn-group btn-group-sm ms-2">
                      {a.isActive && (
                        <>
                          <button className="btn btn-outline-primary py-0 px-2" onClick={() => startEditAddr(a)} title="Edit">
                            <i className="ti ti-pencil" style={{ fontSize: '0.8rem' }} />
                          </button>
                          <button className="btn btn-outline-warning py-0 px-2" onClick={() => handleToggleAddr(a, false)} title="Deactivate">
                            <i className="ti ti-ban" style={{ fontSize: '0.8rem' }} />
                          </button>
                        </>
                      )}
                      {!a.isActive && (
                        <button className="btn btn-outline-success py-0 px-2" onClick={() => handleToggleAddr(a, true)} title="Reactivate">
                          <i className="ti ti-check" style={{ fontSize: '0.8rem' }} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════ SECTION 5: CONTACTS ═══════════ */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-transparent border-bottom py-3 d-flex align-items-center justify-content-between">
          <h6 className="mb-0 fw-semibold">
            <i className="ti ti-address-book me-2 text-primary" />
            Contacts
            <span className="badge bg-primary bg-opacity-10 text-primary ms-2">{contacts.filter(c => c.isActive).length}</span>
          </h6>
          {!isMerged && !showContactForm && (
            <button className="btn btn-sm btn-outline-primary" onClick={startAddContact}>
              <i className="ti ti-plus me-1" />Add Contact
            </button>
          )}
        </div>
        <div className="card-body">
          {/* Inline contact form */}
          {showContactForm && (
            <div className="card border border-primary mb-3" style={{ backgroundColor: '#f8faff' }}>
              <div className="card-header bg-primary bg-opacity-10 py-2 d-flex align-items-center justify-content-between">
                <h6 className="mb-0 fw-semibold text-primary">
                  <i className="ti ti-edit me-1" />{editingContactId ? 'Edit Contact' : 'New Contact'}
                </h6>
                <button type="button" className="btn btn-sm btn-outline-secondary py-0 px-2" onClick={cancelContact}>
                  <i className="ti ti-x" />
                </button>
              </div>
              <div className="card-body py-3">
                <ContactForm form={contactForm} onChange={(f, v) => setContactForm(p => ({ ...p, [f]: v } as any))} countries={countryPhoneOptions} />
                <div className="d-flex justify-content-end gap-2 mt-3">
                  <button className="btn btn-sm btn-outline-secondary" onClick={cancelContact}>Cancel</button>
                  <button className="btn btn-sm btn-primary" onClick={handleSaveContact}
                    disabled={saving || !contactForm.contactName}>
                    {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</>
                      : <><i className="ti ti-check me-1" />{editingContactId ? 'Update' : 'Save'} Contact</>}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Contacts list */}
          {contacts.length === 0 && !showContactForm && (
            <div className="text-center text-muted py-4">
              <i className="ti ti-user-off fs-1 d-block mb-2" />
              <div className="small">No contacts yet. Click Add Contact above.</div>
            </div>
          )}
          {contacts.map(c => {
            const roles = (c.contactRoles || '').split(',').filter(Boolean);
            return (
              <div key={c.id} className={`card border mb-2 ${!c.isActive ? 'opacity-50' : ''}`}>
                <div className="card-body py-2 px-3">
                  <div className="d-flex align-items-start justify-content-between">
                    <div className="d-flex align-items-start gap-3 flex-grow-1">
                      {/* Avatar with initials */}
                      <div
                        className="rounded-circle d-flex align-items-center justify-content-center flex-shrink-0"
                        style={{
                          width: 40, height: 40, backgroundColor: getAvatarColor(c.contactName),
                          color: '#fff', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.5px',
                          cursor: 'pointer',
                        }}
                        onClick={() => openContactDetail(c)}
                        title="View details & remarks"
                      >
                        {getInitials(c.contactName)}
                      </div>
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center gap-2 mb-1">
                          <span className="fw-semibold small" role="button" onClick={() => openContactDetail(c)}
                            style={{ cursor: 'pointer' }} title="View details & remarks">
                            {c.contactName}
                          </span>
                          {c.isPrimary && <span className="badge bg-warning bg-opacity-25 text-dark" style={{ fontSize: '0.6rem' }}><i className="ti ti-star-filled me-1" />Primary</span>}
                          {!c.isActive && <span className="badge bg-secondary bg-opacity-10 text-secondary">Inactive</span>}
                        </div>
                        {/* Role Tags */}
                        {roles.length > 0 && (
                          <div className="d-flex flex-wrap gap-1 mb-1">
                            {roles.map(role => (
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
                          {c.designation && <span>{c.designation}</span>}
                          {c.designation && c.department && <span className="mx-1">|</span>}
                          {c.department && <span>{c.department}</span>}
                        </div>
                        <div className="d-flex flex-wrap gap-3 small mt-1">
                          {c.mobileNumber && (
                            <span role="button" className="text-primary" style={{ cursor: 'pointer' }}
                              onClick={() => openCallModal(c.contactName, c.mobileNumber!)}
                              title="Click to dial">
                              <i className="ti ti-phone me-1" />{c.mobileNumber}
                            </span>
                          )}
                          {c.email && <span><i className="ti ti-mail me-1 text-muted" />{c.email}</span>}
                          {c.whatsAppNumber && (
                            <span role="button" className="text-success" style={{ cursor: 'pointer' }}
                              onClick={() => openCallModal(c.contactName, c.whatsAppNumber!)}
                              title="Click to dial">
                              <i className="ti ti-brand-whatsapp me-1" />{c.whatsAppNumber}
                            </span>
                          )}
                        </div>
                        {c.replacedByContactName && (
                          <div className="small text-muted mt-1"><i className="ti ti-arrow-right me-1" />Replaced by: {c.replacedByContactName}</div>
                        )}
                      </div>
                    </div>
                    <div className="d-flex align-items-center gap-1 ms-2">
                      <button className="btn btn-sm btn-outline-secondary py-0 px-2" onClick={() => openContactDetail(c)} title="Remarks & Details">
                        <i className="ti ti-message-dots" style={{ fontSize: '0.8rem' }} />
                      </button>
                      {!isMerged && c.isActive && (
                        <>
                          <button className="btn btn-sm btn-outline-primary py-0 px-2" onClick={() => startEditContact(c)} title="Edit">
                            <i className="ti ti-pencil" style={{ fontSize: '0.8rem' }} />
                          </button>
                          <button className="btn btn-sm btn-outline-warning py-0 px-2" onClick={() => setDeactivateContact(c)} title="Deactivate">
                            <i className="ti ti-user-off" style={{ fontSize: '0.8rem' }} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════ BOTTOM ACTIONS ═══════════ */}
      {!isMerged && (
        <div className="d-flex justify-content-between align-items-center">
          <button className="btn btn-outline-secondary" onClick={() => navigate(`/clients/${clientId}`)}>
            <i className="ti ti-x me-1" />Cancel
          </button>
          <button className="btn btn-success px-5" onClick={handleSave} disabled={saving}>
            {saving ? <><span className="spinner-border spinner-border-sm me-2" />Saving...</> : <><i className="ti ti-device-floppy me-2" />Save Client</>}
          </button>
        </div>
      )}

      {/* Contact Deactivate Modal */}
      {deactivateContact && (
        <ContactDeactivateModal
          contact={deactivateContact}
          clientId={clientId}
          onConfirm={handleDeactivateConfirm}
          onCancel={() => setDeactivateContact(null)}
          saving={saving}
        />
      )}

      {/* ═══ Contact Detail / Remarks Modal ═══ */}
      {detailContact && createPortal(
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,.5)', zIndex: 1060 }} onClick={(e) => { if (e.target === e.currentTarget) closeContactDetail(); }}>
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
                    {/* Role Tags */}
                    {detailContact.contactRoles && (
                      <div className="d-flex flex-wrap gap-1 mt-1">
                        {detailContact.contactRoles.split(',').filter(Boolean).map(role => (
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
                <button className="btn-close" onClick={closeContactDetail} />
              </div>
              <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                {/* Contact Info Summary */}
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

                {/* Add Remark Form */}
                <div className="mb-3">
                  <h6 className="fw-bold small mb-2"><i className="ti ti-message-plus me-1" />Add Remark / Review</h6>
                  <textarea
                    className="form-control form-control-sm mb-2"
                    rows={3}
                    placeholder="Write your remark about this contact..."
                    value={newRemark}
                    onChange={(e) => setNewRemark(e.target.value)}
                    maxLength={2000}
                  />
                  <div className="mb-2">
                    <label className="form-label small text-muted mb-1">Behavior Tags</label>
                    <div className="d-flex flex-wrap gap-1">
                      {BEHAVIOR_TAG_OPTIONS.map(tag => {
                        const active = newRemarkTags.has(tag);
                        return (
                          <button
                            key={tag}
                            type="button"
                            className="btn btn-sm rounded-pill px-2 py-0"
                            style={{
                              backgroundColor: active ? '#6f42c1' : 'transparent',
                              color: active ? '#fff' : '#6f42c1',
                              border: `1.5px solid #6f42c1`,
                              fontWeight: active ? 600 : 400,
                              fontSize: '0.72rem',
                              transition: 'all 0.15s',
                            }}
                            onClick={() => toggleBehaviorTag(tag)}
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
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={newRemarkFlagged}
                        onChange={(e) => setNewRemarkFlagged(e.target.checked)}
                        id="remarkFlagged"
                      />
                      <label className="form-check-label small" htmlFor="remarkFlagged">
                        <i className="ti ti-flag-filled text-danger me-1" />Flag this contact
                      </label>
                    </div>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={handleAddRemark}
                      disabled={remarkSaving || !newRemark.trim()}
                    >
                      {remarkSaving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : <><i className="ti ti-send me-1" />Submit Remark</>}
                    </button>
                  </div>
                </div>
                <hr />

                {/* Remark History */}
                <h6 className="fw-bold small mb-2"><i className="ti ti-history me-1" />Remark History</h6>
                {remarksLoading ? (
                  <div className="text-center py-3"><span className="spinner-border spinner-border-sm" /></div>
                ) : remarks.length === 0 ? (
                  <div className="text-center text-muted py-3">
                    <i className="ti ti-message-off fs-2 d-block mb-1" />
                    <div className="small">No remarks yet. Be the first to add one.</div>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-2">
                    {remarks.map(r => {
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
                                <button className="btn btn-sm text-muted py-0 px-1" onClick={() => handleDeleteRemark(r.id)} title="Remove"><i className="ti ti-trash" style={{ fontSize: '0.75rem' }} /></button>
                              </div>
                            </div>
                            <div className="small mt-1">{r.remarkText}</div>
                            {behaviorTags.length > 0 && (
                              <div className="d-flex flex-wrap gap-1 mt-2">
                                {behaviorTags.map(tag => (
                                  <span key={tag} className="badge rounded-pill bg-purple bg-opacity-10 text-purple" style={{
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
                <button className="btn btn-sm btn-outline-secondary" onClick={closeContactDetail}>Close</button>
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
