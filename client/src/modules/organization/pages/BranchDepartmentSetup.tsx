import { useState, useEffect } from 'react';
import { organizationApi } from '../api/organizationApi';
import type { Branch, BranchDepartment, OrgDepartment } from '../types';

export default function BranchDepartmentSetup() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [branchDepartments, setBranchDepartments] = useState<BranchDepartment[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    organizationApi
      .listBranches(true)
      .then((r) => setBranches(r.data ?? []))
      .catch((e) => setError(e?.message ?? 'Failed to load branches'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    organizationApi
      .listDepartments(true)
      .then((r) => setDepartments(r.data ?? []))
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (selectedBranchId === '') {
      setBranchDepartments([]);
      return;
    }
    setLoading(true);
    organizationApi
      .listBranchDepartments(selectedBranchId)
      .then((r) => setBranchDepartments(r.data ?? []))
      .catch((e) => {
        setError(e?.message ?? 'Failed to load branch departments');
        setBranchDepartments([]);
      })
      .finally(() => setLoading(false));
  }, [selectedBranchId]);

  const isEnabled = (departmentId: number) =>
    branchDepartments.some((bd) => bd.departmentId === departmentId && bd.isActive);

  const getMapId = (departmentId: number) =>
    branchDepartments.find((bd) => bd.departmentId === departmentId)?.id;

  const handleToggle = (departmentId: number, enabled: boolean) => {
    if (selectedBranchId === '') return;
    setTogglingId(departmentId);
    const mapId = getMapId(departmentId);
    const promise = enabled
      ? organizationApi.addBranchDepartment(selectedBranchId, departmentId)
      : mapId != null
        ? organizationApi.removeBranchDepartment(selectedBranchId, mapId)
        : Promise.resolve();

    promise
      .then(() => organizationApi.listBranchDepartments(selectedBranchId))
      .then((r) => setBranchDepartments(r.data ?? []))
      .catch((e) => setError(e?.message ?? 'Failed to update department'))
      .finally(() => setTogglingId(null));
  };

  return (
    <div className="container-fluid py-3">
      <h4 className="mb-3">Branch Department Setup</h4>

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
          {loading ? (
            <div className="text-muted">Loading departments…</div>
          ) : (
            <div className="list-group">
              {departments.map((dept) => {
                const enabled = isEnabled(dept.id);
                const busy = togglingId === dept.id;
                return (
                  <div
                    key={dept.id}
                    className="list-group-item d-flex justify-content-between align-items-center"
                  >
                    <div>
                      <span className="fw-semibold">{dept.departmentName}</span>
                      <span className="text-muted ms-2">({dept.departmentCode})</span>
                    </div>
                    <div className="form-check form-switch mb-0">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id={`dept-${dept.id}`}
                        checked={enabled}
                        disabled={busy}
                        onChange={(e) => handleToggle(dept.id, e.target.checked)}
                      />
                      <label className="form-check-label" htmlFor={`dept-${dept.id}`}>
                        {busy ? '…' : enabled ? 'Enabled' : 'Disabled'}
                      </label>
                    </div>
                  </div>
                );
              })}
              {departments.length === 0 && (
                <div className="list-group-item text-muted">No departments available.</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
