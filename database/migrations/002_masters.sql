-- Migration 002: Master data tables (Categories tree, Brands, Models, Vendors, Locations)
-- SQL Server 2008 R2

-- Asset Categories (tree structure: ParentCategoryID self-reference)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_AssetCategory')
BEGIN
    CREATE TABLE react_AssetCategory (
        CategoryID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ParentCategoryID INT NULL,
        CategoryCode NVARCHAR(50) NOT NULL,
        CategoryName NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500) NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        IsDeleted BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedAt DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_react_AssetCategory_Parent FOREIGN KEY (ParentCategoryID) REFERENCES react_AssetCategory(CategoryID)
    );
    CREATE INDEX IX_react_AssetCategory_Parent ON react_AssetCategory(ParentCategoryID);
    CREATE INDEX IX_react_AssetCategory_Code ON react_AssetCategory(CategoryCode);
    CREATE INDEX IX_react_AssetCategory_IsDeleted ON react_AssetCategory(IsDeleted);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_AssetBrand')
BEGIN
    CREATE TABLE react_AssetBrand (
        BrandID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        BrandCode NVARCHAR(50) NOT NULL,
        BrandName NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        IsDeleted BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedAt DATETIME NULL,
        UpdatedBy INT NULL
    );
    CREATE UNIQUE INDEX IX_react_AssetBrand_Code ON react_AssetBrand(BrandCode);
    CREATE INDEX IX_react_AssetBrand_IsDeleted ON react_AssetBrand(IsDeleted);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_AssetModel')
BEGIN
    CREATE TABLE react_AssetModel (
        ModelID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        BrandID INT NOT NULL,
        ModelCode NVARCHAR(50) NOT NULL,
        ModelName NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        IsDeleted BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedAt DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_react_AssetModel_Brand FOREIGN KEY (BrandID) REFERENCES react_AssetBrand(BrandID)
    );
    CREATE INDEX IX_react_AssetModel_BrandID ON react_AssetModel(BrandID);
    CREATE INDEX IX_react_AssetModel_Code ON react_AssetModel(ModelCode);
    CREATE INDEX IX_react_AssetModel_IsDeleted ON react_AssetModel(IsDeleted);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_Vendors')
BEGIN
    CREATE TABLE react_Vendors (
        VendorID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        VendorCode NVARCHAR(50) NOT NULL,
        VendorName NVARCHAR(200) NOT NULL,
        ContactPerson NVARCHAR(100) NULL,
        ContactEmail NVARCHAR(100) NULL,
        ContactPhone NVARCHAR(50) NULL,
        Address NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        IsDeleted BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedAt DATETIME NULL,
        UpdatedBy INT NULL
    );
    CREATE UNIQUE INDEX IX_react_Vendors_Code ON react_Vendors(VendorCode);
    CREATE INDEX IX_react_Vendors_IsDeleted ON react_Vendors(IsDeleted);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_Location')
BEGIN
    CREATE TABLE react_Location (
        LocationID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        ParentLocationID INT NULL,
        LocationCode NVARCHAR(50) NOT NULL,
        LocationName NVARCHAR(200) NOT NULL,
        Address NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        IsDeleted BIT NOT NULL DEFAULT 0,
        CreatedAt DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedAt DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_react_Location_Parent FOREIGN KEY (ParentLocationID) REFERENCES react_Location(LocationID)
    );
    CREATE INDEX IX_react_Location_Parent ON react_Location(ParentLocationID);
    CREATE INDEX IX_react_Location_Code ON react_Location(LocationCode);
    CREATE INDEX IX_react_Location_IsDeleted ON react_Location(IsDeleted);
END
GO
