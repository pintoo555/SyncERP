import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as settingsController from './settings.controller';

const router = Router();

router.get('/app', requireAuth, settingsController.getAppSettings);
router.put('/app', requireAuth, requirePermission('GENERAL_SETTINGS.EDIT'), settingsController.updateAppSettings);
router.get('/user', requireAuth, settingsController.getUserPreferences);
router.put('/user', requireAuth, settingsController.updateUserPreferences);

router.get('/brand-kit', requireAuth, requirePermission('BRAND_KIT.VIEW'), settingsController.getBrandKit);
router.put('/brand-kit', requireAuth, requirePermission('BRAND_KIT.EDIT'), settingsController.updateBrandKit);
router.post('/brand-kit/ai/from-image', requireAuth, requirePermission('BRAND_KIT.EDIT'), settingsController.suggestBrandKitFromImage);
router.post('/brand-kit/ai/from-website', requireAuth, requirePermission('BRAND_KIT.EDIT'), settingsController.suggestBrandKitFromWebsite);

export const settingsRoutes = router;
