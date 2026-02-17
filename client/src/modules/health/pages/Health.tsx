/**
 * System Health – Inspinia-style dashboard with charts and graphs.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
} from 'recharts';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';

interface DatabaseHealth {
  databaseName: string;
  state: string;
  totalSizeBytes: number;
  dataSizeBytes: number;
  logSizeBytes: number;
  tableCount: number;
  connectionCount: number;
  serverVersion: string;
}

interface HealthData {
  cpu: Array<{ model: string; cores: number; speedMhz: number }>;
  cpuUsagePercent?: number;
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPercent: number;
    processRssMb: number;
  };
  disk: Array<{
    path: string;
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usedPercent: number;
  }>;
  database?: DatabaseHealth | null;
  platform: string;
  arch: string;
  uptimeSeconds: number;
  loadAvg: [number, number, number];
}

function formatBytes(n: number): string {
  if (n >= 1024 ** 4) return `${(n / 1024 ** 4).toFixed(2)} TB`;
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(2)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);
  return parts.join(' ');
}

function usageColor(pct: number): string {
  if (pct >= 90) return '#dc3545';
  if (pct >= 70) return '#ffc107';
  return '#198754';
}

const LOAD_AVG_COLORS = ['#1ab394', '#16a085', '#0e6655'];

function normalizeHealthData(raw: HealthData): HealthData {
  const loadAvg = Array.isArray(raw.loadAvg) && raw.loadAvg.length >= 3
    ? [Number(raw.loadAvg[0]) || 0, Number(raw.loadAvg[1]) || 0, Number(raw.loadAvg[2]) || 0] as [number, number, number]
    : [0, 0, 0] as [number, number, number];
  const cpu = Array.isArray(raw.cpu) ? raw.cpu : [];
  const disk = Array.isArray(raw.disk) ? raw.disk : [];
  const mem = raw.memory && typeof raw.memory === 'object'
    ? {
        totalBytes: Number(raw.memory.totalBytes) || 0,
        freeBytes: Number(raw.memory.freeBytes) || 0,
        usedBytes: Number(raw.memory.usedBytes) || 0,
        usedPercent: Number(raw.memory.usedPercent) || 0,
        processRssMb: Number(raw.memory.processRssMb) || 0,
      }
    : { totalBytes: 0, freeBytes: 0, usedBytes: 0, usedPercent: 0, processRssMb: 0 };
  const db = raw.database && typeof raw.database === 'object'
    ? {
        databaseName: String(raw.database.databaseName ?? ''),
        state: String(raw.database.state ?? ''),
        totalSizeBytes: Number(raw.database.totalSizeBytes) || 0,
        dataSizeBytes: Number(raw.database.dataSizeBytes) || 0,
        logSizeBytes: Number(raw.database.logSizeBytes) || 0,
        tableCount: Number(raw.database.tableCount) || 0,
        connectionCount: Number(raw.database.connectionCount) || 0,
        serverVersion: String(raw.database.serverVersion ?? ''),
      }
    : null;
  return {
    cpu,
    cpuUsagePercent: typeof raw.cpuUsagePercent === 'number' ? raw.cpuUsagePercent : 0,
    disk,
    memory: mem,
    database: db,
    platform: String(raw.platform ?? ''),
    arch: String(raw.arch ?? ''),
    uptimeSeconds: Number(raw.uptimeSeconds) || 0,
    loadAvg,
  };
}

export default function Health() {
  const { user } = useAuth();
  const canManageAlerts = user?.permissions?.includes('HEALTH.SETTINGS');
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.get<{ success?: boolean; data?: HealthData }>('/api/health')
      .then((res) => {
        const payload = res && typeof res === 'object' && 'data' in res ? res.data : res;
        if (payload && typeof payload === 'object') setData(normalizeHealthData(payload as HealthData));
        else setError('Invalid health response');
      })
      .catch((e) => setError(e?.message ?? 'Failed to load health'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    document.title = 'System Health | Synchronics ERP';
    return () => { document.title = 'Synchronics ERP'; };
  }, []);

  if (loading && !data) {
    return (
      <div className="container-fluid py-4">
        <div className="d-flex align-items-center gap-2 text-muted">
          <span className="spinner-border spinner-border-sm" role="status" />
          Loading system health...
        </div>
      </div>
    );
  }
  if (error) {
    const is404 = /not found|404/i.test(error);
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-danger">
          <strong>{error}</strong>
          {is404 && (
            <div className="mt-2 small">
              <strong>Check:</strong>
              <ul className="mb-0 mt-1 ps-3">
                <li>Rebuild and restart the API server: <code>npm run build --prefix server</code> then <code>node server/dist/app.js</code></li>
                <li>If using Vite dev server, ensure the API runs on 4001 (or set <code>VITE_PROXY_TARGET</code>)</li>
                <li>If using nginx/IIS on a different port, proxy <code>/api</code> to the backend, or build with <code>VITE_API_URL=http://your-server:4001</code></li>
              </ul>
            </div>
          )}
          <div className="mt-2">
            <Link to="/dashboard" className="btn btn-sm btn-outline-danger">Back to Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }
  if (!data) return null;

  const memPieData = [
    { name: 'Used', value: data.memory.usedBytes, color: usageColor(data.memory.usedPercent) },
    { name: 'Free', value: data.memory.freeBytes, color: '#e9ecef' },
  ];

  const loadChartData = [
    { name: '1 min', load: data.loadAvg[0], fill: LOAD_AVG_COLORS[0] },
    { name: '5 min', load: data.loadAvg[1], fill: LOAD_AVG_COLORS[1] },
    { name: '15 min', load: data.loadAvg[2], fill: LOAD_AVG_COLORS[2] },
  ];

  const diskBarData = data.disk.map((d) => ({
    path: d.path.replace(/[\\/]+$/, '') || d.path,
    usedPercent: d.usedPercent,
    used: formatBytes(d.usedBytes),
    total: formatBytes(d.totalBytes),
    fill: usageColor(d.usedPercent),
  }));

  const memGaugeData = [{ name: 'Memory', value: data.memory.usedPercent, fill: usageColor(data.memory.usedPercent) }];
  const primaryDisk = data.disk[0];
  const cpuInfo = data.cpu[0];

  return (
    <div className="container-fluid py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h4 mb-1">System Health</h1>
          <p className="text-muted small mb-0">CPU, memory, disk, and database metrics</p>
        </div>
        <div className="d-flex gap-2">
          {canManageAlerts && (
            <Link to="/health/settings" className="btn btn-outline-primary btn-sm">
              <i className="ti ti-bell me-1" /> Alert Settings
            </Link>
          )}
          <Link to="/dashboard" className="btn btn-outline-secondary btn-sm">
            <i className="ti ti-arrow-left me-1" /> Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100 overflow-hidden hover-lift">
            <div className="card-body d-flex align-items-center">
              <div className="rounded-circle bg-primary bg-opacity-10 p-3 me-3 flex-shrink-0">
                <i className="ti ti-cpu text-primary fs-4" />
              </div>
              <div className="min-w-0">
                <h6 className="text-muted small mb-1">Memory</h6>
                <h3 className="mb-0">{data.memory.usedPercent}%</h3>
                <span className="small text-muted">RAM used</span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100 overflow-hidden hover-lift">
            <div className="card-body d-flex align-items-center">
              <div className="rounded-circle bg-success bg-opacity-10 p-3 me-3 flex-shrink-0">
                <i className="ti ti-device-hard-drive text-success fs-4" />
              </div>
              <div className="min-w-0">
                <h6 className="text-muted small mb-1">Primary disk</h6>
                <h3 className="mb-0">{primaryDisk ? `${primaryDisk.usedPercent}%` : '—'}</h3>
                <span className="small text-muted truncate d-block">{primaryDisk?.path ?? 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100 overflow-hidden hover-lift">
            <div className="card-body d-flex align-items-center">
              <div className="rounded-circle bg-info bg-opacity-10 p-3 me-3 flex-shrink-0">
                <i className="ti ti-cpu text-info fs-4" />
              </div>
              <div className="min-w-0">
                <h6 className="text-muted small mb-1">CPU usage</h6>
                <h3 className="mb-0">{typeof data.cpuUsagePercent === 'number' ? `${data.cpuUsagePercent}%` : '—'}</h3>
                <span className="small text-muted">{cpuInfo ? `${cpuInfo.cores} cores @ ${cpuInfo.speedMhz} MHz` : 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="col-6 col-lg-3">
          <div className="card border-0 shadow-sm h-100 overflow-hidden hover-lift">
            <div className="card-body d-flex align-items-center">
              <div className="rounded-circle bg-warning bg-opacity-10 p-3 me-3 flex-shrink-0">
                <i className="ti ti-clock text-warning fs-4" />
              </div>
              <div className="min-w-0">
                <h6 className="text-muted small mb-1">Uptime</h6>
                <h3 className="mb-0">{formatUptime(data.uptimeSeconds)}</h3>
                <span className="small text-muted">Server runtime</span>
              </div>
            </div>
          </div>
        </div>
        {data.database && (
          <div className="col-6 col-lg-3">
            <div className="card border-0 shadow-sm h-100 overflow-hidden hover-lift">
              <div className="card-body d-flex align-items-center">
                <div className="rounded-circle bg-secondary bg-opacity-10 p-3 me-3 flex-shrink-0">
                  <i className="ti ti-database text-secondary fs-4" />
                </div>
                <div className="min-w-0">
                  <h6 className="text-muted small mb-1">Database</h6>
                  <h3 className="mb-0">{formatBytes(data.database.totalSizeBytes)}</h3>
                  <span className="small text-muted">{data.database.databaseName || 'SQL Server'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="row g-3 mb-4">
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-transparent">
              <h6 className="mb-0">Memory usage gauge</h6>
            </div>
            <div className="card-body d-flex justify-content-center" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="60%" outerRadius="100%" barSize={16} data={memGaugeData}>
                  <RadialBar background dataKey="value" cornerRadius={8} />
                  <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fontSize={24} fontWeight={600}>
                    {data.memory.usedPercent}%
                  </text>
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="card-footer bg-transparent py-2 small text-muted">
              Node.js RSS: {data.memory.processRssMb} MB
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-transparent">
              <h6 className="mb-0">Memory distribution</h6>
            </div>
            <div className="card-body" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={memPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" label={({ name, value }) => `${name}: ${formatBytes(value)}`}>
                    {memPieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => (typeof v === 'number' ? formatBytes(v) : String(v))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card-footer bg-transparent py-2 small text-muted">
              Total: {formatBytes(data.memory.totalBytes)} · Used: {formatBytes(data.memory.usedBytes)} · Free: {formatBytes(data.memory.freeBytes)}
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-transparent">
              <h6 className="mb-0">Load average</h6>
            </div>
            <div className="card-body" style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={loadChartData} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 'auto']} allowDecimals />
                  <YAxis type="category" dataKey="name" width={55} />
                  <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : String(v))} />
                  <Bar dataKey="load" name="Load" radius={[0, 4, 4, 0]}>
                    {loadChartData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card-footer bg-transparent py-2 small text-muted">
              Unix: 1m, 5m, 15m avg · Windows: typically 0
            </div>
          </div>
        </div>
      </div>

      {data.database && (
        <div className="row g-3 mb-4">
          <div className="col-lg-12">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-transparent">
                <h6 className="mb-0"><i className="ti ti-database me-2" />Database health</h6>
              </div>
              <div className="card-body">
                <div className="row g-3">
                  <div className="col-md-6 col-lg-3">
                    <div className="border rounded p-3">
                      <span className="text-muted small d-block">Total size</span>
                      <span className="fs-4 fw-semibold">{formatBytes(data.database.totalSizeBytes)}</span>
                    </div>
                  </div>
                  <div className="col-md-6 col-lg-3">
                    <div className="border rounded p-3">
                      <span className="text-muted small d-block">Data files</span>
                      <span className="fs-4 fw-semibold">{formatBytes(data.database.dataSizeBytes)}</span>
                    </div>
                  </div>
                  <div className="col-md-6 col-lg-3">
                    <div className="border rounded p-3">
                      <span className="text-muted small d-block">Log files</span>
                      <span className="fs-4 fw-semibold">{formatBytes(data.database.logSizeBytes)}</span>
                    </div>
                  </div>
                  <div className="col-md-6 col-lg-3">
                    <div className="border rounded p-3">
                      <span className="text-muted small d-block">Tables / Connections</span>
                      <span className="fs-4 fw-semibold">{data.database.tableCount} / {data.database.connectionCount}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-top">
                  <table className="table table-sm table-borderless mb-0">
                    <tbody>
                      <tr>
                        <td className="text-muted" style={{ width: 120 }}>Database</td>
                        <td><code>{data.database.databaseName || '—'}</code></td>
                      </tr>
                      <tr>
                        <td className="text-muted">State</td>
                        <td><span className="badge bg-success">{data.database.state}</span></td>
                      </tr>
                      <tr>
                        <td className="text-muted">SQL Server version</td>
                        <td className="small font-monospace">{data.database.serverVersion || '—'}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {data.database.totalSizeBytes > 0 && (
                  <div className="mt-3">
                    <span className="text-muted small">Data vs Log: </span>
                    <div className="progress mt-1" style={{ height: 8 }}>
                      <div
                        className="progress-bar bg-primary"
                        style={{ width: `${(data.database.dataSizeBytes / data.database.totalSizeBytes) * 100}%` }}
                        title="Data"
                      />
                      <div
                        className="progress-bar bg-info"
                        style={{ width: `${(data.database.logSizeBytes / data.database.totalSizeBytes) * 100}%` }}
                        title="Log"
                      />
                    </div>
                    <small className="text-muted">
                      Data {formatBytes(data.database.dataSizeBytes)} · Log {formatBytes(data.database.logSizeBytes)}
                    </small>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {!data.database && (
        <div className="row g-3 mb-4">
          <div className="col-12">
            <div className="card border-0 shadow-sm border-start border-3 border-warning">
              <div className="card-body py-3">
                <i className="ti ti-database-off me-2 text-warning" />
                <span className="text-muted">Database health unavailable (connection failed or not configured)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="row g-3 mb-4">
        <div className="col-lg-8">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-transparent">
              <h6 className="mb-0">Disk usage by drive</h6>
            </div>
            <div className="card-body" style={{ minHeight: 280 }}>
              {diskBarData.length === 0 ? (
                <p className="text-muted mb-0">No disk information available.</p>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, diskBarData.length * 56)}>
                  <BarChart data={diskBarData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} unit="%" tickFormatter={(v) => `${v}%`} />
                    <YAxis type="category" dataKey="path" width={75} tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(v) => `${typeof v === 'number' ? v : 0}%`}
                      content={({ active, payload }) =>
                        active && payload?.length ? (
                          <div className="p-2 bg-white border rounded shadow-sm small">
                            <strong>{payload[0]?.payload?.path}</strong>
                            <br />
                            Usage: {payload[0]?.value}%
                            <br />
                            Used: {payload[0]?.payload?.used} / {payload[0]?.payload?.total}
                          </div>
                        ) : null
                      }
                    />
                    <Bar dataKey="usedPercent" name="Usage %" radius={[0, 4, 4, 0]}>
                      {diskBarData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card border-0 shadow-sm h-100">
            <div className="card-header bg-transparent">
              <h6 className="mb-0">System info</h6>
            </div>
            <div className="card-body">
              <table className="table table-sm table-borderless mb-0">
                <tbody>
                  <tr>
                    <td className="text-muted" style={{ width: 100 }}>Platform</td>
                    <td>{data.platform}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Architecture</td>
                    <td>{data.arch}</td>
                  </tr>
                  <tr>
                    <td className="text-muted">Uptime</td>
                    <td>{formatUptime(data.uptimeSeconds)}</td>
                  </tr>
                  {cpuInfo && (
                    <>
                      <tr>
                        <td className="text-muted">CPU model</td>
                        <td className="small">{cpuInfo.model}</td>
                      </tr>
                      <tr>
                        <td className="text-muted">Cores / Speed</td>
                        <td>{cpuInfo.cores} cores @ {cpuInfo.speedMhz} MHz</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
