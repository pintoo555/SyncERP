import { useEffect, useState, useCallback } from 'react';
import { hrmsApi, type OrgDepartment, type OrgDesignation } from '../api/hrmsApi';

export default function HRMSDesignationManagement() {
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [designations, setDesignations] = useState<OrgDesignation[]>([]);
  const [departmentId, setDepartmentId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: true; designation?: OrgDesignation } | { open: false }>({ open: false });
  const [form, setForm] = useState({ name: '', level: 1, isLeader: false, sortOrder: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    hrmsApi.listOrgDepartments()
      .then((res) => setDepartments(res.data ?? []))
      .catch(() => setDepartments([]));
  }, []);

  const loadDesignations = useCallback(() => {
    if (departmentId === '' || !Number.isInteger(Number(departmentId))) {
      setDesignations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    hrmsApi.listOrgDesignations(Number(departmentId))
      .then((res) => { setDesignations(res.data ?? []); setError(null); })
      .catch((e) => { setDesignations([]); setError(e?.message ?? 'Failed to load designations'); })
      .finally(() => setLoading(false));
  }, [departmentId]);

  useEffect(() => { loadDesignations(); }, [loadDesignations]);

  const openAdd = () => {
    setForm({ name: '', level: designations.length + 1, isLeader: false, sortOrder: designations.length });
    setModal({ open: true });
  };

  const openEdit = (d: OrgDesignation) => {
    setForm({ name: d.name, level: d.level, isLeader: d.isLeader, sortOrder: d.sortOrder });
    setModal({ open: true, designation: d });
  };

  const closeModal = () => setModal({ open: false });

  const save = () => {
    if (!form.name.trim() || departmentId === '') return;
    setSaving(true);
    const deptId = Number(departmentId);
    const promise = modal.open && modal.designation
      ? hrmsApi.updateOrgDesignation(modal.designation.id, { name: form.name.trim(), level: form.level, isLeader: form.isLeader, sortOrder: form.sortOrder })
      : hrmsApi.createOrgDesignation({ departmentId: deptId, name: form.name.trim(), level: form.level, isLeader: form.isLeader, sortOrder: form.sortOrder });
    promise
      .then(() => { closeModal(); loadDesignations(); })
      .catch((e) => setError(e?.message ?? 'Failed to save'))
      .finally(() => setSaving(false));
  };

  const remove = (d: OrgDesignation) => {
    if (!window.confirm(`Delete designation "${d.name}"?`)) return;
    setSaving(true);
    hrmsApi.deleteOrgDesignation(d.id)
      .then(() => loadDesignations())
      .catch((e) => setError(e?.message ?? 'Failed to delete'))
      .finally(() => setSaving(false));
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <h4 className="mb-0"><i className="ti ti-badge me-2" />Designations</h4>
      </div>
      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close" />
        </div>
      )}
      <div className="card mb-4">
        <div className="card-body">
          <label className="form-label small">Department</label>
          <select className="form-select form-select-sm" style={{ maxWidth: 280 }} value={departmentId} onChange={(e) => setDepartmentId(e.target.value === '' ? '' : Number(e.target.value))}>
            <option value="">-- Select department --</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.departmentName}</option>
            ))}
          </select>
        </div>
      </div>
      {departmentId !== '' && (
        <>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="mb-0">Designations (level order)</h5>
            <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}><i className="ti ti-plus me-1" />Add Designation</button>
          </div>
          <div className="card">
            <div className="card-body p-0">
              {loading ? (
                <div className="p-4 text-center text-muted">Loading...</div>
              ) : designations.length === 0 ? (
                <div className="p-4 text-center text-muted">No designations. Add one to define the level ladder.</div>
              ) : (
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Level</th>
                      <th>Leader</th>
                      <th>Sort</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {designations.map((d) => (
                      <tr key={d.id}>
                        <td>{d.name}</td>
                        <td>{d.level}</td>
                        <td>{d.isLeader ? <span className="badge bg-info">Leader</span> : <span className="text-muted">—</span>}</td>
                        <td>{d.sortOrder}</td>
                        <td className="text-end">
                          <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(d)}>Edit</button>
                          <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(d)} disabled={saving}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {modal.open && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{modal.designation ? 'Edit Designation' : 'Add Designation'}</h5>
                <button type="button" className="btn-close" onClick={closeModal} aria-label="Close" />
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label small">Name</label>
                  <input type="text" className="form-control form-control-sm" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Supervisor – Technical" />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Level (1 = highest)</label>
                  <input type="number" min={1} className="form-control form-control-sm" value={form.level} onChange={(e) => setForm((f) => ({ ...f, level: Number(e.target.value) || 1 }))} />
                </div>
                <div className="mb-2">
                  <div className="form-check">
                    <input type="checkbox" className="form-check-input" id="isLeader" checked={form.isLeader} onChange={(e) => setForm((f) => ({ ...f, isLeader: e.target.checked }))} />
                    <label className="form-check-label" htmlFor="isLeader">Leadership designation</label>
                  </div>
                </div>
                <div className="mb-2">
                  <label className="form-label small">Sort order</label>
                  <input type="number" className="form-control form-control-sm" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !form.name.trim()}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
