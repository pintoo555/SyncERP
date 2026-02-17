-- Add CHAT.USE and PRINT_LABELS.VIEW permissions and assign to roles
-- Run this if you don't see Chat or Print Labels in Roles & Permissions

SET NOCOUNT ON;

-- Insert CHAT.USE and PRINT_LABELS.VIEW if not exists
IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'CHAT.USE')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('CHAT.USE', 'CHAT / USE', 'CHAT', 'Permission: CHAT.USE', 1);

IF NOT EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'PRINT_LABELS.VIEW')
INSERT INTO react_Permissions (PermissionCode, PermissionName, ModuleName, Description, IsActive)
VALUES ('PRINT_LABELS.VIEW', 'PRINT LABELS / VIEW', 'PRINT_LABELS', 'Permission: PRINT_LABELS.VIEW', 1);

-- Assign CHAT.USE and PRINT_LABELS.VIEW to ADMIN (all permissions - skip if already granted via admin full grant)
DECLARE @ChatPermId INT = (SELECT PermissionID FROM react_Permissions WHERE PermissionCode = 'CHAT.USE');
DECLARE @PrintPermId INT = (SELECT PermissionID FROM react_Permissions WHERE PermissionCode = 'PRINT_LABELS.VIEW');
DECLARE @AdminRoleId INT = (SELECT RoleID FROM react_Roles WHERE RoleCode = 'ADMIN');
DECLARE @AssetMgrRoleId INT = (SELECT RoleID FROM react_Roles WHERE RoleCode = 'ASSET_MANAGER');

IF @ChatPermId IS NOT NULL AND @AdminRoleId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM react_RolePermissions WHERE RoleID = @AdminRoleId AND PermissionID = @ChatPermId)
  INSERT INTO react_RolePermissions (RoleID, PermissionID) VALUES (@AdminRoleId, @ChatPermId);

IF @PrintPermId IS NOT NULL AND @AdminRoleId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM react_RolePermissions WHERE RoleID = @AdminRoleId AND PermissionID = @PrintPermId)
  INSERT INTO react_RolePermissions (RoleID, PermissionID) VALUES (@AdminRoleId, @PrintPermId);

IF @ChatPermId IS NOT NULL AND @AssetMgrRoleId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM react_RolePermissions WHERE RoleID = @AssetMgrRoleId AND PermissionID = @ChatPermId)
  INSERT INTO react_RolePermissions (RoleID, PermissionID) VALUES (@AssetMgrRoleId, @ChatPermId);

IF @PrintPermId IS NOT NULL AND @AssetMgrRoleId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM react_RolePermissions WHERE RoleID = @AssetMgrRoleId AND PermissionID = @PrintPermId)
  INSERT INTO react_RolePermissions (RoleID, PermissionID) VALUES (@AssetMgrRoleId, @PrintPermId);

PRINT 'Chat and Print Labels permissions added.';
GO
