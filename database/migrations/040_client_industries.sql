-- Migration 040: Industry master table for Client module
-- Normalized industry reference data with categories.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_Industry' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_Industry (
        Id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        IndustryName NVARCHAR(200) NOT NULL,
        IndustryCategory NVARCHAR(50) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT UQ_utbl_Industry_Name UNIQUE (IndustryName),
        CONSTRAINT CK_utbl_Industry_Category CHECK (IndustryCategory IN ('Process','Heavy','Manufacturing','Govt','Other'))
    );
    CREATE INDEX IX_utbl_Industry_Category ON dbo.utbl_Industry(IndustryCategory);
    CREATE INDEX IX_utbl_Industry_IsActive ON dbo.utbl_Industry(IsActive);
END
GO

PRINT 'Migration 040 industry table completed.';
GO
