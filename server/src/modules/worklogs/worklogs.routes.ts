/**
 * Work Logs API - placeholder for future implementation.
 */

import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';

const router = Router();

router.use(requireAuth);
router.use(requirePermission('WORKLOGS.VIEW'));

router.get('/', (_req, res) => {
  res.json({ success: true, data: [], total: 0, message: 'Work logs API - to be implemented' });
});

export const workLogRoutes = router;
