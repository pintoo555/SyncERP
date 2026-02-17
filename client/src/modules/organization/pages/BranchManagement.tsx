import { useState, useEffect } from 'react';
import { organizationApi } from '../api/organizationApi';
import type { Branch, BranchType } from '../types';

const BRANCH_TYPES: BranchType[] = ['HO', 'WORKSHOP', 'COLLECTION', 'SALES', 'ADMIN', 'FULL'];

const BRANCH_TYPE_BADGE: Record<BranchType, string> = {
  HO: 'bg-primary',
  WORKSHOP: 'bg-info',
  COLLECTION: 'bg-warning text-dark',
  SALES: 'bg-success',
  ADMIN: 'bg-secondary',
  FULL: 'bg-dark',
};

type BranchForm = {
  branchCode: string;
  branchName: string;
  branchType: BranchType;
  city: string;
  timezone: string;
  addressLine1: string;
  addressLine2: string;
  pincode: string;
  phone: string;
  email: string;
};

const emptyForm: BranchForm = {
  branchCode: '',
  branchName: '',
  branchType: 'HO',
  city: '',
  timezone: '',
  addressLine1: '',
  addressLine2: '',
  pincode: '',
  phone: '',
  email: '',
};

export default function BranchManagement() {
  const [list, setList] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: true; branch?: Branch } | { open: false }>({ open: false });
  const [form, setForm] = useState<BranchForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const res = await organizationApi.listBranches(false);
      setList((res as { data?: Branch[] }).data ?? []);
    } catch (e) {
      setList([]);
      setError((e as Error)?.message ?? 'Failed to load branches');
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

  const openEdit = (b: Branch) => {
    setForm({
      branchCode: b.branchCode,
      branchName: b.branchName,
      branchType: b.branchType,
      city: b.city ?? '',
      timezone: b.timezone ?? '',
      addressLine1: b.addressLine1 ?? '',
      addressLine2: b.addressLine2 ?? '',
      pincode: b.pincode ?? '',
      phone: b.phone ?? '',
      email: b.email ?? '',
    });
    setModal({ open: true, branch: b });
  };

  const closeModal = () => setModal({ open: false });

  const updateField = <K extends keyof BranchForm>(key: K, value: BranchForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  };

  const save = async () => {
    if (!form.branchCode.trim() || !form.branchName.trim()) return;
    try {
      setSaving(true);
      setError(null);
      const data = {
        branchCode: form.branchCode.trim(),
        branchName: form.branchName.trim(),
        branchType: form.branchType,
        city: form.city.trim() || null,
        timezone: form.timezone.trim() || null,
        addressLine1: form.addressLine1.trim() || null,
        addressLine2: form.addressLine2.trim() || null,
        pincode: form.pincode.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      };
      if (modal.open && modal.branch) {
        await organizationApi.updateBranch(modal.branch.id, data);
      } else {
        await organizationApi.createBranch(data);
      }
      closeModal();
      loadData();
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (b: Branch) => {
    try {
      setSaving(true);
      setError(null);
      await organizationApi.updateBranch(b.id, { isActive: !b.isActive });
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
        <h4 className="mb-0"><i className="ti ti-map-pin me-2" />Branches</h4>
        <button type="button" className="btn btn-primary" onClick={openAdd}><i className="ti ti-plus me-1" />Add Branch</button>
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
            <div className="p-4 text-center text-muted">No branches. Add one to get started.</div>
          ) : (
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Branch Code</th>
                  <th>Branch Name</th>
                  <th>Type</th>
                  <th>City</th>
                  <th>Phone</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((b) => (
                  <tr key={b.id}>
                    <td>{b.branchCode}</td>
                    <td>{b.branchName}</td>
                    <td><span className={`badge ${BRANCH_TYPE_BADGE[b.branchType]}`}>{b.branchType}</span></td>
                    <td>{b.city ?? '—'}</td>
                    <td>{b.phone ?? '—'}</td>
                    <td>
                      <span className={`badge ${b.isActive ? 'bg-success' : 'bg-secondary'}`}>{b.isActive ? 'Active' : 'Inactive'}</span>
                    </td>
                    <td className="text-end">
                      <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(b)}>Edit</button>
                      <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => toggleActive(b)} disabled={saving}>
                        {b.isActive ? 'Deactivate' : 'Activate'}
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
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{modal.branch ? 'Edit Branch' : 'Add Branch'}</h5>
                <button type="button" className="btn-close" onClick={closeModal} aria-label="Close" />
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label small">Branch Code</label>
                  <input type="text" className="form-control form-control-sm" value={form.branchCode} onChange={(e) => updateField('branchCode', e.target.value)} placeholder="e.g. BR001" />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Branch Name</label>
                  <input type="text" className="form-control form-control-sm" value={form.branchName} onChange={(e) => updateField('branchName', e.target.value)} placeholder="Branch name" />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Branch Type</label>
                  <select className="form-select form-select-sm" value={form.branchType} onChange={(e) => updateField('branchType', e.target.value as BranchType)}>
                    {BRANCH_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-2">
                  <label className="form-label small">City</label>
                  <input type="text" className="form-control form-control-sm" value={form.city} onChange={(e) => updateField('city', e.target.value)} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Timezone</label>
                  <input type="text" className="form-control form-control-sm" value={form.timezone} onChange={(e) => updateField('timezone', e.target.value)} placeholder="e.g. Asia/Kolkata" />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Address Line 1</label>
                  <input type="text" className="form-control form-control-sm" value={form.addressLine1} onChange={(e) => updateField('addressLine1', e.target.value)} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Address Line 2</label>
                  <input type="text" className="form-control form-control-sm" value={form.addressLine2} onChange={(e) => updateField('addressLine2', e.target.value)} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Pincode</label>
                  <input type="text" className="form-control form-control-sm" value={form.pincode} onChange={(e) => updateField('pincode', e.target.value)} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Phone</label>
                  <input type="text" className="form-control form-control-sm" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Email</label>
                  <input type="email" className="form-control form-control-sm" value={form.email} onChange={(e) => updateField('email', e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !form.branchCode.trim() || !form.branchName.trim()}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
