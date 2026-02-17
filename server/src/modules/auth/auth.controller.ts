/**
 * Auth controller – login, logout, sessions, password.
 */

import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest } from '../../shared/middleware/auth';
import { config } from '../../config/env';
import * as authService from './auth.service';
import { getPermissionsForUser } from '../rbac';
import { logAudit, getClientIp, getUserAgent } from '../../services/auditService';
import { AppError } from '../../shared/middleware/errorHandler';
import { getRequest } from '../../config/db';
import { getSessionsForUser, getAllActiveSessions, removeSession, addRevokedSessionId, removeRevokedSessionId } from '../../services/sessionStore';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: config.nodeEnv === 'production',
  sameSite: 'strict' as const,
  maxAge: 8 * 60 * 60 * 1000,
  path: '/',
};

const SESSION_HEADER = 'x-session-id';

export async function login(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      await logAudit({ eventType: 'login_failure', userEmail: email || undefined, ipAddress: getClientIp(req), userAgent: getUserAgent(req), details: 'Missing email or password' }).catch(() => {});
      return next(new AppError(400, 'Email and password are required'));
    }
    const user = await authService.validateLogin(String(email).trim(), password);
    const sessionId = (req.headers[SESSION_HEADER] as string)?.trim?.();
    if (sessionId) removeRevokedSessionId(sessionId);
    const payload = { userId: user.userid, email: user.Email };
    const token = jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn } as jwt.SignOptions);
    res.cookie(config.jwt.cookieName, token, COOKIE_OPTIONS);
    await logAudit({ eventType: 'login', entityType: 'user', entityId: String(user.userid), userId: user.userid, userEmail: user.Email, ipAddress: getClientIp(req), userAgent: getUserAgent(req) }).catch(() => {});
    res.json({ success: true, user: { userId: user.userid, name: user.Name, email: user.Email, departmentId: user.DepartmentID } });
  } catch (e) {
    if (e instanceof AppError && e.statusCode === 401) {
      await logAudit({ eventType: 'login_failure', userEmail: (req.body as { email?: string })?.email, ipAddress: getClientIp(req), userAgent: getUserAgent(req), details: e.message }).catch(() => {});
    }
    if (e instanceof AppError) return next(e);
    console.error('Login error:', e);
    next(new AppError(500, 'Internal server error'));
  }
}

export function socketToken(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    if (!req.user) return next(new AppError(401, 'Not authenticated'));
    const token = jwt.sign({ userId: req.user.userId, email: req.user.email }, config.jwt.secret, { expiresIn: '5m' } as jwt.SignOptions);
    res.json({ success: true, token });
  } catch (e) {
    next(e);
  }
}

export function logout(req: AuthRequest, res: Response): void {
  const userId = req.user?.userId;
  const email = req.user?.email;
  res.clearCookie(config.jwt.cookieName, { path: '/', httpOnly: true, sameSite: 'strict' });
  logAudit({ eventType: 'logout', entityType: 'user', entityId: userId != null ? String(userId) : undefined, userId, userEmail: email, ipAddress: getClientIp(req), userAgent: getUserAgent(req) }).catch(() => {});
  res.json({ success: true });
}

export async function currentUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) return next(new AppError(401, 'Not authenticated'));
  try {
    const reqDb = await getRequest();
    const userResult = await reqDb.input('userId', req.user.userId).query(`
      SELECT u.userid, u.Name, u.DepartmentID, u.Email, d.DepartmentName
      FROM rb_users u LEFT JOIN sync_Department d ON d.DepartmentID = u.DepartmentID
      WHERE u.userid = @userId
    `);
    const row = userResult.recordset[0] as { userid: number; Name: string; DepartmentID: number | null; Email: string; DepartmentName: string | null } | undefined;
    if (!row) return next(new AppError(404, 'User not found'));
    let permissions: string[] = [];
    try {
      permissions = await getPermissionsForUser(req.user.userId);
    } catch (permErr) {
      console.warn('Permissions query failed:', (permErr as Error).message);
    }
    let roles: { code: string; name: string }[] = [];
    try {
      const reqDb2 = await getRequest();
      const rolesResult = await reqDb2.input('userId', req.user.userId).query(`
        SELECT r.RoleCode, r.RoleName FROM react_Roles r
        INNER JOIN react_UserRoles ur ON ur.RoleID = r.RoleID AND ur.UserID = @userId AND ur.RevokedAt IS NULL
        WHERE r.IsActive = 1
      `);
      roles = (rolesResult.recordset as { RoleCode: string; RoleName: string }[]).map(r => ({ code: r.RoleCode, name: r.RoleName }));
    } catch (roleErr) {
      console.warn('Roles query failed:', (roleErr as Error).message);
    }
    res.json({
      success: true,
      user: { userId: row.userid, name: row.Name, email: row.Email, departmentId: row.DepartmentID, departmentName: row.DepartmentName, roles, permissions },
    });
  } catch (e) {
    if (e instanceof AppError) return next(e);
    console.error('GET /api/auth/me error:', e);
    res.clearCookie(config.jwt.cookieName, { path: '/', httpOnly: true, sameSite: 'strict' });
    next(new AppError(401, 'Session invalid or expired'));
  }
}

export function getSessions(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Not authenticated'));
    const currentId = (req.headers[SESSION_HEADER] as string)?.trim?.() || '';
    let sessions = getSessionsForUser(userId).map((s) => ({
      sessionId: s.sessionId, userAgent: s.userAgent, ipAddress: s.ipAddress,
      lastActivityAt: s.lastActivityAt.toISOString(), createdAt: s.createdAt.toISOString(), isCurrent: s.sessionId === currentId,
    }));
    if (sessions.length === 0) {
      const now = new Date().toISOString();
      sessions = [{ sessionId: currentId || 'current', userAgent: getUserAgent(req), ipAddress: getClientIp(req), lastActivityAt: now, createdAt: now, isCurrent: true }];
    }
    res.json({ success: true, sessions, currentSessionId: currentId || undefined });
  } catch (e) {
    next(e);
  }
}

export function revokeSession(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Not authenticated'));
    const targetId = (req.params as { id?: string }).id?.trim();
    if (!targetId) return next(new AppError(400, 'Session id required'));
    const currentId = (req.headers[SESSION_HEADER] as string)?.trim?.() || '';
    if (targetId === currentId) return next(new AppError(400, 'Cannot revoke current session'));
    removeSession(targetId);
    addRevokedSessionId(targetId);
    res.json({ success: true, removed: true });
  } catch (e) {
    next(e);
  }
}

export async function listAllSessionsForAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const sessions = getAllActiveSessions();
    const userIds = [...new Set(sessions.map((s) => s.userId))];
    const userMap = new Map<number, { name: string; email: string }>();
    if (userIds.length > 0) {
      const reqDb = await getRequest();
      for (let i = 0; i < userIds.length; i++) reqDb.input(`id${i}`, userIds[i]);
      const inClause = userIds.map((_, i) => `@id${i}`).join(',');
      const result = await reqDb.query(`SELECT userid AS userId, Name AS name, Email AS email FROM rb_users WHERE userid IN (${inClause})`);
      ((result.recordset || []) as { userId: number; name: string; email: string }[]).forEach((row) => userMap.set(row.userId, { name: row.name, email: row.email }));
    }
    const sessionsWithUser = sessions.map((s) => {
      const u = userMap.get(s.userId);
      return { sessionId: s.sessionId, userId: s.userId, userName: u?.name ?? '', userEmail: u?.email ?? '', userAgent: s.userAgent, ipAddress: s.ipAddress, lastActivityAt: s.lastActivityAt.toISOString(), createdAt: s.createdAt.toISOString() };
    });
    res.json({ success: true, sessions: sessionsWithUser });
  } catch (e) {
    next(e);
  }
}

export function revokeSessionsBulk(req: AuthRequest, res: Response, next: NextFunction): void {
  try {
    const sessionIds = req.body?.sessionIds;
    if (!Array.isArray(sessionIds) || sessionIds.length === 0) return next(new AppError(400, 'sessionIds array required'));
    let revoked = 0;
    for (const id of sessionIds) {
      const sid = typeof id === 'string' ? id.trim() : String(id).trim();
      if (sid.length > 0 && sid.length <= 64) {
        removeSession(sid);
        addRevokedSessionId(sid);
        revoked++;
      }
    }
    res.json({ success: true, revoked });
  } catch (e) {
    next(e);
  }
}

export async function changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(new AppError(401, 'Not authenticated'));
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) return next(new AppError(400, 'currentPassword and newPassword are required'));
    await authService.changePassword(req.user.userId, currentPassword, newPassword);
    res.json({ success: true });
  } catch (e) {
    if (e instanceof AppError) return next(e);
    next(e);
  }
}

export async function verifyPassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) return next(new AppError(401, 'Not authenticated'));
    const { password } = req.body as { password?: string };
    if (!password) return next(new AppError(400, 'password is required'));
    const valid = await authService.verifyPassword(req.user.userId, password);
    res.json({ success: true, valid });
  } catch (e) {
    if (e instanceof AppError) return next(e);
    next(e);
  }
}
