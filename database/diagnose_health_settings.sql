-- Comprehensive diagnostic for Health Alert Settings permission issues
-- Run this to check if everything is configured correctly

USE SyncFinalNew;
GO

SET NOCOUNT ON;

PRINT '========================================';
PRINT 'HEALTH ALERT SETTINGS DIAGNOSTIC';
PRINT '========================================';

-- 1. Check if migration tables exist
PRINT '';
PRINT '=== 1. Checking if health alert tables exist ===';
IF OBJECT_ID('dbo.react_HealthAlertSettings', 'U') IS NOT NULL
    PRINT '✓ react_HealthAlertSettings table exists'
ELSE
    PRINT '✗ react_HealthAlertSettings table MISSING - Run migration 015_health_alerts.sql';

IF OBJECT_ID('dbo.react_HealthAlerts', 'U') IS NOT NULL
    PRINT '✓ react_HealthAlerts table exists'
ELSE
    PRINT '✗ react_HealthAlerts table MISSING - Run migration 015_health_alerts.sql';

-- 2. Check if permission exists
PRINT '';
PRINT '=== 2. Checking if HEALTH.SETTINGS permission exists ===';
IF EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'HEALTH.SETTINGS')
BEGIN
    PRINT '✓ HEALTH.SETTINGS permission exists';
    SELECT PermissionID, PermissionCode, PermissionName, IsActive 
    FROM react_Permissions 
    WHERE PermissionCode = 'HEALTH.SETTINGS';
END
ELSE
    PRINT '✗ HEALTH.SETTINGS permission MISSING - Run seed 009_health_settings_permission.sql';

-- 3. Check which roles have the permission
PRINT '';
PRINT '=== 3. Checking which roles have HEALTH.SETTINGS permission ===';
IF EXISTS (SELECT 1 FROM react_Permissions WHERE PermissionCode = 'HEALTH.SETTINGS')
BEGIN
    SELECT r.RoleCode, r.RoleName
    FROM react_RolePermissions rp
    JOIN react_Permissions p ON rp.PermissionID = p.PermissionID
    JOIN react_Roles r ON rp.RoleID = r.RoleID
    WHERE p.PermissionCode = 'HEALTH.SETTINGS';
    
    IF @@ROWCOUNT = 0
        PRINT '✗ No roles have HEALTH.SETTINGS permission - Run seed 009_health_settings_permission.sql';
END

-- 4. List all active users with their roles and HEALTH.SETTINGS permission
PRINT '';
PRINT '=== 4. Users with HEALTH.SETTINGS permission ===';
SELECT 
    u.userid,
    u.Name,
    u.email,
    r.RoleCode,
    'Has HEALTH.SETTINGS' AS Permission
FROM rb_users u
JOIN react_UserRoles ur ON u.userid = ur.UserID
JOIN react_Roles r ON ur.RoleID = r.RoleID
JOIN react_RolePermissions rp ON r.RoleID = rp.RoleID
JOIN react_Permissions p ON rp.PermissionID = p.PermissionID
WHERE p.PermissionCode = 'HEALTH.SETTINGS'
  AND u.IsActive = 1
ORDER BY u.email;

IF @@ROWCOUNT = 0
    PRINT '✗ NO USERS have HEALTH.SETTINGS permission!';

-- 5. Show active users WITHOUT any role
PRINT '';
PRINT '=== 5. Active users WITHOUT any role (cannot access anything!) ===';
SELECT u.userid, u.Name, u.email
FROM rb_users u
WHERE u.IsActive = 1
  AND NOT EXISTS (SELECT 1 FROM react_UserRoles ur WHERE ur.UserID = u.userid)
ORDER BY u.email;

IF @@ROWCOUNT = 0
    PRINT '✓ All active users have at least one role';

-- 6. Show all active users with their roles
PRINT '';
PRINT '=== 6. All active users and their roles ===';
SELECT 
    u.userid,
    u.Name,
    u.email,
    STUFF((
        SELECT ', ' + r2.RoleCode
        FROM react_UserRoles ur2
        JOIN react_Roles r2 ON ur2.RoleID = r2.RoleID
        WHERE ur2.UserID = u.userid
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'), 1, 2, '') AS Roles
FROM rb_users u
WHERE u.IsActive = 1
ORDER BY u.email;

PRINT '';
PRINT '========================================';
PRINT 'DIAGNOSTIC COMPLETE';
PRINT '========================================';
PRINT '';
PRINT 'ACTION ITEMS:';
PRINT '1. If tables are missing: Run e:\cursor\database\migrations\015_health_alerts.sql';
PRINT '2. If permission is missing: Run e:\cursor\database\seeds\009_health_settings_permission.sql';
PRINT '3. If your user has no role or no HEALTH.SETTINGS permission: Run the query below';
PRINT '';
PRINT '-- TO ASSIGN ADMIN ROLE TO YOUR USER (replace with your email):';
PRINT 'DECLARE @UserEmail VARCHAR(255) = ''your_email@domain.com'';';
PRINT 'DECLARE @UserId INT = (SELECT userid FROM rb_users WHERE email = @UserEmail);';
PRINT 'DECLARE @AdminRoleId INT = (SELECT RoleID FROM react_Roles WHERE RoleCode = ''ADMIN'');';
PRINT 'IF @UserId IS NOT NULL AND @AdminRoleId IS NOT NULL';
PRINT '    INSERT INTO react_UserRoles (UserID, RoleID) VALUES (@UserId, @AdminRoleId);';
PRINT '';
PRINT '4. IMPORTANT: After fixing, LOG OUT and LOG BACK IN for permissions to take effect!';
GO
