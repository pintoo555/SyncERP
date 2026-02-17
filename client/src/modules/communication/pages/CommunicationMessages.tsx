/**
 * Communication Messages – list sent/received WhatsApp/SMS messages.
 */

import { useEffect, useState, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../../api/client';

interface Message {
  messageId: number;
  channelId: number;
  channelName: string;
  direction: string;
  fromNumber: string;
  toNumber: string;
  body: string | null;
  messageType: string;
  status: string | null;
  sentByUserId: number | null;
  sentByName: string | null;
  receivedAt: string | null;
  sentAt: string | null;
}

interface Channel {
  id: number;
  name: string;
  channelType: string;
  providerCode: string;
  isActive: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

export default function CommunicationMessages() {
  const [searchParams] = useSearchParams();
  const directionFromUrl = searchParams.get('direction');
  const [messages, setMessages] = useState<Message[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({
    channelId: '' as string | number,
    direction: (directionFromUrl === 'inbound' || directionFromUrl === 'outbound' ? directionFromUrl : '') as string,
    fromNumber: '',
    toNumber: '',
    fromDate: '',
    toDate: '',
  });

  const loadChannels = useCallback(() => {
    api.get<{ success: boolean; data: Channel[] }>('/api/communication/channels')
      .then((res) => setChannels(res.data ?? []))
      .catch(() => setChannels([]));
  }, []);

  const loadMessages = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', '30');
    if (filters.channelId) params.set('channelId', String(filters.channelId));
    if (filters.direction) params.set('direction', filters.direction);
    if (filters.fromNumber) params.set('fromNumber', filters.fromNumber);
    if (filters.toNumber) params.set('toNumber', filters.toNumber);
    if (filters.fromDate) params.set('fromDate', filters.fromDate);
    if (filters.toDate) params.set('toDate', filters.toDate);

    api.get<{ success: boolean; data: Message[]; total: number }>(`/api/communication/messages?${params}`)
      .then((res) => {
        setMessages(res.data ?? []);
        setTotal(res.total ?? 0);
      })
      .catch(() => {
        setMessages([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [page, filters]);

  useEffect(() => { loadChannels(); }, [loadChannels]);
  useEffect(() => { setPage(1); }, [filters.channelId, filters.direction, filters.fromNumber, filters.toNumber, filters.fromDate, filters.toDate]);
  useEffect(() => { loadMessages(); }, [loadMessages]);

  return (
    <div className="container-fluid">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
        <div>
          <h2 className="mb-1">Messages</h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item"><Link to="/">Home</Link></li>
              <li className="breadcrumb-item"><Link to="/communication">Communication</Link></li>
              <li className="breadcrumb-item active">Messages</li>
            </ol>
          </nav>
        </div>
        <Link to="/communication" className="btn btn-outline-secondary btn-sm">
          <i className="ti ti-chart-bar me-1" /> Dashboard
        </Link>
      </div>

      {/* Filters */}
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-2">
              <select
                className="form-select form-select-sm"
                value={filters.channelId}
                onChange={(e) => setFilters((f) => ({ ...f, channelId: e.target.value }))}
              >
                <option value="">All channels</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <select
                className="form-select form-select-sm"
                value={filters.direction}
                onChange={(e) => setFilters((f) => ({ ...f, direction: e.target.value }))}
              >
                <option value="">All</option>
                <option value="outbound">Sent</option>
                <option value="inbound">Received</option>
              </select>
            </div>
            <div className="col-md-2">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="From number"
                value={filters.fromNumber}
                onChange={(e) => setFilters((f) => ({ ...f, fromNumber: e.target.value }))}
              />
            </div>
            <div className="col-md-2">
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="To number"
                value={filters.toNumber}
                onChange={(e) => setFilters((f) => ({ ...f, toNumber: e.target.value }))}
              />
            </div>
            <div className="col-md-2">
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.fromDate}
                onChange={(e) => setFilters((f) => ({ ...f, fromDate: e.target.value }))}
              />
            </div>
            <div className="col-md-2">
              <input
                type="date"
                className="form-control form-control-sm"
                value={filters.toDate}
                onChange={(e) => setFilters((f) => ({ ...f, toDate: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Messages table */}
      <div className="card shadow-sm">
        <div className="card-body p-0">
          {loading ? (
            <div className="p-4 text-center text-muted">
              <span className="spinner-border spinner-border-sm me-2" /> Loading…
            </div>
          ) : messages.length === 0 ? (
            <div className="p-5 text-center text-muted">
              <i className="ti ti-message-off fs-1 d-block mb-2" />
              No messages found
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Direction</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Message</th>
                    <th>Channel</th>
                    <th>Sent by</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((m) => (
                    <tr key={m.messageId}>
                      <td className="text-nowrap">{formatDate(m.sentAt || m.receivedAt)}</td>
                      <td>
                        <span className={`badge ${m.direction === 'outbound' ? 'bg-primary' : 'bg-success'}`}>
                          {m.direction === 'outbound' ? 'Sent' : 'Received'}
                        </span>
                      </td>
                      <td><code>{m.fromNumber}</code></td>
                      <td><code>{m.toNumber}</code></td>
                      <td style={{ maxWidth: 250 }} className="text-truncate" title={m.body ?? ''}>
                        {m.body ?? '—'}
                      </td>
                      <td>{m.channelName}</td>
                      <td>{m.sentByName ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {total > 30 && (
            <div className="d-flex justify-content-between align-items-center px-3 py-2 border-top">
              <small className="text-muted">Total: {total}</small>
              <nav>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary me-1"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  disabled={page * 30 >= total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
