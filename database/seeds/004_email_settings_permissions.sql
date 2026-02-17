-- Email Settings permissions. Run after 001_rbac_seed.sql. Idempotent.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'EMAIL_SETTINGS.VIEW')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('EMAIL_SETTINGS.VIEW', 'Email Settings / View', 'EMAIL_SETTINGS', 'View and list email configurations', 1);

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'EMAIL_SETTINGS.CREATE')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('EMAIL_SETTINGS.CREATE', 'Email Settings / Create', 'EMAIL_SETTINGS', 'Add new email configuration', 1);

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'EMAIL_SETTINGS.EDIT')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('EMAIL_SETTINGS.EDIT', 'Email Settings / Edit', 'EMAIL_SETTINGS', 'Edit email configuration and send test', 1);

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'EMAIL_SETTINGS.DELETE')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('EMAIL_SETTINGS.DELETE', 'Email Settings / Delete', 'EMAIL_SETTINGS', 'Delete email configuration', 1);

INSERT INTO react_RolePermissions (RoleID, PermissionID)
SELECT r.RoleID, p.PermissionID
FROM react_Roles r
CROSS JOIN react_Permissions p
WHERE r.RoleCode IN ('ADMIN', 'ASSET_MANAGER')
  AND p.PermissionCode LIKE 'EMAIL_SETTINGS.%'
  AND NOT EXISTS (SELECT 1 FROM react_RolePermissions rp WHERE rp.RoleID = r.RoleID AND rp.PermissionID = p.PermissionID);

PRINT 'Email Settings permissions completed.';
GO
