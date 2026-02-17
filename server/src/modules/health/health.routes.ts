import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as healthController from './health.controller';

const router = Router();
router.use(requireAuth);
router.get('/', healthController.getHealth);
router.get('/alerts', healthController.getAlerts);
router.post('/alerts/acknowledge-all', healthController.acknowledgeAllAlerts);
router.post('/alerts/:id/acknowledge', healthController.acknowledgeAlert);
router.get('/users', requirePermission('HEALTH.SETTINGS'), healthController.getUsers);
router.get('/settings', requirePermission('HEALTH.SETTINGS'), healthController.getSettings);
router.post('/settings', requirePermission('HEALTH.SETTINGS'), healthController.createSetting);
router.put('/settings/:id', requirePermission('HEALTH.SETTINGS'), healthController.updateSetting);
router.delete('/settings/:id', requirePermission('HEALTH.SETTINGS'), healthController.deleteSetting);

export const healthRoutes = router;
