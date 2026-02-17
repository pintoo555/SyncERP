-- Migration 050: Contact roles (tags) and contact remarks/reviews system.
-- Roles: multi-select categories like Commercial, Technical, Dispatch, Accounting, Purchase.
-- Remarks: per-user reviews with behavior tags and flagging.

SET NOCOUNT ON;

-- 1. Add ContactRoles column to utbl_ClientContact (comma-separated role tags)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.utbl_ClientContact') AND name = 'ContactRoles')
BEGIN
    ALTER TABLE dbo.utbl_ClientContact ADD ContactRoles NVARCHAR(500) NULL;
END
GO

-- 2. Create contact remarks / reviews table
IF NOT EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID('dbo.utbl_ContactRemark') AND type = 'U')
BEGIN
    CREATE TABLE dbo.utbl_ContactRemark (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ContactId BIGINT NOT NULL,
        ClientId BIGINT NOT NULL,
        RemarkText NVARCHAR(2000) NOT NULL,
        BehaviorTags NVARCHAR(500) NULL,
        IsFlagged BIT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedBy INT NULL,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        CONSTRAINT FK_utbl_ContactRemark_Contact FOREIGN KEY (ContactId) REFERENCES dbo.utbl_ClientContact(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_ContactRemark_Client FOREIGN KEY (ClientId) REFERENCES dbo.utbl_Client(Id) ON DELETE NO ACTION
    );

    CREATE NONCLUSTERED INDEX IX_ContactRemark_ContactId ON dbo.utbl_ContactRemark(ContactId);
    CREATE NONCLUSTERED INDEX IX_ContactRemark_ClientId ON dbo.utbl_ContactRemark(ClientId);
END
GO

PRINT 'Migration 050: Added ContactRoles to utbl_ClientContact and created utbl_ContactRemark.';
GO
