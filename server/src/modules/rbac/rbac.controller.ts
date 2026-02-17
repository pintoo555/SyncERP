/**
 * RBAC controller – roles, permissions, user-role assignment.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAuditFromRequest } from '../../services/auditService';
import * as rbacService from './rbac.service';

export async function listRoles(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await rbacService.listRoles() });
  } catch (e) {
    next(e);
  }
}

export async function listPermissions(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await rbacService.listPermissions() });
  } catch (e) {
    next(e);
  }
}

export async function getRolePermissions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const roleId = parseInt(String(req.params.roleId), 10);
    if (Number.isNaN(roleId)) return next(new AppError(400, 'Invalid roleId'));
    res.json({ success: true, data: await rbacService.getRolePermissions(roleId) });
  } catch (e) {
    next(e);
  }
}

export async function setRolePermissions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const roleId = parseInt(String(req.params.roleId), 10);
    if (Number.isNaN(roleId)) return next(new AppError(400, 'Invalid roleId'));
    const permissionIds = Array.isArray(req.body.permissionIds) ? req.body.permissionIds as number[] : [];
    const userId = req.user?.userId;
    if (userId == null) return next(new AppError(401, 'Unauthorized'));
    await rbacService.setRolePermissions(roleId, permissionIds, userId);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'role', entityId: String(roleId), details: `role permissions updated (${permissionIds.length} permission(s))` });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function getUserRoles(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(String(req.params.userId), 10);
    if (Number.isNaN(userId)) return next(new AppError(400, 'Invalid userId'));
    res.json({ success: true, data: await rbacService.getUserRoles(userId) });
  } catch (e) {
    next(e);
  }
}

export async function assignUserRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(String(req.body.userId), 10);
    const roleId = parseInt(String(req.body.roleId), 10);
    if (Number.isNaN(userId) || Number.isNaN(roleId)) return next(new AppError(400, 'userId and roleId required'));
    const assignedBy = req.user?.userId;
    if (assignedBy == null) return next(new AppError(401, 'Unauthorized'));
    await rbacService.assignUserRole(userId, roleId, assignedBy);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'user_role', entityId: `${userId}:${roleId}`, details: 'role assigned' });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function revokeUserRole(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(String(req.body.userId), 10);
    const roleId = parseInt(String(req.body.roleId), 10);
    if (Number.isNaN(userId) || Number.isNaN(roleId)) return next(new AppError(400, 'userId and roleId required'));
    const revokedBy = req.user?.userId;
    if (revokedBy == null) return next(new AppError(401, 'Unauthorized'));
    await rbacService.revokeUserRole(userId, roleId, revokedBy);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'user_role', entityId: `${userId}:${roleId}`, details: 'role revoked' });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function bulkAssignRoles(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userIds = Array.isArray(req.body.userIds) ? (req.body.userIds as unknown[]).map((v) => parseInt(String(v), 10)).filter((n) => !Number.isNaN(n)) : [];
    const roleIds = Array.isArray(req.body.roleIds) ? (req.body.roleIds as unknown[]).map((v) => parseInt(String(v), 10)).filter((n) => !Number.isNaN(n)) : [];
    if (userIds.length === 0 || roleIds.length === 0) return next(new AppError(400, 'userIds and roleIds arrays required (non-empty)'));
    const assignedBy = req.user?.userId;
    if (assignedBy == null) return next(new AppError(401, 'Unauthorized'));
    const result = await rbacService.bulkAssignRoles(userIds, roleIds, assignedBy);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'user_role', details: `bulk assign: ${userIds.length} user(s), ${roleIds.length} role(s)` });
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
}

export async function bulkRevokeRoles(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userIds = Array.isArray(req.body.userIds) ? (req.body.userIds as unknown[]).map((v) => parseInt(String(v), 10)).filter((n) => !Number.isNaN(n)) : [];
    const roleIds = Array.isArray(req.body.roleIds) ? (req.body.roleIds as unknown[]).map((v) => parseInt(String(v), 10)).filter((n) => !Number.isNaN(n)) : [];
    if (userIds.length === 0 || roleIds.length === 0) return next(new AppError(400, 'userIds and roleIds arrays required (non-empty)'));
    const revokedBy = req.user?.userId;
    if (revokedBy == null) return next(new AppError(401, 'Unauthorized'));
    const result = await rbacService.bulkRevokeRoles(userIds, roleIds, revokedBy);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'user_role', details: `bulk revoke: ${userIds.length} user(s), ${roleIds.length} role(s)` });
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
}

export async function bulkAddPermissions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userIds = Array.isArray(req.body.userIds) ? (req.body.userIds as unknown[]).map((v) => parseInt(String(v), 10)).filter((n) => !Number.isNaN(n)) : [];
    const permissionIds = Array.isArray(req.body.permissionIds) ? (req.body.permissionIds as unknown[]).map((v) => parseInt(String(v), 10)).filter((n) => !Number.isNaN(n)) : [];
    if (userIds.length === 0 || permissionIds.length === 0) return next(new AppError(400, 'userIds and permissionIds arrays required (non-empty)'));
    const updatedBy = req.user?.userId;
    if (updatedBy == null) return next(new AppError(401, 'Unauthorized'));
    const result = await rbacService.bulkAddPermissions(userIds, permissionIds, updatedBy);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'user_permission', details: `bulk add permissions: ${userIds.length} user(s), ${permissionIds.length} permission(s)` });
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
}

export async function getUserPermissions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(String(req.params.userId), 10);
    if (Number.isNaN(userId)) return next(new AppError(400, 'Invalid userId'));
    res.json({ success: true, data: await rbacService.getUserPermissions(userId) });
  } catch (e) {
    next(e);
  }
}

export async function setUserPermissions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = parseInt(String(req.params.userId), 10);
    if (Number.isNaN(userId)) return next(new AppError(400, 'Invalid userId'));
    const permissionIds = Array.isArray(req.body.permissionIds) ? req.body.permissionIds as number[] : [];
    const updatedBy = req.user?.userId;
    if (updatedBy == null) return next(new AppError(401, 'Unauthorized'));
    await rbacService.setUserPermissions(userId, permissionIds, updatedBy);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'user_permission', entityId: String(userId), details: `permission overrides set (${permissionIds.length} permission(s))` });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function getAuditOverview(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    res.json({ success: true, data: await rbacService.getAuditOverview() });
  } catch (e) {
    next(e);
  }
}
