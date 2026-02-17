-- Health Alert Settings permission. Run after 008_health_permission.sql. Idempotent.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'HEALTH.SETTINGS')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('HEALTH.SETTINGS', 'Health Alert Settings', 'HEALTH', 'Configure health alert thresholds and recipients', 1);

INSERT INTO react_RolePermissions (RoleID, PermissionID)
SELECT r.RoleID, p.PermissionID
FROM react_Roles r
CROSS JOIN react_Permissions p
WHERE r.RoleCode = 'ADMIN'
  AND p.PermissionCode = 'HEALTH.SETTINGS'
  AND NOT EXISTS (SELECT 1 FROM react_RolePermissions rp WHERE rp.RoleID = r.RoleID AND rp.PermissionID = p.PermissionID);

PRINT 'Health settings permission completed.';
GO
