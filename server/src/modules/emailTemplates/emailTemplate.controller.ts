/**
 * Email Template controller – HTTP handlers for CRUD and AI endpoints.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAuditFromRequest } from '../../services/auditService';
import * as svc from './emailTemplate.service';

/* ─── CRUD ─── */

export async function listTemplates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const q = req.query as Record<string, string | undefined>;
    const result = await svc.list({
      category: q.category || undefined,
      isActive: q.isActive === 'true' ? true : q.isActive === 'false' ? false : undefined,
      search: q.search || undefined,
      page: q.page ? +q.page : 1,
      pageSize: q.pageSize ? +q.pageSize : 50,
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function getTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = +req.params.id;
    if (!id) return next(new AppError(400, 'Invalid ID'));
    const row = await svc.getById(id);
    if (!row) return next(new AppError(404, 'Template not found'));
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
}

export async function createTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new AppError(401, 'Unauthorized'));
    const body = req.body as Record<string, unknown>;
    const name = String(body.name ?? '').trim();
    const subject = String(body.subject ?? '').trim();
    const bodyHtml = String(body.bodyHtml ?? '').trim();
    if (!name || !subject || !bodyHtml) return next(new AppError(400, 'Name, subject, and body are required'));

    const id = await svc.create({
      name, subject, bodyHtml,
      bodyText: body.bodyText != null ? String(body.bodyText) : null,
      category: body.category != null ? String(body.category).trim() || null : null,
      description: body.description != null ? String(body.description).trim() || null : null,
      variables: body.variables != null ? (typeof body.variables === 'string' ? body.variables : JSON.stringify(body.variables)) : null,
      isActive: body.isActive !== false,
      isDefault: body.isDefault === true,
    }, userId);

    logAuditFromRequest(req, { eventType: 'create', entityType: 'email_template', entityId: String(id), details: `Created template "${name}"` });
    const row = await svc.getById(id);
    res.status(201).json({ success: true, id, data: row });
  } catch (e) { next(e); }
}

export async function updateTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new AppError(401, 'Unauthorized'));
    const id = +req.params.id;
    if (!id) return next(new AppError(400, 'Invalid ID'));

    const body = req.body as Record<string, unknown>;
    const data: Parameters<typeof svc.update>[1] = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.subject !== undefined) data.subject = String(body.subject).trim();
    if (body.bodyHtml !== undefined) data.bodyHtml = String(body.bodyHtml);
    if (body.bodyText !== undefined) data.bodyText = body.bodyText != null ? String(body.bodyText) : null;
    if (body.category !== undefined) data.category = body.category != null ? String(body.category).trim() || null : null;
    if (body.description !== undefined) data.description = body.description != null ? String(body.description).trim() || null : null;
    if (body.variables !== undefined) data.variables = body.variables != null ? (typeof body.variables === 'string' ? body.variables : JSON.stringify(body.variables)) : null;
    if (body.isActive !== undefined) data.isActive = !!body.isActive;
    if (body.isDefault !== undefined) data.isDefault = !!body.isDefault;

    const ok = await svc.update(id, data, userId);
    if (!ok) return next(new AppError(404, 'Template not found'));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'email_template', entityId: String(id), details: `Updated template` });
    const row = await svc.getById(id);
    res.json({ success: true, data: row });
  } catch (e) { next(e); }
}

export async function deleteTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = +req.params.id;
    if (!id) return next(new AppError(400, 'Invalid ID'));
    const ok = await svc.remove(id);
    if (!ok) return next(new AppError(404, 'Template not found'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'email_template', entityId: String(id), details: 'Deleted template' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function duplicateTemplate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new AppError(401, 'Unauthorized'));
    const id = +req.params.id;
    if (!id) return next(new AppError(400, 'Invalid ID'));
    const newId = await svc.duplicate(id, userId);
    if (!newId) return next(new AppError(404, 'Template not found'));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'email_template', entityId: String(newId), details: `Duplicated from #${id}` });
    const row = await svc.getById(newId);
    res.status(201).json({ success: true, id: newId, data: row });
  } catch (e) { next(e); }
}

export async function listCategories(_req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const categories = await svc.listCategories();
    res.json({ success: true, data: categories });
  } catch (e) { next(e); }
}

/* ─── AI ─── */

export async function aiGenerate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new AppError(401, 'Unauthorized'));
    const { prompt, serviceCode } = req.body as { prompt?: string; serviceCode?: string };
    if (!prompt?.trim()) return next(new AppError(400, 'Prompt is required'));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'ai_usage', entityId: String(userId), details: `AI generate email template` });
    const result = await svc.aiGenerate(prompt.trim(), { serviceCode, userId });
    res.json({ success: true, data: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI generation failed';
    next(new AppError(400, msg));
  }
}

export async function aiImprove(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new AppError(401, 'Unauthorized'));
    const { bodyHtml, instructions, serviceCode } = req.body as { bodyHtml?: string; instructions?: string; serviceCode?: string };
    if (!bodyHtml?.trim()) return next(new AppError(400, 'bodyHtml is required'));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'ai_usage', entityId: String(userId), details: `AI improve email template` });
    const result = await svc.aiImprove(bodyHtml, instructions ?? '', { serviceCode, userId });
    res.json({ success: true, data: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI improvement failed';
    next(new AppError(400, msg));
  }
}

export async function aiSuggestSubjects(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user?.userId;
    if (!userId) return next(new AppError(401, 'Unauthorized'));
    const { purpose, serviceCode } = req.body as { purpose?: string; serviceCode?: string };
    if (!purpose?.trim()) return next(new AppError(400, 'Purpose is required'));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'ai_usage', entityId: String(userId), details: `AI suggest subjects` });
    const result = await svc.aiSuggestSubjects(purpose.trim(), { serviceCode, userId });
    res.json({ success: true, data: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'AI subject suggestion failed';
    next(new AppError(400, msg));
  }
}
