/**
 * Analytics service: per-announcement stats, breakdowns, overview, and export.
 */

import { getRequest } from '../../config/db';
import { config } from '../../config/env';
import * as audienceService from './announcementAudience.service';
import type { AnnouncementAnalytics, AnalyticsBySegment, AnalyticsOverview, ReadLogRow } from './announcements.types';

const S = config.db.schema || 'dbo';
const MASTER  = `[${S}].[utbl_Announcements_Master]`;
const READLOG = `[${S}].[utbl_Announcements_ReadLog]`;

export async function getAnnouncementAnalytics(announcementId: number): Promise<AnnouncementAnalytics> {
  const targetedUsers = await audienceService.resolveTargetedUserIds(announcementId);
  const total = targetedUsers.length;

  const req = await getRequest();
  req.input('annId', announcementId);
  const stats = await req.query(`
    SELECT
      COUNT(DISTINCT r.UserId) AS viewedCount,
      COUNT(DISTINCT CASE WHEN r.AcknowledgedAt IS NOT NULL THEN r.UserId END) AS acknowledgedCount,
      AVG(CAST(DATEDIFF(MINUTE, a.PublishedAt, r.FirstOpenedAt) AS FLOAT)) AS avgMinToOpen
    FROM ${READLOG} r
    INNER JOIN ${MASTER} a ON a.Id = r.AnnouncementId
    WHERE r.AnnouncementId = @annId
  `);

  const s = stats.recordset[0];
  const viewed = s.viewedCount || 0;
  const acked = s.acknowledgedCount || 0;

  return {
    announcementId,
    totalTargeted: total,
    viewedCount: viewed,
    notViewedCount: total - viewed,
    acknowledgedCount: acked,
    readPercentage: total > 0 ? Math.round((viewed / total) * 100) : 0,
    ackPercentage: total > 0 ? Math.round((acked / total) * 100) : 0,
    avgTimeToFirstOpen: s.avgMinToOpen != null ? Math.round(s.avgMinToOpen) : null,
  };
}

export async function analyticsByBranch(announcementId: number): Promise<AnalyticsBySegment[]> {
  const req = await getRequest();
  req.input('annId', announcementId);
  const result = await req.query(`
    ;WITH targeted AS (
      SELECT DISTINCT uba.UserID, uba.BranchId, b.BranchName
      FROM [${S}].[utbl_UserBranchAccess] uba
      INNER JOIN [${S}].[utbl_Branch] b ON b.Id = uba.BranchId
      INNER JOIN [${S}].[utbl_Users_Master] u ON u.UserId = uba.UserID AND u.IsActive = 1
      WHERE uba.IsActive = 1
    )
    SELECT
      t.BranchName AS segmentName, t.BranchId AS segmentId,
      COUNT(DISTINCT t.UserID) AS targeted,
      COUNT(DISTINCT r.UserId) AS viewed,
      COUNT(DISTINCT CASE WHEN r.AcknowledgedAt IS NOT NULL THEN r.UserId END) AS acknowledged
    FROM targeted t
    LEFT JOIN ${READLOG} r ON r.AnnouncementId = @annId AND r.UserId = t.UserID
    GROUP BY t.BranchName, t.BranchId
    ORDER BY t.BranchName
  `);
  return result.recordset.map((r: any) => ({
    ...r,
    readPercentage: r.targeted > 0 ? Math.round((r.viewed / r.targeted) * 100) : 0,
  }));
}

export async function analyticsByDepartment(announcementId: number): Promise<AnalyticsBySegment[]> {
  const req = await getRequest();
  req.input('annId', announcementId);
  const result = await req.query(`
    ;WITH targeted AS (
      SELECT DISTINCT ep.UserID, ep.OrgDepartmentId, d.DepartmentName
      FROM [${S}].[hrms_EmployeeProfile] ep
      INNER JOIN [${S}].[utbl_Org_Department] d ON d.Id = ep.OrgDepartmentId
      INNER JOIN [${S}].[utbl_Users_Master] u ON u.UserId = ep.UserID AND u.IsActive = 1
      WHERE ep.OrgDepartmentId IS NOT NULL
    )
    SELECT
      t.DepartmentName AS segmentName, t.OrgDepartmentId AS segmentId,
      COUNT(DISTINCT t.UserID) AS targeted,
      COUNT(DISTINCT r.UserId) AS viewed,
      COUNT(DISTINCT CASE WHEN r.AcknowledgedAt IS NOT NULL THEN r.UserId END) AS acknowledged
    FROM targeted t
    LEFT JOIN ${READLOG} r ON r.AnnouncementId = @annId AND r.UserId = t.UserID
    GROUP BY t.DepartmentName, t.OrgDepartmentId
    ORDER BY t.DepartmentName
  `);
  return result.recordset.map((r: any) => ({
    ...r,
    readPercentage: r.targeted > 0 ? Math.round((r.viewed / r.targeted) * 100) : 0,
  }));
}

export async function getUserAnalytics(announcementId: number, page = 1, pageSize = 50): Promise<{ data: ReadLogRow[]; total: number }> {
  const targetedUsers = await audienceService.resolveTargetedUserIds(announcementId);
  if (!targetedUsers.length) return { data: [], total: 0 };

  const idList = targetedUsers.join(',');
  const offset = (page - 1) * pageSize;

  const countReq = await getRequest();
  const countResult = await countReq.query(`
    SELECT COUNT(*) AS total
    FROM [${S}].[utbl_Users_Master] u
    WHERE u.UserId IN (${idList}) AND u.IsActive = 1
  `);
  const total = countResult.recordset[0]?.total || 0;

  const dataReq = await getRequest();
  dataReq.input('annId', announcementId);
  dataReq.input('offset', offset);
  dataReq.input('pageSize', pageSize);

  const result = await dataReq.query(`
    ;WITH targetUsers AS (
      SELECT u.UserId, u.Name, u.Email
      FROM [${S}].[utbl_Users_Master] u
      WHERE u.UserId IN (${idList}) AND u.IsActive = 1
    ),
    ranked AS (
      SELECT
        tu.UserId AS userId, tu.Name AS userName, tu.Email AS userEmail,
        br.BranchName AS branchName, d.DepartmentName AS departmentName,
        r.Id AS id, r.AnnouncementId AS announcementId,
        r.FirstOpenedAt AS firstOpenedAt, r.LastOpenedAt AS lastOpenedAt,
        r.OpenCount AS openCount, r.AcknowledgedAt AS acknowledgedAt,
        r.TimeSpentSeconds AS timeSpentSeconds, r.DeviceType AS deviceType, r.IPAddress AS ipAddress,
        ROW_NUMBER() OVER (ORDER BY CASE WHEN r.Id IS NULL THEN 0 ELSE 1 END, r.FirstOpenedAt DESC) AS rn
      FROM targetUsers tu
      LEFT JOIN ${READLOG} r ON r.AnnouncementId = @annId AND r.UserId = tu.UserId
      LEFT JOIN [${S}].[hrms_EmployeeProfile] ep ON ep.UserID = tu.UserId
      LEFT JOIN [${S}].[utbl_Org_Department] d ON d.Id = ep.OrgDepartmentId
      LEFT JOIN [${S}].[utbl_UserBranchAccess] uba ON uba.UserID = tu.UserId AND uba.IsActive = 1
      LEFT JOIN [${S}].[utbl_Branch] br ON br.Id = uba.BranchId
    )
    SELECT * FROM ranked WHERE rn > @offset AND rn <= @offset + @pageSize
  `);

  return {
    total,
    data: result.recordset,
  };
}

export async function getOverview(): Promise<AnalyticsOverview> {
  const req = await getRequest();
  const result = await req.query(`
    SELECT
      COUNT(*) AS totalAnnouncements,
      SUM(CASE WHEN Status = 4 THEN 1 ELSE 0 END) AS totalPublished
    FROM ${MASTER};

    SELECT
      COUNT(DISTINCT r.UserId) AS totalReach,
      AVG(CAST(readPct AS FLOAT)) AS avgReadRate,
      AVG(CAST(ackPct AS FLOAT)) AS avgAckRate
    FROM (
      SELECT a.Id,
        CAST(COUNT(DISTINCT r.UserId) AS FLOAT) / NULLIF(1, 0) AS readPct,
        CAST(COUNT(DISTINCT CASE WHEN r.AcknowledgedAt IS NOT NULL THEN r.UserId END) AS FLOAT) / NULLIF(1, 0) AS ackPct
      FROM ${MASTER} a
      LEFT JOIN ${READLOG} r ON r.AnnouncementId = a.Id
      WHERE a.Status = 4
      GROUP BY a.Id
    ) sub
    LEFT JOIN ${READLOG} r ON 1=1;

    SELECT
      CONVERT(VARCHAR(10), a.PublishedAt, 120) AS dt,
      COUNT(DISTINCT a.Id) AS published,
      COUNT(DISTINCT r.Id) AS reads
    FROM ${MASTER} a
    LEFT JOIN ${READLOG} r ON r.AnnouncementId = a.Id
    WHERE a.Status = 4 AND a.PublishedAt IS NOT NULL
      AND a.PublishedAt >= DATEADD(DAY, -30, GETDATE())
    GROUP BY CONVERT(VARCHAR(10), a.PublishedAt, 120)
    ORDER BY dt
  `);

  const summary = result.recordsets[0][0];
  const reach = result.recordsets[1][0];

  return {
    totalAnnouncements: summary.totalAnnouncements || 0,
    totalPublished: summary.totalPublished || 0,
    totalReach: reach?.totalReach || 0,
    avgReadRate: Math.round(reach?.avgReadRate || 0),
    avgAckRate: Math.round(reach?.avgAckRate || 0),
    trend: (result.recordsets[2] || []).map((r: any) => ({
      date: r.dt,
      published: r.published,
      reads: r.reads,
    })),
  };
}
