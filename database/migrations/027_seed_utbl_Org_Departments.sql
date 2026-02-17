-- Migration 027: Seed utbl_Org_Department with existing department structure
-- Run after 026_utbl_Org_tables.sql. Idempotent: only inserts if no rows exist.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_Org_Department)
BEGIN
    INSERT INTO dbo.utbl_Org_Department (DepartmentCode, DepartmentName, IsActive, SortOrder)
    VALUES
        ('TRACING', N'Tracing Department', 1, 1),
        ('REPAIRING', N'Repairing Department', 1, 2),
        ('ACCOUNTS', N'Accounts Department', 1, 3),
        ('SOFTWARE', N'Software Development', 1, 4),
        ('MANAGEMENT', N'Management Team', 1, 5),
        ('PACKING', N'Packing Department', 1, 6),
        ('PURCHASE', N'Purchase Department', 1, 7),
        ('COMP_MAINT', N'Computer Maintenance', 1, 8),
        ('PHOTOGRAPHY', N'Photography Department', 1, 9),
        ('INVENTORY', N'Inventory Department', 1, 10),
        ('BACKOFFICE', N'BackOffice Department', 1, 11),
        ('MAINTENANCE', N'Maintenance Department', 1, 12),
        ('OUTWARD', N'Outward Department', 1, 13),
        ('HR', N'HR Department', 1, 14),
        ('TECH_RP_SCHED', N'Technical – Resource Planning & Scheduling', 1, 15),
        ('ADMIN', N'Administration Department', 1, 16),
        ('INWARD', N'Inward Department', 1, 17),
        ('TECH_QA', N'Technical - Quality Assurance & Control Department', 1, 18),
        ('BUSINESS_INSIGHTS', N'Business Insights & Strategy', 1, 19);

    PRINT 'Migration 027: Inserted 19 departments into utbl_Org_Department.';
END
ELSE
BEGIN
    PRINT 'Migration 027: utbl_Org_Department already has data; skipped seed.';
END
GO
