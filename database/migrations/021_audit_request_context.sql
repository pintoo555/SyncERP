-- Migration 021: Add RequestMethod and RequestPath to react_AuditLog for request context.
-- SQL Server 2008 R2

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('react_AuditLog') AND name = 'RequestMethod'
)
BEGIN
    ALTER TABLE react_AuditLog ADD RequestMethod NVARCHAR(10) NULL;
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('react_AuditLog') AND name = 'RequestPath'
)
BEGIN
    ALTER TABLE react_AuditLog ADD RequestPath NVARCHAR(500) NULL;
END
GO
