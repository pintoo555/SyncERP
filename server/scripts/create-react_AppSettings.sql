-- Universal app settings (react_ prefix). Used for timezone and other app-wide config.
-- Run once. Uses dbo by default; change [dbo] if your schema differs.

IF NOT EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE t.name = N'react_AppSettings' AND s.name = N'dbo'
)
BEGIN
  CREATE TABLE [dbo].[react_AppSettings] (
    [Id]    INT IDENTITY(1,1) NOT NULL,
    [Key]   NVARCHAR(128)    NOT NULL,
    [Value] NVARCHAR(500)    NOT NULL,
    [UpdatedAt] DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT [PK_react_AppSettings] PRIMARY KEY ([Id]),
    CONSTRAINT [UQ_react_AppSettings_Key] UNIQUE ([Key])
  );

  CREATE INDEX [IX_react_AppSettings_Key] ON [dbo].[react_AppSettings] ([Key]);

  -- Default timezone for the entire app (display and calendar).
  INSERT INTO [dbo].[react_AppSettings] ([Key], [Value]) VALUES (N'TimeZone', N'Asia/Kolkata');
END
GO
