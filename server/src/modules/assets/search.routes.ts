import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as searchController from './search.controller';

const router = Router();
router.use(requireAuth);

router.get('/assets', requirePermission('ASSET.SEARCH'), searchController.searchAssets);
router.post('/rebuild', requirePermission('ASSET.EDIT'), searchController.rebuildIndex);

export const searchRoutes = router;
