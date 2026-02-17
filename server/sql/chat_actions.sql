-- Chat actions: reply, react, forward, delete (for me / for everyone), star.
-- Run once after chat_attachments.sql. Tables/columns are created in dbo.

-- 1) Add ReplyToMessageID to react_ChatMessage (for reply-to-message)
IF EXISTS (SELECT 1 FROM sys.tables t WHERE t.name = N'react_ChatMessage')
  AND NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id WHERE t.name = N'react_ChatMessage' AND c.name = N'ReplyToMessageID')
BEGIN
  DECLARE @tbl NVARCHAR(256);
  SELECT @tbl = QUOTENAME(OBJECT_SCHEMA_NAME(t.object_id)) + N'.' + QUOTENAME(t.name)
  FROM sys.tables t WHERE t.name = N'react_ChatMessage';
  EXEC(N'ALTER TABLE ' + @tbl + N' ADD ReplyToMessageID INT NULL');
END;
GO

-- 2) Add DeletedAt, DeletedByUserID for "delete for everyone"
IF EXISTS (SELECT 1 FROM sys.tables t WHERE t.name = N'react_ChatMessage')
  AND NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id WHERE t.name = N'react_ChatMessage' AND c.name = N'DeletedAt')
BEGIN
  DECLARE @tbl2 NVARCHAR(256);
  SELECT @tbl2 = QUOTENAME(OBJECT_SCHEMA_NAME(t.object_id)) + N'.' + QUOTENAME(t.name)
  FROM sys.tables t WHERE t.name = N'react_ChatMessage';
  EXEC(N'ALTER TABLE ' + @tbl2 + N' ADD DeletedAt DATETIME NULL, DeletedByUserID INT NULL');
END;
GO

-- 3) react_ChatReaction: one emoji per user per message
IF NOT EXISTS (SELECT 1 FROM sys.tables t WHERE t.name = N'react_ChatReaction' AND t.schema_id = SCHEMA_ID(N'dbo'))
BEGIN
  CREATE TABLE dbo.react_ChatReaction (
    MessageID INT NOT NULL,
    UserID INT NOT NULL,
    Emoji NVARCHAR(32) NOT NULL,
    ReactedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
    PRIMARY KEY (MessageID, UserID)
  );
  CREATE INDEX IX_react_ChatReaction_MessageID ON dbo.react_ChatReaction(MessageID);
END;

-- 4) react_ChatMessageHidden: "delete for me" (user hid this message)
IF NOT EXISTS (SELECT 1 FROM sys.tables t WHERE t.name = N'react_ChatMessageHidden' AND t.schema_id = SCHEMA_ID(N'dbo'))
BEGIN
  CREATE TABLE dbo.react_ChatMessageHidden (
    MessageID INT NOT NULL,
    UserID INT NOT NULL,
    HiddenAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
    PRIMARY KEY (MessageID, UserID)
  );
  CREATE INDEX IX_react_ChatMessageHidden_UserID ON dbo.react_ChatMessageHidden(UserID);
END;

-- 5) react_ChatStarred: user starred this message
IF NOT EXISTS (SELECT 1 FROM sys.tables t WHERE t.name = N'react_ChatStarred' AND t.schema_id = SCHEMA_ID(N'dbo'))
BEGIN
  CREATE TABLE dbo.react_ChatStarred (
    MessageID INT NOT NULL,
    UserID INT NOT NULL,
    StarredAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
    PRIMARY KEY (MessageID, UserID)
  );
  CREATE INDEX IX_react_ChatStarred_UserID ON dbo.react_ChatStarred(UserID);
END;

-- 6) react_ChatPinned: one pinned message per user per conversation (like WhatsApp)
IF NOT EXISTS (SELECT 1 FROM sys.tables t WHERE t.name = N'react_ChatPinned' AND t.schema_id = SCHEMA_ID(N'dbo'))
BEGIN
  CREATE TABLE dbo.react_ChatPinned (
    UserID INT NOT NULL,
    PartnerID INT NOT NULL,
    MessageID INT NOT NULL,
    PinnedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
    PRIMARY KEY (UserID, PartnerID)
  );
  CREATE INDEX IX_react_ChatPinned_UserID ON dbo.react_ChatPinned(UserID);
END;
