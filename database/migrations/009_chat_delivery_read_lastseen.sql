-- Migration 009: Chat delivery/read receipts and last seen
-- Database: Microsoft SQL Server 2008 R2

-- Add DeliveredAt and ReadAt to chat messages (nullable)
IF NOT EXISTS (SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = 'react_ChatMessage' AND c.name = 'DeliveredAt')
BEGIN
  ALTER TABLE dbo.react_ChatMessage ADD DeliveredAt DATETIME NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns c
  INNER JOIN sys.tables t ON c.object_id = t.object_id
  WHERE t.name = 'react_ChatMessage' AND c.name = 'ReadAt')
BEGIN
  ALTER TABLE dbo.react_ChatMessage ADD ReadAt DATETIME NULL;
END
GO

-- Last seen per user (updated on connect, send, mark-read)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_UserLastSeen' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
  CREATE TABLE dbo.react_UserLastSeen (
    UserID INT NOT NULL PRIMARY KEY,
    LastSeenAt DATETIME NOT NULL DEFAULT GETDATE()
  );
END
GO
