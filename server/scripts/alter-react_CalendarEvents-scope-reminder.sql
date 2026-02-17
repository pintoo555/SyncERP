-- Add Scope (personal/company) and ReminderMinutes to calendar events.
-- Run after create-react_CalendarEvents.sql. Uses dbo; change if your schema differs.

IF NOT EXISTS (
  SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
  WHERE t.name = N'react_CalendarEvents' AND s.name = N'dbo' AND c.name = N'Scope'
)
BEGIN
  ALTER TABLE [dbo].[react_CalendarEvents]
    ADD [Scope] NVARCHAR(20) NOT NULL DEFAULT N'company',
        [ReminderMinutes] INT NULL;

  CREATE INDEX [IX_react_CalendarEvents_Scope] ON [dbo].[react_CalendarEvents] ([Scope]);
END
GO
