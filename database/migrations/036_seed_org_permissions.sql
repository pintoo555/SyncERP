-- Migration 036: Seed organization permissions and default geography data
-- Adds ORG.* permission codes and seeds India with major states + GST jurisdiction.

SET NOCOUNT ON;

-- Seed organization permissions
IF NOT EXISTS (SELECT 1 FROM dbo.react_Permissions WHERE PermissionCode = 'ORG.VIEW')
BEGIN
    INSERT INTO dbo.react_Permissions (PermissionCode, PermissionName, ModuleName, Description) VALUES
        ('ORG.VIEW', 'View Organization', 'Organization', 'View organization structure'),
        ('ORG.EDIT', 'Edit Organization', 'Organization', 'Edit organization structure'),
        ('ORG.COMPANY.VIEW', 'View Companies', 'Organization', 'View company records'),
        ('ORG.COMPANY.EDIT', 'Edit Companies', 'Organization', 'Create and edit companies'),
        ('ORG.BRANCH.VIEW', 'View Branches', 'Organization', 'View branch records'),
        ('ORG.BRANCH.EDIT', 'Edit Branches', 'Organization', 'Create and edit branches'),
        ('ORG.GEO.VIEW', 'View Geography', 'Organization', 'View countries, states, jurisdictions'),
        ('ORG.GEO.EDIT', 'Edit Geography', 'Organization', 'Manage countries, states, jurisdictions'),
        ('ORG.TRANSFER.VIEW', 'View Transfers', 'Organization', 'View cross-branch transfers'),
        ('ORG.TRANSFER.EDIT', 'Edit Transfers', 'Organization', 'Create and edit transfers'),
        ('ORG.TRANSFER.APPROVE', 'Approve Transfers', 'Organization', 'Approve or reject transfers');
END
GO

-- Assign view permissions to ADMIN role
DECLARE @adminRoleId INT;
SELECT @adminRoleId = RoleID FROM dbo.react_Roles WHERE RoleCode = 'ADMIN';

IF @adminRoleId IS NOT NULL
BEGIN
    INSERT INTO dbo.react_RolePermissions (RoleID, PermissionID, GrantedAt, GrantedBy)
    SELECT @adminRoleId, p.PermissionID, GETDATE(), NULL
    FROM dbo.react_Permissions p
    WHERE p.PermissionCode LIKE 'ORG.%'
      AND NOT EXISTS (
          SELECT 1 FROM dbo.react_RolePermissions rp
          WHERE rp.RoleID = @adminRoleId AND rp.PermissionID = p.PermissionID
      );
END
GO

-- Seed default country: India
IF NOT EXISTS (SELECT 1 FROM dbo.utbl_Country WHERE CountryCode = 'IN')
BEGIN
    INSERT INTO dbo.utbl_Country (CountryCode, CountryName, CurrencyCode, CurrencySymbol, PhoneCode)
    VALUES ('IN', 'India', 'INR', N'₹', '+91');
END
GO

-- Seed all Indian states and union territories with GST state codes
-- GST state code is the official 2-digit numeric code (first 2 digits of GSTIN)
DECLARE @indiaId INT;
SELECT @indiaId = Id FROM dbo.utbl_Country WHERE CountryCode = 'IN';

IF @indiaId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId)
BEGIN
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES
        -- States
        (@indiaId, '37', 'Andhra Pradesh'),
        (@indiaId, '12', 'Arunachal Pradesh'),
        (@indiaId, '18', 'Assam'),
        (@indiaId, '10', 'Bihar'),
        (@indiaId, '22', 'Chhattisgarh'),
        (@indiaId, '30', 'Goa'),
        (@indiaId, '24', 'Gujarat'),
        (@indiaId, '06', 'Haryana'),
        (@indiaId, '02', 'Himachal Pradesh'),
        (@indiaId, '20', 'Jharkhand'),
        (@indiaId, '29', 'Karnataka'),
        (@indiaId, '32', 'Kerala'),
        (@indiaId, '23', 'Madhya Pradesh'),
        (@indiaId, '27', 'Maharashtra'),
        (@indiaId, '14', 'Manipur'),
        (@indiaId, '17', 'Meghalaya'),
        (@indiaId, '15', 'Mizoram'),
        (@indiaId, '13', 'Nagaland'),
        (@indiaId, '21', 'Odisha'),
        (@indiaId, '03', 'Punjab'),
        (@indiaId, '08', 'Rajasthan'),
        (@indiaId, '11', 'Sikkim'),
        (@indiaId, '33', 'Tamil Nadu'),
        (@indiaId, '36', 'Telangana'),
        (@indiaId, '16', 'Tripura'),
        (@indiaId, '09', 'Uttar Pradesh'),
        (@indiaId, '05', 'Uttarakhand'),
        (@indiaId, '19', 'West Bengal'),
        -- Union Territories
        (@indiaId, '35', 'Andaman & Nicobar Islands'),
        (@indiaId, '04', 'Chandigarh'),
        (@indiaId, '26', 'Dadra & Nagar Haveli and Daman & Diu'),
        (@indiaId, '07', 'Delhi'),
        (@indiaId, '01', 'Jammu & Kashmir'),
        (@indiaId, '38', 'Ladakh'),
        (@indiaId, '31', 'Lakshadweep'),
        (@indiaId, '34', 'Puducherry');
END

-- Seed default GST jurisdiction (country-level) — same batch so @indiaId is still in scope
IF @indiaId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.utbl_TaxJurisdiction WHERE JurisdictionCode = 'IN-GST')
BEGIN
    INSERT INTO dbo.utbl_TaxJurisdiction (CountryId, StateId, JurisdictionCode, JurisdictionName, TaxType, DefaultTaxRate)
    VALUES (@indiaId, NULL, 'IN-GST', 'India GST', 'GST', 18.00);
END
GO

PRINT 'Migration 036 seed org permissions and geography completed.';
GO
