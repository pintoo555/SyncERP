-- Migration 032: Branch, BranchCompany mapping, BranchDepartment mapping
-- Supports multi-company branches, effective dating, and department enablement per branch.

SET NOCOUNT ON;

-- Branch master
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_Branch' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_Branch (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        BranchCode NVARCHAR(20) NOT NULL,
        BranchName NVARCHAR(200) NOT NULL,
        BranchType NVARCHAR(20) NOT NULL,
        CountryId INT NULL,
        StateId INT NULL,
        City NVARCHAR(100) NULL,
        Timezone NVARCHAR(100) NULL,
        AddressLine1 NVARCHAR(300) NULL,
        AddressLine2 NVARCHAR(300) NULL,
        Pincode NVARCHAR(20) NULL,
        Phone NVARCHAR(30) NULL,
        Email NVARCHAR(200) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT UQ_utbl_Branch_Code UNIQUE (BranchCode),
        CONSTRAINT FK_utbl_Branch_Country FOREIGN KEY (CountryId) REFERENCES dbo.utbl_Country(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Branch_State FOREIGN KEY (StateId) REFERENCES dbo.utbl_State(Id) ON DELETE NO ACTION,
        CONSTRAINT CK_utbl_Branch_Type CHECK (BranchType IN ('HO', 'WORKSHOP', 'COLLECTION', 'SALES', 'ADMIN', 'FULL'))
    );
    CREATE INDEX IX_utbl_Branch_CountryId ON dbo.utbl_Branch(CountryId);
    CREATE INDEX IX_utbl_Branch_StateId ON dbo.utbl_Branch(StateId);
    CREATE INDEX IX_utbl_Branch_Type ON dbo.utbl_Branch(BranchType);
END
GO

-- Branch–Company mapping (many-to-many with effective dates)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_BranchCompany' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_BranchCompany (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        BranchId INT NOT NULL,
        CompanyId INT NOT NULL,
        IsDefault BIT NOT NULL DEFAULT 0,
        EffectiveFrom DATE NOT NULL,
        EffectiveTo DATE NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_utbl_BranchCompany_Branch FOREIGN KEY (BranchId) REFERENCES dbo.utbl_Branch(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_BranchCompany_Company FOREIGN KEY (CompanyId) REFERENCES dbo.utbl_Company(Id) ON DELETE NO ACTION,
        CONSTRAINT UQ_utbl_BranchCompany UNIQUE (BranchId, CompanyId, EffectiveFrom)
    );
    CREATE INDEX IX_utbl_BranchCompany_BranchId ON dbo.utbl_BranchCompany(BranchId);
    CREATE INDEX IX_utbl_BranchCompany_CompanyId ON dbo.utbl_BranchCompany(CompanyId);
END
GO

-- Branch–Department mapping (enable/disable departments per branch)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_BranchDepartment' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_BranchDepartment (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        BranchId INT NOT NULL,
        DepartmentId INT NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_utbl_BranchDepartment_Branch FOREIGN KEY (BranchId) REFERENCES dbo.utbl_Branch(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_BranchDepartment_Department FOREIGN KEY (DepartmentId) REFERENCES dbo.utbl_Org_Department(Id) ON DELETE NO ACTION,
        CONSTRAINT UQ_utbl_BranchDepartment UNIQUE (BranchId, DepartmentId)
    );
    CREATE INDEX IX_utbl_BranchDepartment_BranchId ON dbo.utbl_BranchDepartment(BranchId);
    CREATE INDEX IX_utbl_BranchDepartment_DepartmentId ON dbo.utbl_BranchDepartment(DepartmentId);
END
GO

PRINT 'Migration 032 branch tables completed.';
GO
