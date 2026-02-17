/**
 * Modal to deactivate a contact with optional replacement selection.
 */
import React, { useState, useEffect } from 'react';
import type { Contact } from '../types';
import * as clientsApi from '../api/clientsApi';

interface Props {
  contact: Contact;
  clientId: number;
  onConfirm: (replacedByContactId: number | null) => void;
  onCancel: () => void;
  saving: boolean;
}

export default function ContactDeactivateModal({ contact, clientId, onConfirm, onCancel, saving }: Props) {
  const [replacementId, setReplacementId] = useState<number>(0);
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  useEffect(() => {
    setLoadingSuggestions(true);
    clientsApi.suggestReplacement(clientId, contact.id)
      .then((res) => setSuggestions(res.data || []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoadingSuggestions(false));
  }, [clientId, contact.id]);

  const mustSelectReplacement = contact.isPrimary;

  return (
    <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex={-1}>
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              <i className="ti ti-user-off me-2 text-warning" />
              Deactivate Contact
            </h5>
            <button type="button" className="btn-close" onClick={onCancel} disabled={saving} />
          </div>
          <div className="modal-body">
            <p className="small">
              Deactivating <strong>{contact.contactName}</strong>
              {contact.isPrimary && (
                <span className="badge bg-primary ms-2">Primary</span>
              )}
            </p>
            {mustSelectReplacement && (
              <div className="alert alert-warning small">
                This is the primary contact. You must select a replacement who will become the new primary.
              </div>
            )}
            <div className="mb-3">
              <label className="form-label small">
                Replacement Contact {mustSelectReplacement && <span className="text-danger">*</span>}
              </label>
              {loadingSuggestions ? (
                <div className="text-muted small"><span className="spinner-border spinner-border-sm me-1" /> Loading suggestions...</div>
              ) : (
                <select
                  className="form-select form-select-sm"
                  value={replacementId}
                  onChange={(e) => setReplacementId(Number(e.target.value))}
                  disabled={saving}
                >
                  <option value="0">{mustSelectReplacement ? 'Select replacement...' : '(No replacement)'}</option>
                  {suggestions.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.contactName}{c.department ? ` (${c.department})` : ''}{c.designation ? ` - ${c.designation}` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onCancel} disabled={saving}>Cancel</button>
            <button
              className="btn btn-warning"
              onClick={() => onConfirm(replacementId || null)}
              disabled={saving || (mustSelectReplacement && !replacementId)}
            >
              {saving ? <><span className="spinner-border spinner-border-sm me-1" /> Deactivating...</> : 'Deactivate Contact'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
