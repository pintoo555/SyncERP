import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as assetController from './asset.controller';

const router = Router();
router.use(requireAuth);

router.get('/', requirePermission('ASSET.VIEW'), assetController.listAssets);
router.get('/:id', requirePermission('ASSET.VIEW'), assetController.getAsset);
router.post('/', requirePermission('ASSET.CREATE'), assetController.createAsset);
router.put('/:id', requirePermission('ASSET.EDIT'), assetController.updateAsset);
router.delete('/:id', requirePermission('ASSET.DELETE'), assetController.deleteAsset);
router.patch('/:id/status', requirePermission('ASSET.CHANGE_STATUS'), assetController.changeStatus);
router.put('/:id/primary-photo', requirePermission('ASSET.EDIT'), assetController.setPrimaryPhoto);

export const assetRoutes = router;
