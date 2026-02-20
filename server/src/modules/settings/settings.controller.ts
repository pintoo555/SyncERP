/**
 * App settings and user preferences handlers.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAuditFromRequest } from '../../services/auditService';
import * as appSettingsService from '../../services/appSettingsService';
import * as userPreferencesService from '../../services/userPreferencesService';
import * as brandKitService from '../../services/brandKitService';
import * as brandKitAiService from '../../services/brandKitAiService';

/** Get app-level settings for the client (timezone, chat improve AI model, etc.). */
export async function getAppSettings(_req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const [timeZone, chatImproveAiServiceCode] = await Promise.all([
      appSettingsService.getTimeZone(),
      appSettingsService.getValue('ChatImproveAiServiceCode'),
    ]);
    res.json({
      timeZone,
      chatImproveAiServiceCode: chatImproveAiServiceCode?.trim() ?? '',
    });
  } catch (e) {
    next(e);
  }
}

/** Update app settings (timezone, chat improve AI model). */
export async function updateAppSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as { timeZone?: string; chatImproveAiServiceCode?: string };
    const updates: string[] = [];

    if (body?.timeZone !== undefined) {
      const timeZone = typeof body.timeZone === 'string' ? body.timeZone.trim() : '';
      const valid = timeZone.length <= 64 && /^[A-Za-z0-9_+/.-]+$/.test(timeZone);
      if (!valid && timeZone !== '') {
        res.status(400).json({ success: false, error: 'Invalid timezone value' });
        return;
      }
      await appSettingsService.setValue('TimeZone', timeZone || 'Asia/Kolkata');
      updates.push('timezone');
    }

    if (body?.chatImproveAiServiceCode !== undefined) {
      const value = typeof body.chatImproveAiServiceCode === 'string' ? body.chatImproveAiServiceCode.trim().slice(0, 50) : '';
      await appSettingsService.setValue('ChatImproveAiServiceCode', value);
      updates.push('chatImproveAiServiceCode');
    }

    const [timeZone, chatImproveAiServiceCode] = await Promise.all([
      appSettingsService.getTimeZone(),
      appSettingsService.getValue('ChatImproveAiServiceCode'),
    ]);
    if (updates.length) {
      logAuditFromRequest(req, { eventType: 'update', entityType: 'settings_app', details: updates.join(', ') + ' updated' });
    }
    res.json({
      success: true,
      timeZone,
      chatImproveAiServiceCode: chatImproveAiServiceCode?.trim() ?? '',
    });
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

/** Get company brand kit (colors, logo, fonts) – used by WhatsApp, emails, reports, PDFs. */
export async function getBrandKit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const kit = await brandKitService.getBrandKit();
    res.json({ success: true, data: kit });
  } catch (e) {
    next(e);
  }
}

/** Update company brand kit. */
export async function updateBrandKit(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as Record<string, unknown>;
    const data: Parameters<typeof brandKitService.updateBrandKit>[0] = {};
    if (body.companyName !== undefined) data.companyName = body.companyName != null ? String(body.companyName) : null;
    if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl != null ? String(body.logoUrl) : null;
    if (body.primaryColor !== undefined) data.primaryColor = body.primaryColor != null ? String(body.primaryColor) : null;
    if (body.secondaryColor !== undefined) data.secondaryColor = body.secondaryColor != null ? String(body.secondaryColor) : null;
    if (body.accentColor !== undefined) data.accentColor = body.accentColor != null ? String(body.accentColor) : null;
    if (body.backgroundColor !== undefined) data.backgroundColor = body.backgroundColor != null ? String(body.backgroundColor) : null;
    if (body.textColor !== undefined) data.textColor = body.textColor != null ? String(body.textColor) : null;
    if (body.fontHeading !== undefined) data.fontHeading = body.fontHeading != null ? String(body.fontHeading) : null;
    if (body.fontBody !== undefined) data.fontBody = body.fontBody != null ? String(body.fontBody) : null;

    const updated = await brandKitService.updateBrandKit(data);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'brand_kit', details: 'Brand kit updated' });
    res.json({ success: true, data: updated });
  } catch (e) {
    if (e instanceof Error && e.message.includes('Invalid hex')) {
      next(new AppError(400, e.message));
      return;
    }
    next(e);
  }
}

/** AI: suggest brand palette from image (URL or base64). */
export async function suggestBrandKitFromImage(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as { imageUrl?: string; imageBase64?: string };
    const palette = await brandKitAiService.getPaletteFromImage(
      { imageUrl: body?.imageUrl, imageBase64: body?.imageBase64 },
      { userId: req.user?.userId }
    );
    res.json({ success: true, data: palette });
  } catch (e) {
    next(e);
  }
}

/** AI: suggest brand palette (and optional company name) from website URL. */
export async function suggestBrandKitFromWebsite(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const url = (req.body as { url?: string })?.url;
    if (!url || typeof url !== 'string' || !url.trim()) {
      res.status(400).json({ success: false, error: 'URL is required' });
      return;
    }
    const palette = await brandKitAiService.getPaletteFromWebsite(url.trim(), { userId: req.user?.userId });
    res.json({ success: true, data: palette });
  } catch (e) {
    next(e);
  }
}
