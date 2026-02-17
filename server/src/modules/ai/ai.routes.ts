import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import * as aiController from './ai.controller';

const router = Router();

router.use(requireAuth);
router.post('/improve', aiController.improveHandler);

export const aiRoutes = router;
