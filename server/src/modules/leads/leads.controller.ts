import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAuditFromRequest } from '../../services/auditService';

import * as leadService from './leads.service';
import * as stageService from './leadStage.service';
import * as sourceService from './leadSource.service';
import * as activityService from './leadActivity.service';
import * as reminderService from './leadReminder.service';
import * as webhookService from './leadWebhook.service';
import * as aiService from './leadAi.service';
import * as importService from './leadImport.service';
import * as metaWebhookService from './leadMetaWebhook.service';

function userId(req: AuthRequest): number {
  return req.user?.userId ?? 0;
}

/* ═══════════════════════ Lead CRUD ═══════════════════════ */

export async function listLeads(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const q = req.query;
    const result = await leadService.listLeads({
      search:           q.search as string | undefined,
      stageId:          q.stageId ? Number(q.stageId) : undefined,
      sourceId:         q.sourceId ? Number(q.sourceId) : undefined,
      assignedToUserId: q.assignedToUserId ? Number(q.assignedToUserId) : undefined,
      aiScoreLabel:     q.aiScoreLabel as string | undefined,
      clientType:       q.clientType as string | undefined,
      isActive:         q.isActive !== undefined ? q.isActive === 'true' || q.isActive === '1' : undefined,
      hasConversion:    q.hasConversion !== undefined ? q.hasConversion === 'true' || q.hasConversion === '1' : undefined,
      dateFrom:         q.dateFrom as string | undefined,
      dateTo:           q.dateTo as string | undefined,
      page:             Math.max(1, Number(q.page) || 1),
      pageSize:         Math.min(200, Math.max(1, Number(q.pageSize) || 25)),
      sortBy:           q.sortBy as string | undefined,
      sortDir:          (q.sortDir as string)?.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function getLead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const lead = await leadService.getLeadById(id);
    if (!lead) return next(new AppError(404, 'Lead not found'));

    res.json({ success: true, data: lead });
  } catch (e) { next(e); }
}

export async function createLead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = await leadService.createLead(req.body, userId(req));

    logAuditFromRequest(req, {
      eventType:  'create',
      entityType: 'utbl_Leads_Master',
      entityId:   String(id),
    });

    const lead = await leadService.getLeadById(id);
    res.status(201).json({ success: true, id, data: lead });
  } catch (e) { next(e); }
}

export async function updateLead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    await leadService.updateLead(id, req.body, userId(req));

    logAuditFromRequest(req, {
      eventType:  'update',
      entityType: 'utbl_Leads_Master',
      entityId:   String(id),
    });

    const lead = await leadService.getLeadById(id);
    res.json({ success: true, data: lead });
  } catch (e) { next(e); }
}

export async function deleteLead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    await leadService.deleteLead(id);

    logAuditFromRequest(req, {
      eventType:  'delete',
      entityType: 'utbl_Leads_Master',
      entityId:   String(id),
    });

    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function changeStage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const { stageId } = req.body;
    if (!stageId) return next(new AppError(400, 'stageId is required'));

    const { fromStageId, toStageId } = await leadService.changeStage(id, Number(stageId), userId(req));

    await activityService.createActivity(id, {
      activityType: 'STAGE_CHANGE',
      subject:      'Stage changed',
      fromStageId,
      toStageId,
    }, userId(req));

    logAuditFromRequest(req, {
      eventType:  'update',
      entityType: 'utbl_Leads_Master',
      entityId:   String(id),
      details:    `Stage changed from ${fromStageId} to ${toStageId}`,
    });

    const lead = await leadService.getLeadById(id);
    res.json({ success: true, data: lead });
  } catch (e) { next(e); }
}

export async function assignLead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const assignedToUserId = req.body.assignedToUserId != null ? Number(req.body.assignedToUserId) : null;
    await leadService.assignLead(id, assignedToUserId, userId(req));

    logAuditFromRequest(req, {
      eventType:  'update',
      entityType: 'utbl_Leads_Master',
      entityId:   String(id),
      details:    `Assigned to user ${assignedToUserId ?? 'unassigned'}`,
    });

    const lead = await leadService.getLeadById(id);
    res.json({ success: true, data: lead });
  } catch (e) { next(e); }
}

export async function convertToClient(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const clientId = await leadService.convertToClient(id, userId(req));

    await activityService.createActivity(id, {
      activityType: 'SYSTEM',
      subject:      `Converted to client #${clientId}`,
    }, userId(req));

    logAuditFromRequest(req, {
      eventType:  'create',
      entityType: 'utbl_Client',
      entityId:   String(clientId),
      details:    `Converted from lead ${id}`,
    });

    res.status(201).json({ success: true, clientId, leadId: id });
  } catch (e) { next(e); }
}

export async function getLeadsByStage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await leadService.getLeadsByStage();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function checkDuplicates(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { email, phone, gstNumber } = req.query as Record<string, string | undefined>;
    const data = await leadService.checkDuplicates(email, phone, gstNumber);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

/* ═══════════════════════ Stages ═══════════════════════ */

export async function listStages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const includeInactive = req.query.includeInactive === 'true' || req.query.includeInactive === '1';
    const data = await stageService.getAllStages(includeInactive);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createStage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = await stageService.createStage(req.body, userId(req));

    logAuditFromRequest(req, {
      eventType:  'create',
      entityType: 'utbl_Leads_Stage',
      entityId:   String(id),
    });

    res.status(201).json({ success: true, id });
  } catch (e) { next(e); }
}

export async function updateStage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    await stageService.updateStage(id, req.body, userId(req));

    logAuditFromRequest(req, {
      eventType:  'update',
      entityType: 'utbl_Leads_Stage',
      entityId:   String(id),
    });

    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function toggleStageStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const { isActive } = req.body;
    await stageService.toggleStageStatus(id, !!isActive, userId(req));

    logAuditFromRequest(req, {
      eventType:  'update',
      entityType: 'utbl_Leads_Stage',
      entityId:   String(id),
      details:    `Stage ${isActive ? 'activated' : 'deactivated'}`,
    });

    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function reorderStages(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { orderedIds } = req.body;
    if (!Array.isArray(orderedIds)) return next(new AppError(400, 'orderedIds must be an array'));

    await stageService.reorderStages(orderedIds);
    res.json({ success: true });
  } catch (e) { next(e); }
}

/* ═══════════════════════ Sources ═══════════════════════ */

export async function listSources(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const includeInactive = req.query.includeInactive === 'true' || req.query.includeInactive === '1';
    const data = await sourceService.getAllSources(includeInactive);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createSource(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = await sourceService.createSource(req.body, userId(req));

    logAuditFromRequest(req, {
      eventType:  'create',
      entityType: 'utbl_Leads_Source',
      entityId:   String(id),
    });

    res.status(201).json({ success: true, id });
  } catch (e) { next(e); }
}

export async function updateSource(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    await sourceService.updateSource(id, req.body, userId(req));

    logAuditFromRequest(req, {
      eventType:  'update',
      entityType: 'utbl_Leads_Source',
      entityId:   String(id),
    });

    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function toggleSourceStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));

    const { isActive } = req.body;
    await sourceService.toggleSourceStatus(id, !!isActive, userId(req));

    logAuditFromRequest(req, {
      eventType:  'update',
      entityType: 'utbl_Leads_Source',
      entityId:   String(id),
      details:    `Source ${isActive ? 'activated' : 'deactivated'}`,
    });

    res.json({ success: true });
  } catch (e) { next(e); }
}

/* ═══════════════════════ Activities ═══════════════════════ */

export async function getActivities(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const leadId = Number(req.params.id);
    if (!leadId || !Number.isInteger(leadId)) return next(new AppError(400, 'Invalid leadId'));

    const page     = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Math.max(1, Number(req.query.pageSize) || 50));
    const result = await activityService.getActivities(leadId, page, pageSize);
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function createActivity(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const leadId = Number(req.params.id);
    if (!leadId || !Number.isInteger(leadId)) return next(new AppError(400, 'Invalid leadId'));

    const id = await activityService.createActivity(leadId, req.body, userId(req));

    logAuditFromRequest(req, {
      eventType:  'create',
      entityType: 'utbl_Leads_Activity',
      entityId:   String(id),
      details:    `Activity on lead ${leadId}`,
    });

    res.status(201).json({ success: true, id });
  } catch (e) { next(e); }
}

/* ═══════════════════════ Reminders ═══════════════════════ */

export async function getReminders(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const leadId = Number(req.params.id);
    if (!leadId || !Number.isInteger(leadId)) return next(new AppError(400, 'Invalid leadId'));

    const data = await reminderService.getReminders(leadId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createReminder(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const leadId = Number(req.params.id);
    if (!leadId || !Number.isInteger(leadId)) return next(new AppError(400, 'Invalid leadId'));

    const id = await reminderService.createReminder(leadId, req.body, userId(req));

    logAuditFromRequest(req, {
      eventType:  'create',
      entityType: 'utbl_Leads_Reminder',
      entityId:   String(id),
      details:    `Reminder on lead ${leadId}`,
    });

    res.status(201).json({ success: true, id });
  } catch (e) { next(e); }
}

export async function completeReminder(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const reminderId = Number(req.params.reminderId);
    if (!reminderId || !Number.isInteger(reminderId)) return next(new AppError(400, 'Invalid reminderId'));

    await reminderService.completeReminder(reminderId);
    res.json({ success: true });
  } catch (e) { next(e); }
}

// ==================== Webhook Management (authenticated) ====================

export async function listWebhooks(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await webhookService.getAllWebhooks();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createWebhook(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = await webhookService.createWebhook(req.body, userId(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Leads_Webhook', entityId: String(id) });
    const data = await webhookService.getWebhookById(id);
    res.status(201).json({ success: true, id, data });
  } catch (e) { next(e); }
}

export async function updateWebhook(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    await webhookService.updateWebhook(id, req.body, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Leads_Webhook', entityId: String(id) });
    const data = await webhookService.getWebhookById(id);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function regenerateWebhookKey(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const apiKey = await webhookService.regenerateApiKey(id);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Leads_Webhook', entityId: String(id), details: 'API key regenerated' });
    res.json({ success: true, apiKey });
  } catch (e) { next(e); }
}

export async function getWebhookLogs(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    const data = await webhookService.getCaptureLogs(id, limit);
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

// ==================== Bulk Import ====================

export async function bulkImportLeads(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { rows, sourceId, stageId, assignedToUserId } = req.body;
    if (!Array.isArray(rows) || rows.length === 0) return next(new AppError(400, 'rows array is required'));
    if (!sourceId) return next(new AppError(400, 'sourceId is required'));
    if (!stageId) return next(new AppError(400, 'stageId is required'));

    const result = await importService.bulkImport(rows, {
      sourceId,
      stageId,
      assignedToUserId,
      userId: userId(req),
    });

    logAuditFromRequest(req, {
      eventType: 'create',
      entityType: 'Lead',
      entityId: 'bulk-import',
      details: `Imported ${result.successCount} of ${result.totalRows} leads (${result.duplicateCount} duplicates, ${result.errorCount} errors)`,
    });

    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}

// ==================== AI Endpoints ====================

export async function aiScoreLead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const result = await aiService.scoreLead(id, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'Lead', entityId: String(id), details: `AI Score: ${result.score} (${result.label})` });
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}

export async function aiSuggestActions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const result = await aiService.suggestNextActions(id, userId(req));
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}

export async function aiDraftMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const { channel, intent } = req.body;
    if (!channel || !intent) return next(new AppError(400, 'channel and intent are required'));
    if (!['email', 'whatsapp'].includes(channel)) return next(new AppError(400, 'channel must be email or whatsapp'));
    const result = await aiService.draftMessage(id, channel, intent, userId(req));
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}

export async function aiBantAssessment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    if (!id || !Number.isInteger(id)) return next(new AppError(400, 'Invalid id'));
    const result = await aiService.assessBant(id, userId(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'Lead', entityId: String(id), details: `AI BANT Assessment: ${result.overallScore}` });
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
}

// ==================== Meta Webhook (public, no auth) ====================

export async function verifyMetaWebhook(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;
    const result = await metaWebhookService.verifyWebhook(mode, token, challenge);
    if (result === null) return res.status(403).end();
    res.type('text/plain').send(result);
  } catch (e) { next(e); }
}

export async function handleMetaWebhook(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await metaWebhookService.handleMetaWebhook(req.body);
    res.sendStatus(200);
  } catch (e) { next(e); }
}

// ==================== Webhook Capture (public, no auth) ====================

export async function captureWebhookLead(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const apiKey = (req.query.key as string) || req.headers['x-api-key'] as string;
    if (!apiKey) return res.status(401).json({ success: false, error: 'Missing API key' });

    const webhook = await webhookService.getWebhookByApiKey(apiKey);
    if (!webhook) return res.status(401).json({ success: false, error: 'Invalid or inactive API key' });

    const ip = req.ip || req.socket.remoteAddress || null;
    const result = await webhookService.processWebhookCapture(webhook.webhookId, req.body, ip);

    res.status(result.isDuplicate ? 200 : 201).json({
      success: true,
      leadId: result.leadId,
      leadCode: result.leadCode,
      isDuplicate: result.isDuplicate,
    });
  } catch (e) { next(e); }
}
