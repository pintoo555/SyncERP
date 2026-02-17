-- Migration 043: Client contacts table
-- Multi-contact support with primary flag, replacement chain, department/designation.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_ClientContact' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_ClientContact (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ClientId BIGINT NOT NULL,
        ContactName NVARCHAR(200) NOT NULL,
        Designation NVARCHAR(100) NULL,
        Department NVARCHAR(100) NULL,
        MobileNumber NVARCHAR(20) NULL,
        AlternateNumber NVARCHAR(20) NULL,
        Email NVARCHAR(200) NULL,
        WhatsAppNumber NVARCHAR(20) NULL,
        IsPrimary BIT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        InactiveDate DATETIME NULL,
        ReplacedByContactId BIGINT NULL,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_utbl_ClientContact_Client FOREIGN KEY (ClientId) REFERENCES dbo.utbl_Client(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_ClientContact_ReplacedBy FOREIGN KEY (ReplacedByContactId) REFERENCES dbo.utbl_ClientContact(Id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_utbl_ClientContact_ClientId ON dbo.utbl_ClientContact(ClientId, IsActive);
    CREATE INDEX IX_utbl_ClientContact_Mobile ON dbo.utbl_ClientContact(MobileNumber) WHERE MobileNumber IS NOT NULL;
    CREATE INDEX IX_utbl_ClientContact_Email ON dbo.utbl_ClientContact(Email) WHERE Email IS NOT NULL;
    CREATE UNIQUE INDEX UQ_utbl_ClientContact_Primary
        ON dbo.utbl_ClientContact(ClientId)
        WHERE IsPrimary = 1 AND IsActive = 1;
END
GO

PRINT 'Migration 043 client contacts table completed.';
GO
