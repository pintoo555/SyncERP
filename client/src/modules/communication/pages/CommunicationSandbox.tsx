/**
 * Communication Sandbox – test WhatsApp send, channel config, webhook.
 * Located under Settings for safe testing before production use.
 */

import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';

interface Channel {
  id: number;
  name: string;
  channelType: string;
  providerCode: string;
  instanceId: string | null;
  token: string | null;
  isActive: boolean;
  isDefault: boolean;
}

export default function CommunicationSandbox() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendTo, setSendTo] = useState('');
  const [sendBody, setSendBody] = useState('Hello from Synchronics Communication Sandbox! 🚀');
  const [channelId, setChannelId] = useState<number | ''>('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [webhookTesting, setWebhookTesting] = useState(false);
  const [webhookResult, setWebhookResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // New channel form
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newInstanceId, setNewInstanceId] = useState('');
  const [newToken, setNewToken] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api.get<{ success: boolean; data: Channel[] }>('/api/communication/channels')
      .then((res) => setChannels(res.data ?? []))
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSend = () => {
    if (!sendTo.trim() || !sendBody.trim()) {
      setSendResult({ ok: false, msg: 'Recipient and message body are required.' });
      return;
    }
    setSending(true);
    setSendResult(null);
    api.post<{ success: boolean; messageId?: string; error?: string }>('/api/communication/send', {
      channelId: channelId || undefined,
      to: sendTo.trim(),
      body: sendBody.trim(),
    })
      .then((res) => {
        setSendResult({ ok: true, msg: res.messageId ? `Sent! Message ID: ${res.messageId}` : 'Message sent.' });
      })
      .catch((e) => setSendResult({ ok: false, msg: e?.message ?? 'Send failed' }))
      .finally(() => setSending(false));
  };

  const handleAddChannel = () => {
    if (!newName.trim() || !newInstanceId.trim() || !newToken.trim()) {
      return;
    }
    setSaving(true);
    api.post('/api/communication/channels', {
      name: newName.trim(),
      channelType: 'whatsapp',
      providerCode: 'ultramsg',
      instanceId: newInstanceId.trim(),
      token: newToken.trim(),
      isActive: true,
      isDefault: channels.length === 0,
    })
      .then(() => {
        setShowAdd(false);
        setNewName('');
        setNewInstanceId('');
        setNewToken('');
        load();
      })
      .catch((e) => alert(e?.message ?? 'Failed to add channel'))
      .finally(() => setSaving(false));
  };

  const apiBase = typeof window !== 'undefined'
    ? ((import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL ?? window.location.origin).replace(/\/$/, '')
    : '';
  const webhookUrl = `${apiBase || 'https://your-server'}/api/communication/webhook/whatsapp`;

  return (
    <div className="container-fluid">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
        <div>
          <h2 className="mb-1">Communication Sandbox</h2>
          <nav aria-label="breadcrumb">
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item"><Link to="/">Home</Link></li>
              <li className="breadcrumb-item"><Link to="/settings">Settings</Link></li>
              <li className="breadcrumb-item active">Communication Sandbox</li>
            </ol>
          </nav>
        </div>
        <div className="d-flex gap-2">
          <Link to="/communication/messages" className="btn btn-outline-success btn-sm">
            <i className="ti ti-message-circle me-1" /> Messages (sent &amp; received)
          </Link>
          <Link to="/communication" className="btn btn-outline-primary btn-sm">
            <i className="ti ti-chart-bar me-1" /> Dashboard
          </Link>
        </div>
      </div>

      <div className="alert alert-info">
        <i className="ti ti-info-circle me-2" />
        <strong>Sandbox mode.</strong> Use this page to test WhatsApp (Ultramsg) integration before enabling it in other modules. Configure channels, send test messages, and verify the webhook URL for receiving messages.
      </div>

      <div className="row">
        {/* Send test message */}
        <div className="col-lg-6">
          <div className="card shadow-sm mb-4">
            <div className="card-header d-flex align-items-center gap-2">
              <i className="ti ti-send text-primary" />
              <span>Send Test WhatsApp Message</span>
            </div>
            <div className="card-body">
              <div className="mb-3">
                <label className="form-label">Channel</label>
                <select className="form-select" value={channelId} onChange={(e) => setChannelId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">Default channel</option>
                  {channels.filter((c) => c.channelType === 'whatsapp').map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">To (phone, e.g. +919876543210)</label>
                <div className="input-group">
                  <span className="input-group-text"><i className="ti ti-phone" /></span>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="+919876543210"
                    value={sendTo}
                    onChange={(e) => setSendTo(e.target.value)}
                  />
                </div>
              </div>
              <div className="mb-3">
                <label className="form-label">Message</label>
                <textarea
                  className="form-control"
                  rows={3}
                  value={sendBody}
                  onChange={(e) => setSendBody(e.target.value)}
                  placeholder="Type your test message..."
                />
              </div>
              {sendResult && (
                <div className={`alert alert-${sendResult.ok ? 'success' : 'danger'} py-2`}>
                  {sendResult.msg}
                </div>
              )}
              <button type="button" className="btn btn-primary" onClick={handleSend} disabled={sending}>
                {sending ? <><span className="spinner-border spinner-border-sm me-2" />Sending…</> : <><i className="ti ti-send me-2" />Send</>}
              </button>
            </div>
          </div>
        </div>

        {/* Webhook info */}
        <div className="col-lg-6">
          <div className="card shadow-sm mb-4">
            <div className="card-header d-flex align-items-center gap-2">
              <i className="ti ti-webhook text-primary" />
              <span>Webhook URL (for receiving messages)</span>
            </div>
            <div className="card-body">
              <p className="text-muted small mb-2">
                Configure this URL in your Ultramsg instance settings to receive incoming WhatsApp messages. Enable &quot;Webhook on Received&quot; in the Ultramsg dashboard.
              </p>
              <p className="text-warning small mb-2">
                <strong>Note:</strong> Ultramsg must be able to reach this URL. If your server uses a private IP (e.g. 192.168.x.x), use ngrok or similar to expose a public URL.
              </p>
              <div className="input-group mb-3">
                <input type="text" className="form-control font-monospace small" value={webhookUrl} readOnly />
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => navigator.clipboard?.writeText(webhookUrl)}
                >
                  <i className="ti ti-copy" />
                </button>
              </div>
              <hr />
              <h6 className="mb-2">Test the webhook</h6>
              <p className="text-muted small mb-2">
                Incoming messages appear in <strong>Communication → Messages</strong> (filter: Received). Use &quot;Simulate inbound&quot; to insert a test message, or send a real WhatsApp message to your instance.
              </p>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  disabled={webhookTesting || channels.filter((c) => c.channelType === 'whatsapp').length === 0}
                  onClick={() => {
                    setWebhookTesting(true);
                    setWebhookResult(null);
                    const ch = channels.find((c) => c.channelType === 'whatsapp');
                    api.post<{ success: boolean; message?: string }>('/api/communication/test-webhook', {
                      channelId: ch?.id,
                      body: 'Test message from Sandbox at ' + new Date().toLocaleTimeString(),
                    })
                      .then((r) => setWebhookResult({ ok: true, msg: r.message ?? 'Done' }))
                      .catch((e) => setWebhookResult({ ok: false, msg: e?.message ?? 'Failed' }))
                      .finally(() => setWebhookTesting(false));
                  }}
                >
                  {webhookTesting ? <span className="spinner-border spinner-border-sm me-1" /> : null}
                  Simulate inbound message
                </button>
                <Link to="/communication/messages?direction=inbound" className="btn btn-sm btn-outline-success">
                  View Messages
                </Link>
              </div>
              {webhookResult && (
                <div className={`alert alert-${webhookResult.ok ? 'success' : 'danger'} py-2 mt-2 mb-0`}>
                  {webhookResult.msg}
                </div>
              )}
              <details className="mt-3">
                <summary className="small text-muted cursor-pointer">curl to test webhook manually</summary>
                <pre className="small bg-dark text-light p-2 rounded mt-1 overflow-auto" style={{ maxHeight: 180 }}>
{`curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -d '{
    "event_type": "message_received",
    "instanceId": "YOUR_INSTANCE_ID",
    "data": {
      "id": "test-1",
      "from": "919876543210@c.us",
      "to": "YOUR_INSTANCE@c.us",
      "body": "Hello from test",
      "type": "chat",
      "fromMe": false,
      "time": ${Math.floor(Date.now() / 1000)}
    }
  }'
# Replace YOUR_INSTANCE_ID with your channel's Instance ID (must match DB)`}
                </pre>
              </details>
            </div>
          </div>

          {/* Channels */}
          <div className="card shadow-sm">
            <div className="card-header d-flex align-items-center justify-content-between">
              <span><i className="ti ti-building-bridge me-2" />Channels</span>
              <button type="button" className="btn btn-sm btn-primary" onClick={() => setShowAdd(!showAdd)}>
                {showAdd ? 'Cancel' : 'Add Channel'}
              </button>
            </div>
            <div className="card-body">
              {showAdd && (
                <div className="border rounded p-3 mb-3 bg-light">
                  <h6 className="mb-2">Add Ultramsg Channel</h6>
                  <input
                    type="text"
                    className="form-control form-control-sm mb-2"
                    placeholder="Channel name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                  <input
                    type="text"
                    className="form-control form-control-sm mb-2"
                    placeholder="Instance ID"
                    value={newInstanceId}
                    onChange={(e) => setNewInstanceId(e.target.value)}
                  />
                  <input
                    type="password"
                    className="form-control form-control-sm mb-2"
                    placeholder="Token"
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value)}
                  />
                  <button type="button" className="btn btn-sm btn-primary" onClick={handleAddChannel} disabled={saving}>
                    {saving ? 'Saving…' : 'Add'}
                  </button>
                </div>
              )}
              {loading ? (
                <div className="text-muted small">Loading…</div>
              ) : channels.length === 0 ? (
                <div className="text-muted small">No channels configured. Add one to send messages.</div>
              ) : (
                <ul className="list-group list-group-flush">
                  {channels.map((c) => (
                    <li key={c.id} className="list-group-item d-flex justify-content-between align-items-center px-0">
                      <div>
                        <strong>{c.name}</strong>
                        <span className="badge bg-secondary ms-2">{c.providerCode}</span>
                        {c.isDefault && <span className="badge bg-primary ms-1">Default</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
