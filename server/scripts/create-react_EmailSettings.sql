-- Email settings: multiple SMTP or API-based email configs. One can be default.
-- Run once. Uses dbo; change [dbo] if your schema differs.

IF NOT EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE t.name = N'react_EmailSettings' AND s.name = N'dbo'
)
BEGIN
  CREATE TABLE [dbo].[react_EmailSettings] (
    [Id]           INT IDENTITY(1,1) NOT NULL,
    [Name]         NVARCHAR(200)    NOT NULL,
    [Type]         NVARCHAR(20)     NOT NULL,
    [IsDefault]    BIT              NOT NULL DEFAULT 0,
    [IsActive]     BIT              NOT NULL DEFAULT 1,
    [FromEmail]    NVARCHAR(256)    NOT NULL,
    [FromName]     NVARCHAR(200)    NULL,
    -- SMTP
    [SmtpHost]     NVARCHAR(256)    NULL,
    [SmtpPort]     INT              NULL,
    [SmtpSecure]   BIT              NULL DEFAULT 0,
    [SmtpUsername] NVARCHAR(256)    NULL,
    [SmtpPassword] NVARCHAR(500)    NULL,
    -- API
    [ApiProvider]  NVARCHAR(50)     NULL,
    [ApiUrl]       NVARCHAR(500)    NULL,
    [ApiKey]       NVARCHAR(500)    NULL,
    [ApiDomain]    NVARCHAR(256)    NULL,
    [CreatedAt]    DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
    [UpdatedAt]    DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT [PK_react_EmailSettings] PRIMARY KEY ([Id]),
    CONSTRAINT [CK_react_EmailSettings_Type] CHECK ([Type] IN (N'smtp', N'api'))
  );

  CREATE INDEX [IX_react_EmailSettings_IsDefault] ON [dbo].[react_EmailSettings] ([IsDefault]);
  CREATE INDEX [IX_react_EmailSettings_Type] ON [dbo].[react_EmailSettings] ([Type]);
END
GO
