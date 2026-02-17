/**
 * Assignments: issue, return, transfer. Updates asset ownership and status. Uses transactions.
 */

import sql from 'mssql';
import { getPool, getRequest } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import type { IssueInput, ReturnInput, TransferInput } from '../validators/assignmentSchemas';

export interface AssignmentRecord {
  assignmentId: number;
  assetId: number;
  assetTag: string;
  assignedToUserId: number;
  assignedToUserName: string;
  assignedByUserId: number;
  assignedByUserName: string;
  /** Server local time, format YYYY-MM-DD HH:mm:ss (matches DB display) */
  assignedAt: string;
  dueReturnDate: string | null;
  /** Server local time when returned, or null (matches DB display) */
  returnedAt: string | null;
  returnedByUserName: string | null;
  notes: string | null;
  assignmentType: string;
}

function toDateStr(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  return v.toISOString().slice(0, 10);
}

export async function issueAsset(input: IssueInput, assignedByUserId: number): Promise<AssignmentRecord> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const req1 = new sql.Request(transaction);
    const assetResult = await req1.input('assetId', input.assetId).query(`
      SELECT AssetID, AssetTag, Status, CurrentAssignedToUserID FROM react_Asset WHERE AssetID = @assetId AND IsDeleted = 0
    `);
    const asset = assetResult.recordset[0] as { AssetID: number; AssetTag: string; Status: string; CurrentAssignedToUserID: number | null } | undefined;
    if (!asset) throw new AppError(404, 'Asset not found');
    if (asset.Status !== 'AVAILABLE') throw new AppError(400, 'Asset is not available for assignment');
    if (asset.CurrentAssignedToUserID != null) throw new AppError(400, 'Asset is already assigned');

    const req2 = new sql.Request(transaction);
    const userCheck = await req2.input('userId', input.assignedToUserId).query('SELECT userid FROM rb_users WHERE userid = @userId');
    if (userCheck.recordset.length === 0) throw new AppError(400, 'Assigned-to user not found');

    const req3 = new sql.Request(transaction);
    const insertResult = await req3
      .input('assetId', input.assetId)
      .input('assignedToUserId', input.assignedToUserId)
      .input('assignedByUserId', assignedByUserId)
      .input('dueReturnDate', toDateStr(input.dueReturnDate as string | Date | null))
      .input('notes', input.notes ?? null)
      .input('assignmentType', 'ISSUE')
      .query(`
        INSERT INTO react_AssetAssignment (AssetID, AssignedToUserID, AssignedByUserID, DueReturnDate, Notes, AssignmentType)
        OUTPUT INSERTED.AssignmentID, INSERTED.AssetID, INSERTED.AssignedToUserID, INSERTED.AssignedByUserID, INSERTED.AssignedAt, INSERTED.DueReturnDate, INSERTED.Notes, INSERTED.AssignmentType
        VALUES (@assetId, @assignedToUserId, @assignedByUserId, @dueReturnDate, @notes, @assignmentType)
      `);
    const row = insertResult.recordset[0] as { AssignmentID: number; AssetID: number; AssignedToUserID: number; AssignedByUserID: number; AssignedAt: Date; DueReturnDate: string | null; Notes: string | null; AssignmentType: string };

    const req4 = new sql.Request(transaction);
    await req4
      .input('assetId', input.assetId)
      .input('userId', input.assignedToUserId)
      .query(`
        UPDATE react_Asset SET Status = 'ISSUED', CurrentAssignedToUserID = @userId, UpdatedAt = GETDATE() WHERE AssetID = @assetId
      `);

    await transaction.commit();

    const detail = await getAssignmentById(row.AssignmentID);
    if (!detail) throw new AppError(500, 'Failed to load assignment');
    return detail;
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}

export async function returnAsset(input: ReturnInput, returnedByUserId: number): Promise<AssignmentRecord | null> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const req1 = new sql.Request(transaction);
    const assignResult = await req1.input('assignmentId', input.assignmentId).query(`
      SELECT AssignmentID, AssetID, AssignedToUserID, ReturnedAt FROM react_AssetAssignment WHERE AssignmentID = @assignmentId
    `);
    const assign = assignResult.recordset[0] as { AssignmentID: number; AssetID: number; AssignedToUserID: number; ReturnedAt: Date | null } | undefined;
    if (!assign) {
      await transaction.rollback();
      return null;
    }
    if (assign.ReturnedAt != null) {
      await transaction.rollback();
      throw new AppError(400, 'Assignment already returned');
    }

    const req2 = new sql.Request(transaction);
    await req2
      .input('assignmentId', input.assignmentId)
      .input('returnedByUserId', returnedByUserId)
      .input('notes', input.notes ?? null)
      .query(`
        UPDATE react_AssetAssignment SET ReturnedAt = GETDATE(), ReturnedByUserID = @returnedByUserId, Notes = ISNULL(@notes, Notes) WHERE AssignmentID = @assignmentId
      `);

    const req3 = new sql.Request(transaction);
    await req3
      .input('assetId', assign.AssetID)
      .query(`
        UPDATE react_Asset SET Status = 'AVAILABLE', CurrentAssignedToUserID = NULL, UpdatedAt = GETDATE() WHERE AssetID = @assetId
      `);

    await transaction.commit();

    return getAssignmentById(input.assignmentId);
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}

export async function transferAsset(input: TransferInput, transferredByUserId: number): Promise<AssignmentRecord> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const req1 = new sql.Request(transaction);
    const assetResult = await req1.input('assetId', input.assetId).query(`
      SELECT AssetID, AssetTag, Status, CurrentAssignedToUserID FROM react_Asset WHERE AssetID = @assetId AND IsDeleted = 0
    `);
    const asset = assetResult.recordset[0] as { AssetID: number; AssetTag: string; Status: string; CurrentAssignedToUserID: number | null } | undefined;
    if (!asset) throw new AppError(404, 'Asset not found');
    if (asset.CurrentAssignedToUserID !== input.fromUserId) throw new AppError(400, 'Asset is not currently assigned to the specified user');

    const req2 = new sql.Request(transaction);
    const toUserCheck = await req2.input('userId', input.toUserId).query('SELECT userid FROM rb_users WHERE userid = @userId');
    if (toUserCheck.recordset.length === 0) throw new AppError(400, 'Transfer-to user not found');

    const req3 = new sql.Request(transaction);
    const openAssignResult = await req3
      .input('assetId', input.assetId)
      .input('assignedToUserId', input.fromUserId)
      .query(`
        SELECT TOP 1 AssignmentID FROM react_AssetAssignment WHERE AssetID = @assetId AND AssignedToUserID = @assignedToUserId AND ReturnedAt IS NULL ORDER BY AssignedAt DESC
      `);
    const openAssign = openAssignResult.recordset[0] as { AssignmentID: number } | undefined;
    if (openAssign) {
      const req4 = new sql.Request(transaction);
      await req4
        .input('assignmentId', openAssign.AssignmentID)
        .input('returnedByUserId', transferredByUserId)
        .query(`
          UPDATE react_AssetAssignment SET ReturnedAt = GETDATE(), ReturnedByUserID = @returnedByUserId WHERE AssignmentID = @assignmentId
        `);
    }

    const req5 = new sql.Request(transaction);
    const insertResult = await req5
      .input('assetId', input.assetId)
      .input('assignedToUserId', input.toUserId)
      .input('assignedByUserId', transferredByUserId)
      .input('dueReturnDate', toDateStr(input.dueReturnDate as string | Date | null))
      .input('notes', input.notes ?? null)
      .input('assignmentType', 'TRANSFER')
      .query(`
        INSERT INTO react_AssetAssignment (AssetID, AssignedToUserID, AssignedByUserID, DueReturnDate, Notes, AssignmentType)
        OUTPUT INSERTED.AssignmentID
        VALUES (@assetId, @assignedToUserId, @assignedByUserId, @dueReturnDate, @notes, @assignmentType)
      `);
    const newId = (insertResult.recordset[0] as { AssignmentID: number }).AssignmentID;

    const req6 = new sql.Request(transaction);
    await req6
      .input('assetId', input.assetId)
      .input('userId', input.toUserId)
      .query(`
        UPDATE react_Asset SET CurrentAssignedToUserID = @userId, UpdatedAt = GETDATE() WHERE AssetID = @assetId
      `);

    await transaction.commit();

    const detail = await getAssignmentById(newId);
    if (!detail) throw new AppError(500, 'Failed to load assignment');
    return detail;
  } catch (e) {
    await transaction.rollback();
    throw e;
  }
}

export async function getAssignmentById(assignmentId: number): Promise<AssignmentRecord | null> {
  const req = await getRequest();
  const result = await req.input('assignmentId', assignmentId).query(`
    SELECT aa.AssignmentID AS assignmentId, aa.AssetID AS assetId, a.AssetTag AS assetTag,
           aa.AssignedToUserID AS assignedToUserId, u1.Name AS assignedToUserName,
           aa.AssignedByUserID AS assignedByUserId, u2.Name AS assignedByUserName,
           CONVERT(NVARCHAR(19), aa.AssignedAt, 120) AS assignedAt, CONVERT(NVARCHAR(10), aa.DueReturnDate, 120) AS dueReturnDate,
           CONVERT(NVARCHAR(19), aa.ReturnedAt, 120) AS returnedAt, u3.Name AS returnedByUserName, aa.Notes AS notes, aa.AssignmentType AS assignmentType
    FROM react_AssetAssignment aa
    INNER JOIN react_Asset a ON a.AssetID = aa.AssetID
    INNER JOIN rb_users u1 ON u1.userid = aa.AssignedToUserID
    INNER JOIN rb_users u2 ON u2.userid = aa.AssignedByUserID
    LEFT JOIN rb_users u3 ON u3.userid = aa.ReturnedByUserID
    WHERE aa.AssignmentID = @assignmentId
  `);
  const row = result.recordset[0] as AssignmentRecord | undefined;
  return row ?? null;
}

export async function getAssignmentHistoryByAssetId(assetId: number): Promise<AssignmentRecord[]> {
  const req = await getRequest();
  const result = await req.input('assetId', assetId).query(`
    SELECT aa.AssignmentID AS assignmentId, aa.AssetID AS assetId, a.AssetTag AS assetTag,
           aa.AssignedToUserID AS assignedToUserId, u1.Name AS assignedToUserName,
           aa.AssignedByUserID AS assignedByUserId, u2.Name AS assignedByUserName,
           CONVERT(NVARCHAR(19), aa.AssignedAt, 120) AS assignedAt, CONVERT(NVARCHAR(10), aa.DueReturnDate, 120) AS dueReturnDate,
           CONVERT(NVARCHAR(19), aa.ReturnedAt, 120) AS returnedAt, u3.Name AS returnedByUserName, aa.Notes AS notes, aa.AssignmentType AS assignmentType
    FROM react_AssetAssignment aa
    INNER JOIN react_Asset a ON a.AssetID = aa.AssetID
    INNER JOIN rb_users u1 ON u1.userid = aa.AssignedToUserID
    INNER JOIN rb_users u2 ON u2.userid = aa.AssignedByUserID
    LEFT JOIN rb_users u3 ON u3.userid = aa.ReturnedByUserID
    WHERE aa.AssetID = @assetId ORDER BY aa.AssignedAt DESC
  `);
  return (result.recordset || []) as AssignmentRecord[];
}

/** Assignment history for a user (all assets issued to them, issued/returned). For admin trace. */
export interface UserAssignmentHistoryRow extends AssignmentRecord {
  categoryName: string | null;
}

export async function getAssignmentHistoryByUserId(userId: number): Promise<UserAssignmentHistoryRow[]> {
  const req = await getRequest();
  const result = await req.input('userId', userId).query(`
    SELECT aa.AssignmentID AS assignmentId, aa.AssetID AS assetId, a.AssetTag AS assetTag,
           c.CategoryName AS categoryName,
           aa.AssignedToUserID AS assignedToUserId, u1.Name AS assignedToUserName,
           aa.AssignedByUserID AS assignedByUserId, u2.Name AS assignedByUserName,
           CONVERT(NVARCHAR(19), aa.AssignedAt, 120) AS assignedAt, CONVERT(NVARCHAR(10), aa.DueReturnDate, 120) AS dueReturnDate,
           CONVERT(NVARCHAR(19), aa.ReturnedAt, 120) AS returnedAt, u3.Name AS returnedByUserName, aa.Notes AS notes, aa.AssignmentType AS assignmentType
    FROM react_AssetAssignment aa
    INNER JOIN react_Asset a ON a.AssetID = aa.AssetID AND a.IsDeleted = 0
    LEFT JOIN react_AssetCategory c ON c.CategoryID = a.CategoryID
    INNER JOIN rb_users u1 ON u1.userid = aa.AssignedToUserID
    INNER JOIN rb_users u2 ON u2.userid = aa.AssignedByUserID
    LEFT JOIN rb_users u3 ON u3.userid = aa.ReturnedByUserID
    WHERE aa.AssignedToUserID = @userId
    ORDER BY aa.AssignedAt DESC
  `);
  return (result.recordset || []) as UserAssignmentHistoryRow[];
}
