/**
 * My Assets: list assets issued to current user with summary (value, warranty).
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import * as dashboardService from '../../services/dashboardService';

export async function myAssets(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const data = await dashboardService.getMyAssetsDashboard(req.user.userId);
    res.json({ success: true, data: data.assets, total: data.totalCount, summary: {
      totalPurchaseValue: data.totalPurchaseValue,
      warrantyExpiringCount: data.warrantyExpiringCount,
      warrantyExpiredCount: data.warrantyExpiredCount,
    } });
  } catch (e) {
    next(e);
  }
}
