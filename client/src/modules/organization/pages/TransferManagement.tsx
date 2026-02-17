import { useState, useEffect, useCallback } from 'react';
import { organizationApi } from '../api/organizationApi';
import type { Transfer, TransferLog, TransferType, TransferStatus, Branch } from '../types';

const TRANSFER_TYPES: TransferType[] = ['JOB', 'INVENTORY', 'ASSET', 'USER'];
const STATUSES: TransferStatus[] = ['PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'REJECTED', 'CANCELLED'];

const STATUS_BADGE: Record<TransferStatus, string> = {
  PENDING: 'bg-warning text-dark',
  APPROVED: 'bg-info',
  IN_TRANSIT: 'bg-primary',
  RECEIVED: 'bg-success',
  REJECTED: 'bg-danger',
  CANCELLED: 'bg-secondary',
};

type ApiResponse<T> = { success: boolean; data?: T };
type TransferDetailResponse = { success: boolean; data?: Transfer; logs?: TransferLog[]; jobs?: unknown[] };

function formatDate(s: string | null | undefined): string {
  if (!s) return '—';
  try {
    const d = new Date(s);
    return isNaN(d.getTime()) ? s : d.toLocaleString();
  } catch {
    return s;
  }
}

export default function TransferManagement() {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterBranchId, setFilterBranchId] = useState<number | ''>('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [detailTransfer, setDetailTransfer] = useState<Transfer | null>(null);
  const [detailLogs, setDetailLogs] = useState<TransferLog[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionModal, setActionModal] = useState<{ action: 'approve' | 'reject' | 'dispatch' | 'receive'; transfer: Transfer } | null>(null);
  const [actionRemarks, setActionRemarks] = useState('');
  const [actionSaving, setActionSaving] = useState(false);
  const [createForm, setCreateForm] = useState({ transferType: 'JOB' as TransferType, fromBranchId: 0, toBranchId: 0, reason: '' });
  const [createSaving, setCreateSaving] = useState(false);

  const branchMap = useCallback(() => {
    const m = new Map<number, Branch>();
    branches.forEach((b) => m.set(b.id, b));
    return m;
  }, [branches]);

  const loadBranches = useCallback(async () => {
    try {
      const res = await organizationApi.listBranches(true) as ApiResponse<Branch[]>;
      setBranches(res.data ?? []);
    } catch {
      setBranches([]);
    }
  }, []);

  const loadTransfers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: { branchId?: number; type?: string; status?: string } = {};
      if (filterBranchId) params.branchId = filterBranchId;
      if (filterType) params.type = filterType;
      if (filterStatus) params.status = filterStatus;
      const res = await organizationApi.listTransfers(params) as ApiResponse<Transfer[]>;
      setTransfers(res.data ?? []);
    } catch (e) {
      setTransfers([]);
      setError((e as Error)?.message ?? 'Failed to load transfers');
    } finally {
      setLoading(false);
    }
  }, [filterBranchId, filterType, filterStatus]);

  useEffect(() => {
    loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  const openDetail = useCallback(async (t: Transfer) => {
    setDetailTransfer(t);
    setDetailLogs([]);
    setDetailLoading(true);
    try {
      const res = await organizationApi.getTransfer(t.id) as TransferDetailResponse;
      setDetailTransfer(res.data ?? t);
      setDetailLogs(res.logs ?? []);
    } catch {
      setDetailLogs([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const closeDetail = useCallback(() => {
    setDetailTransfer(null);
    setDetailLogs([]);
  }, []);

  const openCreateModal = useCallback(() => {
    setCreateForm({ transferType: 'JOB', fromBranchId: 0, toBranchId: 0, reason: '' });
    setCreateModalOpen(true);
  }, []);

  const createTransfer = useCallback(async () => {
    if (!createForm.fromBranchId || !createForm.toBranchId || createForm.fromBranchId === createForm.toBranchId) {
      setError('Select different From and To branches');
      return;
    }
    try {
      setCreateSaving(true);
      setError(null);
      await organizationApi.createTransfer({
        transferType: createForm.transferType,
        fromBranchId: createForm.fromBranchId,
        toBranchId: createForm.toBranchId,
        reason: createForm.reason.trim() || undefined,
      });
      setCreateModalOpen(false);
      loadTransfers();
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to create transfer');
    } finally {
      setCreateSaving(false);
    }
  }, [createForm, loadTransfers]);

  const runAction = useCallback(async () => {
    if (!actionModal) return;
    const { action, transfer } = actionModal;
    try {
      setActionSaving(true);
      setError(null);
      if (action === 'approve') await organizationApi.approveTransfer(transfer.id, actionRemarks);
      else if (action === 'reject') await organizationApi.rejectTransfer(transfer.id, actionRemarks);
      else if (action === 'dispatch') await organizationApi.dispatchTransfer(transfer.id, actionRemarks);
      else if (action === 'receive') await organizationApi.receiveTransfer(transfer.id, actionRemarks);
      setActionModal(null);
      setActionRemarks('');
      if (detailTransfer?.id === transfer.id) {
        const res = await organizationApi.getTransfer(transfer.id) as TransferDetailResponse;
        setDetailTransfer(res.data ?? transfer);
        setDetailLogs(res.logs ?? []);
      }
      loadTransfers();
    } catch (e) {
      setError((e as Error)?.message ?? 'Action failed');
    } finally {
      setActionSaving(false);
    }
  }, [actionModal, actionRemarks, detailTransfer, loadTransfers]);

  const openActionModal = useCallback((action: 'approve' | 'reject' | 'dispatch' | 'receive', transfer: Transfer) => {
    setActionRemarks('');
    setActionModal({ action, transfer });
  }, []);

  const bm = branchMap();
  const getBranchName = (id: number) => bm.get(id)?.branchName ?? bm.get(id)?.branchCode ?? `#${id}`;

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <h4 className="mb-0"><i className="ti ti-truck me-2" />Transfer Management</h4>
        <button type="button" className="btn btn-primary" onClick={openCreateModal}>
          <i className="ti ti-plus me-1" />New Transfer
        </button>
      </div>

      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close" />
        </div>
      )}

      {/* Filter bar */}
      <div className="card mb-4">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-auto">
              <label className="form-label small mb-0">Type</label>
              <select className="form-select form-select-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                <option value="">All</option>
                {TRANSFER_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <label className="form-label small mb-0">Status</label>
              <select className="form-select form-select-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div className="col-auto">
              <label className="form-label small mb-0">Branch</label>
              <select className="form-select form-select-sm" value={filterBranchId} onChange={(e) => setFilterBranchId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.branchName} ({b.branchCode})</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* List view */}
      <div className="card">
        <div className="card-body p-0">
          {loading ? (
            <div className="p-4 text-center text-muted">Loading...</div>
          ) : transfers.length === 0 ? (
            <div className="p-4 text-center text-muted">No transfers found.</div>
          ) : (
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Type</th>
                  <th>From → To</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th className="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(t)}>
                    <td>{t.transferCode}</td>
                    <td><span className="badge bg-secondary">{t.transferType}</span></td>
                    <td>{getBranchName(t.fromBranchId)} → {getBranchName(t.toBranchId)}</td>
                    <td><span className={`badge ${STATUS_BADGE[t.status]}`}>{t.status.replace('_', ' ')}</span></td>
                    <td>{formatDate(t.requestedAt)}</td>
                    <td className="text-end" onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openDetail(t)}>View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create modal */}
      {createModalOpen && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">New Transfer</h5>
                <button type="button" className="btn-close" onClick={() => setCreateModalOpen(false)} aria-label="Close" />
              </div>
              <div className="modal-body">
                <div className="mb-3">
                  <label className="form-label">Transfer Type</label>
                  <select className="form-select" value={createForm.transferType} onChange={(e) => setCreateForm((f) => ({ ...f, transferType: e.target.value as TransferType }))}>
                    {TRANSFER_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">From Branch</label>
                  <select className="form-select" value={createForm.fromBranchId || ''} onChange={(e) => setCreateForm((f) => ({ ...f, fromBranchId: Number(e.target.value) }))}>
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.branchName} ({b.branchCode})</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">To Branch</label>
                  <select className="form-select" value={createForm.toBranchId || ''} onChange={(e) => setCreateForm((f) => ({ ...f, toBranchId: Number(e.target.value) }))}>
                    <option value="">Select branch</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.branchName} ({b.branchCode})</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3">
                  <label className="form-label">Reason</label>
                  <textarea className="form-control" rows={3} value={createForm.reason} onChange={(e) => setCreateForm((f) => ({ ...f, reason: e.target.value }))} placeholder="Reason for transfer" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCreateModalOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={createTransfer} disabled={createSaving || !createForm.fromBranchId || !createForm.toBranchId || createForm.fromBranchId === createForm.toBranchId}>
                  {createSaving ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail view (modal) */}
      {detailTransfer && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Transfer {detailTransfer.transferCode}</h5>
                <button type="button" className="btn-close" onClick={closeDetail} aria-label="Close" />
              </div>
              <div className="modal-body">
                <div className="row mb-3">
                  <div className="col-md-6">
                    <small className="text-muted">Type</small>
                    <div><span className="badge bg-secondary">{detailTransfer.transferType}</span></div>
                  </div>
                  <div className="col-md-6">
                    <small className="text-muted">Status</small>
                    <div><span className={`badge ${STATUS_BADGE[detailTransfer.status]}`}>{detailTransfer.status.replace('_', ' ')}</span></div>
                  </div>
                  <div className="col-md-6 mt-2">
                    <small className="text-muted">From Branch</small>
                    <div>{getBranchName(detailTransfer.fromBranchId)}</div>
                  </div>
                  <div className="col-md-6 mt-2">
                    <small className="text-muted">To Branch</small>
                    <div>{getBranchName(detailTransfer.toBranchId)}</div>
                  </div>
                  {detailTransfer.reason && (
                    <div className="col-12 mt-2">
                      <small className="text-muted">Reason</small>
                      <div>{detailTransfer.reason}</div>
                    </div>
                  )}
                </div>

                <h6 className="mt-3 mb-2">Timeline</h6>
                {detailLoading ? (
                  <div className="text-muted small">Loading...</div>
                ) : detailLogs.length === 0 ? (
                  <div className="text-muted small">No log entries.</div>
                ) : (
                  <ul className="list-group list-group-flush">
                    {detailLogs.map((log) => (
                      <li key={log.id} className="list-group-item d-flex justify-content-between align-items-start py-2">
                        <div>
                          <span className="fw-medium">{log.action}</span>
                          {log.fromStatus && <span className="text-muted"> {log.fromStatus} → </span>}
                          {log.toStatus && <span>{log.toStatus}</span>}
                          {log.remarks && <div className="small text-muted mt-1">{log.remarks}</div>}
                        </div>
                        <small className="text-muted">{formatDate(log.actionAt)}</small>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 d-flex flex-wrap gap-2">
                  {detailTransfer.status === 'PENDING' && (
                    <>
                      <button type="button" className="btn btn-success" onClick={() => openActionModal('approve', detailTransfer)}>Approve</button>
                      <button type="button" className="btn btn-danger" onClick={() => openActionModal('reject', detailTransfer)}>Reject</button>
                    </>
                  )}
                  {detailTransfer.status === 'APPROVED' && (
                    <button type="button" className="btn btn-primary" onClick={() => openActionModal('dispatch', detailTransfer)}>Dispatch</button>
                  )}
                  {detailTransfer.status === 'IN_TRANSIT' && (
                    <button type="button" className="btn btn-success" onClick={() => openActionModal('receive', detailTransfer)}>Receive</button>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeDetail}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action remarks modal */}
      {actionModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Confirm {actionModal.action.charAt(0).toUpperCase() + actionModal.action.slice(1)}</h5>
                <button type="button" className="btn-close" onClick={() => setActionModal(null)} aria-label="Close" />
              </div>
              <div className="modal-body">
                <label className="form-label">Remarks (optional)</label>
                <textarea className="form-control" rows={3} value={actionRemarks} onChange={(e) => setActionRemarks(e.target.value)} placeholder="Add remarks..." />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setActionModal(null)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={runAction} disabled={actionSaving}>
                  {actionSaving ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
