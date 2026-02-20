import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { LeadSource, LeadSourceCreate, LeadSourceUpdate } from './leads.types';

const SCHEMA = config.db.schema || 'dbo';
const SOURCE = `[${SCHEMA}].[utbl_Leads_Source]`;

function mapRow(r: any): LeadSource {
  return {
    sourceId: r.sourceId ?? r.SourceId,
    sourceName: r.sourceName ?? r.SourceName ?? '',
    sourceCategory: r.sourceCategory ?? r.SourceCategory ?? '',
    isActive: !!(r.isActive ?? r.IsActive),
  };
}

export async function getAllSources(includeInactive?: boolean): Promise<LeadSource[]> {
  const req = await getRequest();
  req.input('all', includeInactive ? 1 : 0);
  const result = await req.query(`
    SELECT SourceId AS sourceId, SourceName AS sourceName,
           SourceCategory AS sourceCategory, IsActive AS isActive
    FROM ${SOURCE}
    WHERE (@all = 1 OR IsActive = 1)
    ORDER BY SourceName
  `);
  return (result.recordset || []).map(mapRow);
}

export async function getSourceById(id: number): Promise<LeadSource | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT SourceId AS sourceId, SourceName AS sourceName,
           SourceCategory AS sourceCategory, IsActive AS isActive
    FROM ${SOURCE}
    WHERE SourceId = @id
  `);
  const r = result.recordset?.[0];
  return r ? mapRow(r) : null;
}

export async function createSource(data: LeadSourceCreate, userId: number | null): Promise<number> {
  const req = await getRequest();
  req.input('name', (data.sourceName || '').trim().slice(0, 100));
  req.input('category', (data.sourceCategory || '').trim().slice(0, 50));
  req.input('createdBy', userId);

  const result = await req.query(`
    DECLARE @out TABLE (SourceId INT);
    INSERT INTO ${SOURCE}
      (SourceName, SourceCategory, CreatedBy)
    OUTPUT INSERTED.SourceId INTO @out
    VALUES (@name, @category, @createdBy);
    SELECT SourceId FROM @out;
  `);
  return (result.recordset as { SourceId: number }[])[0].SourceId;
}

export async function updateSource(id: number, data: LeadSourceUpdate, userId: number | null): Promise<void> {
  const sets: string[] = [];
  const req = await getRequest();
  req.input('id', id);

  if (data.sourceName !== undefined) {
    req.input('name', data.sourceName.trim().slice(0, 100));
    sets.push('SourceName = @name');
  }
  if (data.sourceCategory !== undefined) {
    req.input('category', data.sourceCategory.trim().slice(0, 50));
    sets.push('SourceCategory = @category');
  }
  if (data.isActive !== undefined) {
    req.input('isActive', data.isActive ? 1 : 0);
    sets.push('IsActive = @isActive');
  }

  if (sets.length === 0) return;

  req.input('updatedBy', userId);
  sets.push('UpdatedOn = GETDATE()', 'UpdatedBy = @updatedBy');

  await req.query(`
    UPDATE ${SOURCE}
    SET ${sets.join(', ')}
    WHERE SourceId = @id
  `);
}

export async function toggleSourceStatus(id: number, isActive: boolean, userId: number | null): Promise<void> {
  const req = await getRequest();
  req.input('id', id);
  req.input('isActive', isActive ? 1 : 0);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${SOURCE}
    SET IsActive = @isActive, UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE SourceId = @id
  `);
}
