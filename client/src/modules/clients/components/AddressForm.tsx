/**
 * Address form fields with type, lines, city, state, country, pincode.
 */
import React from 'react';
import { ADDRESS_TYPES } from '../types';

interface StateOption { id: number; stateName: string }
interface CountryOption { id: number; countryName: string }

interface Props {
  form: {
    addressType: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    stateId: number | string;
    countryId: number | string;
    pincode: string;
    isDefault: boolean;
  };
  onChange: (field: string, value: string | number | boolean) => void;
  states: StateOption[];
  countries: CountryOption[];
  errors?: Record<string, string>;
  disabled?: boolean;
}

export default function AddressForm({ form, onChange, states, countries, errors = {}, disabled }: Props) {
  return (
    <div className="row g-3">
      <div className="col-md-4">
        <label className="form-label small">Address Type <span className="text-danger">*</span></label>
        <select
          className={`form-select form-select-sm ${errors.addressType ? 'is-invalid' : ''}`}
          value={form.addressType}
          onChange={(e) => onChange('addressType', e.target.value)}
          disabled={disabled}
        >
          <option value="">Select type...</option>
          {ADDRESS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {errors.addressType && <div className="invalid-feedback">{errors.addressType}</div>}
      </div>
      <div className="col-md-8">
        <label className="form-label small">Address Line 1 <span className="text-danger">*</span></label>
        <input
          type="text"
          className={`form-control form-control-sm ${errors.addressLine1 ? 'is-invalid' : ''}`}
          value={form.addressLine1}
          onChange={(e) => onChange('addressLine1', e.target.value)}
          disabled={disabled}
          maxLength={300}
        />
        {errors.addressLine1 && <div className="invalid-feedback">{errors.addressLine1}</div>}
      </div>
      <div className="col-md-12">
        <label className="form-label small">Address Line 2</label>
        <input
          type="text"
          className="form-control form-control-sm"
          value={form.addressLine2}
          onChange={(e) => onChange('addressLine2', e.target.value)}
          disabled={disabled}
          maxLength={300}
        />
      </div>
      <div className="col-md-3">
        <label className="form-label small">City</label>
        <input
          type="text"
          className="form-control form-control-sm"
          value={form.city}
          onChange={(e) => onChange('city', e.target.value)}
          disabled={disabled}
          maxLength={100}
        />
      </div>
      <div className="col-md-3">
        <label className="form-label small">State</label>
        <select
          className="form-select form-select-sm"
          value={form.stateId}
          onChange={(e) => onChange('stateId', Number(e.target.value) || 0)}
          disabled={disabled}
        >
          <option value="0">Select state...</option>
          {states.map(s => <option key={s.id} value={s.id}>{s.stateName}</option>)}
        </select>
      </div>
      <div className="col-md-3">
        <label className="form-label small">Country</label>
        <select
          className="form-select form-select-sm"
          value={form.countryId}
          onChange={(e) => onChange('countryId', Number(e.target.value) || 0)}
          disabled={disabled}
        >
          <option value="0">Select country...</option>
          {countries.map(c => <option key={c.id} value={c.id}>{c.countryName}</option>)}
        </select>
      </div>
      <div className="col-md-2">
        <label className="form-label small">Pincode</label>
        <input
          type="text"
          className={`form-control form-control-sm ${errors.pincode ? 'is-invalid' : ''}`}
          value={form.pincode}
          onChange={(e) => onChange('pincode', e.target.value)}
          disabled={disabled}
          maxLength={6}
        />
        {errors.pincode && <div className="invalid-feedback">{errors.pincode}</div>}
      </div>
      <div className="col-md-1 d-flex align-items-end">
        <div className="form-check">
          <input
            className="form-check-input"
            type="checkbox"
            checked={form.isDefault}
            onChange={(e) => onChange('isDefault', e.target.checked)}
            disabled={disabled}
            id="addrDefault"
          />
          <label className="form-check-label small" htmlFor="addrDefault">Default</label>
        </div>
      </div>
    </div>
  );
}
