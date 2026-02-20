/**
 * Read tracking and acknowledgment service.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import type { ReadLogRow, TrackReadData } from './announcements.types';
import { cache, TTL } from './cache';

const S = config.db.schema || 'dbo';
const READLOG = `[${S}].[utbl_Announcements_ReadLog]`;

export async function trackRead(data: TrackReadData): Promise<void> {
  const req = await getRequest();
  req.input('annId', data.announcementId);
  req.input('userId', data.userId);
  req.input('device', data.deviceType || null);
  req.input('ip', data.ipAddress || null);
  req.input('timeSpent', data.timeSpentSeconds || null);

  await req.query(`
    MERGE ${READLOG} AS target
    USING (SELECT @annId AS AnnId, @userId AS UserId) AS source
    ON target.AnnouncementId = source.AnnId AND target.UserId = source.UserId
    WHEN MATCHED THEN
      UPDATE SET
        LastOpenedAt = GETDATE(),
        OpenCount = target.OpenCount + 1,
        DeviceType = COALESCE(@device, target.DeviceType),
        IPAddress = COALESCE(@ip, target.IPAddress),
        TimeSpentSeconds = CASE
          WHEN @timeSpent IS NOT NULL THEN COALESCE(target.TimeSpentSeconds, 0) + @timeSpent
          ELSE target.TimeSpentSeconds
        END
    WHEN NOT MATCHED THEN
      INSERT (AnnouncementId, UserId, DeviceType, IPAddress, TimeSpentSeconds)
      VALUES (@annId, @userId, @device, @ip, @timeSpent);
  `);
  cache.invalidate(`unread:${data.userId}`);
}

export async function acknowledge(announcementId: number, userId: number): Promise<void> {
  const req = await getRequest();
  req.input('annId', announcementId);
  req.input('userId', userId);

  await req.query(`
    MERGE ${READLOG} AS target
    USING (SELECT @annId AS AnnId, @userId AS UserId) AS source
    ON target.AnnouncementId = source.AnnId AND target.UserId = source.UserId
    WHEN MATCHED AND target.AcknowledgedAt IS NULL THEN
      UPDATE SET AcknowledgedAt = GETDATE(), LastOpenedAt = GETDATE()
    WHEN NOT MATCHED THEN
      INSERT (AnnouncementId, UserId, AcknowledgedAt)
      VALUES (@annId, @userId, GETDATE());
  `);
  cache.invalidate(`unread:${userId}`);
  cache.invalidate(`emergency:${userId}`);
}

export async function getReadLog(announcementId: number): Promise<ReadLogRow[]> {
  const req = await getRequest();
  req.input('annId', announcementId);
  const result = await req.query(`
    SELECT r.Id AS id, r.AnnouncementId AS announcementId,
           r.UserId AS userId, u.Name AS userName, u.Email AS userEmail,
           br.BranchName AS branchName, d.DepartmentName AS departmentName,
           r.FirstOpenedAt AS firstOpenedAt, r.LastOpenedAt AS lastOpenedAt,
           r.OpenCount AS openCount, r.AcknowledgedAt AS acknowledgedAt,
           r.TimeSpentSeconds AS timeSpentSeconds, r.DeviceType AS deviceType, r.IPAddress AS ipAddress
    FROM ${READLOG} r
    INNER JOIN [${S}].[utbl_Users_Master] u ON u.UserId = r.UserId
    LEFT JOIN [${S}].[hrms_EmployeeProfile] ep ON ep.UserID = r.UserId
    LEFT JOIN [${S}].[utbl_Org_Department] d ON d.Id = ep.OrgDepartmentId
    LEFT JOIN [${S}].[utbl_UserBranchAccess] uba ON uba.UserID = r.UserId AND uba.IsActive = 1
    LEFT JOIN [${S}].[utbl_Branch] br ON br.Id = uba.BranchId
    WHERE r.AnnouncementId = @annId
    ORDER BY r.FirstOpenedAt DESC
  `);
  return result.recordset;
}

export async function getUserReadStatus(announcementId: number, userId: number): Promise<{ isRead: boolean; isAcknowledged: boolean }> {
  const req = await getRequest();
  req.input('annId', announcementId);
  req.input('userId', userId);
  const result = await req.query(`
    SELECT AcknowledgedAt AS acknowledgedAt FROM ${READLOG}
    WHERE AnnouncementId = @annId AND UserId = @userId
  `);
  if (!result.recordset.length) return { isRead: false, isAcknowledged: false };
  return { isRead: true, isAcknowledged: !!result.recordset[0].acknowledgedAt };
}

export async function getUnreadCount(userId: number): Promise<number> {
  const CACHE_KEY = `unread:${userId}`;
  const cached = cache.get<number>(CACHE_KEY);
  if (cached !== undefined) return cached;

  const req = await getRequest();
  req.input('userId', userId);
  const result = await req.query(`
    ;WITH targeted AS (
      SELECT DISTINCT a.Id
      FROM [${S}].[utbl_Announcements_Master] a
      WHERE a.Status = 4
        AND (a.PublishFrom IS NULL OR a.PublishFrom <= GETDATE())
        AND (a.PublishTo IS NULL OR a.PublishTo > GETDATE())
        AND (
          a.IsCompanyWide = 1
          OR EXISTS (
            SELECT 1 FROM [${S}].[utbl_Announcements_Audience] aud WHERE aud.AnnouncementId = a.Id AND aud.TargetType = 'USER' AND aud.TargetId = @userId
          )
          OR EXISTS (
            SELECT 1 FROM [${S}].[utbl_Announcements_Audience] aud
            INNER JOIN [${S}].[utbl_UserBranchAccess] uba ON aud.TargetType = 'BRANCH' AND uba.BranchId = aud.TargetId AND uba.UserID = @userId AND uba.IsActive = 1
            WHERE aud.AnnouncementId = a.Id
          )
          OR EXISTS (
            SELECT 1 FROM [${S}].[utbl_Announcements_Audience] aud
            INNER JOIN [${S}].[hrms_EmployeeProfile] ep ON aud.TargetType = 'DEPARTMENT' AND ep.OrgDepartmentId = aud.TargetId AND ep.UserID = @userId
            WHERE aud.AnnouncementId = a.Id
          )
          OR EXISTS (
            SELECT 1 FROM [${S}].[utbl_Announcements_Audience] aud
            INNER JOIN [${S}].[utbl_Org_TeamMember] tm ON aud.TargetType = 'TEAM' AND tm.TeamId = aud.TargetId AND tm.UserId = @userId AND tm.LeftAt IS NULL
            WHERE aud.AnnouncementId = a.Id
          )
          OR EXISTS (
            SELECT 1 FROM [${S}].[utbl_Announcements_Audience] aud
            INNER JOIN [${S}].[hrms_EmployeeProfile] ep ON aud.TargetType = 'DESIGNATION' AND ep.OrgDesignationId = aud.TargetId AND ep.UserID = @userId
            WHERE aud.AnnouncementId = a.Id
          )
          OR EXISTS (
            SELECT 1 FROM [${S}].[utbl_Announcements_Audience] aud
            INNER JOIN [${S}].[react_UserRoles] ur ON aud.TargetType = 'ROLE' AND ur.RoleID = aud.TargetId AND ur.UserID = @userId AND ur.RevokedAt IS NULL
            WHERE aud.AnnouncementId = a.Id
          )
        )
    )
    SELECT COUNT(*) AS cnt
    FROM targeted t
    WHERE NOT EXISTS (
      SELECT 1 FROM ${READLOG} r WHERE r.AnnouncementId = t.Id AND r.UserId = @userId
    )
  `);
  const cnt = result.recordset[0].cnt;
  cache.set(CACHE_KEY, cnt, TTL.UNREAD_COUNT);
  return cnt;
}
