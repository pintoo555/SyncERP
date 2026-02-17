import { useEffect, useState, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { INDIAN_STATES, getCitiesForState, GENDER_OPTIONS } from '../../../data/indianStatesCities';
import {
  validateIndianPhone,
  normalizeIndianPhone,
  validatePincode,
  normalizePincode,
  validatePAN,
  normalizePAN,
  validateAadhar,
  normalizeAadhar,
  validateWhatsAppNumber,
  normalizeWhatsAppNumber,
} from '../../../utils/hrmsValidations';

interface Department {
  departmentId: number;
  departmentName: string;
}

interface Designation {
  designationId: number;
  designationType: string;
}

interface ContactNumber {
  id: number;
  type: 'extension' | 'voip';
  number: string;
}

interface ProfileData {
  user: { userId: number; name: string; username?: string | null; email: string; departmentId: number | null; departmentName: string | null };
  profile: {
    designationId: number | null;
    employeeCode: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    phone: string | null;
    mobile: string | null;
    whatsAppNumber: string | null;
    whatsAppVerifiedAt: string | null;
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    joinDate: string | null;
    pan: string | null;
    aadhar: string | null;
    emergencyContact: string | null;
    emergencyPhone: string | null;
    internalEmail: string | null;
  } | null;
  designationName: string | null;
  family: { id: number; relation: string; fullName: string; dateOfBirth: string | null; contact: string | null; isDependent: boolean }[];
  bank: { bankName: string | null; accountNumber: string | null; ifsc: string | null; branch: string | null; accountType: string | null } | null;
  contactNumbers: ContactNumber[];
}

function Avatar({ userId, name }: { userId: number; name: string }) {
  const src = `/user-photos/${userId}.jpg`;
  return (
    <img
      src={src}
      alt={name}
      width={80}
      height={80}
      className="rounded-circle flex-shrink-0 shadow-sm"
      style={{ objectFit: 'cover' }}
      onError={(e) => {
        (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><circle fill="%231ab394" cx="40" cy="40" r="40"/><circle fill="%23fff" cx="40" cy="32" r="14"/><path fill="%23fff" d="M40 50c-12 0-22 6-28 14v6h56v-6c-6-8-16-14-28-14z"/></svg>';
      }}
    />
  );
}

export default function HRMSProfile() {
  const { user } = useAuth();
  const userId = user?.userId;
  const [data, setData] = useState<ProfileData | null>(null);
  const [_departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [name, setName] = useState('');
  const [profileForm, setProfileForm] = useState<Record<string, string>>({});
  const [bankForm, setBankForm] = useState<Record<string, string>>({});

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [whatsAppNumber, setWhatsAppNumber] = useState('');
  const [whatsAppPhoneForVerify, setWhatsAppPhoneForVerify] = useState('');
  const [whatsAppOtpCode, setWhatsAppOtpCode] = useState('');
  const [whatsAppOtpSent, setWhatsAppOtpSent] = useState(false);
  const [whatsAppSending, setWhatsAppSending] = useState(false);
  const [whatsAppVerifying, setWhatsAppVerifying] = useState(false);
  const [whatsAppError, setWhatsAppError] = useState<string | null>(null);
  const [whatsAppEditing, setWhatsAppEditing] = useState(false);
  const [whatsAppRemoving, setWhatsAppRemoving] = useState(false);

  const [internalEmail, setInternalEmail] = useState('');
  const [internalEmailPassword, setInternalEmailPassword] = useState('');

  const load = useCallback(() => {
    if (userId == null) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg(null);
    Promise.all([
      api.get<{ success: boolean; user: ProfileData['user']; profile: ProfileData['profile']; designationName: string | null; family: ProfileData['family']; bank: ProfileData['bank'] }>(`/api/hrms/employees/${userId}`),
      api.get<{ success: boolean; data: Department[] }>('/api/hrms/departments'),
      api.get<{ success: boolean; data: Designation[] }>('/api/hrms/designations'),
    ])
      .then(([emp, depts, desigs]) => {
        const d = {
          user: emp.user,
          profile: emp.profile,
          designationName: emp.designationName,
          family: emp.family ?? [],
          bank: emp.bank,
          contactNumbers: (emp as { contactNumbers?: ContactNumber[] }).contactNumbers ?? [],
        };
        setData(d);
        setName(d.user.name);
        const profile = d.profile as { whatsAppNumber?: string; whatsAppVerifiedAt?: string } | null;
        setWhatsAppNumber(profile?.whatsAppNumber ?? '');
        setWhatsAppOtpSent(false);
        setWhatsAppPhoneForVerify('');
        setWhatsAppOtpCode('');
        setWhatsAppError(null);
        setWhatsAppEditing(false);
        setProfileForm({
          designationId: d.profile?.designationId != null ? String(d.profile.designationId) : '',
          employeeCode: d.profile?.employeeCode ?? (userId != null ? 'SYNC' + String(userId).padStart(2, '0') : ''),
          dateOfBirth: d.profile?.dateOfBirth ?? '',
          gender: d.profile?.gender ?? '',
          phone: d.profile?.phone ?? '',
          mobile: d.profile?.mobile ?? '',
          addressLine1: d.profile?.addressLine1 ?? '',
          addressLine2: d.profile?.addressLine2 ?? '',
          city: d.profile?.city ?? '',
          state: d.profile?.state ?? '',
          pincode: d.profile?.pincode ?? '',
          joinDate: d.profile?.joinDate ?? '',
          pan: d.profile?.pan ?? '',
          aadhar: d.profile?.aadhar ?? '',
          emergencyContact: d.profile?.emergencyContact ?? '',
          emergencyPhone: d.profile?.emergencyPhone ?? '',
        });
        setBankForm({
          bankName: d.bank?.bankName ?? '',
          accountNumber: d.bank?.accountNumber ?? '',
          ifsc: d.bank?.ifsc ?? '',
          branch: d.bank?.branch ?? '',
          accountType: d.bank?.accountType ?? '',
        });
        const profileWithInternal = d.profile as { internalEmail?: string | null } | null;
        setInternalEmail(profileWithInternal?.internalEmail ?? '');
        setInternalEmailPassword('');
        setDepartments(depts.data ?? []);
        setDesignations(desigs.data ?? []);
      })
      .catch((e) => {
        setData(null);
        setMsg({ type: 'error', text: e?.message ?? 'Failed to load profile. Ensure HRMS migration (011_hrms.sql) has been run.' });
      })
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const profileCities = useMemo(() => getCitiesForState(profileForm.state), [profileForm.state]);

  const handleSaveProfile = () => {
    if (userId == null) return;
    const phoneRes = validateIndianPhone(profileForm.phone);
    const mobileRes = validateIndianPhone(profileForm.mobile);
    const pincodeRes = validatePincode(profileForm.pincode);
    const panRes = validatePAN(profileForm.pan);
    const aadharRes = validateAadhar(profileForm.aadhar);
    const emergencyPhoneRes = validateIndianPhone(profileForm.emergencyPhone);
    const errs: string[] = [];
    if (!phoneRes.valid) errs.push('Phone: ' + (phoneRes.message ?? 'Invalid'));
    if (!mobileRes.valid) errs.push('Mobile: ' + (mobileRes.message ?? 'Invalid'));
    if (!pincodeRes.valid) errs.push('Pincode: ' + (pincodeRes.message ?? 'Invalid'));
    if (!panRes.valid) errs.push('PAN: ' + (panRes.message ?? 'Invalid'));
    if (!aadharRes.valid) errs.push('Aadhar: ' + (aadharRes.message ?? 'Invalid'));
    if (!emergencyPhoneRes.valid) errs.push('Emergency phone: ' + (emergencyPhoneRes.message ?? 'Invalid'));
    if (errs.length > 0) {
      setMsg({ type: 'error', text: errs.join('. ') });
      return;
    }
    setSaving(true);
    setMsg(null);
    const payload: Record<string, unknown> = { name: name.trim() };
    Object.entries(profileForm).forEach(([k, v]) => {
      if (k === 'employeeCode') return;
      const val = typeof v === 'string' ? v.trim() : v;
      if (k === 'phone' || k === 'mobile' || k === 'emergencyPhone') payload[k] = normalizeIndianPhone(val) || null;
      else if (k === 'pincode') payload[k] = normalizePincode(val) || null;
      else if (k === 'pan') payload[k] = normalizePAN(val) || null;
      else if (k === 'aadhar') payload[k] = normalizeAadhar(val) || null;
      else payload[k] = val || null;
    });
    if (payload.designationId !== null && payload.designationId !== '') payload.designationId = Number(payload.designationId) || null;
    else payload.designationId = null;
    payload.internalEmail = internalEmail.trim() || null;
    if (internalEmailPassword.trim()) payload.internalEmailPassword = internalEmailPassword;
    api.put(`/api/hrms/employees/${userId}/profile`, payload)
      .then(() => {
        setMsg({ type: 'success', text: 'Profile saved successfully.' });
        load();
      })
      .catch((e) => setMsg({ type: 'error', text: e?.message ?? 'Failed to save' }))
      .finally(() => setSaving(false));
  };

  const handleSaveBank = () => {
    if (userId == null) return;
    setSaving(true);
    setMsg(null);
    api.put(`/api/hrms/employees/${userId}/bank`, {
      ...Object.fromEntries(Object.entries(bankForm).map(([k, v]) => [k, v.trim() || null])),
    })
      .then(() => {
        setMsg({ type: 'success', text: 'Bank details saved successfully.' });
        load();
      })
      .catch((e) => setMsg({ type: 'error', text: e?.message ?? 'Failed to save' }))
      .finally(() => setSaving(false));
  };

  const handleChangePassword = () => {
    if (!newPassword || newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New password and confirm do not match.' });
      return;
    }
    setPasswordSaving(true);
    setPasswordMsg(null);
    api.post('/api/auth/change-password', { currentPassword, newPassword })
      .then(() => {
        setPasswordMsg({ type: 'success', text: 'Password changed successfully.' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      })
      .catch((e) => setPasswordMsg({ type: 'error', text: e?.message ?? 'Failed to change password' }))
      .finally(() => setPasswordSaving(false));
  };

  if (!userId) return <div className="container-fluid p-4">Please log in.</div>;
  if (loading) {
    return (
      <div className="container-fluid p-4">
        <div className="d-flex align-items-center gap-2 text-muted">
          <span className="spinner-border spinner-border-sm" />
          <span>Loading your profile…</span>
        </div>
      </div>
    );
  }
  if (!data) return <div className="container-fluid p-4">Failed to load profile.</div>;

  const empCode = profileForm.employeeCode || (userId != null ? 'SYNC' + String(userId).padStart(2, '0') : '');
  const profile = data.profile as { whatsAppNumber?: string; whatsAppVerifiedAt?: string } | null;
  const showWhatsAppVerified = !!profile?.whatsAppVerifiedAt && !whatsAppOtpSent;
  const showVerifiedBadge = showWhatsAppVerified && !whatsAppEditing;

  return (
    <div className="container-fluid">
      {/* Breadcrumb */}
      <div className="row">
        <div className="col-12">
          <h2 className="mb-1">My Profile</h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-4">
              <li className="breadcrumb-item"><Link to="/">Home</Link></li>
              <li className="breadcrumb-item"><Link to="/hrms/employees">HRMS</Link></li>
              <li className="breadcrumb-item active" aria-current="page">My Profile</li>
            </ol>
          </nav>
        </div>
      </div>

      {msg && (
        <div className={`alert alert-${msg.type} alert-dismissible fade show`} role="alert">
          <i className={`ti ti-${msg.type === 'success' ? 'circle-check' : 'alert-circle'} me-2`} />
          {msg.text}
          <button type="button" className="btn-close" onClick={() => setMsg(null)} aria-label="Close" />
        </div>
      )}

      {/* Profile header card */}
      <div className="card mb-4 border-0 shadow-sm">
        <div className="card-body p-4">
          <div className="d-flex flex-wrap align-items-center gap-4">
            <Avatar userId={data.user.userId} name={data.user.name} />
            <div className="flex-grow-1">
              <h4 className="mb-1 fw-semibold">{data.user.name}</h4>
              {data.designationName && <p className="text-primary mb-1"><i className="ti ti-briefcase me-1" />{data.designationName}</p>}
              {data.user.departmentName && <p className="text-muted small mb-1"><i className="ti ti-building me-1" />{data.user.departmentName}</p>}
              <div className="d-flex flex-wrap gap-2 mt-2">
                <span className="badge bg-primary-subtle text-primary"><i className="ti ti-id me-1" />{empCode}</span>
                {data.user.email && <span className="badge bg-secondary-subtle text-secondary"><i className="ti ti-mail me-1" />{data.user.email}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Personal & Contact */}
      <div className="card mb-4 shadow-sm">
        <div className="card-header d-flex align-items-center gap-2 py-3">
          <i className="ti ti-user-edit text-primary" style={{ fontSize: '1.25rem' }} />
          <span>Personal &amp; Contact</span>
        </div>
        <div className="card-body">
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label"><i className="ti ti-user me-1 text-muted" />Full Name</label>
              <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
            </div>
            <div className="col-md-6">
              <label className="form-label"><i className="ti ti-mail me-1 text-muted" />Email address</label>
              <div className="input-group">
                <span className="input-group-text"><i className="ti ti-mail" /></span>
                <input type="text" className="form-control" value={data.user.email} disabled readOnly placeholder="Email" />
              </div>
              <small className="text-muted">Email is managed by your administrator</small>
            </div>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-md-3">
              <label className="form-label"><i className="ti ti-briefcase me-1 text-muted" />Designation</label>
              <select className="form-select" value={profileForm.designationId} onChange={(e) => setProfileForm((p) => ({ ...p, designationId: e.target.value }))}>
                <option value="">— Select —</option>
                {designations.map((d) => (
                  <option key={d.designationId} value={String(d.designationId)}>{d.designationType}</option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label"><i className="ti ti-id me-1 text-muted" />Employee Code</label>
              <input type="text" className="form-control-plaintext form-control bg-light rounded" value={empCode} readOnly disabled />
            </div>
            <div className="col-md-3">
              <label className="form-label"><i className="ti ti-calendar me-1 text-muted" />Date of Birth</label>
              <input type="date" className="form-control" value={profileForm.dateOfBirth} onChange={(e) => setProfileForm((p) => ({ ...p, dateOfBirth: e.target.value }))} />
            </div>
            <div className="col-md-3">
              <label className="form-label"><i className="ti ti-gender-bigender me-1 text-muted" />Gender</label>
              <select className="form-select" value={profileForm.gender} onChange={(e) => setProfileForm((p) => ({ ...p, gender: e.target.value }))}>
                <option value="">— Select —</option>
                {GENDER_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
          {data.contactNumbers && data.contactNumbers.length > 0 && (
            <div className="row g-3 mb-3">
              <div className="col-12">
                <label className="form-label"><i className="ti ti-phone-call me-1 text-muted" />Internal Extensions &amp; VOIP Numbers</label>
                <div className="d-flex flex-wrap gap-2">
                  {data.contactNumbers.map((cn) => (
                    <span key={cn.id} className="badge bg-secondary-subtle text-secondary py-2 px-3">
                      {cn.type === 'extension' ? 'Ext' : 'VOIP'}: {cn.number}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label"><i className="ti ti-phone me-1 text-muted" />Phone</label>
              <div className="input-group">
                <span className="input-group-text"><i className="ti ti-phone" /></span>
                <input type="tel" inputMode="numeric" maxLength={10} className="form-control" value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10-digit Indian number" />
              </div>
            </div>
            <div className="col-md-6">
              <label className="form-label"><i className="ti ti-device-mobile me-1 text-muted" />Mobile</label>
              <div className="input-group">
                <span className="input-group-text"><i className="ti ti-device-mobile" /></span>
                <input type="tel" inputMode="numeric" maxLength={10} className="form-control" value={profileForm.mobile} onChange={(e) => setProfileForm((p) => ({ ...p, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10-digit Indian number" />
              </div>
            </div>
          </div>
          <div className="row g-3 mb-3">
            <div className="col-12">
              <label className="form-label"><i className="ti ti-brand-whatsapp me-1 text-success" />WhatsApp Number</label>
              <p className="small text-muted mb-2">Enter country code + 10 digits (e.g. +919876543210 or 9876543210). Verification via OTP required.</p>
              {showVerifiedBadge
                ? <div className="d-flex align-items-center gap-2 flex-wrap">
                    <span className="badge bg-success py-2 px-3">
                      <i className="ti ti-brand-whatsapp me-1" />{profile?.whatsAppNumber}
                    </span>
                    <span className="badge bg-success-subtle text-success"><i className="ti ti-badge-check me-1" />Verified</span>
                    <button type="button" className="btn btn-link btn-sm p-0" onClick={() => {
                      setWhatsAppEditing(true);
                      setWhatsAppNumber(profile?.whatsAppNumber ?? '');
                      setWhatsAppOtpSent(false);
                      setWhatsAppOtpCode('');
                      setWhatsAppPhoneForVerify('');
                      setWhatsAppError(null);
                      setMsg(null);
                    }}>Change number</button>
                    <button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={() => {
                      if (!window.confirm('Remove this WhatsApp number? You can add and verify a new one later.')) return;
                      setWhatsAppRemoving(true);
                      api.delete('/api/hrms/whatsapp')
                        .then(() => { setMsg({ type: 'success', text: 'WhatsApp number removed' }); load(); })
                        .catch((e) => setMsg({ type: 'error', text: (e as Error)?.message ?? 'Failed to remove' }))
                        .finally(() => setWhatsAppRemoving(false));
                    }} disabled={whatsAppRemoving}>
                      {whatsAppRemoving ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                      Remove number
                    </button>
                  </div>
                : <div>
                    <div className="d-flex flex-wrap gap-2 align-items-end">
                      <div className="flex-grow-1" style={{ minWidth: 200 }}>
                        <input type="tel" className="form-control" value={whatsAppNumber} onChange={(e) => { setWhatsAppNumber(e.target.value); setWhatsAppOtpSent(false); setWhatsAppError(null); }} placeholder="+919876543210 or 9876543210" maxLength={20} />
                      </div>
                      {!whatsAppOtpSent
                        ? <>
                            <button type="button" className="btn btn-success" onClick={() => {
                            setWhatsAppError(null);
                            const phoneToSend = normalizeWhatsAppNumber(whatsAppNumber) || whatsAppNumber.trim();
                            if (!phoneToSend) { setWhatsAppError('Please enter your WhatsApp number (e.g. 9876543210 or +919876543210)'); return; }
                            const res = validateWhatsAppNumber(phoneToSend);
                            if (!res.valid) { setWhatsAppError(res.message ?? 'Invalid number'); return; }
                            setWhatsAppOtpSent(true);
                            setWhatsAppPhoneForVerify(phoneToSend);
                            setWhatsAppSending(true);
                            api.post('/api/hrms/whatsapp/send-otp', { phone: phoneToSend })
                              .then(() => { setMsg({ type: 'success', text: 'OTP sent to your WhatsApp' }); setWhatsAppError(null); })
                              .catch((e) => {
                                const errMsg = (e as Error)?.message ?? 'Failed to send OTP';
                                setWhatsAppError(errMsg);
                                setMsg({ type: 'error', text: errMsg });
                                setWhatsAppOtpSent(false);
                              })
                              .finally(() => setWhatsAppSending(false));
                          }} disabled={whatsAppSending}>
                              {whatsAppSending ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                              Send OTP
                            </button>
                            {whatsAppEditing
                              ? <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setWhatsAppEditing(false); setWhatsAppNumber(profile?.whatsAppNumber ?? ''); setWhatsAppOtpSent(false); setWhatsAppError(null); setMsg(null); }}>Cancel</button>
                              : null}
                          </>
                        : <div className="d-flex flex-wrap gap-2 align-items-center">
                            <input type="text" className="form-control" style={{ width: 100 }} value={whatsAppOtpCode} onChange={(e) => { setWhatsAppOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setWhatsAppError(null); setMsg(null); }} placeholder="6-digit OTP" maxLength={6} />
                            <button type="button" className="btn btn-success" onClick={() => {
                              if (!whatsAppOtpCode || whatsAppOtpCode.length < 6) { setMsg({ type: 'error', text: 'Enter 6-digit OTP' }); setWhatsAppError(null); return; }
                              setWhatsAppVerifying(true); setMsg(null); setWhatsAppError(null);
                              const phone = whatsAppPhoneForVerify || normalizeWhatsAppNumber(whatsAppNumber) || whatsAppNumber;
                              api.post('/api/hrms/whatsapp/verify-otp', { phone, code: whatsAppOtpCode })
                                .then(() => { setMsg({ type: 'success', text: 'WhatsApp verified!' }); load(); })
                                .catch(() => {
                                  setWhatsAppError('Incorrect OTP');
                                  setMsg({ type: 'error', text: 'Incorrect OTP' });
                                })
                                .finally(() => setWhatsAppVerifying(false));
                            }} disabled={whatsAppVerifying}>Verify</button>
                            <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => {
                              setWhatsAppError(null); setMsg(null);
                              const phoneToResend = whatsAppPhoneForVerify || normalizeWhatsAppNumber(whatsAppNumber) || whatsAppNumber;
                              if (!phoneToResend) return;
                              setWhatsAppSending(true);
                              api.post('/api/hrms/whatsapp/send-otp', { phone: phoneToResend })
                                .then(() => { setMsg({ type: 'success', text: 'New OTP sent to your WhatsApp' }); setWhatsAppError(null); })
                                .catch((e) => {
                                  const errMsg = (e as Error)?.message ?? 'Failed to send OTP';
                                  setWhatsAppError(errMsg);
                                  setMsg({ type: 'error', text: errMsg });
                                })
                                .finally(() => setWhatsAppSending(false));
                            }} disabled={whatsAppSending}>
                              {whatsAppSending ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                              Resend OTP
                            </button>
                            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setWhatsAppOtpSent(false); setWhatsAppOtpCode(''); setWhatsAppPhoneForVerify(''); setWhatsAppError(null); setMsg(null); }}>Change number</button>
                            {whatsAppEditing
                              ? <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => { setWhatsAppEditing(false); setWhatsAppOtpSent(false); setWhatsAppOtpCode(''); setWhatsAppPhoneForVerify(''); setWhatsAppNumber(profile?.whatsAppNumber ?? ''); setWhatsAppError(null); setMsg(null); }}>Cancel</button>
                              : null}
                          </div>
                      }
                    </div>
                    {whatsAppError
                      ? <div className="alert alert-danger py-2 mt-2 mb-0" role="alert">
                          <i className="ti ti-alert-circle me-1" />{whatsAppError}
                        </div>
                      : null}
                  </div>
              }
            </div>
            <h6 className="mt-4 mb-2 text-muted"><i className="ti ti-mail me-1" />Internal email (HmailServer)</h6>
            <p className="small text-muted mb-2">Email address and password used by the Email module to connect to HmailServer. Leave password blank to keep the current one.</p>
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label">Internal email address</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="ti ti-mail" /></span>
                  <input type="email" className="form-control" value={internalEmail} onChange={(e) => setInternalEmail(e.target.value)} placeholder="user@company.local" />
                </div>
              </div>
              <div className="col-md-6">
                <label className="form-label">Internal email password</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="ti ti-lock" /></span>
                  <input type="password" className="form-control" value={internalEmailPassword} onChange={(e) => setInternalEmailPassword(e.target.value)} placeholder="Leave blank to keep current" autoComplete="new-password" />
                </div>
              </div>
            </div>
          </div>
          <div>
            <h6 className="mt-4 mb-2 text-muted"><i className="ti ti-map-pin me-1" />Address</h6>
            <div className="row g-3 mb-3">
              <div className="col-12">
                <label className="form-label">Address Line 1</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="ti ti-home" /></span>
                  <input type="text" className="form-control" value={profileForm.addressLine1} onChange={(e) => setProfileForm((p) => ({ ...p, addressLine1: e.target.value }))} placeholder="Street, building, floor" />
                </div>
              </div>
              <div className="col-12">
                <label className="form-label">Address Line 2</label>
                <input type="text" className="form-control" value={profileForm.addressLine2} onChange={(e) => setProfileForm((p) => ({ ...p, addressLine2: e.target.value }))} placeholder="Locality, landmark (optional)" />
              </div>
              <div className="col-md-4">
                <label className="form-label">State</label>
                <select className="form-select" value={profileForm.state} onChange={(e) => setProfileForm((p) => ({ ...p, state: e.target.value, city: '' }))}>
                <option value="">— Select state —</option>
                {INDIAN_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">City</label>
                <select className="form-select" value={profileForm.city} onChange={(e) => setProfileForm((p) => ({ ...p, city: e.target.value }))} disabled={!profileForm.state}>
                <option value="">— Select city —</option>
                {profileForm.city && !profileCities.includes(profileForm.city) && (
                  <option value={profileForm.city}>{profileForm.city}</option>
                )}
                {profileCities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label">Pincode</label>
                <input type="text" inputMode="numeric" maxLength={6} className="form-control" value={profileForm.pincode} onChange={(e) => setProfileForm((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} placeholder="6 digits" />
              </div>
            </div>
          </div>
          <h6 className="mt-4 mb-2 text-muted"><i className="ti ti-id-badge me-1" />Employment &amp; ID</h6>
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <label className="form-label"><i className="ti ti-calendar-event me-1 text-muted" />Join Date</label>
              <input type="date" className="form-control" value={profileForm.joinDate} onChange={(e) => setProfileForm((p) => ({ ...p, joinDate: e.target.value }))} />
            </div>
            <div className="col-md-4">
              <label className="form-label"><i className="ti ti-file-certificate me-1 text-muted" />PAN</label>
              <input type="text" className="form-control text-uppercase" maxLength={10} value={profileForm.pan} onChange={(e) => setProfileForm((p) => ({ ...p, pan: e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 10) }))} placeholder="ABCDE1234F" />
            </div>
            <div className="col-md-4">
              <label className="form-label"><i className="ti ti-id me-1 text-muted" />Aadhar</label>
              <input type="text" inputMode="numeric" maxLength={12} className="form-control" value={profileForm.aadhar} onChange={(e) => setProfileForm((p) => ({ ...p, aadhar: e.target.value.replace(/\D/g, '').slice(0, 12) }))} placeholder="12 digits" />
            </div>
          </div>
          <h6 className="mt-4 mb-2 text-muted"><i className="ti ti-emergency-bed me-1" />Emergency Contact</h6>
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label">Contact Name</label>
              <input type="text" className="form-control" value={profileForm.emergencyContact} onChange={(e) => setProfileForm((p) => ({ ...p, emergencyContact: e.target.value }))} placeholder="Name of emergency contact" />
            </div>
            <div className="col-md-6">
              <label className="form-label">Contact Phone</label>
              <div className="input-group">
                <span className="input-group-text"><i className="ti ti-phone" /></span>
                <input type="tel" inputMode="numeric" maxLength={10} className="form-control" value={profileForm.emergencyPhone} onChange={(e) => setProfileForm((p) => ({ ...p, emergencyPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} placeholder="10-digit number" />
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
            {saving ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</> : <><i className="ti ti-device-floppy me-2" />Save profile</>}
          </button>
        </div>
      </div>

      {/* Family members */}
      <div className="card mb-4 shadow-sm">
        <div className="card-header d-flex align-items-center gap-2 py-3">
          <i className="ti ti-users text-primary" style={{ fontSize: '1.25rem' }} />
          <span>Family Members</span>
        </div>
        <div className="card-body">
          {data.family.length === 0 ? (
            <div className="text-center py-4 text-muted">
              <i className="ti ti-users-group d-block mb-2" style={{ fontSize: '2rem' }} />
              <p className="mb-0">No family members added yet.</p>
              <small>Add or edit family details via the full employee view (HR access).</small>
            </div>
          ) : (
            <div className="list-group list-group-flush">
              {data.family.map((f) => (
                <div key={f.id} className="list-group-item d-flex align-items-center gap-3">
                  <span className="badge bg-primary-subtle text-primary">{f.relation}</span>
                  <div>
                    <strong>{f.fullName}</strong>
                    {f.dateOfBirth && <span className="text-muted ms-2">(DOB: {f.dateOfBirth})</span>}
                    {f.contact && <span className="d-block small text-muted"><i className="ti ti-phone me-1" />{f.contact}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bank */}
      <div className="card mb-4 shadow-sm">
        <div className="card-header d-flex align-items-center gap-2 py-3">
          <i className="ti ti-building-bank text-primary" style={{ fontSize: '1.25rem' }} />
          <span>Bank Details (Primary)</span>
        </div>
        <div className="card-body">
          <p className="text-muted small mb-3">Add your primary bank account for salary credits.</p>
          <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label"><i className="ti ti-building-bank me-1 text-muted" />Bank Name</label>
              <div className="input-group">
                <span className="input-group-text"><i className="ti ti-building-bank" /></span>
                <input type="text" className="form-control" value={bankForm.bankName} onChange={(e) => setBankForm((p) => ({ ...p, bankName: e.target.value }))} placeholder="e.g. State Bank of India" />
              </div>
            </div>
            <div className="col-md-6">
              <label className="form-label"><i className="ti ti-credit-card me-1 text-muted" />Account Number</label>
              <div className="input-group">
                <span className="input-group-text"><i className="ti ti-credit-card" /></span>
                <input type="text" className="form-control" value={bankForm.accountNumber} onChange={(e) => setBankForm((p) => ({ ...p, accountNumber: e.target.value }))} placeholder="Account number" />
              </div>
            </div>
            <div className="col-md-4">
              <label className="form-label"><i className="ti ti-building me-1 text-muted" />IFSC Code</label>
              <input type="text" className="form-control" value={bankForm.ifsc} onChange={(e) => setBankForm((p) => ({ ...p, ifsc: e.target.value }))} placeholder="e.g. SBIN0001234" />
            </div>
            <div className="col-md-4">
              <label className="form-label"><i className="ti ti-map-pin me-1 text-muted" />Branch</label>
              <input type="text" className="form-control" value={bankForm.branch} onChange={(e) => setBankForm((p) => ({ ...p, branch: e.target.value }))} placeholder="Branch name" />
            </div>
            <div className="col-md-4">
              <label className="form-label"><i className="ti ti-wallet me-1 text-muted" />Account Type</label>
              <input type="text" className="form-control" value={bankForm.accountType} onChange={(e) => setBankForm((p) => ({ ...p, accountType: e.target.value }))} placeholder="e.g. Savings, Current" />
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={handleSaveBank} disabled={saving}>
            {saving ? <><span className="spinner-border spinner-border-sm me-2" />Saving…</> : <><i className="ti ti-device-floppy me-2" />Save bank details</>}
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="card shadow-sm">
        <div className="card-header d-flex align-items-center gap-2 py-3">
          <i className="ti ti-lock text-primary" style={{ fontSize: '1.25rem' }} />
          <span>Change Password</span>
        </div>
        <div className="card-body">
          {passwordMsg && (
            <div className={`alert alert-${passwordMsg.type} alert-dismissible fade show`} role="alert">
              <i className={`ti ti-${passwordMsg.type === 'success' ? 'circle-check' : 'alert-circle'} me-2`} />
              {passwordMsg.text}
              <button type="button" className="btn-close" onClick={() => setPasswordMsg(null)} aria-label="Close" />
            </div>
          )}
          <p className="text-muted small mb-3">Use a strong password with at least 6 characters.</p>
          <div className="row g-3 mb-3">
            <div className="col-md-4">
              <label className="form-label"><i className="ti ti-lock me-1 text-muted" />Current password</label>
              <div className="input-group">
                <span className="input-group-text"><i className="ti ti-lock" /></span>
                <input type="password" className="form-control" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" placeholder="Current password" />
              </div>
            </div>
            <div className="col-md-4">
              <label className="form-label"><i className="ti ti-key me-1 text-muted" />New password</label>
              <div className="input-group">
                <span className="input-group-text"><i className="ti ti-key" /></span>
                <input type="password" className="form-control" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" placeholder="New password (min 6 chars)" />
              </div>
            </div>
            <div className="col-md-4">
              <label className="form-label"><i className="ti ti-key me-1 text-muted" />Confirm new password</label>
              <div className="input-group">
                <span className="input-group-text"><i className="ti ti-key" /></span>
                <input type="password" className="form-control" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" placeholder="Confirm new password" />
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-primary" onClick={handleChangePassword} disabled={passwordSaving}>
            {passwordSaving ? <><span className="spinner-border spinner-border-sm me-2" />Changing…</> : <><i className="ti ti-lock me-2" />Change password</>}
          </button>
        </div>
      </div>
    </div>
  );
}
