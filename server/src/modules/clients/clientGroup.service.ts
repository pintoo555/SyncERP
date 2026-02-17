/**
 * Client Group service: groups and member CRUD.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { GroupRow, GroupCreateData, GroupMemberRow, GroupMemberAddData } from './clients.types';

const SCHEMA = config.db.schema || 'dbo';
const GRP = `[${SCHEMA}].[utbl_ClientGroup]`;
const MEM = `[${SCHEMA}].[utbl_ClientGroupMember]`;
const CLIENT = `[${SCHEMA}].[utbl_Client]`;
const INDUSTRY = `[${SCHEMA}].[utbl_Industry]`;

function dateToIso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : String(d ?? '');
}
function dateToIsoOrNull(d: unknown): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

export async function listGroups(activeOnly = false): Promise<GroupRow[]> {
  const req = await getRequest();
  req.input('activeOnly', activeOnly ? 1 : 0);
  const result = await req.query(`
    SELECT g.Id AS id, g.GroupCode AS groupCode, g.GroupName AS groupName,
           g.IndustryId AS industryId, i.IndustryName AS industryName,
           g.IsActive AS isActive, g.CreatedOn AS createdOn, g.CreatedBy AS createdBy,
           g.UpdatedOn AS updatedOn, g.UpdatedBy AS updatedBy
    FROM ${GRP} g
    LEFT JOIN ${INDUSTRY} i ON i.Id = g.IndustryId
    WHERE (@activeOnly = 0 OR g.IsActive = 1)
    ORDER BY g.GroupName
  `);
  return (result.recordset || []).map((r: any) => ({
    ...r,
    createdOn: dateToIso(r.createdOn),
    updatedOn: dateToIsoOrNull(r.updatedOn),
  }));
}

export async function getGroup(id: number): Promise<GroupRow | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT g.Id AS id, g.GroupCode AS groupCode, g.GroupName AS groupName,
           g.IndustryId AS industryId, i.IndustryName AS industryName,
           g.IsActive AS isActive, g.CreatedOn AS createdOn, g.CreatedBy AS createdBy,
           g.UpdatedOn AS updatedOn, g.UpdatedBy AS updatedBy
    FROM ${GRP} g
    LEFT JOIN ${INDUSTRY} i ON i.Id = g.IndustryId
    WHERE g.Id = @id
  `);
  const row = result.recordset?.[0];
  if (!row) return null;
  return { ...row, createdOn: dateToIso(row.createdOn), updatedOn: dateToIsoOrNull(row.updatedOn) };
}

export async function createGroup(data: GroupCreateData, userId: number | null): Promise<number> {
  const req = await getRequest();
  req.input('name', (data.groupName || '').trim().slice(0, 200));
  req.input('industryId', data.industryId ?? null);
  req.input('createdBy', userId);

  // Insert with a temp unique GroupCode, then update it to 'CG' + zero-padded Id
  const result = await req.query(`
    DECLARE @out TABLE (Id BIGINT);

    INSERT INTO ${GRP} (GroupCode, GroupName, IndustryId, CreatedBy)
    OUTPUT INSERTED.Id INTO @out
    VALUES (LEFT(CAST(NEWID() AS NVARCHAR(36)), 20), @name, @industryId, @createdBy);

    DECLARE @newId BIGINT = (SELECT Id FROM @out);

    UPDATE ${GRP}
    SET GroupCode = 'CG' + RIGHT('000000' + CAST(@newId AS VARCHAR(20)), 6)
    WHERE Id = @newId;

    SELECT @newId AS Id;
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function getGroupMembers(groupId: number, activeOnly = false): Promise<GroupMemberRow[]> {
  const req = await getRequest();
  req.input('groupId', groupId);
  req.input('activeOnly', activeOnly ? 1 : 0);
  const result = await req.query(`
    SELECT m.Id AS id, m.GroupId AS groupId, m.ClientId AS clientId,
           c.ClientCode AS clientCode, c.ClientName AS clientName,
           m.RoleInGroup AS roleInGroup, m.IsActive AS isActive,
           m.CreatedOn AS createdOn, m.CreatedBy AS createdBy
    FROM ${MEM} m
    JOIN ${CLIENT} c ON c.Id = m.ClientId
    WHERE m.GroupId = @groupId AND (@activeOnly = 0 OR m.IsActive = 1)
    ORDER BY m.RoleInGroup, c.ClientName
  `);
  return (result.recordset || []).map((r: any) => ({
    ...r,
    createdOn: dateToIso(r.createdOn),
  }));
}

export async function addGroupMember(groupId: number, data: GroupMemberAddData, userId: number | null): Promise<number> {
  const req = await getRequest();
  req.input('groupId', groupId);
  req.input('clientId', data.clientId);
  req.input('role', (data.roleInGroup || 'Other').trim().slice(0, 30));
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${MEM} (GroupId, ClientId, RoleInGroup, CreatedBy)
    OUTPUT INSERTED.Id
    VALUES (@groupId, @clientId, @role, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function toggleMemberStatus(memberId: number, isActive: boolean, userId: number | null): Promise<void> {
  const req = await getRequest();
  req.input('id', memberId);
  req.input('isActive', isActive ? 1 : 0);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${MEM}
    SET IsActive = @isActive, UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE Id = @id
  `);
}
