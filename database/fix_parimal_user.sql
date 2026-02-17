-- Fix user 'parimal' - assign ADMIN role and verify permissions
-- Run this in your SQL Server Management Studio

USE [your_database_name];
GO

SET NOCOUNT ON;

-- Step 1: Verify user exists
PRINT '=== Step 1: Checking if user exists ===';
SELECT userid, Name, IsActive FROM rb_users WHERE Name = 'parimal';

-- Step 2: Check available roles
PRINT '';
PRINT '=== Step 2: Available roles ===';
SELECT RoleID, RoleCode, RoleName FROM react_Roles ORDER BY RoleCode;

-- Step 3: Assign ADMIN role to parimal
PRINT '';
PRINT '=== Step 3: Assigning ADMIN role to parimal ===';
DECLARE @UserId INT = (SELECT userid FROM rb_users WHERE Name = 'parimal');
DECLARE @AdminRoleId INT = (SELECT RoleID FROM react_Roles WHERE RoleCode = 'ADMIN');

IF @UserId IS NULL
BEGIN
    PRINT 'ERROR: User "parimal" not found in rb_users table!';
END
ELSE IF @AdminRoleId IS NULL
BEGIN
    PRINT 'ERROR: ADMIN role not found in react_Roles table!';
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT 1 FROM react_UserRoles WHERE UserID = @UserId AND RoleID = @AdminRoleId)
    BEGIN
        INSERT INTO react_UserRoles (UserID, RoleID) VALUES (@UserId, @AdminRoleId);
        PRINT 'SUCCESS: ADMIN role assigned to parimal (UserID: ' + CAST(@UserId AS VARCHAR) + ')';
    END
    ELSE
    BEGIN
        PRINT 'INFO: User already has ADMIN role';
    END
END

-- Step 4: Verify role assignment
PRINT '';
PRINT '=== Step 4: Verifying role assignment ===';
SELECT u.userid, u.Name, r.RoleCode, r.RoleName
FROM rb_users u
JOIN react_UserRoles ur ON u.userid = ur.UserID
JOIN react_Roles r ON ur.RoleID = r.RoleID
WHERE u.Name = 'parimal';

-- Step 5: Verify HEALTH.SETTINGS permission
PRINT '';
PRINT '=== Step 5: Checking HEALTH.SETTINGS permission ===';
SELECT 
    u.Name AS UserName,
    r.RoleCode,
    p.PermissionCode,
    p.PermissionName
FROM rb_users u
JOIN react_UserRoles ur ON u.userid = ur.UserID
JOIN react_Roles r ON ur.RoleID = r.RoleID
JOIN react_RolePermissions rp ON r.RoleID = rp.RoleID
JOIN react_Permissions p ON rp.PermissionID = p.PermissionID
WHERE u.Name = 'parimal'
  AND p.PermissionCode = 'HEALTH.SETTINGS';

PRINT '';
PRINT '=== DONE ===';
PRINT 'If you see HEALTH.SETTINGS permission above, you are good to go!';
PRINT 'IMPORTANT: You MUST log out and log back in for permissions to take effect!';
GO
