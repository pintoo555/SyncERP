-- Migration 005: Search table (precomputed text) and Audit log
-- SQL Server 2008 R2

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_AssetSearch')
BEGIN
    CREATE TABLE react_AssetSearch (
        AssetID INT NOT NULL PRIMARY KEY,
        SearchText NVARCHAR(MAX) NULL,
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_react_AssetSearch_Asset FOREIGN KEY (AssetID) REFERENCES react_Asset(AssetID)
    );
    CREATE INDEX IX_react_AssetSearch_UpdatedAt ON react_AssetSearch(UpdatedAt);
END
GO
-- Note: For fast text search use application-level indexing; optional fulltext can be added
-- on editions that support it: CREATE FULLTEXT INDEX ON react_AssetSearch(SearchText) ...

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_AuditLog')
BEGIN
    CREATE TABLE react_AuditLog (
        AuditID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EventType NVARCHAR(50) NOT NULL,
        EntityType NVARCHAR(50) NULL,
        EntityID NVARCHAR(100) NULL,
        UserID INT NULL,
        UserEmail NVARCHAR(100) NULL,
        IPAddress NVARCHAR(45) NULL,
        UserAgent NVARCHAR(500) NULL,
        Details NVARCHAR(MAX) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_react_AuditLog_EventType ON react_AuditLog(EventType);
    CREATE INDEX IX_react_AuditLog_EntityType_EntityID ON react_AuditLog(EntityType, EntityID);
    CREATE INDEX IX_react_AuditLog_UserID ON react_AuditLog(UserID);
    CREATE INDEX IX_react_AuditLog_CreatedAt ON react_AuditLog(CreatedAt);
END
GO
