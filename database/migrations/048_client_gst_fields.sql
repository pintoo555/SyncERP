-- Migration 048: Add GSTZen response fields to utbl_Client
-- Stores trade name, GST type, registration date, company status from GST verification.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.utbl_Client') AND name = 'TradeName')
BEGIN
    ALTER TABLE dbo.utbl_Client ADD TradeName NVARCHAR(200) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.utbl_Client') AND name = 'GSTType')
BEGIN
    ALTER TABLE dbo.utbl_Client ADD GSTType NVARCHAR(50) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.utbl_Client') AND name = 'GSTRegistrationDate')
BEGIN
    ALTER TABLE dbo.utbl_Client ADD GSTRegistrationDate DATE NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.utbl_Client') AND name = 'CompanyStatus')
BEGIN
    ALTER TABLE dbo.utbl_Client ADD CompanyStatus NVARCHAR(50) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.utbl_Client') AND name = 'GSTVerified')
BEGIN
    ALTER TABLE dbo.utbl_Client ADD GSTVerified BIT NOT NULL DEFAULT 0;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.utbl_Client') AND name = 'GSTVerifiedOn')
BEGIN
    ALTER TABLE dbo.utbl_Client ADD GSTVerifiedOn DATETIME NULL;
END
GO

PRINT 'Migration 048: Added GSTZen fields to utbl_Client.';
GO
