/**
 * Client compliance & financial fields (GST, PAN, IEC, MSME, credit).
 */
import React from 'react';

interface Props {
  form: {
    gstNumber: string;
    panNumber: string;
    iecCode: string;
    msmeNumber: string;
    currencyCode: string;
    creditLimit: number | string;
    creditDays: number | string;
  };
  onChange: (field: string, value: string | number) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  hideGstField?: boolean;
}

export default function ClientComplianceForm({ form, onChange, errors = {}, disabled, hideGstField }: Props) {
  return (
    <div className="row g-3">
      {!hideGstField && (
        <div className="col-md-4">
          <label className="form-label small">GST Number</label>
          <input
            type="text"
            className={`form-control form-control-sm ${errors.gstNumber ? 'is-invalid' : ''}`}
            value={form.gstNumber}
            onChange={(e) => onChange('gstNumber', e.target.value.toUpperCase())}
            disabled={disabled}
            maxLength={20}
            placeholder="22AAAAA0000A1Z5"
          />
          {errors.gstNumber && <div className="invalid-feedback">{errors.gstNumber}</div>}
        </div>
      )}
      <div className="col-md-4">
        <label className="form-label small">PAN Number</label>
        <input
          type="text"
          className={`form-control form-control-sm ${errors.panNumber ? 'is-invalid' : ''}`}
          value={form.panNumber}
          onChange={(e) => onChange('panNumber', e.target.value.toUpperCase())}
          disabled={disabled}
          maxLength={20}
          placeholder="AAAAA9999A"
        />
        {errors.panNumber && <div className="invalid-feedback">{errors.panNumber}</div>}
      </div>
      <div className="col-md-4">
        <label className="form-label small">IEC Code</label>
        <input
          type="text"
          className="form-control form-control-sm"
          value={form.iecCode}
          onChange={(e) => onChange('iecCode', e.target.value)}
          disabled={disabled}
          maxLength={30}
        />
      </div>
      <div className="col-md-4">
        <label className="form-label small">MSME Number</label>
        <input
          type="text"
          className="form-control form-control-sm"
          value={form.msmeNumber}
          onChange={(e) => onChange('msmeNumber', e.target.value)}
          disabled={disabled}
          maxLength={30}
        />
      </div>
      <div className="col-md-3">
        <label className="form-label small">Currency</label>
        <input
          type="text"
          className="form-control form-control-sm"
          value={form.currencyCode}
          onChange={(e) => onChange('currencyCode', e.target.value.toUpperCase())}
          disabled={disabled}
          maxLength={10}
        />
      </div>
      <div className="col-md-3">
        <label className="form-label small">Credit Limit</label>
        <input
          type="number"
          className="form-control form-control-sm"
          value={form.creditLimit}
          onChange={(e) => onChange('creditLimit', Number(e.target.value) || 0)}
          disabled={disabled}
          min={0}
          step={0.01}
        />
      </div>
      <div className="col-md-2">
        <label className="form-label small">Credit Days</label>
        <input
          type="number"
          className="form-control form-control-sm"
          value={form.creditDays}
          onChange={(e) => onChange('creditDays', Number(e.target.value) || 0)}
          disabled={disabled}
          min={0}
        />
      </div>
    </div>
  );
}
