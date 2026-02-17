import { useState, useCallback, useEffect } from 'react';
import { api } from '../../../api/client';
import { Link } from 'react-router-dom';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { formatDateTimeInAppTz } from '../../../utils/dateUtils';
import { SearchableSelect } from '../../../components/SearchableSelect';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

type ReportKind = 'summary' | 'warranty' | 'assignments';

interface SummaryData {
  kpis: {
    totalAssets: number;
    availableAssets: number;
    issuedAssets: number;
    underRepairAssets: number;
    totalPurchaseValue: number;
    openTickets: number;
    totalUsers: number;
  };
  assetsByStatus: { status: string; count: number }[];
  assetsByCategory: { categoryName: string; count: number }[];
  recentAuditCount: number;
}

interface WarrantyRow {
  assetId: number;
  assetTag: string;
  categoryName: string | null;
  status: string;
  warrantyExpiry: string | null;
  purchasePrice: number | null;
  locationName: string | null;
  assignedToUserName: string | null;
  warrantyStatus: string;
}

interface AssignmentRow {
  assignmentId: number;
  assetTag: string;
  categoryName: string | null;
  assignedToUserName: string;
  assignedByUserName: string;
  assignedAt: string;
  returnedAt: string | null;
  returnedByUserName: string | null;
  assignmentType: string;
}

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#198754',
  ISSUED: '#0d6efd',
  UNDER_REPAIR: '#fd7e14',
  SCRAPPED: '#6c757d',
  LOST: '#dc3545',
};

const REPORT_OPTIONS: { value: ReportKind; label: string }[] = [
  { value: 'summary', label: 'Asset Summary' },
  { value: 'warranty', label: 'Warranty Report' },
  { value: 'assignments', label: 'Assignment Activity' },
];

export default function Reports() {
  useEffect(() => {
    document.title = 'Assets Reports | Synchronics ERP';
    return () => { document.title = 'Synchronics ERP'; };
  }, []);
  const { timeZone } = useAppSettings();
  const [reportType, setReportType] = useState<ReportKind>('summary');
  const [assignmentDays, setAssignmentDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [warranty, setWarranty] = useState<WarrantyRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const generate = useCallback(() => {
    setLoading(true);
    setError(null);
    setSummary(null);
    setWarranty([]);
    setAssignments([]);
    setGeneratedAt(null);

    const run = async () => {
      try {
        if (reportType === 'summary') {
          const res = await api.get<{ success: boolean; data: SummaryData }>('/api/reports/summary');
          setSummary(res.data);
        } else if (reportType === 'warranty') {
          const res = await api.get<{ success: boolean; data: WarrantyRow[] }>('/api/reports/warranty');
          setWarranty(res.data ?? []);
        } else {
          const res = await api.get<{ success: boolean; data: AssignmentRow[] }>(
            `/api/reports/assignments?days=${assignmentDays}`
          );
          setAssignments(res.data ?? []);
        }
        setGeneratedAt(new Date().toISOString());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [reportType, assignmentDays]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const exportCsv = useCallback(() => {
    if (reportType === 'warranty' && warranty.length > 0) {
      const headers = ['Asset Tag', 'Category', 'Status', 'Warranty Expiry', 'Value', 'Location', 'Assigned To', 'Warranty Status'];
      const rows = warranty.map((r) => [
        r.assetTag,
        r.categoryName ?? '',
        r.status,
        r.warrantyExpiry ?? '',
        r.purchasePrice ?? '',
        r.locationName ?? '',
        r.assignedToUserName ?? '',
        r.warrantyStatus,
      ]);
      const csv = [headers.join(','), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `warranty-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else if (reportType === 'assignments' && assignments.length > 0) {
      const headers = ['Asset', 'Category', 'Assigned To', 'Issued By', 'Issued At', 'Returned At', 'Returned By', 'Type'];
      const rows = assignments.map((r) => [
        r.assetTag,
        r.categoryName ?? '',
        r.assignedToUserName,
        r.assignedByUserName,
        r.assignedAt,
        r.returnedAt ?? '',
        r.returnedByUserName ?? '',
        r.assignmentType,
      ]);
      const csv = [headers.join(','), ...rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `assignments-report-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [reportType, warranty, assignments]);

  const hasReport = summary !== null || warranty.length > 0 || assignments.length > 0;

  return (
    <div className="container-fluid py-3">
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Assets Reports</h4>
      </div>

      <div className="card shadow-sm mb-4 no-print">
        <div className="card-body">
          <h6 className="text-muted mb-3">Generate report</h6>
          <div className="row g-3 align-items-end">
            <div className="col-md-4">
              <label className="form-label small">Report type</label>
              <SearchableSelect
                options={REPORT_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                value={reportType}
                onChange={(v) => setReportType(v as ReportKind)}
                placeholder="Select report"
                allowEmpty={false}
              />
            </div>
            {reportType === 'assignments' && (
              <div className="col-md-3">
                <label className="form-label small">Last (days)</label>
                <SearchableSelect
                  options={[7, 14, 30, 60, 90].map((d) => ({ value: d, label: `${d} days` }))}
                  value={assignmentDays}
                  onChange={(v) => setAssignmentDays(Number(v))}
                  placeholder="Select"
                  allowEmpty={false}
                />
              </div>
            )}
            <div className="col-md-2">
              <button type="button" className="btn btn-primary w-100" onClick={generate} disabled={loading}>
                {loading ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </div>
          {error && <p className="text-danger small mt-2 mb-0">{error}</p>}
        </div>
      </div>

      {hasReport && (
        <div className="report-content">
          <div className="card shadow-sm mb-4">
            <div className="card-body">
              <div className="d-flex flex-wrap justify-content-between align-items-start no-print mb-3">
                <h5 className="mb-0">
                  {REPORT_OPTIONS.find((o) => o.value === reportType)?.label} Report
                </h5>
                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={handlePrint}>
                    Print / Save as PDF
                  </button>
                  {(reportType === 'warranty' && warranty.length > 0) || (reportType === 'assignments' && assignments.length > 0) ? (
                    <button type="button" className="btn btn-outline-primary btn-sm" onClick={exportCsv}>
                      Export CSV
                    </button>
                  ) : null}
                </div>
              </div>
              {generatedAt && (
                <p className="text-muted small mb-4">Generated on {formatDateTimeInAppTz(generatedAt, timeZone)}</p>
              )}

              {reportType === 'summary' && summary && (
                <>
                  <div className="row g-3 mb-4">
                    <div className="col-6 col-md-4 col-lg-2">
                      <div className="p-3 rounded-3 bg-primary bg-opacity-10 border border-primary border-opacity-25">
                        <div className="small text-muted">Total Assets</div>
                        <div className="h4 mb-0 text-primary">{summary.kpis.totalAssets}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-4 col-lg-2">
                      <div className="p-3 rounded-3 bg-success bg-opacity-10 border border-success border-opacity-25">
                        <div className="small text-muted">Available</div>
                        <div className="h4 mb-0 text-success">{summary.kpis.availableAssets}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-4 col-lg-2">
                      <div className="p-3 rounded-3 bg-info bg-opacity-10 border border-info border-opacity-25">
                        <div className="small text-muted">Issued</div>
                        <div className="h4 mb-0 text-info">{summary.kpis.issuedAssets}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-4 col-lg-2">
                      <div className="p-3 rounded-3 bg-warning bg-opacity-10 border border-warning border-opacity-25">
                        <div className="small text-muted">Under Repair</div>
                        <div className="h4 mb-0 text-warning">{summary.kpis.underRepairAssets}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-4 col-lg-2">
                      <div className="p-3 rounded-3 bg-secondary bg-opacity-10 border border-secondary border-opacity-25">
                        <div className="small text-muted">Total Value</div>
                        <div className="h5 mb-0">{Number(summary.kpis.totalPurchaseValue).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="col-6 col-md-4 col-lg-2">
                      <div className="p-3 rounded-3 bg-dark bg-opacity-10 border border-dark border-opacity-25">
                        <div className="small text-muted">Open Tickets</div>
                        <div className="h4 mb-0">{summary.kpis.openTickets}</div>
                      </div>
                    </div>
                  </div>
                  <div className="row g-4">
                    <div className="col-md-6">
                      <h6 className="border-bottom pb-2 mb-3">Assets by status</h6>
                      <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                          <Pie
                            data={summary.assetsByStatus}
                            dataKey="count"
                            nameKey="status"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={((props: unknown) => { const e = props as { status?: string; count?: number }; return `${e.status ?? ''}: ${e.count ?? 0}`; })}
                          >
                            {summary.assetsByStatus.map((e) => (
                              <Cell key={e.status} fill={STATUS_COLORS[e.status] || '#6c757d'} />
                            ))}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="col-md-6">
                      <h6 className="border-bottom pb-2 mb-3">Assets by category</h6>
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={summary.assetsByCategory.slice(0, 12)} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="categoryName" angle={-35} textAnchor="end" interval={0} height={70} />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" name="Assets" fill="#0d6efd" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}

              {reportType === 'warranty' && (
                <>
                  <h6 className="border-bottom pb-2 mb-3">Warranty status</h6>
                  <div className="table-responsive">
                    <table className="table table-sm table-hover">
                      <thead>
                        <tr>
                          <th>Asset</th>
                          <th>Category</th>
                          <th>Status</th>
                          <th>Warranty expiry</th>
                          <th>Value</th>
                          <th>Location</th>
                          <th>Assigned to</th>
                          <th>Warranty</th>
                        </tr>
                      </thead>
                      <tbody>
                        {warranty.map((r) => (
                          <tr key={r.assetId}>
                            <td><Link to={`/assets/${r.assetId}`} className="text-decoration-none">{r.assetTag}</Link></td>
                            <td>{r.categoryName ?? '—'}</td>
                            <td><span className="badge bg-secondary">{r.status}</span></td>
                            <td>{r.warrantyExpiry ?? '—'}</td>
                            <td>{r.purchasePrice != null ? Number(r.purchasePrice).toLocaleString() : '—'}</td>
                            <td>{r.locationName ?? '—'}</td>
                            <td>{r.assignedToUserName ?? '—'}</td>
                            <td>
                              <span className={`badge ${r.warrantyStatus === 'expired' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                                {r.warrantyStatus === 'expired' ? 'Expired' : 'Expiring'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {warranty.length === 0 && <p className="text-muted mb-0">No assets with warranty data.</p>}
                </>
              )}

              {reportType === 'assignments' && (
                <>
                  <h6 className="border-bottom pb-2 mb-3">Assignment activity (last {assignmentDays} days)</h6>
                  <div className="table-responsive">
                    <table className="table table-sm table-hover">
                      <thead>
                        <tr>
                          <th>Asset</th>
                          <th>Category</th>
                          <th>Assigned to</th>
                          <th>Issued by</th>
                          <th>Issued at</th>
                          <th>Returned at</th>
                          <th>Returned by</th>
                          <th>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignments.map((r) => (
                          <tr key={r.assignmentId}>
                            <td>{r.assetTag}</td>
                            <td>{r.categoryName ?? '—'}</td>
                            <td>{r.assignedToUserName}</td>
                            <td>{r.assignedByUserName}</td>
                            <td>{r.assignedAt}</td>
                            <td>{r.returnedAt ?? '—'}</td>
                            <td>{r.returnedByUserName ?? '—'}</td>
                            <td><span className="badge bg-secondary">{r.assignmentType}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {assignments.length === 0 && <p className="text-muted mb-0">No assignments in this period.</p>}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
