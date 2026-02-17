-- Calendar events table (react_ prefix per ERP naming).
-- Run this script against your database (e.g. SyncFinalNew) once.
-- Uses dbo schema by default; change [dbo] if your tables use another schema.

IF NOT EXISTS (
  SELECT 1 FROM sys.tables t
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE t.name = N'react_CalendarEvents' AND s.name = N'dbo'
)
BEGIN
  CREATE TABLE [dbo].[react_CalendarEvents] (
    [Id]                INT IDENTITY(1,1) NOT NULL,
    [Title]             NVARCHAR(500)    NOT NULL,
    [Start]             DATETIME2(0)     NOT NULL,
    [End]               DATETIME2(0)     NULL,
    [AllDay]            BIT              NOT NULL DEFAULT 1,
    [Category]          NVARCHAR(50)     NOT NULL DEFAULT N'primary',
    [CreatedByUserId]   INT              NOT NULL,
    [CreatedAt]         DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
    [UpdatedAt]         DATETIME2(0)     NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT [PK_react_CalendarEvents] PRIMARY KEY ([Id]),
    CONSTRAINT [FK_react_CalendarEvents_CreatedBy] FOREIGN KEY ([CreatedByUserId]) REFERENCES [dbo].[rb_users]([userid])
  );

  CREATE INDEX [IX_react_CalendarEvents_Start] ON [dbo].[react_CalendarEvents] ([Start]);
  CREATE INDEX [IX_react_CalendarEvents_CreatedByUserId] ON [dbo].[react_CalendarEvents] ([CreatedByUserId]);
END
GO
