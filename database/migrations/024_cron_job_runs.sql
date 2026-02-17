-- Migration 024: Cron job run history (for dashboard and history list)
-- SQL Server 2008 R2

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_CronJobRuns' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.react_CronJobRuns (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        CronJobId INT NOT NULL,
        RunAt DATETIME NOT NULL DEFAULT GETDATE(),
        Status NVARCHAR(16) NOT NULL,
        ErrorMessage NVARCHAR(MAX) NULL,
        DurationMs INT NULL,
        CONSTRAINT FK_CronJobRuns_Job FOREIGN KEY (CronJobId) REFERENCES dbo.react_CronJobs(Id) ON DELETE CASCADE,
        CONSTRAINT CK_CronJobRuns_Status CHECK (Status IN ('success', 'failed'))
    );
    CREATE INDEX IX_CronJobRuns_CronJobId ON dbo.react_CronJobRuns(CronJobId);
    CREATE INDEX IX_CronJobRuns_RunAt ON dbo.react_CronJobRuns(RunAt DESC);
END
GO

PRINT 'Cron job runs migration 024 completed.';
GO
