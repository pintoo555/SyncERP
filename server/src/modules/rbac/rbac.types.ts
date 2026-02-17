export interface RoleRow {
  roleId: number;
  roleCode: string;
  roleName: string;
  description: string | null;
  isActive: boolean;
}

export interface PermissionRow {
  permissionId: number;
  permissionCode: string;
  permissionName: string;
  moduleName: string | null;
  description: string | null;
}

export interface UserRoleRow {
  roleId: number;
  roleCode: string;
  roleName: string;
  assignedAt: string;
  assignedBy: number | null;
}
