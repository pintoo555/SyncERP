/**
 * Masters CRUD controllers. Validation via Zod; audit for create/update/delete.
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../shared/middleware/auth';
import { AppError } from '../../shared/middleware/errorHandler';
import { logAudit, getClientIp, getUserAgent } from '../../services/auditService';
import * as categoryService from '../../services/categoryService';
import * as brandService from '../../services/brandService';
import * as modelService from '../../services/modelService';
import * as vendorService from '../../services/vendorService';
import * as locationService from '../../services/locationService';
import {
  categoryCreateSchema,
  categoryUpdateSchema,
  brandCreateSchema,
  brandUpdateSchema,
  modelCreateSchema,
  modelUpdateSchema,
  vendorCreateSchema,
  vendorUpdateSchema,
  locationCreateSchema,
  locationUpdateSchema,
  listQuerySchema,
} from '../../validators/mastersSchemas';

function auditContext(req: AuthRequest, entityType: string, entityId: string, eventType: 'create' | 'update' | 'delete', details?: string) {
  logAudit({
    eventType,
    entityType,
    entityId,
    userId: req.user?.userId,
    userEmail: req.user?.email,
    ipAddress: getClientIp(req),
    userAgent: getUserAgent(req),
    details,
  }).catch(() => {});
}

// --- Categories ---
export async function listCategories(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const query = listQuerySchema.parse({
      page: req.query.page,
      pageSize: req.query.pageSize,
      includeInactive: req.query.includeInactive,
    });
    const tree = req.query.tree === 'true';
    const result = await categoryService.listCategories(query, { tree });
    res.json({ success: true, data: result.data, total: result.total });
  } catch (e) {
    next(e);
  }
}

export async function getCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid category ID'));
    const row = await categoryService.getCategoryById(id);
    if (!row) return next(new AppError(404, 'Category not found'));
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function createCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const body = categoryCreateSchema.parse(req.body);
    const row = await categoryService.createCategory(body, req.user.userId);
    auditContext(req, 'category', String(row.categoryId), 'create');
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function updateCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid category ID'));
    const body = categoryUpdateSchema.parse(req.body);
    const row = await categoryService.updateCategory(id, body, req.user.userId);
    if (!row) return next(new AppError(404, 'Category not found'));
    auditContext(req, 'category', String(id), 'update');
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function deleteCategory(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid category ID'));
    const ok = await categoryService.deleteCategory(id, req.user.userId);
    if (!ok) return next(new AppError(404, 'Category not found'));
    auditContext(req, 'category', String(id), 'delete');
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

// --- Brands ---
export async function listBrands(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const query = listQuerySchema.parse({
      page: req.query.page,
      pageSize: req.query.pageSize,
      includeInactive: req.query.includeInactive,
    });
    const result = await brandService.listBrands(query);
    res.json({ success: true, data: result.data, total: result.total });
  } catch (e) {
    next(e);
  }
}

export async function getBrand(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid brand ID'));
    const row = await brandService.getBrandById(id);
    if (!row) return next(new AppError(404, 'Brand not found'));
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function createBrand(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const body = brandCreateSchema.parse(req.body);
    const row = await brandService.createBrand(body, req.user.userId);
    auditContext(req, 'brand', String(row.brandId), 'create');
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function updateBrand(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid brand ID'));
    const body = brandUpdateSchema.parse(req.body);
    const row = await brandService.updateBrand(id, body, req.user.userId);
    if (!row) return next(new AppError(404, 'Brand not found'));
    auditContext(req, 'brand', String(id), 'update');
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function deleteBrand(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid brand ID'));
    const ok = await brandService.deleteBrand(id, req.user.userId);
    if (!ok) return next(new AppError(404, 'Brand not found'));
    auditContext(req, 'brand', String(id), 'delete');
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

// --- Models ---
export async function listModels(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const query = listQuerySchema.parse({
      page: req.query.page,
      pageSize: req.query.pageSize,
      includeInactive: req.query.includeInactive,
    });
    const brandIdParam = req.query.brandId != null ? parseInt(String(req.query.brandId), 10) : undefined;
    const filters = brandIdParam !== undefined && !Number.isNaN(brandIdParam) ? { brandId: brandIdParam } : undefined;
    const result = await modelService.listModels(query, filters);
    res.json({ success: true, data: result.data, total: result.total });
  } catch (e) {
    next(e);
  }
}

export async function getModel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid model ID'));
    const row = await modelService.getModelById(id);
    if (!row) return next(new AppError(404, 'Model not found'));
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function createModel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const body = modelCreateSchema.parse(req.body);
    const row = await modelService.createModel(body, req.user.userId);
    auditContext(req, 'model', String(row.modelId), 'create');
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function updateModel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid model ID'));
    const body = modelUpdateSchema.parse(req.body);
    const row = await modelService.updateModel(id, body, req.user.userId);
    if (!row) return next(new AppError(404, 'Model not found'));
    auditContext(req, 'model', String(id), 'update');
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function deleteModel(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid model ID'));
    const ok = await modelService.deleteModel(id, req.user.userId);
    if (!ok) return next(new AppError(404, 'Model not found'));
    auditContext(req, 'model', String(id), 'delete');
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

// --- Vendors ---
export async function listVendors(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const query = listQuerySchema.parse({
      page: req.query.page,
      pageSize: req.query.pageSize,
      includeInactive: req.query.includeInactive,
    });
    const result = await vendorService.listVendors(query);
    res.json({ success: true, data: result.data, total: result.total });
  } catch (e) {
    next(e);
  }
}

export async function getVendor(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid vendor ID'));
    const row = await vendorService.getVendorById(id);
    if (!row) return next(new AppError(404, 'Vendor not found'));
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function createVendor(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const body = vendorCreateSchema.parse(req.body);
    const row = await vendorService.createVendor(body, req.user.userId);
    auditContext(req, 'vendor', String(row.vendorId), 'create');
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function updateVendor(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid vendor ID'));
    const body = vendorUpdateSchema.parse(req.body);
    const row = await vendorService.updateVendor(id, body, req.user.userId);
    if (!row) return next(new AppError(404, 'Vendor not found'));
    auditContext(req, 'vendor', String(id), 'update');
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function deleteVendor(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid vendor ID'));
    const ok = await vendorService.deleteVendor(id, req.user.userId);
    if (!ok) return next(new AppError(404, 'Vendor not found'));
    auditContext(req, 'vendor', String(id), 'delete');
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}

// --- Locations ---
export async function listLocations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const query = listQuerySchema.parse({
      page: req.query.page,
      pageSize: req.query.pageSize,
      includeInactive: req.query.includeInactive,
    });
    const tree = req.query.tree === 'true';
    const result = await locationService.listLocations(query, { tree });
    res.json({ success: true, data: result.data, total: result.total });
  } catch (e) {
    next(e);
  }
}

export async function getLocation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid location ID'));
    const row = await locationService.getLocationById(id);
    if (!row) return next(new AppError(404, 'Location not found'));
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function createLocation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const body = locationCreateSchema.parse(req.body);
    const row = await locationService.createLocation(body, req.user.userId);
    auditContext(req, 'location', String(row.locationId), 'create');
    res.status(201).json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function updateLocation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid location ID'));
    const body = locationUpdateSchema.parse(req.body);
    const row = await locationService.updateLocation(id, body, req.user.userId);
    if (!row) return next(new AppError(404, 'Location not found'));
    auditContext(req, 'location', String(id), 'update');
    res.json({ success: true, data: row });
  } catch (e) {
    next(e);
  }
}

export async function deleteLocation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return next(new AppError(400, 'Invalid location ID'));
    const ok = await locationService.deleteLocation(id, req.user.userId);
    if (!ok) return next(new AppError(404, 'Location not found'));
    auditContext(req, 'location', String(id), 'delete');
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
}
