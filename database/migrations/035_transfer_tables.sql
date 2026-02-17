-- Migration 035: Cross-branch transfer framework
-- Generic transfer engine with master, audit log, and type-specific child tables.

SET NOCOUNT ON;

-- Transfer master
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_Transfer' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_Transfer (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TransferCode NVARCHAR(30) NOT NULL,
        TransferType NVARCHAR(20) NOT NULL,
        FromBranchId INT NOT NULL,
        ToBranchId INT NOT NULL,
        FromLocationId INT NULL,
        ToLocationId INT NULL,
        Status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
        Reason NVARCHAR(500) NULL,
        RequestedBy INT NOT NULL,
        ApprovedBy INT NULL,
        DispatchedBy INT NULL,
        ReceivedBy INT NULL,
        RequestedAt DATETIME NOT NULL DEFAULT GETDATE(),
        ApprovedAt DATETIME NULL,
        DispatchedAt DATETIME NULL,
        ReceivedAt DATETIME NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedOn DATETIME NOT NULL DEFAULT GETDATE(),
        CreatedBy INT NULL,
        UpdatedOn DATETIME NULL,
        UpdatedBy INT NULL,
        CONSTRAINT UQ_utbl_Transfer_Code UNIQUE (TransferCode),
        CONSTRAINT FK_utbl_Transfer_FromBranch FOREIGN KEY (FromBranchId) REFERENCES dbo.utbl_Branch(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Transfer_ToBranch FOREIGN KEY (ToBranchId) REFERENCES dbo.utbl_Branch(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Transfer_FromLocation FOREIGN KEY (FromLocationId) REFERENCES dbo.utbl_BranchLocation(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Transfer_ToLocation FOREIGN KEY (ToLocationId) REFERENCES dbo.utbl_BranchLocation(Id) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Transfer_RequestedBy FOREIGN KEY (RequestedBy) REFERENCES dbo.rb_users(userid) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Transfer_ApprovedBy FOREIGN KEY (ApprovedBy) REFERENCES dbo.rb_users(userid) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Transfer_DispatchedBy FOREIGN KEY (DispatchedBy) REFERENCES dbo.rb_users(userid) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_Transfer_ReceivedBy FOREIGN KEY (ReceivedBy) REFERENCES dbo.rb_users(userid) ON DELETE NO ACTION,
        CONSTRAINT CK_utbl_Transfer_Type CHECK (TransferType IN ('JOB', 'INVENTORY', 'ASSET', 'USER')),
        CONSTRAINT CK_utbl_Transfer_Status CHECK (Status IN ('PENDING', 'APPROVED', 'IN_TRANSIT', 'RECEIVED', 'REJECTED', 'CANCELLED'))
    );
    CREATE INDEX IX_utbl_Transfer_FromBranch_Status ON dbo.utbl_Transfer(FromBranchId, Status);
    CREATE INDEX IX_utbl_Transfer_ToBranch_Status ON dbo.utbl_Transfer(ToBranchId, Status);
    CREATE INDEX IX_utbl_Transfer_Type ON dbo.utbl_Transfer(TransferType);
    CREATE INDEX IX_utbl_Transfer_RequestedBy ON dbo.utbl_Transfer(RequestedBy);
END
GO

-- Transfer audit log
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_TransferLog' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_TransferLog (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TransferId INT NOT NULL,
        Action NVARCHAR(30) NOT NULL,
        FromStatus NVARCHAR(20) NULL,
        ToStatus NVARCHAR(20) NULL,
        Remarks NVARCHAR(500) NULL,
        ActionBy INT NOT NULL,
        ActionAt DATETIME NOT NULL DEFAULT GETDATE(),
        CONSTRAINT FK_utbl_TransferLog_Transfer FOREIGN KEY (TransferId) REFERENCES dbo.utbl_Transfer(Id) ON DELETE CASCADE,
        CONSTRAINT FK_utbl_TransferLog_ActionBy FOREIGN KEY (ActionBy) REFERENCES dbo.rb_users(userid) ON DELETE NO ACTION,
        CONSTRAINT CK_utbl_TransferLog_Action CHECK (Action IN ('STATUS_CHANGE', 'NOTE', 'ATTACHMENT'))
    );
    CREATE INDEX IX_utbl_TransferLog_TransferId ON dbo.utbl_TransferLog(TransferId);
END
GO

-- Transfer child: Job transfers
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_TransferJob' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_TransferJob (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TransferId INT NOT NULL,
        JobId INT NOT NULL,
        Notes NVARCHAR(500) NULL,
        CONSTRAINT FK_utbl_TransferJob_Transfer FOREIGN KEY (TransferId) REFERENCES dbo.utbl_Transfer(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_utbl_TransferJob_TransferId ON dbo.utbl_TransferJob(TransferId);
    CREATE INDEX IX_utbl_TransferJob_JobId ON dbo.utbl_TransferJob(JobId);
END
GO

-- Transfer child: Inventory transfers (header)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_TransferInventory' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_TransferInventory (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TransferId INT NOT NULL,
        Notes NVARCHAR(500) NULL,
        CONSTRAINT FK_utbl_TransferInventory_Transfer FOREIGN KEY (TransferId) REFERENCES dbo.utbl_Transfer(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_utbl_TransferInventory_TransferId ON dbo.utbl_TransferInventory(TransferId);
END
GO

-- Transfer child: Inventory transfer line items
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_TransferInventoryItem' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_TransferInventoryItem (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TransferInventoryId INT NOT NULL,
        ItemName NVARCHAR(200) NOT NULL,
        SKU NVARCHAR(50) NULL,
        Quantity DECIMAL(12,2) NOT NULL DEFAULT 1,
        Unit NVARCHAR(20) NULL,
        CONSTRAINT FK_utbl_TransferInventoryItem_Inventory FOREIGN KEY (TransferInventoryId) REFERENCES dbo.utbl_TransferInventory(Id) ON DELETE CASCADE
    );
    CREATE INDEX IX_utbl_TransferInventoryItem_InvId ON dbo.utbl_TransferInventoryItem(TransferInventoryId);
END
GO

-- Transfer child: Asset transfers
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_TransferAsset' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_TransferAsset (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TransferId INT NOT NULL,
        AssetId INT NOT NULL,
        Notes NVARCHAR(500) NULL,
        CONSTRAINT FK_utbl_TransferAsset_Transfer FOREIGN KEY (TransferId) REFERENCES dbo.utbl_Transfer(Id) ON DELETE CASCADE,
        CONSTRAINT FK_utbl_TransferAsset_Asset FOREIGN KEY (AssetId) REFERENCES dbo.react_Asset(AssetID) ON DELETE NO ACTION
    );
    CREATE INDEX IX_utbl_TransferAsset_TransferId ON dbo.utbl_TransferAsset(TransferId);
    CREATE INDEX IX_utbl_TransferAsset_AssetId ON dbo.utbl_TransferAsset(AssetId);
END
GO

-- Transfer child: User transfers
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'utbl_TransferUser' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.utbl_TransferUser (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TransferId INT NOT NULL,
        UserId INT NOT NULL,
        NewRoleId INT NULL,
        Notes NVARCHAR(500) NULL,
        CONSTRAINT FK_utbl_TransferUser_Transfer FOREIGN KEY (TransferId) REFERENCES dbo.utbl_Transfer(Id) ON DELETE CASCADE,
        CONSTRAINT FK_utbl_TransferUser_User FOREIGN KEY (UserId) REFERENCES dbo.rb_users(userid) ON DELETE NO ACTION,
        CONSTRAINT FK_utbl_TransferUser_NewRole FOREIGN KEY (NewRoleId) REFERENCES dbo.react_Roles(RoleID) ON DELETE NO ACTION
    );
    CREATE INDEX IX_utbl_TransferUser_TransferId ON dbo.utbl_TransferUser(TransferId);
    CREATE INDEX IX_utbl_TransferUser_UserId ON dbo.utbl_TransferUser(UserId);
END
GO

PRINT 'Migration 035 transfer tables completed.';
GO
