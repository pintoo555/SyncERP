import { useEffect, useState, useCallback } from 'react';
import { hrmsApi, type OrgDepartment } from '../api/hrmsApi';

export default function HRMSDepartmentManagement() {
  const [list, setList] = useState<OrgDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<{ open: true; department?: OrgDepartment } | { open: false }>({ open: false });
  const [form, setForm] = useState({ departmentCode: '', departmentName: '', sortOrder: 0 });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    hrmsApi.listOrgDepartments()
      .then((res) => { setList(res.data ?? []); setError(null); })
      .catch((e) => { setList([]); setError(e?.message ?? 'Failed to load departments'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => {
    setForm({ departmentCode: '', departmentName: '', sortOrder: list.length });
    setModal({ open: true });
  };

  const openEdit = (d: OrgDepartment) => {
    setForm({ departmentCode: d.departmentCode, departmentName: d.departmentName, sortOrder: d.sortOrder });
    setModal({ open: true, department: d });
  };

  const closeModal = () => setModal({ open: false });

  const save = () => {
    if (!form.departmentCode.trim() || !form.departmentName.trim()) return;
    setSaving(true);
    const promise = modal.open && modal.department
      ? hrmsApi.updateOrgDepartment(modal.department.id, { departmentCode: form.departmentCode.trim(), departmentName: form.departmentName.trim(), sortOrder: form.sortOrder })
      : hrmsApi.createOrgDepartment({ departmentCode: form.departmentCode.trim(), departmentName: form.departmentName.trim(), sortOrder: form.sortOrder });
    promise
      .then(() => { closeModal(); load(); })
      .catch((e) => setError(e?.message ?? 'Failed to save'))
      .finally(() => setSaving(false));
  };

  const remove = (d: OrgDepartment) => {
    if (!window.confirm(`Delete department "${d.departmentName}"? This may affect designations and teams.`)) return;
    setSaving(true);
    hrmsApi.deleteOrgDepartment(d.id)
      .then(() => load())
      .catch((e) => setError(e?.message ?? 'Failed to delete'))
      .finally(() => setSaving(false));
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <h4 className="mb-0"><i className="ti ti-building me-2" />Departments</h4>
        <button type="button" className="btn btn-primary" onClick={openAdd}><i className="ti ti-plus me-1" />Add Department</button>
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
            <div className="p-4 text-center text-muted">No departments. Add one to get started.</div>
          ) : (
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Sort</th>
                  <th>Status</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.id}>
                    <td>{d.departmentCode}</td>
                    <td>{d.departmentName}</td>
                    <td>{d.sortOrder}</td>
                    <td>{d.isActive ? <span className="badge bg-success">Active</span> : <span className="badge bg-secondary">Inactive</span>}</td>
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

      {modal.open && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{modal.department ? 'Edit Department' : 'Add Department'}</h5>
                <button type="button" className="btn-close" onClick={closeModal} aria-label="Close" />
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label small">Code</label>
                  <input type="text" className="form-control form-control-sm" value={form.departmentCode} onChange={(e) => setForm((f) => ({ ...f, departmentCode: e.target.value }))} placeholder="e.g. REP" />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Name</label>
                  <input type="text" className="form-control form-control-sm" value={form.departmentName} onChange={(e) => setForm((f) => ({ ...f, departmentName: e.target.value }))} placeholder="e.g. Repairs" />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Sort order</label>
                  <input type="number" className="form-control form-control-sm" value={form.sortOrder} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeModal}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !form.departmentCode.trim() || !form.departmentName.trim()}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
