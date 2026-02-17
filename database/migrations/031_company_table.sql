-- Migration 031: Company master table
-- Supports legal entity details, tax registration, bank details, and address.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_Company' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_Company (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        CompanyCode NVARCHAR(20) NOT NULL,
        LegalName NVARCHAR(300) NOT NULL,
        TradeName NVARCHAR(300) NULL,
        TaxRegistrationNumber NVARCHAR(50) NULL,    -- GST / VAT / EIN
        TaxRegistrationType NVARCHAR(50) NULL,      -- Regular, Composition, etc.
        PAN NVARCHAR(20) NULL,
        CIN NVARCHAR(30) NULL,
        DefaultJurisdictionId INT NULL,
        BankName NVARCHAR(200) NULL,
        BankAccountNumber NVARCHAR(50) NULL,
        BankIFSC NVARCHAR(20) NULL,
        BankBranch NVARCHAR(200) NULL,
        AddressLine1 NVARCHAR(300) NULL,
        AddressLine2 NVARCHAR(300) NULL,
        City NVARCHAR(100) NULL,
        StateId INT NULL,
        CountryId INT NULL,
        Pincode NVARCHAR(20) NULL,
        Phone NVARCHAR(30) NULL,
        Email NVARCHAR(200) NULL,
        Website NVARCHAR(300) NULL,
        LogoUrl NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT UQ_utbl_Company_Code UNIQUE (CompanyCode),
        CONSTRAINT FK_utbl_Company_Jurisdiction FOREIGN KEY (DefaultJurisdictionId) REFERENCES dbo.utbl_TaxJurisdiction(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Company_State FOREIGN KEY (StateId) REFERENCES dbo.utbl_State(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Company_Country FOREIGN KEY (CountryId) REFERENCES dbo.utbl_Country(Id) ON DELETE NO ACTION
    );
    CREATE INDEX IX_utbl_Company_CountryId ON dbo.utbl_Company(CountryId);
    CREATE INDEX IX_utbl_Company_StateId ON dbo.utbl_Company(StateId);
END
GO

PRINT 'Migration 031 company table completed.';
GO
