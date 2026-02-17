-- Add LeftAt to utbl_Org_TeamMember if migration 029 was not run.
-- Run this against your database to fix "Invalid column name 'LeftAt'".

SET NOCOUNT ON;

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.utbl_Org_TeamMember') AND name = 'LeftAt')
BEGIN
    ALTER TABLE dbo.utbl_Org_TeamMember ADD LeftAt DATETIME NULL;
END
GO

-- Drop old unique constraint (enforced by a constraint, not a standalone index) so we can store history
IF EXISTS (SELECT * FROM sys.key_constraints WHERE name = 'UQ_utbl_Org_TeamMember_UserId' AND parent_object_id = OBJECT_ID('dbo.utbl_Org_TeamMember'))
    ALTER TABLE dbo.utbl_Org_TeamMember DROP CONSTRAINT UQ_utbl_Org_TeamMember_UserId;
GO

IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_utbl_Org_TeamMember_UserId_Current' AND object_id = OBJECT_ID('dbo.utbl_Org_TeamMember'))
BEGIN
    CREATE UNIQUE INDEX UQ_utbl_Org_TeamMember_UserId_Current ON dbo.utbl_Org_TeamMember(UserId) WHERE LeftAt IS NULL;
END
GO

PRINT 'LeftAt column and index updated.';
GO
