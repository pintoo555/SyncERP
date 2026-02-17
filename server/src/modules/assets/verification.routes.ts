import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as verificationController from './verification.controller';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('VERIFY.VIEW'), verificationController.list);
router.get('/:id', requirePermission('VERIFY.VIEW'), verificationController.getVerification);
router.post('/', requirePermission('VERIFY.CREATE'), verificationController.create);

export const verificationRoutes = router;
