/**
 * Client service: CRUD for utbl_Client with auto-generated ClientCode.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { ClientRow, ClientListFilters, ClientCreateData, ClientUpdateData, ClientStatusPatch, PaginatedResult } from './clients.types';

const SCHEMA = config.db.schema || 'dbo';
const CLIENT = `[${SCHEMA}].[utbl_Client]`;
const INDUSTRY = `[${SCHEMA}].[utbl_Industry]`;

function dateToIso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : String(d ?? '');
}
function dateToIsoOrNull(d: unknown): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

const CLIENT_COLUMNS = `
  c.Id AS id, c.ClientCode AS clientCode, c.ClientName AS clientName,
  c.ClientDisplayName AS clientDisplayName, c.ClientType AS clientType,
  c.IndustryId AS industryId, i.IndustryName AS industryName,
  c.GSTNumber AS gstNumber, c.PANNumber AS panNumber,
  c.IECCode AS iecCode, c.MSMENumber AS msmeNumber,
  c.CurrencyCode AS currencyCode, c.CreditLimit AS creditLimit,
  c.CreditDays AS creditDays,
  c.TradeName AS tradeName, c.GSTType AS gstType,
  c.GSTRegistrationDate AS gstRegistrationDate, c.CompanyStatus AS companyStatus,
  c.GSTVerified AS gstVerified, c.GSTVerifiedOn AS gstVerifiedOn,
  c.IsBlacklisted AS isBlacklisted,
  c.IsActive AS isActive, c.IsMerged AS isMerged,
  c.MergedIntoClientId AS mergedIntoClientId, m.ClientName AS mergedIntoClientName,
  c.CreatedOn AS createdOn, c.CreatedBy AS createdBy,
  c.UpdatedOn AS updatedOn, c.UpdatedBy AS updatedBy
`;

const CLIENT_JOINS = `
  FROM ${CLIENT} c
  LEFT JOIN ${INDUSTRY} i ON i.Id = c.IndustryId
  LEFT JOIN ${CLIENT} m ON m.Id = c.MergedIntoClientId
`;

function mapRow(r: any): ClientRow {
  return {
    ...r,
    createdOn: dateToIso(r.createdOn),
    updatedOn: dateToIsoOrNull(r.updatedOn),
  };
}

const ALLOWED_SORT_COLS: Record<string, string> = {
  clientCode: 'c.ClientCode',
  clientName: 'c.ClientName',
  clientType: 'c.ClientType',
  industryName: 'i.IndustryName',
  createdOn: 'c.CreatedOn',
  creditLimit: 'c.CreditLimit',
};

export async function listClients(filters: ClientListFilters): Promise<PaginatedResult<ClientRow>> {
  const req = await getRequest();
  const where: string[] = [];

  if (filters.search) {
    req.input('search', `%${filters.search}%`);
    where.push(`(c.ClientName LIKE @search OR c.ClientCode LIKE @search OR c.GSTNumber LIKE @search OR c.ClientDisplayName LIKE @search)`);
  }
  if (filters.industryId) {
    req.input('industryId', filters.industryId);
    where.push('c.IndustryId = @industryId');
  }
  if (filters.clientType) {
    req.input('clientType', filters.clientType);
    where.push('c.ClientType = @clientType');
  }
  if (filters.isActive !== undefined && filters.isActive !== null) {
    req.input('isActive', filters.isActive);
    where.push('c.IsActive = @isActive');
  }
  if (filters.isBlacklisted !== undefined && filters.isBlacklisted !== null) {
    req.input('isBlacklisted', filters.isBlacklisted);
    where.push('c.IsBlacklisted = @isBlacklisted');
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  const sortCol = ALLOWED_SORT_COLS[filters.sortBy || ''] || 'c.ClientName';
  const sortDir = filters.sortDir === 'DESC' ? 'DESC' : 'ASC';
  const offset = (filters.page - 1) * filters.pageSize;

  req.input('offset', offset);
  req.input('pageSize', filters.pageSize);

  const countResult = await req.query(`SELECT COUNT(*) AS total ${CLIENT_JOINS} ${whereClause}`);
  const total = countResult.recordset[0]?.total || 0;

  const req2 = await getRequest();
  if (filters.search) req2.input('search', `%${filters.search}%`);
  if (filters.industryId) req2.input('industryId', filters.industryId);
  if (filters.clientType) req2.input('clientType', filters.clientType);
  if (filters.isActive !== undefined && filters.isActive !== null) req2.input('isActive', filters.isActive);
  if (filters.isBlacklisted !== undefined && filters.isBlacklisted !== null) req2.input('isBlacklisted', filters.isBlacklisted);
  req2.input('offset', offset);
  req2.input('pageSize', filters.pageSize);

  const dataResult = await req2.query(`
    ;WITH CTE AS (
      SELECT ${CLIENT_COLUMNS},
             ROW_NUMBER() OVER (ORDER BY ${sortCol} ${sortDir}) AS rn
      ${CLIENT_JOINS}
      ${whereClause}
    )
    SELECT * FROM CTE WHERE rn > @offset AND rn <= @offset + @pageSize
  `);

  return {
    data: (dataResult.recordset || []).map(mapRow),
    total,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export async function getClientById(id: number): Promise<ClientRow | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT ${CLIENT_COLUMNS} ${CLIENT_JOINS} WHERE c.Id = @id
  `);
  const row = result.recordset?.[0];
  return row ? mapRow(row) : null;
}

export async function createClient(data: ClientCreateData, userId: number | null): Promise<number> {
  const req = await getRequest();
  req.input('name', (data.clientName || '').trim().slice(0, 200));
  req.input('displayName', data.clientDisplayName ? data.clientDisplayName.trim().slice(0, 200) : null);
  req.input('type', (data.clientType || '').trim().slice(0, 50));
  req.input('industryId', data.industryId ?? null);
  req.input('gst', data.gstNumber ? data.gstNumber.trim().slice(0, 20) : null);
  req.input('pan', data.panNumber ? data.panNumber.trim().slice(0, 20) : null);
  req.input('iec', data.iecCode ? data.iecCode.trim().slice(0, 30) : null);
  req.input('msme', data.msmeNumber ? data.msmeNumber.trim().slice(0, 30) : null);
  req.input('currency', (data.currencyCode || 'INR').trim().slice(0, 10));
  req.input('creditLimit', data.creditLimit ?? 0);
  req.input('creditDays', data.creditDays ?? 0);
  req.input('tradeName', data.tradeName ? data.tradeName.trim().slice(0, 200) : null);
  req.input('gstType', data.gstType ? data.gstType.trim().slice(0, 50) : null);
  req.input('gstRegDate', data.gstRegistrationDate || null);
  req.input('companyStatus', data.companyStatus ? data.companyStatus.trim().slice(0, 50) : null);
  req.input('gstVerified', data.gstVerified ? 1 : 0);
  req.input('gstVerifiedOn', data.gstVerified ? new Date() : null);
  req.input('createdBy', userId);

  const result = await req.query(`
    DECLARE @out TABLE (Id BIGINT);

    INSERT INTO ${CLIENT}
      (ClientCode, ClientName, ClientDisplayName, ClientType, IndustryId,
       GSTNumber, PANNumber, IECCode, MSMENumber, CurrencyCode,
       CreditLimit, CreditDays,
       TradeName, GSTType, GSTRegistrationDate, CompanyStatus, GSTVerified, GSTVerifiedOn,
       CreatedBy)
    OUTPUT INSERTED.Id INTO @out
    VALUES
      (LEFT(CAST(NEWID() AS NVARCHAR(36)), 20), @name, @displayName, @type, @industryId,
       @gst, @pan, @iec, @msme, @currency,
       @creditLimit, @creditDays,
       @tradeName, @gstType, @gstRegDate, @companyStatus, @gstVerified, @gstVerifiedOn,
       @createdBy);

    DECLARE @newId BIGINT = (SELECT Id FROM @out);

    UPDATE ${CLIENT}
    SET ClientCode = 'CL' + RIGHT('000000' + CAST(@newId AS VARCHAR(20)), 6)
    WHERE Id = @newId;

    SELECT @newId AS Id;
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function updateClient(id: number, data: ClientUpdateData, userId: number | null): Promise<void> {
  const existing = await getClientById(id);
  if (!existing) throw new Error('Client not found');
  if (existing.isMerged) throw new Error('Cannot update a merged client');

  const sets: string[] = [];
  const req = await getRequest();
  req.input('id', id);
  req.input('updatedBy', userId);

  if (data.clientName !== undefined) {
    req.input('name', data.clientName.trim().slice(0, 200));
    sets.push('ClientName = @name');
  }
  if (data.clientDisplayName !== undefined) {
    req.input('displayName', data.clientDisplayName ? data.clientDisplayName.trim().slice(0, 200) : null);
    sets.push('ClientDisplayName = @displayName');
  }
  if (data.clientType !== undefined) {
    req.input('type', data.clientType.trim().slice(0, 50));
    sets.push('ClientType = @type');
  }
  if (data.industryId !== undefined) {
    req.input('industryId', data.industryId ?? null);
    sets.push('IndustryId = @industryId');
  }
  if (data.gstNumber !== undefined) {
    req.input('gst', data.gstNumber ? data.gstNumber.trim().slice(0, 20) : null);
    sets.push('GSTNumber = @gst');
  }
  if (data.panNumber !== undefined) {
    req.input('pan', data.panNumber ? data.panNumber.trim().slice(0, 20) : null);
    sets.push('PANNumber = @pan');
  }
  if (data.iecCode !== undefined) {
    req.input('iec', data.iecCode ? data.iecCode.trim().slice(0, 30) : null);
    sets.push('IECCode = @iec');
  }
  if (data.msmeNumber !== undefined) {
    req.input('msme', data.msmeNumber ? data.msmeNumber.trim().slice(0, 30) : null);
    sets.push('MSMENumber = @msme');
  }
  if (data.currencyCode !== undefined) {
    req.input('currency', data.currencyCode.trim().slice(0, 10));
    sets.push('CurrencyCode = @currency');
  }
  if (data.creditLimit !== undefined) {
    req.input('creditLimit', data.creditLimit);
    sets.push('CreditLimit = @creditLimit');
  }
  if (data.creditDays !== undefined) {
    req.input('creditDays', data.creditDays);
    sets.push('CreditDays = @creditDays');
  }

  if (sets.length === 0) return;
  sets.push('UpdatedOn = GETDATE()', 'UpdatedBy = @updatedBy');

  await req.query(`UPDATE ${CLIENT} SET ${sets.join(', ')} WHERE Id = @id`);
}

export async function patchStatus(id: number, patch: ClientStatusPatch, userId: number | null): Promise<void> {
  const sets: string[] = [];
  const req = await getRequest();
  req.input('id', id);
  req.input('updatedBy', userId);

  if (patch.isActive !== undefined) {
    req.input('isActive', patch.isActive ? 1 : 0);
    sets.push('IsActive = @isActive');
  }
  if (patch.isBlacklisted !== undefined) {
    req.input('isBlacklisted', patch.isBlacklisted ? 1 : 0);
    sets.push('IsBlacklisted = @isBlacklisted');
  }

  if (sets.length === 0) return;
  sets.push('UpdatedOn = GETDATE()', 'UpdatedBy = @updatedBy');

  await req.query(`UPDATE ${CLIENT} SET ${sets.join(', ')} WHERE Id = @id`);
}

/**
 * Follows the MergedIntoClientId chain to find the ultimate active client.
 * Returns the original ID if not merged.
 */
export async function getEffectiveClientId(clientId: number): Promise<number> {
  const visited = new Set<number>();
  let currentId = clientId;

  while (true) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    const req = await getRequest();
    const result = await req.input('id', currentId).query(`
      SELECT IsMerged, MergedIntoClientId FROM ${CLIENT} WHERE Id = @id
    `);
    const row = result.recordset?.[0];
    if (!row || !row.IsMerged || !row.MergedIntoClientId) break;
    currentId = row.MergedIntoClientId;
  }

  return currentId;
}
