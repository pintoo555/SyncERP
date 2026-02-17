/**
 * Modal to merge a source client into a target client.
 */
import React, { useState } from 'react';
import type { Client } from '../types';

interface Props {
  sourceClient: Client;
  onConfirm: (targetClientId: number, remarks: string) => void;
  onCancel: () => void;
  saving: boolean;
  clients: Client[];
}

export default function MergeClientModal({ sourceClient, onConfirm, onCancel, saving, clients }: Props) {
  const [targetId, setTargetId] = useState<number>(0);
  const [remarks, setRemarks] = useState('');

  const availableClients = clients.filter(c => c.id !== sourceClient.id && !c.isMerged && c.isActive);

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="ti ti-git-merge me-2 text-primary" />
              Merge Client
            </h5>
            <button type="button" className="btn-close" onClick={onCancel} disabled={saving} />
          </div>
          <div className="modal-body">
            <div className="alert alert-info small mb-3">
              <strong>{sourceClient.clientCode} - {sourceClient.clientName}</strong> will be marked as merged.
              All history will be preserved. This action cannot be easily undone.
            </div>
            <div className="mb-3">
              <label className="form-label small">Merge Into (Target Client) <span className="text-danger">*</span></label>
              <select
                className="form-select form-select-sm"
                value={targetId}
                onChange={(e) => setTargetId(Number(e.target.value))}
                disabled={saving}
              >
                <option value="0">Select target client...</option>
                {availableClients.map(c => (
                  <option key={c.id} value={c.id}>{c.clientCode} - {c.clientName}</option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label small">Remarks</label>
              <textarea
                className="form-control form-control-sm"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={saving}
                rows={3}
                maxLength={500}
                placeholder="Reason for merge..."
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => onConfirm(targetId, remarks)}
              disabled={saving || !targetId}
            >
              {saving ? <><span className="spinner-border spinner-border-sm me-1" /> Merging...</> : 'Confirm Merge'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
