/**
 * Asset verification: create record, list by asset or paginated.
 */

import { getRequest } from '../db/pool';
import { AppError } from '../middleware/errorHandler';
import type { VerificationCreateInput, VerificationListQueryInput } from '../validators/verificationSchemas';

export interface VerificationRecord {
  verificationId: number;
  assetId: number;
  assetTag: string;
  verifiedAt: Date;
  verifiedByUserId: number;
  verifiedByUserName: string;
  locationId: number | null;
  locationName: string | null;
  notes: string | null;
  verifiedStatus: string | null;
}

export async function listVerifications(query: VerificationListQueryInput): Promise<{ data: VerificationRecord[]; total: number }> {
  const req = await getRequest();
  const offset = (query.page - 1) * query.pageSize;
  const hasAsset = query.assetId != null ? 1 : 0;

  req.input('assetId', query.assetId ?? null);
  req.input('hasAsset', hasAsset);
  req.input('offset', offset);
  req.input('pageSize', query.pageSize);

  const result = await req.query(`
    ;WITH CTE AS (
      SELECT av.VerificationID, av.AssetID, a.AssetTag, av.VerifiedAt, av.VerifiedByUserID, u.Name AS VerifiedByUserName,
             av.LocationID, l.LocationName, av.Notes, av.VerifiedStatus,
             ROW_NUMBER() OVER (ORDER BY av.VerifiedAt DESC) AS rn
      FROM react_AssetVerification av
      INNER JOIN react_Asset a ON a.AssetID = av.AssetID
      INNER JOIN utbl_Users_Master u ON u.UserId = av.VerifiedByUserID
      LEFT JOIN react_Location l ON l.LocationID = av.LocationID
      WHERE (0 = @hasAsset OR av.AssetID = @assetId)
    )
    SELECT VerificationID AS verificationId, AssetID AS assetId, AssetTag AS assetTag, VerifiedAt AS verifiedAt,
           VerifiedByUserID AS verifiedByUserId, VerifiedByUserName AS verifiedByUserName, LocationID AS locationId,
           LocationName AS locationName, Notes AS notes, VerifiedStatus AS verifiedStatus
    FROM CTE WHERE rn > @offset AND rn <= @offset + @pageSize
  `);

  const countReq = await getRequest();
  countReq.input('assetId', query.assetId ?? null);
  countReq.input('hasAsset', hasAsset);
  const countResult = await countReq.query(`
    SELECT COUNT_BIG(*) AS total FROM react_AssetVerification av
    WHERE (0 = @hasAsset OR av.AssetID = @assetId)
  `);

  const data = (result.recordset || []) as VerificationRecord[];
  const total = (countResult.recordset?.[0] as { total: number })?.total ?? 0;
  return { data, total };
}

export async function getVerificationById(verificationId: number): Promise<VerificationRecord | null> {
  const req = await getRequest();
  const result = await req.input('verificationId', verificationId).query(`
    SELECT av.VerificationID AS verificationId, av.AssetID AS assetId, a.AssetTag AS assetTag, av.VerifiedAt AS verifiedAt,
           av.VerifiedByUserID AS verifiedByUserId, u.Name AS verifiedByUserName, av.LocationID AS locationId,
           l.LocationName AS locationName, av.Notes AS notes, av.VerifiedStatus AS verifiedStatus
    FROM react_AssetVerification av
    INNER JOIN react_Asset a ON a.AssetID = av.AssetID
    INNER JOIN utbl_Users_Master u ON u.UserId = av.VerifiedByUserID
    LEFT JOIN react_Location l ON l.LocationID = av.LocationID
    WHERE av.VerificationID = @verificationId
  `);
  const row = result.recordset[0] as VerificationRecord | undefined;
  return row ?? null;
}

export async function createVerification(input: VerificationCreateInput, userId: number): Promise<VerificationRecord> {
  const req = await getRequest();
  const assetCheck = await req.input('assetId', input.assetId).query(`
    SELECT AssetID FROM react_Asset WHERE AssetID = @assetId AND IsDeleted = 0
  `);
  if (assetCheck.recordset.length === 0) throw new AppError(400, 'Asset not found');
  if (input.locationId != null) {
    const locReq = await getRequest();
    const locCheck = await locReq.input('locationId', input.locationId).query(`
      SELECT LocationID FROM react_Location WHERE LocationID = @locationId AND IsDeleted = 0
    `);
    if (locCheck.recordset.length === 0) throw new AppError(400, 'Location not found');
  }

  const insertReq = await getRequest();
  const result = await insertReq
    .input('assetId', input.assetId)
    .input('verifiedByUserId', userId)
    .input('locationId', input.locationId ?? null)
    .input('notes', input.notes ?? null)
    .input('verifiedStatus', input.verifiedStatus ?? null)
    .query(`
      INSERT INTO react_AssetVerification (AssetID, VerifiedByUserID, LocationID, Notes, VerifiedStatus)
      OUTPUT INSERTED.VerificationID
      VALUES (@assetId, @verifiedByUserId, @locationId, @notes, @verifiedStatus)
    `);
  const verificationId = (result.recordset[0] as { VerificationID: number }).VerificationID;
  const record = await getVerificationById(verificationId);
  if (!record) throw new AppError(500, 'Failed to load verification');
  return record;
}
