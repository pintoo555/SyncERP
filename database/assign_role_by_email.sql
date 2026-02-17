-- Assign ADMIN role to user by email (since email is used as username)
-- Replace 'your_email@example.com' with your actual email/username

USE SyncFinalNew;
GO

SET NOCOUNT ON;

-- Step 1: Find your user by email
PRINT '=== Step 1: Finding user by email ===';
DECLARE @UserEmail VARCHAR(255) = 'your_email@example.com';  -- CHANGE THIS TO YOUR EMAIL
DECLARE @UserId INT = (SELECT userid FROM rb_users WHERE email = @UserEmail);
DECLARE @AdminRoleId INT = (SELECT RoleID FROM react_Roles WHERE RoleCode = 'ADMIN');

-- Display user info
IF @UserId IS NULL
BEGIN
    PRINT 'ERROR: User with email "' + @UserEmail + '" not found!';
    PRINT '';
    PRINT 'Available users (showing first 20):';
    SELECT TOP 20 userid, Name, email, IsActive FROM rb_users ORDER BY email;
END
ELSE
BEGIN
    SELECT userid, Name, email, IsActive FROM rb_users WHERE userid = @UserId;
    
    -- Step 2: Check if ADMIN role exists
    IF @AdminRoleId IS NULL
    BEGIN
        PRINT 'ERROR: ADMIN role not found in react_Roles table!';
        PRINT 'Available roles:';
        SELECT RoleID, RoleCode, RoleName FROM react_Roles;
    END
    ELSE
    BEGIN
        -- Step 3: Assign ADMIN role
        PRINT '';
        PRINT '=== Step 2: Assigning ADMIN role ===';
        IF NOT EXISTS (SELECT 1 FROM react_UserRoles WHERE UserID = @UserId AND RoleID = @AdminRoleId)
        BEGIN
            INSERT INTO react_UserRoles (UserID, RoleID) VALUES (@UserId, @AdminRoleId);
            PRINT 'SUCCESS: ADMIN role assigned to user ' + @UserEmail;
        END
        ELSE
        BEGIN
            PRINT 'INFO: User already has ADMIN role';
        END
        
        -- Step 4: Verify role assignment
        PRINT '';
        PRINT '=== Step 3: Verifying role assignment ===';
        SELECT u.userid, u.Name, u.email, r.RoleCode, r.RoleName
        FROM rb_users u
        JOIN react_UserRoles ur ON u.userid = ur.UserID
        JOIN react_Roles r ON ur.RoleID = r.RoleID
        WHERE u.email = @UserEmail;
        
        -- Step 5: Verify HEALTH.SETTINGS permission
        PRINT '';
        PRINT '=== Step 4: Verifying HEALTH.SETTINGS permission ===';
        SELECT 
            u.email AS UserEmail,
            r.RoleCode,
            p.PermissionCode,
            p.PermissionName
        FROM rb_users u
        JOIN react_UserRoles ur ON u.userid = ur.UserID
        JOIN react_Roles r ON ur.RoleID = r.RoleID
        JOIN react_RolePermissions rp ON r.RoleID = rp.RoleID
        JOIN react_Permissions p ON rp.PermissionID = p.PermissionID
        WHERE u.email = @UserEmail
          AND p.PermissionCode = 'HEALTH.SETTINGS';
    END
END

PRINT '';
PRINT '=== DONE ===';
PRINT 'If you see HEALTH.SETTINGS permission above, you are ready!';
PRINT 'IMPORTANT: Log out and log back in for permissions to take effect!';
GO
