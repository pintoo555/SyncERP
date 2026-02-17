import { useState, useEffect } from 'react';
import { organizationApi } from '../api/organizationApi';
import type { Branch, BranchLocation } from '../types';

const LOCATION_TYPES = ['FLOOR', 'WORKSHOP', 'WAREHOUSE', 'QC_ROOM', 'RECEPTION', 'OFFICE', 'OTHER'] as const;

export default function BranchLocationManagement() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [locations, setLocations] = useState<BranchLocation[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalForm, setModalForm] = useState({
    locationCode: '',
    locationName: '',
    locationType: 'FLOOR' as (typeof LOCATION_TYPES)[number],
    sortOrder: 0,
  });

  useEffect(() => {
    organizationApi
      .listBranches(true)
      .then((r) => setBranches(r.data ?? []))
      .catch((e) => setError(e?.message ?? 'Failed to load branches'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedBranchId === '') {
      setLocations([]);
      return;
    }
    setLoading(true);
    organizationApi
      .listBranchLocations(selectedBranchId)
      .then((r) => setLocations(r.data ?? []))
      .catch((e) => {
        setError(e?.message ?? 'Failed to load locations');
        setLocations([]);
      })
      .finally(() => setLoading(false));
  }, [selectedBranchId]);

  const resetModal = () => {
    setShowModal(false);
    setEditingId(null);
    setModalForm({
      locationCode: '',
      locationName: '',
      locationType: 'FLOOR',
      sortOrder: 0,
    });
  };

  const openAdd = () => {
    resetModal();
    setShowModal(true);
  };

  const openEdit = (loc: BranchLocation) => {
    setEditingId(loc.id);
    setModalForm({
      locationCode: loc.locationCode,
      locationName: loc.locationName,
      locationType: loc.locationType as (typeof LOCATION_TYPES)[number],
      sortOrder: loc.sortOrder,
    });
    setShowModal(true);
  };

  const handleSave = () => {
    if (selectedBranchId === '') return;
    if (!modalForm.locationCode.trim() || !modalForm.locationName.trim()) return;
    setSaving(true);
    const data = {
      locationCode: modalForm.locationCode.trim(),
      locationName: modalForm.locationName.trim(),
      locationType: modalForm.locationType,
      sortOrder: modalForm.sortOrder,
    };
    const promise =
      editingId != null
        ? organizationApi.updateBranchLocation(selectedBranchId, editingId, data)
        : organizationApi.createBranchLocation(selectedBranchId, data);

    promise
      .then(() => {
        resetModal();
        return organizationApi.listBranchLocations(selectedBranchId);
      })
      .then((r) => setLocations(r.data ?? []))
      .catch((e) => setError(e?.message ?? 'Failed to save location'))
      .finally(() => setSaving(false));
  };

  const handleDelete = (locId: number) => {
    if (selectedBranchId === '' || !confirm('Delete this location?')) return;
    organizationApi
      .deleteBranchLocation(selectedBranchId, locId)
      .then(() => organizationApi.listBranchLocations(selectedBranchId))
      .then((r) => setLocations(r.data ?? []))
      .catch((e) => setError(e?.message ?? 'Failed to delete location'));
  };

  return (
    <div className="container-fluid py-3">
      <h4 className="mb-3">Branch Location Management</h4>

      {error && (
        <div className="alert alert-danger alert-dismissible" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close" />
        </div>
      )}

      <div className="row mb-3">
        <div className="col-md-4">
          <label className="form-label">Branch</label>
          <select
            className="form-select"
            value={selectedBranchId}
            onChange={(e) => setSelectedBranchId(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">Select branch</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.branchName} ({b.branchCode})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedBranchId !== '' && (
        <>
          <div className="mb-3">
            <button type="button" className="btn btn-primary" onClick={openAdd}>
              Add Location
            </button>
          </div>

          {loading ? (
            <div className="text-muted">Loading locations…</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-bordered table-hover">
                <thead className="table-light">
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Sort Order</th>
                    <th style={{ width: 120 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {locations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-muted text-center">
                        No locations. Click &quot;Add Location&quot; to create.
                      </td>
                    </tr>
                  ) : (
                    locations.map((loc) => (
                      <tr key={loc.id}>
                        <td>{loc.locationCode}</td>
                        <td>{loc.locationName}</td>
                        <td>{loc.locationType}</td>
                        <td>{loc.sortOrder}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary me-1"
                            onClick={() => openEdit(loc)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(loc.id)}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Location Modal */}
      <div className={`modal ${showModal ? 'show d-block' : ''}`} style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{editingId != null ? 'Edit Location' : 'Add Location'}</h5>
              <button type="button" className="btn-close" onClick={resetModal} aria-label="Close" />
            </div>
            <div className="modal-body">
              <div className="mb-3">
                <label className="form-label">Location Code</label>
                <input
                  type="text"
                  className="form-control"
                  value={modalForm.locationCode}
                  onChange={(e) => setModalForm((f) => ({ ...f, locationCode: e.target.value }))}
                  placeholder="e.g. FL-01"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Location Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={modalForm.locationName}
                  onChange={(e) => setModalForm((f) => ({ ...f, locationName: e.target.value }))}
                  placeholder="e.g. Floor 1"
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Location Type</label>
                <select
                  className="form-select"
                  value={modalForm.locationType}
                  onChange={(e) =>
                    setModalForm((f) => ({ ...f, locationType: e.target.value as (typeof LOCATION_TYPES)[number] }))
                  }
                >
                  {LOCATION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mb-3">
                <label className="form-label">Sort Order</label>
                <input
                  type="number"
                  className="form-control"
                  value={modalForm.sortOrder}
                  onChange={(e) => setModalForm((f) => ({ ...f, sortOrder: parseInt(e.target.value, 10) || 0 }))}
                  min={0}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={resetModal}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !modalForm.locationCode.trim() || !modalForm.locationName.trim()}
              >
                {saving ? 'Saving…' : editingId != null ? 'Update' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
