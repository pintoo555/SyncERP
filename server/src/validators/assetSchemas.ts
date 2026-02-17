/**
 * Zod validation for Asset create/update and list query.
 */

import { z } from 'zod';

const ASSET_STATUSES = ['AVAILABLE', 'ISSUED', 'UNDER_REPAIR', 'SCRAPPED', 'LOST'] as const;
const trimString = (s: unknown) => (typeof s === 'string' ? s.trim() : s);
const optionalTrim = (s: unknown) => (s === undefined || s === null ? undefined : trimString(s));

export const assetCreateSchema = z.object({
  assetTag: z.string().min(1, 'Asset tag is required').max(100).transform(trimString),
  categoryId: z.number().int().positive('Category is required'),
  brandId: z.number().int().positive().optional().nullable(),
  modelId: z.number().int().positive().optional().nullable(),
  serialNumber: z.string().max(100).optional().nullable().transform(optionalTrim),
  purchaseDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.date()]).optional().nullable(),
  purchasePrice: z.number().min(0).optional().nullable(),
  vendorId: z.number().int().positive().optional().nullable(),
  warrantyExpiry: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.date()]).optional().nullable(),
  amcExpiry: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.date()]).optional().nullable(),
  locationId: z.number().int().positive().optional().nullable(),
  description: z.string().max(5000).optional().nullable().transform(optionalTrim),
  tagNames: z.array(z.string().max(100).transform(trimString)).optional().default([]),
});

export const assetUpdateSchema = z.object({
  assetTag: z.string().min(1).max(100).transform(trimString).optional(),
  categoryId: z.number().int().positive().optional(),
  brandId: z.number().int().positive().optional().nullable(),
  modelId: z.number().int().positive().optional().nullable(),
  serialNumber: z.string().max(100).optional().nullable().transform(optionalTrim),
  purchaseDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.date()]).optional().nullable(),
  purchasePrice: z.number().min(0).optional().nullable(),
  vendorId: z.number().int().positive().optional().nullable(),
  warrantyExpiry: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.date()]).optional().nullable(),
  amcExpiry: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.date()]).optional().nullable(),
  locationId: z.number().int().positive().optional().nullable(),
  description: z.string().max(5000).optional().nullable().transform(optionalTrim),
  tagNames: z.array(z.string().max(100).transform(trimString)).optional(),
});

export const assetChangeStatusSchema = z.object({
  status: z.enum(ASSET_STATUSES),
  notes: z.string().max(500).optional().nullable().transform(optionalTrim),
});

export const assetListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  status: z.enum(ASSET_STATUSES).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  locationId: z.coerce.number().int().positive().optional(),
  assignedToUserId: z.coerce.number().int().positive().optional(),
  search: z.string().max(100).optional().transform(s => (typeof s === 'string' ? s.trim() || undefined : undefined)),
  /** Full-text search (react_AssetSearch.SearchText) */
  q: z.string().max(200).optional().transform(s => (typeof s === 'string' ? s.trim() || undefined : undefined)),
});

export type AssetCreateInput = z.infer<typeof assetCreateSchema>;
export type AssetUpdateInput = z.infer<typeof assetUpdateSchema>;
export type AssetChangeStatusInput = z.infer<typeof assetChangeStatusSchema>;
export type AssetListQueryInput = z.infer<typeof assetListQuerySchema>;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
