-- Migration 012: App-wide settings (timezone, etc.) for General Settings.
-- Used by GET/PUT /api/settings/app.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_AppSettings' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.react_AppSettings (
        [Key] NVARCHAR(128) NOT NULL PRIMARY KEY,
        [Value] NVARCHAR(500) NULL,
        UpdatedAt DATETIME NULL
    );
    -- Default timezone: Kolkata (GMT+5:30)
    INSERT INTO dbo.react_AppSettings ([Key], [Value], UpdatedAt)
    VALUES ('TimeZone', 'Asia/Kolkata', GETDATE());
END
GO
