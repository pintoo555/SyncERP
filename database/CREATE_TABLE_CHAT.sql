-- ============================================================
-- Create Chat table - run this in the SAME database your app uses
-- (check server .env: DB_NAME = your database name)
-- In SSMS: select that database in the dropdown, then run this (F5).
-- ============================================================

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
    PRINT 'Table dbo.react_ChatMessage created successfully.';
END
ELSE
    PRINT 'Table dbo.react_ChatMessage already exists.';
GO
