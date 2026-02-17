/**
 * File store: save to disk (random name), metadata in DB, link to asset. Secure stream and delete.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getRequest } from '../db/pool';
import { config } from '../utils/config';
import { AppError } from '../middleware/errorHandler';

const UPLOAD_DIR = config.upload.dir;
const ALLOWED_MIMES = new Set(config.upload.allowedMimeTypes);
const ALLOWED_MIMES_CHAT = new Set((config.upload as { allowedMimeTypesChat?: string[] }).allowedMimeTypesChat ?? [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic',
  'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/x-m4a',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska',
  'application/pdf',
]);
const MAX_SIZE = config.upload.maxFileSizeBytes;

export interface FileRecord {
  fileId: number;
  storedFileName: string;
  originalFileName: string;
  mimeType: string | null;
  fileSizeBytes: number;
  relativePath: string;
  fileCategory: string;
  uploadedAt: Date;
  uploadedByUserId: number | null;
  /** Set for CHAT files; used in URL so file ID is not guessable. */
  accessToken?: string | null;
}

export interface AssetFileRecord {
  assetFileId: number;
  assetId: number;
  fileId: number;
  displayOrder: number;
  caption: string | null;
  attachedAt: Date;
  originalFileName: string;
  mimeType: string | null;
  fileSizeBytes: number;
  isPrimary?: boolean;
}

function safeJoin(base: string, ...segments: string[]): string {
  const resolved = path.resolve(base, ...segments);
  const baseNorm = path.resolve(base);
  if (!resolved.startsWith(baseNorm) || resolved === baseNorm) {
    throw new AppError(400, 'Invalid file path');
  }
  return resolved;
}

function randomFileName(originalName: string): string {
  const ext = path.extname(originalName) || '';
  const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '');
  const name = crypto.randomBytes(16).toString('hex') + (safeExt ? safeExt.toLowerCase() : '');
  return name;
}

export function validateFile(mimetype: string, size: number): void {
  if (size > MAX_SIZE) throw new AppError(400, `File size exceeds ${MAX_SIZE} bytes`);
  if (!ALLOWED_MIMES.has(mimetype)) throw new AppError(400, `File type not allowed: ${mimetype}`);
}

/** Chat attachments: images, audio (voice), PDF. Same size limit. */
export function validateFileForChat(mimetype: string, size: number): void {
  if (size > MAX_SIZE) throw new AppError(400, `File size exceeds ${MAX_SIZE} bytes`);
  if (!ALLOWED_MIMES_CHAT.has(mimetype)) throw new AppError(400, `File type not allowed for chat: ${mimetype}`);
}

/** Save file for chat (voice, photo, attachment). Uses CHAT mime allowlist and fileCategory CHAT. */
export async function saveFileForChat(
  buffer: Buffer,
  originalName: string,
  mimetype: string,
  userId: number
): Promise<{ file: FileRecord }> {
  validateFileForChat(mimetype, buffer.length);
  const result = await saveFile(buffer, originalName, mimetype, userId, { fileCategory: 'CHAT', forChat: true });
  return { file: result.file };
}

export async function saveFile(
  buffer: Buffer,
  originalName: string,
  mimetype: string,
  userId: number,
  options?: { assetId?: number; caption?: string; fileCategory?: string; forChat?: boolean }
): Promise<{ file: FileRecord; assetFileId?: number }> {
  if (options?.forChat) validateFileForChat(mimetype, buffer.length);
  else validateFile(mimetype, buffer.length);
  const storedName = randomFileName(originalName);
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const relDir = path.join(String(year), month);
  const fullDir = safeJoin(process.cwd(), UPLOAD_DIR, relDir);

  if (!fs.existsSync(fullDir)) {
    fs.mkdirSync(fullDir, { recursive: true });
  }
  const relativePath = path.join(relDir, storedName);
  const fullPath = path.join(fullDir, storedName);
  fs.writeFileSync(fullPath, buffer);

  const isChat = options?.fileCategory === 'CHAT';
  const accessToken = isChat ? crypto.randomBytes(32).toString('hex') : null;

  const req = await getRequest();
  let result: { recordset: unknown[] };
  if (isChat && accessToken) {
    result = await req
      .input('storedFileName', storedName)
      .input('originalFileName', originalName.slice(0, 255))
      .input('mimeType', mimetype)
      .input('fileSizeBytes', buffer.length)
      .input('relativePath', relativePath)
      .input('fileCategory', options?.fileCategory ?? 'DOCUMENT')
      .input('uploadedByUserId', userId)
      .input('accessToken', accessToken)
      .query(`
        INSERT INTO dbo.react_FileStore (StoredFileName, OriginalFileName, MimeType, FileSizeBytes, RelativePath, FileCategory, UploadedByUserID, AccessToken)
        OUTPUT INSERTED.FileID, INSERTED.StoredFileName, INSERTED.OriginalFileName, INSERTED.MimeType, INSERTED.FileSizeBytes, INSERTED.RelativePath, INSERTED.FileCategory, INSERTED.UploadedAt, INSERTED.UploadedByUserID, INSERTED.AccessToken
        VALUES (@storedFileName, @originalFileName, @mimeType, @fileSizeBytes, @relativePath, @fileCategory, @uploadedByUserId, @accessToken)
      `);
  } else {
    result = await req
      .input('storedFileName', storedName)
      .input('originalFileName', originalName.slice(0, 255))
      .input('mimeType', mimetype)
      .input('fileSizeBytes', buffer.length)
      .input('relativePath', relativePath)
      .input('fileCategory', options?.fileCategory ?? 'DOCUMENT')
      .input('uploadedByUserId', userId)
      .query(`
        INSERT INTO dbo.react_FileStore (StoredFileName, OriginalFileName, MimeType, FileSizeBytes, RelativePath, FileCategory, UploadedByUserID)
        OUTPUT INSERTED.FileID, INSERTED.StoredFileName, INSERTED.OriginalFileName, INSERTED.MimeType, INSERTED.FileSizeBytes, INSERTED.RelativePath, INSERTED.FileCategory, INSERTED.UploadedAt, INSERTED.UploadedByUserID
        VALUES (@storedFileName, @originalFileName, @mimeType, @fileSizeBytes, @relativePath, @fileCategory, @uploadedByUserId)
      `);
  }
  const row = result.recordset[0] as { FileID: number; StoredFileName: string; OriginalFileName: string; MimeType: string; FileSizeBytes: number; RelativePath: string; FileCategory: string; UploadedAt: Date; UploadedByUserID: number; AccessToken?: string };
  const file: FileRecord = {
    fileId: row.FileID,
    storedFileName: row.StoredFileName,
    originalFileName: row.OriginalFileName,
    mimeType: row.MimeType,
    fileSizeBytes: row.FileSizeBytes,
    relativePath: row.RelativePath,
    fileCategory: row.FileCategory,
    uploadedAt: row.UploadedAt,
    uploadedByUserId: row.UploadedByUserID,
    ...(row.AccessToken != null ? { accessToken: row.AccessToken } : {}),
  };

  let assetFileId: number | undefined;
  if (options?.assetId != null) {
    const reqMax = await getRequest();
    const maxOrder = await reqMax.input('assetId', options.assetId).query(`
      SELECT ISNULL(MAX(DisplayOrder), 0) + 1 AS nextOrder FROM react_AssetFiles WHERE AssetID = @assetId
    `);
    const nextOrder = (maxOrder.recordset[0] as { nextOrder: number }).nextOrder;
    const reqAf = await getRequest();
    const afResult = await reqAf
      .input('assetId', options.assetId)
      .input('fileId', file.fileId)
      .input('displayOrder', nextOrder)
      .input('caption', options.caption ?? null)
      .input('attachedByUserId', userId)
      .query(`
        INSERT INTO react_AssetFiles (AssetID, FileID, DisplayOrder, Caption, AttachedByUserID)
        OUTPUT INSERTED.AssetFileID
        VALUES (@assetId, @fileId, @displayOrder, @caption, @attachedByUserId)
      `);
    assetFileId = (afResult.recordset[0] as { AssetFileID: number }).AssetFileID;
  }

  return { file, assetFileId };
}

export async function getFileById(fileId: number): Promise<{ file: FileRecord; absolutePath: string } | null> {
  const req = await getRequest();
  const result = await req.input('fileId', fileId).query(`
    SELECT FileID AS fileId, StoredFileName AS storedFileName, OriginalFileName AS originalFileName, MimeType AS mimeType,
           FileSizeBytes AS fileSizeBytes, RelativePath AS relativePath, FileCategory AS fileCategory, UploadedAt AS uploadedAt, UploadedByUserID AS uploadedByUserId
    FROM dbo.react_FileStore WHERE FileID = @fileId
  `);
  const row = result.recordset[0] as FileRecord | undefined;
  if (!row) return null;
  const absolutePath = safeJoin(process.cwd(), UPLOAD_DIR, row.relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  return { file: row, absolutePath };
}

/** Returns AccessToken for a file (e.g. CHAT). Null if no token or column missing. */
export async function getFileAccessToken(fileId: number): Promise<string | null> {
  const req = await getRequest();
  try {
    const result = await req.input('fileId', fileId).query(`
      SELECT AccessToken FROM dbo.react_FileStore WHERE FileID = @fileId
    `);
    const row = result.recordset?.[0] as { AccessToken?: string | null } | undefined;
    return row?.AccessToken ?? null;
  } catch {
    return null;
  }
}

/** Get file by chat access token (unguessable URL). Returns null if token invalid or not CHAT. */
export async function getFileByChatToken(token: string): Promise<{ file: FileRecord; absolutePath: string } | null> {
  if (!token || token.length > 64) return null;
  const req = await getRequest();
  const result = await req.input('token', token).query(`
    SELECT FileID AS fileId, StoredFileName AS storedFileName, OriginalFileName AS originalFileName, MimeType AS mimeType,
           FileSizeBytes AS fileSizeBytes, RelativePath AS relativePath, FileCategory AS fileCategory, UploadedAt AS uploadedAt, UploadedByUserID AS uploadedByUserId, AccessToken AS accessToken
    FROM dbo.react_FileStore WHERE AccessToken = @token AND FileCategory = N'CHAT'
  `);
  const row = result.recordset[0] as FileRecord | undefined;
  if (!row) return null;
  const absolutePath = safeJoin(process.cwd(), UPLOAD_DIR, row.relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  return { file: row, absolutePath };
}

export async function listFilesByAssetId(assetId: number): Promise<AssetFileRecord[]> {
  const req = await getRequest();
  const result = await req.input('assetId', assetId).query(`
    SELECT af.AssetFileID AS assetFileId, af.AssetID AS assetId, af.FileID AS fileId, af.DisplayOrder AS displayOrder,
           af.Caption AS caption, af.AttachedAt AS attachedAt, f.OriginalFileName AS originalFileName, f.MimeType AS mimeType, f.FileSizeBytes AS fileSizeBytes,
           CASE WHEN a.PrimaryFileID = af.FileID THEN 1 ELSE 0 END AS isPrimary
    FROM react_AssetFiles af
    INNER JOIN react_FileStore f ON f.FileID = af.FileID
    INNER JOIN react_Asset a ON a.AssetID = af.AssetID
    WHERE af.AssetID = @assetId ORDER BY af.DisplayOrder, af.AttachedAt
  `);
  const rows = (result.recordset || []) as (AssetFileRecord & { isPrimary?: number })[];
  return rows.map((r) => ({ ...r, isPrimary: r.isPrimary === 1 }));
}

export async function deleteFile(fileId: number, userId: number): Promise<boolean> {
  const record = await getFileById(fileId);
  if (!record) return false;
  const reqClear = await getRequest();
  await reqClear.input('fileId', fileId).query('UPDATE react_Asset SET PrimaryFileID = NULL WHERE PrimaryFileID = @fileId');
  const req = await getRequest();
  await req.input('fileId', fileId).query('DELETE FROM react_AssetFiles WHERE FileID = @fileId');
  const req2 = await getRequest();
  await req2.input('fileId', fileId).query('DELETE FROM react_FileStore WHERE FileID = @fileId');
  try {
    if (fs.existsSync(record.absolutePath)) fs.unlinkSync(record.absolutePath);
  } catch {
    // ignore
  }
  return true;
}

export async function unlinkAssetFile(assetId: number, fileId: number): Promise<boolean> {
  const req = await getRequest();
  const result = await req.input('assetId', assetId).input('fileId', fileId).query(`
    DELETE FROM react_AssetFiles WHERE AssetID = @assetId AND FileID = @fileId
  `);
  return (result.rowsAffected[0] ?? 0) > 0;
}
