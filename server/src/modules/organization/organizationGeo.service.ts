/**
 * Geography service: Country, State, TaxJurisdiction CRUD.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { CountryRow, StateRow, TaxJurisdictionRow } from './organization.types';

const SCHEMA = config.db.schema || 'dbo';
const COUNTRY = `[${SCHEMA}].[utbl_Country]`;
const STATE = `[${SCHEMA}].[utbl_State]`;
const TAX_JURIS = `[${SCHEMA}].[utbl_TaxJurisdiction]`;

function dateToIso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : String(d ?? '');
}

function dateToIsoOrNull(d: unknown): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

// ─── Countries ───

export async function listCountries(activeOnly = false): Promise<CountryRow[]> {
  const req = await getRequest();
  req.input('activeOnly', activeOnly ? 1 : 0);
  const result = await req.query(`
    SELECT Id AS id, CountryCode AS countryCode, CountryName AS countryName,
           CurrencyCode AS currencyCode, CurrencySymbol AS currencySymbol, PhoneCode AS phoneCode,
           IsActive AS isActive, CreatedOn AS createdOn, CreatedBy AS createdBy,
           UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
    FROM ${COUNTRY}
    WHERE (@activeOnly = 0 OR IsActive = 1)
    ORDER BY CountryName
  `);
  return (result.recordset || []).map((r: any) => ({
    ...r,
    createdOn: dateToIso(r.createdOn),
    updatedOn: dateToIsoOrNull(r.updatedOn),
  }));
}

export async function getCountry(id: number): Promise<CountryRow | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT Id AS id, CountryCode AS countryCode, CountryName AS countryName,
           CurrencyCode AS currencyCode, CurrencySymbol AS currencySymbol, PhoneCode AS phoneCode,
           IsActive AS isActive, CreatedOn AS createdOn, CreatedBy AS createdBy,
           UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
    FROM ${COUNTRY} WHERE Id = @id
  `);
  const r = (result.recordset as any[])?.[0];
  if (!r) return null;
  return { ...r, createdOn: dateToIso(r.createdOn), updatedOn: dateToIsoOrNull(r.updatedOn) };
}

export async function createCountry(data: { countryCode: string; countryName: string; currencyCode: string; currencySymbol?: string; phoneCode?: string }, userId: number | null): Promise<number> {
  const req = await getRequest();
  req.input('code', (data.countryCode || '').trim().toUpperCase().slice(0, 2));
  req.input('name', (data.countryName || '').trim().slice(0, 200));
  req.input('currency', (data.currencyCode || '').trim().toUpperCase().slice(0, 3));
  req.input('symbol', (data.currencySymbol || '').trim().slice(0, 10) || null);
  req.input('phone', (data.phoneCode || '').trim().slice(0, 10) || null);
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${COUNTRY} (CountryCode, CountryName, CurrencyCode, CurrencySymbol, PhoneCode, CreatedBy)
    OUTPUT INSERTED.Id VALUES (@code, @name, @currency, @symbol, @phone, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function updateCountry(id: number, data: Partial<{ countryCode: string; countryName: string; currencyCode: string; currencySymbol: string; phoneCode: string; isActive: boolean }>, userId: number | null): Promise<boolean> {
  const req = await getRequest();
  req.input('id', id);
  req.input('code', data.countryCode !== undefined ? (data.countryCode || '').trim().toUpperCase().slice(0, 2) : null);
  req.input('name', data.countryName !== undefined ? (data.countryName || '').trim().slice(0, 200) : null);
  req.input('currency', data.currencyCode !== undefined ? (data.currencyCode || '').trim().toUpperCase().slice(0, 3) : null);
  req.input('symbol', data.currencySymbol !== undefined ? (data.currencySymbol || '').trim().slice(0, 10) : null);
  req.input('phone', data.phoneCode !== undefined ? (data.phoneCode || '').trim().slice(0, 10) : null);
  req.input('isActive', data.isActive !== undefined ? (data.isActive ? 1 : 0) : null);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${COUNTRY} SET
      CountryCode = ISNULL(@code, CountryCode),
      CountryName = ISNULL(@name, CountryName),
      CurrencyCode = ISNULL(@currency, CurrencyCode),
      CurrencySymbol = ISNULL(@symbol, CurrencySymbol),
      PhoneCode = ISNULL(@phone, PhoneCode),
      IsActive = ISNULL(@isActive, IsActive),
      UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE Id = @id
  `);
  return true;
}

// ─── States ───

export async function listStates(countryId?: number, activeOnly = false): Promise<StateRow[]> {
  const req = await getRequest();
  req.input('countryId', countryId ?? null);
  req.input('activeOnly', activeOnly ? 1 : 0);
  const result = await req.query(`
    SELECT Id AS id, CountryId AS countryId, StateCode AS stateCode, StateName AS stateName,
           IsActive AS isActive, CreatedOn AS createdOn, CreatedBy AS createdBy,
           UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
    FROM ${STATE}
    WHERE (@countryId IS NULL OR CountryId = @countryId)
      AND (@activeOnly = 0 OR IsActive = 1)
    ORDER BY StateName
  `);
  return (result.recordset || []).map((r: any) => ({
    ...r,
    createdOn: dateToIso(r.createdOn),
    updatedOn: dateToIsoOrNull(r.updatedOn),
  }));
}

export async function createState(data: { countryId: number; stateCode: string; stateName: string }, userId: number | null): Promise<number> {
  const req = await getRequest();
  req.input('countryId', data.countryId);
  req.input('code', (data.stateCode || '').trim().toUpperCase().slice(0, 10));
  req.input('name', (data.stateName || '').trim().slice(0, 200));
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${STATE} (CountryId, StateCode, StateName, CreatedBy)
    OUTPUT INSERTED.Id VALUES (@countryId, @code, @name, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function updateState(id: number, data: Partial<{ stateCode: string; stateName: string; isActive: boolean }>, userId: number | null): Promise<boolean> {
  const req = await getRequest();
  req.input('id', id);
  req.input('code', data.stateCode !== undefined ? (data.stateCode || '').trim().toUpperCase().slice(0, 10) : null);
  req.input('name', data.stateName !== undefined ? (data.stateName || '').trim().slice(0, 200) : null);
  req.input('isActive', data.isActive !== undefined ? (data.isActive ? 1 : 0) : null);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${STATE} SET
      StateCode = ISNULL(@code, StateCode),
      StateName = ISNULL(@name, StateName),
      IsActive = ISNULL(@isActive, IsActive),
      UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE Id = @id
  `);
  return true;
}

// ─── Tax Jurisdictions ───

export async function listTaxJurisdictions(countryId?: number, activeOnly = false): Promise<TaxJurisdictionRow[]> {
  const req = await getRequest();
  req.input('countryId', countryId ?? null);
  req.input('activeOnly', activeOnly ? 1 : 0);
  const result = await req.query(`
    SELECT Id AS id, CountryId AS countryId, StateId AS stateId,
           JurisdictionCode AS jurisdictionCode, JurisdictionName AS jurisdictionName,
           TaxType AS taxType, DefaultTaxRate AS defaultTaxRate,
           IsActive AS isActive, CreatedOn AS createdOn, CreatedBy AS createdBy,
           UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
    FROM ${TAX_JURIS}
    WHERE (@countryId IS NULL OR CountryId = @countryId)
      AND (@activeOnly = 0 OR IsActive = 1)
    ORDER BY JurisdictionName
  `);
  return (result.recordset || []).map((r: any) => ({
    ...r,
    createdOn: dateToIso(r.createdOn),
    updatedOn: dateToIsoOrNull(r.updatedOn),
  }));
}

export async function createTaxJurisdiction(data: { countryId: number; stateId?: number | null; jurisdictionCode: string; jurisdictionName: string; taxType: string; defaultTaxRate: number }, userId: number | null): Promise<number> {
  const req = await getRequest();
  req.input('countryId', data.countryId);
  req.input('stateId', data.stateId ?? null);
  req.input('code', (data.jurisdictionCode || '').trim().slice(0, 50));
  req.input('name', (data.jurisdictionName || '').trim().slice(0, 200));
  req.input('taxType', (data.taxType || 'NONE').trim().slice(0, 20));
  req.input('rate', data.defaultTaxRate ?? 0);
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${TAX_JURIS} (CountryId, StateId, JurisdictionCode, JurisdictionName, TaxType, DefaultTaxRate, CreatedBy)
    OUTPUT INSERTED.Id VALUES (@countryId, @stateId, @code, @name, @taxType, @rate, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function updateTaxJurisdiction(id: number, data: Partial<{ jurisdictionCode: string; jurisdictionName: string; taxType: string; defaultTaxRate: number; isActive: boolean }>, userId: number | null): Promise<boolean> {
  const req = await getRequest();
  req.input('id', id);
  req.input('code', data.jurisdictionCode !== undefined ? (data.jurisdictionCode || '').trim().slice(0, 50) : null);
  req.input('name', data.jurisdictionName !== undefined ? (data.jurisdictionName || '').trim().slice(0, 200) : null);
  req.input('taxType', data.taxType !== undefined ? (data.taxType || '').trim().slice(0, 20) : null);
  req.input('rate', data.defaultTaxRate !== undefined ? data.defaultTaxRate : null);
  req.input('isActive', data.isActive !== undefined ? (data.isActive ? 1 : 0) : null);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${TAX_JURIS} SET
      JurisdictionCode = ISNULL(@code, JurisdictionCode),
      JurisdictionName = ISNULL(@name, JurisdictionName),
      TaxType = ISNULL(@taxType, TaxType),
      DefaultTaxRate = ISNULL(@rate, DefaultTaxRate),
      IsActive = ISNULL(@isActive, IsActive),
      UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE Id = @id
  `);
  return true;
}
