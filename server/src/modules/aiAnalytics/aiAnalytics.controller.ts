/**
 * AI Analytics: usage stats, top users, model breakdown, search.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import * as aiUsageService from '../../services/aiUsageService';

export async function getAnalytics(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.query.userId ? parseInt(String(req.query.userId), 10) : undefined;
    const serviceCode = typeof req.query.serviceCode === 'string' ? req.query.serviceCode : undefined;
    const model = typeof req.query.model === 'string' ? req.query.model : undefined;
    const feature = typeof req.query.feature === 'string' ? req.query.feature : undefined;
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined;
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const filters: aiUsageService.AnalyticsFilters = {};
    if (userId != null && !Number.isNaN(userId)) filters.userId = userId;
    if (serviceCode) filters.serviceCode = serviceCode;
    if (model) filters.model = model;
    if (feature) filters.feature = feature;
    if (dateFrom) filters.dateFrom = dateFrom;
    if (dateTo) filters.dateTo = dateTo;
    if (search) filters.search = search;

    const data = await aiUsageService.getAnalytics(filters);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}
