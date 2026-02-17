/**
 * Asset CRUD and change-status. Audit on create/update/delete/status.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAudit, logAuditFromRequest, getClientIp, getUserAgent } from '../../services/auditService';
import { emitDashboardUpdate, emitNewAsset, emitAssetChanged } from '../../realtime/setup';
import { getRequest } from '../../config/db';
import * as assetService from '../../services/assetService';
import { assetCreateSchema, assetUpdateSchema, assetListQuerySchema, assetChangeStatusSchema } from '../../validators/assetSchemas';

function audit(req: AuthRequest, eventType: 'create' | 'update' | 'delete', entityType: string, entityId: string, details?: string) {
  logAudit({
    eventType,
    entityType,
    entityId,
    userId: req.user?.userId,
    userEmail: req.user?.email,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
    details,
  }).catch(() => {});
}

export async function listAssets(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const query = assetListQuerySchema.parse({
      page: req.query.page,
      pageSize: req.query.pageSize,
      status: req.query.status,
      categoryId: req.query.categoryId,
      locationId: req.query.locationId,
      assignedToUserId: req.query.assignedToUserId,
      search: req.query.search,
      q: req.query.q,
    });
    const result = await assetService.listAssets(query);
    res.json({ success: true, data: result.data, total: result.total });
  } catch (e) {
    next(e);
  }
}

export async function getAsset(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid asset ID'));
    const tabs = req.query.tabs !== 'false';
    const result = await assetService.getAssetById(id, tabs);
    if (!result) return next(new AppError(404, 'Asset not found'));
    res.json({ success: true, data: result });
  } catch (e) {
    next(e);
  }
}

export async function createAsset(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const body = assetCreateSchema.parse(req.body);
    const asset = await assetService.createAsset(body, req.user.userId);
    audit(req, 'create', 'asset', String(asset.assetId));
    emitDashboardUpdate();
    const reqDb = await getRequest();
    const nameResult = await reqDb.input('userId', req.user.userId).query('SELECT Name AS name FROM rb_users WHERE userid = @userId');
    const addedByName = (nameResult.recordset?.[0] as { name?: string } | undefined)?.name ?? req.user.email ?? 'Unknown';
    emitNewAsset({ assetId: asset.assetId, assetTag: asset.assetTag, addedByUserId: req.user.userId, addedByName });
    res.status(201).json({ success: true, data: asset });
  } catch (e) {
    next(e);
  }
}

export async function updateAsset(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid asset ID'));
    const body = assetUpdateSchema.parse(req.body);
    const asset = await assetService.updateAsset(id, body, req.user.userId);
    if (!asset) return next(new AppError(404, 'Asset not found'));
    audit(req, 'update', 'asset', String(id));
    emitDashboardUpdate();
    res.json({ success: true, data: asset });
  } catch (e) {
    next(e);
  }
}

export async function deleteAsset(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid asset ID'));
    const ok = await assetService.deleteAsset(id, req.user.userId);
    if (!ok) return next(new AppError(404, 'Asset not found'));
    audit(req, 'delete', 'asset', String(id));
    emitDashboardUpdate();
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function changeStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid asset ID'));
    const body = assetChangeStatusSchema.parse(req.body);
    const asset = await assetService.changeAssetStatus(id, body, req.user.userId);
    if (!asset) return next(new AppError(404, 'Asset not found'));
    audit(req, 'update', 'asset', String(id), `status: ${body.status}`);
    emitAssetChanged(id, { status: body.status, userName: req.user?.email ?? 'Someone' });
    emitDashboardUpdate();
    res.json({ success: true, data: asset });
  } catch (e) {
    next(e);
  }
}

export async function setPrimaryPhoto(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const assetId = parseInt(req.params.id, 10);
    if (Number.isNaN(assetId)) return next(new AppError(400, 'Invalid asset ID'));
    const body = req.body as { fileId?: number };
    const fileId = typeof body?.fileId === 'number' ? body.fileId : parseInt(String(body?.fileId ?? ''), 10);
    if (Number.isNaN(fileId)) return next(new AppError(400, 'fileId is required'));
    const asset = await assetService.setPrimaryPhoto(assetId, fileId, req.user.userId);
    if (!asset) return next(new AppError(404, 'Asset not found'));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'asset', entityId: String(assetId), details: 'primary photo set' });
    emitDashboardUpdate();
    res.json({ success: true, data: asset });
  } catch (e) {
    next(e);
  }
}
