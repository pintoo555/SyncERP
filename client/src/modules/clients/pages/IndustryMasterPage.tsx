/**
 * Industry master CRUD page.
 */
import React, { useState, useEffect, useCallback } from 'react';
import * as clientsApi from '../api/clientsApi';
import type { Industry } from '../types';
import { INDUSTRY_CATEGORIES } from '../types';

const emptyForm = { industryName: '', industryCategory: '' };

export default function IndustryMasterPage() {
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [modal, setModal] = useState<{ open: true; industry?: Industry } | { open: false }>({ open: false });
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(() => {
    setLoading(true);
    clientsApi.listIndustries()
      .then(res => setIndustries(res.data || []))
      .catch(e => setError(e?.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm(emptyForm);
    setModal({ open: true });
  };

  const openEdit = (ind: Industry) => {
    setForm({ industryName: ind.industryName, industryCategory: ind.industryCategory });
    setModal({ open: true, industry: ind });
  };

  const closeModal = () => {
    setModal({ open: false });
    setForm(emptyForm);
  };

  const handleSave = async () => {
    if (!form.industryName.trim() || !form.industryCategory) return;
    try {
      setSaving(true);
      if (modal.open && modal.industry) {
        await clientsApi.updateIndustry(modal.industry.id, form);
      } else {
        await clientsApi.createIndustry(form);
      }
      closeModal();
      load();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (ind: Industry) => {
    try {
      await clientsApi.toggleIndustryStatus(ind.id, !ind.isActive);
      load();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to update status');
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="mb-1 fw-bold"><i className="ti ti-building-factory me-2 text-primary" />Industries</h4>
          <p className="text-muted mb-0 small">Manage industry master records</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={openAdd}>
          <i className="ti ti-plus me-1" /> Add Industry
        </button>
      </div>

      {error && <div className="alert alert-danger alert-dismissible fade show">{error}<button className="btn-close" onClick={() => setError(null)} /></div>}

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>#</th>
                  <th>Industry Name</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={5} className="text-center py-5 text-muted"><span className="spinner-border spinner-border-sm me-2" />Loading...</td></tr>}
                {!loading && industries.length === 0 && <tr><td colSpan={5} className="text-center py-5 text-muted">No industries found.</td></tr>}
                {!loading && industries.map((ind, i) => (
                  <tr key={ind.id} className={!ind.isActive ? 'opacity-50' : ''}>
                    <td className="text-muted small">{i + 1}</td>
                    <td className="fw-semibold">{ind.industryName}</td>
                    <td><span className="badge bg-outline-primary">{ind.industryCategory}</span></td>
                    <td>
                      {ind.isActive
                        ? <span className="badge bg-success-subtle text-success">Active</span>
                        : <span className="badge bg-secondary">Inactive</span>}
                    </td>
                    <td className="text-end">
                      <button className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(ind)} title="Edit">
                        <i className="ti ti-pencil" />
                      </button>
                      <button
                        className={`btn btn-sm ${ind.isActive ? 'btn-outline-warning' : 'btn-outline-success'}`}
                        onClick={() => handleToggle(ind)}
                        title={ind.isActive ? 'Deactivate' : 'Activate'}
                      >
                        <i className={`ti ${ind.isActive ? 'ti-ban' : 'ti-check'}`} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modal.open && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{modal.industry ? 'Edit Industry' : 'Add Industry'}</h5>
                <button type="button" className="btn-close" onClick={closeModal} disabled={saving} />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label small">Industry Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    value={form.industryName}
                    onChange={e => setForm(p => ({ ...p, industryName: e.target.value }))}
                    maxLength={200}
                  />
                </div>
                <div className="mb-3">
                  <label className="form-label small">Category <span className="text-danger">*</span></label>
                  <select
                    className="form-select form-select-sm"
                    value={form.industryCategory}
                    onChange={e => setForm(p => ({ ...p, industryCategory: e.target.value }))}
                  >
                    <option value="">Select category...</option>
                    {INDUSTRY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving || !form.industryName.trim() || !form.industryCategory}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
