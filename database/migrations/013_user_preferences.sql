-- Migration 013: Per-user preferences (e.g. idle lock minutes).
-- Used by GET/PUT /api/settings/user.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_UserPreferences' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.react_UserPreferences (
        UserId INT NOT NULL,
        [Key] NVARCHAR(128) NOT NULL,
        [Value] NVARCHAR(500) NULL,
        UpdatedAt DATETIME NULL,
        CONSTRAINT PK_react_UserPreferences PRIMARY KEY (UserId, [Key])
    );
END
GO
