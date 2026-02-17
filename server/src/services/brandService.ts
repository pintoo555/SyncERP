/**
 * Brand CRUD. Soft delete. Unique BrandCode.
 */

import { getRequest } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import type { BrandCreateInput, BrandUpdateInput, ListQueryInput } from '../validators/mastersSchemas';

export interface BrandRecord {
  brandId: number;
  brandCode: string;
  brandName: string;
  description: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  createdBy: number | null;
}

export async function listBrands(query: ListQueryInput): Promise<{ data: BrandRecord[]; total: number }> {
  const req = await getRequest();
  const includeInactive = query.includeInactive ? 1 : 0;
  const result = await req
    .input('includeInactive', includeInactive)
    .input('offset', (query.page - 1) * query.pageSize)
    .input('pageSize', query.pageSize)
    .query(`
      SELECT BrandID AS brandId, BrandCode AS brandCode, BrandName AS brandName, Description AS description,
             IsActive AS isActive, IsDeleted AS isDeleted, CreatedAt AS createdAt, CreatedBy AS createdBy
      FROM react_AssetBrand
      WHERE IsDeleted = 0 AND (1 = @includeInactive OR IsActive = 1)
      ORDER BY BrandName
    `);
  const rows = result.recordset as BrandRecord[];
  const total = rows.length;
  const offset = (query.page - 1) * query.pageSize;
  const paged = rows.slice(offset, offset + query.pageSize);
  return { data: paged, total };
}

export async function getBrandById(id: number): Promise<BrandRecord | null> {
  const req = await getRequest();
  const result = await req
    .input('id', id)
    .query(`
      SELECT BrandID AS brandId, BrandCode AS brandCode, BrandName AS brandName, Description AS description,
             IsActive AS isActive, IsDeleted AS isDeleted, CreatedAt AS createdAt, CreatedBy AS createdBy
      FROM react_AssetBrand WHERE BrandID = @id
    `);
  const row = result.recordset[0] as BrandRecord | undefined;
  return row ?? null;
}

export async function createBrand(input: BrandCreateInput, userId: number): Promise<BrandRecord> {
  const req = await getRequest();
  const exists = await req
    .input('code', input.brandCode)
    .query('SELECT BrandID FROM react_AssetBrand WHERE BrandCode = @code AND IsDeleted = 0');
  if (exists.recordset.length > 0) {
    throw new AppError(409, 'Brand code already exists');
  }
  const result = await req
    .input('brandCode', input.brandCode)
    .input('brandName', input.brandName)
    .input('description', input.description ?? null)
    .input('isActive', input.isActive !== false ? 1 : 0)
    .input('createdBy', userId)
    .query(`
      INSERT INTO react_AssetBrand (BrandCode, BrandName, Description, IsActive, CreatedBy)
      OUTPUT INSERTED.BrandID, INSERTED.BrandCode, INSERTED.BrandName, INSERTED.Description,
             INSERTED.IsActive, INSERTED.IsDeleted, INSERTED.CreatedAt, INSERTED.CreatedBy
      VALUES (@brandCode, @brandName, @description, @isActive, @createdBy)
    `);
  const row = result.recordset[0];
  return {
    brandId: row.BrandID,
    brandCode: row.BrandCode,
    brandName: row.BrandName,
    description: row.Description,
    isActive: !!row.IsActive,
    isDeleted: !!row.IsDeleted,
    createdAt: row.CreatedAt,
    createdBy: row.CreatedBy,
  };
}

export async function updateBrand(
  id: number,
  input: BrandUpdateInput,
  userId: number
): Promise<BrandRecord | null> {
  const existing = await getBrandById(id);
  if (!existing) return null;
  if (input.brandCode !== undefined && input.brandCode !== existing.brandCode) {
    const req = await getRequest();
    const dup = await req
      .input('code', input.brandCode)
      .input('id', id)
      .query('SELECT BrandID FROM react_AssetBrand WHERE BrandCode = @code AND BrandID <> @id AND IsDeleted = 0');
    if (dup.recordset.length > 0) throw new AppError(409, 'Brand code already exists');
  }
  const req = await getRequest();
  await req
    .input('id', id)
    .input('brandCode', input.brandCode ?? existing.brandCode)
    .input('brandName', input.brandName ?? existing.brandName)
    .input('description', input.description !== undefined ? input.description : existing.description)
    .input('isActive', input.isActive !== undefined ? (input.isActive ? 1 : 0) : (existing.isActive ? 1 : 0))
    .input('updatedBy', userId)
    .query(`
      UPDATE react_AssetBrand
      SET BrandCode = @brandCode, BrandName = @brandName, Description = @description, IsActive = @isActive,
          UpdatedAt = GETDATE(), UpdatedBy = @updatedBy
      WHERE BrandID = @id
    `);
  return getBrandById(id);
}

export async function deleteBrand(id: number, userId: number): Promise<boolean> {
  const existing = await getBrandById(id);
  if (!existing) return false;
  const req = await getRequest();
  await req
    .input('id', id)
    .input('updatedBy', userId)
    .query(`
      UPDATE react_AssetBrand SET IsDeleted = 1, UpdatedAt = GETDATE(), UpdatedBy = @updatedBy WHERE BrandID = @id
    `);
  return true;
}
