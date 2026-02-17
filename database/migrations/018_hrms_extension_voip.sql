-- Migration 018: Add Internal Extension (EPABX) and VoIP Number to HRMS Employee Profile
-- Editable only by HR; read-only on My Profile page
-- SQL Server 2008 R2

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.hrms_EmployeeProfile') AND name = 'InternalExtensionNumber')
BEGIN
    ALTER TABLE dbo.hrms_EmployeeProfile ADD InternalExtensionNumber NVARCHAR(30) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.hrms_EmployeeProfile') AND name = 'VoIPNumber')
BEGIN
    ALTER TABLE dbo.hrms_EmployeeProfile ADD VoIPNumber NVARCHAR(50) NULL;
END
GO

PRINT 'HRMS migration 018 completed.';
GO
