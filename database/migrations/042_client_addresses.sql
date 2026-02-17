-- Migration 042: Client addresses table
-- Multi-address support with types, default flag, linked to geography tables.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_ClientAddress' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_ClientAddress (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ClientId BIGINT NOT NULL,
        AddressType NVARCHAR(30) NOT NULL,
        AddressLine1 NVARCHAR(300) NOT NULL,
        AddressLine2 NVARCHAR(300) NULL,
        City NVARCHAR(100) NULL,
        StateId INT NULL,
        CountryId INT NULL,
        Pincode NVARCHAR(10) NULL,
        IsDefault BIT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT CK_utbl_ClientAddress_Type CHECK (AddressType IN ('Billing','Shipping','HO','Factory','Other')),
        CONSTRAINT FK_utbl_ClientAddress_Client FOREIGN KEY (ClientId) REFERENCES dbo.utbl_Client(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_ClientAddress_State FOREIGN KEY (StateId) REFERENCES dbo.utbl_State(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_ClientAddress_Country FOREIGN KEY (CountryId) REFERENCES dbo.utbl_Country(Id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_utbl_ClientAddress_ClientId ON dbo.utbl_ClientAddress(ClientId);
    CREATE INDEX IX_utbl_ClientAddress_Type ON dbo.utbl_ClientAddress(ClientId, AddressType);
    CREATE UNIQUE INDEX UQ_utbl_ClientAddress_Default
        ON dbo.utbl_ClientAddress(ClientId, AddressType)
        WHERE IsDefault = 1 AND IsActive = 1;
END
GO

PRINT 'Migration 042 client addresses table completed.';
GO
