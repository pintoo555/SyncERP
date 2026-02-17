-- Migration 047: Seed client module permissions
-- Adds CLIENT.* permission codes and grants them to ADMIN role.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM dbo.react_Permissions WHERE PermissionCode = 'CLIENT.VIEW')
BEGIN
    INSERT INTO dbo.react_Permissions (PermissionCode, PermissionName, ModuleName, Description) VALUES
        ('CLIENT.VIEW',          'View Clients',          'Clients', 'View client list and details'),
        ('CLIENT.CREATE',        'Create Clients',        'Clients', 'Create new client records'),
        ('CLIENT.EDIT',          'Edit Clients',          'Clients', 'Edit existing client records'),
        ('CLIENT.DELETE',        'Delete Clients',        'Clients', 'Soft-delete client records'),
        ('CLIENT.MERGE',         'Merge Clients',         'Clients', 'Merge client records'),
        ('CLIENT.BLACKLIST',     'Blacklist Clients',     'Clients', 'Toggle client blacklist status'),
        ('CLIENT.GROUP.VIEW',    'View Client Groups',    'Clients', 'View client group records'),
        ('CLIENT.GROUP.EDIT',    'Edit Client Groups',    'Clients', 'Create and edit client groups'),
        ('CLIENT.360.VIEW',      'View Client 360',       'Clients', 'View Client 360 combined view'),
        ('CLIENT.INDUSTRY.VIEW', 'View Industries',       'Clients', 'View industry master'),
        ('CLIENT.INDUSTRY.EDIT', 'Edit Industries',       'Clients', 'Create and edit industries');
END
GO

-- Grant all client permissions to ADMIN role
DECLARE @adminRoleId INT;
SELECT @adminRoleId = RoleID FROM dbo.react_Roles WHERE RoleCode = 'ADMIN';

IF @adminRoleId IS NOT NULL
BEGIN
    INSERT INTO dbo.react_RolePermissions (RoleID, PermissionID, GrantedAt, GrantedBy)
    SELECT @adminRoleId, p.PermissionID, GETDATE(), NULL
    FROM dbo.react_Permissions p
    WHERE p.PermissionCode LIKE 'CLIENT.%'
      AND NOT EXISTS (
          SELECT 1 FROM dbo.react_RolePermissions rp
          WHERE rp.RoleID = @adminRoleId AND rp.PermissionID = p.PermissionID
      );
END
GO

PRINT 'Migration 047 seed client permissions completed.';
GO
