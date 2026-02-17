-- Migration 026: Organization structure – departments, designations, teams, promotions (utbl_ convention)
-- New tables: utbl_Org_Department, utbl_Org_Designation, utbl_Org_Team, utbl_Org_TeamMember, utbl_Org_PromotionHistory
-- Extends: hrms_EmployeeProfile with OrgDepartmentId, OrgDesignationId

SET NOCOUNT ON;

-- Department master (new; not sync_Department)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_Org_Department' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_Org_Department (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DepartmentCode NVARCHAR(50) NOT NULL,
        DepartmentName NVARCHAR(200) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        SortOrder INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL
    );
    CREATE UNIQUE INDEX IX_utbl_Org_Department_Code ON dbo.utbl_Org_Department(DepartmentCode);
END
GO

-- Designation per department (level, leader flag)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_Org_Designation' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_Org_Designation (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DepartmentId INT NOT NULL,
        Name NVARCHAR(200) NOT NULL,
        Level INT NOT NULL,
        IsLeader BIT NOT NULL DEFAULT 0,
        SortOrder INT NOT NULL DEFAULT 0,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CONSTRAINT FK_utbl_Org_Designation_Department FOREIGN KEY (DepartmentId) REFERENCES dbo.utbl_Org_Department(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_utbl_Org_Designation_DepartmentId ON dbo.utbl_Org_Designation(DepartmentId);
END
GO

-- Team (department, optional parent, lead user, level)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_Org_Team' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_Org_Team (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        DepartmentId INT NOT NULL,
        Name NVARCHAR(200) NOT NULL,
        ParentTeamId INT NULL,
        LeadUserId INT NULL,
        Level INT NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CONSTRAINT FK_utbl_Org_Team_Department FOREIGN KEY (DepartmentId) REFERENCES dbo.utbl_Org_Department(Id) ON DELETE CASCADE,
        CONSTRAINT FK_utbl_Org_Team_Parent FOREIGN KEY (ParentTeamId) REFERENCES dbo.utbl_Org_Team(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Org_Team_LeadUser FOREIGN KEY (LeadUserId) REFERENCES dbo.rb_users(userid) ON DELETE NO ACTION
    );
    CREATE INDEX IX_utbl_Org_Team_DepartmentId ON dbo.utbl_Org_Team(DepartmentId);
    CREATE INDEX IX_utbl_Org_Team_LeadUserId ON dbo.utbl_Org_Team(LeadUserId);
END
GO

-- Team membership: one team per user (unique UserId)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_Org_TeamMember' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_Org_TeamMember (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TeamId INT NOT NULL,
        UserId INT NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_utbl_Org_TeamMember_Team FOREIGN KEY (TeamId) REFERENCES dbo.utbl_Org_Team(Id) ON DELETE CASCADE,
        CONSTRAINT FK_utbl_Org_TeamMember_User FOREIGN KEY (UserId) REFERENCES dbo.rb_users(userid) ON DELETE CASCADE,
        CONSTRAINT UQ_utbl_Org_TeamMember_UserId UNIQUE (UserId)
    );
    CREATE INDEX IX_utbl_Org_TeamMember_TeamId ON dbo.utbl_Org_TeamMember(TeamId);
END
GO

-- Promotion / demotion / transfer history
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_Org_PromotionHistory' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_Org_PromotionHistory (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UserId INT NOT NULL,
        FromDesignationId INT NULL,
        ToDesignationId INT NULL,
        FromTeamId INT NULL,
        ToTeamId INT NULL,
        EffectiveDate DATE NOT NULL,
        ChangeType NVARCHAR(20) NOT NULL,
        Notes NVARCHAR(500) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        CONSTRAINT FK_utbl_Org_PromotionHistory_User FOREIGN KEY (UserId) REFERENCES dbo.rb_users(userid) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Org_PromotionHistory_FromDesig FOREIGN KEY (FromDesignationId) REFERENCES dbo.utbl_Org_Designation(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Org_PromotionHistory_ToDesig FOREIGN KEY (ToDesignationId) REFERENCES dbo.utbl_Org_Designation(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Org_PromotionHistory_FromTeam FOREIGN KEY (FromTeamId) REFERENCES dbo.utbl_Org_Team(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Org_PromotionHistory_ToTeam FOREIGN KEY (ToTeamId) REFERENCES dbo.utbl_Org_Team(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Org_PromotionHistory_CreatedBy FOREIGN KEY (CreatedBy) REFERENCES dbo.rb_users(userid) ON DELETE NO ACTION,
        CONSTRAINT CK_utbl_Org_PromotionHistory_ChangeType CHECK (ChangeType IN ('Promotion', 'Demotion', 'Transfer'))
    );
    CREATE INDEX IX_utbl_Org_PromotionHistory_UserId ON dbo.utbl_Org_PromotionHistory(UserId);
END
GO

-- Add org columns to employee profile (nullable; legacy DesignationID/DepartmentID remain)
IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.hrms_EmployeeProfile') AND name = 'OrgDepartmentId')
BEGIN
    ALTER TABLE dbo.hrms_EmployeeProfile ADD OrgDepartmentId INT NULL;
    ALTER TABLE dbo.hrms_EmployeeProfile ADD CONSTRAINT FK_hrms_EmployeeProfile_OrgDepartment
        FOREIGN KEY (OrgDepartmentId) REFERENCES dbo.utbl_Org_Department(Id) ON DELETE NO ACTION;
END
GO

IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.hrms_EmployeeProfile') AND name = 'OrgDesignationId')
BEGIN
    ALTER TABLE dbo.hrms_EmployeeProfile ADD OrgDesignationId INT NULL;
    ALTER TABLE dbo.hrms_EmployeeProfile ADD CONSTRAINT FK_hrms_EmployeeProfile_OrgDesignation
        FOREIGN KEY (OrgDesignationId) REFERENCES dbo.utbl_Org_Designation(Id) ON DELETE NO ACTION;
    CREATE INDEX IX_hrms_EmployeeProfile_OrgDesignationId ON dbo.hrms_EmployeeProfile(OrgDesignationId);
END
GO

PRINT 'Migration 026 utbl_Org tables completed.';
GO
