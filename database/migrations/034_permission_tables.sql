-- Migration 034: Role branch scope, User branch access, User company access
-- Controls which branches and companies each user/role can operate in.

SET NOCOUNT ON;

-- Role-level branch scope (ALL / MULTI / SINGLE)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_RoleBranchScope' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_RoleBranchScope (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        RoleId INT NOT NULL,
        ScopeType NVARCHAR(10) NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_utbl_RoleBranchScope_Role FOREIGN KEY (RoleId) REFERENCES dbo.react_Roles(RoleID) ON DELETE NO ACTION,
        CONSTRAINT UQ_utbl_RoleBranchScope_Role UNIQUE (RoleId),
        CONSTRAINT CK_utbl_RoleBranchScope_Type CHECK (ScopeType IN ('ALL', 'MULTI', 'SINGLE'))
    );
END
GO

-- User-level branch access (which branches a user can access)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_UserBranchAccess' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_UserBranchAccess (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UserId INT NOT NULL,
        BranchId INT NOT NULL,
        IsDefault BIT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_utbl_UserBranchAccess_User FOREIGN KEY (UserId) REFERENCES dbo.rb_users(userid) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_UserBranchAccess_Branch FOREIGN KEY (BranchId) REFERENCES dbo.utbl_Branch(Id) ON DELETE NO ACTION,
        CONSTRAINT UQ_utbl_UserBranchAccess UNIQUE (UserId, BranchId)
    );
    CREATE INDEX IX_utbl_UserBranchAccess_UserId ON dbo.utbl_UserBranchAccess(UserId);
    CREATE INDEX IX_utbl_UserBranchAccess_BranchId ON dbo.utbl_UserBranchAccess(BranchId);
END
GO

-- User-level company access
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_UserCompanyAccess' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_UserCompanyAccess (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        UserId INT NOT NULL,
        CompanyId INT NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_utbl_UserCompanyAccess_User FOREIGN KEY (UserId) REFERENCES dbo.rb_users(userid) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_UserCompanyAccess_Company FOREIGN KEY (CompanyId) REFERENCES dbo.utbl_Company(Id) ON DELETE NO ACTION,
        CONSTRAINT UQ_utbl_UserCompanyAccess UNIQUE (UserId, CompanyId)
    );
    CREATE INDEX IX_utbl_UserCompanyAccess_UserId ON dbo.utbl_UserCompanyAccess(UserId);
    CREATE INDEX IX_utbl_UserCompanyAccess_CompanyId ON dbo.utbl_UserCompanyAccess(CompanyId);
END
GO

PRINT 'Migration 034 permission tables completed.';
GO
