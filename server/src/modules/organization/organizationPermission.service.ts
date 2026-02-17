/**
 * Branch permission service: RoleBranchScope, UserBranchAccess, UserCompanyAccess.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { RoleBranchScopeRow, UserBranchAccessRow, UserCompanyAccessRow, BranchRow } from './organization.types';

const SCHEMA = config.db.schema || 'dbo';
const ROLE_SCOPE = `[${SCHEMA}].[utbl_RoleBranchScope]`;
const USER_BRANCH = `[${SCHEMA}].[utbl_UserBranchAccess]`;
const USER_COMPANY = `[${SCHEMA}].[utbl_UserCompanyAccess]`;
const BRANCH = `[${SCHEMA}].[utbl_Branch]`;
const USER_ROLES = `[${SCHEMA}].[react_UserRoles]`;

function d2s(d: unknown): string { return d instanceof Date ? d.toISOString() : String(d ?? ''); }
function d2sn(d: unknown): string | null { return d == null ? null : (d instanceof Date ? d.toISOString() : String(d)); }

// ─── Role Branch Scope ───

export async function getRoleBranchScope(roleId: number): Promise<RoleBranchScopeRow | null> {
  const req = await getRequest();
  const result = await req.input('roleId', roleId).query(`
    SELECT Id AS id, RoleId AS roleId, ScopeType AS scopeType, IsActive AS isActive,
           CreatedOn AS createdOn, CreatedBy AS createdBy, UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
    FROM ${ROLE_SCOPE} WHERE RoleId = @roleId
  `);
  const r = (result.recordset as any[])?.[0];
  if (!r) return null;
  return { ...r, createdOn: d2s(r.createdOn), updatedOn: d2sn(r.updatedOn) };
}

export async function upsertRoleBranchScope(roleId: number, scopeType: string, userId: number | null): Promise<void> {
  const req = await getRequest();
  req.input('roleId', roleId);
  req.input('scopeType', scopeType);
  req.input('userId', userId);
  await req.query(`
    IF EXISTS (SELECT 1 FROM ${ROLE_SCOPE} WHERE RoleId = @roleId)
      UPDATE ${ROLE_SCOPE} SET ScopeType = @scopeType, UpdatedOn = GETDATE(), UpdatedBy = @userId WHERE RoleId = @roleId
    ELSE
      INSERT INTO ${ROLE_SCOPE} (RoleId, ScopeType, CreatedBy) VALUES (@roleId, @scopeType, @userId)
  `);
}

// ─── User Branch Access ───

export async function listUserBranchAccess(userId: number): Promise<(UserBranchAccessRow & { branchName: string; branchCode: string })[]> {
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`
    SELECT uba.Id AS id, uba.UserId AS userId, uba.BranchId AS branchId, uba.IsDefault AS isDefault,
           uba.IsActive AS isActive, b.BranchName AS branchName, b.BranchCode AS branchCode,
           uba.CreatedOn AS createdOn, uba.CreatedBy AS createdBy, uba.UpdatedOn AS updatedOn, uba.UpdatedBy AS updatedBy
    FROM ${USER_BRANCH} uba
    INNER JOIN ${BRANCH} b ON b.Id = uba.BranchId
    WHERE uba.UserId = @userId AND uba.IsActive = 1
    ORDER BY uba.IsDefault DESC, b.BranchName
  `);
  return (result.recordset || []).map((r: any) => ({ ...r, createdOn: d2s(r.createdOn), updatedOn: d2sn(r.updatedOn) }));
}

export async function addUserBranchAccess(data: { userId: number; branchId: number; isDefault?: boolean }, createdBy: number | null): Promise<number> {
  const req = await getRequest();
  req.input('userId', data.userId);
  req.input('branchId', data.branchId);
  req.input('isDefault', data.isDefault ? 1 : 0);
  req.input('createdBy', createdBy);
  const result = await req.query(`
    INSERT INTO ${USER_BRANCH} (UserId, BranchId, IsDefault, CreatedBy)
    OUTPUT INSERTED.Id VALUES (@userId, @branchId, @isDefault, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function removeUserBranchAccess(id: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`DELETE FROM ${USER_BRANCH} WHERE Id = @id`);
  return (result.rowsAffected[0] ?? 0) > 0;
}

// ─── User Company Access ───

export async function listUserCompanyAccess(userId: number): Promise<UserCompanyAccessRow[]> {
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`
    SELECT Id AS id, UserId AS userId, CompanyId AS companyId, IsActive AS isActive,
           CreatedOn AS createdOn, CreatedBy AS createdBy, UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
    FROM ${USER_COMPANY} WHERE UserId = @userId AND IsActive = 1
  `);
  return (result.recordset || []).map((r: any) => ({ ...r, createdOn: d2s(r.createdOn), updatedOn: d2sn(r.updatedOn) }));
}

export async function addUserCompanyAccess(data: { userId: number; companyId: number }, createdBy: number | null): Promise<number> {
  const req = await getRequest();
  req.input('userId', data.userId);
  req.input('companyId', data.companyId);
  req.input('createdBy', createdBy);
  const result = await req.query(`
    INSERT INTO ${USER_COMPANY} (UserId, CompanyId, CreatedBy)
    OUTPUT INSERTED.Id VALUES (@userId, @companyId, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function removeUserCompanyAccess(id: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`DELETE FROM ${USER_COMPANY} WHERE Id = @id`);
  return (result.rowsAffected[0] ?? 0) > 0;
}

// ─── Helpers ───

/** Get all branches a user can access. Considers role scope (ALL = all active branches) + explicit access. */
export async function getUserAccessibleBranches(userId: number): Promise<BranchRow[]> {
  const req = await getRequest();
  req.input('userId', userId);
  const result = await req.query(`
    -- Check if any of the user's roles have ALL scope
    IF EXISTS (
      SELECT 1 FROM ${USER_ROLES} ur
      INNER JOIN ${ROLE_SCOPE} rs ON rs.RoleId = ur.RoleID
      WHERE ur.UserID = @userId AND ur.RevokedAt IS NULL AND rs.ScopeType = 'ALL' AND rs.IsActive = 1
    )
      SELECT Id AS id, BranchCode AS branchCode, BranchName AS branchName, BranchType AS branchType,
             CountryId AS countryId, StateId AS stateId, City AS city, Timezone AS timezone,
             AddressLine1 AS addressLine1, AddressLine2 AS addressLine2, Pincode AS pincode,
             Phone AS phone, Email AS email, IsActive AS isActive,
             CreatedOn AS createdOn, CreatedBy AS createdBy, UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
      FROM ${BRANCH} WHERE IsActive = 1 ORDER BY BranchName
    ELSE
      SELECT b.Id AS id, b.BranchCode AS branchCode, b.BranchName AS branchName, b.BranchType AS branchType,
             b.CountryId AS countryId, b.StateId AS stateId, b.City AS city, b.Timezone AS timezone,
             b.AddressLine1 AS addressLine1, b.AddressLine2 AS addressLine2, b.Pincode AS pincode,
             b.Phone AS phone, b.Email AS email, b.IsActive AS isActive,
             b.CreatedOn AS createdOn, b.CreatedBy AS createdBy, b.UpdatedOn AS updatedOn, b.UpdatedBy AS updatedBy
      FROM ${USER_BRANCH} uba
      INNER JOIN ${BRANCH} b ON b.Id = uba.BranchId
      WHERE uba.UserId = @userId AND uba.IsActive = 1 AND b.IsActive = 1
      ORDER BY b.BranchName
  `);
  return (result.recordset || []).map((r: any) => ({ ...r, createdOn: d2s(r.createdOn), updatedOn: d2sn(r.updatedOn) }));
}

/** Check if a user can access a specific branch. */
export async function canUserAccessBranch(userId: number, branchId: number): Promise<boolean> {
  const req = await getRequest();
  req.input('userId', userId).input('branchId', branchId);
  const result = await req.query(`
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM ${USER_ROLES} ur
        INNER JOIN ${ROLE_SCOPE} rs ON rs.RoleId = ur.RoleID
        WHERE ur.UserID = @userId AND ur.RevokedAt IS NULL AND rs.ScopeType = 'ALL' AND rs.IsActive = 1
      ) THEN 1
      WHEN EXISTS (
        SELECT 1 FROM ${USER_BRANCH} uba
        WHERE uba.UserId = @userId AND uba.BranchId = @branchId AND uba.IsActive = 1
      ) THEN 1
      ELSE 0
    END AS hasAccess
  `);
  return (result.recordset as { hasAccess: number }[])?.[0]?.hasAccess === 1;
}
