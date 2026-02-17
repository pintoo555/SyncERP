-- General Settings (timezone, etc.) permissions. Run after 001_rbac_seed.sql. Idempotent.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'GENERAL_SETTINGS.VIEW')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('GENERAL_SETTINGS.VIEW', 'General Settings / View', 'GENERAL_SETTINGS', 'View general app settings (timezone)', 1);

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'GENERAL_SETTINGS.EDIT')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('GENERAL_SETTINGS.EDIT', 'General Settings / Edit', 'GENERAL_SETTINGS', 'Change timezone and other app settings', 1);

INSERT INTO react_RolePermissions (RoleID, PermissionID)
SELECT r.RoleID, p.PermissionID
FROM react_Roles r
CROSS JOIN react_Permissions p
WHERE r.RoleCode = 'ADMIN'
  AND p.PermissionCode IN ('GENERAL_SETTINGS.VIEW', 'GENERAL_SETTINGS.EDIT')
  AND NOT EXISTS (SELECT 1 FROM react_RolePermissions rp WHERE rp.RoleID = r.RoleID AND rp.PermissionID = p.PermissionID);

PRINT 'General Settings permissions completed.';
GO
