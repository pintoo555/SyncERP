-- Migration 019: Multiple Internal Extensions and VOIP numbers per employee
-- Replaces single InternalExtensionNumber/VoIPNumber columns with a child table
-- SQL Server 2008 R2

-- New table for multiple extension and VOIP numbers
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hrms_EmployeeContactNumber' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.hrms_EmployeeContactNumber (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EmployeeUserID INT NOT NULL,
        Type NVARCHAR(20) NOT NULL,  -- 'extension' | 'voip'
        Number NVARCHAR(50) NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_hrms_EmployeeContactNumber_User FOREIGN KEY (EmployeeUserID) REFERENCES dbo.rb_users(userid),
        CONSTRAINT CK_hrms_EmployeeContactNumber_Type CHECK (Type IN ('extension', 'voip'))
    );
    CREATE INDEX IX_hrms_EmployeeContactNumber_EmployeeUserID ON dbo.hrms_EmployeeContactNumber(EmployeeUserID);
END
GO

-- Migrate existing data from profile columns (if they exist)
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.hrms_EmployeeProfile') AND name = 'InternalExtensionNumber')
BEGIN
    INSERT INTO dbo.hrms_EmployeeContactNumber (EmployeeUserID, Type, Number)
    SELECT UserID, 'extension', InternalExtensionNumber
    FROM dbo.hrms_EmployeeProfile
    WHERE InternalExtensionNumber IS NOT NULL AND RTRIM(InternalExtensionNumber) <> '';
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.hrms_EmployeeProfile') AND name = 'VoIPNumber')
BEGIN
    INSERT INTO dbo.hrms_EmployeeContactNumber (EmployeeUserID, Type, Number)
    SELECT UserID, 'voip', VoIPNumber
    FROM dbo.hrms_EmployeeProfile
    WHERE VoIPNumber IS NOT NULL AND RTRIM(VoIPNumber) <> '';
END
GO

-- Drop old columns
IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.hrms_EmployeeProfile') AND name = 'InternalExtensionNumber')
BEGIN
    ALTER TABLE dbo.hrms_EmployeeProfile DROP COLUMN InternalExtensionNumber;
END
GO

IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.hrms_EmployeeProfile') AND name = 'VoIPNumber')
BEGIN
    ALTER TABLE dbo.hrms_EmployeeProfile DROP COLUMN VoIPNumber;
END
GO

PRINT 'HRMS migration 019 completed.';
GO
