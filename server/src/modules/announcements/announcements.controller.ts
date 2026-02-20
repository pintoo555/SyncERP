/**
 * Announcements module controller: HTTP handlers for all announcement endpoints.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAuditFromRequest, getClientIp } from '../../services/auditService';
import { getPermissionsForUser } from '../rbac';

import * as announcementService from './announcements.service';
import * as audienceService from './announcementAudience.service';
import * as trackingService from './announcementTracking.service';
import * as approvalService from './announcementApproval.service';
import * as analyticsService from './announcementAnalytics.service';
import * as pollService from './announcementPoll.service';
import * as versionService from './announcementVersion.service';
import * as feedService from './announcementFeed.service';
import { STATUS } from './announcements.types';

import path from 'path';
import fs from 'fs';

function uid(req: AuthRequest): number { return req.user?.userId ?? 0; }

function detectDevice(ua: string | undefined): string {
  if (!ua) return 'Unknown';
  const lower = ua.toLowerCase();
  if (/mobile|android|iphone|ipad/.test(lower)) return lower.includes('tablet') || lower.includes('ipad') ? 'Tablet' : 'Mobile';
  return 'Desktop';
}

/* ═══════════════════════ Admin CRUD ═══════════════════════ */

export async function listAnnouncements(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await announcementService.list({
      search: req.query.search as string | undefined,
      status: req.query.status !== undefined ? Number(req.query.status) : undefined,
      categoryId: req.query.categoryId ? Number(req.query.categoryId) : undefined,
      priority: req.query.priority !== undefined ? Number(req.query.priority) : undefined,
      page: Math.max(1, Number(req.query.page) || 1),
      pageSize: Math.min(100, Math.max(1, Number(req.query.pageSize) || 25)),
      sortBy: req.query.sortBy as string | undefined,
      sortDir: (req.query.sortDir as string)?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC',
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function getAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const ann = await announcementService.getById(id);
    if (!ann) return next(new AppError(404, 'Announcement not found'));
    const audience = await audienceService.getAudience(id);
    const attachments = await getAttachmentsList(id);
    const polls = await pollService.getPolls(id);
    const approvalHistory = await approvalService.getHistory(id);
    res.json({ success: true, data: { ...ann, audience, attachments, polls, approvalHistory } });
  } catch (e) { next(e); }
}

export async function createAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const body = req.body;
    if (!body.title?.trim()) return next(new AppError(400, 'Title is required'));
    if (!body.content?.trim()) return next(new AppError(400, 'Content is required'));
    if (!body.categoryId) return next(new AppError(400, 'Category is required'));

    if (body.isEmergency) {
      const userPerms = await getPermissionsForUser(uid(req));
      if (!userPerms.includes('ANNOUNCEMENT.EMERGENCY')) {
        return next(new AppError(403, 'Emergency permission required'));
      }
    }

    const id = await announcementService.create(body, uid(req));

    if (body.audience?.length) {
      await audienceService.saveAudience(id, body.audience);
    }
    if (body.polls?.length) {
      for (const p of body.polls) {
        await pollService.createPoll(id, p);
      }
    }

    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Announcements_Master', entityId: String(id) });
    const ann = await announcementService.getById(id);
    res.status(201).json({ success: true, id, data: ann });
  } catch (e) { next(e); }
}

export async function updateAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const existing = await announcementService.getById(id);
    if (!existing) return next(new AppError(404, 'Announcement not found'));

    await announcementService.update(id, req.body, uid(req));

    if (req.body.audience) {
      await audienceService.saveAudience(id, req.body.audience);
    }

    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Announcements_Master', entityId: String(id) });
    const updated = await announcementService.getById(id);
    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
}

export async function deleteAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    await announcementService.updateStatus(id, STATUS.ARCHIVED, uid(req));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'utbl_Announcements_Master', entityId: String(id) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

/* ═══════════════════════ Workflow ═══════════════════════ */

export async function submitForApproval(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const ann = await announcementService.getById(id);
    if (!ann) return next(new AppError(404, 'Announcement not found'));
    if (ann.status !== STATUS.DRAFT && ann.status !== STATUS.REJECTED) {
      return next(new AppError(400, 'Only drafts or rejected announcements can be submitted'));
    }
    await announcementService.updateStatus(id, STATUS.PENDING_APPROVAL, uid(req));
    await approvalService.recordAction(id, 'SUBMITTED', uid(req), req.body.comments);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Announcements_Master', entityId: String(id), details: 'Submitted for approval' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function approveAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const ann = await announcementService.getById(id);
    if (!ann) return next(new AppError(404, 'Announcement not found'));
    if (ann.status !== STATUS.PENDING_APPROVAL) return next(new AppError(400, 'Not pending approval'));
    await announcementService.updateStatus(id, STATUS.APPROVED, uid(req));
    await approvalService.recordAction(id, 'APPROVED', uid(req), req.body.comments);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Announcements_Master', entityId: String(id), details: 'Approved' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function rejectAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const ann = await announcementService.getById(id);
    if (!ann) return next(new AppError(404, 'Announcement not found'));
    if (ann.status !== STATUS.PENDING_APPROVAL) return next(new AppError(400, 'Not pending approval'));
    await announcementService.updateStatus(id, STATUS.REJECTED, uid(req), { reason: req.body.reason });
    await approvalService.recordAction(id, 'REJECTED', uid(req), req.body.reason);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Announcements_Master', entityId: String(id), details: `Rejected: ${req.body.reason || ''}` });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function publishAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    const ann = await announcementService.getById(id);
    if (!ann) return next(new AppError(404, 'Announcement not found'));
    if (ann.status !== STATUS.APPROVED && ann.status !== STATUS.DRAFT && ann.status !== STATUS.PUBLISHED) {
      return next(new AppError(400, 'Only approved, draft, or published announcements can be (re)published'));
    }

    if (!ann.isCompanyWide) {
      const audience = await audienceService.getAudience(id);
      if (!audience.length) {
        return next(new AppError(400, 'Cannot publish: select a target audience or enable Company-Wide'));
      }
    }

    await announcementService.updateStatus(id, STATUS.PUBLISHED, uid(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Announcements_Master', entityId: String(id), details: 'Published' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function archiveAnnouncement(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = Number(req.params.id);
    await announcementService.updateStatus(id, STATUS.ARCHIVED, uid(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Announcements_Master', entityId: String(id), details: 'Archived' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

/* ═══════════════════════ Versions ═══════════════════════ */

export async function getVersions(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const versions = await versionService.getVersions(Number(req.params.id));
    res.json({ success: true, data: versions });
  } catch (e) { next(e); }
}

/* ═══════════════════════ Attachments ═══════════════════════ */

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'announcements');

async function getAttachmentsList(announcementId: number) {
  const { getRequest } = await import('../../config/db');
  const { config: appConfig } = await import('../../config/env');
  const schema = appConfig.db.schema || 'dbo';
  const req = await getRequest();
  req.input('annId', announcementId);
  const result = await req.query(`
    SELECT Id AS id, AnnouncementId AS announcementId, FileName AS fileName,
           FilePath AS filePath, FileSize AS fileSize, MimeType AS mimeType,
           UploadedAt AS uploadedAt, UploadedBy AS uploadedBy
    FROM [${schema}].[utbl_Announcements_Attachment]
    WHERE AnnouncementId = @annId
  `);
  return result.recordset;
}

export async function uploadAttachment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const announcementId = Number(req.params.id);
    const file = (req as any).file;
    if (!file) return next(new AppError(400, 'No file uploaded'));

    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const fileName = `${announcementId}_${Date.now()}_${file.originalname}`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    fs.writeFileSync(filePath, file.buffer);

    const { getRequest } = await import('../../config/db');
    const { config: appConfig } = await import('../../config/env');
    const schema = appConfig.db.schema || 'dbo';
    const dbReq = await getRequest();
    dbReq.input('annId', announcementId);
    dbReq.input('fileName', file.originalname);
    dbReq.input('filePath', `/uploads/announcements/${fileName}`);
    dbReq.input('fileSize', file.size || 0);
    dbReq.input('mimeType', file.mimetype || null);
    dbReq.input('uploadedBy', uid(req));
    const result = await dbReq.query(`
      INSERT INTO [${schema}].[utbl_Announcements_Attachment]
        (AnnouncementId, FileName, FilePath, FileSize, MimeType, UploadedBy)
      OUTPUT INSERTED.Id
      VALUES (@annId, @fileName, @filePath, @fileSize, @mimeType, @uploadedBy)
    `);
    logAuditFromRequest(req, { eventType: 'upload', entityType: 'utbl_Announcements_Attachment', entityId: String(result.recordset[0].Id) });
    res.status(201).json({ success: true, id: result.recordset[0].Id });
  } catch (e) { next(e); }
}

export async function deleteAttachment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const attachId = Number(req.params.attachId);
    const { getRequest } = await import('../../config/db');
    const { config: appConfig } = await import('../../config/env');
    const schema = appConfig.db.schema || 'dbo';
    const dbReq = await getRequest();
    dbReq.input('id', attachId);
    await dbReq.query(`DELETE FROM [${schema}].[utbl_Announcements_Attachment] WHERE Id = @id`);
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'utbl_Announcements_Attachment', entityId: String(attachId) });
    res.json({ success: true });
  } catch (e) { next(e); }
}

/* ═══════════════════════ Polls ═══════════════════════ */

export async function addPoll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const announcementId = Number(req.params.id);
    if (!req.body.question || !req.body.options?.length) return next(new AppError(400, 'Question and options required'));
    const pollId = await pollService.createPoll(announcementId, req.body);
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Announcements_Poll', entityId: String(pollId) });
    res.status(201).json({ success: true, id: pollId });
  } catch (e) { next(e); }
}

export async function updatePoll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await pollService.updatePoll(Number(req.params.pollId), req.body);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function deletePoll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await pollService.deletePoll(Number(req.params.pollId));
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function respondToPoll(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const pollId = Number(req.params.pollId);
    const selected = Array.isArray(req.body.selectedOptions) ? req.body.selectedOptions : [req.body.selectedOption];
    if (!selected.length || !selected[0]) return next(new AppError(400, 'Selection required'));
    await pollService.submitResponse(pollId, uid(req), selected);
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function getPollResults(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const results = await pollService.getPollResults(Number(req.params.pollId));
    res.json({ success: true, data: results });
  } catch (e) { next(e); }
}

/* ═══════════════════════ User Feed ═══════════════════════ */

export async function getFeed(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const result = await feedService.getUserFeed(uid(req), {
      tab: req.query.tab as any,
      page: Number(req.query.page) || 1,
      pageSize: Number(req.query.pageSize) || 20,
    });
    res.json({ success: true, ...result });
  } catch (e) { next(e); }
}

export async function getUnreadCount(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const count = await trackingService.getUnreadCount(uid(req));
    res.json({ success: true, data: { unreadCount: count } });
  } catch (e) { next(e); }
}

export async function viewFeedItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const announcementId = Number(req.params.id);
    const userId = uid(req);

    await trackingService.trackRead({
      announcementId,
      userId,
      deviceType: detectDevice(req.headers['user-agent']),
      ipAddress: getClientIp(req),
    });

    const ann = await announcementService.getById(announcementId);
    if (!ann) return next(new AppError(404, 'Announcement not found'));

    const attachments = await getAttachmentsList(announcementId);
    const polls = ann.hasPoll ? await pollService.getPolls(announcementId) : [];
    const myResponses = ann.hasPoll ? await pollService.getUserResponses(announcementId, userId) : [];
    const feedback = ann.hasFeedback ? await feedService.getFeedbackForAnnouncement(announcementId) : [];
    const readStatus = await trackingService.getUserReadStatus(announcementId, userId);

    res.json({
      success: true,
      data: {
        ...ann,
        isRead: readStatus.isRead,
        isAcknowledged: readStatus.isAcknowledged,
        attachments,
        polls,
        myPollResponses: myResponses,
        feedback,
      },
    });
  } catch (e) { next(e); }
}

export async function acknowledgeFeedItem(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const announcementId = Number(req.params.id);
    await trackingService.acknowledge(announcementId, uid(req));
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Announcements_ReadLog', entityId: `${announcementId}:${uid(req)}`, details: 'Acknowledged' });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function submitFeedback(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const announcementId = Number(req.params.id);
    if (!req.body.comment?.trim()) return next(new AppError(400, 'Comment required'));
    const id = await feedService.addFeedback(announcementId, uid(req), req.body.comment);
    res.status(201).json({ success: true, id });
  } catch (e) { next(e); }
}

export async function getEmergency(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const items = await feedService.getEmergencyAnnouncements(uid(req));
    res.json({ success: true, data: items });
  } catch (e) { next(e); }
}

/* ═══════════════════════ Analytics ═══════════════════════ */

export async function getAnalytics(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getAnnouncementAnalytics(Number(req.params.id));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getAnalyticsByBranch(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.analyticsByBranch(Number(req.params.id));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getAnalyticsByDepartment(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.analyticsByDepartment(Number(req.params.id));
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function getAnalyticsUsers(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getUserAnalytics(
      Number(req.params.id),
      Number(req.query.page) || 1,
      Number(req.query.pageSize) || 50,
    );
    res.json({ success: true, ...data });
  } catch (e) { next(e); }
}

export async function getAnalyticsOverview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await analyticsService.getOverview();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function exportAnalytics(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const announcementId = Number(req.params.id);
    const analytics = await analyticsService.getAnnouncementAnalytics(announcementId);
    const users = await analyticsService.getUserAnalytics(announcementId, 1, 10000);
    const ann = await announcementService.getById(announcementId);

    const rows = users.data.map((u: any) => ({
      Name: u.userName || '',
      Email: u.userEmail || '',
      Branch: u.branchName || '',
      Department: u.departmentName || '',
      'First Opened': u.firstOpenedAt || 'Not viewed',
      'Open Count': u.openCount || 0,
      Acknowledged: u.acknowledgedAt || 'No',
      'Time Spent (s)': u.timeSpentSeconds || 0,
      Device: u.deviceType || '',
    }));

    res.setHeader('Content-Type', 'application/json');
    logAuditFromRequest(req, { eventType: 'export', entityType: 'utbl_Announcements_Master', entityId: String(announcementId) });
    res.json({
      success: true,
      data: {
        announcement: ann?.title,
        summary: analytics,
        users: rows,
      },
    });
  } catch (e) { next(e); }
}

/* ═══════════════════════ Categories ═══════════════════════ */

export async function listCategories(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = await announcementService.listCategories();
    res.json({ success: true, data });
  } catch (e) { next(e); }
}

export async function createCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.body.name?.trim()) return next(new AppError(400, 'Name is required'));
    const id = await announcementService.createCategory(req.body, uid(req));
    logAuditFromRequest(req, { eventType: 'create', entityType: 'utbl_Announcements_Category', entityId: String(id) });
    res.status(201).json({ success: true, id });
  } catch (e) { next(e); }
}

export async function updateCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await announcementService.updateCategory(Number(req.params.id), req.body);
    logAuditFromRequest(req, { eventType: 'update', entityType: 'utbl_Announcements_Category', entityId: req.params.id });
    res.json({ success: true });
  } catch (e) { next(e); }
}

export async function deleteCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const ok = await announcementService.deleteCategory(Number(req.params.id));
    if (!ok) return next(new AppError(400, 'Cannot delete category in use'));
    logAuditFromRequest(req, { eventType: 'delete', entityType: 'utbl_Announcements_Category', entityId: req.params.id });
    res.json({ success: true });
  } catch (e) { next(e); }
}
