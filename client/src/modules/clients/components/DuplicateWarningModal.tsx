/**
 * Modal showing potential duplicate clients, with option to confirm creation.
 */
import React from 'react';
import type { DuplicateMatch } from '../types';

interface Props {
  duplicates: DuplicateMatch[];
  onConfirm: () => void;
  onCancel: () => void;
  saving: boolean;
}

export default function DuplicateWarningModal({ duplicates, onConfirm, onCancel, saving }: Props) {
  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header bg-warning bg-opacity-25">
            <h5 className="modal-title">
              <i className="ti ti-alert-triangle me-2 text-warning" />
              Potential Duplicates Found
            </h5>
            <button type="button" className="btn-close" onClick={onCancel} disabled={saving} />
          </div>
          <div className="modal-body">
            <p className="text-muted mb-3">
              The following existing clients may be duplicates. Please verify before proceeding.
            </p>
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0">
                <thead className="table-light">
                  <tr>
                    <th>Code</th>
                    <th>Client Name</th>
                    <th>Match Type</th>
                    <th>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {duplicates.map((d, i) => (
                    <tr key={i}>
                      <td><code>{d.clientCode}</code></td>
                      <td>{d.clientName}</td>
                      <td>
                        <span className={`badge ${d.matchType === 'GST' ? 'bg-danger' : d.matchType === 'NAME' ? 'bg-warning text-dark' : 'bg-info'}`}>
                          {d.matchType}
                        </span>
                      </td>
                      <td className="text-muted small">{d.matchDetail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
            <button className="btn btn-warning" onClick={onConfirm} disabled={saving}>
              {saving ? <><span className="spinner-border spinner-border-sm me-1" /> Creating...</> : 'Confirm Create Anyway'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
