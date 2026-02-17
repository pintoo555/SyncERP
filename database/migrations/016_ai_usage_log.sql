-- Migration 016: AI API usage log for analytics
-- SQL Server 2008 R2

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_AIUsageLog' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.react_AIUsageLog (
        LogID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UserID INT NOT NULL,
        ConfigID INT NULL,
        ServiceCode NVARCHAR(50) NULL,
        DisplayName NVARCHAR(200) NULL,
        Model NVARCHAR(100) NULL,
        Feature NVARCHAR(100) NOT NULL,
        RequestedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_AIUsageLog_User FOREIGN KEY (UserID) REFERENCES dbo.rb_users(userid)
    );
    CREATE INDEX IX_react_AIUsageLog_UserID ON dbo.react_AIUsageLog(UserID);
    CREATE INDEX IX_react_AIUsageLog_ConfigID ON dbo.react_AIUsageLog(ConfigID);
    CREATE INDEX IX_react_AIUsageLog_ServiceCode ON dbo.react_AIUsageLog(ServiceCode);
    CREATE INDEX IX_react_AIUsageLog_Feature ON dbo.react_AIUsageLog(Feature);
    CREATE INDEX IX_react_AIUsageLog_RequestedAt ON dbo.react_AIUsageLog(RequestedAt);
END
GO
