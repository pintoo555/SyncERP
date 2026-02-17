/**
 * Validation for maintenance tickets.
 */

import { z } from 'zod';

const trimString = (s: unknown) => (typeof s === 'string' ? s.trim() : s);
const optionalTrim = (s: unknown) => (s === undefined || s === null ? undefined : trimString(s));

export const ticketCreateSchema = z.object({
  assetId: z.number().int().positive('Asset is required'),
  subject: z.string().min(1, 'Subject is required').max(200).transform(trimString),
  description: z.string().max(5000).optional().nullable().transform(optionalTrim),
  vendorId: z.number().int().positive().optional().nullable(),
  reportedByUserId: z.number().int().positive().optional().nullable(),
});

export const ticketUpdateSchema = z.object({
  subject: z.string().min(1).max(200).transform(trimString).optional(),
  description: z.string().max(5000).optional().nullable().transform(optionalTrim),
  vendorId: z.number().int().positive().optional().nullable(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'ON_HOLD', 'RESOLVED', 'CLOSED']).optional(),
});

export const ticketCloseSchema = z.object({
  resolutionNotes: z.string().max(2000).optional().nullable().transform(optionalTrim),
  cost: z.number().min(0).optional().nullable(),
});

export const ticketListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  assetId: z.coerce.number().int().positive().optional(),
  status: z.string().max(50).optional(),
});

export type TicketCreateInput = z.infer<typeof ticketCreateSchema>;
export type TicketUpdateInput = z.infer<typeof ticketUpdateSchema>;
export type TicketCloseInput = z.infer<typeof ticketCloseSchema>;
export type TicketListQueryInput = z.infer<typeof ticketListQuerySchema>;
