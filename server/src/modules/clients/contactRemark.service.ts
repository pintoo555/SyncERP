/**
 * Contact Remark service: CRUD for reviews/remarks on client contacts.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { ContactRemarkRow, ContactRemarkCreateData } from './clients.types';

const SCHEMA = config.db.schema || 'dbo';
const REMARK = `[${SCHEMA}].[utbl_ContactRemark]`;
const USERS = `[${SCHEMA}].[rb_users]`;

function dateToIso(d: unknown): string {
  return d instanceof Date ? d.toISOString() : String(d ?? '');
}
function dateToIsoOrNull(d: unknown): string | null {
  if (d == null) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

function mapRow(r: any): ContactRemarkRow {
  return {
    ...r,
    createdOn: dateToIso(r.createdOn),
    updatedOn: dateToIsoOrNull(r.updatedOn),
  };
}

export async function listRemarks(contactId: number): Promise<ContactRemarkRow[]> {
  const req = await getRequest();
  req.input('contactId', contactId);
  const result = await req.query(`
    SELECT r.Id AS id, r.ContactId AS contactId, r.ClientId AS clientId,
           r.RemarkText AS remarkText, r.BehaviorTags AS behaviorTags,
           r.IsFlagged AS isFlagged, r.IsActive AS isActive,
           r.CreatedBy AS createdBy, u.Name AS createdByName,
           r.CreatedOn AS createdOn, r.UpdatedBy AS updatedBy, r.UpdatedOn AS updatedOn
    FROM ${REMARK} r
    LEFT JOIN ${USERS} u ON u.userid = r.CreatedBy
    WHERE r.ContactId = @contactId AND r.IsActive = 1
    ORDER BY r.CreatedOn DESC
  `);
  return (result.recordset || []).map(mapRow);
}

export async function createRemark(
  contactId: number,
  clientId: number,
  data: ContactRemarkCreateData,
  userId: number | null
): Promise<number> {
  const req = await getRequest();
  req.input('contactId', contactId);
  req.input('clientId', clientId);
  req.input('remarkText', (data.remarkText || '').trim().slice(0, 2000));
  req.input('behaviorTags', data.behaviorTags ? data.behaviorTags.trim().slice(0, 500) : null);
  req.input('isFlagged', data.isFlagged ? 1 : 0);
  req.input('createdBy', userId);
  const result = await req.query(`
    INSERT INTO ${REMARK}
      (ContactId, ClientId, RemarkText, BehaviorTags, IsFlagged, CreatedBy)
    OUTPUT INSERTED.Id
    VALUES (@contactId, @clientId, @remarkText, @behaviorTags, @isFlagged, @createdBy)
  `);
  return (result.recordset as { Id: number }[])[0].Id;
}

export async function deleteRemark(remarkId: number, userId: number | null): Promise<void> {
  const req = await getRequest();
  req.input('id', remarkId);
  req.input('updatedBy', userId);
  await req.query(`
    UPDATE ${REMARK}
    SET IsActive = 0, UpdatedOn = GETDATE(), UpdatedBy = @updatedBy
    WHERE Id = @id
  `);
}
