-- Migration 020: WhatsApp number with OTP verification for hrms_EmployeeProfile
-- Format: Country Code + 10 digit number (e.g. +919876543210)
-- SQL Server 2008 R2

-- Add WhatsApp columns to EmployeeProfile
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.hrms_EmployeeProfile') AND name = 'WhatsAppNumber')
BEGIN
    ALTER TABLE dbo.hrms_EmployeeProfile ADD WhatsAppNumber NVARCHAR(20) NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.hrms_EmployeeProfile') AND name = 'WhatsAppVerifiedAt')
BEGIN
    ALTER TABLE dbo.hrms_EmployeeProfile ADD WhatsAppVerifiedAt DATETIME NULL;
END
GO

-- OTP storage for WhatsApp verification (expires in 5 minutes)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hrms_WhatsAppOtp' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.hrms_WhatsAppOtp (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UserID INT NOT NULL,
        PhoneNumber NVARCHAR(20) NOT NULL,
        OtpCode NVARCHAR(10) NOT NULL,
        ExpiresAt DATETIME NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_hrms_WhatsAppOtp_User FOREIGN KEY (UserID) REFERENCES dbo.rb_users(userid)
    );
    CREATE INDEX IX_hrms_WhatsAppOtp_UserPhone ON dbo.hrms_WhatsAppOtp(UserID, PhoneNumber);
    CREATE INDEX IX_hrms_WhatsAppOtp_ExpiresAt ON dbo.hrms_WhatsAppOtp(ExpiresAt);
END
GO

PRINT 'HRMS migration 020 (WhatsApp verification) completed.';
GO
