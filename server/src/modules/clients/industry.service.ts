/**
 * Industry service: CRUD for utbl_Industry.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { IndustryRow, IndustryCreateData } from './clients.types';

const SCHEMA = config.db.schema || 'dbo';
const INDUSTRY = `[${SCHEMA}].[utbl_Industry]`;

function dateToIso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : String(d ?? '');
}
function dateToIsoOrNull(d: unknown): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

export async function listIndustries(activeOnly = false): Promise<IndustryRow[]> {
  const req = await getRequest();
  req.input('activeOnly', activeOnly ? 1 : 0);
  const result = await req.query(`
    SELECT Id AS id, IndustryName AS industryName, IndustryCategory AS industryCategory,
           IsActive AS isActive, CreatedOn AS createdOn, CreatedBy AS createdBy,
           UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
    FROM ${INDUSTRY}
    WHERE (@activeOnly = 0 OR IsActive = 1)
    ORDER BY IndustryName
  `);
  return (result.recordset || []).map((r: any) => ({
    id: r.id,
    industryName: r.industryName ?? r.IndustryName ?? '',
    industryCategory: r.industryCategory ?? r.IndustryCategory ?? 'Other',
    isActive: !!r.isActive,
    createdOn: dateToIso(r.createdOn),
    createdBy: r.createdBy ?? r.CreatedBy ?? null,
    updatedOn: dateToIsoOrNull(r.updatedOn ?? r.UpdatedOn),
    updatedBy: r.updatedBy ?? r.UpdatedBy ?? null,
  }));
}

export async function getIndustry(id: number): Promise<IndustryRow | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT Id AS id, IndustryName AS industryName, IndustryCategory AS industryCategory,
           IsActive AS isActive, CreatedOn AS createdOn, CreatedBy AS createdBy,
           UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
    FROM ${INDUSTRY} WHERE Id = @id
  `);
  const r = result.recordset?.[0];
  if (!r) return null;
  return {
    id: r.id,
    industryName: r.industryName ?? r.IndustryName ?? '',
    industryCategory: r.industryCategory ?? r.IndustryCategory ?? 'Other',
    isActive: !!r.isActive,
    createdOn: dateToIso(r.createdOn),
    createdBy: r.createdBy ?? r.CreatedBy ?? null,
    updatedOn: dateToIsoOrNull(r.updatedOn ?? r.UpdatedOn),
    updatedBy: r.updatedBy ?? r.UpdatedBy ?? null,
  };
}

export async function createIndustry(data: IndustryCreateData, userId: number | null): Promise<number> {
  const req = await getRequest();
  req.input('name', (data.industryName || '').trim().slice(0, 200));
  req.input('category', (data.industryCategory || '').trim().slice(0, 50));
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${INDUSTRY} (IndustryName, IndustryCategory, CreatedBy)
    OUTPUT INSERTED.Id
    VALUES (@name, @category, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function updateIndustry(id: number, data: IndustryCreateData, userId: number | null): Promise<void> {
  const req = await getRequest();
  req.input('id', id);
  req.input('name', (data.industryName || '').trim().slice(0, 200));
  req.input('category', (data.industryCategory || '').trim().slice(0, 50));
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${INDUSTRY}
    SET IndustryName = @name, IndustryCategory = @category, UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE Id = @id
  `);
}

export async function toggleIndustryStatus(id: number, isActive: boolean, userId: number | null): Promise<void> {
  const req = await getRequest();
  req.input('id', id);
  req.input('isActive', isActive ? 1 : 0);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${INDUSTRY}
    SET IsActive = @isActive, UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE Id = @id
  `);
}
