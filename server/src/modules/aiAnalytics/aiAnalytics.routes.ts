import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as aiAnalyticsController from './aiAnalytics.controller';

const router = Router();

router.use(requireAuth);
router.get('/', requirePermission('AI_CONFIG.VIEW'), aiAnalyticsController.getAnalytics);

export const aiAnalyticsRoutes = router;
