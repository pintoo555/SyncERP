-- Run this script in your SQL Server database (same DB as your app uses).
-- In SSMS: open this file, select your database in the dropdown, then Execute (F5).

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_ChatMessage')
BEGIN
    CREATE TABLE react_ChatMessage (
        MessageID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        SenderUserID INT NOT NULL,
        ReceiverUserID INT NOT NULL,
        MessageText NVARCHAR(MAX) NOT NULL,
        SentAt DATETIME NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_react_ChatMessage_Receiver_Sent ON react_ChatMessage(ReceiverUserID, SentAt DESC);
    CREATE INDEX IX_react_ChatMessage_Sender_Sent ON react_ChatMessage(SenderUserID, SentAt DESC);
    PRINT 'react_ChatMessage table created.';
END
ELSE
    PRINT 'react_ChatMessage already exists.';
GO
