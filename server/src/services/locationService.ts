/**
 * Location CRUD (tree). Soft delete.
 */

import { getRequest } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import type { LocationCreateInput, LocationUpdateInput, ListQueryInput } from '../validators/mastersSchemas';

export interface LocationRecord {
  locationId: number;
  parentLocationId: number | null;
  locationCode: string;
  locationName: string;
  address: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  createdBy: number | null;
  children?: LocationRecord[];
}

export async function listLocations(
  query: ListQueryInput,
  options?: { tree?: boolean }
): Promise<{ data: LocationRecord[]; total: number }> {
  const req = await getRequest();
  const includeInactive = query.includeInactive ? 1 : 0;
  const result = await req
    .input('includeInactive', includeInactive)
    .query(`
      SELECT LocationID AS locationId, ParentLocationID AS parentLocationId, LocationCode AS locationCode,
             LocationName AS locationName, Address AS address, IsActive AS isActive, IsDeleted AS isDeleted,
             CreatedAt AS createdAt, CreatedBy AS createdBy
      FROM react_Location
      WHERE IsDeleted = 0 AND (1 = @includeInactive OR IsActive = 1)
      ORDER BY LocationName
    `);
  const rows = result.recordset as LocationRecord[];
  const total = rows.length;

  if (options?.tree) {
    const map = new Map<number, LocationRecord & { children?: LocationRecord[] }>();
    rows.forEach(r => map.set(r.locationId, { ...r, children: [] }));
    const roots: LocationRecord[] = [];
    rows.forEach(r => {
      const node = map.get(r.locationId)!;
      if (r.parentLocationId == null) {
        roots.push(node);
      } else {
        const parent = map.get(r.parentLocationId);
        if (parent && parent.children) parent.children.push(node);
        else roots.push(node);
      }
    });
    return { data: roots, total };
  }

  const offset = (query.page - 1) * query.pageSize;
  const paged = rows.slice(offset, offset + query.pageSize);
  return { data: paged, total };
}

export async function getLocationById(id: number): Promise<LocationRecord | null> {
  const req = await getRequest();
  const result = await req
    .input('id', id)
    .query(`
      SELECT LocationID AS locationId, ParentLocationID AS parentLocationId, LocationCode AS locationCode,
             LocationName AS locationName, Address AS address, IsActive AS isActive, IsDeleted AS isDeleted,
             CreatedAt AS createdAt, CreatedBy AS createdBy
      FROM react_Location WHERE LocationID = @id
    `);
  const row = result.recordset[0] as LocationRecord | undefined;
  return row ?? null;
}

export async function createLocation(
  input: LocationCreateInput,
  userId: number
): Promise<LocationRecord> {
  if (input.parentLocationId != null) {
    const parent = await getLocationById(input.parentLocationId);
    if (!parent) throw new AppError(400, 'Parent location not found');
  }
  const req = await getRequest();
  const result = await req
    .input('parentLocationId', input.parentLocationId ?? null)
    .input('locationCode', input.locationCode)
    .input('locationName', input.locationName)
    .input('address', input.address ?? null)
    .input('isActive', input.isActive !== false ? 1 : 0)
    .input('createdBy', userId)
    .query(`
      INSERT INTO react_Location (ParentLocationID, LocationCode, LocationName, Address, IsActive, CreatedBy)
      OUTPUT INSERTED.LocationID, INSERTED.ParentLocationID, INSERTED.LocationCode, INSERTED.LocationName,
             INSERTED.Address, INSERTED.IsActive, INSERTED.IsDeleted, INSERTED.CreatedAt, INSERTED.CreatedBy
      VALUES (@parentLocationId, @locationCode, @locationName, @address, @isActive, @createdBy)
    `);
  const row = result.recordset[0];
  return {
    locationId: row.LocationID,
    parentLocationId: row.ParentLocationID,
    locationCode: row.LocationCode,
    locationName: row.LocationName,
    address: row.Address,
    isActive: !!row.IsActive,
    isDeleted: !!row.IsDeleted,
    createdAt: row.CreatedAt,
    createdBy: row.CreatedBy,
  };
}

export async function updateLocation(
  id: number,
  input: LocationUpdateInput,
  userId: number
): Promise<LocationRecord | null> {
  const existing = await getLocationById(id);
  if (!existing) return null;
  if (input.parentLocationId !== undefined && input.parentLocationId !== null && input.parentLocationId === id) {
    throw new AppError(400, 'Location cannot be its own parent');
  }
  if (input.parentLocationId != null) {
    const parent = await getLocationById(input.parentLocationId);
    if (!parent) throw new AppError(400, 'Parent location not found');
  }
  const req = await getRequest();
  await req
    .input('id', id)
    .input('parentLocationId', input.parentLocationId ?? existing.parentLocationId)
    .input('locationCode', input.locationCode ?? existing.locationCode)
    .input('locationName', input.locationName ?? existing.locationName)
    .input('address', input.address !== undefined ? input.address : existing.address)
    .input('isActive', input.isActive !== undefined ? (input.isActive ? 1 : 0) : (existing.isActive ? 1 : 0))
    .input('updatedBy', userId)
    .query(`
      UPDATE react_Location
      SET ParentLocationID = @parentLocationId, LocationCode = @locationCode, LocationName = @locationName,
          Address = @address, IsActive = @isActive, UpdatedAt = GETDATE(), UpdatedBy = @updatedBy
      WHERE LocationID = @id
    `);
  return getLocationById(id);
}

export async function deleteLocation(id: number, userId: number): Promise<boolean> {
  const existing = await getLocationById(id);
  if (!existing) return false;
  const req = await getRequest();
  await req
    .input('id', id)
    .input('updatedBy', userId)
    .query(`
      UPDATE react_Location SET IsDeleted = 1, UpdatedAt = GETDATE(), UpdatedBy = @updatedBy WHERE LocationID = @id
    `);
  return true;
}
