-- Migration 006: Primary photo/thumbnail for assets
-- Adds PrimaryFileID to react_Asset; one image can be set as thumbnail for list and detail views.

IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    INNER JOIN sys.tables t ON t.object_id = c.object_id
    WHERE t.name = 'react_Asset' AND c.name = 'PrimaryFileID'
)
BEGIN
    ALTER TABLE react_Asset ADD PrimaryFileID INT NULL;
    ALTER TABLE react_Asset ADD CONSTRAINT FK_react_Asset_PrimaryFile
        FOREIGN KEY (PrimaryFileID) REFERENCES react_FileStore(FileID);
    CREATE INDEX IX_react_Asset_PrimaryFileID ON react_Asset(PrimaryFileID);
END
GO
