-- Migration 029: Org team enhancements – team icon/theme color, member tenure, report-to
-- Extends: utbl_Org_Team (Icon, ThemeColor), utbl_Org_TeamMember (LeftAt), hrms_EmployeeProfile (ReportToUserId)

SET NOCOUNT ON;

-- Team: icon and theme color
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.utbl_Org_Team') AND name = 'Icon')
BEGIN
    ALTER TABLE dbo.utbl_Org_Team ADD Icon NVARCHAR(100) NULL;
END
GO
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.utbl_Org_Team') AND name = 'ThemeColor')
BEGIN
    ALTER TABLE dbo.utbl_Org_Team ADD ThemeColor NVARCHAR(20) NULL;
END
GO

-- Team member tenure: when they left the team (NULL = currently in team). One current team per user.
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.utbl_Org_TeamMember') AND name = 'LeftAt')
BEGIN
    ALTER TABLE dbo.utbl_Org_TeamMember ADD LeftAt DATETIME NULL;
END
GO
-- Drop old unique constraint so we can store history (multiple rows per user); enforce one current membership per user
IF EXISTS (SELECT * FROM sys.key_constraints WHERE name = 'UQ_utbl_Org_TeamMember_UserId' AND parent_object_id = OBJECT_ID('dbo.utbl_Org_TeamMember'))
    ALTER TABLE dbo.utbl_Org_TeamMember DROP CONSTRAINT UQ_utbl_Org_TeamMember_UserId;
GO
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_utbl_Org_TeamMember_UserId_Current' AND object_id = OBJECT_ID('dbo.utbl_Org_TeamMember'))
BEGIN
    CREATE UNIQUE INDEX UQ_utbl_Org_TeamMember_UserId_Current ON dbo.utbl_Org_TeamMember(UserId) WHERE LeftAt IS NULL;
END
GO

-- Employee profile: report-to (team leader or upper)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.hrms_EmployeeProfile') AND name = 'ReportToUserId')
BEGIN
    ALTER TABLE dbo.hrms_EmployeeProfile ADD ReportToUserId INT NULL;
    ALTER TABLE dbo.hrms_EmployeeProfile ADD CONSTRAINT FK_hrms_EmployeeProfile_ReportTo
        FOREIGN KEY (ReportToUserId) REFERENCES dbo.rb_users(userid) ON DELETE NO ACTION;
    CREATE INDEX IX_hrms_EmployeeProfile_ReportToUserId ON dbo.hrms_EmployeeProfile(ReportToUserId);
END
GO

PRINT 'Migration 029 org team enhancements completed.';
GO
