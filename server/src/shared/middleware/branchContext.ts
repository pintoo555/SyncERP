/**
 * Branch context middleware: reads X-Branch-Id header and attaches branch/company context to the request.
 * Skips validation for routes that don't need branch context (auth, settings, etc.).
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';

/** Routes that don't require branch context */
const SKIP_PREFIXES = ['/api/auth', '/api/rbac', '/api/settings', '/api/health', '/api/organization'];

/**
 * Extends the Express Request with branch context.
 * Applied globally after auth; sets req.branchId and req.companyId if header present.
 */
export function branchContext(req: AuthRequest, _res: Response, next: NextFunction): void {
  const path = req.originalUrl || req.path;

  // Skip for routes that don't need branch context
  if (SKIP_PREFIXES.some((p) => path.startsWith(p))) {
    return next();
  }

  const branchIdHeader = req.headers['x-branch-id'];
  if (branchIdHeader) {
    const branchId = Number(branchIdHeader);
    if (Number.isInteger(branchId) && branchId > 0) {
      (req as any).branchId = branchId;
    }
  }

  next();
}
