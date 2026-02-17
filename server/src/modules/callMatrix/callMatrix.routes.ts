import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as callMatrixController from './callMatrix.controller';

const router = Router();
router.use(requireAuth);
router.use(requirePermission('CALL_MATRIX.VIEW'));

router.get('/', callMatrixController.list);
router.get('/dashboard', callMatrixController.getDashboard);

export const callMatrixRoutes = router;
