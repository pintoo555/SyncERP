-- Health (system metrics: CPU, RAM, disk) permission. Run after 001_rbac_seed.sql. Idempotent.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'HEALTH.VIEW')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('HEALTH.VIEW', 'Health / View', 'HEALTH', 'View system health (CPU, RAM, disk usage)', 1);

INSERT INTO react_RolePermissions (RoleID, PermissionID)
SELECT r.RoleID, p.PermissionID
FROM react_Roles r
CROSS JOIN react_Permissions p
WHERE r.RoleCode = 'ADMIN'
  AND p.PermissionCode = 'HEALTH.VIEW'
  AND NOT EXISTS (SELECT 1 FROM react_RolePermissions rp WHERE rp.RoleID = r.RoleID AND rp.PermissionID = p.PermissionID);

PRINT 'Health permission completed.';
GO
