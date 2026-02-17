import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as cronJobsController from './cronJobs.controller';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('CRON_JOBS.VIEW'), cronJobsController.getList);
router.get('/dashboard', requirePermission('CRON_JOBS.VIEW'), cronJobsController.getDashboard);
router.get('/history', requirePermission('CRON_JOBS.VIEW'), cronJobsController.getHistory);
router.get('/:id', requirePermission('CRON_JOBS.VIEW'), cronJobsController.getById);
router.post('/', requirePermission('CRON_JOBS.EDIT'), cronJobsController.create);
router.put('/:id', requirePermission('CRON_JOBS.EDIT'), cronJobsController.update);
router.delete('/:id', requirePermission('CRON_JOBS.EDIT'), cronJobsController.remove);
router.post('/:id/run-now', requirePermission('CRON_JOBS.EDIT'), cronJobsController.runNow);

export const cronJobsRoutes = router;
