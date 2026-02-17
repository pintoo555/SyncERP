import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as reportController from './report.controller';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('REPORTS.EXPORT'));

router.get('/summary', reportController.getSummary);
router.get('/warranty', reportController.getWarranty);
router.get('/assignments', reportController.getAssignments);

export const reportRoutes = router;
