-- Chat attachments: ensure react_FileStore exists and react_ChatMessage has AttachmentFileID.
-- Run this once on your database if chat attachments or image thumbnails do not work.
-- Images/files are stored on DISK (uploads folder); only metadata is in the DB.

-- 1) Create react_FileStore if it does not exist (stores file metadata; actual bytes are on disk)
IF NOT EXISTS (SELECT 1 FROM sys.tables t WHERE t.name = N'react_FileStore' AND t.schema_id = SCHEMA_ID(N'dbo'))
BEGIN
  CREATE TABLE dbo.react_FileStore (
    FileID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    StoredFileName NVARCHAR(255) NOT NULL,
    OriginalFileName NVARCHAR(255) NOT NULL,
    MimeType NVARCHAR(128) NULL,
    FileSizeBytes BIGINT NOT NULL,
    RelativePath NVARCHAR(512) NOT NULL,
    FileCategory NVARCHAR(64) NOT NULL DEFAULT N'DOCUMENT',
    UploadedAt DATETIME NOT NULL DEFAULT GETDATE(),
    UploadedByUserID INT NULL
  );
END;

-- 2) Add AttachmentFileID to react_ChatMessage if missing (table may be in dbo or another schema)
-- Find table by name (any schema) and add column if missing
IF EXISTS (SELECT 1 FROM sys.tables t WHERE t.name = N'react_ChatMessage')
BEGIN
  DECLARE @tbl NVARCHAR(256);
  SELECT @tbl = QUOTENAME(OBJECT_SCHEMA_NAME(t.object_id)) + N'.' + QUOTENAME(t.name)
  FROM sys.tables t
  WHERE t.name = N'react_ChatMessage';

  IF NOT EXISTS (
    SELECT 1 FROM sys.columns c
    INNER JOIN sys.tables t ON c.object_id = t.object_id
    WHERE t.name = N'react_ChatMessage' AND c.name = N'AttachmentFileID'
  )
  BEGIN
    EXEC(N'ALTER TABLE ' + @tbl + N' ADD AttachmentFileID INT NULL');
  END
END;

-- 3) Add AccessToken for secure chat attachment URLs (unguessable; no sequential file IDs in URLs)
-- Split into two batches so SQL Server sees the new column before creating the index.
IF EXISTS (SELECT 1 FROM sys.tables t WHERE t.name = N'react_FileStore' AND t.schema_id = SCHEMA_ID(N'dbo'))
  AND NOT EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id WHERE t.name = N'react_FileStore' AND c.name = N'AccessToken')
BEGIN
  ALTER TABLE dbo.react_FileStore ADD AccessToken NVARCHAR(64) NULL;
END;
GO
-- Create index in a separate batch (column now exists).
IF EXISTS (SELECT 1 FROM sys.tables t WHERE t.name = N'react_FileStore' AND t.schema_id = SCHEMA_ID(N'dbo'))
  AND EXISTS (SELECT 1 FROM sys.columns c INNER JOIN sys.tables t ON c.object_id = t.object_id WHERE t.name = N'react_FileStore' AND c.name = N'AccessToken')
  AND NOT EXISTS (SELECT 1 FROM sys.indexes i INNER JOIN sys.tables t ON i.object_id = t.object_id WHERE t.name = N'react_FileStore' AND i.name = N'IX_react_FileStore_AccessToken')
BEGIN
  CREATE UNIQUE INDEX IX_react_FileStore_AccessToken ON dbo.react_FileStore(AccessToken) WHERE AccessToken IS NOT NULL;
END;
