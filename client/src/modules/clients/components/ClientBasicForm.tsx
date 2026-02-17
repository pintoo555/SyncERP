/**
 * Client basic info form fields (name, display name, type, industry).
 */
import React from 'react';
import type { Industry } from '../types';
import { CLIENT_TYPES } from '../types';

interface Props {
  form: {
    clientName: string;
    clientDisplayName: string;
    clientType: string;
    industryId: number | string;
  };
  onChange: (field: string, value: string | number) => void;
  industries: Industry[];
  errors?: Record<string, string>;
  disabled?: boolean;
}

export default function ClientBasicForm({ form, onChange, industries, errors = {}, disabled }: Props) {
  return (
    <div className="row g-3">
      <div className="col-md-6">
        <label className="form-label small">Client Name <span className="text-danger">*</span></label>
        <input
          type="text"
          className={`form-control form-control-sm ${errors.clientName ? 'is-invalid' : ''}`}
          value={form.clientName}
          onChange={(e) => onChange('clientName', e.target.value)}
          disabled={disabled}
          maxLength={200}
        />
        {errors.clientName && <div className="invalid-feedback">{errors.clientName}</div>}
      </div>
      <div className="col-md-6">
        <label className="form-label small">Display Name</label>
        <input
          type="text"
          className="form-control form-control-sm"
          value={form.clientDisplayName}
          onChange={(e) => onChange('clientDisplayName', e.target.value)}
          disabled={disabled}
          maxLength={200}
          placeholder="Optional display name"
        />
      </div>
      <div className="col-md-6">
        <label className="form-label small">Client Type <span className="text-danger">*</span></label>
        <select
          className={`form-select form-select-sm ${errors.clientType ? 'is-invalid' : ''}`}
          value={form.clientType}
          onChange={(e) => onChange('clientType', e.target.value)}
          disabled={disabled}
        >
          <option value="">Select type...</option>
          {CLIENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {errors.clientType && <div className="invalid-feedback">{errors.clientType}</div>}
      </div>
      <div className="col-md-6">
        <label className="form-label small">Industry</label>
        <select
          className="form-select form-select-sm"
          value={form.industryId}
          onChange={(e) => onChange('industryId', Number(e.target.value) || 0)}
          disabled={disabled}
        >
          <option value="0">Select industry...</option>
          {industries.filter(i => i.isActive).map(i => (
            <option key={i.id} value={i.id}>{i.industryName} ({i.industryCategory})</option>
          ))}
        </select>
      </div>
    </div>
  );
}
