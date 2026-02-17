/**
 * Asset search API. Audits search events.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { logAudit, logAuditFromRequest, getClientIp, getUserAgent } from '../../services/auditService';
import * as searchService from '../../services/searchService';
import { assetSearchQuerySchema } from '../../validators/searchSchemas';

export async function searchAssets(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const query = assetSearchQuerySchema.parse({
      q: req.query.q,
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    const result = await searchService.searchAssets(query.q, query.page, query.pageSize);
    logAudit({
      eventType: 'search',
      entityType: 'asset',
      userId: req.user?.userId,
      userEmail: req.user?.email,
      ipAddress: getClientIp(req),
      userAgent: getUserAgent(req),
      details: `q=${query.q.slice(0, 100)}`,
    }).catch(() => {});
    res.json({ success: true, data: result.data, total: result.total });
  } catch (e) {
    next(e);
  }
}

export async function rebuildIndex(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await searchService.rebuildSearchIndex();
    logAuditFromRequest(req, { eventType: 'update', entityType: 'asset_search_index', details: `rebuilt ${result.updated} assets` });
    res.json({ success: true, data: { updated: result.updated } });
  } catch (e) {
    next(e);
  }
}
