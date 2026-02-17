-- Migration 004: File store and asset-file linkage
-- Files stored on disk with random names; metadata in DB

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_FileStore')
BEGIN
    CREATE TABLE react_FileStore (
        FileID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        StoredFileName NVARCHAR(255) NOT NULL,
        OriginalFileName NVARCHAR(255) NOT NULL,
        MimeType NVARCHAR(100) NULL,
        FileSizeBytes BIGINT NOT NULL DEFAULT 0,
        RelativePath NVARCHAR(500) NOT NULL,
        FileCategory NVARCHAR(50) NOT NULL DEFAULT 'DOCUMENT',
        UploadedAt DATETIME NOT NULL DEFAULT GETDATE(),
        UploadedByUserID INT NULL,
        CONSTRAINT FK_react_FileStore_User FOREIGN KEY (UploadedByUserID) REFERENCES rb_users(userid)
    );
    CREATE INDEX IX_react_FileStore_StoredFileName ON react_FileStore(StoredFileName);
    CREATE INDEX IX_react_FileStore_UploadedAt ON react_FileStore(UploadedAt);
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'react_AssetFiles')
BEGIN
    CREATE TABLE react_AssetFiles (
        AssetFileID INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        AssetID INT NOT NULL,
        FileID INT NOT NULL,
        DisplayOrder INT NOT NULL DEFAULT 0,
        Caption NVARCHAR(200) NULL,
        AttachedAt DATETIME NOT NULL DEFAULT GETDATE(),
        AttachedByUserID INT NULL,
        CONSTRAINT FK_react_AssetFiles_Asset FOREIGN KEY (AssetID) REFERENCES react_Asset(AssetID),
        CONSTRAINT FK_react_AssetFiles_File FOREIGN KEY (FileID) REFERENCES react_FileStore(FileID),
        CONSTRAINT FK_react_AssetFiles_User FOREIGN KEY (AttachedByUserID) REFERENCES rb_users(userid)
    );
    CREATE INDEX IX_react_AssetFiles_AssetID ON react_AssetFiles(AssetID);
    CREATE INDEX IX_react_AssetFiles_FileID ON react_AssetFiles(FileID);
END
GO
