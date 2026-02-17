-- Migration 008: User-level permission overrides (in addition to role permissions)
-- SQL Server 2008 R2
-- A user's effective permissions = permissions from their roles + permissions granted directly to the user

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_UserPermissions')
BEGIN
    CREATE TABLE react_UserPermissions (
        UserID INT NOT NULL,
        PermissionID INT NOT NULL,
        GrantedAt DATETIME NOT NULL DEFAULT GETDATE(),
        GrantedBy INT NULL,
        PRIMARY KEY (UserID, PermissionID),
        CONSTRAINT FK_react_UserPermissions_User FOREIGN KEY (UserID) REFERENCES rb_users(userid),
        CONSTRAINT FK_react_UserPermissions_Permission FOREIGN KEY (PermissionID) REFERENCES react_Permissions(PermissionID),
        CONSTRAINT FK_react_UserPermissions_GrantedBy FOREIGN KEY (GrantedBy) REFERENCES rb_users(userid)
    );
    CREATE INDEX IX_react_UserPermissions_PermissionID ON react_UserPermissions(PermissionID);
END
GO
