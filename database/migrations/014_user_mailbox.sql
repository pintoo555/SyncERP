-- Migration 014: Per-user mailbox credentials for webmail (hMailServer IMAP/SMTP).
-- Password stored encrypted. Used by /api/mailbox/*.

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_UserMailbox' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.react_UserMailbox (
        UserId INT NOT NULL,
        Email NVARCHAR(256) NOT NULL,
        EncryptedPassword NVARCHAR(500) NOT NULL,
        ImapHost NVARCHAR(256) NOT NULL,
        ImapPort INT NOT NULL,
        ImapSecure BIT NOT NULL,
        SmtpHost NVARCHAR(256) NOT NULL,
        SmtpPort INT NOT NULL,
        SmtpSecure BIT NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT SYSDATETIME(),
        UpdatedAt DATETIME NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT PK_react_UserMailbox PRIMARY KEY (UserId),
        CONSTRAINT FK_react_UserMailbox_User FOREIGN KEY (UserId) REFERENCES rb_users(userid)
    );
    PRINT 'Table react_UserMailbox created.';
END
ELSE
    PRINT 'Table react_UserMailbox already exists.';
GO
