/**
 * Modal to create a relationship between two clients.
 */
import React, { useState } from 'react';
import type { Client } from '../types';
import { RELATIONSHIP_TYPES } from '../types';

interface Props {
  client: Client;
  onConfirm: (otherClientId: number, relationshipType: string, effectiveFrom: string, remarks: string) => void;
  onCancel: () => void;
  saving: boolean;
  clients: Client[];
}

export default function LinkRelationshipModal({ client, onConfirm, onCancel, saving, clients }: Props) {
  const [otherId, setOtherId] = useState<number>(0);
  const [relType, setRelType] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState('');

  const availableClients = clients.filter(c => c.id !== client.id);

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="ti ti-link me-2 text-primary" />
              Link Relationship
            </h5>
            <button type="button" className="btn-close" onClick={onCancel} disabled={saving} />
          </div>
          <div className="modal-body">
            <p className="small text-muted mb-3">
              Create a relationship from <strong>{client.clientCode} - {client.clientName}</strong> to another client.
            </p>
            <div className="mb-3">
              <label className="form-label small">Related Client <span className="text-danger">*</span></label>
              <select
                className="form-select form-select-sm"
                value={otherId}
                onChange={(e) => setOtherId(Number(e.target.value))}
                disabled={saving}
              >
                <option value="0">Select client...</option>
                {availableClients.map(c => (
                  <option key={c.id} value={c.id}>{c.clientCode} - {c.clientName}</option>
                ))}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label small">Relationship Type <span className="text-danger">*</span></label>
              <select
                className="form-select form-select-sm"
                value={relType}
                onChange={(e) => setRelType(e.target.value)}
                disabled={saving}
              >
                <option value="">Select type...</option>
                {RELATIONSHIP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="mb-3">
              <label className="form-label small">Effective From <span className="text-danger">*</span></label>
              <input
                type="date"
                className="form-control form-control-sm"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                disabled={saving}
              />
            </div>
            <div className="mb-3">
              <label className="form-label small">Remarks</label>
              <textarea
                className="form-control form-control-sm"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={saving}
                rows={2}
                maxLength={500}
              />
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={() => onConfirm(otherId, relType, effectiveFrom, remarks)}
              disabled={saving || !otherId || !relType || !effectiveFrom}
            >
              {saving ? <><span className="spinner-border spinner-border-sm me-1" /> Linking...</> : 'Create Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
