/**
 * Version history service.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { VersionRow } from './announcements.types';

const S = config.db.schema || 'dbo';
const VERSION = `[${S}].[utbl_Announcements_Version]`;

export async function getVersions(announcementId: number): Promise<VersionRow[]> {
  const req = await getRequest();
  req.input('annId', announcementId);
  const result = await req.query(`
    SELECT v.Id AS id, v.AnnouncementId AS announcementId,
           v.VersionNumber AS versionNumber, v.Title AS title, v.Content AS content,
           v.EditedBy AS editedBy, u.Name AS editedByName,
           v.EditedAt AS editedAt, v.ChangeNotes AS changeNotes
    FROM ${VERSION} v
    LEFT JOIN [${S}].[utbl_Users_Master] u ON u.UserId = v.EditedBy
    WHERE v.AnnouncementId = @annId
    ORDER BY v.VersionNumber DESC
  `);
  return result.recordset;
}
