-- Migration 045: Client relationships table
-- Tracks rename, merge, subsidiary, division, sister-company relationships.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_ClientRelationship' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_ClientRelationship (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ParentClientId BIGINT NOT NULL,
        ChildClientId BIGINT NOT NULL,
        RelationshipType NVARCHAR(30) NOT NULL,
        EffectiveFrom DATE NOT NULL,
        EffectiveTo DATE NULL,
        Remarks NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT CK_utbl_ClientRelationship_Type CHECK (RelationshipType IN ('RenamedTo','RenamedFrom','MergedWith','SubsidiaryOf','DivisionOf','SisterCompany')),
        CONSTRAINT FK_utbl_ClientRelationship_Parent FOREIGN KEY (ParentClientId) REFERENCES dbo.utbl_Client(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_ClientRelationship_Child FOREIGN KEY (ChildClientId) REFERENCES dbo.utbl_Client(Id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_utbl_ClientRelationship_Parent ON dbo.utbl_ClientRelationship(ParentClientId);
    CREATE INDEX IX_utbl_ClientRelationship_Child ON dbo.utbl_ClientRelationship(ChildClientId);
    CREATE INDEX IX_utbl_ClientRelationship_Composite ON dbo.utbl_ClientRelationship(ParentClientId, ChildClientId, RelationshipType);
END
GO

PRINT 'Migration 045 client relationships table completed.';
GO
