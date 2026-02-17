import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as dashboardController from './dashboards.controller';

const router = Router();

router.use(requireAuth);

router.get('/admin', requirePermission('DASH.VIEW_ADMIN'), dashboardController.admin);
router.get('/department', requirePermission('DASH.VIEW_DEPT'), dashboardController.department);
router.get('/department/:departmentId', requirePermission('DASH.VIEW_DEPT'), dashboardController.department);
router.get('/self', requirePermission('DASH.VIEW_SELF'), dashboardController.self);

export const dashboardRoutes = router;
