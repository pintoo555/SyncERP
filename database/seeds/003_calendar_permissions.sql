-- Calendar RBAC: permissions and role assignments.
-- Run after 001_rbac_seed.sql. Idempotent.

SET NOCOUNT ON;

-- Permissions
IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'CALENDAR.VIEW')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('CALENDAR.VIEW', 'Calendar / View', 'Calendar', 'View calendar (personal and company)', 1);

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'CALENDAR.CREATE')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('CALENDAR.CREATE', 'Calendar / Create', 'Calendar', 'Create personal calendar events', 1);

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'CALENDAR.CREATE_COMPANY')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('CALENDAR.CREATE_COMPANY', 'Calendar / Create Company', 'Calendar', 'Create company-wide events (visible to all)', 1);

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'CALENDAR.EDIT_OWN')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('CALENDAR.EDIT_OWN', 'Calendar / Edit Own', 'Calendar', 'Edit and delete own personal events', 1);

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'CALENDAR.EDIT_COMPANY')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('CALENDAR.EDIT_COMPANY', 'Calendar / Edit Company', 'Calendar', 'Edit and delete company events', 1);

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'CALENDAR.VIEW_AVAILABILITY')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('CALENDAR.VIEW_AVAILABILITY', 'Calendar / View Availability', 'Calendar', 'View other users'' calendar availability (shared)', 1);

-- ADMIN: all calendar permissions (already gets all via CROSS JOIN in 001)
-- Ensure USER and others get basic calendar
DECLARE @PermView INT = (SELECT PermissionID FROM react_Permissions WHERE PermissionCode = 'CALENDAR.VIEW');
DECLARE @PermCreate INT = (SELECT PermissionID FROM react_Permissions WHERE PermissionCode = 'CALENDAR.CREATE');
DECLARE @PermEditOwn INT = (SELECT PermissionID FROM react_Permissions WHERE PermissionCode = 'CALENDAR.EDIT_OWN');

-- USER role: view + create personal + edit own
IF @PermView IS NOT NULL AND @PermCreate IS NOT NULL AND @PermEditOwn IS NOT NULL
INSERT INTO react_RolePermissions (RoleID, PermissionID)
SELECT r.RoleID, p.PermissionID
FROM react_Roles r
CROSS JOIN (SELECT @PermView AS PermissionID UNION SELECT @PermCreate UNION SELECT @PermEditOwn) p
WHERE r.RoleCode = 'USER'
  AND NOT EXISTS (SELECT 1 FROM react_RolePermissions rp WHERE rp.RoleID = r.RoleID AND rp.PermissionID = p.PermissionID);

-- ASSET_MANAGER, DEPT_HEAD: view, create, create_company, edit_own, edit_company, view_availability
DECLARE @PermCreateCo INT = (SELECT PermissionID FROM react_Permissions WHERE PermissionCode = 'CALENDAR.CREATE_COMPANY');
DECLARE @PermEditCo INT = (SELECT PermissionID FROM react_Permissions WHERE PermissionCode = 'CALENDAR.EDIT_COMPANY');
DECLARE @PermAvail INT = (SELECT PermissionID FROM react_Permissions WHERE PermissionCode = 'CALENDAR.VIEW_AVAILABILITY');

IF @PermCreateCo IS NOT NULL AND @PermEditCo IS NOT NULL AND @PermAvail IS NOT NULL
INSERT INTO react_RolePermissions (RoleID, PermissionID)
SELECT r.RoleID, perm.PermissionID
FROM react_Roles r
JOIN react_Permissions perm ON perm.PermissionCode IN ('CALENDAR.VIEW','CALENDAR.CREATE','CALENDAR.CREATE_COMPANY','CALENDAR.EDIT_OWN','CALENDAR.EDIT_COMPANY','CALENDAR.VIEW_AVAILABILITY')
WHERE r.RoleCode IN ('ASSET_MANAGER','DEPT_HEAD')
  AND NOT EXISTS (SELECT 1 FROM react_RolePermissions rp WHERE rp.RoleID = r.RoleID AND rp.PermissionID = perm.PermissionID);

PRINT 'Calendar permissions seed completed.';
GO
