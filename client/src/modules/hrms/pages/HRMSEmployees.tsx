import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { hrmsApi } from '../api/hrmsApi';
import { UserAvatar } from '../../../components/UserAvatar';

interface OrgDepartment {
  id: number;
  departmentName: string;
}

interface OrgDesignation {
  id: number;
  name: string;
}

interface EmployeeListItem {
  userId: number;
  name: string;
  email: string;
  departmentId: number | null;
  departmentName: string | null;
  designationId: number | null;
  designationType: string | null;
  employeeCode: string | null;
  mobile: string | null;
  joinDate: string | null;
  isActive: boolean;
}

type StatusFilter = 'all' | 'active' | 'inactive';

export default function HRMSEmployees() {
  const [employees, setEmployees] = useState<EmployeeListItem[]>([]);
  const [departments, setDepartments] = useState<OrgDepartment[]>([]);
  const [designations, setDesignations] = useState<OrgDesignation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [designationId, setDesignationId] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (search.trim()) params.set('search', search.trim());
    if (departmentId) params.set('departmentId', departmentId);
    if (designationId) params.set('orgDesignationId', designationId);
    if (statusFilter === 'active') params.set('isActive', '1');
    if (statusFilter === 'inactive') params.set('isActive', '0');
    api.get<{ success: boolean; data: EmployeeListItem[] }>(`/api/hrms/employees?${params.toString()}`)
      .then((res) => {
        setEmployees(res.data ?? []);
        setError(null);
      })
      .catch((e) => {
        setEmployees([]);
        setError(e?.message ?? 'Failed to load employees. You may need HRMS.VIEW permission.');
      })
      .finally(() => setLoading(false));
  }, [search, departmentId, designationId, statusFilter]);

  useEffect(() => {
    hrmsApi.listOrgDepartments()
      .then((res) => setDepartments(res.data ?? []))
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    if (!departmentId) {
      setDesignations([]);
      setDesignationId('');
      return;
    }
    hrmsApi.listOrgDesignations(Number(departmentId))
      .then((res) => {
        setDesignations(res.data ?? []);
        setDesignationId('');
      })
      .catch(() => setDesignations([]));
  }, [departmentId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <div>
          <h4 className="mb-1 fw-bold">
            <i className="ti ti-users-group me-2 text-primary" />
            Employees
          </h4>
          <p className="text-muted mb-0 small">View and manage employee records</p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close" />
        </div>
      )}

      <div className="card border-0 shadow-sm mb-4">
        <div className="card-header bg-transparent border-bottom py-3">
          <h5 className="mb-0 fw-semibold">
            <i className="ti ti-filter me-2 text-primary" />
            Filters
          </h5>
        </div>
        <div className="card-body">
          <div className="row g-3 align-items-end">
            <div className="col-12 col-md-3">
              <label className="form-label small mb-1">Search</label>
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-end-0"><i className="ti ti-search text-muted" /></span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Name, email, employee code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && load()}
                />
              </div>
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label small mb-1">Department</label>
              <select
                className="form-select form-select-sm"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={String(d.id)}>{d.departmentName}</option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label small mb-1">Designation</label>
              <select
                className="form-select form-select-sm"
                value={designationId}
                onChange={(e) => setDesignationId(e.target.value)}
                disabled={!departmentId}
              >
                <option value="">All designations</option>
                {designations.map((d) => (
                  <option key={d.id} value={String(d.id)}>{d.name}</option>
                ))}
              </select>
              {!departmentId && <small className="text-muted">Select department first</small>}
            </div>
            <div className="col-12 col-md-2">
              <label className="form-label small mb-1">Status</label>
              <select
                className="form-select form-select-sm"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">All</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>
            <div className="col-12 col-md-auto">
              <button type="button" className="btn btn-primary btn-sm" onClick={load}>
                <i className="ti ti-search me-1" />
                Search
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card border-0 shadow-sm">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th style={{ width: 52 }} className="text-center">Photo</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Employee Code</th>
                  <th>Mobile</th>
                  <th>Join Date</th>
                  <th className="text-center">Status</th>
                  <th style={{ width: 90 }} className="text-end"></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={10} className="text-center py-5 text-muted">
                      <div className="spinner-border spinner-border-sm me-2" />
                      Loading employees…
                    </td>
                  </tr>
                )}
                {!loading && employees.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-5 text-muted">
                      No employees found. Try adjusting filters.
                    </td>
                  </tr>
                )}
                {!loading && employees.map((emp) => (
                  <tr key={emp.userId}>
                    <td className="text-center">
                      <UserAvatar userId={emp.userId} name={emp.name} size={40} className="flex-shrink-0" />
                    </td>
                    <td>
                      <Link to={`/hrms/employees/${emp.userId}`} className="fw-semibold text-body text-decoration-none">
                        {emp.name}
                      </Link>
                    </td>
                    <td className="small">{emp.email}</td>
                    <td>{emp.departmentName ?? '—'}</td>
                    <td>{emp.designationType ?? '—'}</td>
                    <td><code className="small">{emp.employeeCode ?? '—'}</code></td>
                    <td>{emp.mobile ?? '—'}</td>
                    <td>{emp.joinDate ?? '—'}</td>
                    <td className="text-center">
                      {emp.isActive ? (
                        <span className="badge bg-success bg-opacity-10 text-success">Active</span>
                      ) : (
                        <span className="badge bg-secondary bg-opacity-10 text-secondary">Inactive</span>
                      )}
                    </td>
                    <td className="text-end">
                      <Link
                        to={`/hrms/employees/${emp.userId}`}
                        className="btn btn-sm btn-outline-primary"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
