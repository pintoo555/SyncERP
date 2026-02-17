import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/auth';
import { requirePermission } from '../../shared/middleware/requirePermission';
import * as masters from './masters.controller';

const router = Router();
router.use(requireAuth);

router.get('/categories', requirePermission('MASTERS.CAT.VIEW'), masters.listCategories);
router.get('/categories/:id', requirePermission('MASTERS.CAT.VIEW'), masters.getCategory);
router.post('/categories', requirePermission('MASTERS.CAT.CREATE'), masters.createCategory);
router.put('/categories/:id', requirePermission('MASTERS.CAT.EDIT'), masters.updateCategory);
router.delete('/categories/:id', requirePermission('MASTERS.CAT.DELETE'), masters.deleteCategory);

router.get('/brands', requirePermission('MASTERS.BRAND.VIEW'), masters.listBrands);
router.get('/brands/:id', requirePermission('MASTERS.BRAND.VIEW'), masters.getBrand);
router.post('/brands', requirePermission('MASTERS.BRAND.CREATE'), masters.createBrand);
router.put('/brands/:id', requirePermission('MASTERS.BRAND.EDIT'), masters.updateBrand);
router.delete('/brands/:id', requirePermission('MASTERS.BRAND.DELETE'), masters.deleteBrand);

router.get('/models', requirePermission('MASTERS.MODEL.VIEW'), masters.listModels);
router.get('/models/:id', requirePermission('MASTERS.MODEL.VIEW'), masters.getModel);
router.post('/models', requirePermission('MASTERS.MODEL.CREATE'), masters.createModel);
router.put('/models/:id', requirePermission('MASTERS.MODEL.EDIT'), masters.updateModel);
router.delete('/models/:id', requirePermission('MASTERS.MODEL.DELETE'), masters.deleteModel);

router.get('/vendors', requirePermission('MASTERS.VENDOR.VIEW'), masters.listVendors);
router.get('/vendors/:id', requirePermission('MASTERS.VENDOR.VIEW'), masters.getVendor);
router.post('/vendors', requirePermission('MASTERS.VENDOR.CREATE'), masters.createVendor);
router.put('/vendors/:id', requirePermission('MASTERS.VENDOR.EDIT'), masters.updateVendor);
router.delete('/vendors/:id', requirePermission('MASTERS.VENDOR.DELETE'), masters.deleteVendor);

router.get('/locations', requirePermission('MASTERS.LOC.VIEW'), masters.listLocations);
router.get('/locations/:id', requirePermission('MASTERS.LOC.VIEW'), masters.getLocation);
router.post('/locations', requirePermission('MASTERS.LOC.CREATE'), masters.createLocation);
router.put('/locations/:id', requirePermission('MASTERS.LOC.EDIT'), masters.updateLocation);
router.delete('/locations/:id', requirePermission('MASTERS.LOC.DELETE'), masters.deleteLocation);

export const mastersRoutes = router;
