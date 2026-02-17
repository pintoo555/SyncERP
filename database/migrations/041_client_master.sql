-- Migration 041: Client master table
-- Core client entity with auto-generated ClientCode, compliance fields, merge support.
-- ClientCode is derived from Id after insert (CL000001 = Id 1).

SET NOCOUNT ON;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_Client' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_Client (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ClientCode NVARCHAR(20) NOT NULL DEFAULT '',
        ClientName NVARCHAR(200) NOT NULL,
        ClientDisplayName NVARCHAR(200) NULL,
        ClientType NVARCHAR(50) NOT NULL,
        IndustryId BIGINT NULL,
        GSTNumber NVARCHAR(20) NULL,
        PANNumber NVARCHAR(20) NULL,
        IECCode NVARCHAR(30) NULL,
        MSMENumber NVARCHAR(30) NULL,
        CurrencyCode NVARCHAR(10) NOT NULL DEFAULT 'INR',
        CreditLimit DECIMAL(18,2) NOT NULL DEFAULT 0,
        CreditDays INT NOT NULL DEFAULT 0,
        IsBlacklisted BIT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        IsMerged BIT NOT NULL DEFAULT 0,
        MergedIntoClientId BIGINT NULL,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT UQ_utbl_Client_Code UNIQUE (ClientCode),
        CONSTRAINT CK_utbl_Client_Type CHECK (ClientType IN ('OEM','Dealer','EndUser','Govt','Export')),
        CONSTRAINT FK_utbl_Client_Industry FOREIGN KEY (IndustryId) REFERENCES dbo.utbl_Industry(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Client_MergedInto FOREIGN KEY (MergedIntoClientId) REFERENCES dbo.utbl_Client(Id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_utbl_Client_ClientName ON dbo.utbl_Client(ClientName);
    CREATE INDEX IX_utbl_Client_GSTNumber ON dbo.utbl_Client(GSTNumber) WHERE GSTNumber IS NOT NULL;
    CREATE INDEX IX_utbl_Client_IndustryId ON dbo.utbl_Client(IndustryId);
    CREATE INDEX IX_utbl_Client_MergedIntoClientId ON dbo.utbl_Client(MergedIntoClientId) WHERE MergedIntoClientId IS NOT NULL;
    CREATE INDEX IX_utbl_Client_IsActive_IsBlacklisted ON dbo.utbl_Client(IsActive, IsBlacklisted);
    CREATE INDEX IX_utbl_Client_ClientType ON dbo.utbl_Client(ClientType);
END
GO

PRINT 'Migration 041 client master table completed.';
GO
