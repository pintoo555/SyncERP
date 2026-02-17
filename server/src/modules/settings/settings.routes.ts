import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as settingsController from './settings.controller';

const router = Router();

router.get('/app', requireAuth, settingsController.getAppSettings);
router.put('/app', requireAuth, requirePermission('GENERAL_SETTINGS.EDIT'), settingsController.updateAppSettings);
router.get('/user', requireAuth, settingsController.getUserPreferences);
router.put('/user', requireAuth, settingsController.updateUserPreferences);

export const settingsRoutes = router;
