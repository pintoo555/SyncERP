/**
 * Asset Category CRUD (tree). Soft delete; audit via controller.
 */

import { getRequest } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import type { CategoryCreateInput, CategoryUpdateInput, ListQueryInput } from '../validators/mastersSchemas';

export interface CategoryRecord {
  categoryId: number;
  parentCategoryId: number | null;
  categoryCode: string;
  categoryName: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  createdBy: number | null;
  children?: CategoryRecord[];
}

export async function listCategories(
  query: ListQueryInput,
  options?: { tree?: boolean }
): Promise<{ data: CategoryRecord[]; total: number }> {
  const req = await getRequest();
  const includeInactive = query.includeInactive ? 1 : 0;
  const result = await req
    .input('includeInactive', includeInactive)
    .query(`
      SELECT CategoryID AS categoryId, ParentCategoryID AS parentCategoryId, CategoryCode AS categoryCode,
             CategoryName AS categoryName, Description AS description, SortOrder AS sortOrder,
             IsActive AS isActive, IsDeleted AS isDeleted, CreatedAt AS createdAt, CreatedBy AS createdBy
      FROM react_AssetCategory
      WHERE IsDeleted = 0 AND (1 = @includeInactive OR IsActive = 1)
      ORDER BY SortOrder, CategoryName
    `);
  const rows = result.recordset as CategoryRecord[];
  const total = rows.length;

  if (options?.tree) {
    const map = new Map<number, CategoryRecord & { children?: CategoryRecord[] }>();
    rows.forEach(r => map.set(r.categoryId, { ...r, children: [] }));
    const roots: CategoryRecord[] = [];
    rows.forEach(r => {
      const node = map.get(r.categoryId)!;
      if (r.parentCategoryId == null) {
        roots.push(node);
      } else {
        const parent = map.get(r.parentCategoryId);
        if (parent && parent.children) parent.children.push(node);
        else roots.push(node);
      }
    });
    roots.sort((a, b) => a.sortOrder - b.sortOrder || a.categoryName.localeCompare(b.categoryName));
    return { data: roots, total };
  }

  const offset = (query.page - 1) * query.pageSize;
  const paged = rows.slice(offset, offset + query.pageSize);
  return { data: paged, total };
}

export async function getCategoryById(id: number): Promise<CategoryRecord | null> {
  const req = await getRequest();
  const result = await req
    .input('id', id)
    .query(`
      SELECT CategoryID AS categoryId, ParentCategoryID AS parentCategoryId, CategoryCode AS categoryCode,
             CategoryName AS categoryName, Description AS description, SortOrder AS sortOrder,
             IsActive AS isActive, IsDeleted AS isDeleted, CreatedAt AS createdAt, CreatedBy AS createdBy
      FROM react_AssetCategory WHERE CategoryID = @id
    `);
  const row = result.recordset[0] as CategoryRecord | undefined;
  return row ?? null;
}

export async function createCategory(
  input: CategoryCreateInput,
  userId: number
): Promise<CategoryRecord> {
  if (input.parentCategoryId != null) {
    const parent = await getCategoryById(input.parentCategoryId);
    if (!parent) throw new AppError(400, 'Parent category not found');
  }
  const req = await getRequest();
  const result = await req
    .input('parentCategoryId', input.parentCategoryId ?? null)
    .input('categoryCode', input.categoryCode)
    .input('categoryName', input.categoryName)
    .input('description', input.description ?? null)
    .input('sortOrder', input.sortOrder ?? 0)
    .input('isActive', input.isActive !== false ? 1 : 0)
    .input('createdBy', userId)
    .query(`
      INSERT INTO react_AssetCategory (ParentCategoryID, CategoryCode, CategoryName, Description, SortOrder, IsActive, CreatedBy)
      OUTPUT INSERTED.CategoryID, INSERTED.ParentCategoryID, INSERTED.CategoryCode, INSERTED.CategoryName,
             INSERTED.Description, INSERTED.SortOrder, INSERTED.IsActive, INSERTED.IsDeleted, INSERTED.CreatedAt, INSERTED.CreatedBy
      VALUES (@parentCategoryId, @categoryCode, @categoryName, @description, @sortOrder, @isActive, @createdBy)
    `);
  const row = result.recordset[0];
  return {
    categoryId: row.CategoryID,
    parentCategoryId: row.ParentCategoryID,
    categoryCode: row.CategoryCode,
    categoryName: row.CategoryName,
    description: row.Description,
    sortOrder: row.SortOrder,
    isActive: !!row.IsActive,
    isDeleted: !!row.IsDeleted,
    createdAt: row.CreatedAt,
    createdBy: row.CreatedBy,
  };
}

export async function updateCategory(
  id: number,
  input: CategoryUpdateInput,
  userId: number
): Promise<CategoryRecord | null> {
  const existing = await getCategoryById(id);
  if (!existing) return null;
  if (input.parentCategoryId !== undefined && input.parentCategoryId !== null && input.parentCategoryId === id) {
    throw new AppError(400, 'Category cannot be its own parent');
  }
  if (input.parentCategoryId != null) {
    const parent = await getCategoryById(input.parentCategoryId);
    if (!parent) throw new AppError(400, 'Parent category not found');
  }
  const req = await getRequest();
  await req
    .input('id', id)
    .input('parentCategoryId', input.parentCategoryId ?? existing.parentCategoryId)
    .input('categoryCode', input.categoryCode ?? existing.categoryCode)
    .input('categoryName', input.categoryName ?? existing.categoryName)
    .input('description', input.description !== undefined ? input.description : existing.description)
    .input('sortOrder', input.sortOrder ?? existing.sortOrder)
    .input('isActive', input.isActive !== undefined ? (input.isActive ? 1 : 0) : (existing.isActive ? 1 : 0))
    .input('updatedBy', userId)
    .query(`
      UPDATE react_AssetCategory
      SET ParentCategoryID = @parentCategoryId, CategoryCode = @categoryCode, CategoryName = @categoryName,
          Description = @description, SortOrder = @sortOrder, IsActive = @isActive, UpdatedAt = GETDATE(), UpdatedBy = @updatedBy
      WHERE CategoryID = @id
    `);
  return getCategoryById(id);
}

export async function deleteCategory(id: number, userId: number): Promise<boolean> {
  const existing = await getCategoryById(id);
  if (!existing) return false;
  const req = await getRequest();
  await req
    .input('id', id)
    .input('updatedBy', userId)
    .query(`
      UPDATE react_AssetCategory SET IsDeleted = 1, UpdatedAt = GETDATE(), UpdatedBy = @updatedBy WHERE CategoryID = @id
    `);
  return true;
}
