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
import { hrmsRoutes } from '../modules/hrms';
import { healthRoutes } from '../modules/health';
import { jobCardRoutes } from '../modules/jobcards';
import { workLogRoutes } from '../modules/worklogs';
import { accountsRoutes } from '../modules/accounts';
import { communicationRoutes } from '../modules/communication';
import { callMatrixRoutes } from '../modules/callMatrix';
import { cronJobsRoutes } from '../modules/cronJobs';

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
router.use('/hrms', hrmsRoutes);
router.use('/health', healthRoutes);
router.use('/jobcards', jobCardRoutes);
router.use('/worklogs', workLogRoutes);
router.use('/accounts', accountsRoutes);
router.use('/communication', communicationRoutes);
router.use('/call-matrix', callMatrixRoutes);
router.use('/cron-jobs', cronJobsRoutes);

export default router;
