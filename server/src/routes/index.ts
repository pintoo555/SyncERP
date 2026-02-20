/**
 * Central route loader – registers all module routes.
 * Single source of truth for API route mounting.
 */

import { Router } from 'express';

import { authRoutes } from '../modules/auth';
import { rbacRoutes } from '../modules/rbac';
import { userRoutes } from '../modules/users';
import {
  assetRoutes,
  assignmentRoutes,
  searchRoutes,
  ticketRoutes,
  verificationRoutes,
  fileRoutes,
  mastersRoutes,
  myAssetsRoutes,
  reportRoutes,
} from '../modules/assets';
import { auditRoutes } from '../modules/auditLog';
import { dashboardRoutes } from '../modules/dashboards';
import { chatRoutes } from '../modules/chat';
import { calendarRoutes } from '../modules/calendar';
import { settingsRoutes, apiConfigRoutes } from '../modules/settings';
import { aiAnalyticsRoutes } from '../modules/aiAnalytics';
import { aiRoutes } from '../modules/ai';
import { emailSettingsRoutes, mailboxRoutes } from '../modules/emails';
import { emailAdminRoutes } from '../modules/emailAdmin';
import { hrmsRoutes } from '../modules/hrms';
import { healthRoutes } from '../modules/health';
import { jobCardRoutes } from '../modules/jobcards';
import { workLogRoutes } from '../modules/worklogs';
import { accountsRoutes } from '../modules/accounts';
import { communicationRoutes } from '../modules/communication';
import { callMatrixRoutes } from '../modules/callMatrix';
import { cronJobsRoutes } from '../modules/cronJobs';
import { organizationRoutes } from '../modules/organization';
import { clientRoutes, industryRoutes } from '../modules/clients';
import { announcementRoutes } from '../modules/announcements';
import { emailTemplateRoutes } from '../modules/emailTemplates';
import { leadRoutes } from '../modules/leads';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/rbac', rbacRoutes);
router.use('/masters', mastersRoutes);
router.use('/assets', assetRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/search', searchRoutes);
router.use('/tickets', ticketRoutes);
router.use('/verification', verificationRoutes);
router.use('/files', fileRoutes);
router.use('/audit', auditRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/my', myAssetsRoutes);
router.use('/reports', reportRoutes);
router.use('/chat', chatRoutes);
router.use('/calendar', calendarRoutes);
router.use('/ai-config', apiConfigRoutes);
router.use('/ai-analytics', aiAnalyticsRoutes);
router.use('/ai', aiRoutes);
router.use('/settings', settingsRoutes);
router.use('/email-settings', emailSettingsRoutes);
router.use('/mailbox', mailboxRoutes);
router.use('/email-admin', emailAdminRoutes);
router.use('/hrms', hrmsRoutes);
router.use('/health', healthRoutes);
router.use('/jobcards', jobCardRoutes);
router.use('/worklogs', workLogRoutes);
router.use('/accounts', accountsRoutes);
router.use('/communication', communicationRoutes);
router.use('/call-matrix', callMatrixRoutes);
router.use('/cron-jobs', cronJobsRoutes);
router.use('/organization', organizationRoutes);
router.use('/clients', clientRoutes);
router.use('/industries', industryRoutes);
router.use('/announcements', announcementRoutes);
router.use('/email-templates', emailTemplateRoutes);
router.use('/leads', leadRoutes);

export default router;
