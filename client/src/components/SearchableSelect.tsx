import React, { useState, useRef, useEffect, useMemo } from 'react';

export interface SearchableSelectOption {
  value: string | number;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string | number;
  onChange: (value: string | number) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Optional: allow empty selection (show placeholder option) */
  allowEmpty?: boolean;
  /** Size: 'sm' | undefined (default) */
  size?: 'sm' | undefined;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  required = false,
  disabled = false,
  className = '',
  allowEmpty = true,
  size,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const valueStr = value === '' || value === undefined || value === null ? '' : String(value);
  const selectedOption = useMemo(() => options.find((o) => String(o.value) === valueStr), [options, valueStr]);
  const displayLabel = selectedOption ? selectedOption.label : '';

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.trim().toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const showEmpty = allowEmpty && !required;
  const listOptions = showEmpty
    ? [{ value: '' as const, label: placeholder || '—' }, ...filteredOptions]
    : filteredOptions;

  useEffect(() => {
    if (!open) {
      setQuery('');
      setHighlightIndex(0);
      return;
    }
    const idx = listOptions.findIndex((o) => String(o.value) === valueStr);
    setHighlightIndex(idx >= 0 ? idx : 0);
  }, [open, valueStr, listOptions.length]);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (!el) return;
    const highlighted = el.children[highlightIndex] as HTMLElement | undefined;
    if (highlighted) highlighted.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightIndex, open]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (opt: SearchableSelectOption) => {
    onChange(opt.value);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => (i < listOptions.length - 1 ? i + 1 : i));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => (i > 0 ? i - 1 : 0));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const opt = listOptions[highlightIndex];
      if (opt) handleSelect(opt);
      return;
    }
  };

  const inputSizeClass = size === 'sm' ? 'form-control form-control-sm' : 'form-control';
  const triggerSizeClass = size === 'sm' ? 'form-select form-select-sm' : 'form-select';

  return (
    <div ref={containerRef} className={`position-relative ${className}`}>
      <div
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls="searchable-select-list"
        aria-activedescendant={open ? `searchable-option-${highlightIndex}` : undefined}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`${triggerSizeClass} d-flex align-items-center text-start ${disabled ? 'disabled' : ''}`}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <span className="text-truncate flex-grow-1">{displayLabel || placeholder}</span>
        <span className="ms-2 opacity-75" aria-hidden>
          {open ? '▲' : '▼'}
        </span>
      </div>

      {open && (
        <div
          className="position-absolute start-0 end-0 mt-1 border rounded bg-white shadow-lg overflow-hidden"
          style={{ zIndex: 1060, maxHeight: 280 }}
        >
          <div className="p-2 border-bottom bg-light">
            <input
              type="text"
              className={inputSizeClass}
              placeholder="Type to search…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              aria-label="Filter options"
            />
          </div>
          <ul
            ref={listRef}
            id="searchable-select-list"
            role="listbox"
            className="list-unstyled mb-0 overflow-auto py-1"
            style={{ maxHeight: 220 }}
          >
            {listOptions.length === 0 ? (
              <li className="px-3 py-2 text-muted small">No matches</li>
            ) : (
              listOptions.map((opt, i) => (
                <li
                  key={opt.value === '' ? '__empty__' : opt.value}
                  id={`searchable-option-${i}`}
                  role="option"
                  aria-selected={String(opt.value) === valueStr}
                  className={`px-3 py-2 cursor-pointer ${i === highlightIndex ? 'bg-primary text-white' : ''}`}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHighlightIndex(i)}
                  onClick={() => handleSelect(opt)}
                >
                  {opt.label}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
