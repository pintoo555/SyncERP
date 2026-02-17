-- HRMS (User/Employee) module permissions. Run after 001_rbac_seed.sql. Idempotent.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'HRMS.VIEW')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('HRMS.VIEW', 'HRMS / View', 'HRMS', 'View employees list and user search/activity', 1);

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'HRMS.EDIT')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('HRMS.EDIT', 'HRMS / Edit', 'HRMS', 'Edit employee profiles, family, bank, department', 1);

INSERT INTO react_RolePermissions (RoleID, PermissionID)
SELECT r.RoleID, p.PermissionID
FROM react_Roles r
CROSS JOIN react_Permissions p
WHERE r.RoleCode = 'ADMIN'
  AND p.PermissionCode IN ('HRMS.VIEW', 'HRMS.EDIT')
  AND NOT EXISTS (SELECT 1 FROM react_RolePermissions rp WHERE rp.RoleID = r.RoleID AND rp.PermissionID = p.PermissionID);

PRINT 'HRMS permissions completed.';
GO
