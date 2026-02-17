/**
 * Contact form fields: name, designation, department, phone with country flags, email, role tags.
 */
import React from 'react';
import PhoneInput from '../../../components/PhoneInput';
import type { CountryPhoneOption } from '../../../components/PhoneInput';
import { CONTACT_ROLE_OPTIONS } from '../types';

const ROLE_COLORS: Record<string, string> = {
  Commercial: '#3b7ddd', Technical: '#6f42c1', Dispatch: '#fd7e14',
  Accounting: '#20c997', Purchase: '#e83e8c', Sales: '#0dcaf0',
  Management: '#6610f2', Legal: '#dc3545', Quality: '#198754',
  HR: '#d63384', IT: '#0d6efd', Operations: '#ffc107',
};

interface Props {
  form: {
    contactName: string;
    designation: string;
    department: string;
    mobileNumber: string;
    alternateNumber: string;
    email: string;
    whatsAppNumber: string;
    contactRoles?: string;
    isPrimary: boolean;
  };
  onChange: (field: string, value: string | boolean) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
  countries?: CountryPhoneOption[];
}

export default function ContactForm({ form, onChange, errors = {}, disabled, countries = [] }: Props) {
  const hasCountries = countries.length > 0;
  const selectedRoles = (form.contactRoles || '').split(',').filter(Boolean);

  const toggleRole = (role: string) => {
    const current = new Set(selectedRoles);
    if (current.has(role)) current.delete(role);
    else current.add(role);
    onChange('contactRoles', Array.from(current).join(','));
  };

  return (
    <div className="row g-3">
      <div className="col-md-4">
        <label className="form-label small">Contact Name <span className="text-danger">*</span></label>
        <input
          type="text"
          className={`form-control form-control-sm ${errors.contactName ? 'is-invalid' : ''}`}
          value={form.contactName}
          onChange={(e) => onChange('contactName', e.target.value)}
          disabled={disabled}
          maxLength={200}
        />
        {errors.contactName && <div className="invalid-feedback">{errors.contactName}</div>}
      </div>
      <div className="col-md-4">
        <label className="form-label small">Designation</label>
        <input
          type="text"
          className="form-control form-control-sm"
          value={form.designation}
          onChange={(e) => onChange('designation', e.target.value)}
          disabled={disabled}
          maxLength={100}
        />
      </div>
      <div className="col-md-4">
        <label className="form-label small">Department</label>
        <input
          type="text"
          className="form-control form-control-sm"
          value={form.department}
          onChange={(e) => onChange('department', e.target.value)}
          disabled={disabled}
          maxLength={100}
        />
      </div>
      <div className="col-md-6">
        <label className="form-label small">Mobile Number</label>
        {hasCountries ? (
          <PhoneInput
            value={form.mobileNumber}
            onChange={(v) => onChange('mobileNumber', v)}
            countries={countries}
            defaultCountryCode="IN"
            placeholder="9876543210"
            disabled={disabled}
            isInvalid={!!errors.mobileNumber}
            maxDigits={10}
          />
        ) : (
          <input
            type="text"
            className={`form-control form-control-sm ${errors.mobileNumber ? 'is-invalid' : ''}`}
            value={form.mobileNumber}
            onChange={(e) => onChange('mobileNumber', e.target.value)}
            disabled={disabled}
            maxLength={20}
            placeholder="9876543210"
          />
        )}
        {errors.mobileNumber && <div className="text-danger small mt-1">{errors.mobileNumber}</div>}
      </div>
      <div className="col-md-6">
        <label className="form-label small">Alternate Number</label>
        {hasCountries ? (
          <PhoneInput
            value={form.alternateNumber}
            onChange={(v) => onChange('alternateNumber', v)}
            countries={countries}
            defaultCountryCode="IN"
            placeholder="Alternate number"
            disabled={disabled}
            maxDigits={10}
          />
        ) : (
          <input
            type="text"
            className="form-control form-control-sm"
            value={form.alternateNumber}
            onChange={(e) => onChange('alternateNumber', e.target.value)}
            disabled={disabled}
            maxLength={20}
          />
        )}
      </div>
      <div className="col-md-6">
        <label className="form-label small">Email</label>
        <input
          type="email"
          className={`form-control form-control-sm ${errors.email ? 'is-invalid' : ''}`}
          value={form.email}
          onChange={(e) => onChange('email', e.target.value)}
          disabled={disabled}
          maxLength={200}
        />
        {errors.email && <div className="invalid-feedback">{errors.email}</div>}
      </div>
      <div className="col-md-6">
        <label className="form-label small">WhatsApp Number</label>
        {hasCountries ? (
          <PhoneInput
            value={form.whatsAppNumber}
            onChange={(v) => onChange('whatsAppNumber', v)}
            countries={countries}
            defaultCountryCode="IN"
            placeholder="WhatsApp number"
            disabled={disabled}
            maxDigits={10}
          />
        ) : (
          <input
            type="text"
            className="form-control form-control-sm"
            value={form.whatsAppNumber}
            onChange={(e) => onChange('whatsAppNumber', e.target.value)}
            disabled={disabled}
            maxLength={20}
          />
        )}
      </div>

      {/* Role Tags */}
      <div className="col-12">
        <label className="form-label small">Contact Roles <span className="text-muted">(select all that apply)</span></label>
        <div className="d-flex flex-wrap gap-1">
          {CONTACT_ROLE_OPTIONS.map(role => {
            const active = selectedRoles.includes(role);
            const color = ROLE_COLORS[role] || '#6c757d';
            return (
              <button
                key={role}
                type="button"
                className="btn btn-sm rounded-pill px-3 py-1"
                style={{
                  backgroundColor: active ? color : 'transparent',
                  color: active ? '#fff' : color,
                  border: `1.5px solid ${color}`,
                  fontWeight: active ? 600 : 400,
                  fontSize: '0.78rem',
                  transition: 'all 0.15s',
                }}
                onClick={() => !disabled && toggleRole(role)}
                disabled={disabled}
              >
                {active && <i className="ti ti-check me-1" style={{ fontSize: '0.7rem' }} />}
                {role}
              </button>
            );
          })}
        </div>
      </div>

      <div className="col-12">
        <div className="form-check">
          <input
            className="form-check-input"
            type="checkbox"
            checked={form.isPrimary}
            onChange={(e) => onChange('isPrimary', e.target.checked)}
            disabled={disabled}
            id="contactPrimary"
          />
          <label className="form-check-label small" htmlFor="contactPrimary">Primary Contact</label>
        </div>
      </div>
    </div>
  );
}
