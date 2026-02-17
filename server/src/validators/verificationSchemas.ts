/**
 * Validation for asset verification records.
 */

import { z } from 'zod';

const trimString = (s: unknown) => (typeof s === 'string' ? s.trim() : s);
const optionalTrim = (s: unknown) => (s === undefined || s === null ? undefined : trimString(s));

export const verificationCreateSchema = z.object({
  assetId: z.number().int().positive('Asset is required'),
  locationId: z.number().int().positive().optional().nullable(),
  notes: z.string().max(500).optional().nullable().transform(optionalTrim),
  verifiedStatus: z.string().max(50).optional().nullable().transform(optionalTrim),
});

export const verificationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  assetId: z.coerce.number().int().positive().optional(),
});

export type VerificationCreateInput = z.infer<typeof verificationCreateSchema>;
export type VerificationListQueryInput = z.infer<typeof verificationListQuerySchema>;
