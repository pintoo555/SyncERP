# Chat attachments – setup and troubleshooting

## How attachments are stored

- **Files (images, voice, PDF)** are **not** stored in the database. The binary content is saved on **disk** in the `uploads/` folder (see server `UPLOAD_DIR` in config), in subfolders like `YYYY/MM/`.
- **Metadata** is stored in SQL Server:
  - **react_FileStore**: one row per file (FileID, StoredFileName, OriginalFileName, MimeType, RelativePath, FileCategory, UploadedByUserID, etc.).
  - **react_ChatMessage**: each message can have **AttachmentFileID** (FK to react_FileStore.FileID). When set, the message is an attachment; the client shows image/audio/file using that ID.

So: upload → file written to disk + row in react_FileStore → send message with that FileID → message row has AttachmentFileID → client loads list with JOIN to get file name/mime and renders thumbnail or player.

## Required SQL (run once)

If chat attachments do not work or **image thumbnails disappear after reload**, the database may be missing the file table or the attachment column. Run this script **once** on your database:

**File: `server/sql/chat_attachments.sql`**

It will:

1. Create **dbo.react_FileStore** if it does not exist (with columns: FileID, StoredFileName, OriginalFileName, MimeType, FileSizeBytes, RelativePath, FileCategory, UploadedAt, UploadedByUserID).
2. Add **AttachmentFileID** to **react_ChatMessage** if that column is missing (works whether the chat table is in `dbo` or another schema).

**How to run (examples):**

- **SSMS**: open `server/sql/chat_attachments.sql`, connect to your DB, execute.
- **sqlcmd**: `sqlcmd -S your_server -d your_database -i server/sql/chat_attachments.sql`
- **Azure Data Studio**: open the file and run.

After running it, restart the API server and try sending an attachment and reloading the chat; thumbnails should persist.

## Checklist if attachments still fail

1. **Run the SQL script** above and confirm no errors.
2. **Upload folder**: server must have write access to the upload directory (e.g. `uploads/` under the server process cwd). Check server logs for write errors.
3. **CORS / auth**: the client loads images from `/api/chat/attachment/:fileId`. That request must be same-origin (or proxied) so the browser sends cookies; the API then checks `canAccessChatFile`. If you use a separate API origin, the img request may be unauthenticated (401) and the image will not load – use a reverse proxy so the app and API are on the same origin.
4. **Backend logs**: on upload, check for 400/500; on GET `/api/chat/messages`, check that the response includes `attachmentFileId`, `attachmentFileName`, `attachmentMimeType` for messages that have an attachment.
