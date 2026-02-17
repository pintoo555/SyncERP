/**
 * JWT authentication middleware. Reads token from httpOnly cookie.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../../config/env';
import { AppError } from './errorHandler';

export interface JwtPayload {
  userId: number;
  email: string;
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export function requireAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[config.jwt.cookieName];
  if (!token) {
    return next(new AppError(401, 'Authentication required'));
  }
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
}

export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[config.jwt.cookieName];
  if (!token) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = decoded;
  } catch {
    // ignore
  }
  next();
}
