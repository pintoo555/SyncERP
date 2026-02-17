/**
 * Assignment: issue, return, transfer. Audit and realtime emit.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAudit, getClientIp, getUserAgent } from '../../services/auditService';
import { emitAssetChanged, emitDashboardUpdate } from '../../realtime/setup';
import * as assignmentService from '../../services/assignmentService';
import { issueSchema, returnSchema, transferSchema } from '../../validators/assignmentSchemas';

function audit(req: AuthRequest, eventType: 'create' | 'update', entityType: string, entityId: string, details?: string) {
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

export async function issue(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const body = issueSchema.parse(req.body);
    const assignment = await assignmentService.issueAsset(body, req.user.userId);
    audit(req, 'create', 'assignment', String(assignment.assignmentId), `issue asset ${assignment.assetId} to user ${body.assignedToUserId}`);
    emitAssetChanged(assignment.assetId, {
      status: 'ISSUED',
      userName: req.user?.email ?? 'Someone',
      assignedToUserId: assignment.assignedToUserId,
      assignedToUserName: assignment.assignedToUserName,
    });
    emitDashboardUpdate();
    res.status(201).json({ success: true, data: assignment });
  } catch (e) {
    next(e);
  }
}

export async function returnAssignment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const body = returnSchema.parse(req.body);
    const assignment = await assignmentService.returnAsset(body, req.user.userId);
    if (!assignment) return next(new AppError(404, 'Assignment not found'));
    audit(req, 'update', 'assignment', String(body.assignmentId), 'return');
    emitAssetChanged(assignment.assetId, {
      status: 'AVAILABLE',
      userName: req.user?.email ?? 'Someone',
      assignedToUserId: null,
      assignedToUserName: null,
    });
    emitDashboardUpdate();
    res.json({ success: true, data: assignment });
  } catch (e) {
    next(e);
  }
}

export async function transfer(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const body = transferSchema.parse(req.body);
    const assignment = await assignmentService.transferAsset(body, req.user.userId);
    audit(req, 'create', 'assignment', String(assignment.assignmentId), `transfer asset ${body.assetId} to user ${body.toUserId}`);
    emitAssetChanged(assignment.assetId, {
      status: 'ISSUED',
      userName: req.user?.email ?? 'Someone',
      assignedToUserId: assignment.assignedToUserId,
      assignedToUserName: assignment.assignedToUserName,
    });
    emitDashboardUpdate();
    res.status(201).json({ success: true, data: assignment });
  } catch (e) {
    next(e);
  }
}

export async function getHistory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const assetId = parseInt(String(req.query.assetId ?? ''), 10);
    if (Number.isNaN(assetId)) return next(new AppError(400, 'Asset ID (assetId) is required'));
    const history = await assignmentService.getAssignmentHistoryByAssetId(assetId);
    res.json({ success: true, data: history });
  } catch (e) {
    next(e);
  }
}

/** GET /history/by-user?userId= — all issue/return history for a user (admin trace). */
export async function getHistoryByUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(String(req.query.userId ?? ''), 10);
    if (Number.isNaN(userId)) return next(new AppError(400, 'User ID (userId) is required'));
    const history = await assignmentService.getAssignmentHistoryByUserId(userId);
    res.json({ success: true, data: history });
  } catch (e) {
    next(e);
  }
}
