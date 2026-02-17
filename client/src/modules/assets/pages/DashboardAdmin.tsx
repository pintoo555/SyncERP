/**
 * Assets Admin Dashboard – Inspinia theme
 * Layout and charts match E:\cursor\ReferenceTheme\Inspinia\Full\views\index.ejs
 * Uses ECharts for donut/rose charts (same as Inspinia reference)
 */

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { api } from '../../../api/client';
import { useRealtime, NewAssetPayload } from '../../../hooks/useRealtime';

interface NewAssetToast {
  id: number;
  assetTag: string;
  addedByName: string;
}

interface AdminDashboard {
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
  categoryValue: { categoryName: string; totalValue: number; count: number }[];
  userValue: { userName: string; totalValue: number; count: number }[];
  valueByStatus: { status: string; totalValue: number; count: number }[];
  ticketsByStatus: { status: string; count: number }[];
  recentAuditCount: number;
}

/* Inspinia theme colors from E:\cursor\ReferenceTheme\Inspinia\Full\assets\scss\_variables.scss */
const INS = {
  primary: '#1ab394',    // teal
  secondary: '#1c84c6',  // blue
  success: '#0acf97',    // green
  info: '#23c6c8',       // cyan
  warning: '#f8ac59',    // yellow
  danger: '#ed5565',     // red
  light: '#eef2f7',      // gray-200
  muted: '#bbcae14d',    // table donut 3rd segment (dashboard.js)
  gray: '#6c757d',
};

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: INS.success,
  ISSUED: INS.secondary,
  UNDER_REPAIR: INS.warning,
  SCRAPPED: INS.gray,
  LOST: INS.danger,
};

const formatCurrency = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n));
const formatTooltipValue = (value: number) => Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });

let toastId = 0;
const TOAST_AUTO_DISMISS_MS = 7000;

export default function DashboardAdmin() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<NewAssetToast[]>([]);

  const load = useCallback(() => {
    api.get<{ success: boolean; data: AdminDashboard }>('/api/dashboard/admin')
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const addToast = useCallback((payload: NewAssetPayload) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, assetTag: payload.assetTag, addedByName: payload.addedByName }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), TOAST_AUTO_DISMISS_MS);
  }, []);

  useRealtime({ onUpdate: load, onNewAsset: addToast });

  useEffect(() => {
    document.title = 'Assets Admin Dashboard | Synchronics ERP';
    return () => { document.title = 'Synchronics ERP'; };
  }, []);

  if (loading && !data) {
    return (
      <div className="container-fluid py-4">
        <div className="d-flex align-items-center gap-2 text-muted">
          <span className="spinner-border spinner-border-sm" role="status" />
          Loading dashboard…
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-warning shadow-sm">
          <i className="ti ti-alert-triangle me-2" />
          Could not load admin dashboard.
        </div>
      </div>
    );
  }

  const { kpis } = data;
  const assetsByStatus = data.assetsByStatus ?? [];
  const categoryValue = data.categoryValue ?? [];
  const valueByStatus = data.valueByStatus ?? [];

  /* ECharts: Rose donut – Asset status (Project Progress style from index.ejs) */
  const projectProgressOption: EChartsOption = {
    tooltip: {
      trigger: 'item',
      padding: [8, 15],
      formatter: '{b}: {c} ({d}%)',
    },
    series: [{
      name: 'Asset Status',
      type: 'pie',
      radius: [60, 100],
      center: ['50%', '50%'],
      roseType: 'area',
      itemStyle: { borderRadius: 8 },
      label: { color: INS.gray, fontSize: 12 },
      data: assetsByStatus.map((r) => ({
        value: r.count,
        name: r.status,
        itemStyle: { color: STATUS_COLORS[r.status] ?? INS.gray },
      })),
    }],
  };

  /* ECharts: Line/Area – Value by category (Revenue style) */
  const revLabels = categoryValue.slice(0, 10).map((r) => r.categoryName);
  const revValues = categoryValue.slice(0, 10).map((r) => r.totalValue);
  const revenueChartOption: EChartsOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const p = Array.isArray(params) ? params[0] : null;
        if (!p) return '';
        const idx = (p as { dataIndex?: number }).dataIndex ?? 0;
        const name = revLabels[idx] ?? '';
        const val = revValues[idx] ?? 0;
        return `<div>${name}</div><div>Value: ${formatTooltipValue(val)}</div>`;
      },
    },
    xAxis: {
      type: 'category',
      data: revLabels,
      boundaryGap: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: INS.gray, margin: 15, rotate: 35 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#676b891f', type: 'dashed' } },
      axisLabel: { color: INS.gray, formatter: (v) => formatCurrency(Number(v)) },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [{
      name: 'Value',
      type: 'line',
      smooth: true,
      symbolSize: 4,
      itemStyle: { color: INS.primary, borderColor: INS.primary, borderWidth: 2 },
      areaStyle: { opacity: 0.2, color: INS.primary },
      lineStyle: { color: INS.primary },
      data: revValues,
    }],
    grid: { right: 20, left: 5, bottom: 60, top: 20, containLabel: true },
  };

  /* ECharts: Small donut for table rows (radius 60–100%, no labels) – Inspinia style */
  const totalCategoryValue = categoryValue.reduce((a, r) => a + r.totalValue, 0);
  const tableDonutOption = (pct: number): EChartsOption => {
    const v1 = Math.min(100, Math.max(0, pct));
    const rest = 100 - v1;
    return {
      tooltip: { show: false },
      series: [{
        type: 'pie',
        radius: ['60%', '100%'],
        emphasis: { scale: false },
        label: { show: false },
        labelLine: { show: false },
        data: [
          { value: v1, itemStyle: { color: INS.primary } },
          { value: rest / 2, itemStyle: { color: INS.secondary } },
          { value: rest / 2, itemStyle: { color: INS.muted } },
        ],
      }],
    };
  };

  const availPct = kpis.totalAssets > 0 ? Math.round((kpis.availableAssets / kpis.totalAssets) * 100) : 0;
  const issuedPct = kpis.totalAssets > 0 ? Math.round((kpis.issuedAssets / kpis.totalAssets) * 100) : 0;
  const repairPct = kpis.totalAssets > 0 ? Math.round((kpis.underRepairAssets / kpis.totalAssets) * 100) : 0;

  return (
    <div className="container-fluid mt-3 dashboard-admin">
      {/* Top hero card – Welcome | Revenue/Value | Project Progress (Inspinia index.ejs) */}
      <div className="row mt-3">
        <div className="col-12">
          <div className="card">
            <div className="card-body p-0">
              <div className="row g-0">
                {/* Left: Welcome + activity */}
                <div className="col-xxl-3 col-xl-6 order-xl-1 order-xxl-0">
                  <div className="p-4 border-end">
                    <h4 className="mb-1">Welcome to Assets Admin Dashboard.</h4>
                    <span className="text-muted">
                      You have <span className="text-primary fw-semibold">{kpis.totalAssets}</span> assets and {kpis.openTickets} open tickets.
                    </span>
                    <ul className="list-group list-group-flush mt-3">
                      <li className="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                        <div>
                          <span className="badge text-bg-primary me-2" style={{ width: 24, height: 24, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>1</span>
                          Total Assets
                        </div>
                        <span className="text-muted">{kpis.totalAssets}</span>
                      </li>
                      <li className="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                        <div>
                          <span className="badge text-bg-info me-2" style={{ width: 24, height: 24, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>2</span>
                          Available
                        </div>
                        <span className="text-muted">{kpis.availableAssets}</span>
                      </li>
                      <li className="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                        <div>
                          <span className="badge text-bg-secondary me-2" style={{ width: 24, height: 24, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>3</span>
                          Issued
                        </div>
                        <span className="text-muted">{kpis.issuedAssets}</span>
                      </li>
                      <li className="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                        <div>
                          <span className="badge text-bg-warning me-2" style={{ width: 24, height: 24, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>4</span>
                          Under Repair
                        </div>
                        <span className="text-muted">{kpis.underRepairAssets}</span>
                      </li>
                      <li className="list-group-item d-flex justify-content-between align-items-center border-0 px-0">
                        <div>
                          <span className="badge text-bg-success me-2" style={{ width: 24, height: 24, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>5</span>
                          Total Value
                        </div>
                        <span className="text-muted">{formatCurrency(kpis.totalPurchaseValue)}</span>
                      </li>
                    </ul>
                    <div className="text-center mt-2">
                      <Link to="/assets" className="btn btn-secondary rounded-pill">View Assets</Link>
                    </div>
                  </div>
                  <hr className="d-xxl-none border-light m-0" />
                </div>
                {/* Middle: Value / Revenue style chart */}
                <div className="col-xxl-6 order-xl-3 order-xxl-1">
                  <div className="p-4 border-end">
                    <div className="d-flex justify-content-between mb-3">
                      <h4 className="card-title mb-0">Asset Value</h4>
                      <Link to="/assets" className="text-decoration-underline fw-semibold">View Reports <i className="ti ti-arrow-right" /></Link>
                    </div>
                    <div className="row text-center mb-3">
                      <div className="col">
                        <div className="bg-light bg-opacity-50 p-2 rounded">
                          <h5 className="m-0"><span className="text-muted">Total Value:</span> <span>{formatCurrency(kpis.totalPurchaseValue)}</span></h5>
                        </div>
                      </div>
                      <div className="col">
                        <div className="bg-light bg-opacity-50 p-2 rounded">
                          <h5 className="m-0"><span className="text-muted">Total Assets:</span> <span>{kpis.totalAssets}</span></h5>
                        </div>
                      </div>
                    </div>
                    <div className="position-relative">
                      <div className="py-2 px-3 rounded-3 bg-light border border-primary border-opacity-25 text-primary position-absolute z-1" style={{ top: '4.5%', left: '12%' }}>
                        <p className="mb-0 text-uppercase small fw-semibold">Utilization</p>
                        <h5 className="mb-0 fw-bold">{availPct}% <i className="ti ti-trending-up" /></h5>
                      </div>
                      <div style={{ minHeight: 252 }}>
                        {categoryValue.length > 0 ? (
                          <ReactECharts option={revenueChartOption} style={{ height: 252 }} opts={{ renderer: 'canvas' }} />
                        ) : (
                          <div className="d-flex align-items-center justify-content-center h-100 text-muted">No data</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                {/* Right: Project Progress – rose donut */}
                <div className="col-xxl-3 col-xl-6 order-xl-2 order-xxl-2">
                  <div className="p-4">
                    <h4 className="card-title mb-1">Asset Status</h4>
                    <p className="text-muted small mb-0">
                      Distribution by status.
                    </p>
                    <div className="mt-4">
                      <div style={{ minHeight: 278 }}>
                        {assetsByStatus.length > 0 ? (
                          <ReactECharts option={projectProgressOption} style={{ height: 278 }} opts={{ renderer: 'canvas' }} />
                        ) : (
                          <div className="d-flex align-items-center justify-content-center h-100 text-muted">No data</div>
                        )}
                      </div>
                    </div>
                  </div>
                  <hr className="d-xxl-none border-light m-0" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI row – My Tasks style (Inspinia index.ejs) */}
      <div className="row row-cols-xxl-5 row-cols-md-3 row-cols-1 align-items-stretch g-3 mt-3">
        <div className="col">
          <div className="card">
            <div className="card-body">
              <Link to="/assets" className="text-muted float-end mt-n1 fs-5"><i className="ti ti-external-link" /></Link>
              <h5 className="mb-0" title="Total Assets">Total Assets</h5>
              <div className="d-flex align-items-center gap-2 my-3">
                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <i className="ti ti-packages fs-5 text-primary" />
                </div>
                <h3 className="mb-0">{kpis.totalAssets}</h3>
                {kpis.availableAssets > 0 && (
                  <span className="badge bg-primary bg-opacity-25 text-primary fw-medium ms-2 fs-6">+{kpis.availableAssets} Avail</span>
                )}
              </div>
              <p className="mb-0">
                <span className="text-primary"><i className="ti ti-point-filled" /></span>
                <span className="text-nowrap text-muted">Total Count</span>
                <span className="float-end"><b>{kpis.totalAssets}</b></span>
              </p>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card">
            <div className="card-body">
              <Link to="/assets" className="text-muted float-end mt-n1 fs-5"><i className="ti ti-external-link" /></Link>
              <h5 className="mb-0" title="Available">Available</h5>
              <div className="d-flex align-items-center gap-2 my-3">
                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <i className="ti ti-circle-check fs-5 text-success" />
                </div>
                <h3 className="mb-0">{kpis.availableAssets}</h3>
                <span className="badge bg-success bg-opacity-25 text-success fw-medium ms-2 fs-6">Ready</span>
              </div>
              <p className="mb-0">
                <span className="text-success"><i className="ti ti-point-filled" /></span>
                <span className="text-nowrap text-muted">To Assign</span>
                <span className="float-end"><b>{kpis.availableAssets}</b></span>
              </p>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card">
            <div className="card-body">
              <Link to="/assets" className="text-muted float-end mt-n1 fs-5"><i className="ti ti-external-link" /></Link>
              <h5 className="mb-0" title="Issued">Issued</h5>
              <div className="d-flex align-items-center gap-2 my-3">
                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <i className="ti ti-user-check fs-5 text-info" />
                </div>
                <h3 className="mb-0">{kpis.issuedAssets}</h3>
              </div>
              <p className="mb-0">
                <span className="text-info"><i className="ti ti-point-filled" /></span>
                <span className="text-nowrap text-muted">Assigned</span>
                <span className="float-end"><b>{kpis.issuedAssets}</b></span>
              </p>
            </div>
          </div>
        </div>
        <div className="col">
          <div className="card">
            <div className="card-body">
              <Link to="/assets/tickets" className="text-muted float-end mt-n1 fs-5"><i className="ti ti-external-link" /></Link>
              <h5 className="mb-0" title="Under Repair">Under Repair</h5>
              <div className="d-flex align-items-center gap-2 my-3">
                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <i className="ti ti-tool fs-5 text-warning" />
                </div>
                <h3 className="mb-0">{kpis.underRepairAssets}</h3>
                {kpis.underRepairAssets > 0 && (
                  <span className="badge bg-warning bg-opacity-25 text-dark fw-medium ms-2 fs-6">+{kpis.underRepairAssets}</span>
                )}
              </div>
              <p className="mb-0">
                <span className="text-warning"><i className="ti ti-point-filled" /></span>
                <span className="text-nowrap text-muted">In Maintenance</span>
                <span className="float-end"><b>{kpis.underRepairAssets}</b></span>
              </p>
            </div>
          </div>
        </div>
        <div className="col-lg col-md-auto">
          <div className="card">
            <div className="card-body">
              <Link to="/assets" className="text-muted float-end mt-n1 fs-5"><i className="ti ti-external-link" /></Link>
              <h5 className="mb-0" title="Total Value">Total Value</h5>
              <div className="d-flex align-items-center gap-2 my-3">
                <div className="rounded-circle bg-light d-flex align-items-center justify-content-center flex-shrink-0" style={{ width: 48, height: 48 }}>
                  <i className="ti ti-currency-rupee fs-5 text-success" />
                </div>
                <h3 className="mb-0">{formatCurrency(kpis.totalPurchaseValue)}</h3>
              </div>
              <p className="mb-0">
                <span className="text-success"><i className="ti ti-point-filled" /></span>
                <span className="text-nowrap text-muted">Purchase Value</span>
                <span className="float-end"><b>{formatTooltipValue(kpis.totalPurchaseValue)}</b></span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row – Quarterly Reports + Project Performance + Activity (Inspinia index.ejs) */}
      <div className="row g-3 mt-3">
        <div className="col-xxl-4">
          <div className="card">
            <div className="card-header justify-content-between align-items-center">
              <h5 className="card-title mb-0">Category Summary <span className="badge text-bg-primary">Assets</span></h5>
            </div>
            <div className="card-body p-0">
              <div className="table-responsive">
                <table className="table table-hover table-centered mb-0">
                  <thead className="bg-light bg-opacity-50">
                    <tr className="text-uppercase small">
                      <th className="text-muted">Category</th>
                      <th className="text-muted">Count</th>
                      <th className="text-muted">Value</th>
                      <th className="text-muted" style={{ width: 60 }}>•••</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryValue.slice(0, 8).map((r) => {
                      const pct = totalCategoryValue > 0 ? (r.totalValue / totalCategoryValue) * 100 : 0;
                      return (
                        <tr key={r.categoryName}>
                          <td>
                            <h6 className="fs-6 mb-0 fw-normal">{r.categoryName}</h6>
                          </td>
                          <td>{r.count}</td>
                          <td>{formatCurrency(r.totalValue)}</td>
                          <td style={{ width: 60 }}>
                            <div style={{ height: 30, minWidth: 30 }}>
                              <ReactECharts
                                option={tableDonutOption(pct)}
                                style={{ height: 30, width: 30 }}
                                opts={{ renderer: 'canvas' }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {categoryValue.length === 0 && (
                      <tr><td colSpan={4} className="text-center text-muted py-4">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card mt-3">
            <div className="card-header justify-content-between align-items-center">
              <h5 className="card-title mb-0">Project Performance</h5>
            </div>
            <div className="card-body">
              <div>
                <div className="d-flex justify-content-between">
                  <h6 className="mb-2">Available</h6>
                  <div>
                    <span>+{kpis.availableAssets}</span>
                    <span><i className="ti ti-circle-filled text-secondary mx-2 small" /> {availPct}%</span>
                  </div>
                </div>
                <div className="progress progress-sm mb-1">
                  <div className="progress-bar bg-success" role="progressbar" style={{ width: `${availPct}%` }} />
                </div>
              </div>
              <div className="mt-4">
                <div className="d-flex justify-content-between">
                  <h6 className="mb-2">Issued</h6>
                  <div>
                    <span>+{kpis.issuedAssets}</span>
                    <span><i className="ti ti-circle-filled text-secondary mx-2 small" /> {issuedPct}%</span>
                  </div>
                </div>
                <div className="progress progress-sm mb-1">
                  <div className="progress-bar bg-info" role="progressbar" style={{ width: `${issuedPct}%` }} />
                </div>
              </div>
              <div className="mt-4">
                <div className="d-flex justify-content-between">
                  <h6 className="mb-2">Under Repair</h6>
                  <div>
                    <span>+{kpis.underRepairAssets}</span>
                    <span><i className="ti ti-circle-filled text-secondary mx-2 small" /> {repairPct}%</span>
                  </div>
                </div>
                <div className="progress progress-sm mb-1">
                  <div className="progress-bar bg-warning" role="progressbar" style={{ width: `${repairPct}%` }} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xxl-4 col-xl-6">
          <div className="card">
            <div className="card-header justify-content-between align-items-center">
              <h5 className="card-title mb-0">Quick Links</h5>
              <span className="badge text-bg-warning small">{kpis.openTickets} Open Tickets</span>
            </div>
            <div className="card-body">
              <div className="list-group list-group-flush">
                <Link to="/assets" className="list-group-item list-group-item-action border-0 px-0 d-flex align-items-center">
                  <i className="ti ti-box-seam text-primary me-2 fs-5" />
                  <span>View Assets</span>
                  <i className="ti ti-chevron-right ms-auto text-muted" />
                </Link>
                <Link to="/assets/tickets" className="list-group-item list-group-item-action border-0 px-0 d-flex align-items-center">
                  <i className="ti ti-ticket text-warning me-2 fs-5" />
                  <span>Tickets</span>
                  <i className="ti ti-chevron-right ms-auto text-muted" />
                </Link>
                <Link to="/audit" className="list-group-item list-group-item-action border-0 px-0 d-flex align-items-center">
                  <i className="ti ti-history text-info me-2 fs-5" />
                  <span>Audit Log</span>
                  <span className="badge bg-secondary ms-auto">{data.recentAuditCount}</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xxl-4 col-xl-6">
          <div className="card">
            <div className="card-header justify-content-between align-items-center">
              <h5 className="card-title mb-0">Asset Status Distribution</h5>
            </div>
            <div className="card-body">
              {valueByStatus.length > 0 ? (
                <div style={{ height: 220 }}>
                  <ReactECharts
                    option={{
                      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
                      series: [{
                        type: 'pie',
                        radius: ['50%', '85%'],
                        center: ['50%', '50%'],
                        avoidLabelOverlap: true,
                        itemStyle: { borderRadius: 6 },
                        label: { show: true, formatter: '{b}: {d}%' },
                        data: valueByStatus.map((r) => ({
                          value: r.totalValue,
                          name: r.status,
                          itemStyle: { color: STATUS_COLORS[r.status] ?? INS.gray },
                        })),
                      }],
                    }}
                    style={{ height: 220 }}
                    opts={{ renderer: 'canvas' }}
                  />
                </div>
              ) : (
                <div className="d-flex align-items-center justify-content-center text-muted" style={{ height: 220 }}>No data</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Realtime toasts */}
      <div className="position-fixed bottom-0 start-0 end-0 p-3 d-flex flex-column align-items-center gap-2" style={{ zIndex: 1050, pointerEvents: 'none' }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            className="d-flex align-items-center gap-2 px-4 py-3 rounded-3 shadow border-0"
            style={{ minWidth: 300, maxWidth: 420, background: `linear-gradient(135deg, ${INS.primary} 0%, #16a085 100%)`, color: '#fff' }}
          >
            <i className="ti ti-box-seam fs-4 opacity-75" />
            <div>
              <span className="small fw-semibold d-block">New asset added</span>
              <span className="small opacity-90">{t.assetTag} by {t.addedByName}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
