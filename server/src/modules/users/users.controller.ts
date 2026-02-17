/**
 * Users controller – request/response handling only.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import * as usersService from './users.service';

export async function listUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const result = await usersService.listUsers(search);
    res.json({ success: true, data: result.data, total: result.total });
  } catch (e) {
    next(e);
  }
}
