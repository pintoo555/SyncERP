/**
 * Maintenance tickets: CRUD, close (resolve), soft delete.
 */

import { getRequest } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import type { TicketCreateInput, TicketUpdateInput, TicketCloseInput, TicketListQueryInput } from '../validators/ticketSchemas';
import crypto from 'crypto';

export interface TicketRecord {
  ticketId: number;
  assetId: number;
  assetTag: string;
  ticketNumber: string;
  subject: string;
  description: string | null;
  status: string;
  vendorId: number | null;
  vendorName: string | null;
  reportedByUserId: number | null;
  reportedByUserName: string | null;
  reportedAt: Date;
  resolvedAt: Date | null;
  resolutionNotes: string | null;
  cost: number | null;
  isDeleted: boolean;
  createdAt: Date;
  createdBy: number | null;
}

function generateTicketNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const r = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `TKT-${ts}-${r}`;
}

export async function listTickets(query: TicketListQueryInput): Promise<{ data: TicketRecord[]; total: number }> {
  const req = await getRequest();
  const offset = (query.page - 1) * query.pageSize;
  const hasAsset = query.assetId != null ? 1 : 0;
  const hasStatus = query.status != null && query.status !== '' ? 1 : 0;

  req.input('assetId', query.assetId ?? null);
  req.input('status', query.status ?? null);
  req.input('hasAsset', hasAsset);
  req.input('hasStatus', hasStatus);
  req.input('offset', offset);
  req.input('pageSize', query.pageSize);

  const result = await req.query(`
    ;WITH CTE AS (
      SELECT t.TicketID, t.AssetID, a.AssetTag, t.TicketNumber, t.Subject, t.Description, t.Status,
             t.VendorID, v.VendorName, t.ReportedByUserID, u.Name AS ReportedByUserName, t.ReportedAt,
             t.ResolvedAt, t.ResolutionNotes, t.Cost, t.IsDeleted, t.CreatedAt, t.CreatedBy,
             ROW_NUMBER() OVER (ORDER BY t.ReportedAt DESC) AS rn
      FROM react_AssetMaintenanceTicket t
      INNER JOIN react_Asset a ON a.AssetID = t.AssetID
      LEFT JOIN react_Vendors v ON v.VendorID = t.VendorID
      LEFT JOIN rb_users u ON u.userid = t.ReportedByUserID
      WHERE t.IsDeleted = 0
        AND (0 = @hasAsset OR t.AssetID = @assetId)
        AND (0 = @hasStatus OR t.Status = @status)
    )
    SELECT TicketID AS ticketId, AssetID AS assetId, AssetTag AS assetTag, TicketNumber AS ticketNumber,
           Subject AS subject, Description AS description, Status AS status, VendorID AS vendorId, VendorName AS vendorName,
           ReportedByUserID AS reportedByUserId, ReportedByUserName AS reportedByUserName, ReportedAt AS reportedAt,
           ResolvedAt AS resolvedAt, ResolutionNotes AS resolutionNotes, Cost AS cost, IsDeleted AS isDeleted,
           CreatedAt AS createdAt, CreatedBy AS createdBy
    FROM CTE WHERE rn > @offset AND rn <= @offset + @pageSize
  `);

  const countReq = await getRequest();
  countReq.input('assetId', query.assetId ?? null);
  countReq.input('status', query.status ?? null);
  countReq.input('hasAsset', hasAsset);
  countReq.input('hasStatus', hasStatus);
  const countResult = await countReq.query(`
    SELECT COUNT_BIG(*) AS total FROM react_AssetMaintenanceTicket t
    WHERE t.IsDeleted = 0
      AND (0 = @hasAsset OR t.AssetID = @assetId)
      AND (0 = @hasStatus OR t.Status = @status)
  `);

  const data = (result.recordset || []) as TicketRecord[];
  const totalSet = countResult.recordset?.[0] as { total: number } | undefined;
  const total = totalSet?.total ?? 0;
  return { data, total };
}

export async function getTicketById(ticketId: number): Promise<TicketRecord | null> {
  const req = await getRequest();
  const result = await req.input('ticketId', ticketId).query(`
    SELECT t.TicketID AS ticketId, t.AssetID AS assetId, a.AssetTag AS assetTag, t.TicketNumber AS ticketNumber,
           t.Subject AS subject, t.Description AS description, t.Status AS status, t.VendorID AS vendorId, v.VendorName AS vendorName,
           t.ReportedByUserID AS reportedByUserId, u.Name AS reportedByUserName, t.ReportedAt AS reportedAt,
           t.ResolvedAt AS resolvedAt, t.ResolutionNotes AS resolutionNotes, t.Cost AS cost, t.IsDeleted AS isDeleted,
           t.CreatedAt AS createdAt, t.CreatedBy AS createdBy
    FROM react_AssetMaintenanceTicket t
    INNER JOIN react_Asset a ON a.AssetID = t.AssetID
    LEFT JOIN react_Vendors v ON v.VendorID = t.VendorID
    LEFT JOIN rb_users u ON u.userid = t.ReportedByUserID
    WHERE t.TicketID = @ticketId
  `);
  const row = result.recordset[0] as TicketRecord | undefined;
  return row ?? null;
}

export async function createTicket(input: TicketCreateInput, userId: number): Promise<TicketRecord> {
  const req = await getRequest();
  const assetCheck = await req.input('assetId', input.assetId).query(`
    SELECT AssetID FROM react_Asset WHERE AssetID = @assetId AND IsDeleted = 0
  `);
  if (assetCheck.recordset.length === 0) throw new AppError(400, 'Asset not found');
  if (input.vendorId != null) {
    const vReq = await getRequest();
    const vCheck = await vReq.input('vendorId', input.vendorId).query(`
      SELECT VendorID FROM react_Vendors WHERE VendorID = @vendorId AND IsDeleted = 0
    `);
    if (vCheck.recordset.length === 0) throw new AppError(400, 'Vendor not found');
  }
  const ticketNumber = generateTicketNumber();
  const reportedBy = input.reportedByUserId ?? userId;
  const insertReq = await getRequest();
  const result = await insertReq
    .input('assetId', input.assetId)
    .input('ticketNumber', ticketNumber)
    .input('subject', input.subject)
    .input('description', input.description ?? null)
    .input('vendorId', input.vendorId ?? null)
    .input('reportedByUserId', reportedBy)
    .input('createdBy', userId)
    .query(`
      INSERT INTO react_AssetMaintenanceTicket (AssetID, TicketNumber, Subject, Description, VendorID, ReportedByUserID, CreatedBy)
      OUTPUT INSERTED.TicketID
      VALUES (@assetId, @ticketNumber, @subject, @description, @vendorId, @reportedByUserId, @createdBy)
    `);
  const ticketId = (result.recordset[0] as { TicketID: number }).TicketID;
  const ticket = await getTicketById(ticketId);
  if (!ticket) throw new AppError(500, 'Failed to load ticket');
  return ticket;
}

const RESOLVED_STATUSES = ['RESOLVED', 'CLOSED'];
const OPEN_STATUSES = ['OPEN', 'IN_PROGRESS', 'ON_HOLD'];

export async function updateTicket(ticketId: number, input: TicketUpdateInput, userId: number): Promise<TicketRecord | null> {
  const existing = await getTicketById(ticketId);
  if (!existing) return null;
  const newStatus = input.status ?? existing.status;
  const isReopening = existing.resolvedAt && OPEN_STATUSES.includes(newStatus);
  if (existing.resolvedAt && !isReopening) throw new AppError(400, 'Cannot edit a resolved ticket');

  const req = await getRequest();
  await req
    .input('ticketId', ticketId)
    .input('subject', input.subject ?? existing.subject)
    .input('description', input.description !== undefined ? input.description : existing.description)
    .input('vendorId', input.vendorId !== undefined ? input.vendorId : existing.vendorId)
    .input('status', newStatus)
    .input('updatedBy', userId)
    .query(`
      UPDATE react_AssetMaintenanceTicket
      SET Subject = @subject, Description = @description, VendorID = @vendorId, Status = @status,
          ResolvedAt = CASE
            WHEN @status IN ('RESOLVED', 'CLOSED') THEN GETDATE()
            WHEN @status IN ('OPEN', 'IN_PROGRESS', 'ON_HOLD') THEN NULL
            ELSE ResolvedAt
          END,
          UpdatedAt = GETDATE(), UpdatedBy = @updatedBy
      WHERE TicketID = @ticketId
    `);
  return getTicketById(ticketId);
}

export async function closeTicket(ticketId: number, input: TicketCloseInput, userId: number): Promise<TicketRecord | null> {
  const existing = await getTicketById(ticketId);
  if (!existing) return null;
  if (existing.resolvedAt) throw new AppError(400, 'Ticket already closed');

  const req = await getRequest();
  await req
    .input('ticketId', ticketId)
    .input('resolutionNotes', input.resolutionNotes ?? null)
    .input('cost', input.cost ?? null)
    .input('updatedBy', userId)
    .query(`
      UPDATE react_AssetMaintenanceTicket
      SET Status = 'CLOSED', ResolvedAt = GETDATE(), ResolutionNotes = @resolutionNotes, Cost = @cost, UpdatedAt = GETDATE(), UpdatedBy = @updatedBy
      WHERE TicketID = @ticketId
    `);
  return getTicketById(ticketId);
}

export async function deleteTicket(ticketId: number, userId: number): Promise<boolean> {
  const existing = await getTicketById(ticketId);
  if (!existing) return false;
  const req = await getRequest();
  await req
    .input('ticketId', ticketId)
    .input('updatedBy', userId)
    .query(`
      UPDATE react_AssetMaintenanceTicket SET IsDeleted = 1, UpdatedAt = GETDATE(), UpdatedBy = @updatedBy WHERE TicketID = @ticketId
    `);
  return true;
}
