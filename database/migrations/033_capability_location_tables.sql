-- Migration 033: Branch Capability definitions, Branch-Capability mapping, Branch Locations
-- Capabilities restrict what operations a branch can perform.
-- Locations track physical areas within a branch (floors, rooms, warehouses).

SET NOCOUNT ON;

-- Capability master (system-defined capabilities)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_BranchCapability' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_BranchCapability (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        CapabilityCode NVARCHAR(50) NOT NULL,
        CapabilityName NVARCHAR(200) NOT NULL,
        Description NVARCHAR(500) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT UQ_utbl_BranchCapability_Code UNIQUE (CapabilityCode)
    );

    -- Seed default capabilities
    INSERT INTO dbo.utbl_BranchCapability (CapabilityCode, CapabilityName, Description) VALUES
        ('JOB_INWARD', 'Job Inward', 'Accept incoming repair/service jobs'),
        ('REPAIR', 'Repair', 'Perform repair and servicing operations'),
        ('QC', 'Quality Control', 'Perform quality checks and inspections'),
        ('SALES', 'Sales', 'Handle sales transactions'),
        ('DISPATCH', 'Dispatch', 'Handle outbound dispatch and shipping'),
        ('ADMIN', 'Administration', 'Administrative and back-office operations'),
        ('COLLECTION', 'Collection Center', 'Accept items for collection and forwarding'),
        ('WAREHOUSE', 'Warehouse', 'Inventory storage and management');
END
GO

-- Branch–Capability mapping (which capabilities are enabled for each branch)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_BranchCapabilityMap' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_BranchCapabilityMap (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        BranchId INT NOT NULL,
        CapabilityId INT NOT NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_utbl_BranchCapabilityMap_Branch FOREIGN KEY (BranchId) REFERENCES dbo.utbl_Branch(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_BranchCapabilityMap_Capability FOREIGN KEY (CapabilityId) REFERENCES dbo.utbl_BranchCapability(Id) ON DELETE NO ACTION,
        CONSTRAINT UQ_utbl_BranchCapabilityMap UNIQUE (BranchId, CapabilityId)
    );
    CREATE INDEX IX_utbl_BranchCapabilityMap_BranchId ON dbo.utbl_BranchCapabilityMap(BranchId);
    CREATE INDEX IX_utbl_BranchCapabilityMap_CapabilityId ON dbo.utbl_BranchCapabilityMap(CapabilityId);
END
GO

-- Branch Location (physical locations within a branch)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_BranchLocation' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_BranchLocation (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        BranchId INT NOT NULL,
        LocationCode NVARCHAR(50) NOT NULL,
        LocationName NVARCHAR(200) NOT NULL,
        LocationType NVARCHAR(20) NOT NULL,
        ParentLocationId INT NULL,
        SortOrder INT NOT NULL DEFAULT 0,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT FK_utbl_BranchLocation_Branch FOREIGN KEY (BranchId) REFERENCES dbo.utbl_Branch(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_BranchLocation_Parent FOREIGN KEY (ParentLocationId) REFERENCES dbo.utbl_BranchLocation(Id) ON DELETE NO ACTION,
        CONSTRAINT UQ_utbl_BranchLocation_Code UNIQUE (BranchId, LocationCode),
        CONSTRAINT CK_utbl_BranchLocation_Type CHECK (LocationType IN ('FLOOR', 'WORKSHOP', 'WAREHOUSE', 'QC_ROOM', 'RECEPTION', 'OFFICE', 'OTHER'))
    );
    CREATE INDEX IX_utbl_BranchLocation_BranchId ON dbo.utbl_BranchLocation(BranchId);
    CREATE INDEX IX_utbl_BranchLocation_ParentId ON dbo.utbl_BranchLocation(ParentLocationId);
END
GO

PRINT 'Migration 033 capability and location tables completed.';
GO
