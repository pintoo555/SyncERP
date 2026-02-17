import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { formatDateTimeInAppTz } from '../../../utils/dateUtils';
import { SearchableSelect } from '../../../components/SearchableSelect';

interface TicketData {
  ticketId: number;
  assetId: number;
  assetTag: string;
  ticketNumber: string;
  subject: string;
  description: string | null;
  status: string;
  vendorId: number | null;
  vendorName: string | null;
  reportedByUserId: number | null;
  reportedByUserName: string | null;
  reportedAt: string;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  cost: number | null;
  isDeleted: boolean;
  createdAt: string;
  createdBy: number | null;
}

interface VendorOption {
  vendorId: number;
  vendorName: string;
}

export default function TicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { timeZone } = useAppSettings();
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeNotes, setCloseNotes] = useState('');
  const [closeCost, setCloseCost] = useState<number | ''>('');
  const [editForm, setEditForm] = useState({ subject: '', description: '' as string | null, vendorId: '' as number | '', status: '' });
  const [vendors, setVendors] = useState<VendorOption[]>([]);

  const canEdit = user?.permissions?.includes('TICKET.EDIT');
  const canClose = user?.permissions?.includes('TICKET.CLOSE');
  const canDelete = user?.permissions?.includes('TICKET.DELETE');
  const isResolved = ticket?.resolvedAt != null;

  const loadTicket = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api.get<{ success: boolean; data: TicketData }>(`/api/tickets/${id}`)
      .then((res) => {
        const t = res.data;
        setTicket(t);
        setEditForm({
          subject: t?.subject ?? '',
          description: t?.description ?? null,
          vendorId: t?.vendorId ?? '',
          status: t?.status ?? 'OPEN',
        });
      })
      .catch(() => setTicket(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  useEffect(() => {
    api.get<{ success: boolean; data: { vendorId: number; vendorName: string }[] }>('/api/masters/vendors')
      .then((res) => setVendors(Array.isArray(res.data) ? res.data : []))
      .catch(() => setVendors([]));
  }, []);

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !ticket) return;
    setError('');
    setSaving(true);
    api.put(`/api/tickets/${id}`, {
      subject: editForm.subject,
      description: editForm.description || null,
      vendorId: editForm.vendorId === '' ? null : editForm.vendorId,
      status: editForm.status,
    })
      .then(() => {
        setEditing(false);
        loadTicket();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Update failed'))
      .finally(() => setSaving(false));
  };

  const handleClose = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError('');
    setSaving(true);
    api.patch(`/api/tickets/${id}/close`, {
      resolutionNotes: closeNotes.trim() || null,
      cost: closeCost === '' ? null : Number(closeCost),
    })
      .then(() => {
        setShowCloseModal(false);
        setCloseNotes('');
        setCloseCost('');
        loadTicket();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Close failed'))
      .finally(() => setSaving(false));
  };

  const handleDelete = () => {
    if (!id || !window.confirm('Soft-delete this ticket? It will be hidden from lists.')) return;
    setError('');
    setSaving(true);
    api.delete(`/api/tickets/${id}`)
      .then(() => navigate('/assets/tickets'))
      .catch((err) => setError(err instanceof Error ? err.message : 'Delete failed'))
      .finally(() => setSaving(false));
  };

  if (loading) return <div className="container-fluid py-4 text-muted">Loading...</div>;
  if (!ticket) return <div className="container-fluid py-4 alert alert-warning">Ticket not found.</div>;

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center gap-2 mb-4 flex-wrap">
        <Link to="/assets/tickets" className="btn btn-sm btn-outline-secondary">← Tickets</Link>
        <Link to={`/assets/${ticket.assetId}`} className="btn btn-sm btn-outline-secondary">Asset: {ticket.assetTag}</Link>
        <h4 className="mb-0">{ticket.ticketNumber}</h4>
        <span className={`badge ${ticket.status === 'CLOSED' || ticket.status === 'RESOLVED' ? 'bg-success' : 'bg-warning text-dark'}`}>
          {ticket.status}
        </span>
        {!isResolved && canEdit && !editing && (
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => setEditing(true)}>Edit</button>
        )}
        {!isResolved && canClose && (
          <button type="button" className="btn btn-sm btn-success" onClick={() => setShowCloseModal(true)}>Close ticket</button>
        )}
        {canDelete && (
          <button type="button" className="btn btn-sm btn-outline-danger" onClick={handleDelete} disabled={saving}>Delete</button>
        )}
      </div>

      {error && <div className="alert alert-danger py-2 small mb-3">{error}</div>}

      {editing ? (
        <div className="card mb-4">
          <div className="card-header">Edit ticket</div>
          <form onSubmit={handleUpdate} className="card-body">
            <div className="mb-2">
              <label className="form-label">Subject *</label>
              <input
                className="form-control"
                value={editForm.subject}
                onChange={(e) => setEditForm((f) => ({ ...f, subject: e.target.value }))}
                required
              />
            </div>
            <div className="mb-2">
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                rows={3}
                value={editForm.description ?? ''}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value || null }))}
              />
            </div>
            <div className="mb-2">
              <label className="form-label">Vendor</label>
              <SearchableSelect
                options={vendors.map((v) => ({ value: v.vendorId, label: v.vendorName ?? '' }))}
                value={editForm.vendorId === '' ? '' : editForm.vendorId}
                onChange={(v) => setEditForm((f) => ({ ...f, vendorId: v === '' ? '' : Number(v) }))}
                placeholder="—"
              />
            </div>
            <div className="mb-2">
              <label className="form-label">Status</label>
              <SearchableSelect
                options={[
                  { value: 'OPEN', label: 'OPEN' },
                  { value: 'IN_PROGRESS', label: 'IN_PROGRESS' },
                  { value: 'ON_HOLD', label: 'ON_HOLD' },
                  { value: 'RESOLVED', label: 'RESOLVED' },
                  { value: 'CLOSED', label: 'CLOSED' },
                ]}
                value={editForm.status}
                onChange={(v) => setEditForm((f) => ({ ...f, status: String(v) }))}
                placeholder="—"
                allowEmpty={false}
              />
            </div>
            <div>
              <button type="button" className="btn btn-secondary me-2" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </div>
      ) : (
        <div className="card mb-4">
          <div className="card-body">
            <p><strong>Subject:</strong> {ticket.subject}</p>
            <p><strong>Asset:</strong> <Link to={`/assets/${ticket.assetId}`}>{ticket.assetTag}</Link></p>
            <p><strong>Vendor:</strong> {ticket.vendorName ?? '—'}</p>
            <p><strong>Reported by:</strong> {ticket.reportedByUserName ?? '—'}</p>
            <p><strong>Reported at:</strong> {ticket.reportedAt ? formatDateTimeInAppTz(ticket.reportedAt, timeZone) : '—'}</p>
            {ticket.resolvedAt && (
              <>
                <p><strong>Resolved at:</strong> {formatDateTimeInAppTz(ticket.resolvedAt, timeZone)}</p>
                {ticket.resolutionNotes && <p><strong>Resolution notes:</strong> {ticket.resolutionNotes}</p>}
                {ticket.cost != null && <p><strong>Cost:</strong> {ticket.cost}</p>}
              </>
            )}
            {ticket.description && (
              <div className="mt-2">
                <strong>Description:</strong>
                <div className="border rounded p-2 bg-light mt-1">{ticket.description}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {showCloseModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">Close ticket</div>
              <form onSubmit={handleClose}>
                <div className="modal-body">
                  <div className="mb-2">
                    <label className="form-label">Resolution notes</label>
                    <textarea
                      className="form-control"
                      rows={3}
                      value={closeNotes}
                      onChange={(e) => setCloseNotes(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Cost</label>
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      className="form-control"
                      value={closeCost === '' ? '' : closeCost}
                      onChange={(e) => setCloseCost(e.target.value === '' ? '' : parseFloat(e.target.value) || '')}
                      placeholder="Optional"
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCloseModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Closing...' : 'Close ticket'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
