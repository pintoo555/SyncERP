/**
 * Call Matrix Dashboard – Inspinia theme style.
 * Charts and layout inspired by https://webapplayers.com/inspinia/classic/index.html
 */
import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { getTodayLocalDateString } from '../../../utils/dateUtils';
import { callMatrixApi, type CallMatrixDashboardStats } from '../api/callMatrixApi';

function addDays(dateStr: string, delta: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/* Inspinia theme colors (from DashboardAdmin / Inspinia variables) */
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

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatAvgDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0s';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatTooltipValue(value: number) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export default function CallMatrixDashboard() {
  const today = getTodayLocalDateString();
  const [data, setData] = useState<CallMatrixDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);

  const load = useCallback(() => {
    setLoading(true);
    callMatrixApi
      .getDashboardStats({ dateFrom, dateTo })
      .then((res) => setData(res.data))
      .catch(() => setData(null))
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
          Could not load Call Matrix dashboard.
        </div>
      </div>
    );
  }

  const {
    totalCalls,
    incomingCount,
    outgoingCount,
    avgDurationSeconds,
    callsByDay,
    callsByDirection,
    callsByType,
    topCallers,
    topCallees,
    durationDistribution,
    callsByHour = [],
    heatmap = [],
    internalCount = 0,
    externalCount = 0,
    internalByExtension = [],
  } = data;

  /* Inspinia-style line/area: Calls over time (Revenue chart style) */
  const callsOverTimeOption: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : null;
        if (!p) return '';
        const idx = (p as { dataIndex?: number }).dataIndex ?? 0;
        const d = callsByDay[idx];
        if (!d) return '';
        return `<div><strong>${d.date}</strong></div><div>Total: ${formatTooltipValue(d.total)}</div><div>Incoming: ${formatTooltipValue(d.incoming)}</div><div>Outgoing: ${formatTooltipValue(d.outgoing)}</div>`;
      },
    },
    legend: { data: ['Incoming', 'Outgoing'], bottom: 0 },
    grid: { left: 8, right: 20, bottom: 50, top: 20, containLabel: true },
    xAxis: {
      type: 'category',
      data: callsByDay.map((d) => d.date),
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: INS.gray, margin: 12, rotate: callsByDay.length > 14 ? 35 : 0 },
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
      { name: 'Incoming', type: 'line', smooth: true, symbolSize: 4, data: callsByDay.map((d) => d.incoming), itemStyle: { color: INS.success }, areaStyle: { opacity: 0.2, color: INS.success } },
      { name: 'Outgoing', type: 'line', smooth: true, symbolSize: 4, data: callsByDay.map((d) => d.outgoing), itemStyle: { color: INS.secondary }, areaStyle: { opacity: 0.2, color: INS.secondary } },
    ],
  };

  /* Inspinia rose/donut – By direction (Project Progress style) */
  const byDirectionOption: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      name: 'Direction',
      type: 'pie',
      radius: [60, 100],
      center: ['50%', '50%'],
      roseType: 'area',
      itemStyle: { borderRadius: 8 },
      label: { color: INS.gray, fontSize: 12 },
      data: callsByDirection
        .filter((d) => d.count > 0)
        .map((d) => ({
          value: d.count,
          name: d.direction || 'Unknown',
          itemStyle: { color: d.direction === 'Incoming' ? INS.success : INS.secondary },
        })),
    }],
  };

  /* Donut – By type */
  const byTypeOption: EChartsOption = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', left: 'left', top: 'center' },
    series: [{
      name: 'By Type',
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['55%', '50%'],
      itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
      label: { color: INS.gray },
      data: callsByType
        .filter((d) => d.count > 0)
        .map((d) => ({ value: d.count, name: d.callType || 'Unknown' })),
    }],
  };

  /* Bar – Top callers (clean axis) */
  const topCallersOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 8, bottom: 60, top: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: topCallers.map((c) => (c.number || '—').length > 12 ? (c.number || '').slice(0, 12) + '…' : (c.number || '—')),
      axisLabel: { color: INS.gray, rotate: 45 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#676b891f' } }, axisLabel: { color: INS.gray } },
    series: [{ type: 'bar', data: topCallers.map((c) => c.count), itemStyle: { color: INS.primary } }],
  };

  /* Bar – Top callees */
  const topCalleesOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 8, bottom: 60, top: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: topCallees.map((c) => (c.number || '—').length > 12 ? (c.number || '').slice(0, 12) + '…' : (c.number || '—')),
      axisLabel: { color: INS.gray, rotate: 45 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#676b891f' } }, axisLabel: { color: INS.gray } },
    series: [{ type: 'bar', data: topCallees.map((c) => c.count), itemStyle: { color: INS.info } }],
  };

  /* Bar – Duration distribution */
  const durationOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    grid: { left: 8, right: 8, bottom: 30, top: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: durationDistribution.map((d) => d.label),
      axisLabel: { color: INS.gray },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#676b891f' } }, axisLabel: { color: INS.gray } },
    series: [{ type: 'bar', data: durationDistribution.map((d) => d.count), itemStyle: { color: INS.warning } }],
  };

  /* Busiest time of day – Calls by hour (0–23) */
  const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  const hourCounts = Array.from({ length: 24 }, (_, h) => callsByHour.find((x) => x.hour === h)?.count ?? 0);
  const callsByHourOption: EChartsOption = {
    title: { text: 'Calls by hour of day', left: 'center', textStyle: { fontSize: 14, color: INS.gray } },
    tooltip: { trigger: 'axis', formatter: (params: unknown) => {
      const p = Array.isArray(params) ? params[0] : null;
      if (!p) return '';
      const idx = (p as { dataIndex?: number }).dataIndex ?? 0;
      return `<div>${hourLabels[idx] ?? ''} – ${formatTooltipValue(hourCounts[idx] ?? 0)} calls</div>`;
    }},
    grid: { left: 40, right: 20, bottom: 40, top: 40, containLabel: true },
    xAxis: {
      type: 'category',
      data: hourLabels,
      axisLabel: { color: INS.gray, fontSize: 10, interval: 1 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: '#676b891f' } }, axisLabel: { color: INS.gray } },
    series: [{ type: 'bar', data: hourCounts, itemStyle: { color: INS.primary }, barMaxWidth: 24 }],
  };

  /* Heatmap: day of week (y) x hour (x). SQL Server WEEKDAY: 1=Sun … 7=Sat → index 0–6 */
  const heatmapData: [number, number, number][] = heatmap.map((c) => {
    const dayIndex = c.dayOfWeek - 1;
    return [c.hour, dayIndex, c.count];
  });
  const heatmapOption: EChartsOption = {
    tooltip: {
      position: 'top',
      formatter: (params: unknown) => {
        const p = params as { data?: [number, number, number] };
        if (!p?.data) return '';
        const [hour, dayIdx, count] = p.data;
        return `<div><strong>${DAY_LABELS[dayIdx] ?? ''} ${hour}:00</strong></div><div>${formatTooltipValue(count)} calls</div>`;
      },
    },
    grid: { left: 50, right: 30, bottom: 50, top: 20, containLabel: true },
    xAxis: {
      type: 'category',
      data: hourLabels,
      splitArea: { show: false },
      axisLabel: { interval: 1, color: INS.gray, fontSize: 10 },
    },
    yAxis: {
      type: 'category',
      data: DAY_LABELS,
      splitArea: { show: false },
      axisLabel: { color: INS.gray },
    },
    visualMap: {
      min: 0,
      max: Math.max(1, ...heatmap.map((c) => c.count)) || 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: { color: [INS.light, INS.primary] },
      textStyle: { color: INS.gray },
    },
    series: [{
      name: 'Calls',
      type: 'heatmap',
      data: heatmapData,
      emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0,0,0,0.2)' } },
    }],
  };

  const busiestHour = hourCounts.reduce((best, c, i) => (c > (hourCounts[best] ?? 0) ? i : best), 0);

  return (
    <div className="container-fluid mt-3 call-matrix-dashboard">
      {/* Header row – Inspinia style */}
      <div className="row">
        <div className="col-12">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-3">
            <div>
              <h2 className="mb-1">Call Matrix Dashboard</h2>
              <nav aria-label="breadcrumb">
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item"><Link to="/">Home</Link></li>
                  <li className="breadcrumb-item"><Link to="/call-matrix">Call Matrix</Link></li>
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
              <Link to="/call-matrix/search" className="btn btn-primary btn-sm">
                <i className="ti ti-search me-1" /> Search
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* KPI row – Inspinia “My Tasks” style cards */}
      <div className="row row-cols-xxl-5 row-cols-md-3 row-cols-1 align-items-stretch g-3">
        <div className="col">
          <div className="card">
            <div className="card-body">
              <h5 className="mb-0 text-muted small">Total Calls</h5>
              <div className="d-flex align-items-center gap-2 my-3">
                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <i className="ti ti-phone fs-5 text-primary" />
                </div>
                <h3 className="mb-0">{totalCalls.toLocaleString()}</h3>
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
              <h5 className="mb-0 text-muted small">Incoming</h5>
              <div className="d-flex align-items-center gap-2 my-3">
                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <i className="ti ti-phone-incoming fs-5 text-success" />
                </div>
                <h3 className="mb-0">{incomingCount.toLocaleString()}</h3>
              </div>
              <p className="mb-0">
                <span className="text-success"><i className="ti ti-point-filled" /></span>
                <span className="text-muted">Received</span>
              </p>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card">
            <div className="card-body">
              <h5 className="mb-0 text-muted small">Outgoing</h5>
              <div className="d-flex align-items-center gap-2 my-3">
                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <i className="ti ti-phone-outgoing fs-5 text-info" />
                </div>
                <h3 className="mb-0">{outgoingCount.toLocaleString()}</h3>
              </div>
              <p className="mb-0">
                <span className="text-info"><i className="ti ti-point-filled" /></span>
                <span className="text-muted">Placed</span>
              </p>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card">
            <div className="card-body">
              <h5 className="mb-0 text-muted small">Avg Duration</h5>
              <div className="d-flex align-items-center gap-2 my-3">
                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <i className="ti ti-clock fs-5 text-warning" />
                </div>
                <h3 className="mb-0">{formatAvgDuration(avgDurationSeconds)}</h3>
              </div>
              <p className="mb-0">
                <span className="text-warning"><i className="ti ti-point-filled" /></span>
                <span className="text-muted">Per call</span>
              </p>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card">
            <div className="card-body">
              <h5 className="mb-0 text-muted small">Busiest hour</h5>
              <div className="d-flex align-items-center gap-2 my-3">
                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <i className="ti ti-chart-bar fs-5 text-secondary" />
                </div>
                <h3 className="mb-0">{busiestHour}:00</h3>
              </div>
              <p className="mb-0">
                <span className="text-secondary"><i className="ti ti-point-filled" /></span>
                <span className="text-muted">Peak time</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Internal vs External – separate details and stats */}
      <div className="row g-3 mt-0">
        <div className="col-12">
          <h5 className="text-muted mb-2">Internal vs External</h5>
        </div>
        <div className="col-md-6 col-lg-3">
          <div className="card border-primary border-opacity-25">
            <div className="card-body">
              <h5 className="mb-0 text-muted small">Internal Calls</h5>
              <div className="d-flex align-items-center gap-2 my-3">
                <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <i className="ti ti-phone-call fs-5 text-primary" />
                </div>
                <h3 className="mb-0">{internalCount.toLocaleString()}</h3>
              </div>
              <p className="mb-0">
                <span className="text-primary"><i className="ti ti-point-filled" /></span>
                <span className="text-muted">Extension-to-extension</span>
              </p>
            </div>
          </div>
        </div>
        <div className="col-md-6 col-lg-3">
          <div className="card border-secondary border-opacity-25">
            <div className="card-body">
              <h5 className="mb-0 text-muted small">External Calls</h5>
              <div className="d-flex align-items-center gap-2 my-3">
                <div className="rounded-circle bg-secondary bg-opacity-10 d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <i className="ti ti-phone fs-5 text-secondary" />
                </div>
                <h3 className="mb-0">{externalCount.toLocaleString()}</h3>
              </div>
              <p className="mb-0">
                <span className="text-secondary"><i className="ti ti-point-filled" /></span>
                <span className="text-muted">Outside lines</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Internal Records Only – Graphical: bar chart + donut */}
      <div className="row g-3 mt-0">
        <div className="col-12">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <div>
                <h5 className="card-title mb-0">Internal Records Only</h5>
                <p className="text-muted small mb-0">Calls by extension (Call Direction = Internal)</p>
              </div>
              <span className="badge text-bg-primary">{internalByExtension.length} extension{internalByExtension.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="card-body">
              {internalByExtension.length === 0 ? (
                <div className="p-4 text-center text-muted">
                  No internal call records in the selected period. Internal calls are those with Call Direction = &quot;Internal&quot;.
                </div>
              ) : (
                <div className="row g-3">
                  <div className="col-lg-8">
                    <h6 className="text-muted small mb-2">Calls by extension (stacked)</h6>
                    <div style={{ minHeight: 320 }}>
                      <ReactECharts
                        option={{
                          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
                          legend: { data: ['Outgoing', 'Incoming'], bottom: 0 },
                          grid: { left: 8, right: 20, bottom: 50, top: 24, containLabel: true },
                          xAxis: {
                            type: 'category',
                            data: internalByExtension.map((r) => r.extension),
                            axisLabel: { color: INS.gray, rotate: internalByExtension.length > 8 ? 45 : 0 },
                          },
                          yAxis: { type: 'value', splitLine: { lineStyle: { color: '#676b891f' } }, axisLabel: { color: INS.gray } },
                          series: [
                            { name: 'Outgoing', type: 'bar', stack: 'internal', data: internalByExtension.map((r) => r.outgoingCount), itemStyle: { color: INS.secondary } },
                            { name: 'Incoming', type: 'bar', stack: 'internal', data: internalByExtension.map((r) => r.incomingCount), itemStyle: { color: INS.success } },
                          ],
                        }}
                        style={{ height: 320 }}
                        opts={{ renderer: 'canvas' }}
                      />
                    </div>
                  </div>
                  <div className="col-lg-4">
                    <h6 className="text-muted small mb-2">Share by extension</h6>
                    <div style={{ minHeight: 320 }}>
                      <ReactECharts
                        option={{
                          tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                          series: [{
                            name: 'Internal',
                            type: 'pie',
                            radius: ['42%', '72%'],
                            center: ['50%', '50%'],
                            data: internalByExtension.map((r) => ({ value: r.totalCalls, name: r.extension })),
                            itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
                            label: { color: INS.gray, fontSize: 11 },
                          }],
                        }}
                        style={{ height: 320 }}
                        opts={{ renderer: 'canvas' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top row – Calls over time (line/area) + By direction (rose donut) – Inspinia layout */}
      <div className="row g-3 mt-3">
        <div className="col-lg-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0">Calls Over Time</h5>
              <Link to="/call-matrix/search" className="text-decoration-underline small fw-semibold">View Search</Link>
            </div>
            <div className="card-body">
              <div style={{ minHeight: 280 }}>
                {callsByDay.length > 0 ? (
                  <ReactECharts option={callsOverTimeOption} style={{ height: 280 }} opts={{ renderer: 'canvas' }} />
                ) : (
                  <div className="d-flex align-items-center justify-content-center text-muted py-5">No data for selected period</div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">By Direction</h5>
              <p className="text-muted small mb-0">Incoming vs Outgoing</p>
            </div>
            <div className="card-body">
              <div style={{ minHeight: 260 }}>
                {callsByDirection.some((d) => d.count > 0) ? (
                  <ReactECharts option={byDirectionOption} style={{ height: 260 }} opts={{ renderer: 'canvas' }} />
                ) : (
                  <div className="d-flex align-items-center justify-content-center text-muted py-5">No data</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap + Busiest time of day */}
      <div className="row g-3 mt-0">
        <div className="col-lg-8">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="card-title mb-0">Call Heatmap</h5>
              <span className="badge text-bg-primary">Day × Hour</span>
            </div>
            <div className="card-body">
              <p className="text-muted small mb-2">Calls by day of week and hour of day. Darker = more calls.</p>
              <div style={{ minHeight: 320 }}>
                {heatmap.length > 0 ? (
                  <ReactECharts option={heatmapOption} style={{ height: 320 }} opts={{ renderer: 'canvas' }} />
                ) : (
                  <div className="d-flex align-items-center justify-content-center text-muted py-5">No heatmap data</div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Busiest Time of Day</h5>
              <p className="text-muted small mb-0">Calls per hour (0–23)</p>
            </div>
            <div className="card-body">
              <div style={{ minHeight: 320 }}>
                {callsByHour.some((h) => (h?.count ?? 0) > 0) ? (
                  <ReactECharts option={callsByHourOption} style={{ height: 320 }} opts={{ renderer: 'canvas' }} />
                ) : (
                  <div className="d-flex align-items-center justify-content-center text-muted py-5">No hourly data</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Second row – By type, Top callers, Top callees */}
      <div className="row g-3 mt-0">
        <div className="col-lg-4">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">By Type</h5>
            </div>
            <div className="card-body">
              <div style={{ minHeight: 260 }}>
                {callsByType.some((d) => d.count > 0) ? (
                  <ReactECharts option={byTypeOption} style={{ height: 260 }} opts={{ renderer: 'canvas' }} />
                ) : (
                  <div className="d-flex align-items-center justify-content-center text-muted py-5">No data</div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Top Callers</h5>
              <p className="text-muted small mb-0">By call count</p>
            </div>
            <div className="card-body">
              <div style={{ minHeight: 260 }}>
                {topCallers.length > 0 ? (
                  <ReactECharts option={topCallersOption} style={{ height: 260 }} opts={{ renderer: 'canvas' }} />
                ) : (
                  <div className="d-flex align-items-center justify-content-center text-muted py-5">No data</div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Top Callees</h5>
              <p className="text-muted small mb-0">By call count</p>
            </div>
            <div className="card-body">
              <div style={{ minHeight: 260 }}>
                {topCallees.length > 0 ? (
                  <ReactECharts option={topCalleesOption} style={{ height: 260 }} opts={{ renderer: 'canvas' }} />
                ) : (
                  <div className="d-flex align-items-center justify-content-center text-muted py-5">No data</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Duration distribution */}
      <div className="row g-3 mt-0">
        <div className="col-lg-6">
          <div className="card">
            <div className="card-header">
              <h5 className="card-title mb-0">Duration Distribution</h5>
              <p className="text-muted small mb-0">Call length buckets</p>
            </div>
            <div className="card-body">
              <div style={{ minHeight: 240 }}>
                {durationDistribution.some((d) => d.count > 0) ? (
                  <ReactECharts option={durationOption} style={{ height: 240 }} opts={{ renderer: 'canvas' }} />
                ) : (
                  <div className="d-flex align-items-center justify-content-center text-muted py-5">No data</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
