/**
 * Transfer service: CRUD for cross-branch transfers, status workflow, audit log, child tables.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { TransferRow, TransferLogRow, TransferStatus } from './organization.types';

const SCHEMA = config.db.schema || 'dbo';
const TRANSFER = `[${SCHEMA}].[utbl_Transfer]`;
const TRANSFER_LOG = `[${SCHEMA}].[utbl_TransferLog]`;
const TRANSFER_JOB = `[${SCHEMA}].[utbl_TransferJob]`;
const TRANSFER_INVENTORY = `[${SCHEMA}].[utbl_TransferInventory]`;
const TRANSFER_INV_ITEM = `[${SCHEMA}].[utbl_TransferInventoryItem]`;
const TRANSFER_ASSET = `[${SCHEMA}].[utbl_TransferAsset]`;
const TRANSFER_USER = `[${SCHEMA}].[utbl_TransferUser]`;

function d2s(d: unknown): string { return d instanceof Date ? d.toISOString() : String(d ?? ''); }
function d2sn(d: unknown): string | null { return d == null ? null : (d instanceof Date ? d.toISOString() : String(d)); }

/** Generate a unique transfer code: TRF-YYYYMMDD-NNN */
async function generateTransferCode(): Promise<string> {
  const req = await getRequest();
  const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `TRF-${today}-`;
  const result = await req.input('prefix', `${prefix}%`).query(`
    SELECT COUNT(*) AS cnt FROM ${TRANSFER} WHERE TransferCode LIKE @prefix
  `);
  const cnt = ((result.recordset as { cnt: number }[])?.[0]?.cnt ?? 0) + 1;
  return `${prefix}${String(cnt).padStart(3, '0')}`;
}

const TRANSFER_SELECT = `
  Id AS id, TransferCode AS transferCode, TransferType AS transferType,
  FromBranchId AS fromBranchId, ToBranchId AS toBranchId,
  FromLocationId AS fromLocationId, ToLocationId AS toLocationId,
  Status AS status, Reason AS reason,
  RequestedBy AS requestedBy, ApprovedBy AS approvedBy, DispatchedBy AS dispatchedBy, ReceivedBy AS receivedBy,
  RequestedAt AS requestedAt, ApprovedAt AS approvedAt, DispatchedAt AS dispatchedAt, ReceivedAt AS receivedAt,
  IsActive AS isActive, CreatedOn AS createdOn, CreatedBy AS createdBy, UpdatedOn AS updatedOn, UpdatedBy AS updatedBy
`;

function mapTransferRow(r: any): TransferRow {
  return {
    ...r,
    requestedAt: d2s(r.requestedAt),
    approvedAt: d2sn(r.approvedAt),
    dispatchedAt: d2sn(r.dispatchedAt),
    receivedAt: d2sn(r.receivedAt),
    createdOn: d2s(r.createdOn),
    updatedOn: d2sn(r.updatedOn),
  };
}

export async function listTransfers(filters?: { branchId?: number; type?: string; status?: string }): Promise<TransferRow[]> {
  const req = await getRequest();
  req.input('branchId', filters?.branchId ?? null);
  req.input('type', filters?.type ?? null);
  req.input('status', filters?.status ?? null);
  const result = await req.query(`
    SELECT ${TRANSFER_SELECT} FROM ${TRANSFER}
    WHERE (@branchId IS NULL OR FromBranchId = @branchId OR ToBranchId = @branchId)
      AND (@type IS NULL OR TransferType = @type)
      AND (@status IS NULL OR Status = @status)
    ORDER BY RequestedAt DESC
  `);
  return (result.recordset || []).map(mapTransferRow);
}

export async function getTransfer(id: number): Promise<TransferRow | null> {
  const req = await getRequest();
  const result = await req.input('id', id).query(`SELECT ${TRANSFER_SELECT} FROM ${TRANSFER} WHERE Id = @id`);
  const r = (result.recordset as any[])?.[0];
  return r ? mapTransferRow(r) : null;
}

export async function createTransfer(data: {
  transferType: string; fromBranchId: number; toBranchId: number;
  fromLocationId?: number; toLocationId?: number; reason?: string;
}, userId: number): Promise<number> {
  const code = await generateTransferCode();
  const req = await getRequest();
  req.input('code', code);
  req.input('type', data.transferType);
  req.input('fromBranch', data.fromBranchId);
  req.input('toBranch', data.toBranchId);
  req.input('fromLoc', data.fromLocationId ?? null);
  req.input('toLoc', data.toLocationId ?? null);
  req.input('reason', (data.reason || '').trim().slice(0, 500) || null);
  req.input('userId', userId);
  const result = await req.query(`
    INSERT INTO ${TRANSFER} (TransferCode, TransferType, FromBranchId, ToBranchId, FromLocationId, ToLocationId, Reason, RequestedBy, CreatedBy)
    OUTPUT INSERTED.Id VALUES (@code, @type, @fromBranch, @toBranch, @fromLoc, @toLoc, @reason, @userId, @userId)
  `);
  const id = (result.recordset as { Id: number }[])[0].Id;
  await addTransferLog(id, 'STATUS_CHANGE', null, 'PENDING', 'Transfer created', userId);
  return id;
}

async function updateTransferStatus(id: number, newStatus: TransferStatus, userField: string, userId: number, remarks?: string): Promise<boolean> {
  const transfer = await getTransfer(id);
  if (!transfer) return false;
  const oldStatus = transfer.status;
  const req = await getRequest();
  req.input('id', id);
  req.input('status', newStatus);
  req.input('userId', userId);
  await req.query(`
    UPDATE ${TRANSFER} SET Status = @status, ${userField} = @userId, ${userField.replace('By', 'At')} = GETDATE(),
      UpdatedOn = GETDATE(), UpdatedBy = @userId
    WHERE Id = @id
  `);
  await addTransferLog(id, 'STATUS_CHANGE', oldStatus, newStatus, remarks ?? null, userId);
  return true;
}

export async function approveTransfer(id: number, userId: number, remarks?: string): Promise<boolean> {
  return updateTransferStatus(id, 'APPROVED', 'ApprovedBy', userId, remarks);
}

export async function dispatchTransfer(id: number, userId: number, remarks?: string): Promise<boolean> {
  return updateTransferStatus(id, 'IN_TRANSIT', 'DispatchedBy', userId, remarks);
}

export async function receiveTransfer(id: number, userId: number, remarks?: string): Promise<boolean> {
  return updateTransferStatus(id, 'RECEIVED', 'ReceivedBy', userId, remarks);
}

export async function rejectTransfer(id: number, userId: number, remarks?: string): Promise<boolean> {
  return updateTransferStatus(id, 'REJECTED', 'ApprovedBy', userId, remarks);
}

export async function cancelTransfer(id: number, userId: number, remarks?: string): Promise<boolean> {
  return updateTransferStatus(id, 'CANCELLED', 'ApprovedBy', userId, remarks);
}

// ─── Transfer Log ───

export async function addTransferLog(transferId: number, action: string, fromStatus: string | null, toStatus: string | null, remarks: string | null, userId: number): Promise<void> {
  const req = await getRequest();
  req.input('transferId', transferId);
  req.input('action', action);
  req.input('fromStatus', fromStatus);
  req.input('toStatus', toStatus);
  req.input('remarks', remarks);
  req.input('userId', userId);
  await req.query(`
    INSERT INTO ${TRANSFER_LOG} (TransferId, Action, FromStatus, ToStatus, Remarks, ActionBy)
    VALUES (@transferId, @action, @fromStatus, @toStatus, @remarks, @userId)
  `);
}

export async function listTransferLogs(transferId: number): Promise<TransferLogRow[]> {
  const req = await getRequest();
  const result = await req.input('transferId', transferId).query(`
    SELECT Id AS id, TransferId AS transferId, Action AS action, FromStatus AS fromStatus,
           ToStatus AS toStatus, Remarks AS remarks, ActionBy AS actionBy, ActionAt AS actionAt
    FROM ${TRANSFER_LOG} WHERE TransferId = @transferId ORDER BY ActionAt DESC
  `);
  return (result.recordset || []).map((r: any) => ({ ...r, actionAt: d2s(r.actionAt) }));
}

// ─── Child tables ───

export async function addTransferJobs(transferId: number, jobs: { jobId: number; notes?: string }[]): Promise<void> {
  for (const j of jobs) {
    const req = await getRequest();
    req.input('transferId', transferId).input('jobId', j.jobId).input('notes', j.notes ?? null);
    await req.query(`INSERT INTO ${TRANSFER_JOB} (TransferId, JobId, Notes) VALUES (@transferId, @jobId, @notes)`);
  }
}

export async function getTransferJobs(transferId: number): Promise<{ id: number; transferId: number; jobId: number; notes: string | null }[]> {
  const req = await getRequest();
  const result = await req.input('transferId', transferId).query(`
    SELECT Id AS id, TransferId AS transferId, JobId AS jobId, Notes AS notes FROM ${TRANSFER_JOB} WHERE TransferId = @transferId
  `);
  return result.recordset || [];
}

export async function addTransferInventory(transferId: number, notes: string | null, items: { itemName: string; sku?: string; quantity: number; unit?: string }[]): Promise<number> {
  const req = await getRequest();
  req.input('transferId', transferId).input('notes', notes);
  const result = await req.query(`
    INSERT INTO ${TRANSFER_INVENTORY} (TransferId, Notes) OUTPUT INSERTED.Id VALUES (@transferId, @notes)
  `);
  const invId = (result.recordset as { Id: number }[])[0].Id;
  for (const item of items) {
    const ir = await getRequest();
    ir.input('invId', invId).input('name', item.itemName).input('sku', item.sku ?? null)
      .input('qty', item.quantity).input('unit', item.unit ?? null);
    await ir.query(`
      INSERT INTO ${TRANSFER_INV_ITEM} (TransferInventoryId, ItemName, SKU, Quantity, Unit)
      VALUES (@invId, @name, @sku, @qty, @unit)
    `);
  }
  return invId;
}

export async function addTransferAssets(transferId: number, assets: { assetId: number; notes?: string }[]): Promise<void> {
  for (const a of assets) {
    const req = await getRequest();
    req.input('transferId', transferId).input('assetId', a.assetId).input('notes', a.notes ?? null);
    await req.query(`INSERT INTO ${TRANSFER_ASSET} (TransferId, AssetId, Notes) VALUES (@transferId, @assetId, @notes)`);
  }
}

export async function addTransferUsers(transferId: number, users: { userId: number; newRoleId?: number; notes?: string }[]): Promise<void> {
  for (const u of users) {
    const req = await getRequest();
    req.input('transferId', transferId).input('userId', u.userId)
      .input('roleId', u.newRoleId ?? null).input('notes', u.notes ?? null);
    await req.query(`INSERT INTO ${TRANSFER_USER} (TransferId, UserId, NewRoleId, Notes) VALUES (@transferId, @userId, @roleId, @notes)`);
  }
}
