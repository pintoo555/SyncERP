/**
 * PhoneInput with country code selector and flag emoji.
 * Shows flag + dial code dropdown, then the phone number input.
 */
import React, { useState, useRef, useEffect, useMemo } from 'react';

export interface CountryPhoneOption {
  id: number;
  countryCode: string;
  countryName: string;
  phoneCode: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  countries: CountryPhoneOption[];
  defaultCountryCode?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  isInvalid?: boolean;
  maxDigits?: number;
}

function countryCodeToFlag(code: string): string {
  if (!code || code.length !== 2) return '';
  const base = 127397;
  return String.fromCodePoint(
    code.toUpperCase().charCodeAt(0) + base,
    code.toUpperCase().charCodeAt(1) + base
  );
}

function parsePhoneValue(value: string, countries: CountryPhoneOption[]): { dialCode: string; number: string; countryCode: string } {
  if (!value) return { dialCode: '+91', number: '', countryCode: 'IN' };

  const sorted = [...countries].sort((a, b) => b.phoneCode.length - a.phoneCode.length);
  for (const c of sorted) {
    if (value.startsWith(c.phoneCode)) {
      return { dialCode: c.phoneCode, number: value.slice(c.phoneCode.length), countryCode: c.countryCode };
    }
  }
  return { dialCode: '+91', number: value.replace(/^\+\d+/, ''), countryCode: 'IN' };
}

export default function PhoneInput({
  value,
  onChange,
  countries,
  defaultCountryCode = 'IN',
  placeholder = '9876543210',
  disabled = false,
  className = '',
  isInvalid = false,
  maxDigits = 15,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const parsed = useMemo(() => parsePhoneValue(value, countries), [value, countries]);
  const [selectedCode, setSelectedCode] = useState(parsed.countryCode || defaultCountryCode);
  const [localNumber, setLocalNumber] = useState(parsed.number);

  useEffect(() => {
    const p = parsePhoneValue(value, countries);
    if (p.countryCode) setSelectedCode(p.countryCode);
    setLocalNumber(p.number);
  }, [value, countries]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedCountry = countries.find(c => c.countryCode === selectedCode);
  const dialCode = selectedCountry?.phoneCode || '+91';

  const filteredCountries = useMemo(() => {
    if (!search) return countries;
    const q = search.toLowerCase();
    return countries.filter(c =>
      c.countryName.toLowerCase().includes(q) ||
      c.countryCode.toLowerCase().includes(q) ||
      c.phoneCode.includes(q)
    );
  }, [countries, search]);

  const handleSelect = (c: CountryPhoneOption) => {
    setSelectedCode(c.countryCode);
    setOpen(false);
    setSearch('');
    onChange(c.phoneCode + localNumber);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^\d]/g, '').slice(0, maxDigits);
    setLocalNumber(digits);
    onChange(dialCode + digits);
  };

  return (
    <div className={`input-group input-group-sm ${className}`} ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`btn btn-outline-secondary d-flex align-items-center gap-1 ${disabled ? 'disabled' : ''}`}
        onClick={() => { if (!disabled) setOpen(!open); }}
        style={{ minWidth: 90, borderTopRightRadius: 0, borderBottomRightRadius: 0, fontSize: '0.85rem' }}
      >
        <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{countryCodeToFlag(selectedCode)}</span>
        <span className="text-muted">{dialCode}</span>
        <i className="ti ti-chevron-down" style={{ fontSize: '0.65rem' }} />
      </button>
      <input
        type="text"
        className={`form-control form-control-sm ${isInvalid ? 'is-invalid' : ''}`}
        value={localNumber}
        onChange={handleNumberChange}
        placeholder={placeholder}
        disabled={disabled}
        style={{ letterSpacing: '0.5px' }}
      />
      {open && (
        <div
          className="dropdown-menu show shadow-lg border"
          style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 1050,
            maxHeight: 280, overflowY: 'auto', width: 320,
            padding: 0
          }}
        >
          <div className="p-2 border-bottom bg-light sticky-top">
            <input
              type="text"
              className="form-control form-control-sm"
              placeholder="Search country..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          {filteredCountries.length === 0 && (
            <div className="p-3 text-muted text-center small">No countries found</div>
          )}
          {filteredCountries.map(c => (
            <button
              key={c.countryCode}
              type="button"
              className={`dropdown-item d-flex align-items-center gap-2 py-2 px-3 ${c.countryCode === selectedCode ? 'active' : ''}`}
              onClick={() => handleSelect(c)}
              style={{ fontSize: '0.85rem' }}
            >
              <span style={{ fontSize: '1.15rem', lineHeight: 1, width: 24, textAlign: 'center' }}>
                {countryCodeToFlag(c.countryCode)}
              </span>
              <span className="flex-grow-1">{c.countryName}</span>
              <span className="text-muted">{c.phoneCode}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
