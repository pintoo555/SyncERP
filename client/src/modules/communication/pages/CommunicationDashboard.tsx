/**
 * Communication Module Dashboard – WhatsApp/SMS stats, charts, reporting.
 */

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { api } from '../../../api/client';

interface DashboardStats {
  totalSent: number;
  totalReceived: number;
  sentToday: number;
  receivedToday: number;
  messagesByChannel: { channelName: string; channelId: number; sent: number; received: number }[];
  messagesByDay: { date: string; sent: number; received: number }[];
  topSenders: { userId: number; userName: string; count: number }[];
}

const INS = {
  primary: '#1ab394',
  secondary: '#1c84c6',
  success: '#25d366',
  info: '#23c6c8',
  warning: '#f8ac59',
  danger: '#ed5565',
  gray: '#6c757d',
};

export default function CommunicationDashboard() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const load = useCallback(() => {
    setLoading(true);
    api.get<{ success: boolean; data: DashboardStats }>(`/api/communication/dashboard?days=${days}`)
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [days]);

  useEffect(() => { load(); }, [load]);

  if (loading && !data) {
    return (
      <div className="container-fluid py-4">
        <div className="d-flex align-items-center gap-2 text-muted">
          <span className="spinner-border spinner-border-sm" /> Loading dashboard…
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="container-fluid py-4">
        <div className="alert alert-warning">
          <i className="ti ti-alert-triangle me-2" />
          Could not load communication dashboard. Ensure migration 017 has been run.
        </div>
      </div>
    );
  }

  const { totalSent, totalReceived, sentToday, receivedToday, messagesByChannel, messagesByDay, topSenders } = data;

  const byDayOption: EChartsOption = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['Sent', 'Received'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '5%', containLabel: true },
    xAxis: { type: 'category', data: messagesByDay.map((d) => d.date) },
    yAxis: { type: 'value' },
    series: [
      { name: 'Sent', type: 'bar', data: messagesByDay.map((d) => d.sent), itemStyle: { color: INS.secondary } },
      { name: 'Received', type: 'bar', data: messagesByDay.map((d) => d.received), itemStyle: { color: INS.success } },
    ],
  };

  const channelOption: EChartsOption = {
    tooltip: { trigger: 'item' },
    legend: { orient: 'vertical', left: 'left', top: 'center' },
    series: [{
      name: 'By Channel',
      type: 'pie',
      radius: ['40%', '70%'],
      data: messagesByChannel
        .filter((c) => c.sent + c.received > 0)
        .map((c) => ({
          value: c.sent + c.received,
          name: c.channelName,
        })),
      itemStyle: {
        borderRadius: 8,
        borderColor: '#fff',
        borderWidth: 2,
      },
    }],
  };

  return (
    <div className="container-fluid">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
        <div>
          <h2 className="mb-1">Communication Dashboard</h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item"><Link to="/">Home</Link></li>
              <li className="breadcrumb-item"><Link to="/communication">Communication</Link></li>
              <li className="breadcrumb-item active">Dashboard</li>
            </ol>
          </nav>
        </div>
        <div className="d-flex gap-2 align-items-center">
          <select className="form-select form-select-sm" style={{ width: 'auto' }} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <Link to="/communication/messages" className="btn btn-primary btn-sm">
            <i className="ti ti-message-circle me-1" /> Messages
          </Link>
          <Link to="/settings/communication-sandbox" className="btn btn-outline-secondary btn-sm">
            <i className="ti ti-settings me-1" /> Sandbox
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-3">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-circle bg-primary bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: 56, height: 56 }}>
                  <i className="ti ti-send fs-4 text-primary" />
                </div>
                <div>
                  <h5 className="text-muted mb-0 small">Total Sent</h5>
                  <h3 className="mb-0">{totalSent.toLocaleString()}</h3>
                  {sentToday > 0 && <span className="badge bg-primary mt-1">+{sentToday} today</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-circle bg-success bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: 56, height: 56 }}>
                  <i className="ti ti-mail-opened fs-4 text-success" />
                </div>
                <div>
                  <h5 className="text-muted mb-0 small">Total Received</h5>
                  <h3 className="mb-0">{totalReceived.toLocaleString()}</h3>
                  {receivedToday > 0 && <span className="badge bg-success mt-1">+{receivedToday} today</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-circle bg-info bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: 56, height: 56 }}>
                  <i className="ti ti-brand-whatsapp fs-4 text-info" />
                </div>
                <div>
                  <h5 className="text-muted mb-0 small">Channels</h5>
                  <h3 className="mb-0">{messagesByChannel.length}</h3>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card shadow-sm">
            <div className="card-body">
              <div className="d-flex align-items-center gap-3">
                <div className="rounded-circle bg-warning bg-opacity-10 d-flex align-items-center justify-content-center" style={{ width: 56, height: 56 }}>
                  <i className="ti ti-users fs-4 text-warning" />
                </div>
                <div>
                  <h5 className="text-muted mb-0 small">Top Senders</h5>
                  <h3 className="mb-0">{topSenders.length}</h3>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Charts row */}
      <div className="row g-3">
        <div className="col-lg-8">
          <div className="card shadow-sm">
            <div className="card-header d-flex align-items-center gap-2">
              <i className="ti ti-chart-bar text-primary" />
              <span>Messages Over Time</span>
            </div>
            <div className="card-body">
              {messagesByDay.length > 0 ? (
                <ReactECharts option={byDayOption} style={{ height: 320 }} opts={{ renderer: 'canvas' }} />
              ) : (
                <div className="d-flex align-items-center justify-content-center text-muted py-5">
                  <div className="text-center">
                    <i className="ti ti-chart-bar d-block fs-1 mb-2" />
                    No message data for selected period
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card shadow-sm">
            <div className="card-header d-flex align-items-center gap-2">
              <i className="ti ti-chart-pie text-primary" />
              <span>By Channel</span>
            </div>
            <div className="card-body">
              {messagesByChannel.some((c) => c.sent + c.received > 0) ? (
                <ReactECharts option={channelOption} style={{ height: 320 }} opts={{ renderer: 'canvas' }} />
              ) : (
                <div className="d-flex align-items-center justify-content-center text-muted py-5">
                  No channel data
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Top senders table */}
      {topSenders.length > 0 && (
        <div className="card shadow-sm mt-3">
          <div className="card-header d-flex align-items-center gap-2">
            <i className="ti ti-user-check text-primary" />
            <span>Top Senders (last {days} days)</span>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>User</th>
                    <th>Messages Sent</th>
                  </tr>
                </thead>
                <tbody>
                  {topSenders.map((u, i) => (
                    <tr key={u.userId}>
                      <td>{i + 1}</td>
                      <td>{u.userName}</td>
                      <td><span className="badge bg-primary">{u.count}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
