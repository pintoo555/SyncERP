import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as jobcardsController from './jobcards.controller';

const router = Router();
router.use(requireAuth);
router.get('/', requirePermission('JOBCARD.VIEW'), jobcardsController.listJobs);
router.get('/:id', requirePermission('JOBCARD.VIEW'), jobcardsController.getJob);

export const jobCardRoutes = router;
