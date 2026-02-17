import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { hrmsApi, type OrgDepartment, type OrgDesignation, type OrgTeam } from '../api/hrmsApi';
import { useAuth } from '../../../hooks/useAuth';
import { INDIAN_STATES, getCitiesForState, GENDER_OPTIONS, FAMILY_RELATIONS } from '../../../data/indianStatesCities';
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

interface ContactNumber {
  id: number;
  employeeUserId: number;
  type: 'extension' | 'voip';
  number: string;
}

interface ProfileData {
  user: { userId: number; name: string; email: string; departmentId: number | null; departmentName: string | null };
  profile: {
    designationId: number | null;
    orgDesignationId: number | null;
    orgDepartmentId: number | null;
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
  } | null;
  designationName: string | null;
  family: { id: number; relation: string; fullName: string; dateOfBirth: string | null; contact: string | null; isDependent: boolean }[];
  bank: { bankName: string | null; accountNumber: string | null; ifsc: string | null; branch: string | null; accountType: string | null } | null;
  contactNumbers: ContactNumber[];
}

type TabKey = 'personal' | 'family' | 'bank' | 'promotion';

export default function HRMSEmployeeDetail() {
  const { userId: paramUserId } = useParams<{ userId: string }>();
  const userId = paramUserId ? parseInt(paramUserId, 10) : null;
  const { user: currentUser } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
  const [designations, setDesignations] = useState<OrgDesignation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>('personal');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [name, setName] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [profileForm, setProfileForm] = useState<Record<string, string>>({});
  const [bankForm, setBankForm] = useState<Record<string, string>>({});

  const [familyRelation, setFamilyRelation] = useState('');
  const [familyFullName, setFamilyFullName] = useState('');
  const [familyDob, setFamilyDob] = useState('');
  const [familyContact, setFamilyContact] = useState('');
  const [familyDependent, setFamilyDependent] = useState(false);
  const [familySaving, setFamilySaving] = useState(false);
  const [editingFamilyId, setEditingFamilyId] = useState<number | null>(null);
  const [newContactType, setNewContactType] = useState<'extension' | 'voip'>('extension');
  const [newContactNumber, setNewContactNumber] = useState('');
  const [editingContactId, setEditingContactId] = useState<number | null>(null);
  const [editingContactValue, setEditingContactValue] = useState('');
  const [contactSaving, setContactSaving] = useState(false);
  const [whatsAppNumber, setWhatsAppNumber] = useState('');
  const [whatsAppPhoneForVerify, setWhatsAppPhoneForVerify] = useState('');
  const [whatsAppOtpCode, setWhatsAppOtpCode] = useState('');
  const [whatsAppOtpSent, setWhatsAppOtpSent] = useState(false);
  const [whatsAppSending, setWhatsAppSending] = useState(false);
  const [whatsAppVerifying, setWhatsAppVerifying] = useState(false);
  const [whatsAppError, setWhatsAppError] = useState<string | null>(null);

  const [promotionHistory, setPromotionHistory] = useState<{ id: number; effectiveDate: string; changeType: string; notes: string | null; createdAt: string }[]>([]);
  const [orgDepartments, setOrgDepartments] = useState<OrgDepartment[]>([]);
  const [orgDesignations, setOrgDesignations] = useState<OrgDesignation[]>([]);
  const [orgTeams, setOrgTeams] = useState<OrgTeam[]>([]);
  const [promoDeptId, setPromoDeptId] = useState<number | ''>('');
  const [promoForm, setPromoForm] = useState({ toOrgDesignationId: '' as number | '', toTeamId: '' as number | '', effectiveDate: '', changeType: 'Promotion' as 'Promotion' | 'Demotion' | 'Transfer', notes: '' });
  const [promoSaving, setPromoSaving] = useState(false);

  const canEdit = currentUser?.userId === userId || (currentUser?.permissions ?? []).includes('HRMS.EDIT');
  const isSelf = currentUser?.userId === userId;
  const canEditHROnlyFields = (currentUser?.permissions ?? []).includes('HRMS.EDIT');

  const loadPromoHistory = useCallback(() => {
    if (userId == null || !Number.isInteger(userId)) return;
    hrmsApi.listPromotionHistory(userId)
      .then((res) => setPromotionHistory((res.data ?? []).map((h) => ({ id: h.id, effectiveDate: h.effectiveDate, changeType: h.changeType, notes: h.notes, createdAt: h.createdAt }))))
      .catch(() => setPromotionHistory([]));
  }, [userId]);

  useEffect(() => {
    hrmsApi.listOrgDepartments().then((r) => setOrgDepartments(r.data ?? [])).catch(() => setOrgDepartments([]));
  }, []);

  useEffect(() => {
    if (tab === 'promotion') loadPromoHistory();
  }, [tab, loadPromoHistory]);

  const load = useCallback(() => {
    if (userId == null || !Number.isInteger(userId)) return;
    setLoading(true);
    api.get<{ success: boolean; user: ProfileData['user']; profile: ProfileData['profile']; designationName: string | null; family: ProfileData['family']; bank: ProfileData['bank'] }>(`/api/hrms/employees/${userId}`)
      .then((emp) => {
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
        const profile = d.profile as { orgDepartmentId?: number | null; orgDesignationId?: number | null } | null;
        const deptId = profile?.orgDepartmentId ?? d.user.departmentId ?? '';
        setDepartmentId(deptId !== '' ? String(deptId) : '');
        setProfileForm({
          designationId: profile?.orgDesignationId != null ? String(profile.orgDesignationId) : '',
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
        const p = d.profile as { whatsAppNumber?: string } | null;
        setWhatsAppNumber(p?.whatsAppNumber ?? '');
        setWhatsAppOtpSent(false);
        setWhatsAppPhoneForVerify('');
        setWhatsAppOtpCode('');
        setWhatsAppError(null);
        const depId = profile?.orgDepartmentId ?? d.user.departmentId;
        if (depId != null) {
          hrmsApi.listOrgDesignations(depId)
            .then((res) => setDesignations(res.data ?? []))
            .catch(() => setDesignations([]));
        } else {
          setDesignations([]);
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (!departmentId) {
      setDesignations([]);
      setProfileForm((p) => ({ ...p, designationId: '' }));
      return;
    }
    hrmsApi.listOrgDesignations(Number(departmentId))
      .then((res) => setDesignations(res.data ?? []))
      .catch(() => setDesignations([]));
  }, [departmentId]);

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
    if (canEdit && departmentId !== '') payload.departmentId = Number(departmentId);
    payload.orgDepartmentId = departmentId ? Number(departmentId) : null;
    payload.orgDesignationId = profileForm.designationId?.trim() ? Number(profileForm.designationId) : null;
    api.put(`/api/hrms/employees/${userId}/profile`, payload)
      .then(() => {
        setMsg({ type: 'success', text: 'Profile saved.' });
        load();
      })
      .catch((e) => setMsg({ type: 'error', text: e?.message ?? 'Failed to save' }))
      .finally(() => setSaving(false));
  };

  const handleAddContactNumber = () => {
    if (userId == null || !newContactNumber.trim()) return;
    setContactSaving(true);
    api.post<{ success: boolean; id: number }>(`/api/hrms/employees/${userId}/contact-numbers`, { type: newContactType, number: newContactNumber.trim() })
      .then(() => { setNewContactNumber(''); load(); })
      .catch((e) => setMsg({ type: 'error', text: e?.message ?? 'Failed to add' }))
      .finally(() => setContactSaving(false));
  };

  const handleUpdateContactNumber = (id: number) => {
    if (userId == null || !editingContactValue.trim()) return;
    setContactSaving(true);
    api.put(`/api/hrms/employees/${userId}/contact-numbers/${id}`, { number: editingContactValue.trim() })
      .then(() => { setEditingContactId(null); setEditingContactValue(''); load(); })
      .catch((e) => setMsg({ type: 'error', text: e?.message ?? 'Failed to update' }))
      .finally(() => setContactSaving(false));
  };

  const handleDeleteContactNumber = (id: number) => {
    if (userId == null || !window.confirm('Remove this number?')) return;
    setContactSaving(true);
    api.delete(`/api/hrms/employees/${userId}/contact-numbers/${id}`)
      .then(() => load())
      .catch((e) => setMsg({ type: 'error', text: e?.message ?? 'Failed to delete' }))
      .finally(() => setContactSaving(false));
  };

  const handleSaveBank = () => {
    if (userId == null) return;
    setSaving(true);
    setMsg(null);
    api.put(`/api/hrms/employees/${userId}/bank`, Object.fromEntries(Object.entries(bankForm).map(([k, v]) => [k, v.trim() || null])))
      .then(() => {
        setMsg({ type: 'success', text: 'Bank details saved.' });
        load();
      })
      .catch((e) => setMsg({ type: 'error', text: e?.message ?? 'Failed to save' }))
      .finally(() => setSaving(false));
  };

  const handleAddFamily = () => {
    if (userId == null || !familyFullName.trim()) return;
    const contactRes = validateIndianPhone(familyContact);
    if (familyContact.trim() && !contactRes.valid) {
      setMsg({ type: 'error', text: 'Family contact: ' + (contactRes.message ?? 'Must be 10 digits') });
      return;
    }
    setFamilySaving(true);
    setMsg(null);
    api.post(`/api/hrms/employees/${userId}/family`, {
      relation: familyRelation.trim(),
      fullName: familyFullName.trim(),
      dateOfBirth: familyDob || undefined,
      contact: familyContact.trim() ? normalizeIndianPhone(familyContact) : undefined,
      isDependent: familyDependent,
    })
      .then(() => {
        setMsg({ type: 'success', text: 'Family member added.' });
        setFamilyRelation('');
        setFamilyFullName('');
        setFamilyDob('');
        setFamilyContact('');
        setFamilyDependent(false);
        load();
      })
      .catch((e) => setMsg({ type: 'error', text: e?.message ?? 'Failed to add' }))
      .finally(() => setFamilySaving(false));
  };

  const handleUpdateFamily = (id: number) => {
    if (userId == null || !familyFullName.trim()) return;
    const contactRes = validateIndianPhone(familyContact);
    if (familyContact.trim() && !contactRes.valid) {
      setMsg({ type: 'error', text: 'Family contact: ' + (contactRes.message ?? 'Must be 10 digits') });
      return;
    }
    setFamilySaving(true);
    setMsg(null);
    api.put(`/api/hrms/employees/${userId}/family/${id}`, {
      relation: familyRelation.trim(),
      fullName: familyFullName.trim(),
      dateOfBirth: familyDob || undefined,
      contact: familyContact.trim() ? normalizeIndianPhone(familyContact) : undefined,
      isDependent: familyDependent,
    })
      .then(() => {
        setMsg({ type: 'success', text: 'Family member updated.' });
        setEditingFamilyId(null);
        setFamilyRelation('');
        setFamilyFullName('');
        setFamilyDob('');
        setFamilyContact('');
        setFamilyDependent(false);
        load();
      })
      .catch((e) => setMsg({ type: 'error', text: e?.message ?? 'Failed to update' }))
      .finally(() => setFamilySaving(false));
  };

  const handleDeleteFamily = (id: number) => {
    if (userId == null || !window.confirm('Remove this family member?')) return;
    setFamilySaving(true);
    setMsg(null);
    api.delete(`/api/hrms/employees/${userId}/family/${id}`)
      .then(() => {
        setMsg({ type: 'success', text: 'Family member removed.' });
        setEditingFamilyId(null);
        load();
      })
      .catch((e) => setMsg({ type: 'error', text: e?.message ?? 'Failed to delete' }))
      .finally(() => setFamilySaving(false));
  };

  const startEditFamily = (f: ProfileData['family'][number]) => {
    setEditingFamilyId(f.id);
    setFamilyRelation(f.relation);
    setFamilyFullName(f.fullName);
    setFamilyDob(f.dateOfBirth ?? '');
    setFamilyContact(f.contact ?? '');
    setFamilyDependent(f.isDependent);
  };

  if (userId == null || !Number.isInteger(userId)) return <div className="container-fluid p-4">Invalid employee.</div>;
  if (loading) return <div className="container-fluid p-4">Loading...</div>;
  if (!data) return <div className="container-fluid p-4">Employee not found.</div>;

  const profile = data.profile as { whatsAppNumber?: string; whatsAppVerifiedAt?: string } | null;
  const otherHasWhatsApp = !!profile?.whatsAppNumber;
  const selfWhatsAppVerified = !!profile?.whatsAppVerifiedAt && !whatsAppOtpSent;
  const canEditWhatsApp = isSelf || canEdit;
  const whatsAppBaseUrl = isSelf ? '/api/hrms/whatsapp' : `/api/hrms/employees/${userId}/whatsapp`;

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center gap-2 mb-4">
        <Link to="/hrms/employees" className="btn btn-sm btn-outline-secondary">← Employees</Link>
        <h4 className="mb-0">{data.user.name} — Employee detail</h4>
      </div>
      {msg && (
        <div className={`alert alert-${msg.type} alert-dismissible fade show`} role="alert">
          {msg.text}
          <button type="button" className="btn-close" onClick={() => setMsg(null)} aria-label="Close" />
        </div>
      )}

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button type="button" className={`nav-link ${tab === 'personal' ? 'active' : ''}`} onClick={() => setTab('personal')}>Personal</button>
        </li>
        <li className="nav-item">
          <button type="button" className={`nav-link ${tab === 'family' ? 'active' : ''}`} onClick={() => setTab('family')}>Family</button>
        </li>
        <li className="nav-item">
          <button type="button" className={`nav-link ${tab === 'bank' ? 'active' : ''}`} onClick={() => setTab('bank')}>Bank</button>
        </li>
        <li className="nav-item">
          <button type="button" className={`nav-link ${tab === 'promotion' ? 'active' : ''}`} onClick={() => setTab('promotion')}>Promotion</button>
        </li>
      </ul>

      {tab === 'personal' && (
        <div className="card">
          <div className="card-body">
            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <label className="form-label small">Name</label>
                <input type="text" className="form-control form-control-sm" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} />
              </div>
              <div className="col-md-6">
                <label className="form-label small">Email</label>
                <input type="text" className="form-control form-control-sm" value={data.user.email} disabled />
              </div>
            </div>
            {canEdit && (
              <div className="row g-2 mb-2">
                <div className="col-md-6">
                  <label className="form-label small">Department</label>
                  <select className="form-select form-select-sm" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                    <option value="">—</option>
                    {orgDepartments.map((d) => (
                      <option key={d.id} value={String(d.id)}>{d.departmentName}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6">
                  <label className="form-label small">Designation</label>
                  <select className="form-select form-select-sm" value={profileForm.designationId} onChange={(e) => setProfileForm((p) => ({ ...p, designationId: e.target.value }))} disabled={!departmentId}>
                    <option value="">{departmentId ? '—' : 'Select department first'}</option>
                    {designations.map((d) => (
                      <option key={d.id} value={String(d.id)}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <div className="row g-2 mb-2">
              <div className="col-md-4">
                <label className="form-label small">Employee Code</label>
                <input type="text" className="form-control form-control-sm bg-light" value={profileForm.employeeCode || (userId != null ? 'SYNC' + String(userId).padStart(2, '0') : '')} readOnly disabled />
              </div>
              <div className="col-md-4">
                <label className="form-label small">Date of Birth</label>
                <input type="date" className="form-control form-control-sm" value={profileForm.dateOfBirth} onChange={(e) => setProfileForm((p) => ({ ...p, dateOfBirth: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="col-md-4">
                <label className="form-label small">Gender</label>
                <select className="form-select form-select-sm" value={profileForm.gender} onChange={(e) => setProfileForm((p) => ({ ...p, gender: e.target.value }))} disabled={!canEdit}>
                  <option value="">—</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <label className="form-label small">Phone (10 digits)</label>
                <input type="tel" inputMode="numeric" maxLength={10} className="form-control form-control-sm" value={profileForm.phone} onChange={(e) => setProfileForm((p) => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} disabled={!canEdit} placeholder="10-digit Indian" />
              </div>
              <div className="col-md-6">
                <label className="form-label small">Mobile (10 digits)</label>
                <input type="tel" inputMode="numeric" maxLength={10} className="form-control form-control-sm" value={profileForm.mobile} onChange={(e) => setProfileForm((p) => ({ ...p, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} disabled={!canEdit} placeholder="10-digit Indian" />
              </div>
            </div>
            <div className="row g-2 mb-2">
              <div className="col-12">
                <label className="form-label small"><i className="ti ti-brand-whatsapp me-1 text-success" />WhatsApp Number</label>
                {canEditWhatsApp
                  ? selfWhatsAppVerified
                    ? <div className="d-flex align-items-center gap-2 flex-wrap">
                        <span className="badge bg-success py-2 px-3">
                          <i className="ti ti-brand-whatsapp me-1" />{profile?.whatsAppNumber}
                        </span>
                        <span className="badge bg-success-subtle text-success"><i className="ti ti-badge-check me-1" />Verified</span>
                        <button type="button" className="btn btn-link btn-sm p-0" onClick={() => { setWhatsAppOtpSent(false); setWhatsAppNumber(profile?.whatsAppNumber ?? ''); }}>Change number</button>
                        <button type="button" className="btn btn-link btn-sm p-0 text-danger" onClick={() => {
                          if (!window.confirm('Remove this WhatsApp number?')) return;
                          api.delete(whatsAppBaseUrl).then(() => { setMsg({ type: 'success', text: 'WhatsApp number removed' }); load(); }).catch((e) => setMsg({ type: 'error', text: e?.message ?? 'Failed to remove' }));
                        }}>Remove number</button>
                      </div>
                    : <div>
                        <div className="d-flex flex-wrap gap-2 align-items-end">
                          <input type="tel" className="form-control form-control-sm" style={{ maxWidth: 220 }} value={whatsAppNumber} onChange={(e) => { setWhatsAppNumber(e.target.value); setWhatsAppOtpSent(false); setWhatsAppError(null); }} placeholder="+919876543210 or 9876543210" maxLength={20} />
                          {!whatsAppOtpSent
                            ? <button type="button" className="btn btn-sm btn-success" onClick={() => {
                                setWhatsAppError(null);
                                const phoneToSend = normalizeWhatsAppNumber(whatsAppNumber) || whatsAppNumber.trim();
                                if (!phoneToSend) { setWhatsAppError('Please enter WhatsApp number (e.g. 9876543210)'); return; }
                                const res = validateWhatsAppNumber(phoneToSend);
                                if (!res.valid) { setWhatsAppError(res.message ?? 'Invalid number'); return; }
                                setWhatsAppOtpSent(true);
                                setWhatsAppPhoneForVerify(phoneToSend);
                                setWhatsAppSending(true);
                                api.post(`${whatsAppBaseUrl}/send-otp`, { phone: phoneToSend })
                                  .then(() => { setMsg({ type: 'success', text: 'OTP sent' }); setWhatsAppError(null); })
                                  .catch((e) => {
                                    const errMsg = (e as Error)?.message ?? 'Failed to send OTP';
                                    setWhatsAppError(errMsg);
                                    setMsg({ type: 'error', text: errMsg });
                                    setWhatsAppOtpSent(false);
                                  })
                                  .finally(() => setWhatsAppSending(false));
                              }} disabled={whatsAppSending}>
                                {whatsAppSending ? <span className="spinner-border spinner-border-sm me-1" /> : null}Send OTP
                              </button>
                            : <div className="d-flex flex-wrap gap-2 align-items-center">
                                <input type="text" className="form-control form-control-sm" style={{ width: 90 }} value={whatsAppOtpCode} onChange={(e) => setWhatsAppOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit OTP" maxLength={6} />
                                <button type="button" className="btn btn-sm btn-success" onClick={() => {
                                  if (!whatsAppOtpCode || whatsAppOtpCode.length < 6) { setMsg({ type: 'error', text: 'Enter 6-digit OTP' }); return; }
                                  setWhatsAppVerifying(true); setMsg(null);
                                  api.post(`${whatsAppBaseUrl}/verify-otp`, { phone: whatsAppPhoneForVerify || normalizeWhatsAppNumber(whatsAppNumber) || whatsAppNumber, code: whatsAppOtpCode })
                                    .then(() => { setMsg({ type: 'success', text: 'WhatsApp verified!' }); load(); })
                                    .catch((e) => setMsg({ type: 'error', text: e?.message ?? 'Verification failed' }))
                                    .finally(() => setWhatsAppVerifying(false));
                                }} disabled={whatsAppVerifying}>Verify</button>
                                <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setWhatsAppOtpSent(false); setWhatsAppOtpCode(''); setWhatsAppPhoneForVerify(''); setWhatsAppError(null); }}>Change number</button>
                              </div>
                          }
                        </div>
                        {whatsAppError
                          ? <div className="alert alert-danger py-2 mt-2 mb-0 small" role="alert">
                              <i className="ti ti-alert-circle me-1" />{whatsAppError}
                            </div>
                          : null}
                      </div>
                  : otherHasWhatsApp
                    ? <div className="d-flex align-items-center gap-2">
                        <span className="badge bg-secondary py-2 px-3">
                          <i className="ti ti-brand-whatsapp me-1" />{profile?.whatsAppNumber}
                        </span>
                        {profile?.whatsAppVerifiedAt
                          ? <span className="badge bg-success-subtle text-success"><i className="ti ti-badge-check me-1" />Verified</span>
                          : null}
                      </div>
                    : <span className="text-muted small">Not set</span>
                }
              </div>
            </div>
            {(canEditHROnlyFields || (data?.contactNumbers?.length ?? 0) > 0) && (
              <div className="row g-2 mb-2">
                <div className="col-12">
                  <label className="form-label small">Internal Extensions &amp; VOIP Numbers</label>
                  {data?.contactNumbers && data.contactNumbers.length > 0 && (
                    <ul className="list-group list-group-flush mb-2">
                      {data.contactNumbers.map((cn) => (
                        <li key={cn.id} className="list-group-item d-flex align-items-center gap-2 px-0 py-1">
                          <span className="badge bg-secondary">{cn.type === 'extension' ? 'Ext' : 'VOIP'}</span>
                          {editingContactId === cn.id ? (
                            <>
                              <input type="text" className="form-control form-control-sm" value={editingContactValue} onChange={(e) => setEditingContactValue(e.target.value)} autoFocus />
                              <button type="button" className="btn btn-sm btn-primary" onClick={() => handleUpdateContactNumber(cn.id)} disabled={contactSaving}>Save</button>
                              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setEditingContactId(null); setEditingContactValue(''); }}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <span>{cn.number}</span>
                              {canEditHROnlyFields && (
                                <>
                                  <button type="button" className="btn btn-sm btn-link p-0" onClick={() => { setEditingContactId(cn.id); setEditingContactValue(cn.number); }}>Edit</button>
                                  <button type="button" className="btn btn-sm btn-link p-0 text-danger" onClick={() => handleDeleteContactNumber(cn.id)} disabled={contactSaving}>Remove</button>
                                </>
                              )}
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {canEditHROnlyFields && (
                    <div className="d-flex gap-2 align-items-end">
                      <select className="form-select form-select-sm" style={{ width: 'auto' }} value={newContactType} onChange={(e) => setNewContactType(e.target.value as 'extension' | 'voip')}>
                        <option value="extension">Extension</option>
                        <option value="voip">VOIP</option>
                      </select>
                      <input type="text" className="form-control form-control-sm" style={{ maxWidth: 180 }} value={newContactNumber} onChange={(e) => setNewContactNumber(e.target.value)} placeholder={newContactType === 'extension' ? 'e.g. 1234' : 'e.g. +91...'} maxLength={50} />
                      <button type="button" className="btn btn-sm btn-primary" onClick={handleAddContactNumber} disabled={contactSaving || !newContactNumber.trim()}>Add</button>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="row g-2 mb-2">
              <div className="col-12">
                <label className="form-label small">Address Line 1</label>
                <input type="text" className="form-control form-control-sm" value={profileForm.addressLine1} onChange={(e) => setProfileForm((p) => ({ ...p, addressLine1: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="col-12">
                <label className="form-label small">Address Line 2</label>
                <input type="text" className="form-control form-control-sm" value={profileForm.addressLine2} onChange={(e) => setProfileForm((p) => ({ ...p, addressLine2: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="col-md-4">
                <label className="form-label small">State</label>
                <select className="form-select form-select-sm" value={profileForm.state} onChange={(e) => setProfileForm((p) => ({ ...p, state: e.target.value, city: '' }))} disabled={!canEdit}>
                  <option value="">—</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label small">City</label>
                <select className="form-select form-select-sm" value={profileForm.city} onChange={(e) => setProfileForm((p) => ({ ...p, city: e.target.value }))} disabled={!canEdit || !profileForm.state}>
                  <option value="">—</option>
                  {profileForm.city && !profileCities.includes(profileForm.city) && (
                    <option value={profileForm.city}>{profileForm.city}</option>
                  )}
                  {profileCities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="col-md-4">
                <label className="form-label small">Pincode (6 digits)</label>
                <input type="text" inputMode="numeric" maxLength={6} className="form-control form-control-sm" value={profileForm.pincode} onChange={(e) => setProfileForm((p) => ({ ...p, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) }))} disabled={!canEdit} placeholder="6 digits" />
              </div>
            </div>
            <div className="row g-2 mb-2">
              <div className="col-md-4">
                <label className="form-label small">Join Date</label>
                <input type="date" className="form-control form-control-sm" value={profileForm.joinDate} onChange={(e) => setProfileForm((p) => ({ ...p, joinDate: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="col-md-4">
                <label className="form-label small">PAN</label>
                <input type="text" className="form-control form-control-sm text-uppercase" maxLength={10} value={profileForm.pan} onChange={(e) => setProfileForm((p) => ({ ...p, pan: e.target.value.toUpperCase().replace(/\s/g, '').slice(0, 10) }))} disabled={!canEdit} placeholder="ABCDE1234F" />
              </div>
              <div className="col-md-4">
                <label className="form-label small">Aadhar (12 digits)</label>
                <input type="text" inputMode="numeric" maxLength={12} className="form-control form-control-sm" value={profileForm.aadhar} onChange={(e) => setProfileForm((p) => ({ ...p, aadhar: e.target.value.replace(/\D/g, '').slice(0, 12) }))} disabled={!canEdit} placeholder="12 digits" />
              </div>
            </div>
            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <label className="form-label small">Emergency Contact (name)</label>
                <input type="text" className="form-control form-control-sm" value={profileForm.emergencyContact} onChange={(e) => setProfileForm((p) => ({ ...p, emergencyContact: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="col-md-6">
                <label className="form-label small">Emergency Phone (10 digits)</label>
                <input type="tel" inputMode="numeric" maxLength={10} className="form-control form-control-sm" value={profileForm.emergencyPhone} onChange={(e) => setProfileForm((p) => ({ ...p, emergencyPhone: e.target.value.replace(/\D/g, '').slice(0, 10) }))} disabled={!canEdit} placeholder="10-digit" />
              </div>
            </div>
            {canEdit && <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveProfile} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>}
          </div>
        </div>
      )}

      {tab === 'family' && (
        <div className="card">
          <div className="card-body">
            {canEdit && (
              <div className="row g-2 mb-4">
                <div className="col-md-2">
                  <label className="form-label small">Relation</label>
                  <select className="form-select form-select-sm" value={familyRelation} onChange={(e) => setFamilyRelation(e.target.value)}>
                    <option value="">—</option>
                    {FAMILY_RELATIONS.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2">
                  <label className="form-label small">Full Name</label>
                  <input type="text" className="form-control form-control-sm" value={familyFullName} onChange={(e) => setFamilyFullName(e.target.value)} />
                </div>
                <div className="col-md-2">
                  <label className="form-label small">DOB</label>
                  <input type="date" className="form-control form-control-sm" value={familyDob} onChange={(e) => setFamilyDob(e.target.value)} />
                </div>
                <div className="col-md-2">
                  <label className="form-label small">Contact (10 digits)</label>
                  <input type="tel" inputMode="numeric" maxLength={10} className="form-control form-control-sm" value={familyContact} onChange={(e) => setFamilyContact(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit" />
                </div>
                <div className="col-md-2 d-flex align-items-end">
                  <div className="form-check">
                    <input type="checkbox" className="form-check-input" checked={familyDependent} onChange={(e) => setFamilyDependent(e.target.checked)} />
                    <label className="form-check-label small">Dependent</label>
                  </div>
                </div>
                <div className="col-md-2 d-flex align-items-end">
                  {editingFamilyId == null ? (
                    <button type="button" className="btn btn-sm btn-primary" onClick={handleAddFamily} disabled={familySaving || !familyFullName.trim()}>Add</button>
                  ) : (
                    <>
                      <button type="button" className="btn btn-sm btn-primary me-1" onClick={() => handleUpdateFamily(editingFamilyId)} disabled={familySaving}>Update</button>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => { setEditingFamilyId(null); setFamilyRelation(''); setFamilyFullName(''); setFamilyDob(''); setFamilyContact(''); setFamilyDependent(false); }}>Cancel</button>
                    </>
                  )}
                </div>
              </div>
            )}
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Relation</th>
                  <th>Full Name</th>
                  <th>DOB</th>
                  <th>Contact</th>
                  <th>Dependent</th>
                  {canEdit && <th></th>}
                </tr>
              </thead>
              <tbody>
                {data.family.length === 0 && <tr><td colSpan={canEdit ? 6 : 5} className="text-muted">No family members.</td></tr>}
                {data.family.map((f) => (
                  <tr key={f.id}>
                    <td>{f.relation}</td>
                    <td>{f.fullName}</td>
                    <td>{f.dateOfBirth ?? '-'}</td>
                    <td>{f.contact ?? '-'}</td>
                    <td>{f.isDependent ? 'Yes' : 'No'}</td>
                    {canEdit && (
                      <td>
                        {editingFamilyId === f.id ? null : (
                          <>
                            <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => startEditFamily(f)}>Edit</button>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteFamily(f.id)} disabled={familySaving}>Delete</button>
                          </>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'bank' && (
        <div className="card">
          <div className="card-body">
            <div className="row g-2 mb-2">
              <div className="col-md-6">
                <label className="form-label small">Bank Name</label>
                <input type="text" className="form-control form-control-sm" value={bankForm.bankName} onChange={(e) => setBankForm((p) => ({ ...p, bankName: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="col-md-6">
                <label className="form-label small">Account Number</label>
                <input type="text" className="form-control form-control-sm" value={bankForm.accountNumber} onChange={(e) => setBankForm((p) => ({ ...p, accountNumber: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="col-md-4">
                <label className="form-label small">IFSC</label>
                <input type="text" className="form-control form-control-sm" value={bankForm.ifsc} onChange={(e) => setBankForm((p) => ({ ...p, ifsc: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="col-md-4">
                <label className="form-label small">Branch</label>
                <input type="text" className="form-control form-control-sm" value={bankForm.branch} onChange={(e) => setBankForm((p) => ({ ...p, branch: e.target.value }))} disabled={!canEdit} />
              </div>
              <div className="col-md-4">
                <label className="form-label small">Account Type</label>
                <input type="text" className="form-control form-control-sm" value={bankForm.accountType} onChange={(e) => setBankForm((p) => ({ ...p, accountType: e.target.value }))} disabled={!canEdit} />
              </div>
            </div>
            {canEdit && <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveBank} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>}
          </div>
        </div>
      )}

      {tab === 'promotion' && (
        <div className="card">
          <div className="card-body">
            {canEditHROnlyFields && (
              <div className="mb-4">
                <h6 className="mb-3">Record promotion / demotion / transfer</h6>
                <div className="row g-2 mb-2">
                  <div className="col-md-6">
                    <label className="form-label small">Department (org)</label>
                    <select className="form-select form-select-sm" value={promoDeptId} onChange={(e) => {
                      const v = e.target.value === '' ? '' : Number(e.target.value);
                      setPromoDeptId(v);
                      if (v !== '') {
                        hrmsApi.listOrgDesignations(v).then((r) => setOrgDesignations(r.data ?? []));
                        hrmsApi.listOrgTeams(v).then((r) => setOrgTeams(r.data ?? []));
                      } else {
                        setOrgDesignations([]);
                        setOrgTeams([]);
                      }
                      setPromoForm((f) => ({ ...f, toOrgDesignationId: '', toTeamId: '' }));
                    }}>
                      <option value="">— Select —</option>
                      {orgDepartments.map((d) => (
                        <option key={d.id} value={d.id}>{d.departmentName}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small">To designation</label>
                    <select className="form-select form-select-sm" value={promoForm.toOrgDesignationId} onChange={(e) => setPromoForm((f) => ({ ...f, toOrgDesignationId: e.target.value === '' ? '' : Number(e.target.value) }))} disabled={!promoDeptId}>
                      <option value="">— Select —</option>
                      {orgDesignations.map((d) => (
                        <option key={d.id} value={d.id}>{d.name} (L{d.level})</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label small">To team</label>
                    <select className="form-select form-select-sm" value={promoForm.toTeamId} onChange={(e) => setPromoForm((f) => ({ ...f, toTeamId: e.target.value === '' ? '' : Number(e.target.value) }))} disabled={!promoDeptId}>
                      <option value="">— Select —</option>
                      {orgTeams.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small">Effective date</label>
                    <input type="date" className="form-control form-control-sm" value={promoForm.effectiveDate} onChange={(e) => setPromoForm((f) => ({ ...f, effectiveDate: e.target.value }))} />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label small">Type</label>
                    <select className="form-select form-select-sm" value={promoForm.changeType} onChange={(e) => setPromoForm((f) => ({ ...f, changeType: e.target.value as 'Promotion' | 'Demotion' | 'Transfer' }))}>
                      <option value="Promotion">Promotion</option>
                      <option value="Demotion">Demotion</option>
                      <option value="Transfer">Transfer</option>
                    </select>
                  </div>
                  <div className="col-12">
                    <label className="form-label small">Notes</label>
                    <input type="text" className="form-control form-control-sm" value={promoForm.notes} onChange={(e) => setPromoForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
                  </div>
                  <div className="col-12">
                    <button type="button" className="btn btn-primary btn-sm" disabled={promoSaving || !promoForm.toOrgDesignationId || !promoForm.toTeamId || !promoForm.effectiveDate} onClick={() => {
                      if (userId == null || !promoForm.toOrgDesignationId || !promoForm.toTeamId || !promoForm.effectiveDate) return;
                      setPromoSaving(true);
                      hrmsApi.recordPromotion(userId, {
                        toOrgDesignationId: promoForm.toOrgDesignationId,
                        toTeamId: promoForm.toTeamId,
                        effectiveDate: promoForm.effectiveDate,
                        changeType: promoForm.changeType,
                        notes: promoForm.notes.trim() || undefined,
                      })
                        .then(() => { setMsg({ type: 'success', text: 'Promotion recorded.' }); setPromoForm((f) => ({ ...f, toOrgDesignationId: '', toTeamId: '', effectiveDate: '', notes: '' })); load(); loadPromoHistory(); })
                        .catch((e) => setMsg({ type: 'error', text: e?.message ?? 'Failed' }))
                        .finally(() => setPromoSaving(false));
                    }}>{promoSaving ? 'Saving...' : 'Record'}</button>
                  </div>
                </div>
              </div>
            )}
            <h6 className="mb-2">Promotion history</h6>
            {promotionHistory.length === 0 ? (
              <p className="text-muted small mb-0">No promotion history.</p>
            ) : (
              <table className="table table-sm">
                <thead><tr><th>Date</th><th>Type</th><th>Notes</th><th>Recorded</th></tr></thead>
                <tbody>
                  {promotionHistory.map((h) => (
                    <tr key={h.id}>
                      <td>{h.effectiveDate}</td>
                      <td>{h.changeType}</td>
                      <td>{h.notes ?? '—'}</td>
                      <td className="small text-muted">{h.createdAt ? new Date(h.createdAt).toISOString().slice(0, 10) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
