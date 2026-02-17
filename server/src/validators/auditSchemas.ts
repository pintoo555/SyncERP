/**
 * Validation for audit log list/search and export.
 */

import { z } from 'zod';

const AUDIT_SORT_COLUMNS = ['createdAt', 'eventType', 'entityType', 'entityId', 'userEmail', 'ipAddress', 'details'] as const;

const auditListQueryShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(500).default(50),
  eventType: z.string().max(50).optional(),
  entityType: z.string().max(50).optional(),
  entityId: z.string().max(100).optional(),
  userId: z.coerce.number().int().positive().optional(),
  userEmail: z.string().max(100).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  details: z.string().max(200).optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(AUDIT_SORT_COLUMNS).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
};

export const auditListQuerySchema = z.object(auditListQueryShape);

/** Export (CSV/PDF) allows pageSize up to 10000; service still caps at EXPORT_MAX_ROWS. */
export const auditExportQuerySchema = z.object({
  ...auditListQueryShape,
  pageSize: z.coerce.number().int().min(1).max(10000).default(10000),
});

export type AuditListQueryInput = z.infer<typeof auditListQuerySchema>;
