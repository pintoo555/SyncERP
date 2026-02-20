/**
 * System health API – CPU, RAM, disk, alerts.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { getRequest } from '../../config/db';
import { logAuditFromRequest } from '../../services/auditService';
import * as healthService from '../../services/healthService';
import * as healthAlertService from '../../services/healthAlertService';

export async function getHealth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = await healthService.getHealthSnapshot();
    await healthAlertService.processHealthAlerts(data);
    res.json({ success: true, data });
  } catch (e) {
    console.error('GET /api/health error:', e);
    next(e);
  }
}

export async function getAlerts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const alerts = await healthAlertService.getAlertsForUser(userId);
    const activeCount = await healthAlertService.getActiveAlertCount(userId);
    res.json({ success: true, data: { alerts, activeCount } });
  } catch (e) {
    console.error('GET /api/health/alerts error:', e);
    next(e);
  }
}

export async function acknowledgeAlert(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid alert ID' });
      return;
    }
    const ok = await healthAlertService.acknowledgeAlert(id, userId);
    if (!ok) {
      res.status(404).json({ success: false, message: 'Alert not found or already acknowledged' });
      return;
    }
    logAuditFromRequest(req, { eventType: 'update', entityType: 'health_alert', entityId: String(id), details: 'acknowledged' });
    res.json({ success: true });
  } catch (e) {
    console.error('POST /api/health/alerts/:id/acknowledge error:', e);
    next(e);
  }
}

export async function acknowledgeAllAlerts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }
    const count = await healthAlertService.acknowledgeAllAlerts(userId);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'health_alert', details: `acknowledge all (${count})` });
    res.json({ success: true, data: { count } });
  } catch (e) {
    console.error('POST /api/health/alerts/acknowledge-all error:', e);
    next(e);
  }
}

export async function getUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const reqDb = await getRequest();
    let result: { recordset?: unknown[] };
    try {
      result = await reqDb.query(`
        SELECT UserId AS userId, Name AS name
        FROM utbl_Users_Master
        WHERE (IsActive = 1 OR IsActive IS NULL)
        ORDER BY Name
      `);
    } catch {
      result = await reqDb.query(`
        SELECT UserId AS userId, Name AS name FROM utbl_Users_Master ORDER BY Name
      `);
    }
    const rows = (result.recordset || []) as Array<{ userId?: number; userid?: number; name?: string; Name?: string }>;
    const users = rows.map((r) => ({ userId: r.userId ?? r.userid ?? 0, name: String(r.name ?? r.Name ?? '').trim() })).filter((u) => u.userId > 0 && u.name);
    res.json({ success: true, data: users });
  } catch (e) {
    console.error('GET /api/health/users error:', e);
    next(e);
  }
}

export async function getSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const settings = await healthAlertService.listSettings();
    res.json({ success: true, data: settings });
  } catch (e) {
    console.error('GET /api/health/settings error:', e);
    next(e);
  }
}

export async function createSetting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body || {};
    const id = await healthAlertService.createSetting({
      metric: body.metric,
      thresholdPercent: body.thresholdPercent,
      diskPath: body.diskPath ?? null,
      enabled: body.enabled !== false,
      recipientUserIds: Array.isArray(body.recipientUserIds) ? body.recipientUserIds : [],
    });
    logAuditFromRequest(req, { eventType: 'create', entityType: 'health_setting', entityId: String(id) });
    res.status(201).json({ success: true, data: { id } });
  } catch (e) {
    console.error('POST /api/health/settings error:', e);
    next(e);
  }
}

export async function updateSetting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid ID' });
      return;
    }
    const body = req.body || {};
    const ok = await healthAlertService.updateSetting(id, {
      metric: body.metric,
      thresholdPercent: body.thresholdPercent,
      diskPath: body.diskPath,
      enabled: body.enabled,
      recipientUserIds: body.recipientUserIds,
    });
    if (!ok) {
      res.status(404).json({ success: false, message: 'Setting not found' });
      return;
    }
    logAuditFromRequest(req, { eventType: 'update', entityType: 'health_setting', entityId: String(id) });
    res.json({ success: true });
  } catch (e) {
    console.error('PUT /api/health/settings/:id error:', e);
    next(e);
  }
}

export async function deleteSetting(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ success: false, message: 'Invalid ID' });
      return;
    }
    const ok = await healthAlertService.deleteSetting(id);
    if (!ok) {
      res.status(404).json({ success: false, message: 'Setting not found' });
      return;
    }
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'health_setting', entityId: String(id) });
    res.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/health/settings/:id error:', e);
    next(e);
  }
}
