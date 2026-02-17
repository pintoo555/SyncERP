import { z } from 'zod';

export const assetSearchQuerySchema = z.object({
  q: z.string().min(1, 'Search term is required').max(200).transform(s => s.trim()),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(50),
});

export type AssetSearchQueryInput = z.infer<typeof assetSearchQuerySchema>;
