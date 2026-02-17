/**
 * Re-export from modules/rbac for backward compatibility.
 */
export { getPermissionsForUser, clearPermissionCache, listRoles, listPermissions, getRolePermissions, setRolePermissions, getUserRoles, assignUserRole, revokeUserRole, getUserPermissions, setUserPermissions } from '../modules/rbac/rbac.service';
export type { RoleRow, PermissionRow, UserRoleRow } from '../modules/rbac/rbac.types';
