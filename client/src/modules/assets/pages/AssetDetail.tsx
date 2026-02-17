import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../../api/client';
import { useAuth } from '../../../hooks/useAuth';
import { useAppSettings } from '../../../contexts/AppSettingsContext';
import { formatDateTimeInAppTz } from '../../../utils/dateUtils';
import { SearchableSelect } from '../../../components/SearchableSelect';

interface AssetDetailData {
  asset: {
    assetId: number;
    assetTag: string;
    primaryFileId?: number | null;
    categoryId: number;
    categoryName: string | null;
    brandId: number | null;
    brandName: string | null;
    modelId: number | null;
    modelName: string | null;
    serialNumber: string | null;
    status: string;
    purchaseDate: string | null;
    purchasePrice: number | null;
    vendorId: number | null;
    warrantyExpiry: string | null;
    amcExpiry: string | null;
    locationId: number | null;
    locationName: string | null;
    assignedToUserName: string | null;
    description: string | null;
    tagNames?: string[];
  };
  assignmentHistory: {
    assignmentId: number;
    assignedToUserName: string;
    assignedByUserName: string;
    assignedAt: string;
    dueReturnDate: string | null;
    returnedAt: string | null;
    returnedByUserName: string | null;
    notes: string | null;
    assignmentType: string;
  }[];
  maintenanceTickets: { ticketId: number; ticketNumber: string; subject: string; status: string }[];
  verificationHistory: { verificationId: number; verifiedAt: string; verifiedByUserName: string; locationName: string | null; notes: string | null; verifiedStatus: string | null }[];
  auditTrail: { auditId: number; eventType: string; createdAt: string; userEmail: string | null }[];
}

interface FileRow {
  assetFileId: number;
  assetId: number;
  fileId: number;
  caption: string | null;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  isPrimary?: boolean;
}

interface MasterOption {
  categoryId?: number;
  brandId?: number;
  modelId?: number;
  vendorId?: number;
  locationId?: number;
  categoryName?: string;
  categoryCode?: string;
  brandName?: string;
  brandCode?: string;
  modelName?: string;
  modelCode?: string;
  vendorName?: string;
  locationName?: string;
  locationCode?: string;
}

interface UserOption {
  userId: number;
  name: string;
  email: string;
}

export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { timeZone } = useAppSettings();
  const [data, setData] = useState<AssetDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'assignments' | 'tickets' | 'verification' | 'audit' | 'files'>('overview');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState<FileRow[]>([]);
  const [fileUploading, setFileUploading] = useState(false);
  const [uploadCaption, setUploadCaption] = useState('');
  const [categories, setCategories] = useState<MasterOption[]>([]);
  const [brands, setBrands] = useState<MasterOption[]>([]);
  const [models, setModels] = useState<MasterOption[]>([]);
  const [vendors, setVendors] = useState<MasterOption[]>([]);
  const [locations, setLocations] = useState<MasterOption[]>([]);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [issueForm, setIssueForm] = useState({ assignedToUserId: '' as number | '', dueReturnDate: '', notes: '' });
  const [returnNotes, setReturnNotes] = useState('');
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyForm, setVerifyForm] = useState({ locationId: '' as number | '', notes: '', verifiedStatus: '' });
  const [verifySaving, setVerifySaving] = useState(false);
  const canIssue = user?.permissions?.includes('ASSIGN.ISSUE');
  const canReturn = user?.permissions?.includes('ASSIGN.RETURN');
  const canVerify = user?.permissions?.includes('VERIFY.CREATE');

  const loadAsset = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api.get<{ success: boolean; data: AssetDetailData }>(`/api/assets/${id}`)
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    loadAsset();
  }, [loadAsset]);

  const loadFiles = useCallback(() => {
    if (!id) return;
    api.get<{ success: boolean; data: FileRow[] }>(`/api/files/asset/${id}`)
      .then((res) => setFiles(Array.isArray(res.data) ? res.data : []))
      .catch(() => setFiles([]));
  }, [id]);

  useEffect(() => {
    if (tab === 'files' && id) loadFiles();
  }, [tab, id, loadFiles]);

  const loadMasters = useCallback(() => {
    api.get<{ success: boolean; data: MasterOption[] }>('/api/masters/categories?pageSize=500').then((r) => setCategories(Array.isArray(r.data) ? r.data : [])).catch(() => setCategories([]));
    api.get<{ success: boolean; data: MasterOption[] }>('/api/masters/brands?pageSize=500').then((r) => setBrands(Array.isArray(r.data) ? r.data : [])).catch(() => setBrands([]));
    api.get<{ success: boolean; data: MasterOption[] }>('/api/masters/models?pageSize=500').then((r) => setModels(Array.isArray(r.data) ? r.data : [])).catch(() => setModels([]));
    api.get<{ success: boolean; data: MasterOption[] }>('/api/masters/vendors?pageSize=500').then((r) => setVendors(Array.isArray(r.data) ? r.data : [])).catch(() => setVendors([]));
    api.get<{ success: boolean; data: MasterOption[] }>('/api/masters/locations?pageSize=500').then((r) => setLocations(Array.isArray(r.data) ? r.data : [])).catch(() => setLocations([]));
  }, []);

  useEffect(() => {
    if (id) loadMasters();
  }, [id, loadMasters]);

  const [editForm, setEditForm] = useState({
    assetTag: '',
    categoryId: '' as number | '',
    brandId: '' as number | '',
    modelId: '' as number | '',
    serialNumber: '',
    purchaseDate: '',
    purchasePrice: '' as number | '',
    vendorId: '' as number | '',
    warrantyExpiry: '',
    amcExpiry: '',
    locationId: '' as number | '',
    description: '',
    tagNames: '',
  });

  const startEdit = () => {
    if (!data?.asset) return;
    const a = data.asset;
    setEditForm({
      assetTag: a.assetTag,
      categoryId: a.categoryId ?? '',
      brandId: a.brandId ?? '',
      modelId: a.modelId ?? '',
      serialNumber: a.serialNumber ?? '',
      purchaseDate: a.purchaseDate ?? '',
      purchasePrice: a.purchasePrice ?? '',
      vendorId: a.vendorId ?? '',
      warrantyExpiry: a.warrantyExpiry ?? '',
      amcExpiry: a.amcExpiry ?? '',
      locationId: a.locationId ?? '',
      description: a.description ?? '',
      tagNames: a.tagNames?.join(', ') ?? '',
    });
    setError('');
    setEditing(true);
    loadMasters();
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !data?.asset) return;
    setError('');
    setSaving(true);
    const body = {
      assetTag: editForm.assetTag.trim(),
      categoryId: editForm.categoryId === '' ? undefined : Number(editForm.categoryId),
      brandId: editForm.brandId === '' ? null : Number(editForm.brandId) || null,
      modelId: editForm.modelId === '' ? null : Number(editForm.modelId) || null,
      serialNumber: editForm.serialNumber.trim() || null,
      purchaseDate: editForm.purchaseDate || null,
      purchasePrice: editForm.purchasePrice === '' ? null : Number(editForm.purchasePrice) || null,
      vendorId: editForm.vendorId === '' ? null : Number(editForm.vendorId) || null,
      warrantyExpiry: editForm.warrantyExpiry || null,
      amcExpiry: editForm.amcExpiry || null,
      locationId: editForm.locationId === '' ? null : Number(editForm.locationId) || null,
      description: editForm.description.trim() || null,
      tagNames: editForm.tagNames.trim() ? editForm.tagNames.split(/[\s,]+/).filter(Boolean) : [],
    };
    api.put<{ success: boolean }>(`/api/assets/${id}`, body)
      .then(() => {
        setEditing(false);
        loadAsset();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Update failed'))
      .finally(() => setSaving(false));
  };

  const handleDelete = () => {
    if (!id || !window.confirm('Delete this asset? This cannot be undone.')) return;
    api.delete(`/api/assets/${id}`)
      .then(() => navigate('/assets'))
      .catch((err) => setError(err instanceof Error ? err.message : 'Delete failed'));
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;
    setFileUploading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('assetId', id);
    if (uploadCaption.trim()) formData.append('caption', uploadCaption.trim());
    api.upload<{ success: boolean }>('/api/files/upload', formData)
      .then(() => {
        setUploadCaption('');
        e.target.value = '';
        loadFiles();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Upload failed'))
      .finally(() => setFileUploading(false));
  };

  const deleteFile = (fileId: number) => {
    if (!window.confirm('Remove this file?')) return;
    api.delete(`/api/files/${fileId}`)
      .then(() => { loadFiles(); loadAsset(); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Delete failed'));
  };

  const setPrimaryPhoto = (fileId: number) => {
    if (!id) return;
    setError('');
    api.put<{ success: boolean; data: unknown }>(`/api/assets/${id}/primary-photo`, { fileId })
      .then(() => { loadAsset(); loadFiles(); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to set primary photo'));
  };

  const openIssueModal = () => {
    setIssueForm({ assignedToUserId: '', dueReturnDate: '', notes: '' });
    setShowIssueModal(true);
    api.get<{ success: boolean; data: UserOption[] }>('/api/users')
      .then((r) => setUsers(Array.isArray(r.data) ? r.data : []))
      .catch(() => setUsers([]));
  };

  const handleIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !issueForm.assignedToUserId) return;
    setError('');
    setSaving(true);
    api.post('/api/assignments/issue', {
      assetId: Number(id),
      assignedToUserId: Number(issueForm.assignedToUserId),
      dueReturnDate: issueForm.dueReturnDate || null,
      notes: issueForm.notes.trim() || null,
    })
      .then(() => { setShowIssueModal(false); loadAsset(); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Issue failed'))
      .finally(() => setSaving(false));
  };

  const currentAssignment = data?.assignmentHistory?.find((a) => !a.returnedAt);
  const handleReturn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentAssignment) return;
    setError('');
    setSaving(true);
    api.post('/api/assignments/return', { assignmentId: currentAssignment.assignmentId, notes: returnNotes.trim() || null })
      .then(() => { setShowReturnModal(false); setReturnNotes(''); loadAsset(); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Return failed'))
      .finally(() => setSaving(false));
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setError('');
    setVerifySaving(true);
    api.post('/api/verification', {
      assetId: Number(id),
      locationId: verifyForm.locationId === '' ? null : verifyForm.locationId,
      notes: verifyForm.notes.trim() || null,
      verifiedStatus: verifyForm.verifiedStatus.trim() || null,
    })
      .then(() => {
        setShowVerifyModal(false);
        setVerifyForm({ locationId: '', notes: '', verifiedStatus: '' });
        loadAsset();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Verification failed'))
      .finally(() => setVerifySaving(false));
  };

  if (loading) return <div className="text-muted">Loading...</div>;
  if (!data) return <div className="alert alert-warning">Asset not found.</div>;

  const { asset, assignmentHistory, maintenanceTickets, verificationHistory, auditTrail } = data;
  const modelsForBrand = editForm.brandId ? models.filter((m) => (m as { brandId?: number }).brandId === Number(editForm.brandId)) : models;
  const tabs = [
    { key: 'overview' as const, label: 'Overview' },
    { key: 'assignments' as const, label: 'Assignments' },
    { key: 'tickets' as const, label: 'Tickets' },
    { key: 'verification' as const, label: 'Verification' },
    { key: 'files' as const, label: 'Files' },
    { key: 'audit' as const, label: 'Audit Trail' },
  ];

  return (
    <div className="container-fluid">
      <div className="d-flex align-items-center gap-2 mb-4 flex-wrap">
        <Link to="/assets" className="btn btn-sm btn-outline-secondary">← Back</Link>
        {id && (
          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=48x48&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/assets/${id}` : '')}`} alt="QR" title="Scan to open this asset" style={{ width: 48, height: 48 }} />
        )}
        <h4 className="mb-0">{asset.assetTag}</h4>
        <span className="badge bg-secondary">{asset.status}</span>
        {!editing && (
          <>
            <button type="button" className="btn btn-sm btn-outline-primary" onClick={startEdit}>Edit</button>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={handleDelete}>Delete</button>
          </>
        )}
      </div>

      {editing && (
        <div className="card mb-4">
          <div className="card-header">Edit Asset</div>
          <form onSubmit={handleUpdate} className="card-body">
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            <div className="row g-2">
              <div className="col-md-6">
                <label className="form-label">Asset Tag *</label>
                <input className="form-control" value={editForm.assetTag} onChange={(e) => setEditForm((f) => ({ ...f, assetTag: e.target.value }))} required />
              </div>
              <div className="col-md-6">
                <label className="form-label">Category *</label>
                <SearchableSelect
                  options={categories.map((c) => ({ value: c.categoryId!, label: c.categoryName ?? c.categoryCode ?? '' }))}
                  value={editForm.categoryId}
                  onChange={(v) => setEditForm((f) => ({ ...f, categoryId: v === '' ? '' : Number(v) }))}
                  placeholder="Select"
                  allowEmpty={false}
                  required
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Brand</label>
                <SearchableSelect
                  options={brands.map((b) => ({ value: b.brandId!, label: b.brandName ?? b.brandCode ?? '' }))}
                  value={editForm.brandId}
                  onChange={(v) => setEditForm((f) => ({ ...f, brandId: v === '' ? '' : Number(v), modelId: '' }))}
                  placeholder="—"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Model</label>
                <SearchableSelect
                  options={modelsForBrand.map((m) => ({ value: m.modelId!, label: m.modelName ?? m.modelCode ?? '' }))}
                  value={editForm.modelId}
                  onChange={(v) => setEditForm((f) => ({ ...f, modelId: v === '' ? '' : Number(v) }))}
                  placeholder="—"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Serial Number</label>
                <input className="form-control" value={editForm.serialNumber} onChange={(e) => setEditForm((f) => ({ ...f, serialNumber: e.target.value }))} />
              </div>
              <div className="col-md-6">
                <label className="form-label">Vendor</label>
                <SearchableSelect
                  options={vendors.map((v) => ({ value: v.vendorId!, label: v.vendorName ?? '' }))}
                  value={editForm.vendorId}
                  onChange={(v) => setEditForm((f) => ({ ...f, vendorId: v === '' ? '' : Number(v) }))}
                  placeholder="—"
                />
              </div>
              <div className="col-md-4">
                <label className="form-label">Purchase Date</label>
                <input type="date" className="form-control" value={editForm.purchaseDate} onChange={(e) => setEditForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Purchase Price</label>
                <input type="number" step="0.01" min="0" className="form-control" value={editForm.purchasePrice === '' ? '' : editForm.purchasePrice} onChange={(e) => setEditForm((f) => ({ ...f, purchasePrice: e.target.value === '' ? '' : Number(e.target.value) }))} />
              </div>
              <div className="col-md-4">
                <label className="form-label">Location</label>
                <SearchableSelect
                  options={locations.map((l) => ({ value: l.locationId!, label: l.locationName ?? l.locationCode ?? '' }))}
                  value={editForm.locationId}
                  onChange={(v) => setEditForm((f) => ({ ...f, locationId: v === '' ? '' : Number(v) }))}
                  placeholder="—"
                />
              </div>
              <div className="col-md-6">
                <label className="form-label">Warranty Expiry</label>
                <input type="date" className="form-control" value={editForm.warrantyExpiry} onChange={(e) => setEditForm((f) => ({ ...f, warrantyExpiry: e.target.value }))} />
              </div>
              <div className="col-md-6">
                <label className="form-label">AMC Expiry</label>
                <input type="date" className="form-control" value={editForm.amcExpiry} onChange={(e) => setEditForm((f) => ({ ...f, amcExpiry: e.target.value }))} />
              </div>
              <div className="col-12">
                <label className="form-label">Tags (comma or space separated)</label>
                <input className="form-control" value={editForm.tagNames} onChange={(e) => setEditForm((f) => ({ ...f, tagNames: e.target.value }))} />
              </div>
              <div className="col-12">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows={2} value={editForm.description} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="mt-3">
              <button type="button" className="btn btn-secondary me-2" onClick={() => setEditing(false)}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </div>
      )}

      <ul className="nav nav-tabs mb-3">
        {tabs.map((t) => (
          <li key={t.key} className="nav-item">
            <button type="button" className={`nav-link ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
          </li>
        ))}
      </ul>

      {tab === 'overview' && !editing && (
        <div className="card">
          <div className="card-body">
            {(canIssue || canReturn) && (
              <div className="mb-4 p-3 bg-light rounded">
                <strong className="d-block small text-muted mb-2">Assignment</strong>
                {asset.status === 'AVAILABLE' && canIssue && (
                  <button type="button" className="btn btn-success btn-sm" onClick={openIssueModal}>Issue to user</button>
                )}
                {asset.status === 'ISSUED' && (
                  <>
                    <span className="me-2">Assigned to: <strong>{asset.assignedToUserName ?? '—'}</strong></span>
                    {canReturn && (
                      <button type="button" className="btn btn-warning btn-sm" onClick={() => setShowReturnModal(true)}>Return asset</button>
                    )}
                  </>
                )}
              </div>
            )}
            {asset.primaryFileId != null && (
              <div className="mb-4">
                <strong className="d-block small text-muted mb-2">Primary photo</strong>
                <img
                  src={`/api/files/${asset.primaryFileId}`}
                  alt="Asset"
                  className="rounded border"
                  style={{ maxWidth: 280, maxHeight: 200, objectFit: 'contain' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              </div>
            )}
            <div className="row">
              <div className="col-md-6">
                <p><strong>Category:</strong> {asset.categoryName ?? '-'}</p>
                <p><strong>Brand / Model:</strong> {[asset.brandName, asset.modelName].filter(Boolean).join(' / ') || '-'}</p>
                <p><strong>Serial:</strong> {asset.serialNumber ?? '-'}</p>
                <p><strong>Location:</strong> {asset.locationName ?? '-'}</p>
                <p><strong>Assigned to:</strong> {asset.assignedToUserName ?? '-'}</p>
              </div>
              <div className="col-md-6">
                <p><strong>Purchase price:</strong> {asset.purchasePrice != null ? asset.purchasePrice.toLocaleString() : '-'}</p>
                <p><strong>Warranty expiry:</strong> {asset.warrantyExpiry ?? '-'}</p>
                <p><strong>AMC expiry:</strong> {asset.amcExpiry ?? '-'}</p>
                <p><strong>Tags:</strong> {asset.tagNames?.length ? asset.tagNames.join(', ') : '-'}</p>
              </div>
            </div>
            {asset.description && <p className="mt-2"><strong>Description:</strong><br />{asset.description}</p>}
          </div>
        </div>
      )}

      {tab === 'assignments' && (
        <div className="card">
          <div className="card-header"><h6 className="mb-0">Issue &amp; return history</h6></div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>Assigned To</th>
                    <th>Issued By</th>
                    <th>Issued At</th>
                    <th>Due Return</th>
                    <th>Returned At</th>
                    <th>Returned By</th>
                    <th>Type</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {assignmentHistory.map((a) => (
                    <tr key={a.assignmentId}>
                      <td>{a.assignedToUserName}</td>
                      <td>{a.assignedByUserName ?? '-'}</td>
                      <td>{a.assignedAt}</td>
                      <td>{a.dueReturnDate ?? '-'}</td>
                      <td>{a.returnedAt ?? '—'}</td>
                      <td>{a.returnedByUserName ?? '—'}</td>
                      <td><span className="badge bg-secondary">{a.assignmentType ?? 'ISSUE'}</span></td>
                      <td className="text-muted small">{a.notes ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {assignmentHistory.length === 0 && <p className="p-4 text-muted mb-0">No assignment history.</p>}
          </div>
        </div>
      )}

      {tab === 'tickets' && (
        <div className="card">
          <div className="card-body">
            {user?.permissions?.includes('TICKET.CREATE') && id && (
              <div className="mb-3">
                <Link to={`/tickets/new?assetId=${id}`} className="btn btn-sm btn-primary">Create ticket</Link>
              </div>
            )}
            <table className="table mb-0">
              <thead><tr><th>Ticket #</th><th>Subject</th><th>Status</th></tr></thead>
              <tbody>
                {maintenanceTickets.map((t) => (
                  <tr key={t.ticketId}>
                    <td><Link to={`/tickets/${t.ticketId}`} className="text-decoration-none">{t.ticketNumber}</Link></td>
                    <td><Link to={`/tickets/${t.ticketId}`} className="text-decoration-none">{t.subject}</Link></td>
                    <td><span className={`badge ${t.status === 'CLOSED' || t.status === 'RESOLVED' ? 'bg-success' : 'bg-warning text-dark'}`}>{t.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {maintenanceTickets.length === 0 && <p className="p-4 text-muted mb-0">No tickets.</p>}
          </div>
        </div>
      )}

      {tab === 'verification' && (
        <div className="card">
          <div className="card-body">
            {canVerify && id && (
              <div className="mb-3">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => setShowVerifyModal(true)}>Verify asset</button>
              </div>
            )}
            <table className="table mb-0">
              <thead>
                <tr><th>Verified At</th><th>By</th><th>Location</th><th>Notes</th><th>Status</th></tr>
              </thead>
              <tbody>
                {verificationHistory.map((v) => (
                  <tr key={v.verificationId}>
                    <td>{formatDateTimeInAppTz(v.verifiedAt, timeZone)}</td>
                    <td>{v.verifiedByUserName}</td>
                    <td>{v.locationName ?? '—'}</td>
                    <td className="small">{v.notes ?? '—'}</td>
                    <td>{v.verifiedStatus ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {verificationHistory.length === 0 && <p className="p-4 text-muted mb-0">No verification records.</p>}
          </div>
        </div>
      )}

      {tab === 'files' && (
        <div className="card">
          <div className="card-body">
            {error && <div className="alert alert-danger py-2 small">{error}</div>}
            <div className="mb-3">
              <label className="form-label">Upload file</label>
              <div className="d-flex gap-2 flex-wrap align-items-end">
                <input type="file" className="form-control form-control-sm" style={{ maxWidth: 260 }} onChange={handleFileSelect} disabled={fileUploading} accept=".pdf,.jpg,.jpeg,.png,.gif" />
                <input type="text" className="form-control form-control-sm" style={{ maxWidth: 200 }} placeholder="Caption (optional)" value={uploadCaption} onChange={(e) => setUploadCaption(e.target.value)} />
                {fileUploading && <span className="text-muted small">Uploading...</span>}
              </div>
              <small className="text-muted">Allowed: PDF, JPEG, PNG, GIF. Max 10MB.</small>
            </div>
            <table className="table table-sm mb-0">
              <thead><tr><th>File</th><th>Size</th><th>Caption</th><th>Primary</th><th></th></tr></thead>
              <tbody>
                {files.map((f) => (
                  <tr key={f.assetFileId}>
                    <td>
                      <a href={`/api/files/${f.fileId}`} download={f.originalFileName} target="_blank" rel="noreferrer">{f.originalFileName}</a>
                    </td>
                    <td>{(f.fileSizeBytes / 1024).toFixed(1)} KB</td>
                    <td>{f.caption ?? '-'}</td>
                    <td>
                      {f.isPrimary ? (
                        <span className="badge bg-success">Primary photo</span>
                      ) : (
                        <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setPrimaryPhoto(f.fileId)}>Set as primary</button>
                      )}
                    </td>
                    <td>
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => deleteFile(f.fileId)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {files.length === 0 && <p className="text-muted mb-0 mt-2">No files attached.</p>}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="card">
          <div className="card-body p-0">
            <table className="table mb-0">
              <thead><tr><th>Date</th><th>Event</th><th>User</th></tr></thead>
              <tbody>
                {auditTrail.map((a) => (
                  <tr key={a.auditId}>
                    <td>{formatDateTimeInAppTz(a.createdAt, timeZone)}</td>
                    <td>{a.eventType}</td>
                    <td>{a.userEmail ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {auditTrail.length === 0 && <p className="p-4 text-muted mb-0">No audit entries.</p>}
          </div>
        </div>
      )}

      {showIssueModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Issue asset to user</h5>
                <button type="button" className="btn-close" onClick={() => setShowIssueModal(false)} aria-label="Close" />
              </div>
              <form onSubmit={handleIssue}>
                <div className="modal-body">
                  {error && <div className="alert alert-danger py-2 small">{error}</div>}
                  <div className="mb-2">
                    <label className="form-label">Assign to user *</label>
                    <SearchableSelect
                      options={users.map((u) => ({ value: u.userId, label: `${u.name} (${u.email})` }))}
                      value={issueForm.assignedToUserId}
                      onChange={(v) => setIssueForm((f) => ({ ...f, assignedToUserId: v === '' ? '' : Number(v) }))}
                      placeholder="Select user"
                      allowEmpty={false}
                      required
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Due return date</label>
                    <input type="date" className="form-control" value={issueForm.dueReturnDate} onChange={(e) => setIssueForm((f) => ({ ...f, dueReturnDate: e.target.value }))} />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Notes</label>
                    <textarea className="form-control" rows={2} value={issueForm.notes} onChange={(e) => setIssueForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowIssueModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-success" disabled={saving}>{saving ? 'Issuing...' : 'Issue'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showReturnModal && currentAssignment && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Return asset</h5>
                <button type="button" className="btn-close" onClick={() => setShowReturnModal(false)} aria-label="Close" />
              </div>
              <form onSubmit={handleReturn}>
                <div className="modal-body">
                  {error && <div className="alert alert-danger py-2 small">{error}</div>}
                  <p className="mb-2">Currently assigned to <strong>{currentAssignment.assignedToUserName}</strong>. Confirm return?</p>
                  <div className="mb-2">
                    <label className="form-label">Notes (optional)</label>
                    <textarea className="form-control" rows={2} value={returnNotes} onChange={(e) => setReturnNotes(e.target.value)} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowReturnModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-warning" disabled={saving}>{saving ? 'Returning...' : 'Return asset'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showVerifyModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Verify asset</h5>
                <button type="button" className="btn-close" onClick={() => setShowVerifyModal(false)} aria-label="Close" />
              </div>
              <form onSubmit={handleVerify}>
                <div className="modal-body">
                  {error && <div className="alert alert-danger py-2 small">{error}</div>}
                  <div className="mb-2">
                    <label className="form-label">Location (optional)</label>
                    <SearchableSelect
                      options={locations.map((l) => ({ value: l.locationId!, label: l.locationName ?? l.locationCode ?? String(l.locationId) }))}
                      value={verifyForm.locationId === '' ? '' : verifyForm.locationId}
                      onChange={(v) => setVerifyForm((f) => ({ ...f, locationId: v === '' ? '' : Number(v) }))}
                      placeholder="—"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Notes (optional)</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      maxLength={500}
                      value={verifyForm.notes}
                      onChange={(e) => setVerifyForm((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Verification notes"
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Verified status (optional)</label>
                    <input
                      type="text"
                      className="form-control"
                      maxLength={50}
                      value={verifyForm.verifiedStatus}
                      onChange={(e) => setVerifyForm((f) => ({ ...f, verifiedStatus: e.target.value }))}
                      placeholder="e.g. OK, Damaged"
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowVerifyModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={verifySaving}>{verifySaving ? 'Saving...' : 'Record verification'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
