import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as apiConfigController from './apiConfig.controller';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission('AI_CONFIG.VIEW'), apiConfigController.list);
router.get('/:configId', requirePermission('AI_CONFIG.VIEW'), apiConfigController.getById);
router.post('/', requirePermission('AI_CONFIG.CREATE'), apiConfigController.create);
router.post('/:configId/test', requirePermission('AI_CONFIG.VIEW'), apiConfigController.testConfig);
router.put('/:configId', requirePermission('AI_CONFIG.EDIT'), apiConfigController.update);
router.delete('/:configId', requirePermission('AI_CONFIG.DELETE'), apiConfigController.remove);

export const apiConfigRoutes = router;
