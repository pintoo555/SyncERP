/**
 * App settings and user preferences handlers.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAuditFromRequest } from '../../services/auditService';
import * as appSettingsService from '../../services/appSettingsService';
import * as userPreferencesService from '../../services/userPreferencesService';

/** Get app-level settings for the client (timezone, etc.). */
export async function getAppSettings(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const timeZone = await appSettingsService.getTimeZone();
    res.json({ timeZone });
  } catch (e) {
    next(e);
  }
}

/** Update app settings (timezone). */
export async function updateAppSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const timeZone = typeof req.body?.timeZone === 'string' ? req.body.timeZone.trim() : '';
    const valid = timeZone.length <= 64 && /^[A-Za-z0-9_+/.-]+$/.test(timeZone);
    if (!valid && timeZone !== '') {
      res.status(400).json({ success: false, error: 'Invalid timezone value' });
      return;
    }
    await appSettingsService.setValue('TimeZone', timeZone || 'Asia/Kolkata');
    const newTz = await appSettingsService.getTimeZone();
    logAuditFromRequest(req, { eventType: 'update', entityType: 'settings_app', details: 'timezone updated' });
    res.json({ success: true, timeZone: newTz });
  } catch (e) {
    next(e);
  }
}

/** Get current user's preferences (idle lock minutes, theme). */
export async function getUserPreferences(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const [idleLockMinutes, theme] = await Promise.all([
      userPreferencesService.getIdleLockMinutes(req.user.userId),
      userPreferencesService.getTheme(req.user.userId),
    ]);
    res.json({ idleLockMinutes, theme });
  } catch (e) {
    next(e);
  }
}

/** Update current user's preferences (idle lock minutes, theme). */
export async function updateUserPreferences(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const body = req.body as { idleLockMinutes?: number; theme?: string };
    const out: { idleLockMinutes?: number; theme?: 'light' | 'dark' } = {};
    if (body?.idleLockMinutes !== undefined) {
      const raw = body.idleLockMinutes;
      const minutes = typeof raw === 'number' && Number.isInteger(raw) && raw >= 0
        ? Math.min(1440, raw)
        : (typeof raw === 'string' ? parseInt(raw, 10) : NaN);
      const value = Number.isNaN(minutes) ? 0 : Math.max(0, minutes);
      await userPreferencesService.setIdleLockMinutes(req.user.userId, value);
      out.idleLockMinutes = value;
    }
    if (body?.theme === 'dark' || body?.theme === 'light') {
      await userPreferencesService.setTheme(req.user.userId, body.theme);
      out.theme = body.theme;
    }
    logAuditFromRequest(req, { eventType: 'update', entityType: 'settings_user_preferences', entityId: String(req.user.userId) });
    res.json({ success: true, ...out });
  } catch (e) {
    next(e);
  }
}
