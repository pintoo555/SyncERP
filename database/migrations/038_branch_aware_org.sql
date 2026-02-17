-- Migration 038: Make Org Structure branch-aware
-- 1. Add BranchId to utbl_Org_Team (teams are branch-scoped)
-- 2. Add FromBranchId / ToBranchId to utbl_Org_PromotionHistory (track branch transfers)
-- 3. Assign all existing active users to the first available branch
-- 4. Assign all existing teams to the first available branch

SET NOCOUNT ON;

-- Step 1: Add BranchId to utbl_Org_Team
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.utbl_Org_Team') AND name = 'BranchId')
BEGIN
    ALTER TABLE dbo.utbl_Org_Team ADD BranchId INT NULL;
    ALTER TABLE dbo.utbl_Org_Team ADD CONSTRAINT FK_utbl_Org_Team_Branch
        FOREIGN KEY (BranchId) REFERENCES dbo.utbl_Branch(Id) ON DELETE NO ACTION;
    CREATE INDEX IX_utbl_Org_Team_BranchId ON dbo.utbl_Org_Team(BranchId);
    PRINT 'Added BranchId to utbl_Org_Team';
END
GO

-- Step 2: Add FromBranchId / ToBranchId to utbl_Org_PromotionHistory
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.utbl_Org_PromotionHistory') AND name = 'FromBranchId')
BEGIN
    ALTER TABLE dbo.utbl_Org_PromotionHistory ADD FromBranchId INT NULL;
    ALTER TABLE dbo.utbl_Org_PromotionHistory ADD CONSTRAINT FK_utbl_Org_PromotionHistory_FromBranch
        FOREIGN KEY (FromBranchId) REFERENCES dbo.utbl_Branch(Id) ON DELETE NO ACTION;
    PRINT 'Added FromBranchId to utbl_Org_PromotionHistory';
END

IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.utbl_Org_PromotionHistory') AND name = 'ToBranchId')
BEGIN
    ALTER TABLE dbo.utbl_Org_PromotionHistory ADD ToBranchId INT NULL;
    ALTER TABLE dbo.utbl_Org_PromotionHistory ADD CONSTRAINT FK_utbl_Org_PromotionHistory_ToBranch
        FOREIGN KEY (ToBranchId) REFERENCES dbo.utbl_Branch(Id) ON DELETE NO ACTION;
    PRINT 'Added ToBranchId to utbl_Org_PromotionHistory';
END
GO

-- Step 3: Assign all existing active users to the first active branch (if not already assigned)
DECLARE @defaultBranchId INT;
SELECT TOP 1 @defaultBranchId = Id FROM dbo.utbl_Branch WHERE IsActive = 1 ORDER BY Id;

IF @defaultBranchId IS NOT NULL
BEGIN
    INSERT INTO dbo.utbl_UserBranchAccess (UserId, BranchId, IsDefault, IsActive)
    SELECT u.userid, @defaultBranchId, 1, 1
    FROM dbo.rb_users u
    WHERE u.IsActive = 1
      AND NOT EXISTS (
          SELECT 1 FROM dbo.utbl_UserBranchAccess uba
          WHERE uba.UserId = u.userid AND uba.BranchId = @defaultBranchId
      );
    PRINT 'Assigned active users to default branch (Id=' + CAST(@defaultBranchId AS VARCHAR(10)) + ')';

    -- Step 4: Assign all existing teams (with NULL BranchId) to the default branch
    UPDATE dbo.utbl_Org_Team SET BranchId = @defaultBranchId WHERE BranchId IS NULL;
    PRINT 'Assigned existing teams to default branch';
END
ELSE
BEGIN
    PRINT 'WARNING: No active branch found. Users and teams not assigned.';
END
GO

PRINT 'Migration 038 branch-aware org completed.';
GO
