/**
 * Dashboard endpoints: admin, department, self (my assets).
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import * as dashboardService from './dashboards.service';

export async function admin(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await dashboardService.getAdminDashboard();
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function department(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const departmentId = parseInt(String(req.query.departmentId ?? req.params.departmentId ?? ''), 10);
    if (Number.isNaN(departmentId)) return next(new AppError(400, 'departmentId is required'));
    const data = await dashboardService.getDepartmentDashboard(departmentId);
    if (!data) return next(new AppError(404, 'Department not found'));
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}

export async function self(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const data = await dashboardService.getMyAssetsDashboard(req.user.userId);
    res.json({ success: true, data });
  } catch (e) {
    next(e);
  }
}
