/**
 * Audit Dashboard – Inspinia-style KPIs, charts, top users/entities.
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { getTodayLocalDateString } from '../../../utils/dateUtils';
import { auditApi, type AuditDashboardStats } from '../api/auditApi';

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const INS = {
  primary: '#1ab394',
  secondary: '#1c84c6',
  success: '#0acf97',
  info: '#23c6c8',
  warning: '#f8ac59',
  danger: '#ed5565',
  gray: '#6c757d',
  light: '#eef2f7',
};

function formatTooltipValue(value: number) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function AuditDashboard() {
  const today = getTodayLocalDateString();
  const [data, setData] = useState<AuditDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    auditApi
      .getDashboard({ dateFrom, dateTo })
      .then((res) => {
        setData(res.data);
        setError(null);
      })
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : 'Could not load dashboard');
      })
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  const setPreset = useCallback((preset: 'today' | 'yesterday' | 'last7' | 'last30') => {
    const t = getTodayLocalDateString();
    if (preset === 'today') {
      setDateFrom(t);
      setDateTo(t);
    } else if (preset === 'yesterday') {
      const y = addDays(t, -1);
      setDateFrom(y);
      setDateTo(y);
    } else if (preset === 'last7') {
      setDateFrom(addDays(t, -6));
      setDateTo(t);
    } else {
      setDateFrom(addDays(t, -29));
      setDateTo(t);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="container-fluid py-4">
        <div className="d-flex align-items-center gap-2 text-muted">
          <span className="spinner-border spinner-border-sm" role="status" /> Loading dashboard…
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-warning shadow-sm">
          <i className="ti ti-alert-triangle me-2" />
          {error ?? 'Could not load Audit dashboard.'}
        </div>
      </div>
    );
  }

  const {
    totalEvents,
    uniqueUsers,
    byEventType,
    byEntityType,
    byDay,
    byHour,
    topUsers,
    topEntityTypes,
    busiestDay,
    busiestHour,
    mostActiveUser,
  } = data;

  const eventsOverTimeOption: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : null;
        if (!p) return '';
        const idx = (p as { dataIndex?: number }).dataIndex ?? 0;
        const d = byDay[idx];
        if (!d) return '';
        return `<div><strong>${d.date}</strong></div><div>Events: ${formatTooltipValue(d.count)}</div>`;
      },
    },
    grid: { left: 8, right: 20, bottom: 50, top: 20, containLabel: true },
    xAxis: {
      type: 'category',
      data: byDay.map((d) => d.date),
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: INS.gray, margin: 12, rotate: byDay.length > 14 ? 35 : 0 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#676b891f', type: 'dashed' } },
      axisLabel: { color: INS.gray },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        name: 'Events',
        type: 'line',
        smooth: true,
        symbolSize: 4,
        data: byDay.map((d) => d.count),
        itemStyle: { color: INS.primary },
        areaStyle: { opacity: 0.2, color: INS.primary },
      },
    ],
  };

  const byEventTypeOption: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', left: 'left', top: 'center' },
    series: [
      {
        name: 'By Event Type',
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['55%', '50%'],
        itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
        label: { color: INS.gray },
        data: byEventType
          .filter((d) => d.count > 0)
          .map((d) => ({ value: d.count, name: d.eventType || 'Unknown' })),
      },
    ],
  };

  const byEntityTypeOption: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', left: 'left', top: 'center' },
    series: [
      {
        name: 'By Entity Type',
        type: 'pie',
        radius: [60, 100],
        center: ['50%', '50%'],
        roseType: 'area',
        itemStyle: { borderRadius: 8 },
        label: { color: INS.gray, fontSize: 12 },
        data: byEntityType
          .filter((d) => d.count > 0)
          .map((d) => ({ value: d.count, name: d.entityType || 'Unknown', itemStyle: { color: INS.info } })),
      },
    ],
  };

  const hourCounts = Array.from({ length: 24 }, (_, h) => byHour.find((x) => x.hour === h)?.count ?? 0);
  const byHourOption: EChartsOption = {
    title: { text: 'Events by hour of day', left: 'center', textStyle: { fontSize: 14, color: INS.gray } },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : null;
        if (!p) return '';
        const idx = (p as { dataIndex?: number }).dataIndex ?? 0;
        return `<div>${idx}:00 – ${formatTooltipValue(hourCounts[idx] ?? 0)} events</div>`;
      },
    },
    grid: { left: 40, right: 20, bottom: 40, top: 40, containLabel: true },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      axisLabel: { color: INS.gray, fontSize: 10, interval: 1 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#676b891f' } }, axisLabel: { color: INS.gray } },
    series: [{ type: 'bar', data: hourCounts, itemStyle: { color: INS.primary }, barMaxWidth: 24 }],
  };

  return (
    <div className="container-fluid mt-3 audit-dashboard">
      <div className="row">
        <div className="col-12">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div>
              <h2 className="mb-1">Audit Dashboard</h2>
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item"><Link to="/">Home</Link></li>
                  <li className="breadcrumb-item"><Link to="/audit">Audit</Link></li>
                  <li className="breadcrumb-item active">Dashboard</li>
                </ol>
              </nav>
            </div>
            <div className="d-flex flex-wrap gap-2 align-items-center">
              <span className="text-muted small">Date range:</span>
              <div className="d-flex gap-1">
                <button type="button" className={`btn btn-sm ${dateFrom === today && dateTo === today ? 'btn-primary' : 'btn-outline-secondary'}`} onClick={() => setPreset('today')}>Today</button>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPreset('yesterday')}>Yesterday</button>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPreset('last7')}>Last 7 days</button>
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setPreset('last30')}>Last 30 days</button>
              </div>
              <label className="d-flex align-items-center gap-1 small">
                <span className="text-muted">From</span>
                <input type="date" className="form-control form-control-sm" style={{ width: 140 }} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              </label>
              <label className="d-flex align-items-center gap-1 small">
                <span className="text-muted">To</span>
                <input type="date" className="form-control form-control-sm" style={{ width: 140 }} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </label>
              <Link to="/audit/log" className="btn btn-primary btn-sm">
                <i className="ti ti-search me-1" /> Log / Search
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="row row-cols-xxl-4 row-cols-md-2 row-cols-1 align-items-stretch g-3">
        <div className="col">
          <div className="card">
            <div className="card-body">
              <h5 className="mb-0 text-muted small">Total Events</h5>
              <div className="d-flex align-items-center gap-2 my-3">
                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <i className="ti ti-activity fs-5 text-primary" />
                </div>
                <h3 className="mb-0">{totalEvents.toLocaleString()}</h3>
              </div>
              <p className="mb-0">
                <span className="text-primary"><i className="ti ti-point-filled" /></span>
                <span className="text-muted">{dateFrom === dateTo ? dateFrom : `${dateFrom} to ${dateTo}`}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card">
            <div className="card-body">
              <h5 className="mb-0 text-muted small">Unique Users</h5>
              <div className="d-flex align-items-center gap-2 my-3">
                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <i className="ti ti-users fs-5 text-success" />
                </div>
                <h3 className="mb-0">{uniqueUsers.toLocaleString()}</h3>
              </div>
              <p className="mb-0">
                <span className="text-success"><i className="ti ti-point-filled" /></span>
                <span className="text-muted">Active in range</span>
              </p>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card">
            <div className="card-body">
              <h5 className="mb-0 text-muted small">Busiest Day</h5>
              <div className="d-flex align-items-center gap-2 my-3">
                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <i className="ti ti-calendar fs-5 text-info" />
                </div>
                <h3 className="mb-0">{busiestDay ?? '—'}</h3>
              </div>
              <p className="mb-0">
                <span className="text-info"><i className="ti ti-point-filled" /></span>
                <span className="text-muted">Most events</span>
              </p>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card">
            <div className="card-body">
              <h5 className="mb-0 text-muted small">Most Active User</h5>
              <div className="d-flex align-items-center gap-2 my-3">
                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <i className="ti ti-user fs-5 text-warning" />
                </div>
                <h3 className="mb-0 small text-truncate" style={{ maxWidth: 160 }} title={mostActiveUser ?? ''}>{mostActiveUser ?? '—'}</h3>
              </div>
              <p className="mb-0">
                <span className="text-warning"><i className="ti ti-point-filled" /></span>
                <span className="text-muted">Peak hour: {busiestHour != null ? `${busiestHour}:00` : '—'}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3 mt-0">
        <div className="col-lg-8">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Events over time</h5>
            </div>
            <div className="card-body">
              <ReactECharts option={eventsOverTimeOption} style={{ height: 280 }} notMerge />
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">By event type</h5>
            </div>
            <div className="card-body">
              <ReactECharts option={byEventTypeOption} style={{ height: 280 }} notMerge />
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">By entity type</h5>
            </div>
            <div className="card-body">
              <ReactECharts option={byEntityTypeOption} style={{ height: 260 }} notMerge />
            </div>
          </div>
        </div>
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Events by hour of day</h5>
            </div>
            <div className="card-body">
              <ReactECharts option={byHourOption} style={{ height: 260 }} notMerge />
            </div>
          </div>
        </div>
      </div>

      <div className="row g-3">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Top users by activity</h5>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover table-centered mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>User</th>
                      <th className="text-end">Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topUsers.length === 0 ? (
                      <tr><td colSpan={2} className="text-muted text-center py-3">No data</td></tr>
                    ) : (
                      topUsers.map((u, i) => (
                        <tr key={i}>
                          <td>{u.userEmail ?? `User #${u.userId ?? '?'}`}</td>
                          <td className="text-end">{u.count.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Top entity types</h5>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover table-centered mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Entity Type</th>
                      <th className="text-end">Events</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topEntityTypes.length === 0 ? (
                      <tr><td colSpan={2} className="text-muted text-center py-3">No data</td></tr>
                    ) : (
                      topEntityTypes.map((e, i) => (
                        <tr key={i}>
                          <td>{e.entityType || '—'}</td>
                          <td className="text-end">{e.count.toLocaleString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
