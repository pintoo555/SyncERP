-- Migration 039: Username for login, Email for contact; Internal email (HmailServer) on profile
-- 1. Add Username to rb_users (unique), backfill from Email, then use for authentication
-- 2. Add InternalEmail and InternalEmailPassword (encrypted) to hrms_EmployeeProfile for HmailServer

SET NOCOUNT ON;

-- Step 1a: Add Username column to rb_users if not exists (must be in its own batch so CREATE INDEX in next batch sees the column)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.rb_users') AND name = 'Username')
BEGIN
    ALTER TABLE dbo.rb_users ADD Username NVARCHAR(256) NULL;
    PRINT 'Added Username to rb_users';
END
GO

-- Step 1b: Create unique index on Username (separate batch so column exists at compile time)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.rb_users') AND name = 'UQ_rb_users_Username')
BEGIN
    CREATE UNIQUE INDEX UQ_rb_users_Username ON dbo.rb_users(Username) WHERE Username IS NOT NULL;
    PRINT 'Created unique index UQ_rb_users_Username';
END
GO

-- Step 1c: Backfill Username from Email for existing users (so current logins keep working)
UPDATE dbo.rb_users SET Username = LTRIM(RTRIM(Email)) WHERE Username IS NULL AND Email IS NOT NULL AND LTRIM(RTRIM(Email)) <> '';
PRINT 'Backfilled Username from Email.';
GO

-- Step 2: Add InternalEmail and InternalEmailPassword to hrms_EmployeeProfile (for HmailServer / email module)
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.hrms_EmployeeProfile') AND name = 'InternalEmail')
BEGIN
    ALTER TABLE dbo.hrms_EmployeeProfile ADD InternalEmail NVARCHAR(256) NULL;
    PRINT 'Added InternalEmail to hrms_EmployeeProfile';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.hrms_EmployeeProfile') AND name = 'InternalEmailPassword')
BEGIN
    ALTER TABLE dbo.hrms_EmployeeProfile ADD InternalEmailPassword NVARCHAR(500) NULL;
    PRINT 'Added InternalEmailPassword to hrms_EmployeeProfile';
END
GO

PRINT 'Migration 039 username and internal email completed.';
GO
