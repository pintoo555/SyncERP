/**
 * Fast asset search using precomputed react_AssetSearch. Top 50 per page, indexed-style query.
 */

import { getRequest } from '../db/pool';
import { AppError } from '../middleware/errorHandler';

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 50;

export interface SearchResultItem {
  assetId: number;
  assetTag: string;
  categoryName: string | null;
  brandName: string | null;
  modelName: string | null;
  serialNumber: string | null;
  status: string;
}

/**
 * Build searchable text from asset fields and related names. Stored in react_AssetSearch.
 */
function buildSearchText(asset: {
  assetTag: string;
  serialNumber?: string | null;
  categoryName?: string | null;
  brandName?: string | null;
  modelName?: string | null;
  vendorName?: string | null;
  locationName?: string | null;
  description?: string | null;
  tagNames?: string[];
}): string {
  const parts = [
    asset.assetTag,
    asset.serialNumber ?? '',
    asset.categoryName ?? '',
    asset.brandName ?? '',
    asset.modelName ?? '',
    asset.vendorName ?? '',
    asset.locationName ?? '',
    asset.description ?? '',
    ...(asset.tagNames ?? []),
  ].filter(Boolean);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Update or insert react_AssetSearch for an asset. Call after asset create/update.
 */
export async function updateAssetSearch(assetId: number): Promise<void> {
  const req = await getRequest();
  const result = await req.input('assetId', assetId).query(`
    SELECT a.AssetID AS assetId, a.AssetTag AS assetTag, a.SerialNumber AS serialNumber, a.Description AS description,
           c.CategoryName AS categoryName, b.BrandName AS brandName, m.ModelName AS modelName,
           v.VendorName AS vendorName, l.LocationName AS locationName
    FROM react_Asset a
    LEFT JOIN react_AssetCategory c ON c.CategoryID = a.CategoryID
    LEFT JOIN react_AssetBrand b ON b.BrandID = a.BrandID
    LEFT JOIN react_AssetModel m ON m.ModelID = a.ModelID
    LEFT JOIN react_Vendors v ON v.VendorID = a.VendorID
    LEFT JOIN react_Location l ON l.LocationID = a.LocationID
    WHERE a.AssetID = @assetId
  `);
  const row = result.recordset[0] as {
    assetId: number;
    assetTag: string;
    serialNumber: string | null;
    description: string | null;
    categoryName: string | null;
    brandName: string | null;
    modelName: string | null;
    vendorName: string | null;
    locationName: string | null;
  } | undefined;
  if (!row) return;

  const tagsResult = await req.input('assetId', assetId).query(`
    SELECT TagName AS tagName FROM react_AssetTags WHERE AssetID = @assetId
  `);
  const tagNames = (tagsResult.recordset as { tagName: string }[]).map(r => r.tagName);
  const searchText = buildSearchText({
    ...row,
    tagNames,
  });

  const upsertReq = await getRequest();
  await upsertReq
    .input('assetId', assetId)
    .input('searchText', searchText)
    .query(`
      IF EXISTS (SELECT 1 FROM react_AssetSearch WHERE AssetID = @assetId)
        UPDATE react_AssetSearch SET SearchText = @searchText, UpdatedAt = GETDATE() WHERE AssetID = @assetId
      ELSE
        INSERT INTO react_AssetSearch (AssetID, SearchText) VALUES (@assetId, @searchText)
    `);
}

/**
 * Search assets by precomputed SearchText. Returns top 50 per page, only non-deleted assets.
 */
export async function searchAssets(
  q: string,
  page: number,
  pageSize: number
): Promise<{ data: SearchResultItem[]; total: number }> {
  const safePageSize = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
  const offset = (Math.max(1, page) - 1) * safePageSize;

  if (!q || q.trim().length === 0) {
    return { data: [], total: 0 };
  }

  const term = q.trim();
  if (term.length > 200) {
    throw new AppError(400, 'Search term too long');
  }

  const req = await getRequest();
  req.input('term', term);
  req.input('offset', offset);
  req.input('pageSize', safePageSize);

  const result = await req.query(`
    ;WITH CTE AS (
      SELECT s.AssetID, a.AssetTag, c.CategoryName, b.BrandName, m.ModelName, a.SerialNumber, a.Status,
             ROW_NUMBER() OVER (ORDER BY a.AssetTag) AS rn
      FROM react_AssetSearch s
      INNER JOIN react_Asset a ON a.AssetID = s.AssetID AND a.IsDeleted = 0
      LEFT JOIN react_AssetCategory c ON c.CategoryID = a.CategoryID
      LEFT JOIN react_AssetBrand b ON b.BrandID = a.BrandID
      LEFT JOIN react_AssetModel m ON m.ModelID = a.ModelID
      WHERE s.SearchText LIKE '%' + @term + '%'
    )
    SELECT AssetID AS assetId, AssetTag AS assetTag, CategoryName AS categoryName, BrandName AS brandName,
           ModelName AS modelName, SerialNumber AS serialNumber, Status AS status
    FROM CTE WHERE rn > @offset AND rn <= @offset + @pageSize
  `);

  const countReq = await getRequest();
  countReq.input('term', term);
  const countResult = await countReq.query(`
    SELECT COUNT_BIG(*) AS total
    FROM react_AssetSearch s
    INNER JOIN react_Asset a ON a.AssetID = s.AssetID AND a.IsDeleted = 0
    WHERE s.SearchText LIKE '%' + @term + '%'
  `);

  const data = (result.recordset || []) as SearchResultItem[];
  const total = (countResult.recordset?.[0] as { total: number })?.total ?? 0;
  return { data, total };
}

/**
 * Rebuild search index for all non-deleted assets. Use for initial sync or repair.
 */
export async function rebuildSearchIndex(): Promise<{ updated: number }> {
  const req = await getRequest();
  const listResult = await req.query(`
    SELECT AssetID AS assetId FROM react_Asset WHERE IsDeleted = 0
  `);
  const ids = (listResult.recordset as { assetId: number }[]).map(r => r.assetId);
  for (const assetId of ids) {
    await updateAssetSearch(assetId);
  }
  return { updated: ids.length };
}
