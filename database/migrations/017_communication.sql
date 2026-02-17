-- Migration 017: Communication Module - WhatsApp, SMS, multi-provider support
-- Supports Ultramsg and other providers; send/receive messages, dashboard & reporting
-- SQL Server 2008 R2

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_CommunicationChannel' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.react_CommunicationChannel (
        ChannelID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        Name NVARCHAR(100) NOT NULL,
        ChannelType NVARCHAR(50) NOT NULL,  -- 'whatsapp', 'sms', etc.
        ProviderCode NVARCHAR(50) NOT NULL, -- 'ultramsg', 'twilio', etc.
        InstanceId NVARCHAR(200) NULL,      -- Ultramsg instance ID
        Token NVARCHAR(500) NULL,           -- API token (encrypted/stored)
        ConfigJson NVARCHAR(MAX) NULL,      -- Extra provider config
        IsActive BIT NOT NULL DEFAULT 1,
        IsDefault BIT NOT NULL DEFAULT 0,
        WebhookUrl NVARCHAR(500) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NOT NULL DEFAULT GETDATE()
    );
    CREATE INDEX IX_react_CommunicationChannel_ChannelType ON dbo.react_CommunicationChannel(ChannelType);
    CREATE INDEX IX_react_CommunicationChannel_ProviderCode ON dbo.react_CommunicationChannel(ProviderCode);
    CREATE INDEX IX_react_CommunicationChannel_IsActive ON dbo.react_CommunicationChannel(IsActive);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_CommunicationMessage' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.react_CommunicationMessage (
        MessageID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ChannelID INT NOT NULL,
        Direction NVARCHAR(10) NOT NULL,    -- 'outbound', 'inbound'
        ExternalId NVARCHAR(200) NULL,      -- Provider message ID
        FromNumber NVARCHAR(50) NOT NULL,
        ToNumber NVARCHAR(50) NOT NULL,
        Body NVARCHAR(MAX) NULL,
        MessageType NVARCHAR(50) NOT NULL DEFAULT 'text',  -- text, image, document, etc.
        Status NVARCHAR(50) NULL,           -- sent, delivered, read, failed, queued
        SentByUserID INT NULL,              -- Who sent (for outbound)
        ReceivedAt DATETIME NULL,
        SentAt DATETIME NULL,
        MetadataJson NVARCHAR(MAX) NULL,
        CONSTRAINT FK_CommunicationMessage_Channel FOREIGN KEY (ChannelID) REFERENCES dbo.react_CommunicationChannel(ChannelID),
        CONSTRAINT FK_CommunicationMessage_User FOREIGN KEY (SentByUserID) REFERENCES dbo.rb_users(userid)
    );
    CREATE INDEX IX_react_CommunicationMessage_ChannelID ON dbo.react_CommunicationMessage(ChannelID);
    CREATE INDEX IX_react_CommunicationMessage_Direction ON dbo.react_CommunicationMessage(Direction);
    CREATE INDEX IX_react_CommunicationMessage_FromNumber ON dbo.react_CommunicationMessage(FromNumber);
    CREATE INDEX IX_react_CommunicationMessage_ToNumber ON dbo.react_CommunicationMessage(ToNumber);
    CREATE INDEX IX_react_CommunicationMessage_SentAt ON dbo.react_CommunicationMessage(SentAt);
    CREATE INDEX IX_react_CommunicationMessage_ReceivedAt ON dbo.react_CommunicationMessage(ReceivedAt);
    CREATE INDEX IX_react_CommunicationMessage_SentByUserID ON dbo.react_CommunicationMessage(SentByUserID);
END
GO
