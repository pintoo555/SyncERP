/**
 * RBAC: require one of the given permission codes for the current user.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { AppError } from './errorHandler';
import { getPermissionsForUser } from '../../modules/rbac';

export function requirePermission(...permissionCodes: string[]) {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      return next(new AppError(401, 'Authentication required'));
    }
    try {
      const userPerms = await getPermissionsForUser(req.user.userId);
      const hasAny = permissionCodes.some(code => userPerms.includes(code));
      if (!hasAny) {
        return next(new AppError(403, 'Insufficient permissions'));
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
