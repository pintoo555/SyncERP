-- Migration 044: Client groups and group members tables
-- Group companies with role-based membership.
-- GroupCode is derived from Id after insert (CG000001 = Id 1).

SET NOCOUNT ON;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_ClientGroup' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_ClientGroup (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        GroupCode NVARCHAR(20) NOT NULL DEFAULT '',
        GroupName NVARCHAR(200) NOT NULL,
        IndustryId BIGINT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT UQ_utbl_ClientGroup_Code UNIQUE (GroupCode),
        CONSTRAINT FK_utbl_ClientGroup_Industry FOREIGN KEY (IndustryId) REFERENCES dbo.utbl_Industry(Id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_utbl_ClientGroup_GroupName ON dbo.utbl_ClientGroup(GroupName);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_ClientGroupMember' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_ClientGroupMember (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        GroupId BIGINT NOT NULL,
        ClientId BIGINT NOT NULL,
        RoleInGroup NVARCHAR(30) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT CK_utbl_ClientGroupMember_Role CHECK (RoleInGroup IN ('Parent','Subsidiary','Branch','Other')),
        CONSTRAINT FK_utbl_ClientGroupMember_Group FOREIGN KEY (GroupId) REFERENCES dbo.utbl_ClientGroup(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_ClientGroupMember_Client FOREIGN KEY (ClientId) REFERENCES dbo.utbl_Client(Id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_utbl_ClientGroupMember_GroupId ON dbo.utbl_ClientGroupMember(GroupId);
    CREATE INDEX IX_utbl_ClientGroupMember_ClientId ON dbo.utbl_ClientGroupMember(ClientId);
    CREATE UNIQUE INDEX UQ_utbl_ClientGroupMember_Active
        ON dbo.utbl_ClientGroupMember(GroupId, ClientId)
        WHERE IsActive = 1;
END
GO

PRINT 'Migration 044 client groups table completed.';
GO
