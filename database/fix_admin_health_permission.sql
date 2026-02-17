-- Verify and fix ADMIN role having HEALTH.SETTINGS permission
USE SyncFinalNew;
GO

SET NOCOUNT ON;

PRINT '=== Checking if ADMIN role has HEALTH.SETTINGS permission ===';

-- Check if permission is assigned to ADMIN role
IF EXISTS (
    SELECT 1 
    FROM react_RolePermissions rp
    JOIN react_Permissions p ON rp.PermissionID = p.PermissionID
    JOIN react_Roles r ON rp.RoleID = r.RoleID
    WHERE p.PermissionCode = 'HEALTH.SETTINGS' 
      AND r.RoleCode = 'ADMIN'
)
BEGIN
    PRINT '✓ ADMIN role already has HEALTH.SETTINGS permission';
END
ELSE
BEGIN
    PRINT '✗ ADMIN role does NOT have HEALTH.SETTINGS permission';
    PRINT 'Adding permission now...';
    
    -- Add the permission to ADMIN role
    INSERT INTO react_RolePermissions (RoleID, PermissionID)
    SELECT r.RoleID, p.PermissionID
    FROM react_Roles r
    CROSS JOIN react_Permissions p
    WHERE r.RoleCode = 'ADMIN'
      AND p.PermissionCode = 'HEALTH.SETTINGS'
      AND NOT EXISTS (
          SELECT 1 FROM react_RolePermissions rp 
          WHERE rp.RoleID = r.RoleID AND rp.PermissionID = p.PermissionID
      );
    
    PRINT '✓ Permission added!';
END

-- Verify the fix
PRINT '';
PRINT '=== Verification ===';
SELECT 
    r.RoleCode,
    p.PermissionCode,
    p.PermissionName
FROM react_RolePermissions rp
JOIN react_Permissions p ON rp.PermissionID = p.PermissionID
JOIN react_Roles r ON rp.RoleID = r.RoleID
WHERE p.PermissionCode = 'HEALTH.SETTINGS';

PRINT '';
PRINT '=== Users with access (after logout/login) ===';
SELECT 
    u.email,
    r.RoleCode,
    'Will have access after logout/login' AS Status
FROM rb_users u
JOIN react_UserRoles ur ON u.userid = ur.UserID
JOIN react_Roles r ON ur.RoleID = r.RoleID
JOIN react_RolePermissions rp ON r.RoleID = rp.RoleID
JOIN react_Permissions p ON rp.PermissionID = p.PermissionID
WHERE p.PermissionCode = 'HEALTH.SETTINGS'
  AND u.IsActive = 1;

PRINT '';
PRINT '========================================';
PRINT 'IMPORTANT: You MUST log out and log back in!';
PRINT '========================================';
PRINT 'Your JWT token contains cached permissions.';
PRINT 'Logging in again will refresh the token with new permissions.';
GO
