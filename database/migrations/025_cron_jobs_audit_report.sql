-- Migration 025: Allow task type send_audit_report in react_CronJobs
-- SQL Server 2008 R2

IF EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CronJobs_TaskType' AND parent_object_id = OBJECT_ID('dbo.react_CronJobs'))
BEGIN
    ALTER TABLE dbo.react_CronJobs DROP CONSTRAINT CK_CronJobs_TaskType;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_CronJobs_TaskType' AND parent_object_id = OBJECT_ID('dbo.react_CronJobs'))
BEGIN
    ALTER TABLE dbo.react_CronJobs ADD CONSTRAINT CK_CronJobs_TaskType
    CHECK (TaskType IN ('send_report', 'send_whatsapp', 'send_audit_report'));
END
GO

PRINT 'Cron jobs migration 025 (audit report task type) completed.';
GO
