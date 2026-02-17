-- Migration 046: Seed industry master data
-- Populates standard Indian industrial sectors with categories.

SET NOCOUNT ON;

IF NOT EXISTS (SELECT 1 FROM dbo.utbl_Industry WHERE IndustryName = 'Cement')
BEGIN
    INSERT INTO dbo.utbl_Industry (IndustryName, IndustryCategory) VALUES
        -- Process industries
        ('Cement', 'Process'),
        ('Pharma', 'Process'),
        ('Oil & Gas', 'Process'),
        ('Chemicals', 'Process'),
        ('Paper & Pulp', 'Process'),
        ('Sugar', 'Process'),
        ('Fertilizers', 'Process'),
        ('Petrochemicals', 'Process'),
        ('Water Treatment', 'Process'),
        -- Heavy industries
        ('Steel', 'Heavy'),
        ('Power', 'Heavy'),
        ('Mining', 'Heavy'),
        ('Metals & Alloys', 'Heavy'),
        -- Manufacturing industries
        ('Automobile', 'Manufacturing'),
        ('Textiles', 'Manufacturing'),
        ('Food Processing', 'Manufacturing'),
        ('FMCG', 'Manufacturing'),
        ('Electronics', 'Manufacturing'),
        ('Packaging', 'Manufacturing'),
        ('Plastics & Rubber', 'Manufacturing'),
        -- Government / Defence
        ('Defence', 'Govt'),
        ('Railways', 'Govt'),
        ('Government PSU', 'Govt'),
        -- Other
        ('IT/ITES', 'Other'),
        ('Construction', 'Other'),
        ('Logistics', 'Other'),
        ('Healthcare', 'Other'),
        ('Education', 'Other'),
        ('Other', 'Other');
END
GO

PRINT 'Migration 046 seed industries completed.';
GO
