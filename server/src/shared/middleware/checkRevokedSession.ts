/**
 * If the request has X-Session-Id and that session was revoked, clear auth cookie and return 401.
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../../config/env';
import { isSessionRevoked } from '../../services/sessionStore';

const SESSION_HEADER = 'x-session-id';

export function checkRevokedSession(req: Request, res: Response, next: NextFunction): void {
  if (req.method === 'POST' && (req.path === '/auth/login' || req.originalUrl?.includes('/api/auth/login'))) {
    return next();
  }
  const raw = req.headers[SESSION_HEADER];
  const sessionId = (Array.isArray(raw) ? raw[0] : raw)?.trim?.();
  if (!sessionId || sessionId.length > 64) {
    return next();
  }
  if (!isSessionRevoked(sessionId)) {
    return next();
  }
  res.clearCookie(config.jwt.cookieName, { path: '/', httpOnly: true, sameSite: 'strict' });
  res.status(401).json({ success: false, error: 'Session revoked. Please sign in again.' });
}
