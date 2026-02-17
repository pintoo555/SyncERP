import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import { uploadSingle } from '../../shared/middleware/uploadMiddleware';
import * as fileController from './file.controller';

const router = Router();
router.use(requireAuth);

router.post('/upload', requirePermission('FILES.UPLOAD'), (req, res, next) => {
  uploadSingle(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}, fileController.upload);

router.get('/asset/:assetId', requirePermission('FILES.VIEW'), fileController.listByAsset);
router.get('/:fileId', requirePermission('FILES.VIEW'), fileController.getFile);
router.delete('/:fileId', requirePermission('FILES.DELETE'), fileController.deleteFile);

export const fileRoutes = router;
