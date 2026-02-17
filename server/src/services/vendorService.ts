/**
 * Vendor CRUD. Soft delete. Unique VendorCode.
 */

import { getRequest } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import type { VendorCreateInput, VendorUpdateInput, ListQueryInput } from '../validators/mastersSchemas';

export interface VendorRecord {
  vendorId: number;
  vendorCode: string;
  vendorName: string;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  isActive: boolean;
  isDeleted: boolean;
  createdAt: Date;
  createdBy: number | null;
}

export async function listVendors(query: ListQueryInput): Promise<{ data: VendorRecord[]; total: number }> {
  const req = await getRequest();
  const includeInactive = query.includeInactive ? 1 : 0;
  const result = await req
    .input('includeInactive', includeInactive)
    .query(`
      SELECT VendorID AS vendorId, VendorCode AS vendorCode, VendorName AS vendorName,
             ContactPerson AS contactPerson, ContactEmail AS contactEmail, ContactPhone AS contactPhone, Address AS address,
             IsActive AS isActive, IsDeleted AS isDeleted, CreatedAt AS createdAt, CreatedBy AS createdBy
      FROM react_Vendors
      WHERE IsDeleted = 0 AND (1 = @includeInactive OR IsActive = 1)
      ORDER BY VendorName
    `);
  const rows = result.recordset as VendorRecord[];
  const total = rows.length;
  const offset = (query.page - 1) * query.pageSize;
  const paged = rows.slice(offset, offset + query.pageSize);
  return { data: paged, total };
}

export async function getVendorById(id: number): Promise<VendorRecord | null> {
  const req = await getRequest();
  const result = await req
    .input('id', id)
    .query(`
      SELECT VendorID AS vendorId, VendorCode AS vendorCode, VendorName AS vendorName,
             ContactPerson AS contactPerson, ContactEmail AS contactEmail, ContactPhone AS contactPhone, Address AS address,
             IsActive AS isActive, IsDeleted AS isDeleted, CreatedAt AS createdAt, CreatedBy AS createdBy
      FROM react_Vendors WHERE VendorID = @id
    `);
  const row = result.recordset[0] as VendorRecord | undefined;
  return row ?? null;
}

export async function createVendor(input: VendorCreateInput, userId: number): Promise<VendorRecord> {
  const req = await getRequest();
  const exists = await req
    .input('code', input.vendorCode)
    .query('SELECT VendorID FROM react_Vendors WHERE VendorCode = @code AND IsDeleted = 0');
  if (exists.recordset.length > 0) throw new AppError(409, 'Vendor code already exists');
  const result = await req
    .input('vendorCode', input.vendorCode)
    .input('vendorName', input.vendorName)
    .input('contactPerson', input.contactPerson ?? null)
    .input('contactEmail', input.contactEmail ?? null)
    .input('contactPhone', input.contactPhone ?? null)
    .input('address', input.address ?? null)
    .input('isActive', input.isActive !== false ? 1 : 0)
    .input('createdBy', userId)
    .query(`
      INSERT INTO react_Vendors (VendorCode, VendorName, ContactPerson, ContactEmail, ContactPhone, Address, IsActive, CreatedBy)
      OUTPUT INSERTED.VendorID, INSERTED.VendorCode, INSERTED.VendorName, INSERTED.ContactPerson, INSERTED.ContactEmail,
             INSERTED.ContactPhone, INSERTED.Address, INSERTED.IsActive, INSERTED.IsDeleted, INSERTED.CreatedAt, INSERTED.CreatedBy
      VALUES (@vendorCode, @vendorName, @contactPerson, @contactEmail, @contactPhone, @address, @isActive, @createdBy)
    `);
  const row = result.recordset[0];
  return {
    vendorId: row.VendorID,
    vendorCode: row.VendorCode,
    vendorName: row.VendorName,
    contactPerson: row.ContactPerson,
    contactEmail: row.ContactEmail,
    contactPhone: row.ContactPhone,
    address: row.Address,
    isActive: !!row.IsActive,
    isDeleted: !!row.IsDeleted,
    createdAt: row.CreatedAt,
    createdBy: row.CreatedBy,
  };
}

export async function updateVendor(
  id: number,
  input: VendorUpdateInput,
  userId: number
): Promise<VendorRecord | null> {
  const existing = await getVendorById(id);
  if (!existing) return null;
  if (input.vendorCode !== undefined && input.vendorCode !== existing.vendorCode) {
    const req = await getRequest();
    const dup = await req
      .input('code', input.vendorCode)
      .input('id', id)
      .query('SELECT VendorID FROM react_Vendors WHERE VendorCode = @code AND VendorID <> @id AND IsDeleted = 0');
    if (dup.recordset.length > 0) throw new AppError(409, 'Vendor code already exists');
  }
  const req = await getRequest();
  await req
    .input('id', id)
    .input('vendorCode', input.vendorCode ?? existing.vendorCode)
    .input('vendorName', input.vendorName ?? existing.vendorName)
    .input('contactPerson', input.contactPerson !== undefined ? input.contactPerson : existing.contactPerson)
    .input('contactEmail', input.contactEmail !== undefined ? input.contactEmail : existing.contactEmail)
    .input('contactPhone', input.contactPhone !== undefined ? input.contactPhone : existing.contactPhone)
    .input('address', input.address !== undefined ? input.address : existing.address)
    .input('isActive', input.isActive !== undefined ? (input.isActive ? 1 : 0) : (existing.isActive ? 1 : 0))
    .input('updatedBy', userId)
    .query(`
      UPDATE react_Vendors
      SET VendorCode = @vendorCode, VendorName = @vendorName, ContactPerson = @contactPerson,
          ContactEmail = @contactEmail, ContactPhone = @contactPhone, Address = @address, IsActive = @isActive,
          UpdatedAt = GETDATE(), UpdatedBy = @updatedBy
      WHERE VendorID = @id
    `);
  return getVendorById(id);
}

export async function deleteVendor(id: number, userId: number): Promise<boolean> {
  const existing = await getVendorById(id);
  if (!existing) return false;
  const req = await getRequest();
  await req
    .input('id', id)
    .input('updatedBy', userId)
    .query(`
      UPDATE react_Vendors SET IsDeleted = 1, UpdatedAt = GETDATE(), UpdatedBy = @updatedBy WHERE VendorID = @id
    `);
  return true;
}
