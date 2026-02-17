-- Synchronics Asset Management System
-- Idempotent seed: Roles and Permissions
-- Run after migrations 001_rbac.sql

SET NOCOUNT ON;

-- ========== PERMISSIONS ==========
-- Insert permission only if not exists (by PermissionCode)

DECLARE @Perms TABLE (PermissionCode NVARCHAR(100));
INSERT INTO @Perms (PermissionCode) VALUES
('AUTH.LOGIN'),('AUTH.LOGOUT'),
('DASH.VIEW_ADMIN'),('DASH.VIEW_DEPT'),('DASH.VIEW_SELF'),
('USERS.VIEW'),('USERS.SEARCH'),
('RBAC.ROLES.VIEW'),('RBAC.ROLES.CREATE'),('RBAC.ROLES.EDIT'),('RBAC.ROLES.DELETE'),
('RBAC.PERMISSIONS.VIEW'),('RBAC.USERROLES.VIEW'),('RBAC.USERROLES.ASSIGN'),('RBAC.USERROLES.REVOKE'),
('MASTERS.CAT.VIEW'),('MASTERS.CAT.CREATE'),('MASTERS.CAT.EDIT'),('MASTERS.CAT.DELETE'),
('MASTERS.BRAND.VIEW'),('MASTERS.BRAND.CREATE'),('MASTERS.BRAND.EDIT'),('MASTERS.BRAND.DELETE'),
('MASTERS.MODEL.VIEW'),('MASTERS.MODEL.CREATE'),('MASTERS.MODEL.EDIT'),('MASTERS.MODEL.DELETE'),
('MASTERS.VENDOR.VIEW'),('MASTERS.VENDOR.CREATE'),('MASTERS.VENDOR.EDIT'),('MASTERS.VENDOR.DELETE'),
('MASTERS.LOC.VIEW'),('MASTERS.LOC.CREATE'),('MASTERS.LOC.EDIT'),('MASTERS.LOC.DELETE'),
('ASSET.VIEW'),('ASSET.SEARCH'),('ASSET.CREATE'),('ASSET.EDIT'),('ASSET.DELETE'),('ASSET.CHANGE_STATUS'),
('ASSIGN.ISSUE'),('ASSIGN.RETURN'),('ASSIGN.TRANSFER'),('ASSIGN.VIEW_HISTORY'),
('FILES.UPLOAD'),('FILES.VIEW'),('FILES.DELETE'),
('TICKET.VIEW'),('TICKET.CREATE'),('TICKET.EDIT'),('TICKET.CLOSE'),('TICKET.DELETE'),
('VERIFY.CREATE'),('VERIFY.VIEW'),
('AUDIT.VIEW'),('AUDIT.SEARCH'),('AUDIT.EXPORT'),
('REPORTS.EXPORT'),
('CHAT.USE'),
('PRINT_LABELS.VIEW'),
('JOBCARD.VIEW'),('WORKLOGS.VIEW'),
('ACCOUNTS.VIEW'),('INVOICES.VIEW'),('CREDIT_NOTES.VIEW'),
('AI_CONFIG.VIEW'),('AI_CONFIG.CREATE'),('AI_CONFIG.EDIT'),('AI_CONFIG.DELETE');

INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
SELECT p.PermissionCode,
       REPLACE(REPLACE(p.PermissionCode, '.', ' / '), '_', ' '),
       LEFT(p.PermissionCode, CHARINDEX('.', p.PermissionCode + '.') - 1),
       'Permission: ' + p.PermissionCode,
       1
FROM @Perms p
WHERE NOT EXISTS (SELECT 1 FROM react_Permissions ex WHERE ex.PermissionCode = p.PermissionCode);

-- ========== ROLES ==========
DECLARE @RoleCodes TABLE (RoleCode NVARCHAR(50), RoleName NVARCHAR(100), Description NVARCHAR(500));
INSERT INTO @RoleCodes VALUES
('ADMIN', 'Administrator', 'Full system access'),
('ASSET_MANAGER', 'Asset Manager', 'Manage assets, assignments, tickets'),
('DEPT_HEAD', 'Department Head', 'View department dashboard and reports'),
('USER', 'User', 'View own assets and basic operations');

INSERT INTO react_Roles (RoleCode, RoleName, Description, IsActive)
SELECT r.RoleCode, r.RoleName, r.Description, 1
FROM @RoleCodes r
WHERE NOT EXISTS (SELECT 1 FROM react_Roles ex WHERE ex.RoleCode = r.RoleCode);

-- ========== ROLE-PERMISSION MAPPING ==========
-- ADMIN: all permissions
INSERT INTO react_RolePermissions (RoleID, PermissionID)
SELECT r.RoleID, perm.PermissionID
FROM react_Roles r
CROSS JOIN react_Permissions perm
WHERE r.RoleCode = 'ADMIN'
  AND NOT EXISTS (SELECT 1 FROM react_RolePermissions rp WHERE rp.RoleID = r.RoleID AND rp.PermissionID = perm.PermissionID);

-- ASSET_MANAGER: auth, dash, users view/search, masters (all), asset (all), assign (all), files, ticket (all), verify, audit (view/search), reports
INSERT INTO react_RolePermissions (RoleID, PermissionID)
SELECT r.RoleID, perm.PermissionID
FROM react_Roles r
JOIN react_Permissions perm ON perm.PermissionCode IN (
  'AUTH.LOGIN','AUTH.LOGOUT','DASH.VIEW_ADMIN','DASH.VIEW_DEPT','DASH.VIEW_SELF',
  'USERS.VIEW','USERS.SEARCH','RBAC.ROLES.VIEW','RBAC.PERMISSIONS.VIEW','RBAC.USERROLES.VIEW','RBAC.USERROLES.ASSIGN','RBAC.USERROLES.REVOKE',
  'MASTERS.CAT.VIEW','MASTERS.CAT.CREATE','MASTERS.CAT.EDIT','MASTERS.CAT.DELETE',
  'MASTERS.BRAND.VIEW','MASTERS.BRAND.CREATE','MASTERS.BRAND.EDIT','MASTERS.BRAND.DELETE',
  'MASTERS.MODEL.VIEW','MASTERS.MODEL.CREATE','MASTERS.MODEL.EDIT','MASTERS.MODEL.DELETE',
  'MASTERS.VENDOR.VIEW','MASTERS.VENDOR.CREATE','MASTERS.VENDOR.EDIT','MASTERS.VENDOR.DELETE',
  'MASTERS.LOC.VIEW','MASTERS.LOC.CREATE','MASTERS.LOC.EDIT','MASTERS.LOC.DELETE',
  'ASSET.VIEW','ASSET.SEARCH','ASSET.CREATE','ASSET.EDIT','ASSET.DELETE','ASSET.CHANGE_STATUS',
  'ASSIGN.ISSUE','ASSIGN.RETURN','ASSIGN.TRANSFER','ASSIGN.VIEW_HISTORY',
  'FILES.UPLOAD','FILES.VIEW','FILES.DELETE',
  'TICKET.VIEW','TICKET.CREATE','TICKET.EDIT','TICKET.CLOSE','TICKET.DELETE',
  'VERIFY.CREATE','VERIFY.VIEW','AUDIT.VIEW','AUDIT.SEARCH','AUDIT.EXPORT','REPORTS.EXPORT',
  'CHAT.USE','PRINT_LABELS.VIEW',
  'JOBCARD.VIEW','WORKLOGS.VIEW','ACCOUNTS.VIEW','INVOICES.VIEW','CREDIT_NOTES.VIEW'
)
WHERE r.RoleCode = 'ASSET_MANAGER'
  AND NOT EXISTS (SELECT 1 FROM react_RolePermissions rp WHERE rp.RoleID = r.RoleID AND rp.PermissionID = perm.PermissionID);

-- DEPT_HEAD: auth, dash (dept, self), users view, asset view/search, assign view history, files view, ticket view, verify view, audit view
INSERT INTO react_RolePermissions (RoleID, PermissionID)
SELECT r.RoleID, perm.PermissionID
FROM react_Roles r
JOIN react_Permissions perm ON perm.PermissionCode IN (
  'AUTH.LOGIN','AUTH.LOGOUT','DASH.VIEW_DEPT','DASH.VIEW_SELF',
  'USERS.VIEW','USERS.SEARCH','ASSET.VIEW','ASSET.SEARCH','ASSIGN.VIEW_HISTORY','FILES.VIEW',
  'TICKET.VIEW','VERIFY.VIEW','AUDIT.VIEW','AUDIT.SEARCH'
)
WHERE r.RoleCode = 'DEPT_HEAD'
  AND NOT EXISTS (SELECT 1 FROM react_RolePermissions rp WHERE rp.RoleID = r.RoleID AND rp.PermissionID = perm.PermissionID);

-- USER: auth, dash self, asset view (own), assign view history (own), files view, verify view
INSERT INTO react_RolePermissions (RoleID, PermissionID)
SELECT r.RoleID, perm.PermissionID
FROM react_Roles r
JOIN react_Permissions perm ON perm.PermissionCode IN (
  'AUTH.LOGIN','AUTH.LOGOUT','DASH.VIEW_SELF',
  'ASSET.VIEW','ASSIGN.VIEW_HISTORY','FILES.VIEW','VERIFY.VIEW'
)
WHERE r.RoleCode = 'USER'
  AND NOT EXISTS (SELECT 1 FROM react_RolePermissions rp WHERE rp.RoleID = r.RoleID AND rp.PermissionID = perm.PermissionID);

PRINT 'RBAC seed completed.';
GO
