/**
 * Call Matrix controller. List (search) and dashboard stats.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import * as callMatrixService from './callMatrix.service';
import type { CallLogListQuery } from './callMatrix.types';

function parseNumber(val: unknown): number | undefined {
  if (val == null || val === '') return undefined;
  const n = Number(val);
  return Number.isNaN(n) ? undefined : n;
}

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const query: CallLogListQuery = {
      page: Math.max(1, parseNumber(req.query.page) ?? 1),
      pageSize: Math.min(100, Math.max(1, parseNumber(req.query.pageSize) ?? 20)),
      dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
      dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
      callDirection: typeof req.query.callDirection === 'string' ? req.query.callDirection : undefined,
      callType: typeof req.query.callType === 'string' ? req.query.callType : undefined,
      fromNumber: typeof req.query.fromNumber === 'string' ? req.query.fromNumber : undefined,
      toNumber: typeof req.query.toNumber === 'string' ? req.query.toNumber : undefined,
      minDurationSeconds: parseNumber(req.query.minDurationSeconds),
      sortBy: typeof req.query.sortBy === 'string' ? req.query.sortBy : 'recordingStart',
      sortOrder: req.query.sortOrder === 'asc' ? 'asc' : 'desc',
    };
    const result = await callMatrixService.listCallLogs(query);
    res.json({ success: true, data: result.data, total: result.total });
  } catch (e) {
    next(e);
  }
}

export async function getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined;
    const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined;
    const days = Math.min(365, Math.max(1, parseNumber(req.query.days) ?? 30));
    const options = dateFrom && dateTo ? { dateFrom, dateTo } : { days };
    const data = await callMatrixService.getDashboardStats(options);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}
