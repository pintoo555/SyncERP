/**
 * Client Relationship service: link, merge, aliases.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { RelationshipRow, ClientRow } from './clients.types';

const SCHEMA = config.db.schema || 'dbo';
const REL = `[${SCHEMA}].[utbl_ClientRelationship]`;
const CLIENT = `[${SCHEMA}].[utbl_Client]`;

function dateToIso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : String(d ?? '');
}
function dateToIsoOrNull(d: unknown): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

export async function getRelationships(clientId: number): Promise<RelationshipRow[]> {
  const req = await getRequest();
  req.input('clientId', clientId);
  const result = await req.query(`
    SELECT r.Id AS id, r.ParentClientId AS parentClientId, p.ClientName AS parentClientName,
           r.ChildClientId AS childClientId, ch.ClientName AS childClientName,
           r.RelationshipType AS relationshipType, r.EffectiveFrom AS effectiveFrom,
           r.EffectiveTo AS effectiveTo, r.Remarks AS remarks, r.IsActive AS isActive,
           r.CreatedOn AS createdOn, r.CreatedBy AS createdBy
    FROM ${REL} r
    JOIN ${CLIENT} p ON p.Id = r.ParentClientId
    JOIN ${CLIENT} ch ON ch.Id = r.ChildClientId
    WHERE (r.ParentClientId = @clientId OR r.ChildClientId = @clientId)
    ORDER BY r.EffectiveFrom DESC
  `);
  return (result.recordset || []).map((row: any) => ({
    ...row,
    effectiveFrom: dateToIso(row.effectiveFrom),
    effectiveTo: dateToIsoOrNull(row.effectiveTo),
    createdOn: dateToIso(row.createdOn),
  }));
}

export async function linkClients(
  parentClientId: number,
  childClientId: number,
  relationshipType: string,
  effectiveFrom: string,
  remarks: string | null,
  userId: number | null
): Promise<number> {
  const req = await getRequest();
  req.input('parentId', parentClientId);
  req.input('childId', childClientId);
  req.input('type', relationshipType.trim().slice(0, 30));
  req.input('from', effectiveFrom);
  req.input('remarks', remarks ? remarks.trim().slice(0, 500) : null);
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${REL}
      (ParentClientId, ChildClientId, RelationshipType, EffectiveFrom, Remarks, CreatedBy)
    OUTPUT INSERTED.Id
    VALUES (@parentId, @childId, @type, @from, @remarks, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

/**
 * Merge source client into target client:
 * 1. Set source IsMerged=1, MergedIntoClientId=target
 * 2. Create bidirectional relationship MergedWith
 */
export async function mergeClients(
  sourceClientId: number,
  targetClientId: number,
  remarks: string | null,
  userId: number | null
): Promise<void> {
  const req = await getRequest();
  req.input('sourceId', sourceClientId);
  req.input('targetId', targetClientId);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${CLIENT}
    SET IsMerged = 1, MergedIntoClientId = @targetId, IsActive = 0,
        UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE Id = @sourceId
  `);

  await linkClients(sourceClientId, targetClientId, 'MergedWith', new Date().toISOString().slice(0, 10), remarks, userId);
}

/**
 * Get aliases/history for a client: follow rename/merge chains.
 */
export async function getAliases(clientId: number): Promise<RelationshipRow[]> {
  const req = await getRequest();
  req.input('clientId', clientId);
  const result = await req.query(`
    SELECT r.Id AS id, r.ParentClientId AS parentClientId, p.ClientName AS parentClientName,
           r.ChildClientId AS childClientId, ch.ClientName AS childClientName,
           r.RelationshipType AS relationshipType, r.EffectiveFrom AS effectiveFrom,
           r.EffectiveTo AS effectiveTo, r.Remarks AS remarks, r.IsActive AS isActive,
           r.CreatedOn AS createdOn, r.CreatedBy AS createdBy
    FROM ${REL} r
    JOIN ${CLIENT} p ON p.Id = r.ParentClientId
    JOIN ${CLIENT} ch ON ch.Id = r.ChildClientId
    WHERE (r.ParentClientId = @clientId OR r.ChildClientId = @clientId)
      AND r.RelationshipType IN ('RenamedTo','RenamedFrom','MergedWith')
    ORDER BY r.EffectiveFrom DESC
  `);
  return (result.recordset || []).map((row: any) => ({
    ...row,
    effectiveFrom: dateToIso(row.effectiveFrom),
    effectiveTo: dateToIsoOrNull(row.effectiveTo),
    createdOn: dateToIso(row.createdOn),
  }));
}
