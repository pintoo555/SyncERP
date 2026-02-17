/**
 * Asset verification: create, list. Audit on create.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAudit, getClientIp, getUserAgent } from '../../services/auditService';
import * as verificationService from '../../services/verificationService';
import { verificationCreateSchema, verificationListQuerySchema } from '../../validators/verificationSchemas';

function audit(req: AuthRequest, entityType: string, entityId: string) {
  logAudit({
    eventType: 'create',
    entityType,
    entityId,
    userId: req.user?.userId,
    userEmail: req.user?.email,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
  }).catch(() => {});
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const query = verificationListQuerySchema.parse({
      page: req.query.page,
      pageSize: req.query.pageSize,
      assetId: req.query.assetId,
    });
    const result = await verificationService.listVerifications(query);
    res.json({ success: true, data: result.data, total: result.total });
  } catch (e) {
    next(e);
  }
}

export async function getVerification(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid verification ID'));
    const record = await verificationService.getVerificationById(id);
    if (!record) return next(new AppError(404, 'Verification not found'));
    res.json({ success: true, data: record });
  } catch (e) {
    next(e);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const body = verificationCreateSchema.parse(req.body);
    const record = await verificationService.createVerification(body, req.user.userId);
    audit(req, 'verification', String(record.verificationId));
    res.status(201).json({ success: true, data: record });
  } catch (e) {
    next(e);
  }
}
