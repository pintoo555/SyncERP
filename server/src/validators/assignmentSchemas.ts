/**
 * Validation for assignment: issue, return, transfer.
 */

import { z } from 'zod';

const trimString = (s: unknown) => (typeof s === 'string' ? s.trim() : s);
const optionalTrim = (s: unknown) => (s === undefined || s === null ? undefined : trimString(s));

export const issueSchema = z.object({
  assetId: z.number().int().positive('Asset ID is required'),
  assignedToUserId: z.number().int().positive('Assigned to user is required'),
  dueReturnDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.date()]).optional().nullable(),
  notes: z.string().max(500).optional().nullable().transform(optionalTrim),
});

export const returnSchema = z.object({
  assignmentId: z.number().int().positive('Assignment ID is required'),
  notes: z.string().max(500).optional().nullable().transform(optionalTrim),
});

export const transferSchema = z.object({
  assetId: z.number().int().positive('Asset ID is required'),
  fromUserId: z.number().int().positive('From user is required'),
  toUserId: z.number().int().positive('To user is required'),
  dueReturnDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.date()]).optional().nullable(),
  notes: z.string().max(500).optional().nullable().transform(optionalTrim),
});

export type IssueInput = z.infer<typeof issueSchema>;
export type ReturnInput = z.infer<typeof returnSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
