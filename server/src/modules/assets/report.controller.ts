/**
 * Reports API: summary, warranty, assignments.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import * as reportService from '../../services/reportService';

export async function getSummary(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getReportSummary();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function getWarranty(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await reportService.getReportWarranty();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function getAssignments(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const days = Math.min(365, Math.max(1, parseInt(String(req.query.days || 30), 10) || 30));
    const data = await reportService.getReportAssignments(days);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}
