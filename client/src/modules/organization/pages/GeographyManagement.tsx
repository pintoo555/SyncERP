import { useState, useEffect } from 'react';
import { organizationApi } from '../api/organizationApi';
import type { Country, State, TaxJurisdiction } from '../types';

type TabId = 'countries' | 'states' | 'tax';

export default function GeographyManagement() {
  const [activeTab, setActiveTab] = useState<TabId>('countries');
  const [countries, setCountries] = useState<Country[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [taxJurisdictions, setTaxJurisdictions] = useState<TaxJurisdiction[]>([]);
  const [countryFilter, setCountryFilter] = useState<number | ''>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Country modal
  const [countryModal, setCountryModal] = useState<{ open: true; country?: Country } | { open: false }>({ open: false });
  const [countryForm, setCountryForm] = useState({ countryCode: '', countryName: '', currencyCode: '', currencySymbol: '', phoneCode: '' });

  // State modal
  const [stateModal, setStateModal] = useState<{ open: true; state?: State } | { open: false }>({ open: false });
  const [stateForm, setStateForm] = useState({ stateCode: '', stateName: '', countryId: '' as number | '' });

  // Tax jurisdiction modal
  const [taxModal, setTaxModal] = useState<{ open: true; jurisdiction?: TaxJurisdiction } | { open: false }>({ open: false });
  const [taxForm, setTaxForm] = useState({ jurisdictionCode: '', jurisdictionName: '', taxType: '', defaultTaxRate: 0, countryId: '' as number | '' });

  const [saving, setSaving] = useState(false);

  async function loadCountries() {
    try {
      const res = await organizationApi.listCountries(false);
      setCountries((res as { data?: Country[] }).data ?? []);
    } catch (e) {
      setCountries([]);
    }
  }

  async function loadStates() {
    try {
      const countryId = countryFilter === '' ? undefined : countryFilter;
      const res = await organizationApi.listStates(countryId, false);
      setStates((res as { data?: State[] }).data ?? []);
    } catch (e) {
      setStates([]);
    }
  }

  async function loadTaxJurisdictions() {
    try {
      const countryId = countryFilter === '' ? undefined : countryFilter;
      const res = await organizationApi.listTaxJurisdictions(countryId, false);
      setTaxJurisdictions((res as { data?: TaxJurisdiction[] }).data ?? []);
    } catch (e) {
      setTaxJurisdictions([]);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      await loadCountries();
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'states') loadStates();
    else if (activeTab === 'tax') loadTaxJurisdictions();
  }, [activeTab, countryFilter]);

  // Country CRUD
  const openAddCountry = () => {
    setCountryForm({ countryCode: '', countryName: '', currencyCode: '', currencySymbol: '', phoneCode: '' });
    setCountryModal({ open: true });
  };
  const openEditCountry = (c: Country) => {
    setCountryForm({
      countryCode: c.countryCode,
      countryName: c.countryName,
      currencyCode: c.currencyCode,
      currencySymbol: c.currencySymbol ?? '',
      phoneCode: c.phoneCode ?? '',
    });
    setCountryModal({ open: true, country: c });
  };
  const saveCountry = async () => {
    if (!countryForm.countryCode.trim() || !countryForm.countryName.trim()) return;
    try {
      setSaving(true);
      setError(null);
      const data = {
        countryCode: countryForm.countryCode.trim(),
        countryName: countryForm.countryName.trim(),
        currencyCode: countryForm.currencyCode.trim() || undefined,
        currencySymbol: countryForm.currencySymbol.trim() || null,
        phoneCode: countryForm.phoneCode.trim() || null,
      };
      if (countryModal.open && countryModal.country) {
        await organizationApi.updateCountry(countryModal.country.id, data);
      } else {
        await organizationApi.createCountry(data);
      }
      setCountryModal({ open: false });
      await loadCountries();
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // State CRUD
  const openAddState = () => {
    setStateForm({ stateCode: '', stateName: '', countryId: countryFilter || '' });
    setStateModal({ open: true });
  };
  const openEditState = (s: State) => {
    setStateForm({ stateCode: s.stateCode, stateName: s.stateName, countryId: s.countryId });
    setStateModal({ open: true, state: s });
  };
  const saveState = async () => {
    if (!stateForm.stateCode.trim() || !stateForm.stateName.trim() || stateForm.countryId === '') return;
    try {
      setSaving(true);
      setError(null);
      const data = { countryId: stateForm.countryId, stateCode: stateForm.stateCode.trim(), stateName: stateForm.stateName.trim() };
      if (stateModal.open && stateModal.state) {
        await organizationApi.updateState(stateModal.state.id, data);
      } else {
        await organizationApi.createState(data);
      }
      setStateModal({ open: false });
      await loadStates();
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Tax Jurisdiction CRUD
  const openAddTax = () => {
    setTaxForm({ jurisdictionCode: '', jurisdictionName: '', taxType: '', defaultTaxRate: 0, countryId: countryFilter || '' });
    setTaxModal({ open: true });
  };
  const openEditTax = (t: TaxJurisdiction) => {
    setTaxForm({
      jurisdictionCode: t.jurisdictionCode,
      jurisdictionName: t.jurisdictionName,
      taxType: t.taxType,
      defaultTaxRate: t.defaultTaxRate,
      countryId: t.countryId,
    });
    setTaxModal({ open: true, jurisdiction: t });
  };
  const saveTax = async () => {
    if (!taxForm.jurisdictionCode.trim() || !taxForm.jurisdictionName.trim() || taxForm.countryId === '') return;
    try {
      setSaving(true);
      setError(null);
      const data = {
        countryId: taxForm.countryId,
        jurisdictionCode: taxForm.jurisdictionCode.trim(),
        jurisdictionName: taxForm.jurisdictionName.trim(),
        taxType: taxForm.taxType.trim() || 'GST',
        defaultTaxRate: taxForm.defaultTaxRate,
      };
      if (taxModal.open && taxModal.jurisdiction) {
        await organizationApi.updateTaxJurisdiction(taxModal.jurisdiction.id, data);
      } else {
        await organizationApi.createTaxJurisdiction(data);
      }
      setTaxModal({ open: false });
      await loadTaxJurisdictions();
    } catch (e) {
      setError((e as Error)?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container-fluid py-4">
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4">
        <h4 className="mb-0"><i className="ti ti-world me-2" />Geography</h4>
      </div>
      {error && (
        <div className="alert alert-danger alert-dismissible fade show">
          {error}
          <button type="button" className="btn-close" onClick={() => setError(null)} aria-label="Close" />
        </div>
      )}

      <ul className="nav nav-tabs mb-3">
        <li className="nav-item">
          <button type="button" className={`nav-link ${activeTab === 'countries' ? 'active' : ''}`} onClick={() => setActiveTab('countries')}>Countries</button>
        </li>
        <li className="nav-item">
          <button type="button" className={`nav-link ${activeTab === 'states' ? 'active' : ''}`} onClick={() => setActiveTab('states')}>States</button>
        </li>
        <li className="nav-item">
          <button type="button" className={`nav-link ${activeTab === 'tax' ? 'active' : ''}`} onClick={() => setActiveTab('tax')}>Tax Jurisdictions</button>
        </li>
      </ul>

      {activeTab === 'countries' && (
        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <span>Countries</span>
            <button type="button" className="btn btn-primary btn-sm" onClick={openAddCountry}><i className="ti ti-plus me-1" />Add Country</button>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="p-4 text-center text-muted">Loading...</div>
            ) : countries.length === 0 ? (
              <div className="p-4 text-center text-muted">No countries. Add one to get started.</div>
            ) : (
              <table className="table table-hover mb-0">
                <thead>
                  <tr>
                    <th>Country Code</th>
                    <th>Country Name</th>
                    <th>Currency Code</th>
                    <th>Currency Symbol</th>
                    <th>Phone Code</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {countries.map((c) => (
                    <tr key={c.id}>
                      <td>{c.countryCode}</td>
                      <td>{c.countryName}</td>
                      <td>{c.currencyCode}</td>
                      <td>{c.currencySymbol ?? '—'}</td>
                      <td>{c.phoneCode ?? '—'}</td>
                      <td className="text-end">
                        <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openEditCountry(c)}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'states' && (
        <>
          <div className="card mb-3">
            <div className="card-body py-2">
              <label className="form-label small mb-0 me-2">Filter by Country</label>
              <select className="form-select form-select-sm d-inline-block" style={{ maxWidth: 280 }} value={countryFilter} onChange={(e) => setCountryFilter(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">All Countries</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>{c.countryName}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>States</span>
              <button type="button" className="btn btn-primary btn-sm" onClick={openAddState}><i className="ti ti-plus me-1" />Add State</button>
            </div>
            <div className="card-body p-0">
              {states.length === 0 ? (
                <div className="p-4 text-center text-muted">{countryFilter === '' ? 'Select a country to view states.' : 'No states. Add one to get started.'}</div>
              ) : (
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>State Code</th>
                      <th>State Name</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {states.map((s) => (
                      <tr key={s.id}>
                        <td>{s.stateCode}</td>
                        <td>{s.stateName}</td>
                        <td className="text-end">
                          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openEditState(s)}>Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'tax' && (
        <>
          <div className="card mb-3">
            <div className="card-body py-2">
              <label className="form-label small mb-0 me-2">Filter by Country</label>
              <select className="form-select form-select-sm d-inline-block" style={{ maxWidth: 280 }} value={countryFilter} onChange={(e) => setCountryFilter(e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">All Countries</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>{c.countryName}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="card">
            <div className="card-header d-flex justify-content-between align-items-center">
              <span>Tax Jurisdictions</span>
              <button type="button" className="btn btn-primary btn-sm" onClick={openAddTax}><i className="ti ti-plus me-1" />Add Tax Jurisdiction</button>
            </div>
            <div className="card-body p-0">
              {taxJurisdictions.length === 0 ? (
                <div className="p-4 text-center text-muted">{countryFilter === '' ? 'Select a country to view tax jurisdictions.' : 'No tax jurisdictions. Add one to get started.'}</div>
              ) : (
                <table className="table table-hover mb-0">
                  <thead>
                    <tr>
                      <th>Jurisdiction Code</th>
                      <th>Jurisdiction Name</th>
                      <th>Tax Type</th>
                      <th>Default Tax Rate</th>
                      <th className="text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxJurisdictions.map((t) => (
                      <tr key={t.id}>
                        <td>{t.jurisdictionCode}</td>
                        <td>{t.jurisdictionName}</td>
                        <td>{t.taxType}</td>
                        <td>{t.defaultTaxRate}%</td>
                        <td className="text-end">
                          <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => openEditTax(t)}>Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}

      {/* Country Modal */}
      {countryModal.open && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{countryModal.country ? 'Edit Country' : 'Add Country'}</h5>
                <button type="button" className="btn-close" onClick={() => setCountryModal({ open: false })} aria-label="Close" />
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label small">Country Code</label>
                  <input type="text" className="form-control form-control-sm" value={countryForm.countryCode} onChange={(e) => setCountryForm((f) => ({ ...f, countryCode: e.target.value }))} placeholder="e.g. IN" />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Country Name</label>
                  <input type="text" className="form-control form-control-sm" value={countryForm.countryName} onChange={(e) => setCountryForm((f) => ({ ...f, countryName: e.target.value }))} placeholder="e.g. India" />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Currency Code</label>
                  <input type="text" className="form-control form-control-sm" value={countryForm.currencyCode} onChange={(e) => setCountryForm((f) => ({ ...f, currencyCode: e.target.value }))} placeholder="e.g. INR" />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Currency Symbol</label>
                  <input type="text" className="form-control form-control-sm" value={countryForm.currencySymbol} onChange={(e) => setCountryForm((f) => ({ ...f, currencySymbol: e.target.value }))} placeholder="e.g. ₹" />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Phone Code</label>
                  <input type="text" className="form-control form-control-sm" value={countryForm.phoneCode} onChange={(e) => setCountryForm((f) => ({ ...f, phoneCode: e.target.value }))} placeholder="e.g. +91" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setCountryModal({ open: false })}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={saveCountry} disabled={saving || !countryForm.countryCode.trim() || !countryForm.countryName.trim()}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* State Modal */}
      {stateModal.open && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{stateModal.state ? 'Edit State' : 'Add State'}</h5>
                <button type="button" className="btn-close" onClick={() => setStateModal({ open: false })} aria-label="Close" />
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label small">Country</label>
                  <select className="form-select form-select-sm" value={stateForm.countryId} onChange={(e) => setStateForm((f) => ({ ...f, countryId: e.target.value === '' ? '' : Number(e.target.value) }))}>
                    <option value="">-- Select country --</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>{c.countryName}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-2">
                  <label className="form-label small">State Code</label>
                  <input type="text" className="form-control form-control-sm" value={stateForm.stateCode} onChange={(e) => setStateForm((f) => ({ ...f, stateCode: e.target.value }))} placeholder="e.g. KA" />
                </div>
                <div className="mb-2">
                  <label className="form-label small">State Name</label>
                  <input type="text" className="form-control form-control-sm" value={stateForm.stateName} onChange={(e) => setStateForm((f) => ({ ...f, stateName: e.target.value }))} placeholder="e.g. Karnataka" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setStateModal({ open: false })}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={saveState} disabled={saving || !stateForm.stateCode.trim() || !stateForm.stateName.trim() || stateForm.countryId === ''}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tax Jurisdiction Modal */}
      {taxModal.open && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{taxModal.jurisdiction ? 'Edit Tax Jurisdiction' : 'Add Tax Jurisdiction'}</h5>
                <button type="button" className="btn-close" onClick={() => setTaxModal({ open: false })} aria-label="Close" />
              </div>
              <div className="modal-body">
                <div className="mb-2">
                  <label className="form-label small">Country</label>
                  <select className="form-select form-select-sm" value={taxForm.countryId} onChange={(e) => setTaxForm((f) => ({ ...f, countryId: e.target.value === '' ? '' : Number(e.target.value) }))}>
                    <option value="">-- Select country --</option>
                    {countries.map((c) => (
                      <option key={c.id} value={c.id}>{c.countryName}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-2">
                  <label className="form-label small">Jurisdiction Code</label>
                  <input type="text" className="form-control form-control-sm" value={taxForm.jurisdictionCode} onChange={(e) => setTaxForm((f) => ({ ...f, jurisdictionCode: e.target.value }))} placeholder="e.g. KA-GST" />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Jurisdiction Name</label>
                  <input type="text" className="form-control form-control-sm" value={taxForm.jurisdictionName} onChange={(e) => setTaxForm((f) => ({ ...f, jurisdictionName: e.target.value }))} placeholder="e.g. Karnataka GST" />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Tax Type</label>
                  <input type="text" className="form-control form-control-sm" value={taxForm.taxType} onChange={(e) => setTaxForm((f) => ({ ...f, taxType: e.target.value }))} placeholder="e.g. GST" />
                </div>
                <div className="mb-2">
                  <label className="form-label small">Default Tax Rate (%)</label>
                  <input type="number" step="0.01" min="0" className="form-control form-control-sm" value={taxForm.defaultTaxRate} onChange={(e) => setTaxForm((f) => ({ ...f, defaultTaxRate: Number(e.target.value) || 0 }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setTaxModal({ open: false })}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={saveTax} disabled={saving || !taxForm.jurisdictionCode.trim() || !taxForm.jurisdictionName.trim() || taxForm.countryId === ''}>{saving ? 'Saving...' : 'Save'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
