-- Migration 037: Update existing states to GST codes and add all missing Indian states/UTs
-- Converts old ISO alpha codes (MH, DL, etc.) to official GST numeric codes
-- Adds the 21 missing states and union territories

SET NOCOUNT ON;

DECLARE @indiaId INT;
SELECT @indiaId = Id FROM dbo.utbl_Country WHERE CountryCode = 'IN';

IF @indiaId IS NULL
BEGIN
    PRINT 'India not found in utbl_Country. Skipping.';
    RETURN;
END

-- Step 1: Update existing 15 states from ISO alpha codes to GST numeric codes
UPDATE dbo.utbl_State SET StateCode = '27' WHERE CountryId = @indiaId AND StateCode = 'MH';  -- Maharashtra
UPDATE dbo.utbl_State SET StateCode = '07' WHERE CountryId = @indiaId AND StateCode = 'DL';  -- Delhi
UPDATE dbo.utbl_State SET StateCode = '29' WHERE CountryId = @indiaId AND StateCode = 'KA';  -- Karnataka
UPDATE dbo.utbl_State SET StateCode = '33' WHERE CountryId = @indiaId AND StateCode = 'TN';  -- Tamil Nadu
UPDATE dbo.utbl_State SET StateCode = '24' WHERE CountryId = @indiaId AND StateCode = 'GJ';  -- Gujarat
UPDATE dbo.utbl_State SET StateCode = '08' WHERE CountryId = @indiaId AND StateCode = 'RJ';  -- Rajasthan
UPDATE dbo.utbl_State SET StateCode = '09' WHERE CountryId = @indiaId AND StateCode = 'UP';  -- Uttar Pradesh
UPDATE dbo.utbl_State SET StateCode = '19' WHERE CountryId = @indiaId AND StateCode = 'WB';  -- West Bengal
UPDATE dbo.utbl_State SET StateCode = '32' WHERE CountryId = @indiaId AND StateCode = 'KL';  -- Kerala
UPDATE dbo.utbl_State SET StateCode = '37' WHERE CountryId = @indiaId AND StateCode = 'AP';  -- Andhra Pradesh
UPDATE dbo.utbl_State SET StateCode = '36' WHERE CountryId = @indiaId AND StateCode = 'TS';  -- Telangana
UPDATE dbo.utbl_State SET StateCode = '23' WHERE CountryId = @indiaId AND StateCode = 'MP';  -- Madhya Pradesh
UPDATE dbo.utbl_State SET StateCode = '03' WHERE CountryId = @indiaId AND StateCode = 'PB';  -- Punjab
UPDATE dbo.utbl_State SET StateCode = '06' WHERE CountryId = @indiaId AND StateCode = 'HR';  -- Haryana
UPDATE dbo.utbl_State SET StateCode = '30' WHERE CountryId = @indiaId AND StateCode = 'GA';  -- Goa

PRINT 'Updated 15 existing states to GST codes.';

-- Step 2: Insert 21 missing states and union territories (only if not already present)
-- States
IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '12')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '12', 'Arunachal Pradesh');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '18')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '18', 'Assam');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '10')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '10', 'Bihar');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '22')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '22', 'Chhattisgarh');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '02')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '02', 'Himachal Pradesh');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '20')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '20', 'Jharkhand');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '14')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '14', 'Manipur');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '17')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '17', 'Meghalaya');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '15')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '15', 'Mizoram');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '13')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '13', 'Nagaland');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '21')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '21', 'Odisha');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '11')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '11', 'Sikkim');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '16')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '16', 'Tripura');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '05')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '05', 'Uttarakhand');

-- Union Territories
IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '35')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '35', 'Andaman & Nicobar Islands');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '04')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '04', 'Chandigarh');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '26')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '26', 'Dadra & Nagar Haveli and Daman & Diu');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '01')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '01', 'Jammu & Kashmir');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '38')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '38', 'Ladakh');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '31')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '31', 'Lakshadweep');

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_State WHERE CountryId = @indiaId AND StateCode = '34')
    INSERT INTO dbo.utbl_State (CountryId, StateCode, StateName) VALUES (@indiaId, '34', 'Puducherry');

PRINT 'Migration 037: Updated GST codes and added 21 missing states/UTs. Total: 36.';
GO
