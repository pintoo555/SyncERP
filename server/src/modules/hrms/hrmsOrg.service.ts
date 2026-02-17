/**
 * HRMS Organization structure: utbl_Org_Department, utbl_Org_Designation, utbl_Org_Team, utbl_Org_TeamMember, utbl_Org_PromotionHistory.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type {
  OrgDepartmentRow,
  OrgDesignationRow,
  OrgTeamRow,
  OrgTeamMemberRow,
  OrgPromotionHistoryRow,
  OrgTreeNode,
} from './hrms.types';

const SCHEMA = config.db.schema || 'dbo';
const ORG_DEPT = `[${SCHEMA}].[utbl_Org_Department]`;
const ORG_DESIG = `[${SCHEMA}].[utbl_Org_Designation]`;
const ORG_TEAM = `[${SCHEMA}].[utbl_Org_Team]`;
const ORG_MEMBER = `[${SCHEMA}].[utbl_Org_TeamMember]`;
const ORG_HISTORY = `[${SCHEMA}].[utbl_Org_PromotionHistory]`;
const USERS = `[${SCHEMA}].[rb_users]`;
const PROFILE = `[${SCHEMA}].[hrms_EmployeeProfile]`;

export async function listOrgDepartments(activeOnly = false): Promise<OrgDepartmentRow[]> {
  const req = await getRequest();
  req.input('activeOnly', activeOnly ? 1 : 0);
  const result = await req.query(`
    SELECT Id AS id, DepartmentCode AS departmentCode, DepartmentName AS departmentName,
           IsActive AS isActive, SortOrder AS sortOrder, CreatedAt AS createdAt, UpdatedAt AS updatedAt
    FROM ${ORG_DEPT}
    WHERE (@activeOnly = 0 OR IsActive = 1)
    ORDER BY SortOrder, DepartmentName
  `);
  const rows = (result.recordset || []) as (OrgDepartmentRow & { createdAt: Date; updatedAt: Date | null })[];
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : (r.updatedAt == null ? null : String(r.updatedAt)),
  }));
}

export async function getOrgDepartment(id: number): Promise<OrgDepartmentRow | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT Id AS id, DepartmentCode AS departmentCode, DepartmentName AS departmentName,
           IsActive AS isActive, SortOrder AS sortOrder, CreatedAt AS createdAt, UpdatedAt AS updatedAt
    FROM ${ORG_DEPT} WHERE Id = @id
  `);
  const r = (result.recordset as (OrgDepartmentRow & { createdAt: Date; updatedAt: Date | null })[])?.[0];
  if (!r) return null;
  return {
    ...r,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : (r.updatedAt == null ? null : String(r.updatedAt)),
  };
}

export async function createOrgDepartment(data: { departmentCode: string; departmentName: string; sortOrder?: number }): Promise<number> {
  const req = await getRequest();
  req.input('code', (data.departmentCode || '').trim().slice(0, 50));
  req.input('name', (data.departmentName || '').trim().slice(0, 200));
  req.input('sortOrder', data.sortOrder ?? 0);
  const result = await req.query(`
    INSERT INTO ${ORG_DEPT} (DepartmentCode, DepartmentName, IsActive, SortOrder) OUTPUT INSERTED.Id
    VALUES (@code, @name, 1, @sortOrder)
  `);
  const id = (result.recordset as { Id: number }[])?.[0]?.Id;
  if (id == null) throw new Error('Failed to create department');
  return id;
}

export async function updateOrgDepartment(id: number, data: { departmentCode?: string; departmentName?: string; isActive?: boolean; sortOrder?: number }): Promise<boolean> {
  const req = await getRequest();
  req.input('id', id);
  req.input('code', data.departmentCode !== undefined ? (data.departmentCode || '').trim().slice(0, 50) : null);
  req.input('name', data.departmentName !== undefined ? (data.departmentName || '').trim().slice(0, 200) : null);
  req.input('isActive', data.isActive !== undefined ? (data.isActive ? 1 : 0) : null);
  req.input('sortOrder', data.sortOrder !== undefined ? data.sortOrder : null);
  await req.query(`
    UPDATE ${ORG_DEPT} SET
      DepartmentCode = ISNULL(@code, DepartmentCode),
      DepartmentName = ISNULL(@name, DepartmentName),
      IsActive = ISNULL(@isActive, IsActive),
      SortOrder = ISNULL(@sortOrder, SortOrder),
      UpdatedAt = GETDATE()
    WHERE Id = @id
  `);
  return true;
}

export async function deleteOrgDepartment(id: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`DELETE FROM ${ORG_DEPT} WHERE Id = @id`);
  return (result.rowsAffected[0] ?? 0) > 0;
}

export async function listOrgDesignations(departmentId: number): Promise<OrgDesignationRow[]> {
  const req = await getRequest();
  const result = await req.input('departmentId', departmentId).query(`
    SELECT Id AS id, DepartmentId AS departmentId, Name AS name, Level AS level,
           IsLeader AS isLeader, SortOrder AS sortOrder, CreatedAt AS createdAt, UpdatedAt AS updatedAt
    FROM ${ORG_DESIG} WHERE DepartmentId = @departmentId ORDER BY SortOrder, Level, Name
  `);
  const rows = (result.recordset || []) as (OrgDesignationRow & { createdAt: Date; updatedAt: Date | null })[];
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : (r.updatedAt == null ? null : String(r.updatedAt)),
  }));
}

export async function createOrgDesignation(data: { departmentId: number; name: string; level: number; isLeader: boolean; sortOrder?: number }): Promise<number> {
  const req = await getRequest();
  req.input('departmentId', data.departmentId);
  req.input('name', (data.name || '').trim().slice(0, 200));
  req.input('level', data.level);
  req.input('isLeader', data.isLeader ? 1 : 0);
  req.input('sortOrder', data.sortOrder ?? 0);
  const result = await req.query(`
    INSERT INTO ${ORG_DESIG} (DepartmentId, Name, Level, IsLeader, SortOrder) OUTPUT INSERTED.Id
    VALUES (@departmentId, @name, @level, @isLeader, @sortOrder)
  `);
  const id = (result.recordset as { Id: number }[])?.[0]?.Id;
  if (id == null) throw new Error('Failed to create designation');
  return id;
}

export async function updateOrgDesignation(id: number, data: { name?: string; level?: number; isLeader?: boolean; sortOrder?: number }): Promise<boolean> {
  const req = await getRequest();
  req.input('id', id);
  req.input('name', data.name !== undefined ? (data.name || '').trim().slice(0, 200) : null);
  req.input('level', data.level !== undefined ? data.level : null);
  req.input('isLeader', data.isLeader !== undefined ? (data.isLeader ? 1 : 0) : null);
  req.input('sortOrder', data.sortOrder !== undefined ? data.sortOrder : null);
  await req.query(`
    UPDATE ${ORG_DESIG} SET
      Name = ISNULL(@name, Name),
      Level = ISNULL(@level, Level),
      IsLeader = ISNULL(@isLeader, IsLeader),
      SortOrder = ISNULL(@sortOrder, SortOrder),
      UpdatedAt = GETDATE()
    WHERE Id = @id
  `);
  return true;
}

export async function deleteOrgDesignation(id: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`DELETE FROM ${ORG_DESIG} WHERE Id = @id`);
  return (result.rowsAffected[0] ?? 0) > 0;
}

export async function listOrgTeams(departmentId?: number, tree = false): Promise<OrgTeamRow[]> {
  const req = await getRequest();
  req.input('departmentId', departmentId ?? null);
  const result = await req.query(`
    SELECT Id AS id, DepartmentId AS departmentId, Name AS name, ParentTeamId AS parentTeamId,
           LeadUserId AS leadUserId, Level AS level, CreatedAt AS createdAt, UpdatedAt AS updatedAt
    FROM ${ORG_TEAM}
    WHERE (@departmentId IS NULL OR DepartmentId = @departmentId)
    ORDER BY DepartmentId, Level, Name
  `);
  const rows = (result.recordset || []) as (OrgTeamRow & { createdAt: Date; updatedAt: Date | null })[];
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : (r.updatedAt == null ? null : String(r.updatedAt)),
  }));
}

export async function getOrgTeam(id: number): Promise<OrgTeamRow | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT Id AS id, DepartmentId AS departmentId, Name AS name, ParentTeamId AS parentTeamId,
           LeadUserId AS leadUserId, Level AS level, CreatedAt AS createdAt, UpdatedAt AS updatedAt
    FROM ${ORG_TEAM} WHERE Id = @id
  `);
  const r = (result.recordset as (OrgTeamRow & { createdAt: Date; updatedAt: Date | null })[])?.[0];
  if (!r) return null;
  return {
    ...r,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : (r.updatedAt == null ? null : String(r.updatedAt)),
  };
}

export async function createOrgTeam(data: { departmentId: number; name: string; parentTeamId?: number | null; leadUserId?: number | null; level: number }): Promise<number> {
  const req = await getRequest();
  req.input('departmentId', data.departmentId);
  req.input('name', (data.name || '').trim().slice(0, 200));
  req.input('parentTeamId', data.parentTeamId ?? null);
  req.input('leadUserId', data.leadUserId ?? null);
  req.input('level', data.level);
  const result = await req.query(`
    INSERT INTO ${ORG_TEAM} (DepartmentId, Name, ParentTeamId, LeadUserId, Level) OUTPUT INSERTED.Id
    VALUES (@departmentId, @name, @parentTeamId, @leadUserId, @level)
  `);
  const id = (result.recordset as { Id: number }[])?.[0]?.Id;
  if (id == null) throw new Error('Failed to create team');
  return id;
}

export async function updateOrgTeam(id: number, data: { name?: string; parentTeamId?: number | null; leadUserId?: number | null; level?: number }): Promise<boolean> {
  const req = await getRequest();
  req.input('id', id);
  req.input('name', data.name !== undefined ? (data.name || '').trim().slice(0, 200) : null);
  req.input('parentTeamId', data.parentTeamId !== undefined ? data.parentTeamId : null);
  req.input('leadUserId', data.leadUserId !== undefined ? data.leadUserId : null);
  req.input('leadUserIdProvided', data.leadUserId !== undefined ? 1 : 0);
  req.input('parentTeamIdProvided', data.parentTeamId !== undefined ? 1 : 0);
  req.input('level', data.level !== undefined ? data.level : null);
  await req.query(`
    UPDATE ${ORG_TEAM} SET
      Name = ISNULL(@name, Name),
      ParentTeamId = CASE WHEN @parentTeamIdProvided = 1 THEN @parentTeamId ELSE ParentTeamId END,
      LeadUserId = CASE WHEN @leadUserIdProvided = 1 THEN @leadUserId ELSE LeadUserId END,
      Level = ISNULL(@level, Level),
      UpdatedAt = GETDATE()
    WHERE Id = @id
  `);
  return true;
}

export async function deleteOrgTeam(id: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`DELETE FROM ${ORG_TEAM} WHERE Id = @id`);
  return (result.rowsAffected[0] ?? 0) > 0;
}

export async function listOrgTeamMembers(teamId: number): Promise<OrgTeamMemberRow[]> {
  const req = await getRequest();
  const result = await req.input('teamId', teamId).query(`
    SELECT Id AS id, TeamId AS teamId, UserId AS userId, CreatedAt AS createdAt
    FROM ${ORG_MEMBER} WHERE TeamId = @teamId
  `);
  const rows = (result.recordset || []) as (OrgTeamMemberRow & { createdAt: Date })[];
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }));
}

/** One team per user: assign or move user to team (replaces any existing membership). */
export async function assignUserToTeam(userId: number, teamId: number): Promise<void> {
  const req = await getRequest();
  await req.input('userId', userId).input('teamId', teamId).query(`
    MERGE ${ORG_MEMBER} AS t
    USING (SELECT @userId AS UserId, @teamId AS TeamId) AS s ON t.UserId = s.UserId
    WHEN MATCHED THEN UPDATE SET TeamId = s.TeamId
    WHEN NOT MATCHED THEN INSERT (TeamId, UserId) VALUES (s.TeamId, s.UserId);
  `);
}

/** Move user to another team; validates same designation level. Returns error message or null. */
export async function moveUserToTeam(userId: number, toTeamId: number): Promise<{ success: boolean; error?: string }> {
  const toTeam = await getOrgTeam(toTeamId);
  if (!toTeam) return { success: false, error: 'Target team not found' };
  const req = await getRequest();
  const current = await req.input('userId', userId).query(`
    SELECT m.TeamId AS teamId, t.Level AS level FROM ${ORG_MEMBER} m
    INNER JOIN ${ORG_TEAM} t ON t.Id = m.TeamId WHERE m.UserId = @userId
  `);
  const currentRow = (current.recordset as { teamId: number; level: number }[])?.[0];
  const userLevel = currentRow?.level;
  if (userLevel != null && toTeam.level !== userLevel) {
    return { success: false, error: 'User can only be moved to a team at the same designation level' };
  }
  await assignUserToTeam(userId, toTeamId);
  return { success: true };
}

/** Team IDs the current user can see: all if hasHrmsEdit, else teams where user is lead. */
export async function getTeamsForCurrentUser(userId: number, hasHrmsEdit: boolean): Promise<number[] | null> {
  if (hasHrmsEdit) return null;
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`
    SELECT Id FROM ${ORG_TEAM} WHERE LeadUserId = @userId
  `);
  const rows = (result.recordset as { Id: number }[]) || [];
  return rows.map((r) => r.Id);
}

export async function getOrgTree(departmentId?: number, teamIdsFilter: number[] | null = null): Promise<{ nodes: OrgTreeNode[]; edges: { source: string; target: string }[] }> {
  const req = await getRequest();
  req.input('departmentId', departmentId ?? null);
  const deptResult = await req.query(`
    SELECT Id AS id, DepartmentCode AS departmentCode, DepartmentName AS departmentName
    FROM ${ORG_DEPT} WHERE (@departmentId IS NULL OR Id = @departmentId) AND IsActive = 1 ORDER BY SortOrder, DepartmentName
  `);
  const departments = (deptResult.recordset || []) as { id: number; departmentCode: string; departmentName: string }[];
  const nodes: OrgTreeNode[] = [];
  const edges: { source: string; target: string }[] = [];

  for (const d of departments) {
    const deptNodeId = `dept-${d.id}`;
    nodes.push({
      id: deptNodeId,
      type: 'department',
      parentId: null,
      data: { label: d.departmentName, code: d.departmentCode },
      departmentId: d.id,
    });

    const teamReq = await getRequest();
    teamReq.input('departmentId', d.id);
    const teamResult = await teamReq.query(`
      SELECT Id AS id, Name AS name, ParentTeamId AS parentTeamId, LeadUserId AS leadUserId, Level AS level
      FROM ${ORG_TEAM} WHERE DepartmentId = @departmentId ORDER BY Level, Name
    `);
    const teams = (teamResult.recordset || []) as { id: number; name: string; parentTeamId: number | null; leadUserId: number | null; level: number }[];

    const teamIdsSet = teamIdsFilter == null ? null : new Set(teamIdsFilter);

    for (const t of teams) {
      if (teamIdsSet != null && !teamIdsSet.has(t.id)) continue;
      const teamNodeId = `team-${t.id}`;
      nodes.push({
        id: teamNodeId,
        type: 'team',
        parentId: deptNodeId,
        data: { label: t.name, level: t.level, leadUserId: t.leadUserId },
        departmentId: d.id,
        teamId: t.id,
        level: t.level,
      });
      edges.push({ source: deptNodeId, target: teamNodeId });

      const memReq = await getRequest();
      memReq.input('teamId', t.id);
      const memResult = await memReq.query(`
        SELECT m.UserId AS userId, u.Name AS name, p.OrgDesignationId AS orgDesignationId, des.Name AS designationName
        FROM ${ORG_MEMBER} m
        INNER JOIN ${USERS} u ON u.userid = m.UserId
        LEFT JOIN ${PROFILE} p ON p.UserID = m.UserId
        LEFT JOIN ${ORG_DESIG} des ON des.Id = p.OrgDesignationId
        WHERE m.TeamId = @teamId
      `);
      const members = (memResult.recordset || []) as { userId: number; name: string; orgDesignationId: number | null; designationName: string | null }[];
      for (const m of members) {
        const userNodeId = `user-${m.userId}`;
        nodes.push({
          id: userNodeId,
          type: 'user',
          parentId: teamNodeId,
          data: { label: m.name, designationName: m.designationName },
          userId: m.userId,
          teamId: t.id,
        });
        edges.push({ source: teamNodeId, target: userNodeId });
      }
    }
  }

  return { nodes, edges };
}

export async function getEmployeeOrgDesignationAndTeam(userId: number): Promise<{ orgDesignationId: number | null; orgDepartmentId: number | null; teamId: number | null }> {
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`
    SELECT p.OrgDesignationId AS orgDesignationId, p.OrgDepartmentId AS orgDepartmentId,
           (SELECT TOP 1 TeamId FROM ${ORG_MEMBER} WHERE UserId = @userId) AS teamId
    FROM ${PROFILE} p WHERE p.UserID = @userId
  `);
  const r = (result.recordset as { orgDesignationId: number | null; orgDepartmentId: number | null; teamId: number | null }[])?.[0];
  return {
    orgDesignationId: r?.orgDesignationId ?? null,
    orgDepartmentId: r?.orgDepartmentId ?? null,
    teamId: r?.teamId ?? null,
  };
}

export async function getDesignationLevel(orgDesignationId: number): Promise<number | null> {
  const req = await getRequest();
  const result = await req.input('id', orgDesignationId).query(`SELECT Level AS level FROM ${ORG_DESIG} WHERE Id = @id`);
  const r = (result.recordset as { level: number }[])?.[0];
  return r?.level ?? null;
}

export async function recordPromotion(
  userId: number,
  data: { toOrgDesignationId: number; toTeamId: number; effectiveDate: string; changeType: 'Promotion' | 'Demotion' | 'Transfer'; notes?: string },
  createdBy: number
): Promise<void> {
  const req = await getRequest();
  const current = await getEmployeeOrgDesignationAndTeam(userId);
  await req
    .input('userId', userId)
    .input('fromDesignationId', current.orgDesignationId)
    .input('toDesignationId', data.toOrgDesignationId)
    .input('fromTeamId', current.teamId)
    .input('toTeamId', data.toTeamId)
    .input('effectiveDate', data.effectiveDate)
    .input('changeType', data.changeType)
    .input('notes', (data.notes || '').trim().slice(0, 500) || null)
    .input('createdBy', createdBy)
    .query(`
      INSERT INTO ${ORG_HISTORY} (UserId, FromDesignationId, ToDesignationId, FromTeamId, ToTeamId, EffectiveDate, ChangeType, Notes, CreatedBy)
      VALUES (@userId, @fromDesignationId, @toDesignationId, @fromTeamId, @toTeamId, @effectiveDate, @changeType, @notes, @createdBy)
    `);

  const upReq = await getRequest();
  const desigReq = await getRequest();
  const desigRow = await desigReq.input('id', data.toOrgDesignationId).query(`SELECT DepartmentId FROM ${ORG_DESIG} WHERE Id = @id`);
  const deptId = (desigRow.recordset as { DepartmentId: number }[])?.[0]?.DepartmentId ?? null;
  await upReq
    .input('userId', userId)
    .input('orgDesignationId', data.toOrgDesignationId)
    .input('orgDepartmentId', deptId)
    .query(`
      UPDATE ${PROFILE} SET OrgDesignationId = @orgDesignationId, OrgDepartmentId = @orgDepartmentId, UpdatedAt = GETDATE() WHERE UserID = @userId
    `);

  await assignUserToTeam(userId, data.toTeamId);
}

export async function listPromotionHistory(userId: number): Promise<OrgPromotionHistoryRow[]> {
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`
    SELECT Id AS id, UserId AS userId, FromDesignationId AS fromDesignationId, ToDesignationId AS toDesignationId,
           FromTeamId AS fromTeamId, ToTeamId AS toTeamId, EffectiveDate AS effectiveDate, ChangeType AS changeType,
           Notes AS notes, CreatedAt AS createdAt, CreatedBy AS createdBy
    FROM ${ORG_HISTORY} WHERE UserId = @userId ORDER BY EffectiveDate DESC, CreatedAt DESC
  `);
  const rows = (result.recordset || []) as (OrgPromotionHistoryRow & { effectiveDate: Date; createdAt: Date })[];
  return rows.map((r) => ({
    ...r,
    effectiveDate: r.effectiveDate instanceof Date ? r.effectiveDate.toISOString().slice(0, 10) : String(r.effectiveDate),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }));
}
