import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as ctrl from './leads.controller';
import { inboxRoutes } from './leadInbox.routes';

const router = Router();

// Public webhook endpoints (NO auth required)
router.get('/webhook/meta', ctrl.verifyMetaWebhook as any);
router.post('/webhook/meta', ctrl.handleMetaWebhook as any);
router.post('/webhook/capture', ctrl.captureWebhookLead as any);

// All remaining routes require authentication
router.use(requireAuth);

// Team Inbox (channels + conversations)
router.use('/inbox', inboxRoutes);

// Kanban view
router.get('/pipeline', requirePermission('LEADS.VIEW'), ctrl.getLeadsByStage);
router.get('/duplicates', requirePermission('LEADS.VIEW'), ctrl.checkDuplicates);

// Webhooks (authenticated management)
router.get('/webhooks', requirePermission('LEADS.SETTINGS'), ctrl.listWebhooks);
router.post('/webhooks', requirePermission('LEADS.SETTINGS'), ctrl.createWebhook);
router.put('/webhooks/:id', requirePermission('LEADS.SETTINGS'), ctrl.updateWebhook);
router.post('/webhooks/:id/regenerate-key', requirePermission('LEADS.SETTINGS'), ctrl.regenerateWebhookKey);
router.get('/webhooks/:id/logs', requirePermission('LEADS.SETTINGS'), ctrl.getWebhookLogs);

// Stages
router.get('/stages', requirePermission('LEADS.SETTINGS'), ctrl.listStages);
router.post('/stages', requirePermission('LEADS.SETTINGS'), ctrl.createStage);
router.put('/stages/reorder', requirePermission('LEADS.SETTINGS'), ctrl.reorderStages);
router.put('/stages/:id', requirePermission('LEADS.SETTINGS'), ctrl.updateStage);
router.patch('/stages/:id/status', requirePermission('LEADS.SETTINGS'), ctrl.toggleStageStatus);

// Sources
router.get('/sources', requirePermission('LEADS.SETTINGS'), ctrl.listSources);
router.post('/sources', requirePermission('LEADS.SETTINGS'), ctrl.createSource);
router.put('/sources/:id', requirePermission('LEADS.SETTINGS'), ctrl.updateSource);
router.patch('/sources/:id/status', requirePermission('LEADS.SETTINGS'), ctrl.toggleSourceStatus);

// Bulk import
router.post('/import', requirePermission('LEADS.IMPORT'), ctrl.bulkImportLeads);

// Lead CRUD
router.get('/', requirePermission('LEADS.VIEW'), ctrl.listLeads);
router.post('/', requirePermission('LEADS.CREATE'), ctrl.createLead);
router.get('/:id', requirePermission('LEADS.VIEW'), ctrl.getLead);
router.put('/:id', requirePermission('LEADS.EDIT'), ctrl.updateLead);
router.delete('/:id', requirePermission('LEADS.DELETE'), ctrl.deleteLead);

// Lead actions
router.patch('/:id/stage', requirePermission('LEADS.EDIT'), ctrl.changeStage);
router.patch('/:id/assign', requirePermission('LEADS.EDIT'), ctrl.assignLead);
router.post('/:id/convert', requirePermission('LEADS.CONVERT'), ctrl.convertToClient);

// Activities
router.get('/:id/activities', requirePermission('LEADS.VIEW'), ctrl.getActivities);
router.post('/:id/activities', requirePermission('LEADS.EDIT'), ctrl.createActivity);

// Reminders
router.get('/:id/reminders', requirePermission('LEADS.VIEW'), ctrl.getReminders);
router.post('/:id/reminders', requirePermission('LEADS.EDIT'), ctrl.createReminder);
router.patch('/:id/reminders/:reminderId/complete', requirePermission('LEADS.EDIT'), ctrl.completeReminder);

// AI
router.post('/:id/ai/score', requirePermission('LEADS.AI'), ctrl.aiScoreLead);
router.get('/:id/ai/suggestions', requirePermission('LEADS.AI'), ctrl.aiSuggestActions);
router.post('/:id/ai/draft', requirePermission('LEADS.AI'), ctrl.aiDraftMessage);
router.get('/:id/ai/bant', requirePermission('LEADS.AI'), ctrl.aiBantAssessment);

export { router as leadRoutes };
