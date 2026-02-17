import { useEffect, useState, useCallback } from 'react';
import { api } from '../../../api/client';
import { SearchableSelect } from '../../../components/SearchableSelect';

type MasterKey = 'categories' | 'brands' | 'models' | 'vendors' | 'locations';

const MASTER_CONFIG: Record<MasterKey, { label: string; path: string; columns: { key: string; label: string }[] }> = {
  categories: {
    label: 'Asset Categories',
    path: '/api/masters/categories',
    columns: [
      { key: 'categoryCode', label: 'Code' },
      { key: 'categoryName', label: 'Name' },
      { key: 'description', label: 'Description' },
      { key: 'sortOrder', label: 'Sort' },
      { key: 'isActive', label: 'Active' },
    ],
  },
  brands: {
    label: 'Brands',
    path: '/api/masters/brands',
    columns: [
      { key: 'brandCode', label: 'Code' },
      { key: 'brandName', label: 'Name' },
      { key: 'description', label: 'Description' },
      { key: 'isActive', label: 'Active' },
    ],
  },
  models: {
    label: 'Models',
    path: '/api/masters/models',
    columns: [
      { key: 'brandName', label: 'Brand' },
      { key: 'modelCode', label: 'Code' },
      { key: 'modelName', label: 'Name' },
      { key: 'description', label: 'Description' },
      { key: 'isActive', label: 'Active' },
    ],
  },
  vendors: {
    label: 'Vendors',
    path: '/api/masters/vendors',
    columns: [
      { key: 'vendorCode', label: 'Code' },
      { key: 'vendorName', label: 'Name' },
      { key: 'contactPerson', label: 'Contact' },
      { key: 'contactPhone', label: 'Phone' },
      { key: 'isActive', label: 'Active' },
    ],
  },
  locations: {
    label: 'Locations',
    path: '/api/masters/locations',
    columns: [
      { key: 'locationCode', label: 'Code' },
      { key: 'locationName', label: 'Name' },
      { key: 'address', label: 'Address' },
      { key: 'isActive', label: 'Active' },
    ],
  },
};

type RecordWithId = Record<string, unknown> & { categoryId?: number; brandId?: number; modelId?: number; vendorId?: number; locationId?: number };

function getRowId(row: RecordWithId, key: MasterKey): number | undefined {
  if (key === 'categories') return row.categoryId as number;
  if (key === 'brands') return row.brandId as number;
  if (key === 'models') return row.modelId as number;
  if (key === 'vendors') return row.vendorId as number;
  if (key === 'locations') return row.locationId as number;
  return undefined;
}

const PAGE_TITLE = 'Assets Masters | Synchronics ERP';

export default function Masters() {
  const [selected, setSelected] = useState<MasterKey>('categories');
  useEffect(() => {
    document.title = PAGE_TITLE;
    return () => { document.title = 'Synchronics ERP'; };
  }, []);
  const [data, setData] = useState<RecordWithId[]>([]);
  const [loading, setLoading] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState<'add' | 'edit' | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [brands, setBrands] = useState<RecordWithId[]>([]);
  const [categories, setCategories] = useState<RecordWithId[]>([]);
  const [locations, setLocations] = useState<RecordWithId[]>([]);

  const cfg = MASTER_CONFIG[selected];
  const path = cfg.path;

  const load = useCallback((key: MasterKey) => {
    const c = MASTER_CONFIG[key];
    setLoading(true);
    const params = new URLSearchParams({ pageSize: '500' });
    if (includeInactive) params.set('includeInactive', 'true');
    api.get<{ success: boolean; data: unknown[] }>(`${c.path}?${params}`)
      .then((res) => setData(Array.isArray(res.data) ? (res.data as RecordWithId[]) : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [includeInactive]);

  useEffect(() => {
    load(selected);
  }, [selected, load]);

  useEffect(() => {
    if (selected === 'models') {
      api.get<{ success: boolean; data: unknown[] }>('/api/masters/brands?pageSize=500')
        .then((r) => setBrands(Array.isArray(r.data) ? (r.data as RecordWithId[]) : []))
        .catch(() => setBrands([]));
    }
    if (selected === 'categories') {
      api.get<{ success: boolean; data: unknown[] }>('/api/masters/categories?pageSize=500')
        .then((r) => setCategories(Array.isArray(r.data) ? (r.data as RecordWithId[]) : []));
    }
    if (selected === 'locations') {
      api.get<{ success: boolean; data: unknown[] }>('/api/masters/locations?pageSize=500')
        .then((r) => setLocations(Array.isArray(r.data) ? (r.data as RecordWithId[]) : []));
    }
  }, [selected]);

  const [form, setForm] = useState<Record<string, string | number | boolean>>({});

  const openAdd = () => {
    setError('');
    setEditId(null);
    if (selected === 'categories') setForm({ categoryCode: '', categoryName: '', description: '', sortOrder: 0, isActive: true, parentCategoryId: '' });
    if (selected === 'brands') setForm({ brandCode: '', brandName: '', description: '', isActive: true });
    if (selected === 'models') setForm({ brandId: '', modelCode: '', modelName: '', description: '', isActive: true });
    if (selected === 'vendors') setForm({ vendorCode: '', vendorName: '', contactPerson: '', contactEmail: '', contactPhone: '', address: '', isActive: true });
    if (selected === 'locations') setForm({ locationCode: '', locationName: '', address: '', isActive: true, parentLocationId: '' });
    setModalOpen('add');
  };

  const openEdit = (row: RecordWithId) => {
    const id = getRowId(row, selected);
    if (id == null) return;
    setError('');
    setEditId(id);
    if (selected === 'categories') setForm({ categoryCode: String(row.categoryCode ?? ''), categoryName: String(row.categoryName ?? ''), description: String(row.description ?? ''), sortOrder: Number(row.sortOrder ?? 0), isActive: !!row.isActive, parentCategoryId: row.parentCategoryId == null ? '' : String(row.parentCategoryId) });
    if (selected === 'brands') setForm({ brandCode: String(row.brandCode ?? ''), brandName: String(row.brandName ?? ''), description: String(row.description ?? ''), isActive: !!row.isActive });
    if (selected === 'models') setForm({ brandId: row.brandId == null ? '' : String(row.brandId), modelCode: String(row.modelCode ?? ''), modelName: String(row.modelName ?? ''), description: String(row.description ?? ''), isActive: !!row.isActive });
    if (selected === 'vendors') setForm({ vendorCode: String(row.vendorCode ?? ''), vendorName: String(row.vendorName ?? ''), contactPerson: String(row.contactPerson ?? ''), contactEmail: String(row.contactEmail ?? ''), contactPhone: String(row.contactPhone ?? ''), address: String(row.address ?? ''), isActive: !!row.isActive });
    if (selected === 'locations') setForm({ locationCode: String(row.locationCode ?? ''), locationName: String(row.locationName ?? ''), address: String(row.address ?? ''), isActive: !!row.isActive, parentLocationId: row.parentLocationId == null ? '' : String(row.parentLocationId) });
    setModalOpen('edit');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    const isEdit = modalOpen === 'edit' && editId != null;

    const buildBody = (): Record<string, unknown> => {
      if (selected === 'categories') return { categoryCode: String(form.categoryCode).trim(), categoryName: String(form.categoryName).trim(), description: (form.description as string)?.trim() || null, sortOrder: Number(form.sortOrder) || 0, isActive: !!form.isActive, parentCategoryId: form.parentCategoryId === '' ? null : Number(form.parentCategoryId) };
      if (selected === 'brands') return { brandCode: String(form.brandCode).trim(), brandName: String(form.brandName).trim(), description: (form.description as string)?.trim() || null, isActive: !!form.isActive };
      if (selected === 'models') return { brandId: Number(form.brandId), modelCode: String(form.modelCode).trim(), modelName: String(form.modelName).trim(), description: (form.description as string)?.trim() || null, isActive: !!form.isActive };
      if (selected === 'vendors') return { vendorCode: String(form.vendorCode).trim(), vendorName: String(form.vendorName).trim(), contactPerson: (form.contactPerson as string)?.trim() || null, contactEmail: (form.contactEmail as string)?.trim() || null, contactPhone: (form.contactPhone as string)?.trim() || null, address: (form.address as string)?.trim() || null, isActive: !!form.isActive };
      if (selected === 'locations') return { locationCode: String(form.locationCode).trim(), locationName: String(form.locationName).trim(), address: (form.address as string)?.trim() || null, isActive: !!form.isActive, parentLocationId: form.parentLocationId === '' ? null : Number(form.parentLocationId) };
      return {};
    };

    const body = buildBody();
    const req = isEdit ? api.put(`${path}/${editId}`, body) : api.post(path, body);
    req
      .then(() => {
        setModalOpen(null);
        load(selected);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Request failed'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (row: RecordWithId) => {
    const id = getRowId(row, selected);
    if (id == null || !window.confirm('Delete this record?')) return;
    api.delete(`${path}/${id}`)
      .then(() => load(selected))
      .catch((err) => setError(err instanceof Error ? err.message : 'Delete failed'));
  };

  const renderForm = () => {
    if (selected === 'categories') {
      return (
        <>
          <div className="mb-2">
            <label className="form-label">Parent Category</label>
            <SearchableSelect
              options={categories.filter((c) => c.categoryId !== editId).map((c) => ({ value: c.categoryId!, label: String(c.categoryName ?? c.categoryCode) }))}
              value={String(form.parentCategoryId ?? '')}
              onChange={(v) => setForm((f) => ({ ...f, parentCategoryId: v === '' ? '' : Number(v) }))}
              placeholder="— None —"
            />
          </div>
          <div className="mb-2"><label className="form-label">Code *</label><input className="form-control" value={String(form.categoryCode ?? '')} onChange={(e) => setForm((f) => ({ ...f, categoryCode: e.target.value }))} required /></div>
          <div className="mb-2"><label className="form-label">Name *</label><input className="form-control" value={String(form.categoryName ?? '')} onChange={(e) => setForm((f) => ({ ...f, categoryName: e.target.value }))} required /></div>
          <div className="mb-2"><label className="form-label">Description</label><input className="form-control" value={String(form.description ?? '')} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <div className="mb-2"><label className="form-label">Sort Order</label><input type="number" min={0} className="form-control" value={Number(form.sortOrder ?? 0)} onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) || 0 }))} /></div>
          <div className="mb-2"><div className="form-check"><input type="checkbox" className="form-check-input" checked={!!form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} /><label className="form-check-label">Active</label></div></div>
        </>
      );
    }
    if (selected === 'brands') {
      return (
        <>
          <div className="mb-2"><label className="form-label">Code *</label><input className="form-control" value={String(form.brandCode ?? '')} onChange={(e) => setForm((f) => ({ ...f, brandCode: e.target.value }))} required /></div>
          <div className="mb-2"><label className="form-label">Name *</label><input className="form-control" value={String(form.brandName ?? '')} onChange={(e) => setForm((f) => ({ ...f, brandName: e.target.value }))} required /></div>
          <div className="mb-2"><label className="form-label">Description</label><input className="form-control" value={String(form.description ?? '')} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <div className="mb-2"><div className="form-check"><input type="checkbox" className="form-check-input" checked={!!form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} /><label className="form-check-label">Active</label></div></div>
        </>
      );
    }
    if (selected === 'models') {
      return (
        <>
          <div className="mb-2">
            <label className="form-label">Brand *</label>
            <SearchableSelect
              options={brands.map((b) => ({ value: b.brandId!, label: String(b.brandName ?? b.brandCode) }))}
              value={String(form.brandId ?? '')}
              onChange={(v) => setForm((f) => ({ ...f, brandId: v === '' ? '' : Number(v) }))}
              placeholder="Select brand"
              allowEmpty={false}
              required
            />
          </div>
          <div className="mb-2"><label className="form-label">Model Code *</label><input className="form-control" value={String(form.modelCode ?? '')} onChange={(e) => setForm((f) => ({ ...f, modelCode: e.target.value }))} required /></div>
          <div className="mb-2"><label className="form-label">Model Name *</label><input className="form-control" value={String(form.modelName ?? '')} onChange={(e) => setForm((f) => ({ ...f, modelName: e.target.value }))} required /></div>
          <div className="mb-2"><label className="form-label">Description</label><input className="form-control" value={String(form.description ?? '')} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <div className="mb-2"><div className="form-check"><input type="checkbox" className="form-check-input" checked={!!form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} /><label className="form-check-label">Active</label></div></div>
        </>
      );
    }
    if (selected === 'vendors') {
      return (
        <>
          <div className="mb-2"><label className="form-label">Code *</label><input className="form-control" value={String(form.vendorCode ?? '')} onChange={(e) => setForm((f) => ({ ...f, vendorCode: e.target.value }))} required /></div>
          <div className="mb-2"><label className="form-label">Name *</label><input className="form-control" value={String(form.vendorName ?? '')} onChange={(e) => setForm((f) => ({ ...f, vendorName: e.target.value }))} required /></div>
          <div className="mb-2"><label className="form-label">Contact Person</label><input className="form-control" value={String(form.contactPerson ?? '')} onChange={(e) => setForm((f) => ({ ...f, contactPerson: e.target.value }))} /></div>
          <div className="mb-2"><label className="form-label">Contact Email</label><input type="email" className="form-control" value={String(form.contactEmail ?? '')} onChange={(e) => setForm((f) => ({ ...f, contactEmail: e.target.value }))} /></div>
          <div className="mb-2"><label className="form-label">Contact Phone</label><input className="form-control" value={String(form.contactPhone ?? '')} onChange={(e) => setForm((f) => ({ ...f, contactPhone: e.target.value }))} /></div>
          <div className="mb-2"><label className="form-label">Address</label><input className="form-control" value={String(form.address ?? '')} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></div>
          <div className="mb-2"><div className="form-check"><input type="checkbox" className="form-check-input" checked={!!form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} /><label className="form-check-label">Active</label></div></div>
        </>
      );
    }
    if (selected === 'locations') {
      return (
        <>
          <div className="mb-2">
            <label className="form-label">Parent Location</label>
            <SearchableSelect
              options={locations.filter((l) => l.locationId !== editId).map((l) => ({ value: l.locationId!, label: String(l.locationName ?? l.locationCode) }))}
              value={String(form.parentLocationId ?? '')}
              onChange={(v) => setForm((f) => ({ ...f, parentLocationId: v === '' ? '' : Number(v) }))}
              placeholder="— None —"
            />
          </div>
          <div className="mb-2"><label className="form-label">Code *</label><input className="form-control" value={String(form.locationCode ?? '')} onChange={(e) => setForm((f) => ({ ...f, locationCode: e.target.value }))} required /></div>
          <div className="mb-2"><label className="form-label">Name *</label><input className="form-control" value={String(form.locationName ?? '')} onChange={(e) => setForm((f) => ({ ...f, locationName: e.target.value }))} required /></div>
          <div className="mb-2"><label className="form-label">Address</label><input className="form-control" value={String(form.address ?? '')} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} /></div>
          <div className="mb-2"><div className="form-check"><input type="checkbox" className="form-check-input" checked={!!form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} /><label className="form-check-label">Active</label></div></div>
        </>
      );
    }
    return null;
  };

  return (
    <div className="container-fluid">
      <h4 className="mb-4">Assets Masters</h4>
      <div className="row">
        <div className="col-md-3">
          <div className="list-group">
            {(Object.keys(MASTER_CONFIG) as MasterKey[]).map((k) => (
              <button key={k} type="button" className={`list-group-item list-group-item-action ${selected === k ? 'active' : ''}`} onClick={() => setSelected(k)}>
                {MASTER_CONFIG[k].label}
              </button>
            ))}
          </div>
        </div>
        <div className="col-md-9">
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">
              <span>{cfg.label}</span>
              <div className="d-flex gap-2 align-items-center">
                <div className="form-check form-check-inline mb-0">
                  <input type="checkbox" className="form-check-input" id="inc-inactive" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
                  <label className="form-check-label small" htmlFor="inc-inactive">Include inactive</label>
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>Add</button>
              </div>
            </div>
            <div className="card-body p-0">
              {error && <div className="alert alert-danger py-2 m-2 mb-0 small">{error}</div>}
              {loading && <p className="p-4 text-muted mb-0">Loading...</p>}
              {!loading && data.length === 0 && <p className="p-4 text-muted mb-0">No records.</p>}
              {!loading && data.length > 0 && (
                <div className="table-responsive">
                  <table className="table table-hover mb-0">
                    <thead>
                      <tr>
                        {cfg.columns.map((col) => (
                          <th key={col.key}>{col.label}</th>
                        ))}
                        <th style={{ width: 120 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((row) => (
                        <tr key={getRowId(row, selected) ?? Math.random()}>
                          {cfg.columns.map((col) => (
                            <td key={col.key}>
                              {col.key === 'isActive' ? (row[col.key] ? 'Yes' : 'No') : String(row[col.key] ?? '-')}
                            </td>
                          ))}
                          <td>
                            <button type="button" className="btn btn-sm btn-outline-primary me-1" onClick={() => openEdit(row)}>Edit</button>
                            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(row)}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{modalOpen === 'add' ? 'Add' : 'Edit'} {cfg.label.slice(0, -1)}</h5>
                <button type="button" className="btn-close" onClick={() => setModalOpen(null)} aria-label="Close" />
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  {renderForm()}
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(null)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
