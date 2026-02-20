/**
 * Reminder scheduling and logging service.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import * as audienceService from './announcementAudience.service';

const S = config.db.schema || 'dbo';
const MASTER   = `[${S}].[utbl_Announcements_Master]`;
const READLOG  = `[${S}].[utbl_Announcements_ReadLog]`;
const REMINDER = `[${S}].[utbl_Announcements_ReminderLog]`;

export interface ReminderTarget {
  announcementId: number;
  announcementTitle: string;
  userId: number;
}

/**
 * Finds users who need reminders and logs them.
 * Returns targets so the caller can send notifications.
 */
export async function processReminders(): Promise<ReminderTarget[]> {
  const req = await getRequest();
  const announcements = await req.query(`
    SELECT Id, Title, ReminderIntervalHours, ReminderMaxCount
    FROM ${MASTER}
    WHERE Status = 4 AND ReminderEnabled = 1
      AND (PublishTo IS NULL OR PublishTo > GETDATE())
  `);

  const targets: ReminderTarget[] = [];

  for (const ann of announcements.recordset) {
    const allUsers = await audienceService.resolveTargetedUserIds(ann.Id);
    if (!allUsers.length) continue;

    for (const userId of allUsers) {
      const checkReq = await getRequest();
      checkReq.input('annId', ann.Id);
      checkReq.input('userId', userId);
      checkReq.input('maxCount', ann.ReminderMaxCount || 3);
      checkReq.input('intervalHours', ann.ReminderIntervalHours || 24);

      const check = await checkReq.query(`
        -- Skip if user already read
        IF EXISTS (SELECT 1 FROM ${READLOG} WHERE AnnouncementId = @annId AND UserId = @userId)
          SELECT 0 AS shouldRemind;
        ELSE
        BEGIN
          DECLARE @lastSent DATETIME, @totalSent INT;
          SELECT @totalSent = COUNT(*), @lastSent = MAX(SentAt)
          FROM ${REMINDER}
          WHERE AnnouncementId = @annId AND UserId = @userId;

          IF @totalSent >= @maxCount
            SELECT 0 AS shouldRemind;
          ELSE IF @lastSent IS NOT NULL AND DATEDIFF(HOUR, @lastSent, GETDATE()) < @intervalHours
            SELECT 0 AS shouldRemind;
          ELSE
            SELECT 1 AS shouldRemind;
        END
      `);

      if (check.recordset[0]?.shouldRemind === 1) {
        const logReq = await getRequest();
        logReq.input('annId', ann.Id);
        logReq.input('userId', userId);
        const countRes = await logReq.query(`
          SELECT COUNT(*) AS cnt FROM ${REMINDER} WHERE AnnouncementId = @annId AND UserId = @userId
        `);
        const insertReq = await getRequest();
        insertReq.input('annId', ann.Id);
        insertReq.input('userId', userId);
        insertReq.input('cnt', (countRes.recordset[0].cnt || 0) + 1);
        await insertReq.query(`
          INSERT INTO ${REMINDER} (AnnouncementId, UserId, ReminderCount, Channel)
          VALUES (@annId, @userId, @cnt, 'IN_APP')
        `);
        targets.push({ announcementId: ann.Id, announcementTitle: ann.Title, userId });
      }
    }
  }

  return targets;
}
