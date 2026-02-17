/**
 * Client create page — single-page layout with GST verification, multi-address,
 * country-cascaded states, phone inputs with flags, and post-creation contact prompt.
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import * as clientsApi from '../api/clientsApi';
import type { Industry, DuplicateMatch } from '../types';
import type { GstVerifyResult } from '../api/clientsApi';
import { CLIENT_TYPES, ADDRESS_TYPES } from '../types';
import DuplicateWarningModal from '../components/DuplicateWarningModal';
import { api } from '../../../shared/api/baseClient';

/* ─── Types ─── */
interface GeoCountry { id: number; countryCode: string; countryName: string; phoneCode: string }
interface GeoState { id: number; countryId: number; stateName: string; stateCode: string }

interface AddressEntry {
  key: number;
  addressType: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateId: number;
  countryId: number;
  pincode: string;
  isDefaultBilling: boolean;
  isDefaultShipping: boolean;
}

/* ─── Helpers ─── */
let addrKeySeq = 1;
const newAddress = (type: string = 'Billing', defaultCountryId: number = 0): AddressEntry => ({
  key: addrKeySeq++,
  addressType: type,
  addressLine1: '', addressLine2: '', city: '',
  stateId: 0, countryId: defaultCountryId, pincode: '',
  isDefaultBilling: false, isDefaultShipping: false,
});

function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  const base = 127397;
  return String.fromCodePoint(code.toUpperCase().charCodeAt(0) + base, code.toUpperCase().charCodeAt(1) + base);
}

export default function ClientCreatePage() {
  const navigate = useNavigate();

  /* ─── Form state ─── */
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Basic + Compliance (single object)
  const [form, setForm] = useState({
    clientName: '', clientDisplayName: '', clientType: '', industryId: 0,
    gstNumber: '', panNumber: '', iecCode: '', msmeNumber: '',
    currencyCode: 'INR', creditLimit: 0, creditDays: 0,
    tradeName: '', gstType: '', gstRegistrationDate: '', companyStatus: '',
  });

  // GST
  const [gstVerifying, setGstVerifying] = useState(false);
  const [gstResult, setGstResult] = useState<GstVerifyResult | null>(null);
  const [gstVerified, setGstVerified] = useState(false);

  // Addresses
  const [addresses, setAddresses] = useState<AddressEntry[]>([]);

  // Reference data
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [countries, setCountries] = useState<GeoCountry[]>([]);
  const [allStates, setAllStates] = useState<GeoState[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);

  // Post-creation modal
  const [createdClientId, setCreatedClientId] = useState<number | null>(null);
  const [createdClientName, setCreatedClientName] = useState('');
  const [showAddContactModal, setShowAddContactModal] = useState(false);

  /* ─── Load reference data ─── */
  useEffect(() => {
    clientsApi.listIndustries().then(r => setIndustries(r.data || [])).catch(() => {});
    api.get<{ success: boolean; data: GeoCountry[] }>('/api/organization/countries')
      .then(r => {
        const c = r.data || [];
        setCountries(c);
        // Default India
        const india = c.find((x: GeoCountry) => x.countryCode === 'IN');
        if (india) {
          setAddresses([newAddress('Billing', india.id)]);
        } else {
          setAddresses([newAddress('Billing')]);
        }
      })
      .catch(() => { setAddresses([newAddress('Billing')]); });
    api.get<{ success: boolean; data: GeoState[] }>('/api/organization/states')
      .then(r => setAllStates(r.data || []))
      .catch(() => {});
  }, []);

  const indiaId = useMemo(() => countries.find(c => c.countryCode === 'IN')?.id || 0, [countries]);

  // States filtered by country
  const statesForCountry = useCallback((countryId: number) => {
    if (!countryId) return allStates;
    return allStates.filter(s => s.countryId === countryId);
  }, [allStates]);

  /* ─── Form handlers ─── */
  const setField = useCallback((field: string, value: string | number) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const updateAddress = useCallback((key: number, field: string, value: string | number | boolean) => {
    setAddresses(prev => prev.map(a => {
      if (a.key !== key) return a;
      const updated = { ...a, [field]: value };
      // Reset state when country changes
      if (field === 'countryId') updated.stateId = 0;
      return updated;
    }));
  }, []);

  const addAddress = useCallback((type: string) => {
    setAddresses(prev => [...prev, newAddress(type, indiaId)]);
  }, [indiaId]);

  const removeAddress = useCallback((key: number) => {
    setAddresses(prev => prev.filter(a => a.key !== key));
  }, []);

  const copyBillingToShipping = useCallback(() => {
    const billing = addresses.find(a => a.addressType === 'Billing');
    if (!billing) return;
    const existing = addresses.find(a => a.addressType === 'Shipping');
    if (existing) {
      setAddresses(prev => prev.map(a =>
        a.key === existing.key
          ? { ...a, addressLine1: billing.addressLine1, addressLine2: billing.addressLine2, city: billing.city, stateId: billing.stateId, countryId: billing.countryId, pincode: billing.pincode }
          : a
      ));
    } else {
      setAddresses(prev => [...prev, {
        ...newAddress('Shipping', billing.countryId),
        addressLine1: billing.addressLine1, addressLine2: billing.addressLine2,
        city: billing.city, stateId: billing.stateId, countryId: billing.countryId, pincode: billing.pincode,
      }]);
    }
  }, [addresses]);

  /* ─── GST Verification ─── */
  const handleVerifyGst = async () => {
    const gstin = form.gstNumber.trim();
    if (!gstin || gstin.length < 15) {
      setError('Please enter a valid 15-character GSTIN to verify.');
      return;
    }
    setGstVerifying(true);
    setError(null);
    setGstResult(null);

    try {
      const res = await clientsApi.verifyGst(gstin);
      const data = res.data;
      setGstResult(data);

      if (!data.valid) {
        setError('GST number is invalid. Please check and try again.');
        return;
      }

      setGstVerified(true);

      // Auto-fill all returned fields
      setForm(prev => ({
        ...prev,
        clientName: prev.clientName || data.legalName || '',
        clientDisplayName: prev.clientDisplayName || (data.tradeName && data.tradeName !== data.legalName ? data.tradeName : ''),
        panNumber: prev.panNumber || data.pan || '',
        tradeName: data.tradeName || '',
        gstType: data.gstType || '',
        gstRegistrationDate: data.registrationDate || '',
        companyStatus: data.companyStatus || '',
      }));

      // Auto-fill principal address into billing
      if (data.principalAddress) {
        const pa = data.principalAddress;
        let matchedStateId = 0;
        if (data.stateName) {
          const match = allStates.find(s => s.stateName.toLowerCase() === data.stateName!.toLowerCase());
          if (match) matchedStateId = match.id;
        }
        if (!matchedStateId && data.stateCode) {
          const match = allStates.find(s => s.stateCode === data.stateCode);
          if (match) matchedStateId = match.id;
        }

        setAddresses(prev => {
          const billing = prev.find(a => a.addressType === 'Billing');
          if (billing && !billing.addressLine1) {
            return prev.map(a => a.key === billing.key ? {
              ...a,
              addressLine1: pa.addressLine1 || '',
              addressLine2: pa.addressLine2 || '',
              city: pa.city || '',
              pincode: pa.pincode || '',
              stateId: matchedStateId || a.stateId,
              countryId: a.countryId || indiaId,
            } : a);
          }
          return prev;
        });
      }

      // Auto-fill additional addresses from GSTZen
      if (data.additionalAddresses?.length) {
        const newAddrs: AddressEntry[] = data.additionalAddresses.map(aa => {
          let stateId = 0;
          if (data.stateName) {
            const match = allStates.find(s => s.stateName.toLowerCase() === data.stateName!.toLowerCase());
            if (match) stateId = match.id;
          }
          return {
            ...newAddress('Shipping', indiaId),
            addressLine1: aa.addressLine1 || '',
            addressLine2: aa.addressLine2 || '',
            city: aa.city || '',
            pincode: aa.pincode || '',
            stateId,
          };
        });
        setAddresses(prev => [...prev, ...newAddrs]);
      }
    } catch (e: any) {
      setError(e?.message ?? 'GST verification failed');
    } finally {
      setGstVerifying(false);
    }
  };

  /* ─── Validation ─── */
  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.clientName.trim()) errs.clientName = 'Client name is required';
    if (!form.clientType) errs.clientType = 'Client type is required';

    for (const addr of addresses) {
      if (addr.addressLine1 && !addr.addressType) {
        errs[`addr_${addr.key}_type`] = 'Address type is required';
      }
      if (addr.addressType && !addr.addressLine1) {
        errs[`addr_${addr.key}_line1`] = 'Address line 1 is required';
      }
    }

    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  /* ─── Submit ─── */
  const handleSubmit = async (confirmDuplicate = false) => {
    if (!validate()) return;
    setSaving(true);
    setError(null);

    const body: Record<string, unknown> = {
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
      tradeName: form.tradeName.trim() || undefined,
      gstType: form.gstType.trim() || undefined,
      gstRegistrationDate: form.gstRegistrationDate || undefined,
      companyStatus: form.companyStatus.trim() || undefined,
      gstVerified,
      confirmDuplicate,
    };

    // Build addresses array
    const validAddrs = addresses.filter(a => a.addressLine1.trim());
    if (validAddrs.length > 0) {
      body.addresses = validAddrs.map(a => ({
        addressType: a.addressType,
        addressLine1: a.addressLine1,
        addressLine2: a.addressLine2,
        city: a.city,
        stateId: a.stateId || undefined,
        countryId: a.countryId || undefined,
        pincode: a.pincode,
        isDefault: a.isDefaultBilling || a.isDefaultShipping,
      }));
    }

    try {
      const res = await clientsApi.createClient(body);
      if ((res as any).potentialDuplicates?.length > 0 && !confirmDuplicate) {
        setDuplicates((res as any).potentialDuplicates);
        setSaving(false);
        return;
      }

      const newId = (res as any).id || (res as any).data?.id;
      setCreatedClientId(newId);
      setCreatedClientName(form.clientName);
      setShowAddContactModal(true);
    } catch (e: any) {
      const parsed = e?.message ? e.message : 'Failed to create client';
      if (parsed.includes('Potential duplicates')) {
        try {
          const errBody = JSON.parse(e.message);
          if (errBody.potentialDuplicates) { setDuplicates(errBody.potentialDuplicates); setSaving(false); return; }
        } catch { /* ignore */ }
      }
      setError(parsed);
    } finally {
      setSaving(false);
    }
  };

  /* ─── Render: Address Card ─── */
  const renderAddressCard = (addr: AddressEntry, idx: number) => {
    const states = statesForCountry(addr.countryId);
    const prefix = `addr_${addr.key}_`;
    return (
      <div key={addr.key} className="card border mb-3">
        <div className="card-header bg-light py-2 d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center gap-2">
            <i className={`ti ${addr.addressType === 'Billing' ? 'ti-file-invoice' : addr.addressType === 'Shipping' ? 'ti-truck' : 'ti-building'} text-primary`} />
            <select
              className={`form-select form-select-sm ${fieldErrors[prefix + 'type'] ? 'is-invalid' : ''}`}
              value={addr.addressType}
              onChange={e => updateAddress(addr.key, 'addressType', e.target.value)}
              style={{ width: 140 }}
            >
              <option value="">Type...</option>
              {ADDRESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="text-muted small">#{idx + 1}</span>
          </div>
          <div className="d-flex align-items-center gap-2">
            {addr.addressType === 'Billing' && (
              <div className="form-check form-check-sm mb-0">
                <input className="form-check-input" type="checkbox" checked={addr.isDefaultBilling}
                  onChange={e => updateAddress(addr.key, 'isDefaultBilling', e.target.checked)} id={`defBill_${addr.key}`} />
                <label className="form-check-label small text-muted" htmlFor={`defBill_${addr.key}`}>Default Billing</label>
              </div>
            )}
            {addr.addressType === 'Shipping' && (
              <div className="form-check form-check-sm mb-0">
                <input className="form-check-input" type="checkbox" checked={addr.isDefaultShipping}
                  onChange={e => updateAddress(addr.key, 'isDefaultShipping', e.target.checked)} id={`defShip_${addr.key}`} />
                <label className="form-check-label small text-muted" htmlFor={`defShip_${addr.key}`}>Default Shipping</label>
              </div>
            )}
            {addresses.length > 1 && (
              <button type="button" className="btn btn-sm btn-outline-danger px-2 py-0"
                onClick={() => removeAddress(addr.key)} title="Remove address">
                <i className="ti ti-trash" style={{ fontSize: '0.85rem' }} />
              </button>
            )}
          </div>
        </div>
        <div className="card-body py-3">
          <div className="row g-2">
            <div className="col-12">
              <label className="form-label small mb-1">Address Line 1 <span className="text-danger">*</span></label>
              <input type="text" className={`form-control form-control-sm ${fieldErrors[prefix + 'line1'] ? 'is-invalid' : ''}`}
                value={addr.addressLine1} onChange={e => updateAddress(addr.key, 'addressLine1', e.target.value)} maxLength={300} />
              {fieldErrors[prefix + 'line1'] && <div className="invalid-feedback">{fieldErrors[prefix + 'line1']}</div>}
            </div>
            <div className="col-12">
              <label className="form-label small mb-1">Address Line 2</label>
              <input type="text" className="form-control form-control-sm"
                value={addr.addressLine2} onChange={e => updateAddress(addr.key, 'addressLine2', e.target.value)} maxLength={300} />
            </div>
            <div className="col-md-3">
              <label className="form-label small mb-1">City</label>
              <input type="text" className="form-control form-control-sm"
                value={addr.city} onChange={e => updateAddress(addr.key, 'city', e.target.value)} maxLength={100} />
            </div>
            <div className="col-md-3">
              <label className="form-label small mb-1">Country</label>
              <select className="form-select form-select-sm" value={addr.countryId}
                onChange={e => updateAddress(addr.key, 'countryId', Number(e.target.value) || 0)}>
                <option value="0">Select country...</option>
                {countries.map(c => (
                  <option key={c.id} value={c.id}>
                    {countryCodeToFlag(c.countryCode)} {c.countryName}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small mb-1">State</label>
              <select className="form-select form-select-sm" value={addr.stateId}
                onChange={e => updateAddress(addr.key, 'stateId', Number(e.target.value) || 0)}>
                <option value="0">Select state...</option>
                {states.map(s => <option key={s.id} value={s.id}>{s.stateName}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label small mb-1">Pincode</label>
              <input type="text" className="form-control form-control-sm"
                value={addr.pincode} onChange={e => updateAddress(addr.key, 'pincode', e.target.value)} maxLength={10} />
            </div>
          </div>
        </div>
      </div>
    );
  };

  const hasBilling = addresses.some(a => a.addressType === 'Billing' && a.addressLine1.trim());

  return (
    <div className="container-fluid py-4" style={{ maxWidth: 1100 }}>
      {/* Page Header */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div className="d-flex align-items-center">
          <button className="btn btn-outline-secondary btn-sm me-3" onClick={() => navigate('/clients')}>
            <i className="ti ti-arrow-left me-1" /> Back
          </button>
          <div>
            <h4 className="mb-0 fw-bold"><i className="ti ti-building-store me-2 text-primary" />New Client</h4>
            <p className="text-muted mb-0 small">Enter GST Number to auto-fill, or fill details manually.</p>
          </div>
        </div>
        <button className="btn btn-success btn-sm px-4" onClick={() => handleSubmit(false)} disabled={saving}>
          {saving ? <><span className="spinner-border spinner-border-sm me-1" />Saving...</> : <><i className="ti ti-check me-1" />Create Client</>}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show d-flex align-items-start">
          <i className="ti ti-alert-circle me-2 mt-1" /><div className="flex-grow-1">{error}</div>
          <button type="button" className="btn-close" onClick={() => setError(null)} />
        </div>
      )}

      {/* ═══════════ SECTION 1: GST VERIFICATION ═══════════ */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-primary bg-opacity-10 border-bottom-0 py-3">
          <h6 className="mb-0 fw-semibold text-primary">
            <i className="ti ti-shield-check me-2" />GST Verification
          </h6>
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
                style={{ letterSpacing: '2px', fontFamily: 'monospace', fontSize: '1rem' }}
              />
            </div>
            <div className="col-auto">
              <button type="button" className="btn btn-primary" onClick={handleVerifyGst}
                disabled={gstVerifying || form.gstNumber.trim().length < 15}>
                {gstVerifying
                  ? <><span className="spinner-border spinner-border-sm me-2" />Verifying...</>
                  : <><i className="ti ti-shield-check me-2" />Verify &amp; Auto-fill</>}
              </button>
            </div>
            {gstResult?.valid && (
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
                <i className="ti ti-info-circle me-1" />
                Details have been auto-filled below. Please review before saving.
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
                value={form.clientName} onChange={e => setField('clientName', e.target.value)} maxLength={200} />
              {fieldErrors.clientName && <div className="invalid-feedback">{fieldErrors.clientName}</div>}
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold">Trade / Display Name</label>
              <input type="text" className="form-control form-control-sm"
                value={form.clientDisplayName} onChange={e => setField('clientDisplayName', e.target.value)} maxLength={200}
                placeholder="Optional display name" />
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Client Type <span className="text-danger">*</span></label>
              <select className={`form-select form-select-sm ${fieldErrors.clientType ? 'is-invalid' : ''}`}
                value={form.clientType} onChange={e => setField('clientType', e.target.value)}>
                <option value="">Select type...</option>
                {CLIENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              {fieldErrors.clientType && <div className="invalid-feedback">{fieldErrors.clientType}</div>}
            </div>
            <div className="col-md-4">
              <label className="form-label small fw-semibold">Industry</label>
              <select className="form-select form-select-sm" value={form.industryId}
                onChange={e => setField('industryId', Number(e.target.value) || 0)}>
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
                placeholder="e.g. Active, Inactive" />
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
                placeholder="AAAAA9999A" style={{ letterSpacing: '1px', fontFamily: 'monospace' }} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">IEC Code</label>
              <input type="text" className="form-control form-control-sm"
                value={form.iecCode} onChange={e => setField('iecCode', e.target.value)} maxLength={30} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">MSME Number</label>
              <input type="text" className="form-control form-control-sm"
                value={form.msmeNumber} onChange={e => setField('msmeNumber', e.target.value)} maxLength={30} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">GST Type</label>
              <input type="text" className="form-control form-control-sm"
                value={form.gstType} onChange={e => setField('gstType', e.target.value)} maxLength={50}
                placeholder="e.g. Regular, Composition" />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">GST Registration Date</label>
              <input type="date" className="form-control form-control-sm"
                value={form.gstRegistrationDate} onChange={e => setField('gstRegistrationDate', e.target.value)} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Currency</label>
              <input type="text" className="form-control form-control-sm"
                value={form.currencyCode} onChange={e => setField('currencyCode', e.target.value.toUpperCase())} maxLength={10} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Credit Limit</label>
              <input type="number" className="form-control form-control-sm"
                value={form.creditLimit} onChange={e => setField('creditLimit', Number(e.target.value) || 0)} min={0} step={0.01} />
            </div>
            <div className="col-md-3">
              <label className="form-label small fw-semibold">Credit Days</label>
              <input type="number" className="form-control form-control-sm"
                value={form.creditDays} onChange={e => setField('creditDays', Number(e.target.value) || 0)} min={0} />
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ SECTION 4: ADDRESSES ═══════════ */}
      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-transparent border-bottom py-3 d-flex align-items-center justify-content-between">
          <h6 className="mb-0 fw-semibold"><i className="ti ti-map-pin me-2 text-primary" />Addresses</h6>
          <div className="d-flex gap-2">
            {hasBilling && (
              <button type="button" className="btn btn-outline-info btn-sm" onClick={copyBillingToShipping}>
                <i className="ti ti-copy me-1" />Same as Billing
              </button>
            )}
            <div className="btn-group btn-group-sm">
              <button type="button" className="btn btn-outline-primary" onClick={() => addAddress('Billing')}>
                <i className="ti ti-plus me-1" />Billing
              </button>
              <button type="button" className="btn btn-outline-primary" onClick={() => addAddress('Shipping')}>
                <i className="ti ti-plus me-1" />Shipping
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={() => addAddress('Other')}>
                <i className="ti ti-plus me-1" />Other
              </button>
            </div>
          </div>
        </div>
        <div className="card-body">
          {addresses.length === 0 && (
            <div className="text-center text-muted py-4">
              <i className="ti ti-map-pin-off fs-1 d-block mb-2" />
              <div className="small">No addresses added yet. Click the buttons above to add one.</div>
            </div>
          )}
          {addresses.map((addr, idx) => renderAddressCard(addr, idx))}
        </div>
      </div>

      {/* ═══════════ SUBMIT ═══════════ */}
      <div className="d-flex justify-content-between align-items-center">
        <button className="btn btn-outline-secondary" onClick={() => navigate('/clients')}>
          <i className="ti ti-x me-1" />Cancel
        </button>
        <button className="btn btn-success px-5" onClick={() => handleSubmit(false)} disabled={saving}>
          {saving ? <><span className="spinner-border spinner-border-sm me-2" />Creating...</> : <><i className="ti ti-check me-2" />Create Client</>}
        </button>
      </div>

      {/* ═══════════ DUPLICATE WARNING MODAL ═══════════ */}
      {duplicates && (
        <DuplicateWarningModal
          duplicates={duplicates}
          onConfirm={() => { setDuplicates(null); handleSubmit(true); }}
          onCancel={() => setDuplicates(null)}
          saving={saving}
        />
      )}

      {/* ═══════════ POST-CREATION: ADD CONTACT MODAL ═══════════ */}
      {showAddContactModal && createdClientId && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg">
              <div className="modal-body text-center py-5">
                <div className="rounded-circle bg-success bg-opacity-10 d-inline-flex align-items-center justify-content-center mb-3"
                  style={{ width: 64, height: 64 }}>
                  <i className="ti ti-circle-check fs-1 text-success" />
                </div>
                <h5 className="fw-bold mb-2">Client Created Successfully!</h5>
                <p className="text-muted mb-4">
                  <strong>{createdClientName}</strong> has been added to the system.<br />
                  Would you like to add contacts for this client now?
                </p>
                <div className="d-flex justify-content-center gap-3">
                  <button className="btn btn-outline-secondary px-4"
                    onClick={() => navigate(`/clients/${createdClientId}`)}>
                    <i className="ti ti-eye me-1" />View Client
                  </button>
                  <button className="btn btn-primary px-4"
                    onClick={() => navigate(`/clients/${createdClientId}/edit?addContact=1`)}>
                    <i className="ti ti-user-plus me-1" />Add Contacts
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
