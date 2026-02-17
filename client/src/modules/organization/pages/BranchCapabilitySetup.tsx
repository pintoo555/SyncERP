import { useState, useEffect } from 'react';
import { organizationApi } from '../api/organizationApi';
import type { Branch, BranchCapability, BranchCapabilityMap } from '../types';

export default function BranchCapabilitySetup() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [capabilities, setCapabilities] = useState<BranchCapability[]>([]);
  const [branchCapabilities, setBranchCapabilities] = useState<BranchCapabilityMap[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);

  useEffect(() => {
    organizationApi
      .listBranches(true)
      .then((r) => setBranches(r.data ?? []))
      .catch((e) => setError(e?.message ?? 'Failed to load branches'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    organizationApi
      .listCapabilities()
      .then((r) => setCapabilities((r.data ?? []).filter((c) => c.isActive)))
      .catch(() => setCapabilities([]));
  }, []);

  useEffect(() => {
    if (selectedBranchId === '') {
      setBranchCapabilities([]);
      return;
    }
    setLoading(true);
    organizationApi
      .listBranchCapabilities(selectedBranchId)
      .then((r) => setBranchCapabilities(r.data ?? []))
      .catch((e) => {
        setError(e?.message ?? 'Failed to load branch capabilities');
        setBranchCapabilities([]);
      })
      .finally(() => setLoading(false));
  }, [selectedBranchId]);

  const isEnabled = (capabilityId: number) =>
    branchCapabilities.some((bc) => bc.capabilityId === capabilityId && bc.isActive);

  const getMapId = (capabilityId: number) =>
    branchCapabilities.find((bc) => bc.capabilityId === capabilityId)?.id;

  const handleToggle = (capabilityId: number, enabled: boolean) => {
    if (selectedBranchId === '') return;
    setTogglingId(capabilityId);
    const mapId = getMapId(capabilityId);
    const promise = enabled
      ? organizationApi.addBranchCapability(selectedBranchId, capabilityId)
      : mapId != null
        ? organizationApi.removeBranchCapability(selectedBranchId, mapId)
        : Promise.resolve();

    promise
      .then(() => organizationApi.listBranchCapabilities(selectedBranchId))
      .then((r) => setBranchCapabilities(r.data ?? []))
      .catch((e) => setError(e?.message ?? 'Failed to update capability'))
      .finally(() => setTogglingId(null));
  };

  return (
    <div className="container-fluid py-3">
      <h4 className="mb-3">Branch Capability Setup</h4>

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
          {loading ? (
            <div className="text-muted">Loading capabilities…</div>
          ) : (
            <div className="row g-3">
              {capabilities.map((cap) => {
                const enabled = isEnabled(cap.id);
                const busy = togglingId === cap.id;
                return (
                  <div key={cap.id} className="col-md-6 col-lg-4">
                    <div className="card h-100">
                      <div className="card-body">
                        <div className="form-check">
                          <input
                            type="checkbox"
                            className="form-check-input"
                            id={`cap-${cap.id}`}
                            checked={enabled}
                            disabled={busy}
                            onChange={(e) => handleToggle(cap.id, e.target.checked)}
                          />
                          <label className="form-check-label fw-semibold" htmlFor={`cap-${cap.id}`}>
                            {cap.capabilityName}
                          </label>
                        </div>
                        {cap.description && (
                          <p className="small text-muted mb-0 mt-1">{cap.description}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {capabilities.length === 0 && (
                <div className="col-12 text-muted">No capabilities available.</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
