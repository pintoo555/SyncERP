-- Synchronics Asset Management System
-- Migration 001: RBAC tables (Roles, Permissions, RolePermissions, UserRoles)
-- Database: Microsoft SQL Server 2008 R2
-- Do not modify existing rb_users or sync_Department

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_Roles')
BEGIN
    CREATE TABLE react_Roles (
        RoleID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        RoleCode NVARCHAR(50) NOT NULL UNIQUE,
        RoleName NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedAt DATETIME NULL,
        UpdatedBy INT NULL
    );
    CREATE UNIQUE INDEX IX_react_Roles_RoleCode ON react_Roles(RoleCode);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_Permissions')
BEGIN
    CREATE TABLE react_Permissions (
        PermissionID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        PermissionCode NVARCHAR(100) NOT NULL UNIQUE,
        PermissionName NVARCHAR(200) NOT NULL,
        ModuleName NVARCHAR(50) NULL,
        Description NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
    CREATE UNIQUE INDEX IX_react_Permissions_PermissionCode ON react_Permissions(PermissionCode);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_RolePermissions')
BEGIN
    CREATE TABLE react_RolePermissions (
        RoleID INT NOT NULL,
        PermissionID INT NOT NULL,
        GrantedAt DATETIME NOT NULL DEFAULT GETDATE(),
        GrantedBy INT NULL,
        PRIMARY KEY (RoleID, PermissionID),
        CONSTRAINT FK_react_RolePermissions_Role FOREIGN KEY (RoleID) REFERENCES react_Roles(RoleID),
        CONSTRAINT FK_react_RolePermissions_Permission FOREIGN KEY (PermissionID) REFERENCES react_Permissions(PermissionID)
    );
    CREATE INDEX IX_react_RolePermissions_PermissionID ON react_RolePermissions(PermissionID);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_UserRoles')
BEGIN
    CREATE TABLE react_UserRoles (
        UserID INT NOT NULL,
        RoleID INT NOT NULL,
        AssignedAt DATETIME NOT NULL DEFAULT GETDATE(),
        AssignedBy INT NULL,
        RevokedAt DATETIME NULL,
        RevokedBy INT NULL,
        IsActive AS (CASE WHEN RevokedAt IS NULL THEN 1 ELSE 0 END) PERSISTED,
        PRIMARY KEY (UserID, RoleID),
        CONSTRAINT FK_react_UserRoles_User FOREIGN KEY (UserID) REFERENCES rb_users(userid),
        CONSTRAINT FK_react_UserRoles_Role FOREIGN KEY (RoleID) REFERENCES react_Roles(RoleID)
    );
    CREATE INDEX IX_react_UserRoles_RoleID ON react_UserRoles(RoleID);
END
GO
