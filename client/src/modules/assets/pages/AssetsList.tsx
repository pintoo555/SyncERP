import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../../api/client';
import { UserAvatarWithName } from '../../../components/UserAvatar';
import { SearchableSelect } from '../../../components/SearchableSelect';

interface AssetRow {
  assetId: number;
  assetTag: string;
  primaryFileId?: number | null;
  categoryName: string | null;
  status: string;
  currentAssignedToUserId?: number | null;
  assignedToUserName: string | null;
  locationName: string | null;
}

interface MasterOption {
  categoryId?: number;
  brandId?: number;
  modelId?: number;
  vendorId?: number;
  locationId?: number;
  categoryName?: string;
  brandName?: string;
  modelName?: string;
  vendorName?: string;
  locationName?: string;
  categoryCode?: string;
  brandCode?: string;
  modelCode?: string;
  locationCode?: string;
}

export default function AssetsList() {
  const [data, setData] = useState<AssetRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const pageSize = 20;

  const [categories, setCategories] = useState<MasterOption[]>([]);
  const [brands, setBrands] = useState<MasterOption[]>([]);
  const [models, setModels] = useState<MasterOption[]>([]);
  const [vendors, setVendors] = useState<MasterOption[]>([]);
  const [locations, setLocations] = useState<MasterOption[]>([]);

  const [form, setForm] = useState({
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

  const loadList = useCallback(() => {
    setLoading(true);
    api.get<{ success: boolean; data: AssetRow[]; total: number }>(`/api/assets?page=${page}&pageSize=${pageSize}`)
      .then((res) => {
        setData(res.data);
        setTotal(res.total);
      })
      .catch(() => { setData([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openAddModal = () => {
    setError('');
    setForm({
      assetTag: '',
      categoryId: '',
      brandId: '',
      modelId: '',
      serialNumber: '',
      purchaseDate: '',
      purchasePrice: '',
      vendorId: '',
      warrantyExpiry: '',
      amcExpiry: '',
      locationId: '',
      description: '',
      tagNames: '',
    });
    setShowAddModal(true);
    api.get<{ success: boolean; data: MasterOption[] }>('/api/masters/categories?pageSize=500')
      .then((r) => setCategories(Array.isArray(r.data) ? r.data : []))
      .catch(() => setCategories([]));
    api.get<{ success: boolean; data: MasterOption[] }>('/api/masters/brands?pageSize=500')
      .then((r) => setBrands(Array.isArray(r.data) ? r.data : []))
      .catch(() => setBrands([]));
    api.get<{ success: boolean; data: MasterOption[] }>('/api/masters/models?pageSize=500')
      .then((r) => setModels(Array.isArray(r.data) ? r.data : []))
      .catch(() => setModels([]));
    api.get<{ success: boolean; data: MasterOption[] }>('/api/masters/vendors?pageSize=500')
      .then((r) => setVendors(Array.isArray(r.data) ? r.data : []))
      .catch(() => setVendors([]));
    api.get<{ success: boolean; data: MasterOption[] }>('/api/masters/locations?pageSize=500')
      .then((r) => setLocations(Array.isArray(r.data) ? r.data : []))
      .catch(() => setLocations([]));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const catId = form.categoryId === '' ? undefined : Number(form.categoryId);
    if (!catId || catId < 1) {
      setError('Category is required');
      return;
    }
    setSaving(true);
    const body = {
      assetTag: form.assetTag.trim(),
      categoryId: catId,
      brandId: form.brandId === '' ? null : Number(form.brandId) || null,
      modelId: form.modelId === '' ? null : Number(form.modelId) || null,
      serialNumber: form.serialNumber.trim() || null,
      purchaseDate: form.purchaseDate || null,
      purchasePrice: form.purchasePrice === '' ? null : Number(form.purchasePrice) || null,
      vendorId: form.vendorId === '' ? null : Number(form.vendorId) || null,
      warrantyExpiry: form.warrantyExpiry || null,
      amcExpiry: form.amcExpiry || null,
      locationId: form.locationId === '' ? null : Number(form.locationId) || null,
      description: form.description.trim() || null,
      tagNames: form.tagNames.trim() ? form.tagNames.split(/[\s,]+/).filter(Boolean) : [],
    };
    api.post<{ success: boolean; data: { assetId: number } }>('/api/assets', body)
      .then(() => {
        setShowAddModal(false);
        loadList();
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to create asset'))
      .finally(() => setSaving(false));
  };

  const modelsForBrand = form.brandId ? models.filter((m) => (m as { brandId?: number }).brandId === Number(form.brandId)) : models;

  return (
    <div className="container-fluid">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">Asset List</h4>
        <button type="button" className="btn btn-primary" onClick={openAddModal}>
          Add Asset
        </button>
      </div>
      <div className="card">
        <div className="card-body p-0">
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th style={{ width: 56 }}>Photo</th>
                  <th>Tag</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th>Assigned To</th>
                  <th>Location</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={7} className="text-center py-4 text-muted">Loading...</td></tr>
                )}
                {!loading && data.map((a) => (
                  <tr key={a.assetId}>
                    <td className="align-middle">
                      <div className="d-flex align-items-center gap-1">
                        {a.primaryFileId != null && (
                          <img
                            src={`/api/files/${a.primaryFileId}`}
                            alt=""
                            className="rounded"
                            style={{ width: 40, height: 40, objectFit: 'cover' }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              const next = e.currentTarget.nextElementSibling as HTMLElement;
                              if (next) next.classList.remove('d-none');
                            }}
                          />
                        )}
                        <span className={a.primaryFileId ? 'd-none small text-muted' : 'small text-muted'} style={{ width: 40, height: 40, lineHeight: '40px', textAlign: 'center', display: 'inline-block' }}>—</span>
                        <a href={typeof window !== 'undefined' ? `${window.location.origin}/assets/${a.assetId}` : '#'} target="_blank" rel="noreferrer" title="QR: scan to open asset">
                          <img src={`https://api.qrserver.com/v1/create-qr-code/?size=36x36&data=${encodeURIComponent(typeof window !== 'undefined' ? `${window.location.origin}/assets/${a.assetId}` : '')}`} alt="QR" style={{ width: 36, height: 36 }} />
                        </a>
                      </div>
                    </td>
                    <td><Link to={`/assets/${a.assetId}`}>{a.assetTag}</Link></td>
                    <td>{a.categoryName ?? '-'}</td>
                    <td><span className="badge bg-secondary">{a.status}</span></td>
                    <td>
                      {a.currentAssignedToUserId != null && a.assignedToUserName ? (
                        <UserAvatarWithName userId={a.currentAssignedToUserId} name={a.assignedToUserName} size={28} />
                      ) : (
                        a.assignedToUserName ?? '—'
                      )}
                    </td>
                    <td>{a.locationName ?? '-'}</td>
                    <td><Link to={`/assets/${a.assetId}`} className="btn btn-sm btn-outline-primary">View</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!loading && total > pageSize && (
            <div className="d-flex justify-content-between align-items-center p-3 border-top">
              <span className="small text-muted">Total: {total}</span>
              <div>
                <button type="button" className="btn btn-sm btn-outline-secondary me-1" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <span className="mx-2">Page {page}</span>
                <button type="button" className="btn btn-sm btn-outline-secondary ms-1" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog modal-lg modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add Asset</h5>
                <button type="button" className="btn-close" onClick={() => setShowAddModal(false)} aria-label="Close" />
              </div>
              <form onSubmit={handleCreate}>
                <div className="modal-body">
                  {error && <div className="alert alert-danger py-2 small">{error}</div>}
                  <div className="row g-2">
                    <div className="col-md-6">
                      <label className="form-label">Asset Tag *</label>
                      <input className="form-control" value={form.assetTag} onChange={(e) => setForm((f) => ({ ...f, assetTag: e.target.value }))} required />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Category *</label>
                      <SearchableSelect
                        options={categories.map((c) => ({ value: c.categoryId!, label: c.categoryName ?? c.categoryCode ?? '' }))}
                        value={form.categoryId}
                        onChange={(v) => setForm((f) => ({ ...f, categoryId: v === '' ? '' : Number(v) }))}
                        placeholder="Select category"
                        allowEmpty={false}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Brand</label>
                      <SearchableSelect
                        options={brands.map((b) => ({ value: b.brandId!, label: b.brandName ?? b.brandCode ?? '' }))}
                        value={form.brandId}
                        onChange={(v) => setForm((f) => ({ ...f, brandId: v === '' ? '' : Number(v), modelId: '' }))}
                        placeholder="—"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Model</label>
                      <SearchableSelect
                        options={modelsForBrand.map((m) => ({ value: m.modelId!, label: m.modelName ?? m.modelCode ?? '' }))}
                        value={form.modelId}
                        onChange={(v) => setForm((f) => ({ ...f, modelId: v === '' ? '' : Number(v) }))}
                        placeholder="—"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Serial Number</label>
                      <input className="form-control" value={form.serialNumber} onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Vendor</label>
                      <SearchableSelect
                        options={vendors.map((v) => ({ value: v.vendorId!, label: v.vendorName ?? '' }))}
                        value={form.vendorId}
                        onChange={(v) => setForm((f) => ({ ...f, vendorId: v === '' ? '' : Number(v) }))}
                        placeholder="—"
                      />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Purchase Date</label>
                      <input type="date" className="form-control" value={form.purchaseDate} onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Purchase Price</label>
                      <input type="number" step="0.01" min="0" className="form-control" value={form.purchasePrice === '' ? '' : form.purchasePrice} onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value === '' ? '' : Number(e.target.value) }))} />
                    </div>
                    <div className="col-md-4">
                      <label className="form-label">Location</label>
                      <SearchableSelect
                        options={locations.map((l) => ({ value: l.locationId!, label: l.locationName ?? l.locationCode ?? '' }))}
                        value={form.locationId}
                        onChange={(v) => setForm((f) => ({ ...f, locationId: v === '' ? '' : Number(v) }))}
                        placeholder="—"
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">Warranty Expiry</label>
                      <input type="date" className="form-control" value={form.warrantyExpiry} onChange={(e) => setForm((f) => ({ ...f, warrantyExpiry: e.target.value }))} />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label">AMC Expiry</label>
                      <input type="date" className="form-control" value={form.amcExpiry} onChange={(e) => setForm((f) => ({ ...f, amcExpiry: e.target.value }))} />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Tags (comma or space separated)</label>
                      <input className="form-control" value={form.tagNames} onChange={(e) => setForm((f) => ({ ...f, tagNames: e.target.value }))} placeholder="e.g. laptop, it" />
                    </div>
                    <div className="col-12">
                      <label className="form-label">Description</label>
                      <textarea className="form-control" rows={2} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Create Asset'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
