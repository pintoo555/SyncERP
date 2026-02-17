-- Migration 023: Cron jobs for scheduled tasks (send report, send WhatsApp, etc.)
-- SQL Server 2008 R2

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_CronJobs' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.react_CronJobs (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Name NVARCHAR(200) NOT NULL,
        TaskType NVARCHAR(32) NOT NULL,
        CronExpression NVARCHAR(100) NOT NULL,
        ConfigJson NVARCHAR(MAX) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        LastRunAt DATETIME NULL,
        NextRunAt DATETIME NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT CK_CronJobs_TaskType CHECK (TaskType IN ('send_report', 'send_whatsapp'))
    );
    CREATE INDEX IX_CronJobs_IsActive_NextRunAt ON dbo.react_CronJobs(IsActive, NextRunAt) WHERE IsActive = 1;
END
GO

PRINT 'Cron jobs migration 023 completed.';
GO
