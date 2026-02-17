import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import * as myAssetsController from './myAssets.controller';

const router = Router();
router.use(requireAuth);
router.get('/assets', myAssetsController.myAssets);

export const myAssetsRoutes = router;
