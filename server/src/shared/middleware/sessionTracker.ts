/**
 * Updates the session store on every authenticated API request when client sends X-Session-Id.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './auth';
import { addOrUpdateSession } from '../../services/sessionStore';
import { getClientIp, getUserAgent } from '../../services/auditService';

const SESSION_HEADER = 'x-session-id';

export function sessionTracker(req: Request, _res: Response, next: NextFunction): void {
  const authReq = req as AuthRequest;
  if (!authReq.user?.userId) {
    return next();
  }
  const raw = authReq.headers[SESSION_HEADER];
  const sessionId = Array.isArray(raw) ? raw[0] : raw;
  if (sessionId && typeof sessionId === 'string' && sessionId.length <= 64) {
    addOrUpdateSession(
      sessionId.trim(),
      authReq.user.userId,
      getUserAgent(req),
      getClientIp(req)
    );
  }
  next();
}
