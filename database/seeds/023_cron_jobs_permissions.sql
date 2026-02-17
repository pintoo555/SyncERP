-- Cron Jobs module permissions. Run after 001_rbac_seed.sql. Idempotent.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'CRON_JOBS.VIEW')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('CRON_JOBS.VIEW', 'Cron Jobs / View', 'Settings', 'View cron jobs list and details', 1);

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'CRON_JOBS.EDIT')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('CRON_JOBS.EDIT', 'Cron Jobs / Edit', 'Settings', 'Create, update, delete and run cron jobs', 1);

INSERT INTO react_RolePermissions (RoleID, PermissionID)
SELECT r.RoleID, p.PermissionID
FROM react_Roles r
CROSS JOIN react_Permissions p
WHERE r.RoleCode = 'ADMIN'
  AND p.PermissionCode IN ('CRON_JOBS.VIEW', 'CRON_JOBS.EDIT')
  AND NOT EXISTS (SELECT 1 FROM react_RolePermissions rp WHERE rp.RoleID = r.RoleID AND rp.PermissionID = p.PermissionID);

PRINT 'Cron Jobs permissions completed.';
GO
