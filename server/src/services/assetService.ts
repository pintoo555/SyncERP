/**
 * Asset CRUD, soft delete, status change. Detail includes assignments, tickets, verification, audit.
 */

import { getRequest } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import { updateAssetSearch } from './searchService';
import type { AssetCreateInput, AssetUpdateInput, AssetListQueryInput, AssetChangeStatusInput } from '../validators/assetSchemas';

export interface AssetRecord {
  assetId: number;
  assetTag: string;
  categoryId: number;
  categoryName?: string;
  brandId: number | null;
  brandName?: string | null;
  modelId: number | null;
  modelName?: string | null;
  serialNumber: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  vendorId: number | null;
  vendorName?: string | null;
  warrantyExpiry: string | null;
  amcExpiry: string | null;
  locationId: number | null;
  locationName?: string | null;
  status: string;
  currentAssignedToUserId: number | null;
  assignedToUserName?: string | null;
  description: string | null;
  isDeleted: boolean;
  createdAt: Date;
  createdBy: number | null;
  updatedAt: Date | null;
  updatedBy: number | null;
  tagNames?: string[];
  /** FileID of the primary/thumbnail photo for this asset */
  primaryFileId?: number | null;
}

export interface AssignmentRecord {
  assignmentId: number;
  assetId: number;
  assignedToUserId: number;
  assignedToUserName: string;
  assignedByUserId: number;
  assignedByUserName: string;
  /** Server local YYYY-MM-DD HH:mm:ss (matches DB) */
  assignedAt: string;
  dueReturnDate: string | null;
  returnedAt: string | null;
  returnedByUserName: string | null;
  notes: string | null;
  assignmentType: string;
}

export interface MaintenanceTicketRecord {
  ticketId: number;
  assetId: number;
  ticketNumber: string;
  subject: string;
  status: string;
  reportedAt: Date;
  resolvedAt: Date | null;
  cost: number | null;
}

export interface VerificationRecord {
  verificationId: number;
  assetId: number;
  verifiedAt: Date;
  verifiedByUserName: string;
  locationName: string | null;
  notes: string | null;
  verifiedStatus: string | null;
}

export interface AuditTrailRecord {
  auditId: number;
  eventType: string;
  createdAt: Date;
  userEmail: string | null;
  details: string | null;
}

export interface AssetDetailResult {
  asset: AssetRecord;
  assignmentHistory: AssignmentRecord[];
  maintenanceTickets: MaintenanceTicketRecord[];
  verificationHistory: VerificationRecord[];
  auditTrail: AuditTrailRecord[];
}

function toDateStr(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  return v.toISOString().slice(0, 10);
}

export async function listAssets(query: AssetListQueryInput): Promise<{ data: AssetRecord[]; total: number }> {
  const req = await getRequest();
  const offset = (query.page - 1) * query.pageSize;
  const hasStatus = query.status != null ? 1 : 0;
  const hasCategory = query.categoryId != null ? 1 : 0;
  const hasLocation = query.locationId != null ? 1 : 0;
  const hasAssigned = query.assignedToUserId != null ? 1 : 0;
  const hasSearch = query.search != null && query.search !== '' ? 1 : 0;
  const hasQ = query.q != null && query.q !== '' ? 1 : 0;

  req.input('status', query.status ?? null);
  req.input('categoryId', query.categoryId ?? null);
  req.input('locationId', query.locationId ?? null);
  req.input('assignedToUserId', query.assignedToUserId ?? null);
  req.input('search', query.search ?? null);
  req.input('q', query.q ?? null);
  req.input('hasStatus', hasStatus);
  req.input('hasCategory', hasCategory);
  req.input('hasLocation', hasLocation);
  req.input('hasAssigned', hasAssigned);
  req.input('hasSearch', hasSearch);
  req.input('hasQ', hasQ);
  req.input('offset', offset);
  req.input('pageSize', query.pageSize);

  const result = await req.query(`
    ;WITH CTE AS (
      SELECT a.AssetID, a.AssetTag, a.PrimaryFileID, a.CategoryID, c.CategoryName, a.BrandID, b.BrandName, a.ModelID, m.ModelName,
             a.SerialNumber, CONVERT(NVARCHAR(10), a.PurchaseDate, 120) AS PurchaseDate, a.PurchasePrice,
             a.VendorID, v.VendorName, CONVERT(NVARCHAR(10), a.WarrantyExpiry, 120) AS WarrantyExpiry,
             CONVERT(NVARCHAR(10), a.AMCExpiry, 120) AS AMCExpiry, a.LocationID, l.LocationName,
             a.Status, a.CurrentAssignedToUserID, u2.Name AS AssignedToUserName, a.Description,
             a.IsDeleted, a.CreatedAt, a.CreatedBy, a.UpdatedAt, a.UpdatedBy,
             ROW_NUMBER() OVER (ORDER BY a.CreatedAt DESC) AS rn
      FROM react_Asset a
      LEFT JOIN react_AssetCategory c ON c.CategoryID = a.CategoryID
      LEFT JOIN react_AssetBrand b ON b.BrandID = a.BrandID
      LEFT JOIN react_AssetModel m ON m.ModelID = a.ModelID
      LEFT JOIN react_Vendors v ON v.VendorID = a.VendorID
      LEFT JOIN react_Location l ON l.LocationID = a.LocationID
      LEFT JOIN utbl_Users_Master u2 ON u2.UserId = a.CurrentAssignedToUserID
      WHERE a.IsDeleted = 0
        AND (0 = @hasStatus OR a.Status = @status)
        AND (0 = @hasCategory OR a.CategoryID = @categoryId)
        AND (0 = @hasLocation OR a.LocationID = @locationId)
        AND (0 = @hasAssigned OR a.CurrentAssignedToUserID = @assignedToUserId)
        AND (0 = @hasSearch OR a.AssetTag LIKE '%' + @search + '%' OR a.SerialNumber LIKE '%' + @search + '%')
        AND (0 = @hasQ OR a.AssetID IN (SELECT AssetID FROM react_AssetSearch WHERE SearchText LIKE '%' + @q + '%'))
    )
    SELECT AssetID AS assetId, AssetTag AS assetTag, PrimaryFileID AS primaryFileId, CategoryID AS categoryId, CategoryName AS categoryName,
           BrandID AS brandId, BrandName AS brandName, ModelID AS modelId, ModelName AS modelName,
           SerialNumber AS serialNumber, PurchaseDate AS purchaseDate, PurchasePrice AS purchasePrice,
           VendorID AS vendorId, VendorName AS vendorName, WarrantyExpiry AS warrantyExpiry, AMCExpiry AS amcExpiry,
           LocationID AS locationId, LocationName AS locationName, Status AS status,
           CurrentAssignedToUserID AS currentAssignedToUserId, AssignedToUserName AS assignedToUserName,
           Description AS description, IsDeleted AS isDeleted, CreatedAt AS createdAt, CreatedBy AS createdBy,
           UpdatedAt AS updatedAt, UpdatedBy AS updatedBy
    FROM CTE WHERE rn > @offset AND rn <= @offset + @pageSize;

    SELECT COUNT_BIG(*) AS total FROM react_Asset a
    WHERE a.IsDeleted = 0
      AND (0 = @hasStatus OR a.Status = @status)
      AND (0 = @hasCategory OR a.CategoryID = @categoryId)
      AND (0 = @hasLocation OR a.LocationID = @locationId)
      AND (0 = @hasAssigned OR a.CurrentAssignedToUserID = @assignedToUserId)
      AND (0 = @hasSearch OR a.AssetTag LIKE '%' + @search + '%' OR a.SerialNumber LIKE '%' + @search + '%')
      AND (0 = @hasQ OR a.AssetID IN (SELECT AssetID FROM react_AssetSearch WHERE SearchText LIKE '%' + @q + '%'));
  `);

  const data = (result.recordset || []) as AssetRecord[];
  const recordsets = result.recordsets as unknown[] | undefined;
  const totalSet = recordsets && recordsets[1];
  const total = (Array.isArray(totalSet) && (totalSet[0] as { total?: number })?.total != null)
    ? (totalSet[0] as { total: number }).total
    : 0;
  return { data, total };
}

export async function getAssetById(id: number, includeTabs: boolean = true): Promise<AssetDetailResult | null> {
  const req = await getRequest();
  const assetResult = await req.input('id', id).query(`
    SELECT a.AssetID AS assetId, a.AssetTag AS assetTag, a.PrimaryFileID AS primaryFileId, a.CategoryID AS categoryId, c.CategoryName AS categoryName,
           a.BrandID AS brandId, b.BrandName AS brandName, a.ModelID AS modelId, m.ModelName AS modelName,
           a.SerialNumber AS serialNumber, CONVERT(NVARCHAR(10), a.PurchaseDate, 120) AS purchaseDate, a.PurchasePrice AS purchasePrice,
           a.VendorID AS vendorId, v.VendorName AS vendorName, CONVERT(NVARCHAR(10), a.WarrantyExpiry, 120) AS warrantyExpiry,
           CONVERT(NVARCHAR(10), a.AMCExpiry, 120) AS amcExpiry, a.LocationID AS locationId, l.LocationName AS locationName,
           a.Status AS status, a.CurrentAssignedToUserID AS currentAssignedToUserId, u2.Name AS assignedToUserName,
           a.Description AS description, a.IsDeleted AS isDeleted, a.CreatedAt AS createdAt, a.CreatedBy AS createdBy,
           a.UpdatedAt AS updatedAt, a.UpdatedBy AS updatedBy
    FROM react_Asset a
    LEFT JOIN react_AssetCategory c ON c.CategoryID = a.CategoryID
    LEFT JOIN react_AssetBrand b ON b.BrandID = a.BrandID
    LEFT JOIN react_AssetModel m ON m.ModelID = a.ModelID
    LEFT JOIN react_Vendors v ON v.VendorID = a.VendorID
    LEFT JOIN react_Location l ON l.LocationID = a.LocationID
    LEFT JOIN utbl_Users_Master u2 ON u2.UserId = a.CurrentAssignedToUserID
    WHERE a.AssetID = @id
  `);
  const assetRow = assetResult.recordset[0] as AssetRecord | undefined;
  if (!assetRow) return null;

  const reqTags = await getRequest();
  const tagResult = await reqTags.input('id', id).query(`
    SELECT TagName AS tagName FROM react_AssetTags WHERE AssetID = @id
  `);
  assetRow.tagNames = (tagResult.recordset as { tagName: string }[]).map(r => r.tagName);

  if (!includeTabs) {
    return { asset: assetRow, assignmentHistory: [], maintenanceTickets: [], verificationHistory: [], auditTrail: [] };
  }

  const [assignResult, ticketsResult, verifyResult, auditResult] = await Promise.all([
    (async () => { const r = await getRequest(); return r.input('id', id).query(`
      SELECT aa.AssignmentID AS assignmentId, aa.AssetID AS assetId, aa.AssignedToUserID AS assignedToUserId, u1.Name AS assignedToUserName,
             aa.AssignedByUserID AS assignedByUserId, u3.Name AS assignedByUserName, CONVERT(NVARCHAR(19), aa.AssignedAt, 120) AS assignedAt,
             CONVERT(NVARCHAR(10), aa.DueReturnDate, 120) AS dueReturnDate, CONVERT(NVARCHAR(19), aa.ReturnedAt, 120) AS returnedAt, u4.Name AS returnedByUserName,
             aa.Notes AS notes, aa.AssignmentType AS assignmentType
      FROM react_AssetAssignment aa
      INNER JOIN utbl_Users_Master u1 ON u1.UserId = aa.AssignedToUserID
      INNER JOIN utbl_Users_Master u3 ON u3.UserId = aa.AssignedByUserID
      LEFT JOIN utbl_Users_Master u4 ON u4.UserId = aa.ReturnedByUserID
      WHERE aa.AssetID = @id ORDER BY aa.AssignedAt DESC
    `); })(),
    (async () => { const r = await getRequest(); return r.input('id', id).query(`
      SELECT TicketID AS ticketId, AssetID AS assetId, TicketNumber AS ticketNumber, Subject AS subject, Status AS status,
             ReportedAt AS reportedAt, ResolvedAt AS resolvedAt, Cost AS cost
      FROM react_AssetMaintenanceTicket WHERE AssetID = @id AND IsDeleted = 0 ORDER BY ReportedAt DESC
    `); })(),
    (async () => { const r = await getRequest(); return r.input('id', id).query(`
      SELECT av.VerificationID AS verificationId, av.AssetID AS assetId, av.VerifiedAt AS verifiedAt, u.Name AS verifiedByUserName,
             l.LocationName AS locationName, av.Notes AS notes, av.VerifiedStatus AS verifiedStatus
      FROM react_AssetVerification av
      INNER JOIN utbl_Users_Master u ON u.UserId = av.VerifiedByUserID
      LEFT JOIN react_Location l ON l.LocationID = av.LocationID
      WHERE av.AssetID = @id ORDER BY av.VerifiedAt DESC
    `); })(),
    (async () => { const r = await getRequest(); return r.input('id', id).input('entityType', 'asset').query(`
      SELECT AuditID AS auditId, EventType AS eventType, CreatedAt AS createdAt, UserEmail AS userEmail, Details AS details
      FROM react_AuditLog WHERE EntityType = @entityType AND EntityID = CAST(@id AS NVARCHAR(100)) ORDER BY CreatedAt DESC
    `); })(),
  ]);

  const assignmentHistory = (assignResult.recordset || []) as AssignmentRecord[];
  const maintenanceTickets = (ticketsResult.recordset || []) as MaintenanceTicketRecord[];
  const verificationHistory = (verifyResult.recordset || []) as VerificationRecord[];
  const auditTrail = (auditResult.recordset || []) as AuditTrailRecord[];

  return {
    asset: assetRow,
    assignmentHistory,
    maintenanceTickets,
    verificationHistory,
    auditTrail,
  };
}

export async function createAsset(input: AssetCreateInput, userId: number): Promise<AssetRecord> {
  const req = await getRequest();
  const existing = await req.input('tag', input.assetTag).query(`
    SELECT AssetID FROM react_Asset WHERE AssetTag = @tag AND IsDeleted = 0
  `);
  if (existing.recordset.length > 0) throw new AppError(409, 'Asset tag already exists');

  await validateAssetRefs({
    categoryId: input.categoryId,
    brandId: input.brandId ?? null,
    modelId: input.modelId ?? null,
    vendorId: input.vendorId ?? null,
    locationId: input.locationId ?? null,
  });

  const result = await req
    .input('assetTag', input.assetTag)
    .input('categoryId', input.categoryId)
    .input('brandId', input.brandId ?? null)
    .input('modelId', input.modelId ?? null)
    .input('serialNumber', input.serialNumber ?? null)
    .input('purchaseDate', toDateStr(input.purchaseDate as string | Date | null))
    .input('purchasePrice', input.purchasePrice ?? null)
    .input('vendorId', input.vendorId ?? null)
    .input('warrantyExpiry', toDateStr(input.warrantyExpiry as string | Date | null))
    .input('amcExpiry', toDateStr(input.amcExpiry as string | Date | null))
    .input('locationId', input.locationId ?? null)
    .input('description', input.description ?? null)
    .input('createdBy', userId)
    .query(`
      INSERT INTO react_Asset (AssetTag, CategoryID, BrandID, ModelID, SerialNumber, PurchaseDate, PurchasePrice, VendorID, WarrantyExpiry, AMCExpiry, LocationID, Description, CreatedBy)
      OUTPUT INSERTED.AssetID
      VALUES (@assetTag, @categoryId, @brandId, @modelId, @serialNumber, @purchaseDate, @purchasePrice, @vendorId, @warrantyExpiry, @amcExpiry, @locationId, @description, @createdBy)
    `);
  const assetId = (result.recordset[0] as { AssetID: number }).AssetID;

  if (input.tagNames && input.tagNames.length > 0) {
    for (const tag of input.tagNames) {
      const reqTag = await getRequest();
      await reqTag.input('assetId', assetId).input('tagName', tag).input('createdBy', userId).query(`
        INSERT INTO react_AssetTags (AssetID, TagName, CreatedBy) VALUES (@assetId, @tagName, @createdBy)
      `);
    }
  }

  await updateAssetSearch(assetId).catch(() => {});
  const detail = await getAssetById(assetId, false);
  return detail!.asset;
}

async function validateAssetRefs(
  refs: { categoryId: number; brandId: number | null; modelId: number | null; vendorId: number | null; locationId: number | null }
) {
  const req = await getRequest();
  if (refs.categoryId) {
    const r = await req.input('id', refs.categoryId).query('SELECT CategoryID FROM react_AssetCategory WHERE CategoryID = @id AND IsDeleted = 0');
    if (r.recordset.length === 0) throw new AppError(400, 'Category not found');
  }
  if (refs.brandId) {
    const req2 = await getRequest();
    const r = await req2.input('id', refs.brandId).query('SELECT BrandID FROM react_AssetBrand WHERE BrandID = @id AND IsDeleted = 0');
    if (r.recordset.length === 0) throw new AppError(400, 'Brand not found');
  }
  if (refs.modelId) {
    const req2 = await getRequest();
    const r = await req2.input('id', refs.modelId).query('SELECT ModelID FROM react_AssetModel WHERE ModelID = @id AND IsDeleted = 0');
    if (r.recordset.length === 0) throw new AppError(400, 'Model not found');
  }
  if (refs.vendorId) {
    const req2 = await getRequest();
    const r = await req2.input('id', refs.vendorId).query('SELECT VendorID FROM react_Vendors WHERE VendorID = @id AND IsDeleted = 0');
    if (r.recordset.length === 0) throw new AppError(400, 'Vendor not found');
  }
  if (refs.locationId) {
    const req2 = await getRequest();
    const r = await req2.input('id', refs.locationId).query('SELECT LocationID FROM react_Location WHERE LocationID = @id AND IsDeleted = 0');
    if (r.recordset.length === 0) throw new AppError(400, 'Location not found');
  }
}

export async function updateAsset(id: number, input: AssetUpdateInput, userId: number): Promise<AssetRecord | null> {
  const existing = await getAssetById(id, false);
  if (!existing) return null;

  const req = await getRequest();
  if (input.assetTag !== undefined && input.assetTag !== existing.asset.assetTag) {
    const dup = await req.input('tag', input.assetTag).input('id', id).query(`
      SELECT AssetID FROM react_Asset WHERE AssetTag = @tag AND AssetID <> @id AND IsDeleted = 0
    `);
    if (dup.recordset.length > 0) throw new AppError(409, 'Asset tag already exists');
  }

  await validateAssetRefs({
    categoryId: input.categoryId ?? existing.asset.categoryId,
    brandId: input.brandId !== undefined ? input.brandId : existing.asset.brandId,
    modelId: input.modelId !== undefined ? input.modelId : existing.asset.modelId,
    vendorId: input.vendorId !== undefined ? input.vendorId : existing.asset.vendorId,
    locationId: input.locationId !== undefined ? input.locationId : existing.asset.locationId,
  });

  await req
    .input('id', id)
    .input('assetTag', input.assetTag ?? existing.asset.assetTag)
    .input('categoryId', input.categoryId ?? existing.asset.categoryId)
    .input('brandId', input.brandId !== undefined ? input.brandId : existing.asset.brandId)
    .input('modelId', input.modelId !== undefined ? input.modelId : existing.asset.modelId)
    .input('serialNumber', input.serialNumber !== undefined ? input.serialNumber : existing.asset.serialNumber)
    .input('purchaseDate', input.purchaseDate !== undefined ? toDateStr(input.purchaseDate as string | Date | null) : existing.asset.purchaseDate)
    .input('purchasePrice', input.purchasePrice !== undefined ? input.purchasePrice : existing.asset.purchasePrice)
    .input('vendorId', input.vendorId !== undefined ? input.vendorId : existing.asset.vendorId)
    .input('warrantyExpiry', input.warrantyExpiry !== undefined ? toDateStr(input.warrantyExpiry as string | Date | null) : existing.asset.warrantyExpiry)
    .input('amcExpiry', input.amcExpiry !== undefined ? toDateStr(input.amcExpiry as string | Date | null) : existing.asset.amcExpiry)
    .input('locationId', input.locationId !== undefined ? input.locationId : existing.asset.locationId)
    .input('description', input.description !== undefined ? input.description : existing.asset.description)
    .input('updatedBy', userId)
    .query(`
      UPDATE react_Asset SET AssetTag = @assetTag, CategoryID = @categoryId, BrandID = @brandId, ModelID = @modelId,
        SerialNumber = @serialNumber, PurchaseDate = @purchaseDate, PurchasePrice = @purchasePrice, VendorID = @vendorId,
        WarrantyExpiry = @warrantyExpiry, AMCExpiry = @amcExpiry, LocationID = @locationId, Description = @description,
        UpdatedAt = GETDATE(), UpdatedBy = @updatedBy
      WHERE AssetID = @id
    `);

  if (input.tagNames !== undefined) {
    await req.input('assetId', id).query('DELETE FROM react_AssetTags WHERE AssetID = @assetId');
    for (const tag of input.tagNames) {
      await req.input('assetId', id).input('tagName', tag).input('createdBy', userId).query(`
        INSERT INTO react_AssetTags (AssetID, TagName, CreatedBy) VALUES (@assetId, @tagName, @createdBy)
      `);
    }
  }

  await updateAssetSearch(id).catch(() => {});
  const updated = await getAssetById(id, false);
  return updated?.asset ?? null;
}

export async function deleteAsset(id: number, userId: number): Promise<boolean> {
  const existing = await getAssetById(id, false);
  if (!existing) return false;
  const req = await getRequest();
  await req
    .input('id', id)
    .input('userId', userId)
    .query(`
      UPDATE react_Asset SET IsDeleted = 1, DeletedAt = GETDATE(), DeletedBy = @userId, UpdatedAt = GETDATE(), UpdatedBy = @userId WHERE AssetID = @id
    `);
  return true;
}

export async function changeAssetStatus(id: number, input: AssetChangeStatusInput, userId: number): Promise<AssetRecord | null> {
  const existing = await getAssetById(id, false);
  if (!existing) return null;
  const req = await getRequest();
  // When setting to AVAILABLE, clear assignment so the asset can be issued again
  const clearAssignment = input.status === 'AVAILABLE';
  await req
    .input('id', id)
    .input('status', input.status)
    .input('updatedBy', userId)
    .input('clearAssignment', clearAssignment ? 1 : 0)
    .query(`
      UPDATE react_Asset
      SET Status = @status,
          UpdatedAt = GETDATE(),
          UpdatedBy = @updatedBy,
          CurrentAssignedToUserID = CASE WHEN @clearAssignment = 1 THEN NULL ELSE CurrentAssignedToUserID END
      WHERE AssetID = @id
    `);
  const updated = await getAssetById(id, false);
  return updated?.asset ?? null;
}

/** Set the primary/thumbnail photo for an asset. File must be attached to this asset. */
export async function setPrimaryPhoto(assetId: number, fileId: number, _userId: number): Promise<AssetRecord | null> {
  const existing = await getAssetById(assetId, false);
  if (!existing) return null;
  const reqCheck = await getRequest();
  const link = await reqCheck
    .input('assetId', assetId)
    .input('fileId', fileId)
    .query(`
      SELECT 1 FROM react_AssetFiles WHERE AssetID = @assetId AND FileID = @fileId
    `);
  if (link.recordset.length === 0) throw new AppError(400, 'File is not attached to this asset');
  const req = await getRequest();
  await req
    .input('assetId', assetId)
    .input('fileId', fileId)
    .query(`
      UPDATE react_Asset SET PrimaryFileID = @fileId, UpdatedAt = GETDATE() WHERE AssetID = @assetId
    `);
  const updated = await getAssetById(assetId, false);
  return updated?.asset ?? null;
}
