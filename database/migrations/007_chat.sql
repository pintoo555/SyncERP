-- Synchronics Asset Management System
-- Migration 007: Chat messages (two users)
-- Database: Microsoft SQL Server 2008 R2
-- SenderUserID and ReceiverUserID reference your user table (e.g. rb_users.userid).
-- No FK added here so this runs even if the user table name/schema differs.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_ChatMessage' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.react_ChatMessage (
        MessageID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SenderUserID INT NOT NULL,
        ReceiverUserID INT NOT NULL,
        MessageText NVARCHAR(MAX) NOT NULL,
        SentAt DATETIME NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_react_ChatMessage_Receiver_Sent ON dbo.react_ChatMessage(ReceiverUserID, SentAt DESC);
    CREATE INDEX IX_react_ChatMessage_Sender_Sent ON dbo.react_ChatMessage(SenderUserID, SentAt DESC);
END
GO
