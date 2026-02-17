/**
 * Audit log list, search, and CSV export.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAudit, getClientIp, getUserAgent } from '../../services/auditService';
import * as auditListService from './audit.service';
import { auditListQuerySchema, auditExportQuerySchema } from '../../validators/auditSchemas';

function escapeCsv(s: string | null | undefined): string {
  if (s == null) return '';
  const t = String(s);
  if (t.includes('"') || t.includes(',') || t.includes('\n') || t.includes('\r')) {
    return '"' + t.replace(/"/g, '""') + '"';
  }
  return t;
}

function getDateRange(req: { query: Record<string, unknown> }): { dateFrom: string; dateTo: string } {
  const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined;
  const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined;
  const days = typeof req.query.days === 'string' ? parseInt(req.query.days, 10) : Number(req.query.days);
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;
  if (dateFrom && dateTo) return { dateFrom, dateTo };
  const n = !Number.isNaN(days) && days >= 1 && days <= 365 ? days : 30;
  const from = new Date(today);
  from.setDate(from.getDate() - n + 1);
  const fromStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
  return { dateFrom: fromStr, dateTo: todayStr };
}

export async function getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { dateFrom, dateTo } = getDateRange(req);
    const data = await auditListService.getAuditDashboardStats(dateFrom, dateTo);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const query = auditListQuerySchema.parse({
      page: req.query.page,
      pageSize: req.query.pageSize,
      eventType: req.query.eventType,
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      userId: req.query.userId,
      userEmail: req.query.userEmail,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      details: req.query.details,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    });
    const result = await auditListService.listAuditLog(query);
    res.json({ success: true, data: result.data, total: result.total });
  } catch (e) {
    next(e);
  }
}

export async function search(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const query = auditListQuerySchema.parse({
      page: req.query.page,
      pageSize: req.query.pageSize,
      eventType: req.query.eventType,
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      userId: req.query.userId,
      userEmail: req.query.userEmail,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      details: req.query.details,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    });
    const result = await auditListService.listAuditLog(query);
    res.json({ success: true, data: result.data, total: result.total });
  } catch (e) {
    next(e);
  }
}

export async function exportCsv(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const query = auditExportQuerySchema.parse({
      page: req.query.page,
      pageSize: req.query.pageSize,
      eventType: req.query.eventType,
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      userId: req.query.userId,
      userEmail: req.query.userEmail,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      details: req.query.details,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    });
    const rows = await auditListService.exportAuditLog(query);
    logAudit({
      eventType: 'export',
      entityType: 'audit',
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      details: `export ${rows.length} rows`,
    }).catch(() => {});

    const header = 'AuditID,EventType,EntityType,EntityID,UserID,UserEmail,IPAddress,UserAgent,Details,RequestMethod,RequestPath,CreatedAt\n';
    const body = rows
      .map(
        (r) =>
          [
            r.auditId,
            escapeCsv(r.eventType),
            escapeCsv(r.entityType),
            escapeCsv(r.entityId),
            r.userId ?? '',
            escapeCsv(r.userEmail),
            escapeCsv(r.ipAddress),
            escapeCsv(r.userAgent),
            escapeCsv(r.details),
            escapeCsv(r.requestMethod ?? ''),
            escapeCsv(r.requestPath ?? ''),
            escapeCsv(typeof r.createdAt === 'string' ? r.createdAt : String(r.createdAt)),
          ].join(',')
      )
      .join('\n');
    const csv = header + body;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-log.csv"');
    res.send(csv);
  } catch (e) {
    next(e);
  }
}

export async function exportPdf(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const query = auditExportQuerySchema.parse({
      page: req.query.page,
      pageSize: req.query.pageSize,
      eventType: req.query.eventType,
      entityType: req.query.entityType,
      entityId: req.query.entityId,
      userId: req.query.userId,
      userEmail: req.query.userEmail,
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      details: req.query.details,
      search: req.query.search,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder,
    });
    const buffer = await auditListService.exportAuditLogPdf(query);
    logAudit({
      eventType: 'export',
      entityType: 'audit',
      userId: req.user.userId,
      userEmail: req.user.email,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      details: 'export PDF',
    }).catch(() => {});

    const filename = `audit-log-${new Date().toISOString().slice(0, 10)}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (e) {
    next(e);
  }
}
