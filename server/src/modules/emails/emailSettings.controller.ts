/**
 * Email settings API: list, get, create, update, delete, set default, send test.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAuditFromRequest } from '../../services/auditService';
import * as emailSettingsService from '../../services/emailSettingsService';
import * as emailSender from '../../services/emailSender';

export async function list(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const items = await emailSettingsService.list(true);
    res.json({ success: true, data: items });
  } catch (e) {
    next(e);
  }
}

export async function getById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String((req.params as { id?: string }).id), 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid id'));
    const item = await emailSettingsService.getById(id, false);
    if (!item) return next(new AppError(404, 'Email setting not found'));
    res.json({ success: true, data: item });
  } catch (e) {
    next(e);
  }
}

export async function create(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body as Record<string, unknown>;
    const input: emailSettingsService.CreateInput = {
      name: String(body.name ?? '').trim(),
      type: (body.type === 'api' ? 'api' : 'smtp') as emailSettingsService.EmailSettingType,
      isDefault: body.isDefault === true,
      isActive: body.isActive !== false,
      fromEmail: String(body.fromEmail ?? '').trim(),
      fromName: body.fromName != null ? String(body.fromName).trim() || null : null,
      smtpHost: body.smtpHost != null ? String(body.smtpHost).trim() || null : null,
      smtpPort: body.smtpPort != null ? Number(body.smtpPort) || null : null,
      smtpSecure: body.smtpSecure === true,
      smtpUsername: body.smtpUsername != null ? String(body.smtpUsername).trim() || null : null,
      smtpPassword: body.smtpPassword != null ? String(body.smtpPassword) : null,
      apiProvider: body.apiProvider != null ? String(body.apiProvider).trim() as emailSettingsService.ApiProvider || null : null,
      apiUrl: body.apiUrl != null ? String(body.apiUrl).trim() || null : null,
      apiKey: body.apiKey != null ? String(body.apiKey) : null,
      apiDomain: body.apiDomain != null ? String(body.apiDomain).trim() || null : null,
    };
    if (!input.name) return next(new AppError(400, 'Name is required'));
    if (!input.fromEmail) return next(new AppError(400, 'From email is required'));
    const created = await emailSettingsService.create(input);
    logAuditFromRequest(req, { eventType: 'create', entityType: 'email_setting', entityId: String(created.id), details: input.name });
    res.status(201).json({ success: true, data: created });
  } catch (e) {
    next(e);
  }
}

export async function update(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String((req.params as { id?: string }).id), 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid id'));
    const body = req.body as Record<string, unknown>;
    const input: emailSettingsService.UpdateInput = {};
    if (body.name !== undefined) input.name = String(body.name).trim();
    if (body.isDefault !== undefined) input.isDefault = body.isDefault === true;
    if (body.isActive !== undefined) input.isActive = body.isActive !== false;
    if (body.fromEmail !== undefined) input.fromEmail = String(body.fromEmail).trim();
    if (body.fromName !== undefined) input.fromName = String(body.fromName).trim() || null;
    if (body.smtpHost !== undefined) input.smtpHost = String(body.smtpHost).trim() || null;
    if (body.smtpPort !== undefined) input.smtpPort = Number(body.smtpPort) || null;
    if (body.smtpSecure !== undefined) input.smtpSecure = body.smtpSecure === true;
    if (body.smtpUsername !== undefined) input.smtpUsername = String(body.smtpUsername).trim() || null;
    if (body.smtpPassword !== undefined) input.smtpPassword = String(body.smtpPassword);
    if (body.apiProvider !== undefined) input.apiProvider = String(body.apiProvider).trim() as emailSettingsService.ApiProvider || null;
    if (body.apiUrl !== undefined) input.apiUrl = String(body.apiUrl).trim() || null;
    if (body.apiKey !== undefined) input.apiKey = String(body.apiKey);
    if (body.apiDomain !== undefined) input.apiDomain = String(body.apiDomain).trim() || null;
    const updated = await emailSettingsService.update(id, input);
    if (!updated) return next(new AppError(404, 'Email setting not found'));
    res.json({ success: true, data: updated });
  } catch (e) {
    next(e);
  }
}

export async function remove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String((req.params as { id?: string }).id), 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid id'));
    const deleted = await emailSettingsService.remove(id);
    if (!deleted) return next(new AppError(404, 'Email setting not found'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'email_setting', entityId: String(id) });
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

export async function setDefault(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String((req.params as { id?: string }).id), 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid id'));
    const ok = await emailSettingsService.setDefault(id);
    if (!ok) return next(new AppError(404, 'Email setting not found'));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'email_setting', entityId: String(id), details: 'set default' });
    const list = await emailSettingsService.list(true);
    res.json({ success: true, data: list });
  } catch (e) {
    next(e);
  }
}

export async function sendTest(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(String((req.params as { id?: string }).id), 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid id'));
    const to = typeof req.body?.to === 'string' ? req.body.to.trim() : (req.body?.to ?? '');
    if (!to) return next(new AppError(400, 'Recipient email (to) is required'));
    const config = await emailSettingsService.getById(id, false);
    if (!config) return next(new AppError(404, 'Email setting not found'));
    await emailSender.sendMail(config, {
      to,
      subject: 'Test email from Synchronics',
      text: 'This is a test email. If you received this, your email configuration is working.',
      html: '<p>This is a test email. If you received this, your email configuration is working.</p>',
    });
    logAuditFromRequest(req, { eventType: 'update', entityType: 'email_setting', entityId: String(id), details: 'send test' });
    res.json({ success: true, message: 'Test email sent' });
  } catch (e) {
    next(e);
  }
}
