-- Migration 011: HRMS / Employee Management
-- Uses existing: rb_users, sync_Department (DepartmentID, DepartmentName), sync_Designation (DesignationID, DesignationType)
-- New tables: hrms_EmployeeProfile (1:1 with rb_users), hrms_EmployeeFamily, hrms_EmployeeBank

SET NOCOUNT ON;

-- Employee extended profile (1:1 with rb_users). Department stays on rb_users.
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hrms_EmployeeProfile')
BEGIN
    CREATE TABLE dbo.hrms_EmployeeProfile (
        UserID INT NOT NULL PRIMARY KEY,
        DesignationID INT NULL,
        EmployeeCode NVARCHAR(50) NULL,
        DateOfBirth DATE NULL,
        Gender NVARCHAR(20) NULL,
        Phone NVARCHAR(30) NULL,
        Mobile NVARCHAR(30) NULL,
        AddressLine1 NVARCHAR(200) NULL,
        AddressLine2 NVARCHAR(200) NULL,
        City NVARCHAR(100) NULL,
        State NVARCHAR(100) NULL,
        Pincode NVARCHAR(20) NULL,
        JoinDate DATE NULL,
        PAN NVARCHAR(20) NULL,
        Aadhar NVARCHAR(20) NULL,
        PhotoUrl NVARCHAR(500) NULL,
        EmergencyContact NVARCHAR(100) NULL,
        EmergencyPhone NVARCHAR(30) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CONSTRAINT FK_hrms_EmployeeProfile_User FOREIGN KEY (UserID) REFERENCES dbo.rb_users(userid),
        CONSTRAINT FK_hrms_EmployeeProfile_Designation FOREIGN KEY (DesignationID) REFERENCES dbo.sync_Designation(DesignationID)
    );
    CREATE INDEX IX_hrms_EmployeeProfile_DesignationID ON dbo.hrms_EmployeeProfile(DesignationID);
END
GO

-- Family members
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hrms_EmployeeFamily')
BEGIN
    CREATE TABLE dbo.hrms_EmployeeFamily (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EmployeeUserID INT NOT NULL,
        Relation NVARCHAR(50) NOT NULL,
        FullName NVARCHAR(100) NOT NULL,
        DateOfBirth DATE NULL,
        Contact NVARCHAR(30) NULL,
        IsDependent BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CONSTRAINT FK_hrms_EmployeeFamily_User FOREIGN KEY (EmployeeUserID) REFERENCES dbo.rb_users(userid)
    );
    CREATE INDEX IX_hrms_EmployeeFamily_EmployeeUserID ON dbo.hrms_EmployeeFamily(EmployeeUserID);
END
GO

-- Bank details (one main record per employee; add more if needed later)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'hrms_EmployeeBank')
BEGIN
    CREATE TABLE dbo.hrms_EmployeeBank (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        EmployeeUserID INT NOT NULL,
        BankName NVARCHAR(100) NULL,
        AccountNumber NVARCHAR(50) NULL,
        IFSC NVARCHAR(20) NULL,
        Branch NVARCHAR(100) NULL,
        AccountType NVARCHAR(50) NULL,
        IsPrimary BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UpdatedAt DATETIME NULL,
        CONSTRAINT FK_hrms_EmployeeBank_User FOREIGN KEY (EmployeeUserID) REFERENCES dbo.rb_users(userid)
    );
    CREATE UNIQUE INDEX IX_hrms_EmployeeBank_UserPrimary ON dbo.hrms_EmployeeBank(EmployeeUserID) WHERE IsPrimary = 1;
    CREATE INDEX IX_hrms_EmployeeBank_EmployeeUserID ON dbo.hrms_EmployeeBank(EmployeeUserID);
END
GO

PRINT 'HRMS migration 011 completed.';
GO
