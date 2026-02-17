/**
 * RBAC service – roles, permissions, user-role assignment.
 */

import { getRequest } from '../../config/db';
import type { RoleRow, PermissionRow, UserRoleRow } from './rbac.types';

const PERMISSION_CACHE = new Map<number, { perms: string[]; ts: number }>();
const CACHE_TTL_MS = 60 * 1000;

export async function getPermissionsForUser(userId: number): Promise<string[]> {
  const cached = PERMISSION_CACHE.get(userId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.perms;
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`
    SELECT p.PermissionCode FROM react_Permissions p
    INNER JOIN react_RolePermissions rp ON rp.PermissionID = p.PermissionID
    INNER JOIN react_UserRoles ur ON ur.RoleID = rp.RoleID AND ur.UserID = @userId AND ur.RevokedAt IS NULL
    WHERE p.IsActive = 1
    UNION
    SELECT p.PermissionCode FROM react_Permissions p
    INNER JOIN react_UserPermissions up ON up.PermissionID = p.PermissionID AND up.UserID = @userId
    WHERE p.IsActive = 1
  `);
  const perms = [...new Set((result.recordset as { PermissionCode: string }[]).map(r => r.PermissionCode))];
  PERMISSION_CACHE.set(userId, { perms, ts: Date.now() });
  return perms;
}

export function clearPermissionCache(userId?: number): void {
  if (userId) PERMISSION_CACHE.delete(userId);
  else PERMISSION_CACHE.clear();
}

export async function listRoles(): Promise<RoleRow[]> {
  const req = await getRequest();
  const result = await req.query(`SELECT RoleID AS roleId, RoleCode AS roleCode, RoleName AS roleName, Description AS description, IsActive AS isActive FROM react_Roles WHERE IsActive = 1 ORDER BY RoleCode`);
  return (result.recordset || []) as RoleRow[];
}

export async function listPermissions(): Promise<PermissionRow[]> {
  const req = await getRequest();
  const result = await req.query(`SELECT PermissionID AS permissionId, PermissionCode AS permissionCode, PermissionName AS permissionName, ModuleName AS moduleName, Description AS description FROM react_Permissions WHERE IsActive = 1 ORDER BY ModuleName, PermissionCode`);
  return (result.recordset || []) as PermissionRow[];
}

export async function getRolePermissions(roleId: number): Promise<number[]> {
  const req = await getRequest();
  const result = await req.input('roleId', roleId).query(`SELECT PermissionID AS permissionId FROM react_RolePermissions WHERE RoleID = @roleId`);
  return (result.recordset || []).map((r: { permissionId: number }) => r.permissionId);
}

export async function setRolePermissions(roleId: number, permissionIds: number[], updatedBy: number): Promise<void> {
  const req = await getRequest();
  await req.input('roleId', roleId).input('updatedBy', updatedBy).query(`DELETE FROM react_RolePermissions WHERE RoleID = @roleId`);
  for (const pid of permissionIds) {
    const r = await getRequest();
    await r.input('roleId', roleId).input('permissionId', pid).input('grantedBy', updatedBy).query(`INSERT INTO react_RolePermissions (RoleID, PermissionID, GrantedBy) VALUES (@roleId, @permissionId, @grantedBy)`);
  }
  clearPermissionCache();
}

export async function getUserRoles(userId: number): Promise<UserRoleRow[]> {
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`
    SELECT r.RoleID AS roleId, r.RoleCode AS roleCode, r.RoleName AS roleName, ur.AssignedAt AS assignedAt, ur.AssignedBy AS assignedBy
    FROM react_Roles r INNER JOIN react_UserRoles ur ON ur.RoleID = r.RoleID AND ur.UserID = @userId AND ur.RevokedAt IS NULL
    WHERE r.IsActive = 1 ORDER BY r.RoleCode
  `);
  return (result.recordset || []) as UserRoleRow[];
}

export async function assignUserRole(userId: number, roleId: number, assignedBy: number): Promise<void> {
  const req = await getRequest();
  await req.input('userId', userId).input('roleId', roleId).input('assignedBy', assignedBy).query(`
    UPDATE react_UserRoles SET RevokedAt = NULL, RevokedBy = NULL, AssignedAt = GETDATE(), AssignedBy = @assignedBy WHERE UserID = @userId AND RoleID = @roleId
  `);
  const req2 = await getRequest();
  await req2.input('userId', userId).input('roleId', roleId).input('assignedBy', assignedBy).query(`
    INSERT INTO react_UserRoles (UserID, RoleID, AssignedBy) SELECT @userId, @roleId, @assignedBy WHERE NOT EXISTS (SELECT 1 FROM react_UserRoles WHERE UserID = @userId AND RoleID = @roleId)
  `);
  clearPermissionCache(userId);
}

export async function revokeUserRole(userId: number, roleId: number, revokedBy: number): Promise<void> {
  const req = await getRequest();
  await req.input('userId', userId).input('roleId', roleId).input('revokedBy', revokedBy).query(`
    UPDATE react_UserRoles SET RevokedAt = GETDATE(), RevokedBy = @revokedBy WHERE UserID = @userId AND RoleID = @roleId AND RevokedAt IS NULL
  `);
  clearPermissionCache(userId);
}

export async function bulkAssignRoles(userIds: number[], roleIds: number[], assignedBy: number): Promise<{ assigned: number }> {
  let count = 0;
  for (const userId of userIds) {
    for (const roleId of roleIds) {
      await assignUserRole(userId, roleId, assignedBy);
      count += 1;
    }
  }
  return { assigned: count };
}

export async function bulkRevokeRoles(userIds: number[], roleIds: number[], revokedBy: number): Promise<{ revoked: number }> {
  let count = 0;
  for (const userId of userIds) {
    for (const roleId of roleIds) {
      await revokeUserRole(userId, roleId, revokedBy);
      count += 1;
    }
  }
  return { revoked: count };
}

export async function bulkAddPermissions(userIds: number[], permissionIds: number[], updatedBy: number): Promise<{ updated: number }> {
  let updated = 0;
  for (const userId of userIds) {
    const existing = await getUserPermissions(userId);
    const merged = [...new Set([...existing, ...permissionIds])];
    await setUserPermissions(userId, merged, updatedBy);
    updated += 1;
  }
  return { updated };
}

export async function getUserPermissions(userId: number): Promise<number[]> {
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`SELECT PermissionID AS permissionId FROM react_UserPermissions WHERE UserID = @userId`);
  return (result.recordset || []).map((r: { permissionId: number }) => r.permissionId);
}

export async function setUserPermissions(userId: number, permissionIds: number[], updatedBy: number): Promise<void> {
  const req = await getRequest();
  await req.input('userId', userId).input('updatedBy', updatedBy).query(`DELETE FROM react_UserPermissions WHERE UserID = @userId`);
  for (const pid of permissionIds) {
    const r = await getRequest();
    await r.input('userId', userId).input('permissionId', pid).input('grantedBy', updatedBy).query(`INSERT INTO react_UserPermissions (UserID, PermissionID, GrantedBy) VALUES (@userId, @permissionId, @grantedBy)`);
  }
  clearPermissionCache(userId);
}

export interface AuditUserRow {
  userId: number;
  name: string;
  email: string;
  roles: { roleId: number; roleCode: string; roleName: string }[];
  permissionOverrides: { permissionId: number; permissionCode: string; permissionName: string; moduleName: string | null }[];
}

export async function getAuditOverview(): Promise<AuditUserRow[]> {
  const req1 = await getRequest();
  const usersResult = await req1.query(`SELECT UserID AS userId, Name AS name, Email AS email FROM rb_users WHERE IsActive = 1 ORDER BY Name`);
  const users = (usersResult.recordset || []) as { userId: number; name: string; email: string }[];

  const req2 = await getRequest();
  const rolesResult = await req2.query(`
    SELECT ur.UserID AS userId, r.RoleID AS roleId, r.RoleCode AS roleCode, r.RoleName AS roleName
    FROM react_UserRoles ur
    INNER JOIN react_Roles r ON r.RoleID = ur.RoleID AND r.IsActive = 1
    WHERE ur.RevokedAt IS NULL
    ORDER BY ur.UserID, r.RoleCode
  `);
  const roleRows = (rolesResult.recordset || []) as { userId: number; roleId: number; roleCode: string; roleName: string }[];

  const req3 = await getRequest();
  const permsResult = await req3.query(`
    SELECT up.UserID AS userId, p.PermissionID AS permissionId, p.PermissionCode AS permissionCode,
           p.PermissionName AS permissionName, p.ModuleName AS moduleName
    FROM react_UserPermissions up
    INNER JOIN react_Permissions p ON p.PermissionID = up.PermissionID AND p.IsActive = 1
    ORDER BY up.UserID, p.ModuleName, p.PermissionCode
  `);
  const permRows = (permsResult.recordset || []) as { userId: number; permissionId: number; permissionCode: string; permissionName: string; moduleName: string | null }[];

  const rolesByUser = new Map<number, typeof roleRows>();
  for (const r of roleRows) {
    if (!rolesByUser.has(r.userId)) rolesByUser.set(r.userId, []);
    rolesByUser.get(r.userId)!.push(r);
  }

  const permsByUser = new Map<number, typeof permRows>();
  for (const p of permRows) {
    if (!permsByUser.has(p.userId)) permsByUser.set(p.userId, []);
    permsByUser.get(p.userId)!.push(p);
  }

  return users.map((u) => ({
    userId: u.userId,
    name: u.name,
    email: u.email,
    roles: (rolesByUser.get(u.userId) || []).map(({ roleId, roleCode, roleName }) => ({ roleId, roleCode, roleName })),
    permissionOverrides: (permsByUser.get(u.userId) || []).map(({ permissionId, permissionCode, permissionName, moduleName }) => ({ permissionId, permissionCode, permissionName, moduleName })),
  }));
}
