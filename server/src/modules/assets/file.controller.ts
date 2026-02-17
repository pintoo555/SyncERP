/**
 * File upload (multer), stream download, delete. Audit upload/delete.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAudit, getClientIp, getUserAgent } from '../../services/auditService';
import * as fileService from '../../services/fileService';
import fs from 'fs';

function audit(req: AuthRequest, eventType: 'upload' | 'delete', entityType: string, entityId: string) {
  logAudit({
    eventType: eventType === 'upload' ? 'upload' : 'delete',
    entityType,
    entityId,
    userId: req.user?.userId,
    userEmail: req.user?.email,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  }).catch(() => {});
}

export async function upload(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const file = (req as any).file;
    if (!file || !file.buffer) return next(new AppError(400, 'No file uploaded'));
    const assetId = req.body?.assetId != null ? parseInt(String(req.body.assetId), 10) : undefined;
    const caption = typeof req.body?.caption === 'string' ? req.body.caption.slice(0, 200) : undefined;
    const fileCategory = typeof req.body?.fileCategory === 'string' ? req.body.fileCategory.slice(0, 50) : 'DOCUMENT';

    const { file: saved, assetFileId } = await fileService.saveFile(
      file.buffer,
      file.originalname || 'file',
      file.mimetype || 'application/octet-stream',
      req.user.userId,
      assetId != null && !Number.isNaN(assetId) ? { assetId, caption, fileCategory } : undefined
    );
    audit(req, 'upload', 'file', String(saved.fileId));
    res.status(201).json({
      success: true,
      data: {
        fileId: saved.fileId,
        originalFileName: saved.originalFileName,
        mimeType: saved.mimeType,
        fileSizeBytes: saved.fileSizeBytes,
        assetFileId: assetFileId ?? null,
      },
    });
  } catch (e) {
    next(e);
  }
}

export async function getFile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    if (Number.isNaN(fileId)) return next(new AppError(400, 'Invalid file ID'));
    const record = await fileService.getFileById(fileId);
    if (!record) return next(new AppError(404, 'File not found'));
    const disposition = record.file.originalFileName
      ? `attachment; filename="${record.file.originalFileName.replace(/"/g, '\\"')}"`
      : 'attachment';
    res.setHeader('Content-Type', record.file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', disposition);
    const stream = fs.createReadStream(record.absolutePath);
    stream.on('error', () => next(new AppError(500, 'File read error')));
    stream.pipe(res);
  } catch (e) {
    next(e);
  }
}

export async function deleteFile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const fileId = parseInt(req.params.fileId, 10);
    if (Number.isNaN(fileId)) return next(new AppError(400, 'Invalid file ID'));
    const ok = await fileService.deleteFile(fileId, req.user.userId);
    if (!ok) return next(new AppError(404, 'File not found'));
    audit(req, 'delete', 'file', String(fileId));
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function listByAsset(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const assetId = parseInt(req.params.assetId, 10);
    if (Number.isNaN(assetId)) return next(new AppError(400, 'Invalid asset ID'));
    const files = await fileService.listFilesByAssetId(assetId);
    res.json({ success: true, data: files });
  } catch (e) {
    next(e);
  }
}
