-- Migration 030: Geography layer – Country, State, TaxJurisdiction
-- Supports multi-country operations with currency and tax jurisdiction tracking.

SET NOCOUNT ON;

-- Country master
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_Country' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_Country (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        CountryCode NVARCHAR(2) NOT NULL,          -- ISO 3166-1 alpha-2
        CountryName NVARCHAR(200) NOT NULL,
        CurrencyCode NVARCHAR(3) NOT NULL,          -- ISO 4217
        CurrencySymbol NVARCHAR(10) NULL,
        PhoneCode NVARCHAR(10) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT UQ_utbl_Country_Code UNIQUE (CountryCode)
    );
END
GO

-- State / Province / Region master
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_State' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_State (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        CountryId INT NOT NULL,
        StateCode NVARCHAR(10) NOT NULL,
        StateName NVARCHAR(200) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_utbl_State_Country FOREIGN KEY (CountryId) REFERENCES dbo.utbl_Country(Id) ON DELETE NO ACTION,
        CONSTRAINT UQ_utbl_State_CountryCode UNIQUE (CountryId, StateCode)
    );
    CREATE INDEX IX_utbl_State_CountryId ON dbo.utbl_State(CountryId);
END
GO

-- Tax Jurisdiction (country-level or state-level taxation)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_TaxJurisdiction' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_TaxJurisdiction (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        CountryId INT NOT NULL,
        StateId INT NULL,                           -- NULL = country-level jurisdiction
        JurisdictionCode NVARCHAR(50) NOT NULL,
        JurisdictionName NVARCHAR(200) NOT NULL,
        TaxType NVARCHAR(20) NOT NULL,
        DefaultTaxRate DECIMAL(5,2) NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_utbl_TaxJurisdiction_Country FOREIGN KEY (CountryId) REFERENCES dbo.utbl_Country(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_TaxJurisdiction_State FOREIGN KEY (StateId) REFERENCES dbo.utbl_State(Id) ON DELETE NO ACTION,
        CONSTRAINT UQ_utbl_TaxJurisdiction_Code UNIQUE (JurisdictionCode),
        CONSTRAINT CK_utbl_TaxJurisdiction_TaxType CHECK (TaxType IN ('GST', 'VAT', 'SALES_TAX', 'NONE'))
    );
    CREATE INDEX IX_utbl_TaxJurisdiction_CountryId ON dbo.utbl_TaxJurisdiction(CountryId);
    CREATE INDEX IX_utbl_TaxJurisdiction_StateId ON dbo.utbl_TaxJurisdiction(StateId);
END
GO

PRINT 'Migration 030 geography tables completed.';
GO
