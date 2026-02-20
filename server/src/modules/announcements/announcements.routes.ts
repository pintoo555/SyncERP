/**
 * Announcement module route definitions.
 */

import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as ctrl from './announcements.controller';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const router = Router();
router.use(requireAuth);

/* ─── Categories (must be above /:id routes) ─── */
router.get('/categories', requirePermission('ANNOUNCEMENT.CREATE', 'ANNOUNCEMENT.MANAGE_CATEGORIES'), ctrl.listCategories);
router.post('/categories', requirePermission('ANNOUNCEMENT.MANAGE_CATEGORIES'), ctrl.createCategory);
router.put('/categories/:id', requirePermission('ANNOUNCEMENT.MANAGE_CATEGORIES'), ctrl.updateCategory);
router.delete('/categories/:id', requirePermission('ANNOUNCEMENT.MANAGE_CATEGORIES'), ctrl.deleteCategory);

/* ─── Analytics overview (must be above /:id routes) ─── */
router.get('/analytics/overview', requirePermission('ANNOUNCEMENT.ANALYTICS'), ctrl.getAnalyticsOverview);

/* ─── User feed routes (must be above /:id to avoid conflicts) ─── */
router.get('/feed/unread-count', requirePermission('ANNOUNCEMENT.VIEW'), ctrl.getUnreadCount);
router.get('/feed/emergency', requirePermission('ANNOUNCEMENT.VIEW'), ctrl.getEmergency);
router.get('/feed', requirePermission('ANNOUNCEMENT.VIEW'), ctrl.getFeed);
router.get('/feed/:id', requirePermission('ANNOUNCEMENT.VIEW'), ctrl.viewFeedItem);
router.post('/feed/:id/acknowledge', requirePermission('ANNOUNCEMENT.VIEW'), ctrl.acknowledgeFeedItem);
router.post('/feed/:id/feedback', requirePermission('ANNOUNCEMENT.VIEW'), ctrl.submitFeedback);

/* ─── Poll endpoints ─── */
router.post('/polls/:pollId/respond', requirePermission('ANNOUNCEMENT.VIEW'), ctrl.respondToPoll);
router.get('/polls/:pollId/results', requirePermission('ANNOUNCEMENT.ANALYTICS'), ctrl.getPollResults);
router.put('/polls/:pollId', requirePermission('ANNOUNCEMENT.CREATE'), ctrl.updatePoll);
router.delete('/polls/:pollId', requirePermission('ANNOUNCEMENT.CREATE'), ctrl.deletePoll);

/* ─── Attachment delete (must be above /:id) ─── */
router.delete('/attachments/:attachId', requirePermission('ANNOUNCEMENT.CREATE'), ctrl.deleteAttachment);

/* ─── Admin CRUD ─── */
router.get('/', requirePermission('ANNOUNCEMENT.CREATE'), ctrl.listAnnouncements);
router.post('/', requirePermission('ANNOUNCEMENT.CREATE'), ctrl.createAnnouncement);
router.get('/:id', requirePermission('ANNOUNCEMENT.CREATE'), ctrl.getAnnouncement);
router.put('/:id', requirePermission('ANNOUNCEMENT.CREATE'), ctrl.updateAnnouncement);
router.delete('/:id', requirePermission('ANNOUNCEMENT.CREATE'), ctrl.deleteAnnouncement);

/* ─── Workflow actions ─── */
router.post('/:id/submit', requirePermission('ANNOUNCEMENT.CREATE'), ctrl.submitForApproval);
router.post('/:id/approve', requirePermission('ANNOUNCEMENT.APPROVE'), ctrl.approveAnnouncement);
router.post('/:id/reject', requirePermission('ANNOUNCEMENT.APPROVE'), ctrl.rejectAnnouncement);
router.post('/:id/publish', requirePermission('ANNOUNCEMENT.PUBLISH'), ctrl.publishAnnouncement);
router.post('/:id/archive', requirePermission('ANNOUNCEMENT.CREATE'), ctrl.archiveAnnouncement);

/* ─── Version history ─── */
router.get('/:id/versions', requirePermission('ANNOUNCEMENT.CREATE'), ctrl.getVersions);

/* ─── Attachments ─── */
router.post('/:id/attachments', requirePermission('ANNOUNCEMENT.CREATE'), upload.single('file'), ctrl.uploadAttachment);

/* ─── Polls on announcement ─── */
router.post('/:id/polls', requirePermission('ANNOUNCEMENT.CREATE'), ctrl.addPoll);

/* ─── Per-announcement analytics ─── */
router.get('/:id/analytics', requirePermission('ANNOUNCEMENT.ANALYTICS'), ctrl.getAnalytics);
router.get('/:id/analytics/by-branch', requirePermission('ANNOUNCEMENT.ANALYTICS'), ctrl.getAnalyticsByBranch);
router.get('/:id/analytics/by-department', requirePermission('ANNOUNCEMENT.ANALYTICS'), ctrl.getAnalyticsByDepartment);
router.get('/:id/analytics/users', requirePermission('ANNOUNCEMENT.ANALYTICS'), ctrl.getAnalyticsUsers);
router.get('/:id/analytics/export', requirePermission('ANNOUNCEMENT.ANALYTICS'), ctrl.exportAnalytics);

export { router as announcementRoutes };
