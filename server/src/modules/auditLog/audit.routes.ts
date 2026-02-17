import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as auditController from './audit.controller';

const router = Router();

router.use(requireAuth);

router.get('/dashboard', requirePermission('AUDIT.VIEW'), auditController.getDashboard);
router.get('/', requirePermission('AUDIT.VIEW'), auditController.list);
router.get('/search', requirePermission('AUDIT.SEARCH'), auditController.search);
router.get('/export', requirePermission('AUDIT.EXPORT'), auditController.exportCsv);
router.get('/export/pdf', requirePermission('AUDIT.EXPORT'), auditController.exportPdf);

export const auditRoutes = router;
