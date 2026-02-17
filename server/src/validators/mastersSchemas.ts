/**
 * Zod validation schemas for masters (categories, brands, models, vendors, locations).
 */

import { z } from 'zod';

const trimString = (s: unknown) => (typeof s === 'string' ? s.trim() : s);
const optionalTrim = (s: unknown) => (s === undefined || s === null ? undefined : trimString(s));

export const categoryCreateSchema = z.object({
  parentCategoryId: z.number().int().positive().optional().nullable(),
  categoryCode: z.string().min(1, 'Category code is required').max(50).transform(trimString),
  categoryName: z.string().min(1, 'Category name is required').max(200).transform(trimString),
  description: z.string().max(500).optional().nullable().transform(optionalTrim),
  sortOrder: z.number().int().min(0).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const brandCreateSchema = z.object({
  brandCode: z.string().min(1, 'Brand code is required').max(50).transform(trimString),
  brandName: z.string().min(1, 'Brand name is required').max(200).transform(trimString),
  description: z.string().max(500).optional().nullable().transform(optionalTrim),
  isActive: z.boolean().optional().default(true),
});

export const brandUpdateSchema = brandCreateSchema.partial();

export const modelCreateSchema = z.object({
  brandId: z.number().int().positive('Brand is required'),
  modelCode: z.string().min(1, 'Model code is required').max(50).transform(trimString),
  modelName: z.string().min(1, 'Model name is required').max(200).transform(trimString),
  description: z.string().max(500).optional().nullable().transform(optionalTrim),
  isActive: z.boolean().optional().default(true),
});

export const modelUpdateSchema = modelCreateSchema.partial();

export const vendorCreateSchema = z.object({
  vendorCode: z.string().min(1, 'Vendor code is required').max(50).transform(trimString),
  vendorName: z.string().min(1, 'Vendor name is required').max(200).transform(trimString),
  contactPerson: z.string().max(100).optional().nullable().transform(optionalTrim),
  contactEmail: z.string().max(100).optional().nullable().transform(optionalTrim),
  contactPhone: z.string().max(50).optional().nullable().transform(optionalTrim),
  address: z.string().max(500).optional().nullable().transform(optionalTrim),
  isActive: z.boolean().optional().default(true),
});

export const vendorUpdateSchema = vendorCreateSchema.partial();

export const locationCreateSchema = z.object({
  parentLocationId: z.number().int().positive().optional().nullable(),
  locationCode: z.string().min(1, 'Location code is required').max(50).transform(trimString),
  locationName: z.string().min(1, 'Location name is required').max(200).transform(trimString),
  address: z.string().max(500).optional().nullable().transform(optionalTrim),
  isActive: z.boolean().optional().default(true),
});

export const locationUpdateSchema = locationCreateSchema.partial();

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(500).optional().default(100),
  includeInactive: z.coerce.boolean().optional().default(false),
});

export type CategoryCreateInput = z.infer<typeof categoryCreateSchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
export type BrandCreateInput = z.infer<typeof brandCreateSchema>;
export type BrandUpdateInput = z.infer<typeof brandUpdateSchema>;
export type ModelCreateInput = z.infer<typeof modelCreateSchema>;
export type ModelUpdateInput = z.infer<typeof modelUpdateSchema>;
export type VendorCreateInput = z.infer<typeof vendorCreateSchema>;
export type VendorUpdateInput = z.infer<typeof vendorUpdateSchema>;
export type LocationCreateInput = z.infer<typeof locationCreateSchema>;
export type LocationUpdateInput = z.infer<typeof locationUpdateSchema>;
export type ListQueryInput = z.infer<typeof listQuerySchema>;
