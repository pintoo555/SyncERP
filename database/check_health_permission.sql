-- Check if HEALTH.SETTINGS permission exists and which roles/users have it

-- 1. Check if permission exists
SELECT 'Permission exists:' AS Check_Type, PermissionID, PermissionCode, PermissionName, IsActive
FROM react_Permissions
WHERE PermissionCode = 'HEALTH.SETTINGS';

-- 2. Check which roles have this permission
SELECT 'Roles with permission:' AS Check_Type, r.RoleCode, r.RoleName
FROM react_RolePermissions rp
JOIN react_Permissions p ON rp.PermissionID = p.PermissionID
JOIN react_Roles r ON rp.RoleID = r.RoleID
WHERE p.PermissionCode = 'HEALTH.SETTINGS';

-- 3. Check which users have this permission (through their role)
SELECT 'Users with permission:' AS Check_Type, u.userid, u.Name, r.RoleCode
FROM rb_users u
JOIN react_UserRoles ur ON u.userid = ur.UserID
JOIN react_RolePermissions rp ON ur.RoleID = rp.RoleID
JOIN react_Permissions p ON rp.PermissionID = p.PermissionID
JOIN react_Roles r ON ur.RoleID = r.RoleID
WHERE p.PermissionCode = 'HEALTH.SETTINGS'
ORDER BY u.Name;
