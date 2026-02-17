/**
 * Client Address service: CRUD for utbl_ClientAddress.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { AddressRow, AddressCreateData } from './clients.types';

const SCHEMA = config.db.schema || 'dbo';
const ADDR = `[${SCHEMA}].[utbl_ClientAddress]`;
const STATE = `[${SCHEMA}].[utbl_State]`;
const COUNTRY = `[${SCHEMA}].[utbl_Country]`;

function dateToIso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : String(d ?? '');
}
function dateToIsoOrNull(d: unknown): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

const ADDR_COLUMNS = `
  a.Id AS id, a.ClientId AS clientId, a.AddressType AS addressType,
  a.AddressLine1 AS addressLine1, a.AddressLine2 AS addressLine2,
  a.City AS city, a.StateId AS stateId, s.StateName AS stateName,
  a.CountryId AS countryId, co.CountryName AS countryName,
  a.Pincode AS pincode, a.IsDefault AS isDefault, a.IsActive AS isActive,
  a.CreatedOn AS createdOn, a.CreatedBy AS createdBy,
  a.UpdatedOn AS updatedOn, a.UpdatedBy AS updatedBy
`;

const ADDR_JOINS = `
  FROM ${ADDR} a
  LEFT JOIN ${STATE} s ON s.Id = a.StateId
  LEFT JOIN ${COUNTRY} co ON co.Id = a.CountryId
`;

function mapRow(r: any): AddressRow {
  return { ...r, createdOn: dateToIso(r.createdOn), updatedOn: dateToIsoOrNull(r.updatedOn) };
}

export async function listAddresses(clientId: number, activeOnly = false): Promise<AddressRow[]> {
  const req = await getRequest();
  req.input('clientId', clientId);
  req.input('activeOnly', activeOnly ? 1 : 0);
  const result = await req.query(`
    SELECT ${ADDR_COLUMNS} ${ADDR_JOINS}
    WHERE a.ClientId = @clientId AND (@activeOnly = 0 OR a.IsActive = 1)
    ORDER BY a.IsDefault DESC, a.AddressType
  `);
  return (result.recordset || []).map(mapRow);
}

export async function getAddress(id: number): Promise<AddressRow | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT ${ADDR_COLUMNS} ${ADDR_JOINS} WHERE a.Id = @id
  `);
  const row = result.recordset?.[0];
  return row ? mapRow(row) : null;
}

export async function createAddress(clientId: number, data: AddressCreateData, userId: number | null): Promise<number> {
  if (data.isDefault) {
    await clearDefaultFlag(clientId, data.addressType, userId);
  }
  const req = await getRequest();
  req.input('clientId', clientId);
  req.input('type', (data.addressType || '').trim().slice(0, 30));
  req.input('line1', (data.addressLine1 || '').trim().slice(0, 300));
  req.input('line2', data.addressLine2 ? data.addressLine2.trim().slice(0, 300) : null);
  req.input('city', data.city ? data.city.trim().slice(0, 100) : null);
  req.input('stateId', data.stateId ?? null);
  req.input('countryId', data.countryId ?? null);
  req.input('pincode', data.pincode ? data.pincode.trim().slice(0, 10) : null);
  req.input('isDefault', data.isDefault ? 1 : 0);
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${ADDR}
      (ClientId, AddressType, AddressLine1, AddressLine2, City, StateId, CountryId, Pincode, IsDefault, CreatedBy)
    OUTPUT INSERTED.Id
    VALUES (@clientId, @type, @line1, @line2, @city, @stateId, @countryId, @pincode, @isDefault, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function updateAddress(id: number, data: AddressCreateData, userId: number | null): Promise<void> {
  const existing = await getAddress(id);
  if (!existing) throw new Error('Address not found');

  if (data.isDefault && (!existing.isDefault || data.addressType !== existing.addressType)) {
    await clearDefaultFlag(existing.clientId, data.addressType || existing.addressType, userId);
  }

  const req = await getRequest();
  req.input('id', id);
  req.input('type', (data.addressType || '').trim().slice(0, 30));
  req.input('line1', (data.addressLine1 || '').trim().slice(0, 300));
  req.input('line2', data.addressLine2 ? data.addressLine2.trim().slice(0, 300) : null);
  req.input('city', data.city ? data.city.trim().slice(0, 100) : null);
  req.input('stateId', data.stateId ?? null);
  req.input('countryId', data.countryId ?? null);
  req.input('pincode', data.pincode ? data.pincode.trim().slice(0, 10) : null);
  req.input('isDefault', data.isDefault ? 1 : 0);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${ADDR}
    SET AddressType = @type, AddressLine1 = @line1, AddressLine2 = @line2,
        City = @city, StateId = @stateId, CountryId = @countryId, Pincode = @pincode,
        IsDefault = @isDefault, UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE Id = @id
  `);
}

export async function toggleAddressStatus(id: number, isActive: boolean, userId: number | null): Promise<void> {
  const req = await getRequest();
  req.input('id', id);
  req.input('isActive', isActive ? 1 : 0);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${ADDR}
    SET IsActive = @isActive, UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE Id = @id
  `);
}

async function clearDefaultFlag(clientId: number, addressType: string, userId: number | null): Promise<void> {
  const req = await getRequest();
  req.input('clientId', clientId);
  req.input('type', addressType);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${ADDR}
    SET IsDefault = 0, UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE ClientId = @clientId AND AddressType = @type AND IsDefault = 1 AND IsActive = 1
  `);
}
