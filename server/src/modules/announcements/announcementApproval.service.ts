/**
 * Approval workflow service.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { ApprovalHistoryRow } from './announcements.types';

const S = config.db.schema || 'dbo';
const HISTORY = `[${S}].[utbl_Announcements_ApprovalHistory]`;

export async function recordAction(
  announcementId: number,
  action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RECALLED',
  userId: number,
  comments?: string,
): Promise<void> {
  const req = await getRequest();
  req.input('annId', announcementId);
  req.input('action', action);
  req.input('userId', userId);
  req.input('comments', comments ? comments.slice(0, 500) : null);
  await req.query(`
    INSERT INTO ${HISTORY} (AnnouncementId, Action, ActionBy, Comments)
    VALUES (@annId, @action, @userId, @comments)
  `);
}

export async function getHistory(announcementId: number): Promise<ApprovalHistoryRow[]> {
  const req = await getRequest();
  req.input('annId', announcementId);
  const result = await req.query(`
    SELECT h.Id AS id, h.AnnouncementId AS announcementId,
           h.Action AS action, h.ActionBy AS actionBy, u.Name AS actionByName,
           h.ActionAt AS actionAt, h.Comments AS comments
    FROM ${HISTORY} h
    LEFT JOIN [${S}].[utbl_Users_Master] u ON u.UserId = h.ActionBy
    WHERE h.AnnouncementId = @annId
    ORDER BY h.ActionAt DESC
  `);
  return result.recordset;
}
