-- Find all users in the database to identify the correct username

USE SyncFinalNew;
GO

-- List all users
PRINT '=== All users in rb_users table ===';
SELECT userid, Name, IsActive 
FROM rb_users 
ORDER BY Name;

-- Search for users with 'parimal' in name (case-insensitive)
PRINT '';
PRINT '=== Users with "parimal" in name ===';
SELECT userid, Name, IsActive 
FROM rb_users 
WHERE Name LIKE '%parimal%'
ORDER BY Name;

-- Check which users already have roles
PRINT '';
PRINT '=== Users with roles assigned ===';
SELECT u.userid, u.Name, r.RoleCode, r.RoleName
FROM rb_users u
JOIN react_UserRoles ur ON u.userid = ur.UserID
JOIN react_Roles r ON ur.RoleID = r.RoleID
ORDER BY u.Name;

-- Check which users have NO roles
PRINT '';
PRINT '=== Users WITHOUT any role (these users cannot access anything!) ===';
SELECT u.userid, u.Name, u.IsActive
FROM rb_users u
WHERE NOT EXISTS (SELECT 1 FROM react_UserRoles ur WHERE ur.UserID = u.userid)
  AND u.IsActive = 1
ORDER BY u.Name;
