-- Migration 010: API / AI config (OpenAI, Claude, etc.) - scalable for external services
-- SQL Server 2008 R2

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_ApiConfig' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.react_ApiConfig (
        ConfigID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ServiceCode NVARCHAR(50) NOT NULL,
        DisplayName NVARCHAR(200) NOT NULL,
        ApiKey NVARCHAR(MAX) NULL,
        BaseUrl NVARCHAR(500) NULL,
        ExtraConfig NVARCHAR(MAX) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT UQ_react_ApiConfig_ServiceCode UNIQUE (ServiceCode)
    );
    CREATE INDEX IX_react_ApiConfig_IsActive ON dbo.react_ApiConfig(IsActive);
END
GO
