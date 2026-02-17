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
const BRANCH_DEPT = `[${SCHEMA}].[utbl_BranchDepartment]`;
const USER_BRANCH = `[${SCHEMA}].[utbl_UserBranchAccess]`;

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

export async function listOrgTeams(departmentId?: number, tree = false, branchId?: number): Promise<OrgTeamRow[]> {
  const req = await getRequest();
  req.input('departmentId', departmentId ?? null);
  req.input('branchId', branchId ?? null);
  const result = await req.query(`
    SELECT Id AS id, DepartmentId AS departmentId, BranchId AS branchId, Name AS name, ParentTeamId AS parentTeamId,
           LeadUserId AS leadUserId, Level AS level, Icon AS icon, ThemeColor AS themeColor,
           CreatedAt AS createdAt, UpdatedAt AS updatedAt
    FROM ${ORG_TEAM}
    WHERE (@departmentId IS NULL OR DepartmentId = @departmentId)
      AND (@branchId IS NULL OR BranchId = @branchId)
    ORDER BY DepartmentId, Level, Name
  `);
  const rows = (result.recordset || []) as (OrgTeamRow & { createdAt: Date; updatedAt: Date | null })[];
  return rows.map((r) => ({
    ...r,
    branchId: r.branchId ?? null,
    icon: r.icon ?? null,
    themeColor: r.themeColor ?? null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : (r.updatedAt == null ? null : String(r.updatedAt)),
  }));
}

export async function getOrgTeam(id: number): Promise<OrgTeamRow | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`
    SELECT Id AS id, DepartmentId AS departmentId, BranchId AS branchId, Name AS name, ParentTeamId AS parentTeamId,
           LeadUserId AS leadUserId, Level AS level, Icon AS icon, ThemeColor AS themeColor,
           CreatedAt AS createdAt, UpdatedAt AS updatedAt
    FROM ${ORG_TEAM} WHERE Id = @id
  `);
  const r = (result.recordset as (OrgTeamRow & { createdAt: Date; updatedAt: Date | null })[])?.[0];
  if (!r) return null;
  return {
    ...r,
    branchId: r.branchId ?? null,
    icon: r.icon ?? null,
    themeColor: r.themeColor ?? null,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : (r.updatedAt == null ? null : String(r.updatedAt)),
  };
}

export async function createOrgTeam(data: { departmentId: number; name: string; parentTeamId?: number | null; leadUserId?: number | null; level: number; icon?: string | null; themeColor?: string | null; branchId?: number | null }): Promise<number> {
  const req = await getRequest();
  req.input('departmentId', data.departmentId);
  req.input('name', (data.name || '').trim().slice(0, 200));
  req.input('parentTeamId', data.parentTeamId ?? null);
  req.input('leadUserId', data.leadUserId ?? null);
  req.input('level', data.level);
  req.input('icon', (data.icon ?? '').trim().slice(0, 100) || null);
  req.input('themeColor', (data.themeColor ?? '').trim().slice(0, 20) || null);
  req.input('branchId', data.branchId ?? null);
  const result = await req.query(`
    INSERT INTO ${ORG_TEAM} (DepartmentId, Name, ParentTeamId, LeadUserId, Level, Icon, ThemeColor, BranchId) OUTPUT INSERTED.Id
    VALUES (@departmentId, @name, @parentTeamId, @leadUserId, @level, @icon, @themeColor, @branchId)
  `);
  const id = (result.recordset as { Id: number }[])?.[0]?.Id;
  if (id == null) throw new Error('Failed to create team');
  return id;
}

export async function updateOrgTeam(id: number, data: { name?: string; departmentId?: number; parentTeamId?: number | null; leadUserId?: number | null; level?: number; icon?: string | null; themeColor?: string | null; branchId?: number | null }): Promise<boolean> {
  const req = await getRequest();
  req.input('id', id);
  req.input('name', data.name !== undefined ? (data.name || '').trim().slice(0, 200) : null);
  req.input('departmentId', data.departmentId !== undefined ? data.departmentId : null);
  req.input('departmentIdProvided', data.departmentId !== undefined ? 1 : 0);
  req.input('parentTeamId', data.parentTeamId !== undefined ? data.parentTeamId : null);
  req.input('leadUserId', data.leadUserId !== undefined ? data.leadUserId : null);
  req.input('leadUserIdProvided', data.leadUserId !== undefined ? 1 : 0);
  req.input('parentTeamIdProvided', data.parentTeamId !== undefined ? 1 : 0);
  req.input('level', data.level !== undefined ? data.level : null);
  req.input('icon', data.icon !== undefined ? ((data.icon ?? '').trim().slice(0, 100) || null) : null);
  req.input('themeColor', data.themeColor !== undefined ? ((data.themeColor ?? '').trim().slice(0, 20) || null) : null);
  req.input('branchId', data.branchId !== undefined ? data.branchId : null);
  req.input('branchIdProvided', data.branchId !== undefined ? 1 : 0);
  await req.query(`
    UPDATE ${ORG_TEAM} SET
      Name = ISNULL(@name, Name),
      DepartmentId = CASE WHEN @departmentIdProvided = 1 THEN @departmentId ELSE DepartmentId END,
      ParentTeamId = CASE WHEN @departmentIdProvided = 1 THEN NULL ELSE (CASE WHEN @parentTeamIdProvided = 1 THEN @parentTeamId ELSE ParentTeamId END) END,
      LeadUserId = CASE WHEN @leadUserIdProvided = 1 THEN @leadUserId ELSE LeadUserId END,
      Level = ISNULL(@level, Level),
      Icon = ISNULL(@icon, Icon),
      ThemeColor = ISNULL(@themeColor, ThemeColor),
      BranchId = CASE WHEN @branchIdProvided = 1 THEN @branchId ELSE BranchId END,
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
    SELECT Id AS id, TeamId AS teamId, UserId AS userId, CreatedAt AS createdAt, LeftAt AS leftAt
    FROM ${ORG_MEMBER} WHERE TeamId = @teamId AND LeftAt IS NULL
  `);
  const rows = (result.recordset || []) as (OrgTeamMemberRow & { createdAt: Date; leftAt: Date | null })[];
  return rows.map((r) => ({
    ...r,
    leftAt: r.leftAt == null ? null : (r.leftAt instanceof Date ? r.leftAt.toISOString() : String(r.leftAt)),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  }));
}

/** Assign or move user to team; records tenure (sets LeftAt on current membership, inserts new). */
export async function assignUserToTeam(userId: number, teamId: number): Promise<void> {
  const req1 = await getRequest();
  await req1.input('userId', userId).query(`
    UPDATE ${ORG_MEMBER} SET LeftAt = GETDATE() WHERE UserId = @userId AND LeftAt IS NULL
  `);
  const req2 = await getRequest();
  await req2.input('teamId', teamId).input('userId', userId).query(`
    INSERT INTO ${ORG_MEMBER} (TeamId, UserId) VALUES (@teamId, @userId)
  `);
}

/** Move user to another team; records tenure. Enforces same-department rule. */
export async function moveUserToTeam(userId: number, toTeamId: number): Promise<{ success: boolean; error?: string }> {
  const toTeam = await getOrgTeam(toTeamId);
  if (!toTeam) return { success: false, error: 'Target team not found' };

  const userInfo = await getEmployeeOrgDesignationAndTeam(userId);
  if (userInfo.orgDepartmentId != null && toTeam.departmentId !== userInfo.orgDepartmentId) {
    return { success: false, error: 'Cannot move user to a team in a different department' };
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

export async function getOrgTree(departmentId?: number, teamIdsFilter: number[] | null = null, branchId?: number): Promise<{ nodes: OrgTreeNode[]; edges: { source: string; target: string }[] }> {
  const req = await getRequest();
  req.input('departmentId', departmentId ?? null);
  req.input('branchId', branchId ?? null);
  const deptResult = await req.query(`
    SELECT d.Id AS id, d.DepartmentCode AS departmentCode, d.DepartmentName AS departmentName
    FROM ${ORG_DEPT} d
    WHERE (@departmentId IS NULL OR d.Id = @departmentId) AND d.IsActive = 1
      AND (@branchId IS NULL OR EXISTS (SELECT 1 FROM ${BRANCH_DEPT} bd WHERE bd.DepartmentId = d.Id AND bd.BranchId = @branchId AND bd.IsActive = 1)
           OR EXISTS (SELECT 1 FROM ${ORG_TEAM} t WHERE t.DepartmentId = d.Id AND t.BranchId = @branchId))
    ORDER BY d.SortOrder, d.DepartmentName
  `);
  const departments = (deptResult.recordset || []) as { id: number; departmentCode: string; departmentName: string }[];
  const nodes: OrgTreeNode[] = [];
  const edges: { source: string; target: string }[] = [];
  const teamIdsSet = teamIdsFilter == null ? null : new Set(teamIdsFilter);

  type TeamRow = { id: number; name: string; parentTeamId: number | null; leadUserId: number | null; level: number; icon: string; themeColor: string };

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
    teamReq.input('branchId', branchId ?? null);
    const teamResult = await teamReq.query(`
      SELECT Id AS id, Name AS name, ParentTeamId AS parentTeamId, LeadUserId AS leadUserId, Level AS level,
             ISNULL(Icon, '') AS icon, ISNULL(ThemeColor, '') AS themeColor
      FROM ${ORG_TEAM} WHERE DepartmentId = @departmentId
        AND (@branchId IS NULL OR BranchId = @branchId)
      ORDER BY Level, Name
    `);
    const teams = (teamResult.recordset || []) as TeamRow[];
    const teamById = new Map(teams.map((t) => [t.id, t]));

    const addedTeamIds = new Set<number>();
    const teamLeadNames = new Map<number, string>();
    for (const t of teams) {
      if (t.leadUserId != null) {
        const lReq = await getRequest();
        const lRes = await lReq.input('uid', t.leadUserId).query(`SELECT Name FROM ${USERS} WHERE userid = @uid`);
        const lName = (lRes.recordset[0] as { Name?: string })?.Name;
        if (lName) teamLeadNames.set(t.id, lName);
      }
    }
    function addTeamNode(t: TeamRow, parentId: string) {
      if (teamIdsSet != null && !teamIdsSet.has(t.id)) return;
      if (addedTeamIds.has(t.id)) return;
      addedTeamIds.add(t.id);
      const teamNodeId = `team-${t.id}`;
      nodes.push({
        id: teamNodeId,
        type: 'team',
        parentId,
        data: { label: t.name, level: t.level, leadUserId: t.leadUserId, leadUserName: teamLeadNames.get(t.id) || null, icon: t.icon || undefined, themeColor: t.themeColor || undefined },
        departmentId: d.id,
        teamId: t.id,
        level: t.level,
      });
      edges.push({ source: parentId, target: teamNodeId });
    }

    const rootTeams = teams.filter((t) => t.parentTeamId == null);
    const childTeams = teams.filter((t) => t.parentTeamId != null);
    for (const t of rootTeams) addTeamNode(t, deptNodeId);
    let changed = true;
    while (changed) {
      changed = false;
      for (const t of childTeams) {
        if (addedTeamIds.has(t.id)) continue;
        const parentId = t.parentTeamId != null ? `team-${t.parentTeamId}` : null;
        if (parentId && nodes.some((n) => n.id === parentId)) {
          addTeamNode(t, parentId);
          changed = true;
        }
      }
    }

    for (const t of teams) {
      if (teamIdsSet != null && !teamIdsSet.has(t.id)) continue;
      const teamNodeId = `team-${t.id}`;
      const memReq = await getRequest();
      memReq.input('teamId', t.id);
      const memResult = await memReq.query(`
        SELECT m.UserId AS userId, u.Name AS name, des.Name AS designationName,
               p.PhotoUrl AS photoUrl, odept.DepartmentName AS departmentName,
               p.OrgDepartmentId AS orgDepartmentId
        FROM ${ORG_MEMBER} m
        INNER JOIN ${USERS} u ON u.userid = m.UserId
        LEFT JOIN ${PROFILE} p ON p.UserID = m.UserId
        LEFT JOIN ${ORG_DESIG} des ON des.Id = p.OrgDesignationId
        LEFT JOIN ${ORG_DEPT} odept ON odept.Id = p.OrgDepartmentId
        WHERE m.TeamId = @teamId AND m.LeftAt IS NULL
      `);
      const members = (memResult.recordset || []) as { userId: number; name: string; designationName: string | null; photoUrl: string | null; departmentName: string | null; orgDepartmentId: number | null }[];
      for (const m of members) {
        const userNodeId = `user-${m.userId}`;
        const isLeader = t.leadUserId === m.userId;
        nodes.push({
          id: userNodeId,
          type: 'user',
          parentId: teamNodeId,
          data: {
            label: m.name,
            designationName: m.designationName,
            departmentName: m.departmentName,
            photoUrl: m.photoUrl,
            isLeader,
          },
          userId: m.userId,
          teamId: t.id,
          departmentId: m.orgDepartmentId ?? d.id,
        });
        edges.push({ source: teamNodeId, target: userNodeId });
      }
    }
  }

  return { nodes, edges };
}

/** Users who have no current team (LeftAt IS NULL); for "unassigned" panel. Optionally filter by branchId. */
export async function listUnassignedUsers(branchId?: number): Promise<{ userId: number; name: string; departmentName: string | null; designationName: string | null; photoUrl: string | null; orgDepartmentId: number | null }[]> {
  const req = await getRequest();
  req.input('branchId', branchId ?? null);
  const result = await req.query(`
    SELECT u.userid AS userId, u.Name AS name, odept.DepartmentName AS departmentName,
           des.Name AS designationName, p.PhotoUrl AS photoUrl, p.OrgDepartmentId AS orgDepartmentId
    FROM ${USERS} u
    LEFT JOIN ${PROFILE} p ON p.UserID = u.userid
    LEFT JOIN ${ORG_DEPT} odept ON odept.Id = p.OrgDepartmentId
    LEFT JOIN ${ORG_DESIG} des ON des.Id = p.OrgDesignationId
    WHERE u.IsActive = 1
      AND NOT EXISTS (SELECT 1 FROM ${ORG_MEMBER} m WHERE m.UserId = u.userid AND m.LeftAt IS NULL)
      AND (@branchId IS NULL OR EXISTS (SELECT 1 FROM ${USER_BRANCH} ba WHERE ba.UserId = u.userid AND ba.BranchId = @branchId AND ba.IsActive = 1))
    ORDER BY u.Name
  `);
  const rows = (result.recordset || []) as { userId: number; name: string; departmentName: string | null; designationName: string | null; photoUrl: string | null; orgDepartmentId: number | null }[];
  return rows.map((r) => ({
    userId: r.userId,
    name: r.name,
    departmentName: r.departmentName ?? null,
    designationName: r.designationName ?? null,
    photoUrl: r.photoUrl ?? null,
    orgDepartmentId: r.orgDepartmentId ?? null,
  }));
}

export async function getEmployeeOrgDesignationAndTeam(userId: number): Promise<{ orgDesignationId: number | null; orgDepartmentId: number | null; teamId: number | null }> {
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`
    SELECT p.OrgDesignationId AS orgDesignationId, p.OrgDepartmentId AS orgDepartmentId,
           (SELECT TOP 1 TeamId FROM ${ORG_MEMBER} WHERE UserId = @userId AND LeftAt IS NULL) AS teamId
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
  data: { toOrgDesignationId: number; toTeamId: number; effectiveDate: string; changeType: 'Promotion' | 'Demotion' | 'Transfer' | 'BranchTransfer'; notes?: string; fromBranchId?: number | null; toBranchId?: number | null },
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
    .input('fromBranchId', data.fromBranchId ?? null)
    .input('toBranchId', data.toBranchId ?? null)
    .input('effectiveDate', data.effectiveDate)
    .input('changeType', data.changeType)
    .input('notes', (data.notes || '').trim().slice(0, 500) || null)
    .input('createdBy', createdBy)
    .query(`
      INSERT INTO ${ORG_HISTORY} (UserId, FromDesignationId, ToDesignationId, FromTeamId, ToTeamId, FromBranchId, ToBranchId, EffectiveDate, ChangeType, Notes, CreatedBy)
      VALUES (@userId, @fromDesignationId, @toDesignationId, @fromTeamId, @toTeamId, @fromBranchId, @toBranchId, @effectiveDate, @changeType, @notes, @createdBy)
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
           FromTeamId AS fromTeamId, ToTeamId AS toTeamId,
           FromBranchId AS fromBranchId, ToBranchId AS toBranchId,
           EffectiveDate AS effectiveDate, ChangeType AS changeType,
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
