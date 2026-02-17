import { useState, useEffect } from 'react';
import { organizationApi } from '../api/organizationApi';
import type { Branch, BranchCompany, Company } from '../types';

export default function BranchCompanyMapping() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [mappings, setMappings] = useState<BranchCompany[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [modalForm, setModalForm] = useState({
    companyId: '' as number | '',
    isDefault: false,
    effectiveFrom: new Date().toISOString().slice(0, 10),
    effectiveTo: '',
  });

  useEffect(() => {
    organizationApi
      .listBranches(true)
      .then((r) => setBranches(r.data ?? []))
      .catch((e) => setError(e?.message ?? 'Failed to load branches'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    organizationApi
      .listCompanies(true)
      .then((r) => setCompanies(r.data ?? []))
      .catch(() => setCompanies([]));
  }, []);

  useEffect(() => {
    if (selectedBranchId === '') {
      setMappings([]);
      return;
    }
    setLoading(true);
    organizationApi
      .listBranchCompanies(selectedBranchId)
      .then((r) => setMappings(r.data ?? []))
      .catch((e) => {
        setError(e?.message ?? 'Failed to load mappings');
        setMappings([]);
      })
      .finally(() => setLoading(false));
  }, [selectedBranchId]);

  const getCompanyName = (companyId: number) => {
    const c = companies.find((x) => x.id === companyId);
    return c ? (c.tradeName || c.legalName || c.companyCode) : `#${companyId}`;
  };

  const handleLinkCompany = () => {
    if (selectedBranchId === '' || modalForm.companyId === '') return;
    setSaving(true);
    organizationApi
      .addBranchCompany(selectedBranchId, {
        companyId: modalForm.companyId,
        isDefault: modalForm.isDefault,
        effectiveFrom: modalForm.effectiveFrom,
        effectiveTo: modalForm.effectiveTo || undefined,
      })
      .then(() => {
        setShowModal(false);
        setModalForm({
          companyId: '',
          isDefault: false,
          effectiveFrom: new Date().toISOString().slice(0, 10),
          effectiveTo: '',
        });
        return organizationApi.listBranchCompanies(selectedBranchId);
      })
      .then((r) => setMappings(r.data ?? []))
      .catch((e) => setError(e?.message ?? 'Failed to link company'))
      .finally(() => setSaving(false));
  };

  const handleRemove = (mapId: number) => {
    if (selectedBranchId === '' || !confirm('Remove this company mapping?')) return;
    organizationApi
      .removeBranchCompany(selectedBranchId, mapId)
      .then(() => organizationApi.listBranchCompanies(selectedBranchId))
      .then((r) => setMappings(r.data ?? []))
      .catch((e) => setError(e?.message ?? 'Failed to remove mapping'));
  };

  const mappedCompanyIds = mappings.map((m) => m.companyId);
  const availableCompanies = companies.filter((c) => !mappedCompanyIds.includes(c.id));

  return (
    <div className="container-fluid py-3">
      <h4 className="mb-3">Branch–Company Mapping</h4>

      {error && (
        <div className="alert alert-danger alert-dismissible" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close" />
        </div>
      )}

      <div className="row mb-3">
        <div className="col-md-4">
          <label className="form-label">Branch</label>
          <select
            className="form-select"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.branchName} ({b.branchCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedBranchId !== '' && (
        <>
          <div className="mb-3">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowModal(true)}
              disabled={availableCompanies.length === 0}
            >
              Link Company
            </button>
          </div>

          {loading ? (
            <div className="text-muted">Loading mappings…</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-hover">
                <thead className="table-light">
                  <tr>
                    <th>Company</th>
                    <th>Default</th>
                    <th>Effective From</th>
                    <th>Effective To</th>
                    <th style={{ width: 80 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-muted text-center">
                        No companies linked. Click &quot;Link Company&quot; to add.
                      </td>
                    </tr>
                  ) : (
                    mappings.map((m) => (
                      <tr key={m.id}>
                        <td>{getCompanyName(m.companyId)}</td>
                        <td>{m.isDefault ? 'Yes' : 'No'}</td>
                        <td>{m.effectiveFrom}</td>
                        <td>{m.effectiveTo ?? '—'}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleRemove(m.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Link Company Modal */}
      <div className={`modal ${showModal ? 'show d-block' : ''}`} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Link Company</h5>
              <button type="button" className="btn-close" onClick={() => setShowModal(false)} aria-label="Close" />
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Company</label>
                <select
                  className="form-select"
                  value={modalForm.companyId}
                  onChange={(e) => setModalForm((f) => ({ ...f, companyId: e.target.value === '' ? '' : Number(e.target.value) }))}
                >
                  <option value="">Select company</option>
                  {availableCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.tradeName || c.legalName || c.companyCode}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3 form-check">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="linkIsDefault"
                  checked={modalForm.isDefault}
                  onChange={(e) => setModalForm((f) => ({ ...f, isDefault: e.target.checked }))}
                />
                <label className="form-check-label" htmlFor="linkIsDefault">
                  Default company
                </label>
              </div>
              <div className="mb-3">
                <label className="form-label">Effective From</label>
                <input
                  type="date"
                  className="form-control"
                  value={modalForm.effectiveFrom}
                  onChange={(e) => setModalForm((f) => ({ ...f, effectiveFrom: e.target.value }))}
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Effective To (optional)</label>
                <input
                  type="date"
                  className="form-control"
                  value={modalForm.effectiveTo}
                  onChange={(e) => setModalForm((f) => ({ ...f, effectiveTo: e.target.value }))}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleLinkCompany}
                disabled={saving || modalForm.companyId === ''}
              >
                {saving ? 'Linking…' : 'Link'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
