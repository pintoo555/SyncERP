-- Migration 003: Asset, Assignment, Maintenance Ticket, Verification, Tags
-- SQL Server 2008 R2
-- Asset status: AVAILABLE, ISSUED, UNDER_REPAIR, SCRAPPED, LOST

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_Asset')
BEGIN
    CREATE TABLE react_Asset (
        AssetID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        AssetTag NVARCHAR(100) NOT NULL,
        CategoryID INT NOT NULL,
        BrandID INT NULL,
        ModelID INT NULL,
        SerialNumber NVARCHAR(100) NULL,
        PurchaseDate DATE NULL,
        PurchasePrice DECIMAL(18,2) NULL,
        VendorID INT NULL,
        WarrantyExpiry DATE NULL,
        AMCExpiry DATE NULL,
        LocationID INT NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'AVAILABLE',
        CurrentAssignedToUserID INT NULL,
        Description NVARCHAR(MAX) NULL,
        IsDeleted BIT NOT NULL DEFAULT 0,
        DeletedAt DATETIME NULL,
        DeletedBy INT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedAt DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_react_Asset_Category FOREIGN KEY (CategoryID) REFERENCES react_AssetCategory(CategoryID),
        CONSTRAINT FK_react_Asset_Brand FOREIGN KEY (BrandID) REFERENCES react_AssetBrand(BrandID),
        CONSTRAINT FK_react_Asset_Model FOREIGN KEY (ModelID) REFERENCES react_AssetModel(ModelID),
        CONSTRAINT FK_react_Asset_Vendor FOREIGN KEY (VendorID) REFERENCES react_Vendors(VendorID),
        CONSTRAINT FK_react_Asset_Location FOREIGN KEY (LocationID) REFERENCES react_Location(LocationID),
        CONSTRAINT FK_react_Asset_AssignedUser FOREIGN KEY (CurrentAssignedToUserID) REFERENCES rb_users(userid)
    );
    CREATE UNIQUE INDEX IX_react_Asset_AssetTag ON react_Asset(AssetTag) WHERE IsDeleted = 0;
    CREATE INDEX IX_react_Asset_CategoryID ON react_Asset(CategoryID);
    CREATE INDEX IX_react_Asset_Status ON react_Asset(Status);
    CREATE INDEX IX_react_Asset_IsDeleted ON react_Asset(IsDeleted);
    CREATE INDEX IX_react_Asset_CurrentAssignedToUserID ON react_Asset(CurrentAssignedToUserID);
    CREATE INDEX IX_react_Asset_LocationID ON react_Asset(LocationID);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_AssetAssignment')
BEGIN
    CREATE TABLE react_AssetAssignment (
        AssignmentID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        AssetID INT NOT NULL,
        AssignedToUserID INT NOT NULL,
        AssignedByUserID INT NOT NULL,
        AssignedAt DATETIME NOT NULL DEFAULT GETDATE(),
        DueReturnDate DATE NULL,
        ReturnedAt DATETIME NULL,
        ReturnedByUserID INT NULL,
        Notes NVARCHAR(500) NULL,
        AssignmentType NVARCHAR(20) NOT NULL DEFAULT 'ISSUE',
        CONSTRAINT FK_react_AssetAssignment_Asset FOREIGN KEY (AssetID) REFERENCES react_Asset(AssetID),
        CONSTRAINT FK_react_AssetAssignment_AssignedTo FOREIGN KEY (AssignedToUserID) REFERENCES rb_users(userid),
        CONSTRAINT FK_react_AssetAssignment_AssignedBy FOREIGN KEY (AssignedByUserID) REFERENCES rb_users(userid),
        CONSTRAINT FK_react_AssetAssignment_ReturnedBy FOREIGN KEY (ReturnedByUserID) REFERENCES rb_users(userid)
    );
    CREATE INDEX IX_react_AssetAssignment_AssetID ON react_AssetAssignment(AssetID);
    CREATE INDEX IX_react_AssetAssignment_AssignedToUserID ON react_AssetAssignment(AssignedToUserID);
    CREATE INDEX IX_react_AssetAssignment_AssignedAt ON react_AssetAssignment(AssignedAt);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_AssetMaintenanceTicket')
BEGIN
    CREATE TABLE react_AssetMaintenanceTicket (
        TicketID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        AssetID INT NOT NULL,
        TicketNumber NVARCHAR(50) NOT NULL,
        Subject NVARCHAR(200) NOT NULL,
        Description NVARCHAR(MAX) NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'OPEN',
        VendorID INT NULL,
        ReportedByUserID INT NULL,
        ReportedAt DATETIME NOT NULL DEFAULT GETDATE(),
        ResolvedAt DATETIME NULL,
        ResolutionNotes NVARCHAR(MAX) NULL,
        Cost DECIMAL(18,2) NULL,
        IsDeleted BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedAt DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_react_AssetMaintenanceTicket_Asset FOREIGN KEY (AssetID) REFERENCES react_Asset(AssetID),
        CONSTRAINT FK_react_AssetMaintenanceTicket_Vendor FOREIGN KEY (VendorID) REFERENCES react_Vendors(VendorID),
        CONSTRAINT FK_react_AssetMaintenanceTicket_ReportedBy FOREIGN KEY (ReportedByUserID) REFERENCES rb_users(userid)
    );
    CREATE UNIQUE INDEX IX_react_AssetMaintenanceTicket_Number ON react_AssetMaintenanceTicket(TicketNumber);
    CREATE INDEX IX_react_AssetMaintenanceTicket_AssetID ON react_AssetMaintenanceTicket(AssetID);
    CREATE INDEX IX_react_AssetMaintenanceTicket_Status ON react_AssetMaintenanceTicket(Status);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_AssetVerification')
BEGIN
    CREATE TABLE react_AssetVerification (
        VerificationID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        AssetID INT NOT NULL,
        VerifiedAt DATETIME NOT NULL DEFAULT GETDATE(),
        VerifiedByUserID INT NOT NULL,
        LocationID INT NULL,
        Notes NVARCHAR(500) NULL,
        VerifiedStatus NVARCHAR(50) NULL,
        CONSTRAINT FK_react_AssetVerification_Asset FOREIGN KEY (AssetID) REFERENCES react_Asset(AssetID),
        CONSTRAINT FK_react_AssetVerification_User FOREIGN KEY (VerifiedByUserID) REFERENCES rb_users(userid),
        CONSTRAINT FK_react_AssetVerification_Location FOREIGN KEY (LocationID) REFERENCES react_Location(LocationID)
    );
    CREATE INDEX IX_react_AssetVerification_AssetID ON react_AssetVerification(AssetID);
    CREATE INDEX IX_react_AssetVerification_VerifiedAt ON react_AssetVerification(VerifiedAt);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_AssetTags')
BEGIN
    CREATE TABLE react_AssetTags (
        AssetTagID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        AssetID INT NOT NULL,
        TagName NVARCHAR(100) NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        CONSTRAINT FK_react_AssetTags_Asset FOREIGN KEY (AssetID) REFERENCES react_Asset(AssetID)
    );
    CREATE INDEX IX_react_AssetTags_AssetID ON react_AssetTags(AssetID);
    CREATE INDEX IX_react_AssetTags_TagName ON react_AssetTags(TagName);
END
GO
