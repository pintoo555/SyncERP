import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as emailSettingsController from './emailSettings.controller';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('EMAIL_SETTINGS.VIEW'), emailSettingsController.list);
router.get('/:id', requirePermission('EMAIL_SETTINGS.VIEW'), emailSettingsController.getById);
router.post('/', requirePermission('EMAIL_SETTINGS.CREATE'), emailSettingsController.create);
router.put('/:id', requirePermission('EMAIL_SETTINGS.EDIT'), emailSettingsController.update);
router.delete('/:id', requirePermission('EMAIL_SETTINGS.DELETE'), emailSettingsController.remove);
router.post('/:id/set-default', requirePermission('EMAIL_SETTINGS.EDIT'), emailSettingsController.setDefault);
router.post('/:id/send-test', requirePermission('EMAIL_SETTINGS.EDIT'), emailSettingsController.sendTest);

export const emailSettingsRoutes = router;
