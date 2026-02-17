import { useState, useEffect } from 'react';
import { organizationApi } from '../api/organizationApi';
import type { Company } from '../types';

type CompanyForm = {
  companyCode: string;
  legalName: string;
  tradeName: string;
  taxRegistrationNumber: string;
  taxRegistrationType: string;
  pan: string;
  cin: string;
  bankName: string;
  bankAccountNumber: string;
  bankIFSC: string;
  bankBranch: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  pincode: string;
  phone: string;
  email: string;
  website: string;
};

const emptyForm: CompanyForm = {
  companyCode: '',
  legalName: '',
  tradeName: '',
  taxRegistrationNumber: '',
  taxRegistrationType: '',
  pan: '',
  cin: '',
  bankName: '',
  bankAccountNumber: '',
  bankIFSC: '',
  bankBranch: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  pincode: '',
  phone: '',
  email: '',
  website: '',
};

export default function CompanyManagement() {
  const [list, setList] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: true; company?: Company } | { open: false }>({ open: false });
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const res = await organizationApi.listCompanies(false);
      setList((res as { data?: Company[] }).data ?? []);
    } catch (e) {
      setList([]);
      setError((e as Error)?.message ?? 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const openAdd = () => {
    setForm(emptyForm);
    setModal({ open: true });
  };

  const openEdit = (c: Company) => {
    setForm({
      companyCode: c.companyCode,
      legalName: c.legalName,
      tradeName: c.tradeName ?? '',
      taxRegistrationNumber: c.taxRegistrationNumber ?? '',
      taxRegistrationType: c.taxRegistrationType ?? '',
      pan: c.pan ?? '',
      cin: c.cin ?? '',
      bankName: c.bankName ?? '',
      bankAccountNumber: c.bankAccountNumber ?? '',
      bankIFSC: c.bankIFSC ?? '',
      bankBranch: c.bankBranch ?? '',
      addressLine1: c.addressLine1 ?? '',
      addressLine2: c.addressLine2 ?? '',
      city: c.city ?? '',
      pincode: c.pincode ?? '',
      phone: c.phone ?? '',
      email: c.email ?? '',
      website: c.website ?? '',
    });
    setModal({ open: true, company: c });
  };

  const closeModal = () => setModal({ open: false });

  const updateField = (key: keyof CompanyForm, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = async () => {
    if (!form.companyCode.trim() || !form.legalName.trim()) return;
    try {
      setSaving(true);
      setError(null);
      const data = {
        companyCode: form.companyCode.trim(),
        legalName: form.legalName.trim(),
        tradeName: form.tradeName.trim() || null,
        taxRegistrationNumber: form.taxRegistrationNumber.trim() || null,
        taxRegistrationType: form.taxRegistrationType.trim() || null,
        pan: form.pan.trim() || null,
        cin: form.cin.trim() || null,
        bankName: form.bankName.trim() || null,
        bankAccountNumber: form.bankAccountNumber.trim() || null,
        bankIFSC: form.bankIFSC.trim() || null,
        bankBranch: form.bankBranch.trim() || null,
        addressLine1: form.addressLine1.trim() || null,
        addressLine2: form.addressLine2.trim() || null,
        city: form.city.trim() || null,
        pincode: form.pincode.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        website: form.website.trim() || null,
      };
      if (modal.open && modal.company) {
        await organizationApi.updateCompany(modal.company.id, data);
      } else {
        await organizationApi.createCompany(data);
      }
      closeModal();
      loadData();
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: Company) => {
    try {
      setSaving(true);
      setError(null);
      await organizationApi.updateCompany(c.id, { isActive: !c.isActive });
      loadData();
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <h4 className="mb-0"><i className="ti ti-building me-2" />Companies</h4>
        <button type="button" className="btn btn-primary" onClick={openAdd}><i className="ti ti-plus me-1" />Add Company</button>
      </div>
      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close" />
        </div>
      )}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="p-4 text-center text-muted">Loading...</div>
          ) : list.length === 0 ? (
            <div className="p-4 text-center text-muted">No companies. Add one to get started.</div>
          ) : (
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Legal Name</th>
                  <th>Trade Name</th>
                  <th>Code</th>
                  <th>Tax Reg. No.</th>
                  <th>City</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id}>
                    <td>{c.legalName}</td>
                    <td>{c.tradeName ?? '—'}</td>
                    <td>{c.companyCode}</td>
                    <td>{c.taxRegistrationNumber ?? '—'}</td>
                    <td>{c.city ?? '—'}</td>
                    <td>
                      <span className={`badge ${c.isActive ? 'bg-success' : 'bg-secondary'}`}>{c.isActive ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="text-end">
                      <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(c)}>Edit</button>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toggleActive(c)} disabled={saving}>
                        {c.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {modal.open && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{modal.company ? 'Edit Company' : 'Add Company'}</h5>
                <button type="button" className="btn-close" onClick={closeModal} aria-label="Close" />
              </div>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-6 mb-2">
                    <label className="form-label small">Company Code</label>
                    <input type="text" className="form-control form-control-sm" value={form.companyCode} onChange={(e) => updateField('companyCode', e.target.value)} placeholder="e.g. C001" />
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label small">Legal Name</label>
                    <input type="text" className="form-control form-control-sm" value={form.legalName} onChange={(e) => updateField('legalName', e.target.value)} placeholder="Legal name" />
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label small">Trade Name</label>
                    <input type="text" className="form-control form-control-sm" value={form.tradeName} onChange={(e) => updateField('tradeName', e.target.value)} placeholder="Trade name" />
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label small">Tax Registration Number</label>
                    <input type="text" className="form-control form-control-sm" value={form.taxRegistrationNumber} onChange={(e) => updateField('taxRegistrationNumber', e.target.value)} />
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label small">Tax Registration Type</label>
                    <input type="text" className="form-control form-control-sm" value={form.taxRegistrationType} onChange={(e) => updateField('taxRegistrationType', e.target.value)} placeholder="e.g. GST" />
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label small">PAN</label>
                    <input type="text" className="form-control form-control-sm" value={form.pan} onChange={(e) => updateField('pan', e.target.value)} />
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label small">CIN</label>
                    <input type="text" className="form-control form-control-sm" value={form.cin} onChange={(e) => updateField('cin', e.target.value)} />
                  </div>
                </div>
                <hr className="my-2" />
                <h6 className="small text-muted mb-2">Bank Details</h6>
                <div className="row">
                  <div className="col-md-6 mb-2">
                    <label className="form-label small">Bank Name</label>
                    <input type="text" className="form-control form-control-sm" value={form.bankName} onChange={(e) => updateField('bankName', e.target.value)} />
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label small">Bank Account Number</label>
                    <input type="text" className="form-control form-control-sm" value={form.bankAccountNumber} onChange={(e) => updateField('bankAccountNumber', e.target.value)} />
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label small">Bank IFSC</label>
                    <input type="text" className="form-control form-control-sm" value={form.bankIFSC} onChange={(e) => updateField('bankIFSC', e.target.value)} />
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label small">Bank Branch</label>
                    <input type="text" className="form-control form-control-sm" value={form.bankBranch} onChange={(e) => updateField('bankBranch', e.target.value)} />
                  </div>
                </div>
                <hr className="my-2" />
                <h6 className="small text-muted mb-2">Address</h6>
                <div className="row">
                  <div className="col-12 mb-2">
                    <label className="form-label small">Address Line 1</label>
                    <input type="text" className="form-control form-control-sm" value={form.addressLine1} onChange={(e) => updateField('addressLine1', e.target.value)} />
                  </div>
                  <div className="col-12 mb-2">
                    <label className="form-label small">Address Line 2</label>
                    <input type="text" className="form-control form-control-sm" value={form.addressLine2} onChange={(e) => updateField('addressLine2', e.target.value)} />
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label small">City</label>
                    <input type="text" className="form-control form-control-sm" value={form.city} onChange={(e) => updateField('city', e.target.value)} />
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label small">Pincode</label>
                    <input type="text" className="form-control form-control-sm" value={form.pincode} onChange={(e) => updateField('pincode', e.target.value)} />
                  </div>
                </div>
                <hr className="my-2" />
                <h6 className="small text-muted mb-2">Contact</h6>
                <div className="row">
                  <div className="col-md-6 mb-2">
                    <label className="form-label small">Phone</label>
                    <input type="text" className="form-control form-control-sm" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
                  </div>
                  <div className="col-md-6 mb-2">
                    <label className="form-label small">Email</label>
                    <input type="email" className="form-control form-control-sm" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
                  </div>
                  <div className="col-12 mb-2">
                    <label className="form-label small">Website</label>
                    <input type="url" className="form-control form-control-sm" value={form.website} onChange={(e) => updateField('website', e.target.value)} placeholder="https://" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !form.companyCode.trim() || !form.legalName.trim()}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
