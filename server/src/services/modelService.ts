/**
 * Asset Model CRUD. Soft delete. Belongs to Brand.
 */

import { getRequest } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import type { ModelCreateInput, ModelUpdateInput, ListQueryInput } from '../validators/mastersSchemas';

export interface ModelRecord {
  modelId: number;
  brandId: number;
  brandCode?: string;
  brandName?: string;
  modelCode: string;
  modelName: string;
  description: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  createdBy: number | null;
}

export async function listModels(
  query: ListQueryInput,
  filters?: { brandId?: number }
): Promise<{ data: ModelRecord[]; total: number }> {
  const req = await getRequest();
  const includeInactive = query.includeInactive ? 1 : 0;
  let sql = `
    SELECT m.ModelID AS modelId, m.BrandID AS brandId, b.BrandCode AS brandCode, b.BrandName AS brandName,
           m.ModelCode AS modelCode, m.ModelName AS modelName, m.Description AS description,
           m.IsActive AS isActive, m.IsDeleted AS isDeleted, m.CreatedAt AS createdAt, m.CreatedBy AS createdBy
    FROM react_AssetModel m
    INNER JOIN react_AssetBrand b ON b.BrandID = m.BrandID
    WHERE m.IsDeleted = 0 AND (1 = @includeInactive OR m.IsActive = 1)
  `;
  if (filters?.brandId != null) {
    sql += ` AND m.BrandID = @brandId`;
  }
  sql += ` ORDER BY b.BrandName, m.ModelName`;
  const req2 = await getRequest();
  req2.input('includeInactive', includeInactive);
  if (filters?.brandId != null) req2.input('brandId', filters.brandId);
  const result = await req2.query(sql);
  const rows = result.recordset as ModelRecord[];
  const total = rows.length;
  const offset = (query.page - 1) * query.pageSize;
  const paged = rows.slice(offset, offset + query.pageSize);
  return { data: paged, total };
}

export async function getModelById(id: number): Promise<ModelRecord | null> {
  const req = await getRequest();
  const result = await req
    .input('id', id)
    .query(`
      SELECT m.ModelID AS modelId, m.BrandID AS brandId, b.BrandCode AS brandCode, b.BrandName AS brandName,
             m.ModelCode AS modelCode, m.ModelName AS modelName, m.Description AS description,
             m.IsActive AS isActive, m.IsDeleted AS isDeleted, m.CreatedAt AS createdAt, m.CreatedBy AS createdBy
      FROM react_AssetModel m
      INNER JOIN react_AssetBrand b ON b.BrandID = m.BrandID
      WHERE m.ModelID = @id
    `);
  const row = result.recordset[0] as ModelRecord | undefined;
  return row ?? null;
}

export async function createModel(input: ModelCreateInput, userId: number): Promise<ModelRecord> {
  const reqCheck = await getRequest();
  const brandExists = await reqCheck.input('brandId', input.brandId).query('SELECT BrandID FROM react_AssetBrand WHERE BrandID = @brandId AND IsDeleted = 0');
  if (brandExists.recordset.length === 0) throw new AppError(400, 'Brand not found');
  const req = await getRequest();
  const result = await req
    .input('brandId', input.brandId)
    .input('modelCode', input.modelCode)
    .input('modelName', input.modelName)
    .input('description', input.description ?? null)
    .input('isActive', input.isActive !== false ? 1 : 0)
    .input('createdBy', userId)
    .query(`
      INSERT INTO react_AssetModel (BrandID, ModelCode, ModelName, Description, IsActive, CreatedBy)
      OUTPUT INSERTED.ModelID, INSERTED.BrandID, INSERTED.ModelCode, INSERTED.ModelName,
             INSERTED.Description, INSERTED.IsActive, INSERTED.IsDeleted, INSERTED.CreatedAt, INSERTED.CreatedBy
      VALUES (@brandId, @modelCode, @modelName, @description, @isActive, @createdBy)
    `);
  const row = result.recordset[0] as { ModelID: number };
  const brandRow = await getModelById(row.ModelID);
  return brandRow!;
}

export async function updateModel(
  id: number,
  input: ModelUpdateInput,
  userId: number
): Promise<ModelRecord | null> {
  const existing = await getModelById(id);
  if (!existing) return null;
  if (input.brandId !== undefined) {
    const req = await getRequest();
    const brandExists = await req.input('brandId', input.brandId).query('SELECT BrandID FROM react_AssetBrand WHERE BrandID = @brandId AND IsDeleted = 0');
    if (brandExists.recordset.length === 0) throw new AppError(400, 'Brand not found');
  }
  const req = await getRequest();
  await req
    .input('id', id)
    .input('brandId', input.brandId ?? existing.brandId)
    .input('modelCode', input.modelCode ?? existing.modelCode)
    .input('modelName', input.modelName ?? existing.modelName)
    .input('description', input.description !== undefined ? input.description : existing.description)
    .input('isActive', input.isActive !== undefined ? (input.isActive ? 1 : 0) : (existing.isActive ? 1 : 0))
    .input('updatedBy', userId)
    .query(`
      UPDATE react_AssetModel
      SET BrandID = @brandId, ModelCode = @modelCode, ModelName = @modelName, Description = @description, IsActive = @isActive,
          UpdatedAt = GETDATE(), UpdatedBy = @updatedBy
      WHERE ModelID = @id
    `);
  return getModelById(id);
}

export async function deleteModel(id: number, userId: number): Promise<boolean> {
  const existing = await getModelById(id);
  if (!existing) return false;
  const req = await getRequest();
  await req
    .input('id', id)
    .input('updatedBy', userId)
    .query(`
      UPDATE react_AssetModel SET IsDeleted = 1, UpdatedAt = GETDATE(), UpdatedBy = @updatedBy WHERE ModelID = @id
    `);
  return true;
}
