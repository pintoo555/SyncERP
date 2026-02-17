import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { api } from '../../../api/client';
import { SearchableSelect } from '../../../components/SearchableSelect';

interface VendorOption {
  vendorId: number;
  vendorName: string;
}

interface UserOption {
  userId: number;
  name: string;
  email: string;
}

export default function TicketNew() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const presetAssetId = searchParams.get('assetId');
  const [assetTag, setAssetTag] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [vendorId, setVendorId] = useState<number | ''>('');
  const [reportedByUserId, setReportedByUserId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);

  const assetId = presetAssetId ? parseInt(presetAssetId, 10) : 0;
  const validAssetId = Number.isInteger(assetId) && assetId > 0;

  useEffect(() => {
    if (validAssetId) {
      api.get<{ success: boolean; data: { assetTag?: string } }>(`/api/assets/${assetId}`)
        .then((res) => setAssetTag(res.data?.assetTag ?? null))
        .catch(() => setAssetTag(null));
    }
  }, [assetId, validAssetId]);

  useEffect(() => {
    api.get<{ success: boolean; data: VendorOption[] }>('/api/masters/vendors?pageSize=500')
      .then((res) => setVendors(Array.isArray(res.data) ? res.data : []))
      .catch(() => setVendors([]));
  }, []);

  useEffect(() => {
    api.get<{ success: boolean; data: UserOption[] }>('/api/chat/users')
      .then((res) => setUsers(Array.isArray(res.data) ? res.data : []))
      .catch(() => setUsers([]));
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const aid = validAssetId ? assetId : (e.currentTarget.querySelector('[name="assetId"]') as HTMLInputElement)?.value;
    const numAssetId = parseInt(String(aid), 10);
    if (!Number.isInteger(numAssetId) || numAssetId <= 0) {
      setError('Please select or enter a valid asset.');
      return;
    }
    if (!subject.trim()) {
      setError('Subject is required.');
      return;
    }
    setError('');
    setSaving(true);
    api.post<{ success: boolean; data: { ticketId: number } }>('/api/tickets', {
      assetId: numAssetId,
      subject: subject.trim(),
      description: description.trim() || null,
      vendorId: vendorId === '' ? null : vendorId,
      reportedByUserId: reportedByUserId === '' ? null : reportedByUserId,
    })
      .then((res) => {
        const tid = res.data?.ticketId;
        if (tid) navigate(`/assets/tickets/${tid}`);
        else navigate('/assets/tickets');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Create failed'))
      .finally(() => setSaving(false));
  };

  return (
    <div className="container-fluid">
      <div className="mb-4">
        <Link to="/assets/tickets" className="btn btn-sm btn-outline-secondary me-2">← Tickets</Link>
        {validAssetId && assetTag && (
          <Link to={`/assets/${assetId}`} className="btn btn-sm btn-outline-secondary">Asset: {assetTag}</Link>
        )}
      </div>
      <h4 className="mb-4">Assets – New Ticket</h4>

      <div className="card" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit} className="card-body">
          {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}

          {validAssetId ? (
            <div className="mb-3">
              <label className="form-label">Asset</label>
              <p className="form-control-plaintext">
                <Link to={`/assets/${assetId}`}>{assetTag ?? `Asset #${assetId}`}</Link>
                <input type="hidden" name="assetId" value={assetId} />
              </p>
            </div>
          ) : (
            <div className="mb-3">
              <label className="form-label">Asset ID *</label>
              <input
                type="number"
                name="assetId"
                className="form-control"
                min={1}
                required
                placeholder="Enter asset ID"
              />
            </div>
          )}

          <div className="mb-3">
            <label className="form-label">Subject *</label>
            <input
              type="text"
              className="form-control"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              required
              placeholder="Brief subject"
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details"
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Vendor</label>
            <SearchableSelect
              options={vendors.map((v) => ({ value: v.vendorId, label: v.vendorName }))}
              value={vendorId === '' ? '' : vendorId}
              onChange={(v) => setVendorId(v === '' ? '' : Number(v))}
              placeholder="—"
            />
          </div>

          <div className="mb-3">
            <label className="form-label">Reported by (optional)</label>
            <SearchableSelect
              options={users.map((u) => ({ value: u.userId, label: `${u.name} (${u.email})` }))}
              value={reportedByUserId === '' ? '' : reportedByUserId}
              onChange={(v) => setReportedByUserId(v === '' ? '' : Number(v))}
              placeholder="Current user"
            />
          </div>

          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating...' : 'Create ticket'}
            </button>
            <Link to="/assets/tickets" className="btn btn-secondary">Cancel</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
