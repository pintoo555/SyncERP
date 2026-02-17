-- Migration 015: Health alert thresholds and alerts
-- SQL Server 2008 R2

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_HealthAlertSettings')
BEGIN
    CREATE TABLE dbo.react_HealthAlertSettings (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Metric NVARCHAR(32) NOT NULL,          -- 'cpu' | 'memory' | 'disk'
        ThresholdPercent INT NOT NULL,         -- e.g. 80 = alert when > 80%
        DiskPath NVARCHAR(256) NULL,           -- for disk: which path (null = any)
        [Enabled] BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT CK_HealthAlertSettings_Metric CHECK (Metric IN ('cpu','memory','disk')),
        CONSTRAINT CK_HealthAlertSettings_Threshold CHECK (ThresholdPercent >= 0 AND ThresholdPercent <= 100)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_HealthAlertRecipients')
BEGIN
    CREATE TABLE dbo.react_HealthAlertRecipients (
        SettingsId INT NOT NULL,
        UserId INT NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        PRIMARY KEY (SettingsId, UserId),
        CONSTRAINT FK_HealthAlertRecipients_Settings FOREIGN KEY (SettingsId) REFERENCES dbo.react_HealthAlertSettings(Id) ON DELETE CASCADE,
        CONSTRAINT FK_HealthAlertRecipients_User FOREIGN KEY (UserId) REFERENCES rb_users(userid)
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_HealthAlerts')
BEGIN
    CREATE TABLE dbo.react_HealthAlerts (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        RecipientUserId INT NOT NULL,
        Metric NVARCHAR(32) NOT NULL,
        Message NVARCHAR(512) NOT NULL,
        [Value] DECIMAL(10,2) NOT NULL,
        ThresholdPercent INT NOT NULL,
        DiskPath NVARCHAR(256) NULL,
        Status NVARCHAR(32) NOT NULL DEFAULT 'active',  -- 'active' | 'acknowledged'
        AcknowledgedAt DATETIME NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_HealthAlerts_Recipient FOREIGN KEY (RecipientUserId) REFERENCES rb_users(userid),
        CONSTRAINT CK_HealthAlerts_Status CHECK (Status IN ('active','acknowledged'))
    );
    CREATE INDEX IX_HealthAlerts_Recipient_Status ON dbo.react_HealthAlerts(RecipientUserId, Status, CreatedAt DESC);
END
GO
